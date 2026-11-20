from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, ConfigDict


class VehicleBase(BaseModel):
    make: str
    model: str
    year: int
    color: Optional[str] = None
    fuel_type: Optional[str] = None
    transmission: Optional[str] = None
    body_type: Optional[str] = None
    condition_type: str = "New"
    mileage_km: int = 0
    vin_number: Optional[str] = None
    price: Decimal
    status: str = "Available"
    notes: Optional[str] = None


class VehicleCreate(VehicleBase):
    # Storefront fields
    stock_quantity: int = 1
    description: Optional[str] = None
    main_image_url: Optional[str] = None
    engine: Optional[str] = None
    horsepower: Optional[int] = None
    seats: Optional[int] = None
    drivetrain: Optional[str] = None
    is_published: bool = True


class VehicleUpdate(BaseModel):
    make: Optional[str] = None
    model: Optional[str] = None
    year: Optional[int] = None
    color: Optional[str] = None
    fuel_type: Optional[str] = None
    transmission: Optional[str] = None
    body_type: Optional[str] = None
    condition_type: Optional[str] = None
    mileage_km: Optional[int] = None
    vin_number: Optional[str] = None
    price: Optional[Decimal] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    # Storefront fields (spec 10.4 / 11.5)
    stock_quantity: Optional[int] = None
    description: Optional[str] = None
    main_image_url: Optional[str] = None
    engine: Optional[str] = None
    horsepower: Optional[int] = None
    seats: Optional[int] = None
    drivetrain: Optional[str] = None
    is_published: Optional[bool] = None


class VehicleResponse(VehicleBase):
    model_config = ConfigDict(from_attributes=True)

    vehicle_id: int
    date_added: datetime
    # Storefront fields
    stock_quantity: int = 1
    description: Optional[str] = None
    main_image_url: Optional[str] = None
    engine: Optional[str] = None
    horsepower: Optional[int] = None
    seats: Optional[int] = None
    drivetrain: Optional[str] = None
    is_published: bool = True
