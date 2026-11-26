"""Customer garage routes — My Garage CRUD per spec 7.8.

GET    /store/garage          — List customer's vehicles
POST   /store/garage          — Add a vehicle
PUT    /store/garage/{cv_id}  — Update a vehicle
DELETE /store/garage/{cv_id}  — Delete (blocked if active booking exists)
"""
from typing import Optional, List
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, ConfigDict
from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_customer
from app.models.customer_account import CustomerAccount
from app.models.deal import Deal
from app.models.customer_vehicle import CustomerVehicle
from app.models.service_booking import ServiceBooking
from app.services.service_booking_service import in_showroom_custody


router = APIRouter(prefix="/store/garage", tags=["store-garage"])


# ── Schemas ──────────────────────────────────────────────────────────

class GarageCarCreate(BaseModel):
    make: str = Field(..., min_length=1, max_length=50)
    model: str = Field(..., min_length=1, max_length=50)
    year: int = Field(..., ge=1900, le=2030)
    color: Optional[str] = Field(None, max_length=40)
    plate_number: Optional[str] = Field(None, max_length=20)
    vin_number: Optional[str] = Field(None, max_length=30)


class GarageCarUpdate(BaseModel):
    make: Optional[str] = Field(None, min_length=1, max_length=50)
    model: Optional[str] = Field(None, min_length=1, max_length=50)
    year: Optional[int] = Field(None, ge=1900, le=2030)
    color: Optional[str] = Field(None, max_length=40)
    plate_number: Optional[str] = Field(None, max_length=20)
    vin_number: Optional[str] = Field(None, max_length=30)


class GarageCarResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    cv_id: int
    customer_id: int
    make: str
    model: str
    year: int
    color: Optional[str] = None
    plate_number: Optional[str] = None
    vin_number: Optional[str] = None
    source_sale_id: Optional[int] = None
    deal_id: int | None = None
    created_at: datetime
    has_active_booking: bool = False
    has_history: bool = False
    traded_in: bool = False


# ── Routes ───────────────────────────────────────────────────────────

@router.get("", response_model=List[GarageCarResponse])
async def list_garage(
    account: CustomerAccount = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    """List all vehicles in the customer's garage."""
    vehicles = (
        db.query(CustomerVehicle)
        .filter(CustomerVehicle.customer_id == account.customer_id)
        .order_by(CustomerVehicle.created_at.desc())
        .all()
    )

    result = []
    for v in vehicles:
        # Check if this vehicle has any active bookings
        active = db.query(ServiceBooking).filter(
            ServiceBooking.cv_id == v.cv_id,
            ServiceBooking.status.in_(["Booked", "Confirmed", "In Progress"]),
        ).first()
        car = GarageCarResponse.model_validate(v)
        if v.source_sale_id:
            car.deal_id = db.query(Deal.deal_id).filter_by(sale_id=v.source_sale_id, customer_id=account.customer_id).scalar()
        car.has_active_booking = active is not None
        car.has_history = bool(v.source_sale_id or v.service_bookings or v.service_jobs)
        car.traded_in = in_showroom_custody(db, v)
        result.append(car)

    return result


@router.post("", response_model=GarageCarResponse, status_code=status.HTTP_201_CREATED)
async def add_garage_car(
    data: GarageCarCreate,
    account: CustomerAccount = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    """Add a vehicle to the customer's garage."""
    car = CustomerVehicle(
        customer_id=account.customer_id,
        make=data.make.strip(),
        model=data.model.strip(),
        year=data.year,
        color=data.color.strip() if data.color else None,
        plate_number=data.plate_number.strip() if data.plate_number else None,
        vin_number=data.vin_number.strip() if data.vin_number else None,
    )
    db.add(car)
    db.commit()
    db.refresh(car)
    resp = GarageCarResponse.model_validate(car)
    resp.has_active_booking = False
    return resp


@router.put("/{cv_id}", response_model=GarageCarResponse)
async def update_garage_car(
    cv_id: int,
    data: GarageCarUpdate,
    account: CustomerAccount = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    """Update a garage vehicle's details."""
    car = db.query(CustomerVehicle).filter(
        and_(
            CustomerVehicle.cv_id == cv_id,
            CustomerVehicle.customer_id == account.customer_id,
        )
    ).first()
    if not car:
        raise HTTPException(status_code=404, detail="Vehicle not found in your garage")

    update_data = data.model_dump(exclude_unset=True)
    if in_showroom_custody(db, car):
        raise HTTPException(409, "This vehicle has been traded in")
    if car.source_sale_id and car.vin_number and "vin_number" in update_data:
        if (update_data["vin_number"] or "").strip().upper() != car.vin_number.upper():
            raise HTTPException(409, "The VIN recorded at handover cannot be changed")
        update_data.pop("vin_number")
    for field, value in update_data.items():
        if isinstance(value, str):
            value = value.strip()
        setattr(car, field, value)

    db.commit()
    db.refresh(car)

    active = db.query(ServiceBooking).filter(
        ServiceBooking.cv_id == car.cv_id,
        ServiceBooking.status.in_(["Booked", "Confirmed", "In Progress"]),
    ).first()
    resp = GarageCarResponse.model_validate(car)
    resp.has_active_booking = active is not None
    return resp


@router.delete("/{cv_id}")
async def delete_garage_car(
    cv_id: int,
    account: CustomerAccount = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    """Delete a vehicle from the garage.

    Blocked if the vehicle is referenced by an active (Booked/Confirmed/In Progress) booking.
    """
    car = db.query(CustomerVehicle).filter(
        and_(
            CustomerVehicle.cv_id == cv_id,
            CustomerVehicle.customer_id == account.customer_id,
        )
    ).first()
    if not car:
        raise HTTPException(status_code=404, detail="Vehicle not found in your garage")

    # Check for active bookings
    active_booking = db.query(ServiceBooking).filter(
        ServiceBooking.cv_id == cv_id,
        ServiceBooking.status.in_(["Booked", "Confirmed", "In Progress"]),
    ).first()
    if active_booking:
        raise HTTPException(
            status_code=409,
            detail="Cannot delete this vehicle — it has an active service booking. "
                   "Cancel the booking first.",
        )

    if car.source_sale_id or car.service_bookings or car.service_jobs or in_showroom_custody(db, car):
        raise HTTPException(409, "This vehicle has a purchase, trade-in or service history")
    db.delete(car)
    db.commit()
    return {"detail": "Vehicle removed from garage"}
