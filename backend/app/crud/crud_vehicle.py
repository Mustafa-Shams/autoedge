"""CRUD operations for vehicles — extended for storefront (spec 10.4).

Manual stock edits via PUT /vehicles/{id} write a stock_movements row
with reason 'Manual Adjustment' per spec.
"""
from decimal import Decimal
from typing import List, Optional
from sqlalchemy.orm import Session

from app.models.vehicle import Vehicle
from app.models.stock_movement import StockMovement
from app.schemas.vehicle import VehicleCreate, VehicleUpdate


def get_vehicle(db: Session, vehicle_id: int) -> Optional[Vehicle]:
    return db.query(Vehicle).filter(Vehicle.vehicle_id == vehicle_id).first()


def _build_vehicle_query(
    db: Session,
    status: Optional[str] = None,
    make: Optional[str] = None,
    year: Optional[int] = None,
    price_min: Optional[Decimal] = None,
    price_max: Optional[Decimal] = None,
    condition_type: Optional[str] = None,
):
    """Build a filtered query on Vehicle (shared by list + count)."""
    q = db.query(Vehicle)
    if status:
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
    return q


def get_vehicles(
    db: Session,
    skip: int = 0,
    limit: int = 20,
    status: Optional[str] = None,
    make: Optional[str] = None,
    year: Optional[int] = None,
    price_min: Optional[Decimal] = None,
    price_max: Optional[Decimal] = None,
    condition_type: Optional[str] = None,
) -> List[Vehicle]:
    q = _build_vehicle_query(db, status=status, make=make, year=year,
                             price_min=price_min, price_max=price_max,
                             condition_type=condition_type)
    return q.offset(skip).limit(limit).all()


def count_vehicles(
    db: Session,
    status: Optional[str] = None,
    make: Optional[str] = None,
    year: Optional[int] = None,
    price_min: Optional[Decimal] = None,
    price_max: Optional[Decimal] = None,
    condition_type: Optional[str] = None,
) -> int:
    """Return the total number of vehicles matching the given filters."""
    from sqlalchemy import func as sqf
    q = _build_vehicle_query(db, status=status, make=make, year=year,
                             price_min=price_min, price_max=price_max,
                             condition_type=condition_type)
    return q.with_entities(sqf.count(Vehicle.vehicle_id)).scalar() or 0


def get_available_vehicles(db: Session) -> List[Vehicle]:
    return db.query(Vehicle).filter(Vehicle.status == "Available").all()


def create_vehicle(db: Session, obj_in: VehicleCreate) -> Vehicle:
    db_vehicle = Vehicle(**obj_in.model_dump())
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
    vehicle = get_vehicle(db, vehicle_id)
    if not vehicle:
        return None

    data = obj_in.model_dump(exclude_unset=True)

    # Track stock change for stock_movements (spec 10.4 — manual stock edit)
    old_stock = vehicle.stock_quantity
    new_stock = data.get("stock_quantity")

    for field, value in data.items():
        setattr(vehicle, field, value)

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
