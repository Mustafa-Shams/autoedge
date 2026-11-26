from decimal import Decimal, ROUND_HALF_UP
from uuid import UUID
from datetime import timezone

from pydantic import BaseModel, Field, SecretStr
from sqlalchemy.orm import Session

from app.core.security import verify_password
from app.core.time import utcnow
from app.crud.crud_sale import complete_sale
from app.models.bank_account import BankAccount
from app.models.bank_transaction import BankTransaction
from app.models.deal import Deal, InventoryUnit
from app.models.reservation import Reservation
from app.models.sale import Sale
from app.models.enquiry import Enquiry
from app.models.trade_in_request import TradeInRequest
from app.models.trade_acquisition import TradeAcquisition
from app.services.trade_acquisition import trade_credit
from app.models.vehicle import Vehicle
from app.models.stock_movement import StockMovement
from app.services import bank_service
from app.services.stock_service import get_vehicle_for_update, sync_vehicle_status, _notify_restock_requesters


class PurchaseRequest(BaseModel):
    vehicle_id: int
    reservation_id: int | None = None
    trade_in_id: int | None = None
    expected_price: Decimal = Field(gt=0)
    expected_charge: Decimal = Field(ge=0)
    password: SecretStr
    idempotency_key: UUID


class PurchaseConflict(ValueError):
    pass


def quote(db, vehicle, customer_id, reservation_id=None, trade_in_id=None):
    if vehicle is None:
        raise PurchaseConflict("Listing is unavailable")
    holds = db.query(Reservation).filter_by(vehicle_id=vehicle.vehicle_id, customer_id=customer_id, status="Active")
    hold = holds.filter(Reservation.expires_at >= utcnow()).first()
    if reservation_id is not None and (hold is None or hold.reservation_id != reservation_id):
        raise PurchaseConflict("This reservation is no longer active")
    if not hold and (not vehicle.is_published or vehicle.stock_quantity < 1):
        raise PurchaseConflict("This vehicle is no longer available")
    deposit = Decimal("0")
    if hold:
        payment = db.query(BankTransaction).join(BankAccount).filter(
            BankAccount.customer_id == customer_id, BankTransaction.reservation_id == hold.reservation_id,
            BankTransaction.txn_type == "Reservation Deposit", BankTransaction.direction == "Debit",
        ).one_or_none()
        if payment is None or payment.amount != hold.deposit_amount or payment.amount > vehicle.price:
            raise PurchaseConflict("Showroom staff must reconcile the deposit before payment")
        deposit = payment.amount
    candidates = (db.query(TradeInRequest).join(TradeAcquisition).filter(
        TradeInRequest.customer_id == customer_id, TradeInRequest.status == "Accepted",
        (TradeInRequest.target_vehicle_id == vehicle.vehicle_id) | TradeInRequest.target_vehicle_id.is_(None),
        TradeAcquisition.returned_at.is_(None)).order_by(TradeInRequest.trade_in_id).all())
    trades, pending = [], []
    selected = None
    credit = Decimal("0")
    for trade in candidates:
        try:
            verified = trade_credit(trade, customer_id, vehicle.vehicle_id, vehicle.price - deposit)
        except ValueError:
            if trade_in_id == trade.trade_in_id:
                raise
            if trade.target_vehicle_id == vehicle.vehicle_id:
                pending.append({"id": trade.trade_in_id, "value": trade.acquisition.inspected_value or trade.offered_value})
            continue
        trades.append({"id": trade.trade_in_id, "label": f"{trade.year} {trade.make} {trade.model}"})
        if trade_in_id == trade.trade_in_id:
            selected, credit = trade, verified
    if trade_in_id is not None and not selected:
        raise PurchaseConflict("Choose an accepted trade-in for this customer and vehicle")
    return {
        "vehicle_id": vehicle.vehicle_id, "vehicle": f"{vehicle.year} {vehicle.make} {vehicle.model}",
        "price": vehicle.price, "deposit": deposit, "charge": vehicle.price - deposit - credit,
        "trade_in_id": trade_in_id, "trade_in_credit": credit,
        "excess_at_pickup": selected.acquisition.excess_amount if trade_in_id is not None else Decimal("0"),
        "pending_trades": pending, "trade_ins": trades,
        "reservation_id": hold.reservation_id if hold else None,
        "expires_at": hold.expires_at if hold else None,
    }


def purchase(db: Session, account, request: PurchaseRequest):
    if not verify_password(request.password.get_secret_value(), account.password_hash):
        raise PermissionError("Incorrect password")
    vehicle = get_vehicle_for_update(db, request.vehicle_id)
    previous = db.query(Sale).filter_by(customer_id=account.customer_id, checkout_key=str(request.idempotency_key)).one_or_none()
    if previous:
        if (previous.vehicle_id, previous.reservation_id, previous.trade_in_id, previous.sale_price,
            previous.sale_price - previous.deposit_credit - previous.trade_in_credit) != (
            request.vehicle_id, request.reservation_id, request.trade_in_id, request.expected_price, request.expected_charge
        ):
            raise PurchaseConflict("This payment reference belongs to a different purchase")
        return previous

    if request.trade_in_id:
        db.query(TradeInRequest).filter_by(trade_in_id=request.trade_in_id, customer_id=account.customer_id).with_for_update().one_or_none()
    offer = quote(db, vehicle, account.customer_id, request.reservation_id, request.trade_in_id)
    if (offer["price"], offer["charge"], offer["reservation_id"]) != (
        request.expected_price, request.expected_charge, request.reservation_id
    ):
        raise PurchaseConflict("Price or reservation changed. Review the updated checkout before paying.")
    sale = Sale(vehicle_id=vehicle.vehicle_id, customer_id=account.customer_id, sale_price=offer["price"],
                status="Completed", payment_type="Demo Wallet", reservation_id=offer["reservation_id"],
                checkout_key=str(request.idempotency_key), trade_in_id=request.trade_in_id)
    db.add(sale)
    db.flush()
    complete_sale(db, sale)
    if offer["charge"] > 0:
        payment = bank_service.debit(db, account.customer_id, offer["charge"], "Vehicle Purchase",
                                     f"Purchase #{sale.sale_id} · {offer['vehicle']}")
        payment.sale_id = sale.sale_id
    db.flush()
    return sale


def receipts(db, customer_id, sale_id=None):
    query = (db.query(Sale, Deal, InventoryUnit, Vehicle, BankTransaction, Enquiry.enquiry_id)
             .join(Deal, Deal.sale_id == Sale.sale_id)
             .outerjoin(InventoryUnit, Deal.unit_id == InventoryUnit.unit_id)
             .join(Vehicle, Vehicle.vehicle_id == Sale.vehicle_id)
             .outerjoin(Enquiry, Enquiry.sale_id == Sale.sale_id)
             .outerjoin(BankTransaction, (BankTransaction.sale_id == Sale.sale_id) &
                        (BankTransaction.txn_type == "Vehicle Purchase"))
             .filter(Sale.customer_id == customer_id))
    if sale_id is not None:
        query = query.filter(Sale.sale_id == sale_id)
    return [{
        "sale_id": sale.sale_id, "deal_id": deal.deal_id, "vehicle": f"{vehicle.year} {vehicle.make} {vehicle.model}",
        "unit_id": deal.unit_id, "vin": unit.vin if unit and deal.stage == "Collected" else None,
        "picked_up_at": unit.verified_at if unit and deal.stage == "Collected" else None,
        "refund_requested": deal.refund_requested_at is not None,
        "refund_amount": refund_amount(sale, deal) if deal.stage == "Refunded" else None,
        "refund_if_cancelled": refund_amount(sale, deal) if (sale.payment_type == "Demo Wallet" or deal.payment_verified_at) else None,
        "enquiry_id": enquiry_id, "trade_in_id": sale.trade_in_id,
        "pickup_deadline": deal.pickup_deadline.replace(tzinfo=timezone.utc) if deal.pickup_deadline else None,
        "cash_received": deal.cash_received, "external_funding": deal.external_funding,
        "balance_due": (None if deal.stage == "Historical sale" else
                        0 if sale.payment_type == "Demo Wallet" or deal.payment_verified_at else
                        sale.sale_price - sale.discount - sale.deposit_credit - sale.trade_in_credit),
        "stage": deal.stage, "price": sale.sale_price, "discount": sale.discount,
        "deposit": sale.deposit_credit, "trade_in_credit": sale.trade_in_credit,
        "payment_type": sale.payment_type, "date": sale.sale_date, "reservation_id": sale.reservation_id,
        "wallet_charge": payment.amount if payment else Decimal("0"),
        "reference": payment.reference_code if payment else f"SALE-{sale.sale_id}",
    } for sale, deal, unit, vehicle, payment, enquiry_id in query.order_by(Sale.sale_id.desc())]


def refund_amount(sale, deal):
    paid = sale.sale_price - sale.discount - sale.trade_in_credit if sale.payment_type == "Demo Wallet" else (
        (deal.cash_received or Decimal("0")) + sale.deposit_credit)
    return (paid * Decimal("0.20")).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP)


def cancel_purchase(db, sale_id, *, customer_id=None, manager_id=None, agree_trade_return=False):
    sale = db.get(Sale, sale_id)
    if sale is None or (customer_id is not None and sale.customer_id != customer_id):
        raise LookupError("Purchase not found")
    vehicle = get_vehicle_for_update(db, sale.vehicle_id)
    sale = db.query(Sale).filter_by(sale_id=sale_id).populate_existing().with_for_update().one()
    deal = db.query(Deal).filter_by(sale_id=sale_id).with_for_update().one_or_none()
    if not deal:
        raise LookupError("Purchase not found")
    if deal.stage == "Refunded":
        return
    if deal.stage != "Awaiting pickup" or (sale.payment_type != "Demo Wallet" and not deal.payment_verified_at):
        raise PurchaseConflict("Cancellation requires verified full payment and a vehicle awaiting pickup")
    if sale.trade_in_id and not agree_trade_return:
        raise PurchaseConflict("Confirm return of the original trade-in and the 20% cash and wallet refund")
    if manager_id is None:
        deal.refund_requested_at = deal.refund_requested_at or utcnow()
        return
    if not deal.refund_requested_at:
        raise PurchaseConflict("The customer has not requested cancellation")
    if sale.trade_in_id:
        trade = db.query(TradeInRequest).filter_by(trade_in_id=sale.trade_in_id).with_for_update().one()
        if trade.status != "Completed":
            raise PurchaseConflict("Reconcile trade-in custody before releasing either car")
        trade.status = "Cancelled"
        trade.updated_at = utcnow()
        if trade.acquisition:
            trade.acquisition.returned_at = utcnow()
    amount = refund_amount(sale, deal)
    if amount > 0:
        txn = bank_service.credit(db, sale.customer_id, amount, "Refund", f"20% pre-pickup refund for sale #{sale_id}")
        txn.sale_id = sale_id
    deal.stage, deal.unit_id, deal.refund_approved_by = "Refunded", None, manager_id
    sale.status = "Cancelled"
    vehicle.stock_quantity += 1
    sync_vehicle_status(db, vehicle)
    db.add(StockMovement(vehicle_id=vehicle.vehicle_id, change_qty=1, reason="Sale Refund",
                         reference_id=sale_id, created_by=manager_id))
    if vehicle.stock_quantity == 1:
        _notify_restock_requesters(db, vehicle)
    db.flush()
