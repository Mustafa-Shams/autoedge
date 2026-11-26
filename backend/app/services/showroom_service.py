from datetime import datetime, timezone
from decimal import Decimal

from pydantic import BaseModel, Field, StringConstraints
from typing import Annotated

from app.core.time import utcnow
from app.models.bank_account import BankAccount
from app.models.bank_transaction import BankTransaction
from app.models.deal import Deal
from app.models.enquiry import Enquiry
from app.models.sale import Sale


class PaymentEvidence(BaseModel):
    cash_received: Decimal = Field(ge=0, max_digits=12, decimal_places=2)
    external_funding: Decimal = Field(default=0, ge=0, max_digits=12, decimal_places=2)
    reference: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
    trade_received: bool = False


class ReturnAgreement(BaseModel):
    agree_trade_return: bool = False


def verify_payment(db, sale, staff_id, evidence):
    deal = db.query(Deal).filter_by(sale_id=sale.sale_id).with_for_update().one_or_none()
    if not deal or deal.stage != "Awaiting pickup" or sale.payment_type == "Demo Wallet":
        raise ValueError("This sale does not need showroom payment verification")
    if deal.payment_verified_at:
        if (deal.cash_received, deal.external_funding, deal.payment_reference) == (
            evidence.cash_received, evidence.external_funding, evidence.reference
        ):
            return
        raise ValueError("Payment has already been verified")
    if sale.deposit_credit:
        debit = db.query(BankTransaction).join(BankAccount).filter(
            BankTransaction.reservation_id == sale.reservation_id, BankAccount.customer_id == sale.customer_id,
            BankTransaction.txn_type == "Reservation Deposit", BankTransaction.direction == "Debit",
        ).one_or_none()
        if not debit or debit.amount != sale.deposit_credit:
            raise ValueError("Reconcile the customer's deposit receipt before confirming full payment")
    due = sale.sale_price - sale.discount - sale.deposit_credit - sale.trade_in_credit
    if evidence.cash_received + evidence.external_funding != due:
        raise ValueError("Cash and confirmed financing must add up to the remaining balance")
    if sale.payment_type == "Cash" and evidence.external_funding:
        raise ValueError("Cash sales cannot include lender funding")
    if sale.trade_in_id and not evidence.trade_received:
        raise ValueError("Confirm physical custody of the trade-in before verifying payment")
    deal.cash_received = evidence.cash_received
    deal.external_funding = evidence.external_funding
    deal.payment_reference = evidence.reference
    deal.payment_verified_by = staff_id
    deal.payment_verified_at = utcnow()


def purchase_thread(db, sale_id, customer_id=None):
    query = db.query(Sale).filter_by(sale_id=sale_id)
    if customer_id is not None:
        query = query.filter_by(customer_id=customer_id)
    sale = query.with_for_update().one_or_none()
    if not sale or not db.query(Deal.deal_id).filter_by(sale_id=sale_id).first():
        return None
    thread = db.query(Enquiry).filter_by(sale_id=sale_id).one_or_none()
    if not thread:
        thread = Enquiry(deal_id=sale.deal.deal_id, sale_id=sale_id, customer_id=sale.customer_id, vehicle_id=sale.vehicle_id,
                         category="Vehicle/Price",
                         subject=f"Purchase #{sale_id} · {sale.vehicle.make} {sale.vehicle.model}", status="Open")
        db.add(thread)
        db.flush()
    return thread.enquiry_id


def set_pickup_deadline(db, sale_id, deadline: datetime):
    if not deadline.tzinfo:
        raise ValueError("Include a time zone in the pickup deadline")
    deadline = deadline.astimezone(timezone.utc).replace(tzinfo=None)
    if deadline <= utcnow():
        raise ValueError("Choose a future pickup deadline")
    deal = db.query(Deal).filter_by(sale_id=sale_id).with_for_update().one_or_none()
    if not deal or deal.stage != "Awaiting pickup" or deal.refund_requested_at:
        raise ValueError("Pickup scheduling is unavailable for this sale")
    deal.pickup_deadline = deadline
