"""Public catalog routes — no authentication required. Spec sections 10.1, 11.

GET  /public/vehicles              — Filtered, sorted, paginated vehicle catalog
GET  /public/vehicles/filters      — Distinct filter values
GET  /public/vehicles/featured     — 6 newest in-stock cars
GET  /public/vehicles/compare      — 2-3 vehicles side-by-side
GET  /public/vehicles/{id}         — Vehicle detail + images + stats
GET  /public/vehicles/{id}/reviews — Paginated reviews with verified flag
GET  /public/test-drive-slots      — Slot availability for a vehicle on a date
GET  /public/service-types         — Active service types
GET  /public/technicians           — Bookable technician profiles (NO email)
GET  /public/technicians/{id}/availability — Service slots for a technician on a date
"""
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, case, and_, exists, literal
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.vehicle import Vehicle
from app.models.vehicle_image import VehicleImage
from app.models.review import Review
from app.models.restock_request import RestockRequest
from app.models.test_drive import TestDrive
from app.models.customer import Customer
from app.models.sale import Sale
from app.models.service_type import ServiceType
from app.models.technician_profile import TechnicianProfile
from app.models.user import User
from app.models.service_booking import ServiceBooking
from app.schemas.public import (
    PublicVehicleListItem,
    PublicVehicleDetail,
    PublicVehicleImage,
    VehicleFilters,
    VehicleListResponse,
    PublicReviewItem,
    ReviewListResponse,
    PublicServiceType,
    PublicTechnician,
    SlotAvailability,
    TestDriveSlotResponse,
    TechnicianAvailability,
)

router = APIRouter(prefix="/public", tags=["public-catalog"])


def _vehicle_availability(stock_quantity: int) -> str:
    return "in_stock" if stock_quantity > 0 else "out_of_stock"


def _customer_display_name(full_name: str) -> str:
    """'John Doe' → 'John D.' for privacy in public reviews."""
    parts = full_name.strip().split()
    if len(parts) >= 2:
        return f"{parts[0]} {parts[-1][0]}."
    return parts[0] if parts else "Anonymous"


# ── Vehicles ─────────────────────────────────────────────────────────

@router.get("/vehicles", response_model=VehicleListResponse)
async def list_vehicles(
    q: Optional[str] = None,
    make: Optional[str] = None,
    body_type: Optional[str] = None,
    fuel_type: Optional[str] = None,
    condition_type: Optional[str] = None,
    year_min: Optional[int] = None,
    year_max: Optional[int] = None,
    price_min: Optional[Decimal] = None,
    price_max: Optional[Decimal] = None,
    in_stock_only: bool = False,
    sort: str = "newest",  # newest | price_asc | price_desc | rating
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=50),
    db: Session = Depends(get_db),
):
    """Public vehicle catalog with filters, sorting, and pagination."""
    # Subqueries for aggregate data
    avg_rating_sq = (
        db.query(
            Review.vehicle_id,
            func.avg(Review.rating).label("avg_rating"),
            func.count(Review.review_id).label("review_count"),
        )
        .filter(Review.is_visible == True)
        .group_by(Review.vehicle_id)
        .subquery()
    )

    restock_sq = (
        db.query(
            RestockRequest.vehicle_id,
            func.count(RestockRequest.request_id).label("open_requests"),
        )
        .filter(RestockRequest.status == "Open")
        .group_by(RestockRequest.vehicle_id)
        .subquery()
    )

    query = (
        db.query(
            Vehicle,
            func.coalesce(avg_rating_sq.c.avg_rating, 0).label("avg_rating"),
            func.coalesce(avg_rating_sq.c.review_count, 0).label("review_count"),
            func.coalesce(restock_sq.c.open_requests, 0).label("open_restock_requests"),
        )
        .outerjoin(avg_rating_sq, Vehicle.vehicle_id == avg_rating_sq.c.vehicle_id)
        .outerjoin(restock_sq, Vehicle.vehicle_id == restock_sq.c.vehicle_id)
        .filter(Vehicle.is_published == True)
    )

    # Apply filters
    if q:
        search_term = f"%{q}%"
        query = query.filter(
            (Vehicle.make.ilike(search_term)) |
            (Vehicle.model.ilike(search_term)) |
            (Vehicle.description.ilike(search_term))
        )
    if make:
        query = query.filter(Vehicle.make.ilike(make))
    if body_type:
        query = query.filter(Vehicle.body_type.ilike(body_type))
    if fuel_type:
        query = query.filter(Vehicle.fuel_type.ilike(fuel_type))
    if condition_type:
        query = query.filter(Vehicle.condition_type.ilike(condition_type))
    if year_min is not None:
        query = query.filter(Vehicle.year >= year_min)
    if year_max is not None:
        query = query.filter(Vehicle.year <= year_max)
    if price_min is not None:
        query = query.filter(Vehicle.price >= price_min)
    if price_max is not None:
        query = query.filter(Vehicle.price <= price_max)
    if in_stock_only:
        query = query.filter(Vehicle.stock_quantity > 0)

    # Count total before pagination
    total = query.count()

    # Apply sorting
    if sort == "price_asc":
        query = query.order_by(Vehicle.price.asc())
    elif sort == "price_desc":
        query = query.order_by(Vehicle.price.desc())
    elif sort == "rating":
        query = query.order_by(func.coalesce(avg_rating_sq.c.avg_rating, 0).desc())
    else:  # newest
        query = query.order_by(Vehicle.date_added.desc())

    # Paginate
    offset = (page - 1) * page_size
    rows = query.offset(offset).limit(page_size).all()

    items = []
    for vehicle, avg_r, rev_count, restock_count in rows:
        items.append(PublicVehicleListItem(
            vehicle_id=vehicle.vehicle_id,
            make=vehicle.make,
            model=vehicle.model,
            year=vehicle.year,
            color=vehicle.color,
            fuel_type=vehicle.fuel_type,
            transmission=vehicle.transmission,
            body_type=vehicle.body_type,
            condition_type=vehicle.condition_type,
            mileage_km=vehicle.mileage_km,
            price=vehicle.price,
            stock_quantity=vehicle.stock_quantity,
            main_image_url=vehicle.main_image_url,
            avg_rating=round(Decimal(str(avg_r)), 2),
            review_count=int(rev_count),
            open_restock_requests=int(restock_count),
            availability=_vehicle_availability(vehicle.stock_quantity),
        ))

    return VehicleListResponse(items=items, total=total, page=page, page_size=page_size)


@router.get("/vehicles/filters", response_model=VehicleFilters)
async def get_vehicle_filters(db: Session = Depends(get_db)):
    """Distinct filter values for the filter bar."""
    published = db.query(Vehicle).filter(Vehicle.is_published == True)

    makes = [r[0] for r in published.with_entities(Vehicle.make).distinct().order_by(Vehicle.make).all() if r[0]]
    body_types = [r[0] for r in published.with_entities(Vehicle.body_type).distinct().order_by(Vehicle.body_type).all() if r[0]]
    fuel_types = [r[0] for r in published.with_entities(Vehicle.fuel_type).distinct().order_by(Vehicle.fuel_type).all() if r[0]]
    condition_types = [r[0] for r in published.with_entities(Vehicle.condition_type).distinct().order_by(Vehicle.condition_type).all() if r[0]]

    year_min = published.with_entities(func.min(Vehicle.year)).scalar()
    year_max = published.with_entities(func.max(Vehicle.year)).scalar()
    price_min = published.with_entities(func.min(Vehicle.price)).scalar()
    price_max = published.with_entities(func.max(Vehicle.price)).scalar()

    return VehicleFilters(
        makes=makes,
        body_types=body_types,
        fuel_types=fuel_types,
        condition_types=condition_types,
        year_min=year_min,
        year_max=year_max,
        price_min=price_min,
        price_max=price_max,
    )


@router.get("/vehicles/featured", response_model=List[PublicVehicleListItem])
async def get_featured_vehicles(db: Session = Depends(get_db)):
    """6 newest in-stock cars for the homepage."""
    avg_rating_sq = (
        db.query(
            Review.vehicle_id,
            func.avg(Review.rating).label("avg_rating"),
            func.count(Review.review_id).label("review_count"),
        )
        .filter(Review.is_visible == True)
        .group_by(Review.vehicle_id)
        .subquery()
    )

    restock_sq = (
        db.query(
            RestockRequest.vehicle_id,
            func.count(RestockRequest.request_id).label("open_requests"),
        )
        .filter(RestockRequest.status == "Open")
        .group_by(RestockRequest.vehicle_id)
        .subquery()
    )

    rows = (
        db.query(
            Vehicle,
            func.coalesce(avg_rating_sq.c.avg_rating, 0).label("avg_rating"),
            func.coalesce(avg_rating_sq.c.review_count, 0).label("review_count"),
            func.coalesce(restock_sq.c.open_requests, 0).label("open_restock_requests"),
        )
        .outerjoin(avg_rating_sq, Vehicle.vehicle_id == avg_rating_sq.c.vehicle_id)
        .outerjoin(restock_sq, Vehicle.vehicle_id == restock_sq.c.vehicle_id)
        .filter(Vehicle.is_published == True, Vehicle.stock_quantity > 0)
        .order_by(Vehicle.date_added.desc())
        .limit(6)
        .all()
    )

    items = []
    for vehicle, avg_r, rev_count, restock_count in rows:
        items.append(PublicVehicleListItem(
            vehicle_id=vehicle.vehicle_id,
            make=vehicle.make,
            model=vehicle.model,
            year=vehicle.year,
            color=vehicle.color,
            fuel_type=vehicle.fuel_type,
            transmission=vehicle.transmission,
            body_type=vehicle.body_type,
            condition_type=vehicle.condition_type,
            mileage_km=vehicle.mileage_km,
            price=vehicle.price,
            stock_quantity=vehicle.stock_quantity,
            main_image_url=vehicle.main_image_url,
            avg_rating=round(Decimal(str(avg_r)), 2),
            review_count=int(rev_count),
            open_restock_requests=int(restock_count),
            availability=_vehicle_availability(vehicle.stock_quantity),
        ))

    return items


@router.get("/vehicles/compare")
async def compare_vehicles(
    ids: str = Query(..., description="Comma-separated vehicle IDs (2-3)"),
    db: Session = Depends(get_db),
):
    """Compare 2-3 vehicles side-by-side with full specs."""
    try:
        id_list = [int(x.strip()) for x in ids.split(",")]
    except ValueError:
        raise HTTPException(status_code=422, detail="ids must be comma-separated integers")

    if len(id_list) < 2 or len(id_list) > 3:
        raise HTTPException(status_code=422, detail="Provide 2 or 3 vehicle IDs to compare")

    vehicles = db.query(Vehicle).filter(
        Vehicle.vehicle_id.in_(id_list),
        Vehicle.is_published == True,
    ).all()

    if len(vehicles) != len(id_list):
        raise HTTPException(status_code=404, detail="One or more vehicles not found")

    result = []
    for v in vehicles:
        # Get images
        images = db.query(VehicleImage).filter(
            VehicleImage.vehicle_id == v.vehicle_id
        ).order_by(VehicleImage.sort_order).all()

        # Get rating
        rating_row = db.query(
            func.avg(Review.rating).label("avg"),
            func.count(Review.review_id).label("cnt"),
        ).filter(
            Review.vehicle_id == v.vehicle_id,
            Review.is_visible == True,
        ).first()

        avg_r = round(Decimal(str(rating_row.avg or 0)), 2)
        rev_count = int(rating_row.cnt or 0)

        # Restock requests
        restock_count = db.query(func.count(RestockRequest.request_id)).filter(
            RestockRequest.vehicle_id == v.vehicle_id,
            RestockRequest.status == "Open",
        ).scalar() or 0

        result.append(PublicVehicleDetail(
            vehicle_id=v.vehicle_id,
            make=v.make,
            model=v.model,
            year=v.year,
            color=v.color,
            fuel_type=v.fuel_type,
            transmission=v.transmission,
            body_type=v.body_type,
            condition_type=v.condition_type,
            mileage_km=v.mileage_km,
            price=v.price,
            stock_quantity=v.stock_quantity,
            main_image_url=v.main_image_url,
            description=v.description,
            engine=v.engine,
            horsepower=v.horsepower,
            seats=v.seats,
            drivetrain=v.drivetrain,
            avg_rating=avg_r,
            review_count=rev_count,
            open_restock_requests=int(restock_count),
            availability=_vehicle_availability(v.stock_quantity),
            images=[PublicVehicleImage.model_validate(img) for img in images],
        ))

    return result


@router.get("/vehicles/{vehicle_id}", response_model=PublicVehicleDetail)
async def get_vehicle_detail(vehicle_id: int, db: Session = Depends(get_db)):
    """Full vehicle detail with images, specs, ratings, restock count."""
    vehicle = db.query(Vehicle).filter(
        Vehicle.vehicle_id == vehicle_id,
        Vehicle.is_published == True,
    ).first()

    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    # Images
    images = db.query(VehicleImage).filter(
        VehicleImage.vehicle_id == vehicle_id
    ).order_by(VehicleImage.sort_order).all()

    # Rating
    rating_row = db.query(
        func.avg(Review.rating).label("avg"),
        func.count(Review.review_id).label("cnt"),
    ).filter(
        Review.vehicle_id == vehicle_id,
        Review.is_visible == True,
    ).first()

    avg_r = round(Decimal(str(rating_row.avg or 0)), 2)
    rev_count = int(rating_row.cnt or 0)

    # Restock requests
    restock_count = db.query(func.count(RestockRequest.request_id)).filter(
        RestockRequest.vehicle_id == vehicle_id,
        RestockRequest.status == "Open",
    ).scalar() or 0

    return PublicVehicleDetail(
        vehicle_id=vehicle.vehicle_id,
        make=vehicle.make,
        model=vehicle.model,
        year=vehicle.year,
        color=vehicle.color,
        fuel_type=vehicle.fuel_type,
        transmission=vehicle.transmission,
        body_type=vehicle.body_type,
        condition_type=vehicle.condition_type,
        mileage_km=vehicle.mileage_km,
        price=vehicle.price,
        stock_quantity=vehicle.stock_quantity,
        main_image_url=vehicle.main_image_url,
        description=vehicle.description,
        engine=vehicle.engine,
        horsepower=vehicle.horsepower,
        seats=vehicle.seats,
        drivetrain=vehicle.drivetrain,
        avg_rating=avg_r,
        review_count=rev_count,
        open_restock_requests=int(restock_count),
        availability=_vehicle_availability(vehicle.stock_quantity),
        images=[PublicVehicleImage.model_validate(img) for img in images],
    )


@router.get("/vehicles/{vehicle_id}/reviews", response_model=ReviewListResponse)
async def get_vehicle_reviews(
    vehicle_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
):
    """Visible reviews for a vehicle, with verified flag and customer display name."""
    # Verify vehicle exists and is published
    vehicle = db.query(Vehicle).filter(
        Vehicle.vehicle_id == vehicle_id,
        Vehicle.is_published == True,
    ).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    # Total + average for this vehicle
    stats = db.query(
        func.count(Review.review_id).label("cnt"),
        func.avg(Review.rating).label("avg"),
    ).filter(
        Review.vehicle_id == vehicle_id,
        Review.is_visible == True,
    ).first()

    total = int(stats.cnt or 0)
    avg_rating = round(Decimal(str(stats.avg or 0)), 2)

    # Paginated reviews
    reviews = (
        db.query(Review, Customer)
        .join(Customer, Review.customer_id == Customer.customer_id)
        .filter(Review.vehicle_id == vehicle_id, Review.is_visible == True)
        .order_by(Review.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    items = []
    for review, customer in reviews:
        # Verified = customer has a Completed test drive or Completed sale for this vehicle
        has_completed_td = db.query(TestDrive).filter(
            TestDrive.customer_id == customer.customer_id,
            TestDrive.vehicle_id == vehicle_id,
            TestDrive.status == "Completed",
        ).first() is not None

        has_completed_sale = db.query(Sale).filter(
            Sale.customer_id == customer.customer_id,
            Sale.vehicle_id == vehicle_id,
            Sale.status == "Completed",
        ).first() is not None

        items.append(PublicReviewItem(
            review_id=review.review_id,
            rating=review.rating,
            title=review.title,
            body=review.body,
            customer_name=_customer_display_name(customer.full_name),
            is_verified=has_completed_td or has_completed_sale,
            created_at=review.created_at,
        ))

    return ReviewListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        avg_rating=avg_rating,
        review_count=total,
    )


# ── Test Drive Slots ─────────────────────────────────────────────────

@router.get("/test-drive-slots", response_model=TestDriveSlotResponse)
async def get_test_drive_slots(
    vehicle_id: int,
    date: date,
    db: Session = Depends(get_db),
):
    """Available test drive slots for a vehicle on a specific date.

    Slots: hourly 09:00–17:00, Mon–Sat. A slot today must start ≥2 hours from now.
    """
    from app.core.config import settings
    import zoneinfo

    vehicle = db.query(Vehicle).filter(
        Vehicle.vehicle_id == vehicle_id,
        Vehicle.is_published == True,
    ).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    # Validate date range (today to +30 days)
    tz = zoneinfo.ZoneInfo(settings.SHOWROOM_TIMEZONE)
    now_local = datetime.now(tz)
    today_local = now_local.date()

    if date < today_local or date > today_local + timedelta(days=30):
        raise HTTPException(status_code=422, detail="Date must be between today and 30 days from now")

    # Monday=0, Sunday=6 — only Mon-Sat
    if date.weekday() == 6:
        return TestDriveSlotResponse(vehicle_id=vehicle_id, date=date, slots=[])

    # Get existing bookings for this vehicle + date (Requested or Scheduled)
    taken_times = set()
    existing = db.query(TestDrive.scheduled_time).filter(
        TestDrive.vehicle_id == vehicle_id,
        TestDrive.scheduled_date == date,
        TestDrive.status.in_(["Requested", "Scheduled"]),
        TestDrive.scheduled_time.isnot(None),
    ).all()
    for (t,) in existing:
        if t:
            taken_times.add(t.strftime("%H:%M"))

    # Generate hourly slots 09:00–17:00
    slots = []
    for hour in range(9, 18):  # 09:00 to 17:00
        slot_time = f"{hour:02d}:00"
        available = slot_time not in taken_times

        # If today, slot must start ≥2 hours from now
        if date == today_local:
            slot_dt = datetime.combine(date, time(hour, 0))
            slot_dt_tz = slot_dt.replace(tzinfo=tz)
            if slot_dt_tz <= now_local + timedelta(hours=2):
                available = False

        # Vehicle must be in stock for test drives
        if vehicle.stock_quantity <= 0:
            available = False

        slots.append(SlotAvailability(time=slot_time, available=available))

    return TestDriveSlotResponse(vehicle_id=vehicle_id, date=date, slots=slots)


# ── Service Types ────────────────────────────────────────────────────

@router.get("/service-types", response_model=List[PublicServiceType])
async def list_service_types(db: Session = Depends(get_db)):
    """All active service types."""
    types = db.query(ServiceType).filter(
        ServiceType.is_active == True
    ).order_by(ServiceType.name).all()
    return [PublicServiceType.model_validate(t) for t in types]


# ── Technicians ──────────────────────────────────────────────────────

@router.get("/technicians", response_model=List[PublicTechnician])
async def list_technicians(
    specialty: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Bookable technician profiles — name, specialty, bio, photo. NO email."""
    query = (
        db.query(TechnicianProfile, User)
        .join(User, TechnicianProfile.user_id == User.user_id)
        .filter(TechnicianProfile.is_bookable == True, User.is_active == True)
    )
    if specialty:
        query = query.filter(TechnicianProfile.specialty.ilike(specialty))

    results = query.order_by(User.full_name).all()

    return [
        PublicTechnician(
            user_id=profile.user_id,
            full_name=user.full_name,
            specialty=profile.specialty,
            years_experience=profile.years_experience,
            bio=profile.bio,
            photo_url=profile.photo_url,
        )
        for profile, user in results
    ]


@router.get("/technicians/{technician_id}/availability", response_model=TechnicianAvailability)
async def get_technician_availability(
    technician_id: int,
    date: date,
    db: Session = Depends(get_db),
):
    """Available service slots for a technician on a date.

    Slots: hourly 09:00–16:00, Mon–Sat.
    """
    from app.core.config import settings
    import zoneinfo

    # Verify technician exists and is bookable
    profile = db.query(TechnicianProfile).filter(
        TechnicianProfile.user_id == technician_id,
        TechnicianProfile.is_bookable == True,
    ).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Technician not found")

    # Validate date
    tz = zoneinfo.ZoneInfo(settings.SHOWROOM_TIMEZONE)
    now_local = datetime.now(tz)
    today_local = now_local.date()
    tomorrow = today_local + timedelta(days=1)

    if date < tomorrow or date > today_local + timedelta(days=30):
        raise HTTPException(status_code=422, detail="Date must be between tomorrow and 30 days from now")

    if date.weekday() == 6:
        return TechnicianAvailability(technician_id=technician_id, date=date, slots=[])

    # Get existing bookings for this technician on this date (Booked or Confirmed)
    taken_times = set()
    existing = db.query(ServiceBooking.time_slot).filter(
        ServiceBooking.technician_id == technician_id,
        ServiceBooking.booking_date == date,
        ServiceBooking.status.in_(["Booked", "Confirmed"]),
    ).all()
    for (t,) in existing:
        if t:
            taken_times.add(t.strftime("%H:%M"))

    # Hourly slots 09:00–16:00
    slots = []
    for hour in range(9, 17):  # 09:00 to 16:00
        slot_time = f"{hour:02d}:00"
        available = slot_time not in taken_times
        slots.append(SlotAvailability(time=slot_time, available=available))

    return TechnicianAvailability(technician_id=technician_id, date=date, slots=slots)
