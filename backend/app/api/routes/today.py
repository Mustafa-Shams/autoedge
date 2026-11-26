from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.core.config import settings
from app.models.user import User
from app.models.customer_vehicle import CustomerVehicle
from app.models.customer import Customer
from app.models.deal import Deal
from app.core.enquiry_categories import DUTY_ROLE, can_see, effective_category, label, visible_filter
from app.models.enquiry import Enquiry
from app.models.sale import Sale
from app.models.service_booking import ServiceBooking
from app.models.service_job import ServiceJob
from app.services.trade_acquisition import ready_for_resale
from app.models.trade_in_request import TradeInRequest
from app.models.test_drive import TestDrive
from app.models.vehicle import Vehicle

router = APIRouter(tags=["staff"])


@router.get("/today")
def today(user=Depends(get_current_user), db: Session = Depends(get_db)):
    day = datetime.now(ZoneInfo(settings.SHOWROOM_TIMEZONE)).date()
    access = user.access
    manager = user.role == "manager"
    tasks = []
    people = db.query(User).filter_by(is_active=True).order_by(User.user_id).all()

    def task(module, record_id, assigned_to, deal_id=None, *, manager_only=False, extra_module=None,
             eligible=None, duty_role=None, **fields):
        candidates = [person for person in people if person.access.get(module) == "full"
                      and (not extra_module or person.access.get(extra_module) == "full")
                      and (not manager_only or person.role == "manager")
                      and (eligible is None or eligible(person))]
        owner = next((person for person in candidates if person.user_id == assigned_to), None)
        if not owner:
            # Unclaimed work goes to an active duty owner. It does not confer sales commission.
            duty_role = duty_role or {"sales": "sales_executive", "enquiries": "receptionist", "service": "receptionist",
                                      "test_drives": "sales_executive", "trade_ins": "sales_executive"}.get(module)
            duty = ([person for person in candidates if person.role == duty_role]
                    or [person for person in candidates if person.role == "manager"] or candidates)
            owner = duty[(record_id - 1) % len(duty)] if duty else None
        if manager or (owner and owner.user_id == user.user_id) or assigned_to == user.user_id:
            tasks.append(dict(**fields, owner=owner.full_name if owner else "Manager assignment required",
                              owner_id=owner.user_id if owner else None,
                              deal_id=deal_id,
                              deal_path=(f"/deals/{deal_id}" if access.get("sales", "none") != "none"
                                         else f"/today?deal={deal_id}") if deal_id else None))

    def garage_deal(cv_id):
        if not cv_id:
            return None
        return db.query(Deal.deal_id).join(CustomerVehicle, CustomerVehicle.source_sale_id == Deal.sale_id).filter(
            CustomerVehicle.cv_id == cv_id).scalar()

    if access.get("sales", "none") != "none":
        pickups = (db.query(Deal, Sale, Vehicle, Customer).join(Sale, Deal.sale_id == Sale.sale_id)
                   .join(Vehicle, Vehicle.vehicle_id == Deal.vehicle_id).join(Customer, Customer.customer_id == Deal.customer_id)
                   .filter(Deal.stage == "Awaiting pickup"))
        if not manager:
            pickups = pickups.filter(or_(Sale.staff_id == user.user_id, Sale.staff_id.is_(None)), Deal.refund_requested_at.is_(None))
        for deal, sale, vehicle, customer in pickups.order_by(Deal.pickup_deadline.asc().nullslast(), Deal.deal_id):
            action = "Approve cancellation" if deal.refund_requested_at else (
                "Verify payment" if sale.payment_type != "Demo Wallet" and not deal.payment_verified_at else "Confirm pickup")
            task("sales", sale.sale_id, sale.staff_id, deal.deal_id, manager_only=bool(deal.refund_requested_at), action=action, detail=f"{customer.full_name} · {vehicle.make} {vehicle.model} · Sale #{sale.sale_id}",
                              path=f"/sales?receipt={sale.sale_id}")
    if access.get("test_drives", "none") != "none":
        drives = db.query(TestDrive).filter(or_(TestDrive.status == "Requested",
            (TestDrive.status.in_(["Confirmed", "Scheduled"])) & (TestDrive.scheduled_date == day)))
        if user.role == "sales_executive":
            drives = drives.filter(or_(TestDrive.assigned_to == user.user_id, TestDrive.assigned_to.is_(None)))
        for d in drives.order_by(TestDrive.scheduled_date, TestDrive.scheduled_time):
            task("test_drives", d.test_drive_id, d.assigned_to, d.deal_id, action="Review test drive" if d.status == "Requested" else "Today's test drive",
                              detail=f"Test drive #{d.test_drive_id} · {d.scheduled_date}", path=f"/test-drives?id={d.test_drive_id}")
    if access.get("service", "none") != "none":
        jobs = db.query(ServiceBooking).filter(ServiceBooking.status.in_(["Booked","Confirmed"]), ServiceBooking.booking_date == day)
        if user.role == "technician":
            jobs = jobs.filter_by(technician_id=user.user_id)
        for b in jobs.order_by(ServiceBooking.time_slot):
            task("service", b.booking_id, b.technician_id, garage_deal(b.cv_id), action="Service appointment", detail=f"Booking #{b.booking_id} · {b.time_slot:%H:%M}", path=f"/service-bookings?id={b.booking_id}")
        workshop = db.query(ServiceJob).filter(ServiceJob.status.in_(["Pending", "In Progress"]))
        if user.role == "technician":
            workshop = workshop.filter_by(technician_id=user.user_id)
        for job in workshop.order_by(ServiceJob.job_id):
            task("service", job.job_id, job.technician_id, garage_deal(job.customer_vehicle_id), action="Workshop job", detail=f"Job #{job.job_id} · {job.job_type} · {job.status}",
                              path=f"/service/{job.job_id}/edit" if user.role in ("manager","technician") and access["service"] == "full" else f"/service?id={job.job_id}")
    if access.get("trade_ins", "none") != "none":
        trades = db.query(TradeInRequest).filter(TradeInRequest.status.in_(["Submitted","Under Review","Accepted","Completed"]))
        if not manager:
            trades = trades.filter(or_(TradeInRequest.appraised_by == user.user_id, TradeInRequest.appraised_by.is_(None)))
        for t in trades.order_by(TradeInRequest.created_at):
            acquisition = t.acquisition
            if acquisition and acquisition.intake_at and not acquisition.checked_at and not acquisition.listing_id and not acquisition.returned_at:
                action = "Verify trade-in ownership and intake"
            elif t.status == "Completed":
                if access.get("vehicles") != "full" or access["trade_ins"] != "full" or not ready_for_resale(t):
                    continue
                action = "Prepare resale listing"
            elif acquisition and acquisition.terms_version and acquisition.approved_version != acquisition.terms_version:
                continue
            elif acquisition and acquisition.intake_at:
                if not manager:
                    continue
                action = "Review trade-in settlement"
            else:
                action = "Arrange inspection or intake" if acquisition else "Review trade-in"
            task("trade_ins", t.trade_in_id, t.appraised_by, t.deal_id, manager_only=action == "Review trade-in settlement",
                 extra_module="vehicles" if action == "Prepare resale listing" else None, action=action,
                              detail=f"{t.year} {t.make} {t.model} · Trade-in #{t.trade_in_id}", path=f"/trade-ins?id={t.trade_in_id}")
    if access.get("enquiries", "none") != "none":
        threads = db.query(Enquiry).filter_by(status="Open")
        if not manager:
            threads = threads.filter(or_(Enquiry.assigned_to == user.user_id, Enquiry.assigned_to.is_(None)),
                                     visible_filter(user))
        for e in threads.order_by(Enquiry.updated_at):
            # Only staff who handle this category may own it; unclaimed threads go to that category's role.
            task("enquiries", e.enquiry_id, e.assigned_to, e.deal_id,
                 eligible=lambda person, e=e: can_see(person, e), duty_role=DUTY_ROLE[effective_category(e)],
                 action="Review enquiry", detail=label(e), path=f"/enquiries/{e.enquiry_id}")
    return {"date": day, "tasks": tasks}
