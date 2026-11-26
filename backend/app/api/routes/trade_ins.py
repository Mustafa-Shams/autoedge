"""Staff trade-in routes per spec 7.7 + 10.4.

GET  /trade-ins              — list all trade-ins with filters [manager, sales_executive]
GET  /trade-ins/{id}         — detail with images
PUT  /trade-ins/{id}         — update status/offered_value/staff_notes [manager, sales_executive]
"""
from datetime import timedelta, timezone
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_db, require_role
from app.core.config import settings
from app.core.time import utcnow
from sqlalchemy.exc import IntegrityError
from app.services.trade_acquisition import AcquisitionPayment, ScheduleInspection, InspectionTerms, Intake, Publish, apply_staff_action, draft_details
from app.models.trade_in_request import TradeInRequest, TradeInImage
from app.models.customer import Customer
from app.models.vehicle import Vehicle
from app.services.notify_service import notify

router = APIRouter(tags=["staff-trade-ins"])

MANAGER_SALES = require_role(["manager", "sales_executive"])


# ── Schemas ──────────────────────────────────────────────────────────


class TradeInUpdate(BaseModel):
    status: Optional[str] = None
    offered_value: Optional[float] = None
    staff_notes: Optional[str] = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, v):
        if v is not None:
            allowed = {"Under Review", "Offer Made"}
            if v not in allowed:
                raise ValueError(f"Staff can set status to: {', '.join(allowed)}")
        return v

    @field_validator("offered_value")
    @classmethod
    def validate_offered_value(cls, v):
        if v is not None and v <= 0:
            raise ValueError("Offered value must be positive.")
        return v


# ── Helpers ──────────────────────────────────────────────────────────


def _to_staff_response(t: TradeInRequest, customer: Customer = None) -> dict:
    target_label = None
    if t.target_vehicle:
        target_label = f"{t.target_vehicle.year} {t.target_vehicle.make} {t.target_vehicle.model}"
    return {
        "acquisition": draft_details(t, staff=True),
        "trade_in_id": t.trade_in_id,
        "deal_id": t.deal_id,
        "customer_id": t.customer_id,
        "customer_name": customer.full_name if customer else None,
        "customer_email": customer.email if customer else None,
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
        "offer_valid_until": t.offer_valid_until.replace(tzinfo=timezone.utc).isoformat() if t.offer_valid_until else None,
        "staff_notes": t.staff_notes,
        "appraised_by": t.appraised_by,
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "updated_at": t.updated_at.isoformat() if t.updated_at else None,
        "images": [
            {"image_id": img.image_id, "image_url": img.image_url}
            for img in (t.images or [])
        ],
    }


# ── Routes ───────────────────────────────────────────────────────────


@router.get("/trade-ins")
async def list_trade_ins(
    status_filter: Optional[str] = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user=Depends(MANAGER_SALES),
):
    """List all trade-in requests with optional status filter."""
    query = (
        db.query(TradeInRequest, Customer)
        .join(Customer, TradeInRequest.customer_id == Customer.customer_id)
        .options(joinedload(TradeInRequest.images), joinedload(TradeInRequest.target_vehicle))
    )

    if status_filter:
        query = query.filter(TradeInRequest.status == status_filter)

    total = query.count()
    results = (
        query.order_by(TradeInRequest.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    items = [_to_staff_response(ti, customer) for ti, customer in results]

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/trade-ins/{trade_in_id}")
async def get_trade_in_detail(
    trade_in_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(MANAGER_SALES),
):
    """Get trade-in detail with images."""
    trade_in = (
        db.query(TradeInRequest)
        .options(joinedload(TradeInRequest.images), joinedload(TradeInRequest.target_vehicle))
        .filter(TradeInRequest.trade_in_id == trade_in_id)
        .first()
    )
    if not trade_in:
        raise HTTPException(status_code=404, detail="Trade-in request not found.")

    customer = db.query(Customer).filter(Customer.customer_id == trade_in.customer_id).first()
    return _to_staff_response(trade_in, customer)


@router.post("/trade-ins/{trade_in_id}/acquisition")
def process_acquisition(trade_in_id: int, body: ScheduleInspection | InspectionTerms | Intake | Publish | AcquisitionPayment,
                        user=Depends(MANAGER_SALES), db: Session = Depends(get_db)):
    trade = db.query(TradeInRequest).filter_by(trade_in_id=trade_in_id).with_for_update().one_or_none()
    if not trade:
        raise HTTPException(404, "Trade-in not found")
    if isinstance(body, Publish) and user.access.get("vehicles") != "full":
        raise HTTPException(403, "Publishing requires inventory editing access")
    if isinstance(body, AcquisitionPayment) and user.role != "manager":
        raise HTTPException(403, "Manager approval required")
    try:
        apply_staff_action(db, trade, user, body)
        db.commit()
        return _to_staff_response(trade, trade.customer)
    except ValueError as exc:
        db.rollback()
        raise HTTPException(409, str(exc)) from exc
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(409, "This VIN or acquisition already belongs to another stock unit") from exc


@router.put("/trade-ins/{trade_in_id}")
async def update_trade_in(
    trade_in_id: int,
    body: TradeInUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(MANAGER_SALES),
):
    """Update trade-in: set Under Review, or make Offer (sets offered_value + offer_valid_until)."""
    trade_in = (
        db.query(TradeInRequest)
        .filter(TradeInRequest.trade_in_id == trade_in_id).with_for_update().first()
    )
    if not trade_in:
        raise HTTPException(status_code=404, detail="Trade-in request not found.")
    if body.status and trade_in.status not in {"Submitted", "Under Review", "Offer Made"}:
        raise HTTPException(409, "This offer has already been resolved")

    now = utcnow()

    if body.status == "Offer Made":
        # Must provide offered_value when making an offer
        if not body.offered_value:
            raise HTTPException(
                status_code=422, detail="offered_value is required when setting status to 'Offer Made'."
            )
        trade_in.offered_value = Decimal(str(body.offered_value))
        trade_in.offer_valid_until = now + timedelta(days=settings.TRADE_IN_OFFER_VALID_DAYS)
        trade_in.appraised_by = current_user.user_id
        trade_in.status = "Offer Made"

        # Notify customer about the offer
        vehicle_label = "your vehicle"
        if trade_in.target_vehicle:
            v = trade_in.target_vehicle
            vehicle_label = f"{v.year} {v.make} {v.model}"
        notify(
            db,
            customer_id=trade_in.customer_id,
            notification_type="trade_in_offer",
            title=f"Trade-In Offer — {vehicle_label}",
            message=f"We've reviewed your trade-in and are offering ${trade_in.offered_value:,.2f}. "
                    f"The offer is valid for {settings.TRADE_IN_OFFER_VALID_DAYS} days.",
            link_path="/account/trade-ins",
            vehicle_label=vehicle_label,
            offered_value=f"${trade_in.offered_value:,.2f}",
        )
    elif body.status == "Under Review":
        trade_in.status = "Under Review"
    elif body.status is not None:
        raise HTTPException(status_code=422, detail=f"Invalid status transition: '{body.status}'")

    if body.staff_notes is not None:
        trade_in.staff_notes = body.staff_notes.strip()

    trade_in.updated_at = now
    db.commit()
    db.refresh(trade_in)

    customer = db.query(Customer).filter(Customer.customer_id == trade_in.customer_id).first()
    return _to_staff_response(trade_in, customer)
