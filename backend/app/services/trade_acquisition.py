from datetime import datetime, timezone
from decimal import Decimal
import re
from typing import Annotated, Literal

from pydantic import BaseModel, Field, StringConstraints

from app.core.time import utcnow
from sqlalchemy import func
from app.models.customer_vehicle import CustomerVehicle
from app.models.service_booking import ServiceBooking
from app.models.deal import Deal, InventoryUnit
from app.models.stock_movement import StockMovement
from app.models.vehicle import Vehicle
from app.models.vehicle_image import VehicleImage

Money = Annotated[Decimal, Field(ge=0, max_digits=12, decimal_places=2)]
PositiveMoney = Annotated[Decimal, Field(gt=0, max_digits=12, decimal_places=2)]
Note = Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=2000)]
Reference = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]


class ScheduleInspection(BaseModel):
    action: Literal["schedule"]
    appointment: datetime


class InspectionTerms(BaseModel):
    action: Literal["inspect"]
    version: int
    value: PositiveMoney
    findings: Note
    excess: Money = 0
    settlement: Note | None = None


class Intake(BaseModel):
    action: Literal["intake"]
    version: int
    vin: str
    ownership_reference: Reference
    odometer_km: int = Field(ge=0, le=9999999)
    ownership_verified: Literal[True]
    condition_verified: Literal[True]


class Publish(BaseModel):
    action: Literal["publish"]
    retail_price: PositiveMoney
    preparation_cost: Money
    description: Note
    photos_and_details_verified: Literal[True]


class AcquisitionPayment(BaseModel):
    action: Literal["acquisition-payment"]
    amount: PositiveMoney
    reference: Reference


def ready_for_resale(trade):
    a = trade.acquisition
    if trade.status != "Completed" or not a or not a.checked_at or not a.stock_unit or a.returned_at or a.listing_id:
        return False
    sales = [sale for sale in trade.sales if sale.status == "Completed"]
    if sales:
        return len(sales) == 1 and bool(sales[0].deal and sales[0].deal.stage == "Collected")
    return bool(a.settlement_reference and a.settled_amount == a.inspected_value)


def draft_details(trade, staff=False):
    a = trade.acquisition
    if a is None:
        return None
    result = dict(inspection_at=a.inspection_at.replace(tzinfo=timezone.utc) if a.inspection_at else None,
                  version=a.terms_version, approved_version=a.approved_version, value=a.inspected_value,
                  findings=a.findings, excess=a.excess_amount, settlement=a.excess_terms,
                  received=bool(a.intake_at), returned=bool(a.returned_at), listing_id=a.listing_id,
                  settled_amount=a.settled_amount, settlement_reference=a.settlement_reference)
    if staff:
        result.update(stock_unit_id=a.stock_unit.unit_id if a.stock_unit else None,
                      checked=bool(a.checked_at), ownership_reference=a.ownership_reference,
                      odometer_km=a.odometer_km, intake_version=a.intake_version, ready_for_resale=ready_for_resale(trade), title=f"{trade.year} {trade.make} {trade.model}",
                      description=a.retail_description or f"{trade.year} {trade.make} {trade.model} with {a.odometer_km if a.odometer_km is not None else trade.mileage_km:,} km.",
                      retail_price=a.retail_price, preparation_cost=a.preparation_cost)
    return result


def trade_credit(trade, customer_id, vehicle_id, balance):
    if trade is None or trade.customer_id != customer_id or trade.status != "Accepted":
        raise ValueError("Choose an accepted trade-in for this customer")
    if trade.target_vehicle_id and trade.target_vehicle_id != vehicle_id:
        raise ValueError("Trade-in offer applies to another vehicle")
    a = trade.acquisition
    if not a or not a.intake_at or not a.checked_at or a.returned_at or a.approved_version != a.terms_version:
        raise ValueError("Trade-in credit requires approved inspection terms and physical intake")
    excess = max(Decimal("0"), a.inspected_value - balance)
    if balance < 0 or excess != a.excess_amount or (excess and not a.excess_terms):
        raise ValueError("Manager and customer must agree to separate settlement of the exact excess before payment")
    return min(a.inspected_value, balance)


def apply_staff_action(db, trade, user, body):
    a = trade.acquisition
    if not a or a.returned_at:
        raise ValueError("An accepted offer is required")
    if isinstance(body, Publish):
        return publish(db, trade, a, user, body)
    if isinstance(body, AcquisitionPayment):
        if user.role != "manager":
            raise ValueError("Only a manager can record a standalone acquisition payment")
        if a.settlement_reference:
            if not trade.sales and (a.settled_amount, a.settlement_reference) == (body.amount, body.reference):
                return
            raise ValueError("Payment already recorded")
        if trade.status != "Accepted" or not a.intake_at or not a.checked_at or a.approved_version != a.terms_version:
            raise ValueError("Approved terms and physical intake are required before settlement")
        if body.amount != a.inspected_value or a.excess_amount:
            raise ValueError("Approve standalone terms and record payment of the entire acquisition value")
        a.settled_amount, a.settlement_reference = body.amount, body.reference
        a.settled_at, a.settlement_by = utcnow(), user.user_id
        trade.status = "Completed"
        return
    legacy_check = isinstance(body, Intake) and a.intake_at and not a.checked_at and not a.listing_id
    if trade.status != "Accepted" and not legacy_check:
        raise ValueError("This trade-in is no longer awaiting acquisition")
    if isinstance(body, ScheduleInspection):
        if a.intake_at or a.terms_version:
            raise ValueError("Inspection has already been recorded")
        if not body.appointment.tzinfo:
            raise ValueError("Supply an appointment with a time zone")
        a.inspection_at = body.appointment.astimezone(timezone.utc).replace(tzinfo=None)
    elif isinstance(body, InspectionTerms):
        if not a.inspection_at or a.terms_version != body.version:
            raise ValueError("Schedule an inspection and reload the current terms")
        if body.excess > body.value or (body.excess and (user.role != "manager" or not body.settlement)):
            raise ValueError("Excess settlement requires manager terms and cannot exceed the verified value")
        if a.excess_amount and user.role != "manager":
            raise ValueError("Only a manager can revise separate settlement terms")
        if a.intake_at and (user.role != "manager" or body.value != a.inspected_value or body.findings != a.findings):
            raise ValueError("After intake only a manager can revise the separate settlement")
        a.terms_version += 1
        a.inspected_value, a.findings = body.value, body.findings
        a.excess_amount, a.excess_terms, a.terms_by = body.excess, body.settlement, user.user_id
    elif isinstance(body, Intake):
        vin = body.vin.strip().upper()
        if not re.fullmatch(r"[A-HJ-NPR-Z0-9]{17}", vin):
            raise ValueError("Enter the VIN verified on the trade-in")
        if not a.terms_version or a.approved_version != body.version or a.terms_version != body.version:
            raise ValueError("The customer must approve the current inspection terms before intake")
        if a.intake_at and a.vin != vin:
            raise ValueError("Intake was already recorded for another VIN")
        if a.checked_at and (a.ownership_reference, a.odometer_km) != (body.ownership_reference, body.odometer_km):
            raise ValueError("The verified intake record already exists")
        if not a.intake_at:
            garage_cars = db.query(CustomerVehicle.cv_id).filter(
                func.upper(func.trim(CustomerVehicle.vin_number)) == vin,
            ).order_by(CustomerVehicle.cv_id).with_for_update().all()
            if garage_cars and db.query(ServiceBooking.booking_id).filter(
                ServiceBooking.cv_id.in_([row.cv_id for row in garage_cars]),
                ServiceBooking.status.in_(["Booked", "Confirmed", "In Progress"]),
            ).first():
                raise ValueError("Resolve the active service appointment before taking this vehicle into custody")
            previous = db.query(InventoryUnit).filter_by(vin=vin, superseded_by_trade=None).with_for_update().one_or_none()
            if previous and not db.query(Deal).filter_by(unit_id=previous.unit_id, stage="Collected").first():
                raise ValueError("This VIN is already in showroom inventory")
            a.vin, a.intake_at, a.intake_by = vin, utcnow(), user.user_id
        if not a.checked_at:
            a.ownership_reference, a.odometer_km = body.ownership_reference, body.odometer_km
            a.checked_at, a.checked_by, a.intake_version = utcnow(), user.user_id, body.version
        if not a.stock_unit:
            a.stock_unit = InventoryUnit()


def publish(db, trade, a, user, body):
    if a.listing_id:
        return
    if not a.checked_at or not a.stock_unit:
        raise ValueError("Verify ownership, VIN, odometer and condition before publication")
    if not ready_for_resale(trade):
        raise ValueError("Complete pickup or record the full standalone acquisition payment before resale")
    photos = [p.image_url for p in sorted(trade.images, key=lambda p: p.image_id)]
    if not photos or any(not p.startswith("https://") for p in photos):
        raise ValueError("Verify the listing photos before publication")
    previous = db.query(InventoryUnit).filter_by(vin=a.vin, superseded_by_trade=None).with_for_update().one_or_none()
    if previous:
        if not db.query(Deal).filter_by(unit_id=previous.unit_id, stage="Collected").first():
            raise ValueError("Another current stock unit already has this VIN")
        previous.superseded_by_trade = trade.trade_in_id
        db.flush()
    v = Vehicle(make=trade.make, model=trade.model, year=trade.year, color=trade.color,
                mileage_km=a.odometer_km, condition_type="Used", price=body.retail_price,
                description=body.description, main_image_url=photos[0], stock_quantity=0, is_published=True)
    db.add(v)
    db.flush()
    unit = a.stock_unit
    v.stock_quantity = 1
    unit.vehicle_id = v.vehicle_id
    unit.vin, unit.verified_at, unit.verified_by = a.vin, a.intake_at, a.intake_by
    db.add_all(VehicleImage(vehicle_id=v.vehicle_id, image_url=url, sort_order=i) for i, url in enumerate(photos))
    db.add(StockMovement(vehicle_id=v.vehicle_id, change_qty=1, reason="Restock",
                         reference_id=trade.trade_in_id, created_by=user.user_id))
    a.preparation_cost, a.retail_price, a.retail_description = body.preparation_cost, body.retail_price, body.description
    a.published_by, a.listing_id = user.user_id, v.vehicle_id
