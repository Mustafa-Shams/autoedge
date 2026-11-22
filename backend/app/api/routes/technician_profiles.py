"""Manager-only technician profiles and upcoming bookings."""
from datetime import datetime
from decimal import Decimal
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, HttpUrl, model_validator
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_db, require_role
from app.core.config import settings
from app.models.service_booking import ServiceBooking
from app.models.service_type import ServiceType
from app.models.technician_profile import TechnicianProfile
from app.models.user import User

router = APIRouter(prefix="/technician-profiles", tags=["technician-profiles"])
MANAGER = require_role(["manager"])


class TechnicianProfileResponse(BaseModel):
    user_id: int
    full_name: str
    email: str
    phone: str | None = None
    is_active: bool
    specialty: str
    years_experience: int
    bio: str | None = None
    photo_url: str | None = None
    is_bookable: bool
    certifications: str | None = None
    skills: str | None = None
    working_days: str | None = None
    working_hours: str | None = None
    hourly_rate: Decimal | None = None


class TechnicianProfileUpdate(BaseModel):
    full_name: str | None = Field(None, min_length=1, max_length=100)
    phone: str | None = Field(None, max_length=20)
    specialty: str | None = Field(None, min_length=1, max_length=30)
    years_experience: int | None = Field(None, ge=0, le=80)
    bio: str | None = Field(None, max_length=3000)
    photo_url: HttpUrl | None = None
    is_bookable: bool | None = None
    certifications: str | None = Field(None, max_length=1000)
    skills: str | None = Field(None, max_length=1000)
    working_days: str | None = Field(None, max_length=50)
    working_hours: str | None = Field(None, max_length=30)
    hourly_rate: Decimal | None = Field(None, ge=0, max_digits=10, decimal_places=2)

    @model_validator(mode="after")
    def required_values_are_not_null(self):
        for key in ("full_name", "specialty", "years_experience", "is_bookable"):
            if key in self.model_fields_set and getattr(self, key) is None:
                raise ValueError(f"{key} cannot be empty")
        return self


def _profiles(db: Session):
    return (
        db.query(TechnicianProfile).join(TechnicianProfile.user)
        .options(joinedload(TechnicianProfile.user))
        .filter(User.role == "technician")
    )


def _response(profile: TechnicianProfile) -> TechnicianProfileResponse:
    return TechnicianProfileResponse(
        user_id=profile.user_id, full_name=profile.user.full_name,
        email=profile.user.email, phone=profile.user.phone, is_active=profile.user.is_active,
        specialty=profile.specialty, years_experience=profile.years_experience,
        bio=profile.bio, photo_url=profile.photo_url, is_bookable=profile.is_bookable,
        certifications=profile.certifications, skills=profile.skills,
        working_days=profile.working_days, working_hours=profile.working_hours,
        hourly_rate=profile.hourly_rate,
    )


@router.get("", response_model=list[TechnicianProfileResponse])
def list_technician_profiles(db: Session = Depends(get_db), _=Depends(MANAGER)):
    return [_response(profile) for profile in _profiles(db).order_by(User.full_name)]


def _get_profile(db: Session, user_id: int) -> TechnicianProfile:
    profile = _profiles(db).filter(TechnicianProfile.user_id == user_id).first()
    if profile is None:
        raise HTTPException(status_code=404, detail="Technician profile not found")
    return profile


@router.get("/{user_id}")
def get_technician_profile(user_id: int, db: Session = Depends(get_db), _=Depends(MANAGER)):
    profile = _get_profile(db, user_id)
    now = datetime.now(ZoneInfo(settings.SHOWROOM_TIMEZONE))
    local_time = now.time().replace(tzinfo=None)
    bookings = (
        db.query(ServiceBooking.booking_id, ServiceBooking.booking_date, ServiceBooking.time_slot,
                 ServiceBooking.status, ServiceType.name.label("service_type"))
        .join(ServiceType, ServiceType.service_type_id == ServiceBooking.service_type_id)
        .filter(
            ServiceBooking.technician_id == user_id,
            ServiceBooking.status.in_(("Booked", "Confirmed")),
            (ServiceBooking.booking_date > now.date())
            | ((ServiceBooking.booking_date == now.date()) & (ServiceBooking.time_slot >= local_time)),
        )
        .order_by(ServiceBooking.booking_date, ServiceBooking.time_slot)
    )
    return {
        **_response(profile).model_dump(mode="json"),
        "upcoming_bookings": [row._asdict() for row in bookings],
    }


@router.put("/{user_id}", response_model=TechnicianProfileResponse)
def update_technician_profile(
    user_id: int, body: TechnicianProfileUpdate, db: Session = Depends(get_db), _=Depends(MANAGER),
):
    profile = _get_profile(db, user_id)
    data = body.model_dump(exclude_unset=True, mode="json")
    for field in ("full_name", "phone"):
        if field in data:
            setattr(profile.user, field, data.pop(field))
    for field, value in data.items():
        setattr(profile, field, value)
    db.commit()
    return _response(profile)
