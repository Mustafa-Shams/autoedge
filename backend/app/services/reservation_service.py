"""Reservation service — the core DB showpiece.

Full transactional reserve/cancel/expire/convert with:
- Row locking in order: vehicle → reservation → bank_account (Article XIII)
- Idempotency keys (no double charging)
- Stock movement + bank transaction ledger entries
- FOR UPDATE SKIP LOCKED for concurrent expiry sweeps
- Notifications on all state changes
"""
from datetime import timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional, Tuple

from sqlalchemy import and_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import verify_password
from app.core.time import utcnow
from app.models.bank_account import BankAccount
from app.models.bank_transaction import BankTransaction
from app.models.customer_account import CustomerAccount
from app.models.reservation import Reservation
from app.models.stock_movement import StockMovement
from app.models.vehicle import Vehicle
from app.models.test_drive import TestDrive
from app.models.trade_in_request import TradeInRequest
from app.services import bank_service, stock_service
from app.services.notify_service import notify


class ReservationError(Exception):
    """Base exception for reservation errors."""
    def __init__(self, message: str, status_code: int = 400):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


def reserve(
    db: Session,
    customer_id: int,
    vehicle_id: int,
    hold_days: int,
    password: str,
    idempotency_key: str,
) -> Reservation:
    """Reserve a car per spec 7.2.

    Full transactional flow:
    1. Run expire_stale() first (cheap)
    2. Verify customer password
    3. Check idempotency key
    4. BEGIN transaction:
       a. Lock vehicle (FOR UPDATE), check stock > 0
       b. Check customer limits (max active reservations, no duplicate)
       c. Calculate deposit (10% of price)
       d. Lock bank account, check balance >= deposit
       e. Insert reservation (Active)
       f. Debit bank account, insert bank_transaction
       g. Decrement stock, insert stock_movement
    5. COMMIT
    6. Create notification (after commit via caller's BackgroundTasks)
    """
    # 1. Run expiry sweep first
    expire_stale(db)

    # 2. Verify customer password
    account = db.query(CustomerAccount).filter(
        CustomerAccount.customer_id == customer_id
    ).first()
    if account is None:
        raise ReservationError("Account not found", 404)

    if not verify_password(password, account.password_hash):
        raise ReservationError("Incorrect password", 401)

    # 3. Check idempotency — if this key already exists, return the existing reservation
    if idempotency_key:
        existing_txn = db.query(BankTransaction).filter(
            BankTransaction.idempotency_key == idempotency_key
        ).first()
        if existing_txn and existing_txn.reservation_id:
            existing_res = db.query(Reservation).filter(
                Reservation.reservation_id == existing_txn.reservation_id
            ).first()
            if existing_res:
                return existing_res

    # Validate hold_days
    if hold_days < settings.RESERVATION_MIN_HOLD_DAYS:
        raise ReservationError(
            f"Minimum hold period is {settings.RESERVATION_MIN_HOLD_DAYS} days", 422
        )
    if hold_days > settings.RESERVATION_MAX_HOLD_DAYS:
        raise ReservationError(
            f"Maximum hold period is {settings.RESERVATION_MAX_HOLD_DAYS} days", 422
        )

    # 4. BEGIN transactional flow
    # 4a. Lock vehicle (FIRST in lock order)
    vehicle = (
        db.query(Vehicle)
        .filter(Vehicle.vehicle_id == vehicle_id, Vehicle.is_published == True)
        .with_for_update()
        .first()
    )
    if vehicle is None:
        raise ReservationError("Vehicle not found", 404)
    if vehicle.stock_quantity <= 0:
        raise ReservationError("Out of stock", 409)

    # 4b. Check customer limits
    active_count = db.query(Reservation).filter(
        Reservation.customer_id == customer_id,
        Reservation.status == "Active",
    ).count()

    if active_count >= settings.MAX_ACTIVE_RESERVATIONS_PER_CUSTOMER:
        raise ReservationError(
            f"Maximum {settings.MAX_ACTIVE_RESERVATIONS_PER_CUSTOMER} active reservations allowed",
            409,
        )

    # Check no duplicate active reservation for this vehicle
    duplicate = db.query(Reservation).filter(
        Reservation.customer_id == customer_id,
        Reservation.vehicle_id == vehicle_id,
        Reservation.status == "Active",
    ).first()
    if duplicate:
        raise ReservationError("You already have an active reservation for this vehicle", 409)

    # 4c. Calculate deposit
    deposit = (vehicle.price * settings.RESERVATION_DEPOSIT_PERCENT / 100).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )

    # 4d. Lock bank account (LAST in lock order)
    bank_acct = (
        db.query(BankAccount)
        .filter(BankAccount.customer_id == customer_id)
        .with_for_update()
        .first()
    )
    if bank_acct is None:
        raise ReservationError("No bank account found", 400)
    if bank_acct.balance < deposit:
        raise ReservationError("Payment declined: insufficient funds", 402)

    # 4e. Insert reservation BEFORE decrementing stock
    # (so the trigger sees the active reservation and sets status 'Reserved')
    now = utcnow()
    expires_at = now + timedelta(days=hold_days)
    vehicle_label = f"{vehicle.year} {vehicle.make} {vehicle.model}"

    reservation = Reservation(
        customer_id=customer_id,
        vehicle_id=vehicle_id,
        deposit_amount=deposit,
        hold_days=hold_days,
        reserved_at=now,
        expires_at=expires_at,
        status="Active",
        notes=f"Online reservation for {vehicle_label}",
    )
    db.add(reservation)
    db.flush()  # Get reservation_id

    # 4f. Debit bank account
    new_balance = bank_acct.balance - deposit
    bank_acct.balance = new_balance

    ref_code = bank_service._ensure_unique_ref(db)
    txn = BankTransaction(
        bank_account_id=bank_acct.bank_account_id,
        txn_type="Reservation Deposit",
        direction="Debit",
        amount=deposit,
        balance_after=new_balance,
        reference_code=ref_code,
        idempotency_key=idempotency_key,
        description=f"Reservation deposit for {vehicle_label} ({hold_days}-day hold)",
        reservation_id=reservation.reservation_id,
    )
    db.add(txn)

    # 4g. Decrement stock and write stock movement
    vehicle.stock_quantity = vehicle.stock_quantity - 1

    movement = StockMovement(
        vehicle_id=vehicle_id,
        change_qty=-1,
        reason="Reservation",
        reference_id=reservation.reservation_id,
    )
    db.add(movement)

    # 5. Notification + email (inside transaction so it's atomic)
    notify(
        db,
        customer_id=customer_id,
        notification_type="reservation_confirmed",
        title=f"Reservation Confirmed — {vehicle_label}",
        message=f"Your reservation for the {vehicle_label} has been confirmed. "
                f"Deposit of ${deposit:,.2f} has been charged. "
                f"Your hold expires on {expires_at.strftime('%b %d, %Y')}.",
        link_path="/account/reservations",
        vehicle_label=vehicle_label,
        deposit=f"${deposit:,.2f}",
        expires_at=expires_at.strftime("%b %d, %Y"),
        reference_code=ref_code,
    )

    db.flush()
    return reservation


def cancel(
    db: Session,
    customer_id: int,
    reservation_id: int,
) -> Reservation:
    """Cancel an active reservation per spec 7.2.

    Lock order: reservation → vehicle → bank_account.
    Refund = deposit * (100 - CANCELLATION_FEE_PERCENT) / 100.
    """
    # Lock reservation
    reservation = (
        db.query(Reservation)
        .filter(
            Reservation.reservation_id == reservation_id,
            Reservation.customer_id == customer_id,
        )
        .with_for_update()
        .first()
    )
    if reservation is None:
        raise ReservationError("Reservation not found", 404)
    if reservation.status != "Active":
        raise ReservationError(
            f"Cannot cancel a reservation with status '{reservation.status}'", 409
        )

    # Lock vehicle (in lock order)
    vehicle = (
        db.query(Vehicle)
        .filter(Vehicle.vehicle_id == reservation.vehicle_id)
        .with_for_update()
        .first()
    )

    # Lock bank account (last in lock order)
    bank_acct = (
        db.query(BankAccount)
        .filter(BankAccount.customer_id == customer_id)
        .with_for_update()
        .first()
    )

    return _close_reservation(
        db, reservation, vehicle, bank_acct, "Cancelled", "Reservation Cancelled"
    )


def cancel_by_staff(
    db: Session,
    reservation_id: int,
) -> Reservation:
    """Cancel a reservation by staff (manager only) per spec 10.4.

    Same refund rules as customer cancel.
    """
    reservation = (
        db.query(Reservation)
        .filter(Reservation.reservation_id == reservation_id)
        .with_for_update()
        .first()
    )
    if reservation is None:
        raise ReservationError("Reservation not found", 404)
    if reservation.status != "Active":
        raise ReservationError(
            f"Cannot cancel a reservation with status '{reservation.status}'", 409
        )

    vehicle = (
        db.query(Vehicle)
        .filter(Vehicle.vehicle_id == reservation.vehicle_id)
        .with_for_update()
        .first()
    )
    bank_acct = (
        db.query(BankAccount)
        .filter(BankAccount.customer_id == reservation.customer_id)
        .with_for_update()
        .first()
    )

    return _close_reservation(
        db, reservation, vehicle, bank_acct, "Cancelled", "Reservation Cancelled"
    )


def expire_stale(db: Session) -> int:
    """Expire all past-due reservations, test drives, and trade-in offers.

    Uses FOR UPDATE SKIP LOCKED so concurrent sweeps don't collide.
    Returns the number of reservations expired.
    """
    now = utcnow()
    expired_count = 0

    # ── Expire reservations ──
    stale_reservations = (
        db.query(Reservation)
        .filter(
            Reservation.status == "Active",
            Reservation.expires_at <= now,
        )
        .with_for_update(skip_locked=True)
        .all()
    )

    for reservation in stale_reservations:
        vehicle = (
            db.query(Vehicle)
            .filter(Vehicle.vehicle_id == reservation.vehicle_id)
            .with_for_update()
            .first()
        )
        bank_acct = (
            db.query(BankAccount)
            .filter(BankAccount.customer_id == reservation.customer_id)
            .with_for_update()
            .first()
        )

        _close_reservation(
            db, reservation, vehicle, bank_acct, "Expired", "Reservation Expired"
        )
        expired_count += 1

    # ── Expire test drive requests (past 48h or past slot time) ──
    stale_test_drives = (
        db.query(TestDrive)
        .filter(
            TestDrive.status == "Requested",
            TestDrive.expires_at <= now,
        )
        .with_for_update(skip_locked=True)
        .all()
    )

    for td in stale_test_drives:
        td.status = "Expired"
        notify(
            db,
            customer_id=td.customer_id,
            notification_type="test_drive_expired",
            title="Test Drive Request Expired",
            message="Your test drive request was not confirmed in time and has expired. "
                    "You may submit a new request.",
            link_path="/account/test-drives",
            vehicle_label="your vehicle",
        )

    # ── Expire trade-in offers ──
    stale_trade_ins = (
        db.query(TradeInRequest)
        .filter(
            TradeInRequest.status == "Offer Made",
            TradeInRequest.offer_valid_until <= now,
        )
        .with_for_update(skip_locked=True)
        .all()
    )

    for ti in stale_trade_ins:
        ti.status = "Expired"
        ti.updated_at = now
        notify(
            db,
            customer_id=ti.customer_id,
            notification_type="trade_in_expired",
            title="Trade-In Offer Expired",
            message="Your trade-in offer has expired. You may submit a new request.",
            link_path="/account/trade-ins",
            vehicle_label=f"{ti.year} {ti.make} {ti.model}" if hasattr(ti, 'make') else "your vehicle",
        )

    if stale_reservations or stale_test_drives or stale_trade_ins:
        db.flush()

    return expired_count


def convert_on_sale(
    db: Session,
    reservation_id: int,
) -> Reservation:
    """Mark a reservation as Converted when the sale is completed.

    Called from the sale completion flow. No refund, no stock change
    (stock was already decremented on reserve).
    """
    reservation = (
        db.query(Reservation)
        .filter(Reservation.reservation_id == reservation_id)
        .with_for_update()
        .first()
    )
    if reservation is None:
        raise ReservationError("Reservation not found", 404)
    if reservation.status != "Active":
        raise ReservationError(
            f"Cannot convert a reservation with status '{reservation.status}'", 409
        )

    reservation.status = "Converted"
    reservation.closed_at = utcnow()

    # Notification
    vehicle = db.query(Vehicle).filter(
        Vehicle.vehicle_id == reservation.vehicle_id
    ).first()
    vehicle_label = f"{vehicle.year} {vehicle.make} {vehicle.model}" if vehicle else "your vehicle"

    notify(
        db,
        customer_id=reservation.customer_id,
        notification_type="purchase_completed",
        title=f"Purchase Complete — {vehicle_label}",
        message=f"Congratulations! Your purchase of the {vehicle_label} is complete. "
                f"The car has been added to your garage.",
        link_path="/account/garage",
        vehicle_label=vehicle_label,
    )
    db.flush()
    return reservation


def _close_reservation(
    db: Session,
    reservation: Reservation,
    vehicle: Optional[Vehicle],
    bank_acct: Optional[BankAccount],
    new_status: str,
    stock_reason: str,
) -> Reservation:
    """Close a reservation (Cancel or Expire) with refund and stock restore.

    Refund = deposit * (100 - CANCELLATION_FEE_PERCENT) / 100.
    """
    now = utcnow()

    # Calculate refund
    fee_percent = Decimal(str(settings.CANCELLATION_FEE_PERCENT))
    refund_amount = (
        reservation.deposit_amount * (100 - fee_percent) / 100
    ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    fee_amount = reservation.deposit_amount - refund_amount

    # Update reservation status
    reservation.status = new_status
    reservation.closed_at = now

    # Credit refund to bank account
    if bank_acct and refund_amount > 0:
        new_balance = bank_acct.balance + refund_amount
        bank_acct.balance = new_balance

        ref_code = bank_service._ensure_unique_ref(db)
        txn = BankTransaction(
            bank_account_id=bank_acct.bank_account_id,
            txn_type="Refund",
            direction="Credit",
            amount=refund_amount,
            balance_after=new_balance,
            reference_code=ref_code,
            description=(
                f"Refund for {new_status.lower()} reservation "
                f"(${refund_amount:,.2f} of ${reservation.deposit_amount:,.2f} deposit; "
                f"${fee_amount:,.2f} cancellation fee retained)"
            ),
            reservation_id=reservation.reservation_id,
        )
        db.add(txn)

    # Restore stock
    if vehicle:
        vehicle.stock_quantity = vehicle.stock_quantity + 1

        movement = StockMovement(
            vehicle_id=vehicle.vehicle_id,
            change_qty=1,
            reason=stock_reason,
            reference_id=reservation.reservation_id,
        )
        db.add(movement)

        # If stock rose from 0, notify restock requesters
        if vehicle.stock_quantity == 1:  # was 0, now 1
            stock_service._notify_restock_requesters(db, vehicle)

    # Create notification + email
    if vehicle:
        vehicle_label = f"{vehicle.year} {vehicle.make} {vehicle.model}"
    else:
        vehicle_label = "your vehicle"

    if new_status == "Cancelled":
        notify(
            db,
            customer_id=reservation.customer_id,
            notification_type="reservation_cancelled",
            title=f"Reservation Cancelled — {vehicle_label}",
            message=(
                f"Your reservation for the {vehicle_label} has been cancelled. "
                f"${refund_amount:,.2f} has been refunded to your account "
                f"(${fee_amount:,.2f} cancellation fee)."
            ),
            link_path="/account/reservations",
            vehicle_label=vehicle_label,
            refund_amount=f"${refund_amount:,.2f}",
        )
    else:  # Expired
        notify(
            db,
            customer_id=reservation.customer_id,
            notification_type="reservation_expired",
            title=f"Reservation Expired — {vehicle_label}",
            message=(
                f"Your reservation for the {vehicle_label} has expired. "
                f"${refund_amount:,.2f} has been refunded to your account "
                f"(${fee_amount:,.2f} cancellation fee)."
            ),
            link_path="/account/reservations",
            vehicle_label=vehicle_label,
            refund_amount=f"${refund_amount:,.2f}",
        )
    db.flush()

    return reservation


def get_receipt_data(
    db: Session,
    customer_id: int,
    reservation_id: int,
) -> Optional[dict]:
    """Get receipt data for a reservation."""
    reservation = db.query(Reservation).filter(
        Reservation.reservation_id == reservation_id,
        Reservation.customer_id == customer_id,
    ).first()
    if reservation is None:
        return None

    vehicle = db.query(Vehicle).filter(
        Vehicle.vehicle_id == reservation.vehicle_id
    ).first()

    # Get the deposit transaction
    deposit_txn = db.query(BankTransaction).filter(
        BankTransaction.reservation_id == reservation_id,
        BankTransaction.txn_type == "Reservation Deposit",
    ).first()

    # Get the refund transaction (if any)
    refund_txn = db.query(BankTransaction).filter(
        BankTransaction.reservation_id == reservation_id,
        BankTransaction.txn_type == "Refund",
    ).first()

    bank_acct = db.query(BankAccount).filter(
        BankAccount.customer_id == customer_id
    ).first()

    return {
        "reservation": reservation,
        "vehicle": vehicle,
        "deposit_transaction": deposit_txn,
        "refund_transaction": refund_txn,
        "bank_account": bank_acct,
    }
