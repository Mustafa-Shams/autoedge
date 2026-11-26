from datetime import timezone
from decimal import Decimal, ROUND_HALF_UP

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.api.deps import get_current_customer, get_db, require_enquiry_access, require_module
from app.core.config import settings
from app.models.bank_transaction import BankTransaction
from app.models.customer import Customer
from app.models.customer_vehicle import CustomerVehicle
from app.models.deal_activity import DealActivity
from app.models.deal import Deal
from app.core.enquiry_categories import can_see, label, visible_filter
from app.models.enquiry import Enquiry
from app.models.reservation import Reservation
from app.models.sale import Sale
from app.models.sales_assistance import SalesAssistance
from app.models.service_booking import ServiceBooking
from app.models.test_drive import TestDrive
from app.models.trade_in_request import TradeInRequest
from app.models.user import User
from app.models.vehicle import Vehicle
from app.services.reservation_service import sweep_due_reservations
from app.services.trade_acquisition import trade_credit

router = APIRouter(tags=["deal history"])


def utc(value):
    return value.replace(tzinfo=timezone.utc) if value else None


def summary(row):
    deal, vehicle, customer = row
    return dict(id=deal.deal_id, stage=deal.stage, vehicle=f"{vehicle.year} {vehicle.make} {vehicle.model}",
                customer=customer.full_name, vehicle_id=vehicle.vehicle_id)


def records(db, customer_id=None, staff=None):
    query = db.query(Deal, Vehicle, Customer).join(Vehicle, Deal.vehicle_id == Vehicle.vehicle_id).join(
        Customer, Deal.customer_id == Customer.customer_id)
    if customer_id is not None:
        query = query.filter(Deal.customer_id == customer_id)
    if staff and staff.role != "manager":
        query = query.outerjoin(Sale, Sale.sale_id == Deal.sale_id).filter(
            or_(Sale.staff_id.is_(None), Sale.staff_id == staff.user_id))
    return query


def page(db, customer_id, offset, staff=None):
    sweep_due_reservations(db)
    rows = records(db, customer_id, staff).order_by(Deal.deal_id.desc()).offset(offset).limit(51).all()
    return dict(items=[summary(row) for row in rows[:50]], more=len(rows) > 50)


def detail(db, deal_id, customer_id=None, staff=None):
    sweep_due_reservations(db)
    row = records(db, customer_id, staff).filter(Deal.deal_id == deal_id).first()
    if not row:
        raise HTTPException(404, "Deal not found")
    d, vehicle, _ = row
    result = summary(row)
    events, credits, links = [], [], []
    def can(module):
        return not staff or staff.access.get(module, "none") != "none"
    def event(at, title, detail="", path=None):
        if at:
            events.append(dict(at=utc(at), title=title, detail=detail, path=path))
    def link(label, path):
        links.append(dict(label=label, path=path))

    hold = db.get(Reservation, d.reservation_id) if d.reservation_id and can("reservations") else None
    sale = db.get(Sale, d.sale_id) if d.sale_id else None
    price = sale.sale_price - sale.discount if sale else vehicle.price
    deposit = sale.deposit_credit if sale else hold.deposit_amount if hold else Decimal(0)
    eligible = []
    if can("trade_ins"):
        predicate = TradeInRequest.deal_id == d.deal_id
        if sale and sale.trade_in_id:
            predicate = or_(predicate, TradeInRequest.trade_in_id == sale.trade_in_id)
        for trade in db.query(TradeInRequest).filter(predicate, TradeInRequest.customer_id == d.customer_id):
            a = trade.acquisition
            path = f"/trade-ins?id={trade.trade_in_id}" if staff else f"/account/trade-ins?id={trade.trade_in_id}"
            event(trade.created_at, f"Trade-in #{trade.trade_in_id}", f"{trade.year} {trade.make} {trade.model}", path)
            changes = db.query(DealActivity).filter_by(trade_in_id=trade.trade_in_id).order_by(DealActivity.activity_id).all()
            for change in changes:
                event(change.at, change.title, path=path)
            if not changes:
                event(trade.updated_at, f"Trade-in · {trade.status}", path=path)
            if not a:
                continue
            event(a.inspection_at, "Inspection appointment", path=path)
            event(a.intake_at, "Showroom received trade-in", path=path)
            event(a.returned_at, "Trade-in returned", path=path)
            if a.settled_amount is not None:
                event(a.settled_at, "Separate trade-in payment recorded", f"${a.settled_amount:,.2f}", path)
            if trade.status != "Accepted" or sale:
                continue
            try:
                value = trade_credit(trade, d.customer_id, d.vehicle_id, price - deposit)
                eligible.append((trade.trade_in_id, value))
                status = "Verified"
            except ValueError:
                value, status = a.inspected_value or trade.offered_value, "Pending"
            credits.append(dict(id=trade.trade_in_id, status=status, value=value))
    result["unlinked_enquiries"] = []
    if can("enquiries") and (not staff or staff.role == "manager" or staff.handles_enquiries):
        if d.stage in ("Shopping","Reserved","Awaiting pickup") and (not staff or staff.access["enquiries"] == "full"):
            unlinked = db.query(Enquiry).filter_by(customer_id=d.customer_id, deal_id=None, vehicle_id=None, sale_id=None)
            if staff and visible_filter(staff) is not None:
                unlinked = unlinked.filter(visible_filter(staff))
            result["unlinked_enquiries"] = [dict(id=e.enquiry_id, subject=e.subject) for e in unlinked.order_by(Enquiry.enquiry_id.desc())]
        for thread in db.query(Enquiry).filter_by(deal_id=d.deal_id):
            if staff and not can_see(staff, thread):
                continue
            path = f"{'' if staff else '/account'}/enquiries/{thread.enquiry_id}"
            event(thread.created_at, label(thread), thread.status, path)
            for message in thread.messages:
                event(message.created_at, message.sender_user.full_name if message.sender_user else result["customer"],
                      message.body, path)
    if can("test_drives"):
        for drive in db.query(TestDrive).filter_by(deal_id=d.deal_id):
            path = f"/test-drives?id={drive.test_drive_id}" if staff else f"/account/test-drives?id={drive.test_drive_id}"
            for change in db.query(DealActivity).filter_by(test_drive_id=drive.test_drive_id).order_by(DealActivity.activity_id):
                event(change.at, change.title, path=path)
            event(drive.booking_date, f"Test drive #{drive.test_drive_id} · {drive.status}",
                  f"{drive.scheduled_date} {drive.scheduled_time or ''} ({settings.SHOWROOM_TIMEZONE})", path)
    result["sales_contact"] = None
    for aid in db.query(SalesAssistance).filter_by(deal_id=d.deal_id).order_by(SalesAssistance.recorded_at):
        owner = db.get(User, aid.owner_id)
        if not aid.closed_at or aid.sale_id:
            result["sales_contact"] = owner.full_name
        event(aid.recorded_at, f"{aid.kind} · {owner.full_name}", aid.note if staff and (staff.role == "manager" or aid.owner_id == staff.user_id) else "Sales assistance")
    if hold:
        path = f"/reservations?id={hold.reservation_id}" if staff else f"/account/receipts/reservation/{hold.reservation_id}"
        event(hold.reserved_at, "Deposit received", f"Reservation #{hold.reservation_id}", path)
        event(hold.closed_at, f"Reservation {hold.status.lower()}", path=path)
        link("Reservation receipt" if not staff else "Reservation details", path)
    conditions = []
    if hold:
        conditions.append(BankTransaction.reservation_id == hold.reservation_id)
    if sale:
        conditions.append(BankTransaction.sale_id == sale.sale_id)
        path = f"/sales?receipt={sale.sale_id}" if staff else f"/account/purchases#sale-{sale.sale_id}"
        link("Sale and pickup details", path)
        event(sale.sale_date, f"Sale #{sale.sale_id}", sale.payment_type, path)
        event(d.payment_verified_at, "Showroom payment verified", f"Cash ${d.cash_received or 0:,.2f} · external funding ${d.external_funding or 0:,.2f}")
        event(d.refund_requested_at, "Cancellation requested", path=path)
        garage = db.query(CustomerVehicle).filter_by(source_sale_id=sale.sale_id).first()
        if garage:
            event(garage.created_at, "Collected at showroom", garage.vin_number, None if staff else "/account/garage")
            if can("service"):
                for booking in db.query(ServiceBooking).filter_by(cv_id=garage.cv_id, customer_id=d.customer_id):
                    event(booking.created_at, f"Service booking #{booking.booking_id}", f"{booking.booking_date} · {booking.status}",
                          f"/service-bookings?id={booking.booking_id}" if staff else f"/account/receipts/service/{booking.booking_id}")
    if conditions:
        for txn in db.query(BankTransaction).filter(or_(*conditions)):
            event(txn.created_at, txn.txn_type, f"{txn.direction} ${txn.amount:,.2f} · {txn.reference_code}", None if staff else "/account/bank")
    action = {"Reserved": "Complete purchase before the hold expires", "Shopping": "Review vehicle and purchase options",
              "Awaiting pickup": "Arrange showroom pickup", "Collected": "View collection and service history",
              "Earlier activity": "Review earlier activity"}.get(d.stage, "Review deal history")
    if d.stage == "Shopping":
        if any(item["status"] == "Pending" for item in credits):
            action = "Review trade-in inspection and credit before checkout"
        elif any(e["title"].startswith("Test drive #") and "Requested" in e["title"] for e in events):
            action = "Showroom to confirm the test drive"
    if d.stage == "Awaiting pickup" and sale.payment_type != "Demo Wallet" and not d.payment_verified_at:
        action = "Showroom to verify payment"
    if d.pickup_deadline:
        event(d.pickup_deadline, "Scheduled pickup deadline")
    if d.refund_requested_at and d.stage == "Awaiting pickup":
        action = "Manager to review cancellation"
    if not staff and d.stage in ("Shopping", "Reserved"):
        path = f"/account/checkout/{d.vehicle_id}?"
        if hold:
            path += f"reservation={hold.reservation_id}&"
        if len(eligible) == 1:
            path += f"trade={eligible[0][0]}"
        link("Complete purchase" if hold else "Review checkout", path.rstrip("?&"))
        link("Vehicle details", f"/cars/{d.vehicle_id}")
    credit = sale.trade_in_credit if sale else eligible[0][1] if len(eligible) == 1 else Decimal(0)
    due = price - deposit - credit
    if sale and (sale.payment_type == "Demo Wallet" or d.payment_verified_at):
        due = Decimal(0)
    if d.stage in ("Expired", "Cancelled", "Historical sale", "Refunded", "Earlier activity"):
        due = None
    result.update(events=sorted(events, key=lambda item: item["at"]), links=links, next_action=action, credits=credits,
                  price=price, deposit=deposit, credit=credit, due=due,
                  expires_at=utc(hold.expires_at) if hold and d.stage=="Reserved" else None,
                  refund=(deposit*(100-Decimal(str(settings.CANCELLATION_FEE_PERCENT)))/100).quantize(
                      Decimal(".01"), rounding=ROUND_HALF_UP) if hold and d.stage=="Reserved" else None)
    return result


@router.get("/store/deals")
def customer_deals(offset: int = Query(0, ge=0), account=Depends(get_current_customer), db: Session=Depends(get_db)):
    return page(db, account.customer_id, offset)


@router.get("/store/deals/{deal_id}")
def customer_detail(deal_id: int, account=Depends(get_current_customer), db: Session=Depends(get_db)):
    return detail(db, deal_id, customer_id=account.customer_id)


@router.get("/deals")
def staff_deals(offset: int = Query(0, ge=0), user=Depends(require_module("sales")), db: Session=Depends(get_db)):
    return page(db, None, offset, user)


@router.get("/deals/{deal_id}")
def staff_detail(deal_id: int, user=Depends(require_module("sales")), db: Session=Depends(get_db)):
    return detail(db, deal_id, staff=user)


def link_general_enquiry(db, deal_id, enquiry_id, customer_id=None, staff=None):
    row = records(db, customer_id, staff).filter(Deal.deal_id == deal_id).first()
    if not row:
        raise HTTPException(404, "Deal not found")
    deal = db.query(Deal).filter_by(deal_id=deal_id).with_for_update().one()
    thread = db.query(Enquiry).filter_by(enquiry_id=enquiry_id, customer_id=deal.customer_id).with_for_update().one_or_none()
    if not thread or (staff and not can_see(staff, thread)):
        raise HTTPException(404, "Enquiry not found")
    if thread.deal_id != deal_id:
        if thread.deal_id or thread.vehicle_id or thread.sale_id or deal.stage not in ("Shopping","Reserved","Awaiting pickup"):
            raise HTTPException(409, "This enquiry cannot be linked to this deal")
        thread.deal_id, thread.vehicle_id = deal_id, deal.vehicle_id
        # A general question attached to a purchase becomes a sales conversation.
        if thread.category in (None, "General"):
            thread.category = "Vehicle/Price"
        db.commit()
    return {"deal_id": deal_id, "enquiry_id": enquiry_id}


@router.post("/store/deals/{deal_id}/enquiries/{enquiry_id}")
def customer_link(deal_id: int, enquiry_id: int, account=Depends(get_current_customer), db: Session=Depends(get_db)):
    return link_general_enquiry(db, deal_id, enquiry_id, account.customer_id)


@router.post("/deals/{deal_id}/enquiries/{enquiry_id}", dependencies=[Depends(require_module("enquiries")), Depends(require_enquiry_access())])
def staff_link(deal_id: int, enquiry_id: int, user=Depends(require_module("sales")), db: Session=Depends(get_db)):
    return link_general_enquiry(db, deal_id, enquiry_id, staff=user)
