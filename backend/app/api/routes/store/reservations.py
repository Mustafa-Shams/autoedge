"""Customer reservation routes — spec sections 7.2, 10.3.

POST /store/reservations             — Reserve a vehicle (password + idempotency)
GET  /store/reservations             — My reservations (status filter)
GET  /store/reservations/{id}        — Single reservation detail
GET  /store/reservations/{id}/receipt — Receipt data
POST /store/reservations/{id}/cancel — Cancel with refund
"""
from datetime import timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_customer
from app.models.customer_account import CustomerAccount
from app.models.deal import Deal
from app.models.reservation import Reservation
from app.models.vehicle import Vehicle
from app.services.reservation_service import (
    reserve, hold_quote,
    cancel,
    ReservationError,
    get_receipt_data,
    sweep_due_reservations,
)
from app.core.config import settings
from app.schemas.store_bank import (
    ReserveRequest,
    ReservationResponse,
    ReservationListResponse,
    ReservationReceiptResponse,
    ReservationCancelResponse,
)

router = APIRouter(prefix="/store/reservations", tags=["store-reservations"])


def _enrich_reservation(res: Reservation, db: Session) -> ReservationResponse:
    """Add vehicle info to a reservation response."""
    vehicle = db.query(Vehicle).filter(
        Vehicle.vehicle_id == res.vehicle_id
    ).first()

    return ReservationResponse(
        deal_id=db.query(Deal.deal_id).filter_by(reservation_id=res.reservation_id).scalar(),
        reservation_id=res.reservation_id,
        customer_id=res.customer_id,
        vehicle_id=res.vehicle_id,
        deposit_amount=res.deposit_amount,
        hold_days=res.hold_days,
        reserved_at=res.reserved_at,
        expires_at=res.expires_at.replace(tzinfo=timezone.utc),
        status=res.status,
        closed_at=res.closed_at,
        notes=res.notes,
        vehicle_make=vehicle.make if vehicle else None,
        vehicle_model=vehicle.model if vehicle else None,
        vehicle_year=vehicle.year if vehicle else None,
        vehicle_price=vehicle.price if vehicle else None,
        vehicle_main_image_url=vehicle.main_image_url if vehicle else None,
    )


@router.get("/quote/{vehicle_id}")
def quote_reservation(vehicle_id: int, hold_days: int, account=Depends(get_current_customer), db: Session=Depends(get_db)):
    try:
        return hold_quote(db.get(Vehicle, vehicle_id), account.customer_id, hold_days)
    except ReservationError as exc:
        raise HTTPException(exc.status_code, exc.message) from exc


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_reservation(
    req: ReserveRequest,
    account: CustomerAccount = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    """Reserve a vehicle per spec 7.2.

    Full transactional flow with password confirmation,
    idempotency key, row locking, and stock/bank ledger entries.
    """
    sweep_due_reservations(db)
    try:
        reservation = reserve(
            db,
            customer_id=account.customer_id,
            vehicle_id=req.vehicle_id,
            hold_days=req.hold_days,
            password=req.password,
            quote_token=req.quote_token,
            idempotency_key=req.idempotency_key,
        )
        db.commit()
        db.refresh(reservation)
        return _enrich_reservation(reservation, db)

    except ReservationError as e:
        db.rollback()
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while processing your reservation",
        )


@router.get("", response_model=ReservationListResponse)
async def list_reservations(
    status_filter: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
    account: CustomerAccount = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    """List the customer's reservations with optional status filter.

    Also runs sweep_due_reservations() to keep statuses current.
    """
    sweep_due_reservations(db)

    page_size = min(page_size, 50)
    if page < 1:
        page = 1

    q = db.query(Reservation).filter(
        Reservation.customer_id == account.customer_id
    )
    if status_filter:
        q = q.filter(Reservation.status == status_filter)

    total = q.count()
    reservations = (
        q.order_by(Reservation.reserved_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return ReservationListResponse(
        items=[_enrich_reservation(r, db) for r in reservations],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{reservation_id}", response_model=ReservationResponse)
async def get_reservation(
    reservation_id: int,
    account: CustomerAccount = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    """Get a single reservation detail (owned by current customer)."""
    sweep_due_reservations(db)
    reservation = db.query(Reservation).filter(
        Reservation.reservation_id == reservation_id,
        Reservation.customer_id == account.customer_id,
    ).first()

    if reservation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reservation not found",
        )

    return _enrich_reservation(reservation, db)


@router.get("/{reservation_id}/receipt", response_model=ReservationReceiptResponse)
async def get_reservation_receipt(
    reservation_id: int,
    account: CustomerAccount = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    """Get receipt data for a reservation."""
    sweep_due_reservations(db)
    data = get_receipt_data(db, account.customer_id, reservation_id)

    if data is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reservation not found",
        )

    res = data["reservation"]
    vehicle = data["vehicle"]
    dep_txn = data["deposit_transaction"]
    ref_txn = data["refund_transaction"]
    bank = data["bank_account"]

    vehicle_label = (
        f"{vehicle.year} {vehicle.make} {vehicle.model}" if vehicle else "Unknown Vehicle"
    )

    # Balance due at showroom
    balance_due = None
    if vehicle and res.status == "Active":
        balance_due = vehicle.price - res.deposit_amount

    return ReservationReceiptResponse(
        reservation_id=res.reservation_id,
        receipt_number=f"RSV-{res.reservation_id:06d}",
        status=res.status,
        vehicle_label=vehicle_label,
        vehicle_price=vehicle.price if vehicle else Decimal("0"),
        deposit_amount=res.deposit_amount,
        hold_days=res.hold_days,
        reserved_at=res.reserved_at,
        expires_at=res.expires_at.replace(tzinfo=timezone.utc),
        reference_code=dep_txn.reference_code if dep_txn else None,
        amount_charged=dep_txn.amount if dep_txn else None,
        balance_after_charge=dep_txn.balance_after if dep_txn else None,
        refund_amount=ref_txn.amount if ref_txn else None,
        refund_reference=ref_txn.reference_code if ref_txn else None,
        bank_name=bank.bank_name if bank else None,
        card_last4=bank.card_last4 if bank else None,
        balance_due_at_showroom=balance_due,
    )


@router.post("/{reservation_id}/cancel", response_model=ReservationCancelResponse)
async def cancel_reservation(
    reservation_id: int,
    account: CustomerAccount = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    """Cancel an active reservation.

    Refund = deposit * (100 - CANCELLATION_FEE_PERCENT) / 100.
    """
    try:
        reservation = cancel(
            db,
            customer_id=account.customer_id,
            reservation_id=reservation_id,
        )
        db.commit()

        fee_percent = Decimal(str(settings.CANCELLATION_FEE_PERCENT))
        refund = (
            reservation.deposit_amount * (100 - fee_percent) / 100
        ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        fee = reservation.deposit_amount - refund

        return ReservationCancelResponse(
            reservation_id=reservation.reservation_id,
            status=reservation.status,
            refund_amount=refund,
            fee_amount=fee,
            message=f"Reservation cancelled. ${refund:,.2f} refunded "
                    f"(${fee:,.2f} cancellation fee).",
        )

    except ReservationError as e:
        db.rollback()
        raise HTTPException(status_code=e.status_code, detail=e.message)
