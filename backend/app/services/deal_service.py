from decimal import Decimal
import re

from sqlalchemy import exists
from sqlalchemy.orm import Session

from app.models.deal import Deal, InventoryUnit
from app.core.time import utcnow
from app.models.commission import Commission
from app.models.customer_vehicle import CustomerVehicle
from app.models.vehicle import Vehicle
from app.models.sales_assistance import SalesAssistance


def available_units(db: Session, vehicle_id: int):
    return db.query(InventoryUnit).filter(
        InventoryUnit.vehicle_id == vehicle_id,
        ~exists().where(Deal.unit_id == InventoryUnit.unit_id),
    ).order_by(InventoryUnit.unit_id)


def take_unit(db, vehicle_id):
    # All callers hold the vehicle lock. Flush earlier allocations in this transaction.
    db.flush()
    unit = available_units(db, vehicle_id).with_for_update().first()
    if unit is None:
        raise ValueError("No individual unit is available for this listing")
    return unit.unit_id


def adjust_units(db, vehicle_id, delta):
    if delta > 0:
        db.execute(InventoryUnit.__table__.insert(), [{"vehicle_id": vehicle_id}] * delta)
    elif delta < 0:
        units = available_units(db, vehicle_id).limit(-delta).with_for_update().all()
        if len(units) != -delta:
            raise ValueError("Stock adjustment exceeds available units")
        for unit in units:
            db.delete(unit)
        db.flush()


def shopping_deal(db, customer_id, vehicle_id, *, include_hold=True):
    # Every entry point serializes on the same listing as reservation and checkout.
    db.query(Vehicle.vehicle_id).filter_by(vehicle_id=vehicle_id).with_for_update().one()
    query = db.query(Deal).filter_by(customer_id=customer_id, vehicle_id=vehicle_id)
    if include_hold:
        hold = query.filter_by(stage="Reserved").order_by(Deal.deal_id.desc()).first()
        if hold:
            return hold
    deal = query.filter_by(stage="Shopping").one_or_none()
    if not deal:
        deal = Deal(customer_id=customer_id, vehicle_id=vehicle_id, stage="Shopping")
        db.add(deal)
        db.flush()
    return deal


def interest_id(db, customer_id, vehicle_id):
    return shopping_deal(db, customer_id, vehicle_id).deal_id if vehicle_id else None


def reserve_unit(db, reservation):
    deal = shopping_deal(db, reservation.customer_id, reservation.vehicle_id, include_hold=False)
    deal.unit_id = take_unit(db, reservation.vehicle_id)
    deal.reservation_id = reservation.reservation_id
    deal.stage = "Reserved"
    db.flush()
    return deal


def held_deal(db, reservation_id):
    deal = db.query(Deal).filter_by(reservation_id=reservation_id, stage="Reserved").with_for_update().one_or_none()
    if deal is None:
        raise ValueError("Reservation has no held inventory unit")
    return deal


def handover(db, sale, staff_id, entered_vin, settlement_reference=None):
    vin = entered_vin.strip().upper()
    if not re.fullmatch(r"[A-HJ-NPR-Z0-9]{17}", vin):
        raise ValueError("Enter the 17-character VIN from the car. VINs exclude I, O and Q.")
    deal = db.query(Deal).filter_by(sale_id=sale.sale_id).with_for_update().one_or_none()
    if deal is None or deal.stage not in ("Awaiting pickup", "Collected"):
        raise ValueError("This sale is not awaiting pickup")
    unit = db.get(InventoryUnit, deal.unit_id)
    if deal.refund_requested_at:
        raise ValueError("Resolve the cancellation request before handover")
    if deal.stage == "Collected":
        if unit.vin != vin:
            raise ValueError("Handover was already recorded with a different VIN")
        return
    if sale.payment_type != "Demo Wallet" and not deal.payment_verified_at:
        raise ValueError("Verify showroom payment before handover")
    if unit.vin and unit.vin != vin:
        raise ValueError("The VIN does not match the unit recorded during intake")
    acquisition = sale.trade_in.acquisition if sale.trade_in else None
    if acquisition and acquisition.excess_amount:
        if not settlement_reference or not settlement_reference.strip():
            raise ValueError("Record the separate excess payment reference at pickup")
        acquisition.settlement_reference = settlement_reference.strip()
        acquisition.settled_amount = acquisition.excess_amount
        acquisition.settlement_by, acquisition.settled_at = staff_id, utcnow()
    unit.vin, unit.verified_by, unit.verified_at = vin, staff_id, utcnow()
    deal.stage = "Collected"
    vehicle = db.get(Vehicle, deal.vehicle_id)
    db.add(CustomerVehicle(customer_id=deal.customer_id, source_sale_id=sale.sale_id, vin_number=vin,
                           make=vehicle.make, model=vehicle.model, year=vehicle.year, color=vehicle.color))
    assistance = db.query(SalesAssistance).filter_by(sale_id=sale.sale_id).one_or_none()
    if assistance:
        rate = Decimal("2.50")
        db.add(Commission(staff_id=assistance.owner_id, sale_id=sale.sale_id, rate_percent=rate,
                          commission_amt=(sale.sale_price - sale.discount) * rate / 100))
    db.flush()


def release_unit(db, reservation_id, stage):
    deal = held_deal(db, reservation_id)
    assistance = db.query(SalesAssistance).filter_by(deal_id=deal.deal_id, closed_at=None).one_or_none()
    if assistance:
        assistance.closed_at = utcnow()
    deal.unit_id = None
    deal.stage = stage
    return deal


def assign_sale(db, sale):
    if sale.reservation_id:
        deal = held_deal(db, sale.reservation_id)
    else:
        deal = shopping_deal(db, sale.customer_id, sale.vehicle_id, include_hold=False)
        deal.unit_id = take_unit(db, sale.vehicle_id)
    if sale.trade_in and sale.trade_in.deal_id is None:
        sale.trade_in.deal_id = deal.deal_id
    deal.sale_id = sale.sale_id
    deal.stage = "Awaiting pickup"
    db.flush()
    return deal
