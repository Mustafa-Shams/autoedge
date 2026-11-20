"""Staff service booking routes — spec sections 7.8, 9.1.

GET  /service-bookings              — List all (manager, receptionist, technician own)
GET  /service-bookings/{id}         — Detail
POST /service-bookings/{id}/confirm — Assign technician, create job, status → Confirmed
"""
from datetime import date
from decimal import Decimal
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user, require_role
from app.models.user import User
from app.models.customer import Customer
from app.models.customer_vehicle import CustomerVehicle
from app.models.service_booking import ServiceBooking
from app.models.service_type import ServiceType
from app.models.technician_profile import TechnicianProfile
from app.services.service_booking_service import (
    confirm_booking,
    ServiceBookingError,
)

router = APIRouter(prefix="/service-bookings", tags=["staff-service-bookings"])

ALLOWED = require_role(["manager", "receptionist", "technician"])
CONFIRM_ROLE = require_role(["manager", "receptionist"])


# ── Schemas ──────────────────────────────────────────────────────────

class ConfirmBookingRequest(BaseModel):
    technician_id: int


# ── Routes ───────────────────────────────────────────────────────────

def _serialize_booking(booking: ServiceBooking, db: Session) -> dict:
    """Serialize a booking with joined info for staff view."""
    # Customer
    customer = db.query(Customer).filter(
        Customer.customer_id == booking.customer_id
    ).first()

    # Customer vehicle
    cv = db.query(CustomerVehicle).filter(
        CustomerVehicle.cv_id == booking.cv_id
    ).first()

    # Service type
    st = db.query(ServiceType).filter(
        ServiceType.service_type_id == booking.service_type_id
    ).first()

    # Technician
    tech_name = None
    if booking.technician_id:
        tech = db.query(User).filter(User.user_id == booking.technician_id).first()
        tech_name = tech.full_name if tech else None

    return {
        "booking_id": booking.booking_id,
        "customer_id": booking.customer_id,
        "customer_name": customer.full_name if customer else "Unknown",
        "customer_email": customer.email if customer else None,
        "customer_phone": customer.phone if customer else None,
        "cv_id": booking.cv_id,
        "vehicle_label": f"{cv.year} {cv.make} {cv.model}" if cv else "Unknown",
        "vehicle_color": cv.color if cv else None,
        "vehicle_plate": cv.plate_number if cv else None,
        "service_type_id": booking.service_type_id,
        "service_type_name": st.name if st else "Unknown",
        "required_specialty": st.required_specialty if st else None,
        "technician_id": booking.technician_id,
        "technician_name": tech_name,
        "booking_date": booking.booking_date.isoformat() if booking.booking_date else None,
        "time_slot": booking.time_slot.strftime("%H:%M") if booking.time_slot else None,
        "notes": booking.notes,
        "fee_amount": str(booking.fee_amount),
        "status": booking.status,
        "service_job_id": booking.service_job_id,
        "created_at": booking.created_at.isoformat() if booking.created_at else None,
        "updated_at": booking.updated_at.isoformat() if booking.updated_at else None,
    }


@router.get("")
async def list_service_bookings(
    status_filter: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
    current_user: User = Depends(ALLOWED),
    db: Session = Depends(get_db),
):
    """List all service bookings.

    Manager and receptionist see all.
    Technicians see only bookings assigned to them.
    """
    page_size = min(page_size, 50)
    if page < 1:
        page = 1

    q = db.query(ServiceBooking)

    # Technicians only see their own
    if current_user.role == "technician":
        q = q.filter(ServiceBooking.technician_id == current_user.user_id)

    if status_filter:
        q = q.filter(ServiceBooking.status == status_filter)

    total = q.count()
    bookings = (
        q.order_by(ServiceBooking.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return {
        "items": [_serialize_booking(b, db) for b in bookings],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/{booking_id}")
async def get_service_booking(
    booking_id: int,
    current_user: User = Depends(ALLOWED),
    db: Session = Depends(get_db),
):
    """Get a single service booking detail."""
    booking = db.query(ServiceBooking).filter(
        ServiceBooking.booking_id == booking_id
    ).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    # Technicians only see their own
    if current_user.role == "technician" and booking.technician_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    return _serialize_booking(booking, db)


@router.post("/{booking_id}/confirm")
async def confirm_service_booking(
    booking_id: int,
    req: ConfirmBookingRequest,
    current_user: User = Depends(CONFIRM_ROLE),
    db: Session = Depends(get_db),
):
    """Confirm a booking — assign technician, create service job.

    Per spec 7.8 step 5:
    - Assigns technician (staff picks from available)
    - Creates service_jobs row
    - Links service_job_id in booking
    - Status → Confirmed
    """
    try:
        booking = confirm_booking(db, booking_id, req.technician_id)
        db.commit()
        db.refresh(booking)
        return _serialize_booking(booking, db)

    except ServiceBookingError as e:
        db.rollback()
        raise HTTPException(status_code=e.status_code, detail=e.message)
