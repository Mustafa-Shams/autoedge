from decimal import Decimal
from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.vehicle import Vehicle
from app.schemas.vehicle import VehicleCreate, VehicleUpdate


def get_vehicle(db: Session, vehicle_id: int) -> Optional[Vehicle]:
    return db.query(Vehicle).filter(Vehicle.vehicle_id == vehicle_id).first()


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
    return q.offset(skip).limit(limit).all()


def get_available_vehicles(db: Session) -> List[Vehicle]:
    return db.query(Vehicle).filter(Vehicle.status == "Available").all()


def create_vehicle(db: Session, obj_in: VehicleCreate) -> Vehicle:
    db_vehicle = Vehicle(**obj_in.model_dump())
    db.add(db_vehicle)
    db.commit()
    db.refresh(db_vehicle)
    return db_vehicle


def update_vehicle(db: Session, vehicle_id: int, obj_in: VehicleUpdate) -> Optional[Vehicle]:
    vehicle = get_vehicle(db, vehicle_id)
    if not vehicle:
        return None
    for field, value in obj_in.model_dump(exclude_unset=True).items():
        setattr(vehicle, field, value)
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
