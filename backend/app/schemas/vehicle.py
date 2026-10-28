from datetime import datetime
from decimal import Decimal
from typing import Optional
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
    pass


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


class VehicleResponse(VehicleBase):
    model_config = ConfigDict(from_attributes=True)

    vehicle_id: int
    date_added: datetime
