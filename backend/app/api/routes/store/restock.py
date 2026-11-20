"""Store restock-request routes — customer-facing per spec 7.4.

POST   /store/restock-requests              — request a car (vehicle_id in body)
GET    /store/restock-requests              — list my requests
DELETE /store/restock-requests/{vehicle_id} — withdraw a request
"""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_db, get_current_customer
from app.core.time import utcnow
from app.models.customer_account import CustomerAccount
from app.models.vehicle import Vehicle
from app.models.restock_request import RestockRequest

router = APIRouter(prefix="/store/restock-requests", tags=["store-restock"])


# ── Schemas ──────────────────────────────────────────────────────────


class RestockRequestBody(BaseModel):
    vehicle_id: int


class RestockRequestResponse(BaseModel):
    request_id: int
    customer_id: int
    vehicle_id: int
    status: str
    created_at: str | None = None
    fulfilled_at: str | None = None
    vehicle_label: str | None = None


# ── Helpers ──────────────────────────────────────────────────────────


def _to_response(r: RestockRequest) -> dict:
    vehicle_label = None
    if r.vehicle:
        vehicle_label = f"{r.vehicle.year} {r.vehicle.make} {r.vehicle.model}"
    return {
        "request_id": r.request_id,
        "customer_id": r.customer_id,
        "vehicle_id": r.vehicle_id,
        "status": r.status,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "fulfilled_at": r.fulfilled_at.isoformat() if r.fulfilled_at else None,
        "vehicle_label": vehicle_label,
    }


# ── Routes ───────────────────────────────────────────────────────────


@router.post("/", status_code=status.HTTP_201_CREATED)
async def request_restock(
    body: RestockRequestBody,
    db: Session = Depends(get_db),
    account: CustomerAccount = Depends(get_current_customer),
):
    """Request a restock for an out-of-stock vehicle. One Open request per customer per vehicle."""
    # Vehicle must exist
    vehicle = db.query(Vehicle).filter(Vehicle.vehicle_id == body.vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found.")

    # Must be out of stock (spec 7.4: only for vehicles with stock_quantity = 0)
    if vehicle.stock_quantity > 0:
        raise HTTPException(
            status_code=422, detail="This vehicle is in stock — you can reserve it directly."
        )

    # Check for existing Open request (unique index uq_rr_open enforces this too)
    existing = (
        db.query(RestockRequest)
        .filter(
            RestockRequest.customer_id == account.customer_id,
            RestockRequest.vehicle_id == body.vehicle_id,
            RestockRequest.status == "Open",
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=409, detail="You already have an open request for this vehicle."
        )

    request = RestockRequest(
        customer_id=account.customer_id,
        vehicle_id=body.vehicle_id,
        status="Open",
        created_at=utcnow(),
    )
    db.add(request)
    db.commit()
    db.refresh(request)

    # Eagerly load vehicle for response
    request.vehicle = vehicle

    return _to_response(request)


@router.get("/")
async def list_my_restock_requests(
    db: Session = Depends(get_db),
    account: CustomerAccount = Depends(get_current_customer),
):
    """List my restock requests."""
    requests = (
        db.query(RestockRequest)
        .options(joinedload(RestockRequest.vehicle))
        .filter(RestockRequest.customer_id == account.customer_id)
        .order_by(RestockRequest.created_at.desc())
        .all()
    )
    return [_to_response(r) for r in requests]


@router.delete("/{vehicle_id}", status_code=status.HTTP_200_OK)
async def withdraw_restock_request(
    vehicle_id: int,
    db: Session = Depends(get_db),
    account: CustomerAccount = Depends(get_current_customer),
):
    """Withdraw (cancel) an open restock request."""
    request = (
        db.query(RestockRequest)
        .filter(
            RestockRequest.customer_id == account.customer_id,
            RestockRequest.vehicle_id == vehicle_id,
            RestockRequest.status == "Open",
        )
        .first()
    )
    if not request:
        raise HTTPException(
            status_code=404, detail="No open restock request found for this vehicle."
        )

    request.status = "Withdrawn"
    db.commit()

    return {"status": "Withdrawn", "vehicle_id": vehicle_id}
