"""Staff technician profile management routes — spec 10.4 / 11.5.

GET  /technician-profiles            — List all technician profiles [manager]
PUT  /technician-profiles/{user_id}  — Update a technician profile [manager]
"""
from typing import Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_role
from app.models.technician_profile import TechnicianProfile
from app.models.user import User

router = APIRouter(prefix="/technician-profiles", tags=["technician-profiles"])

MANAGER_ONLY = require_role(["manager"])


class TechnicianProfileResponse(BaseModel):
    user_id: int
    full_name: str
    email: str
    specialty: str
    years_experience: int
    bio: Optional[str] = None
    photo_url: Optional[str] = None
    is_bookable: bool = True


class TechnicianProfileUpdate(BaseModel):
    specialty: Optional[str] = None
    years_experience: Optional[int] = None
    bio: Optional[str] = None
    photo_url: Optional[str] = None
    is_bookable: Optional[bool] = None


@router.get("", response_model=list[TechnicianProfileResponse])
async def list_technician_profiles(
    db: Session = Depends(get_db),
    _=Depends(MANAGER_ONLY),
):
    """List all technician profiles with user info."""
    profiles = db.query(TechnicianProfile).all()
    result = []
    for p in profiles:
        user = db.query(User).filter(User.user_id == p.user_id).first()
        result.append(TechnicianProfileResponse(
            user_id=p.user_id,
            full_name=user.full_name if user else "Unknown",
            email=user.email if user else "",
            specialty=p.specialty,
            years_experience=p.years_experience,
            bio=p.bio,
            photo_url=p.photo_url,
            is_bookable=p.is_bookable,
        ))
    return result


@router.put("/{user_id}", response_model=TechnicianProfileResponse)
async def update_technician_profile(
    user_id: int,
    body: TechnicianProfileUpdate,
    db: Session = Depends(get_db),
    _=Depends(MANAGER_ONLY),
):
    """Update a technician profile."""
    profile = db.query(TechnicianProfile).filter(
        TechnicianProfile.user_id == user_id
    ).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Technician profile not found")

    data = body.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(profile, field, value)
    db.commit()
    db.refresh(profile)

    user = db.query(User).filter(User.user_id == user_id).first()
    return TechnicianProfileResponse(
        user_id=profile.user_id,
        full_name=user.full_name if user else "Unknown",
        email=user.email if user else "",
        specialty=profile.specialty,
        years_experience=profile.years_experience,
        bio=profile.bio,
        photo_url=profile.photo_url,
        is_bookable=profile.is_bookable,
    )
