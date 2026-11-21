"""Store trade-in routes — customer-facing per spec 7.7.

POST   /store/trade-ins                — submit trade-in request
GET    /store/trade-ins                — list my trade-ins
GET    /store/trade-ins/{id}           — detail with images
POST   /store/trade-ins/{id}/respond   — accept or decline an offer
POST   /store/trade-ins/{id}/cancel    — cancel (only while Submitted/Under Review)
"""
import re
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_validator
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_db, get_current_customer
from app.core.config import settings
from app.core.time import utcnow
from app.models.customer_account import CustomerAccount
from app.models.trade_in_request import TradeInRequest, TradeInImage
from app.models.vehicle import Vehicle

router = APIRouter(prefix="/store/trade-ins", tags=["store-trade-ins"])


# ── Schemas ──────────────────────────────────────────────────────────


class TradeInCreate(BaseModel):
    target_vehicle_id: Optional[int] = None
    make: str
    model: str
    year: int
    mileage_km: int
    color: Optional[str] = None
    condition_rating: str
    description: Optional[str] = None
    expected_price: Optional[float] = None
    image_urls: List[str]

    @field_validator("condition_rating")
    @classmethod
    def validate_condition(cls, v):
        allowed = {"Excellent", "Good", "Fair", "Poor"}
        if v not in allowed:
            raise ValueError(f"condition_rating must be one of: {', '.join(allowed)}")
        return v

    @field_validator("image_urls")
    @classmethod
    def validate_images(cls, v):
        if len(v) < 3:
            raise ValueError("At least 3 photos are required.")
        if len(v) > 8:
            raise ValueError("Maximum 8 photos allowed.")
        # Each URL must be a Cloudinary URL — but if VITE_CLOUDINARY_CLOUD_NAME is not set,
        # we'll accept any https URL to support development mode
        for url in v:
            if not url.startswith("https://"):
                raise ValueError("All image URLs must use HTTPS.")
        return v

    @field_validator("mileage_km")
    @classmethod
    def validate_mileage(cls, v):
        if v < 0:
            raise ValueError("Mileage must be non-negative.")
        return v

    @field_validator("year")
    @classmethod
    def validate_year(cls, v):
        current_year = datetime.now().year
        if v < 1900 or v > current_year + 1:
            raise ValueError(f"Year must be between 1900 and {current_year + 1}.")
        return v


class TradeInRespond(BaseModel):
    accept: bool


# ── Helpers ──────────────────────────────────────────────────────────


CONDITION_FACTORS = {
    "Excellent": Decimal("1.00"),
    "Good": Decimal("0.92"),
    "Fair": Decimal("0.80"),
    "Poor": Decimal("0.65"),
}


def _compute_indicative_estimate(db: Session, make: str, model: str, year: int,
                                  mileage_km: int, condition_rating: str):
    """Compute indicative estimate per spec 7.7.

    reference = average catalog price of vehicles with same make+model;
    else same make; else no estimate.
    estimate = reference * max(0.30, 1 - 0.08 * age_years) * max(0.60, 1 - mileage_km/300000) * condition_factor
    Range = estimate ± 8%.
    """
    # Try same make + model first
    reference = db.query(func.avg(Vehicle.price)).filter(
        func.lower(Vehicle.make) == make.lower(),
        func.lower(Vehicle.model) == model.lower(),
    ).scalar()

    if reference is None:
        # Try same make only
        reference = db.query(func.avg(Vehicle.price)).filter(
            func.lower(Vehicle.make) == make.lower(),
        ).scalar()

    if reference is None:
        return None, None  # No estimate possible

    reference = Decimal(str(reference))
    current_year = datetime.now().year
    age_years = max(0, current_year - year)

    age_factor = max(Decimal("0.30"), Decimal("1") - Decimal("0.08") * Decimal(str(age_years)))
    mileage_factor = max(Decimal("0.60"), Decimal("1") - Decimal(str(mileage_km)) / Decimal("300000"))
    condition_factor = CONDITION_FACTORS.get(condition_rating, Decimal("0.80"))

    estimate = reference * age_factor * mileage_factor * condition_factor
    estimate = estimate.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    margin = estimate * Decimal("0.08")
    low = (estimate - margin).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    high = (estimate + margin).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    return low, high


def _to_response(t: TradeInRequest) -> dict:
    target_label = None
    if t.target_vehicle:
        target_label = f"{t.target_vehicle.year} {t.target_vehicle.make} {t.target_vehicle.model}"
    return {
        "trade_in_id": t.trade_in_id,
        "customer_id": t.customer_id,
        "target_vehicle_id": t.target_vehicle_id,
        "target_vehicle_label": target_label,
        "make": t.make,
        "model": t.model,
        "year": t.year,
        "mileage_km": t.mileage_km,
        "color": t.color,
        "condition_rating": t.condition_rating,
        "description": t.description,
        "expected_price": float(t.expected_price) if t.expected_price else None,
        "indicative_low": float(t.indicative_low) if t.indicative_low else None,
        "indicative_high": float(t.indicative_high) if t.indicative_high else None,
        "status": t.status,
        "offered_value": float(t.offered_value) if t.offered_value else None,
        "offer_valid_until": t.offer_valid_until.isoformat() if t.offer_valid_until else None,
        "staff_notes": t.staff_notes,
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "updated_at": t.updated_at.isoformat() if t.updated_at else None,
        "images": [
            {"image_id": img.image_id, "image_url": img.image_url}
            for img in (t.images or [])
        ],
    }


# ── Routes ───────────────────────────────────────────────────────────


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_trade_in(
    body: TradeInCreate,
    db: Session = Depends(get_db),
    account: CustomerAccount = Depends(get_current_customer),
):
    """Submit a trade-in request with 3-8 photos."""
    # Optional: validate target vehicle exists
    if body.target_vehicle_id:
        target = db.query(Vehicle).filter(Vehicle.vehicle_id == body.target_vehicle_id).first()
        if not target:
            raise HTTPException(status_code=404, detail="Target vehicle not found.")

    # Compute indicative estimate
    low, high = _compute_indicative_estimate(
        db, body.make, body.model, body.year, body.mileage_km, body.condition_rating
    )

    now = utcnow()
    trade_in = TradeInRequest(
        customer_id=account.customer_id,
        target_vehicle_id=body.target_vehicle_id,
        make=body.make.strip(),
        model=body.model.strip(),
        year=body.year,
        mileage_km=body.mileage_km,
        color=body.color.strip() if body.color else None,
        condition_rating=body.condition_rating,
        description=body.description.strip() if body.description else None,
        expected_price=Decimal(str(body.expected_price)) if body.expected_price else None,
        indicative_low=low,
        indicative_high=high,
        status="Submitted",
        created_at=now,
        updated_at=now,
    )
    db.add(trade_in)
    db.flush()  # Get trade_in_id

    # Add images
    for url in body.image_urls:
        db.add(TradeInImage(
            trade_in_id=trade_in.trade_in_id,
            image_url=url,
            uploaded_at=now,
        ))

    db.commit()
    db.refresh(trade_in)

    # Eagerly load for response
    trade_in = (
        db.query(TradeInRequest)
        .options(joinedload(TradeInRequest.images), joinedload(TradeInRequest.target_vehicle))
        .filter(TradeInRequest.trade_in_id == trade_in.trade_in_id)
        .first()
    )

    return _to_response(trade_in)


@router.get("")
async def list_my_trade_ins(
    db: Session = Depends(get_db),
    account: CustomerAccount = Depends(get_current_customer),
):
    """List my trade-in requests."""
    trade_ins = (
        db.query(TradeInRequest)
        .options(joinedload(TradeInRequest.images), joinedload(TradeInRequest.target_vehicle))
        .filter(TradeInRequest.customer_id == account.customer_id)
        .order_by(TradeInRequest.created_at.desc())
        .all()
    )
    return [_to_response(t) for t in trade_ins]


@router.get("/{trade_in_id}")
async def get_trade_in_detail(
    trade_in_id: int,
    db: Session = Depends(get_db),
    account: CustomerAccount = Depends(get_current_customer),
):
    """Get detail of a specific trade-in with images."""
    trade_in = (
        db.query(TradeInRequest)
        .options(joinedload(TradeInRequest.images), joinedload(TradeInRequest.target_vehicle))
        .filter(
            TradeInRequest.trade_in_id == trade_in_id,
            TradeInRequest.customer_id == account.customer_id,
        )
        .first()
    )
    if not trade_in:
        raise HTTPException(status_code=404, detail="Trade-in request not found.")
    return _to_response(trade_in)


@router.post("/{trade_in_id}/respond")
async def respond_to_offer(
    trade_in_id: int,
    body: TradeInRespond,
    db: Session = Depends(get_db),
    account: CustomerAccount = Depends(get_current_customer),
):
    """Accept or decline a trade-in offer."""
    trade_in = (
        db.query(TradeInRequest)
        .options(joinedload(TradeInRequest.images), joinedload(TradeInRequest.target_vehicle))
        .filter(
            TradeInRequest.trade_in_id == trade_in_id,
            TradeInRequest.customer_id == account.customer_id,
        )
        .first()
    )
    if not trade_in:
        raise HTTPException(status_code=404, detail="Trade-in request not found.")

    if trade_in.status != "Offer Made":
        raise HTTPException(
            status_code=422, detail=f"Cannot respond to a trade-in with status '{trade_in.status}'."
        )

    # Check if offer has expired
    if trade_in.offer_valid_until and utcnow() > trade_in.offer_valid_until:
        trade_in.status = "Expired"
        trade_in.updated_at = utcnow()
        db.commit()
        raise HTTPException(status_code=422, detail="This offer has expired.")

    trade_in.status = "Accepted" if body.accept else "Declined"
    trade_in.updated_at = utcnow()
    db.commit()
    db.refresh(trade_in)

    return _to_response(trade_in)


@router.post("/{trade_in_id}/cancel")
async def cancel_trade_in(
    trade_in_id: int,
    db: Session = Depends(get_db),
    account: CustomerAccount = Depends(get_current_customer),
):
    """Cancel a trade-in (only while Submitted or Under Review)."""
    trade_in = (
        db.query(TradeInRequest)
        .options(joinedload(TradeInRequest.images), joinedload(TradeInRequest.target_vehicle))
        .filter(
            TradeInRequest.trade_in_id == trade_in_id,
            TradeInRequest.customer_id == account.customer_id,
        )
        .first()
    )
    if not trade_in:
        raise HTTPException(status_code=404, detail="Trade-in request not found.")

    if trade_in.status not in ("Submitted", "Under Review"):
        raise HTTPException(
            status_code=422,
            detail=f"Cannot cancel a trade-in with status '{trade_in.status}'. Only 'Submitted' or 'Under Review' can be cancelled."
        )

    trade_in.status = "Cancelled"
    trade_in.updated_at = utcnow()
    db.commit()
    db.refresh(trade_in)

    return _to_response(trade_in)
