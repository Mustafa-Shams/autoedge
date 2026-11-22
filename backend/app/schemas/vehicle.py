from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field, field_validator


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
    stock_quantity: int = Field(1, ge=0)
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
    stock_quantity: Optional[int] = Field(None, ge=0)
    description: Optional[str] = None
    main_image_url: Optional[str] = None
    engine: Optional[str] = None
    horsepower: Optional[int] = None
    seats: Optional[int] = None
    drivetrain: Optional[str] = None
    is_published: Optional[bool] = None


# ── Vehicle image schemas (Decision #23) ─────────────────────────────

class VehicleImageResponse(BaseModel):
    """Single vehicle image in staff API responses."""
    model_config = ConfigDict(from_attributes=True)

    image_id: int
    image_url: str
    sort_order: int
    credit: Optional[str] = None
    source_url: Optional[str] = None


class BulkImageItem(BaseModel):
    """One image in a bulk-replace request."""
    image_url: str
    sort_order: int = 0
    credit: Optional[str] = None
    source_url: Optional[str] = None

    @field_validator("image_url")
    @classmethod
    def validate_url(cls, v: str) -> str:
        v = v.strip()
        if not v.lower().startswith(("http://", "https://")):
            raise ValueError("Image URL must start with http:// or https://")
        return v


class BulkImageRequest(BaseModel):
    """Body for PUT /vehicles/{id}/images/bulk — full image replacement."""
    main_image_url: Optional[str] = None
    images: List[BulkImageItem] = []

    @field_validator("main_image_url")
    @classmethod
    def validate_main_url(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.strip()
            if v == "":
                return None
            if not v.lower().startswith(("http://", "https://")):
                raise ValueError("Main image URL must start with http:// or https://")
        return v

    @field_validator("images")
    @classmethod
    def validate_images_limit(cls, v: list) -> list:
        if len(v) > 8:
            raise ValueError("Maximum 8 additional images allowed")
        # Check for duplicate URLs
        urls = [img.image_url for img in v]
        if len(urls) != len(set(urls)):
            raise ValueError("Duplicate image URLs are not allowed")
        return v


class VehicleResponse(VehicleBase):
    active_reservation_count: int = 0
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
    # Vehicle images (Decision #23)
    images: List[VehicleImageResponse] = []
