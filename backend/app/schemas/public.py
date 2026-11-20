"""Pydantic v2 schemas for public catalog endpoints — explicit allow-list.

Per spec section 10: Public schemas never expose notes, staff emails,
customer personal data, internal notes, or password hashes.
"""
from datetime import date, datetime, time
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, ConfigDict


# ── Vehicle schemas ──────────────────────────────────────────────────

class PublicVehicleImage(BaseModel):
    """Single vehicle photo for the gallery."""
    model_config = ConfigDict(from_attributes=True)

    image_id: int
    image_url: str
    sort_order: int
    credit: Optional[str] = None
    source_url: Optional[str] = None


class PublicVehicleListItem(BaseModel):
    """Vehicle card for catalog listings — no notes, no staff data."""
    model_config = ConfigDict(from_attributes=True)

    vehicle_id: int
    make: str
    model: str
    year: int
    color: Optional[str] = None
    fuel_type: Optional[str] = None
    transmission: Optional[str] = None
    body_type: Optional[str] = None
    condition_type: str
    mileage_km: int
    price: Decimal
    stock_quantity: int
    main_image_url: Optional[str] = None
    avg_rating: Decimal = Decimal("0")
    review_count: int = 0
    open_restock_requests: int = 0
    availability: str  # "in_stock" or "out_of_stock"


class PublicVehicleDetail(BaseModel):
    """Full vehicle detail for CarDetailPage."""
    model_config = ConfigDict(from_attributes=True)

    vehicle_id: int
    make: str
    model: str
    year: int
    color: Optional[str] = None
    fuel_type: Optional[str] = None
    transmission: Optional[str] = None
    body_type: Optional[str] = None
    condition_type: str
    mileage_km: int
    price: Decimal
    stock_quantity: int
    main_image_url: Optional[str] = None
    description: Optional[str] = None
    engine: Optional[str] = None
    horsepower: Optional[int] = None
    seats: Optional[int] = None
    drivetrain: Optional[str] = None
    avg_rating: Decimal = Decimal("0")
    review_count: int = 0
    open_restock_requests: int = 0
    availability: str
    images: List[PublicVehicleImage] = []


class VehicleFilters(BaseModel):
    """Distinct filter values for the filter bar."""
    makes: List[str]
    body_types: List[str]
    fuel_types: List[str]
    condition_types: List[str]
    year_min: Optional[int] = None
    year_max: Optional[int] = None
    price_min: Optional[Decimal] = None
    price_max: Optional[Decimal] = None


class VehicleListResponse(BaseModel):
    """Paginated vehicle listing with total count."""
    items: List[PublicVehicleListItem]
    total: int
    page: int
    page_size: int


# ── Review schemas ───────────────────────────────────────────────────

class PublicReviewItem(BaseModel):
    """Single review — shows first name + last initial, not full customer data."""
    model_config = ConfigDict(from_attributes=True)

    review_id: int
    rating: int
    title: Optional[str] = None
    body: str
    customer_name: str  # "John D." — computed in the route
    is_verified: bool = False  # computed: has completed test drive or sale for this vehicle
    created_at: datetime


class ReviewListResponse(BaseModel):
    """Paginated reviews for a vehicle."""
    items: List[PublicReviewItem]
    total: int
    page: int
    page_size: int
    avg_rating: Decimal = Decimal("0")
    review_count: int = 0


# ── Service schemas ──────────────────────────────────────────────────

class PublicServiceType(BaseModel):
    """Service type for the public service info page."""
    model_config = ConfigDict(from_attributes=True)

    service_type_id: int
    name: str
    description: Optional[str] = None
    base_price: Decimal
    booking_fee: Decimal
    duration_minutes: int
    required_specialty: Optional[str] = None


class PublicTechnician(BaseModel):
    """Technician profile — NO email, per spec."""
    model_config = ConfigDict(from_attributes=True)

    user_id: int
    full_name: str  # from users table
    specialty: str
    years_experience: int
    bio: Optional[str] = None
    photo_url: Optional[str] = None


# ── Slot / availability schemas ──────────────────────────────────────

class SlotAvailability(BaseModel):
    """A single time slot with availability."""
    time: str  # HH:MM format
    available: bool


class TestDriveSlotResponse(BaseModel):
    """Available test drive slots for a vehicle on a date."""
    vehicle_id: int
    date: date
    slots: List[SlotAvailability]


class TechnicianAvailability(BaseModel):
    """Available service slots for a technician on a date."""
    technician_id: int
    date: date
    slots: List[SlotAvailability]
