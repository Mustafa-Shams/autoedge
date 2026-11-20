"""Staff review routes per spec 7.6 + 10.4.

GET  /reviews                    — list all reviews [manager]
PUT  /reviews/{id}/visibility    — toggle is_visible [manager]
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload
from typing import Optional

from app.api.deps import get_db, require_role
from app.models.review import Review
from app.models.customer import Customer
from app.models.vehicle import Vehicle

router = APIRouter(tags=["staff-reviews"])

MANAGER = require_role(["manager"])


# ── Schemas ──────────────────────────────────────────────────────────


class VisibilityUpdate(BaseModel):
    is_visible: bool


class StaffReviewItem(BaseModel):
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
    customer_name: str | None = None
    customer_email: str | None = None


# ── Helpers ──────────────────────────────────────────────────────────


def _to_staff_response(r: Review, customer: Customer = None) -> dict:
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
        "customer_name": customer.full_name if customer else None,
        "customer_email": customer.email if customer else None,
    }


# ── Routes ───────────────────────────────────────────────────────────


@router.get("/reviews")
async def list_all_reviews(
    is_visible: Optional[bool] = Query(None),
    vehicle_id: Optional[int] = Query(None),
    rating: Optional[int] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user=Depends(MANAGER),
):
    """List all reviews with filters — manager only."""
    query = (
        db.query(Review, Customer)
        .join(Customer, Review.customer_id == Customer.customer_id)
        .options(joinedload(Review.vehicle))
    )

    if is_visible is not None:
        query = query.filter(Review.is_visible == is_visible)
    if vehicle_id is not None:
        query = query.filter(Review.vehicle_id == vehicle_id)
    if rating is not None:
        query = query.filter(Review.rating == rating)

    total = query.count()
    results = (
        query.order_by(Review.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    items = [_to_staff_response(review, customer) for review, customer in results]

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.put("/reviews/{review_id}/visibility")
async def update_review_visibility(
    review_id: int,
    body: VisibilityUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(MANAGER),
):
    """Toggle review visibility — manager only."""
    review = (
        db.query(Review)
        .options(joinedload(Review.vehicle))
        .filter(Review.review_id == review_id)
        .first()
    )
    if not review:
        raise HTTPException(status_code=404, detail="Review not found.")

    review.is_visible = body.is_visible
    db.commit()
    db.refresh(review)

    customer = db.query(Customer).filter(Customer.customer_id == review.customer_id).first()

    return _to_staff_response(review, customer)
