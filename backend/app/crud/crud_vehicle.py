"""CRUD operations for vehicles — extended for storefront (spec 10.4).

Manual stock edits via PUT /vehicles/{id} write a stock_movements row
with reason 'Manual Adjustment' per spec.
"""
from decimal import Decimal
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import String, cast, func, or_

from app.core.time import utcnow
from app.models.reservation import Reservation
from app.models.vehicle import Vehicle
from app.models.stock_movement import StockMovement
from app.schemas.vehicle import VehicleCreate, VehicleUpdate
from app.services.stock_service import get_vehicle_for_update, sync_vehicle_status


def get_vehicle(db: Session, vehicle_id: int) -> Optional[Vehicle]:
    return db.query(Vehicle).filter(Vehicle.vehicle_id == vehicle_id).first()


SORTABLE_FIELDS = {
    field: getattr(Vehicle, field)
    for field in ("vehicle_id", "make", "model", "year", "color", "condition_type",
                  "price", "stock_quantity", "status", "is_published")
}


def active_reservation_count(now):
    return (
        Reservation.__table__.select()
        .with_only_columns(func.count(Reservation.reservation_id))
        .where(
            Reservation.vehicle_id == Vehicle.vehicle_id,
            Reservation.status == "Active",
            Reservation.expires_at >= now,
        )
        .correlate(Vehicle)
        .scalar_subquery()
    )


def _build_vehicle_query(
    db: Session,
    status: Optional[str] = None,
    make: Optional[str] = None,
    year: Optional[int] = None,
    price_min: Optional[Decimal] = None,
    price_max: Optional[Decimal] = None,
    condition_type: Optional[str] = None,
    search: Optional[str] = None,
    reservation_count=None,
):
    """Build a filtered query on Vehicle (shared by list + count)."""
    q = db.query(Vehicle)
    if status == "Reserved":
        q = q.filter(reservation_count > 0)
    elif status:
        q = q.filter(Vehicle.status == status)
    if make:
        q = q.filter(Vehicle.make.ilike(f"%{make}%"))
    if year:
        q = q.filter(Vehicle.year == year)
    if price_min is not None:
        q = q.filter(Vehicle.price >= price_min)
    if price_max is not None:
        q = q.filter(Vehicle.price <= price_max)
    if condition_type:
        q = q.filter(Vehicle.condition_type == condition_type)
    for word in (search or "").split():
        literal = word.replace("/", "//").replace("%", "/%").replace("_", "/_")
        pattern = f"%{literal}%"
        fields = (Vehicle.make, Vehicle.model, cast(Vehicle.year, String), Vehicle.color, Vehicle.vin_number)
        q = q.filter(or_(*(field.ilike(pattern, escape="/") for field in fields)))
    return q


def get_vehicle_page(db: Session, skip: int, limit: int, sort: str, direction: str, **filters):
    reservation_count = active_reservation_count(utcnow())
    query = _build_vehicle_query(db, reservation_count=reservation_count, **filters)
    total = query.with_entities(func.count(Vehicle.vehicle_id)).scalar()
    column = SORTABLE_FIELDS[sort]
    order = column.desc() if direction == "desc" else column.asc()
    items = (
        query.add_columns(reservation_count.label("active_reservation_count"))
        .order_by(order.nulls_last(), Vehicle.vehicle_id.asc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return items, total


def get_available_vehicles(db: Session) -> List[Vehicle]:
    return db.query(Vehicle).filter(Vehicle.status == "Available").all()


def create_vehicle(db: Session, obj_in: VehicleCreate) -> Vehicle:
    db_vehicle = Vehicle(**obj_in.model_dump())
    db_vehicle.status = "Available" if db_vehicle.stock_quantity else "Sold"
    db.add(db_vehicle)
    db.commit()
    db.refresh(db_vehicle)
    return db_vehicle


def update_vehicle(
    db: Session,
    vehicle_id: int,
    obj_in: VehicleUpdate,
    current_user_id: Optional[int] = None,
) -> Optional[Vehicle]:
    vehicle = get_vehicle_for_update(db, vehicle_id)
    if not vehicle:
        return None

    data = obj_in.model_dump(exclude_unset=True, exclude={"status"})
    if data.get("stock_quantity") is None:
        data.pop("stock_quantity", None)

    # Track stock change for stock_movements (spec 10.4 — manual stock edit)
    old_stock = vehicle.stock_quantity
    new_stock = data.get("stock_quantity")

    for field, value in data.items():
        setattr(vehicle, field, value)
    sync_vehicle_status(db, vehicle)

    # Write stock_movement row if stock changed manually
    if new_stock is not None and new_stock != old_stock:
        change_qty = new_stock - old_stock
        movement = StockMovement(
            vehicle_id=vehicle_id,
            change_qty=change_qty,
            reason="Manual Adjustment",
            reference_id=None,
            created_by=current_user_id,
        )
        db.add(movement)

    db.commit()
    db.refresh(vehicle)
    return vehicle


def delete_vehicle(db: Session, vehicle_id: int) -> Optional[Vehicle]:
    vehicle = get_vehicle(db, vehicle_id)
    if not vehicle:
        return None
    db.delete(vehicle)
    db.commit()
    return vehicle
