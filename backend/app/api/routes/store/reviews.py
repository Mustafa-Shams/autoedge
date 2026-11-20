"""Store review routes — customer-facing per spec 7.6.

POST   /store/reviews              — create review (one per customer per vehicle, rating 1-5, body min 10 chars)
GET    /store/reviews              — list my reviews
PUT    /store/reviews/{id}         — update my review
DELETE /store/reviews/{id}         — delete my review
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session, joinedload
from typing import Optional

from app.api.deps import get_db, get_current_customer
from app.core.time import utcnow
from app.models.customer_account import CustomerAccount
from app.models.review import Review
from app.models.vehicle import Vehicle

router = APIRouter(prefix="/store/reviews", tags=["store-reviews"])


# ── Schemas ──────────────────────────────────────────────────────────


class ReviewCreate(BaseModel):
    vehicle_id: int
    rating: int
    title: Optional[str] = None
    body: str

    @field_validator("rating")
    @classmethod
    def validate_rating(cls, v):
        if v < 1 or v > 5:
            raise ValueError("Rating must be between 1 and 5.")
        return v

    @field_validator("body")
    @classmethod
    def validate_body(cls, v):
        if len(v.strip()) < 10:
            raise ValueError("Review body must be at least 10 characters.")
        return v.strip()

    @field_validator("title")
    @classmethod
    def validate_title(cls, v):
        if v is not None:
            v = v.strip()
            if len(v) > 120:
                raise ValueError("Title must be 120 characters or less.")
            return v if v else None
        return v


class ReviewUpdate(BaseModel):
    rating: Optional[int] = None
    title: Optional[str] = None
    body: Optional[str] = None

    @field_validator("rating")
    @classmethod
    def validate_rating(cls, v):
        if v is not None and (v < 1 or v > 5):
            raise ValueError("Rating must be between 1 and 5.")
        return v

    @field_validator("body")
    @classmethod
    def validate_body(cls, v):
        if v is not None and len(v.strip()) < 10:
            raise ValueError("Review body must be at least 10 characters.")
        return v.strip() if v else v

    @field_validator("title")
    @classmethod
    def validate_title(cls, v):
        if v is not None:
            v = v.strip()
            if len(v) > 120:
                raise ValueError("Title must be 120 characters or less.")
            return v if v else None
        return v


class ReviewResponse(BaseModel):
    review_id: int
    vehicle_id: int
    customer_id: int
    rating: int
    title: Optional[str] = None
    body: str
    is_visible: bool
    created_at: str | None = None
    updated_at: str | None = None
    vehicle_label: str | None = None


# ── Helpers ──────────────────────────────────────────────────────────


def _to_response(r: Review) -> dict:
    vehicle_label = None
    if r.vehicle:
        vehicle_label = f"{r.vehicle.year} {r.vehicle.make} {r.vehicle.model}"
    return {
        "review_id": r.review_id,
        "vehicle_id": r.vehicle_id,
        "customer_id": r.customer_id,
        "rating": r.rating,
        "title": r.title,
        "body": r.body,
        "is_visible": r.is_visible,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "updated_at": r.updated_at.isoformat() if r.updated_at else None,
        "vehicle_label": vehicle_label,
    }


# ── Routes ───────────────────────────────────────────────────────────


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_review(
    body: ReviewCreate,
    db: Session = Depends(get_db),
    account: CustomerAccount = Depends(get_current_customer),
):
    """Create a review for a vehicle. One per customer per vehicle (unique constraint)."""
    # Vehicle must exist
    vehicle = db.query(Vehicle).filter(Vehicle.vehicle_id == body.vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found.")

    # Check for existing review (unique constraint uq_review_one_per_customer_vehicle)
    existing = (
        db.query(Review)
        .filter(
            Review.customer_id == account.customer_id,
            Review.vehicle_id == body.vehicle_id,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=409, detail="You have already reviewed this vehicle."
        )

    now = utcnow()
    review = Review(
        vehicle_id=body.vehicle_id,
        customer_id=account.customer_id,
        rating=body.rating,
        title=body.title,
        body=body.body,
        is_visible=True,
        created_at=now,
        updated_at=now,
    )
    db.add(review)
    db.commit()
    db.refresh(review)

    # Eagerly load vehicle for response
    review.vehicle = vehicle

    return _to_response(review)


@router.get("/")
async def list_my_reviews(
    db: Session = Depends(get_db),
    account: CustomerAccount = Depends(get_current_customer),
):
    """List all reviews by the current customer."""
    reviews = (
        db.query(Review)
        .options(joinedload(Review.vehicle))
        .filter(Review.customer_id == account.customer_id)
        .order_by(Review.created_at.desc())
        .all()
    )
    return [_to_response(r) for r in reviews]


@router.put("/{review_id}")
async def update_review(
    review_id: int,
    body: ReviewUpdate,
    db: Session = Depends(get_db),
    account: CustomerAccount = Depends(get_current_customer),
):
    """Update own review."""
    review = (
        db.query(Review)
        .options(joinedload(Review.vehicle))
        .filter(
            Review.review_id == review_id,
            Review.customer_id == account.customer_id,
        )
        .first()
    )
    if not review:
        raise HTTPException(status_code=404, detail="Review not found.")

    if body.rating is not None:
        review.rating = body.rating
    if body.title is not None:
        review.title = body.title
    if body.body is not None:
        review.body = body.body
    review.updated_at = utcnow()

    db.commit()
    db.refresh(review)

    return _to_response(review)


@router.delete("/{review_id}", status_code=status.HTTP_200_OK)
async def delete_review(
    review_id: int,
    db: Session = Depends(get_db),
    account: CustomerAccount = Depends(get_current_customer),
):
    """Delete own review."""
    review = (
        db.query(Review)
        .filter(
            Review.review_id == review_id,
            Review.customer_id == account.customer_id,
        )
        .first()
    )
    if not review:
        raise HTTPException(status_code=404, detail="Review not found.")

    db.delete(review)
    db.commit()

    return {"status": "deleted", "review_id": review_id}
