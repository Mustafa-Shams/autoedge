"""Staff restock routes per spec 7.4 + 10.4.

GET   /restock/priority               — reads v_restock_priority view [manager, sales_executive]
POST  /vehicles/{id}/restock          — add stock + mark requests Fulfilled [manager, sales_executive]
"""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_validator
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_role
from app.services.stock_service import change_stock

router = APIRouter(tags=["staff-restock"])

MANAGER_SALES = require_role(["manager", "sales_executive"])


# ── Schemas ──────────────────────────────────────────────────────────


class RestockBody(BaseModel):
    quantity: int

    @field_validator("quantity")
    @classmethod
    def validate_quantity(cls, v):
        if v < 1:
            raise ValueError("Quantity must be at least 1.")
        return v


class RestockPriorityItem(BaseModel):
    vehicle_id: int
    make: str
    model: str
    year: int
    price: float
    open_requests: int
    oldest_request_at: str | None = None


# ── Routes ───────────────────────────────────────────────────────────


@router.get("/restock/priority")
async def get_restock_priority(
    db: Session = Depends(get_db),
    current_user=Depends(MANAGER_SALES),
):
    """Read the v_restock_priority view — most-requested out-of-stock cars first."""
    result = db.execute(text("""
        SELECT vehicle_id, make, model, year, price::float,
               open_requests, oldest_request_at
        FROM v_restock_priority
        ORDER BY open_requests DESC, oldest_request_at ASC
    """))
    rows = result.mappings().all()
    items = []
    for row in rows:
        items.append({
            "vehicle_id": row["vehicle_id"],
            "make": row["make"],
            "model": row["model"],
            "year": row["year"],
            "price": row["price"],
            "open_requests": row["open_requests"],
            "oldest_request_at": row["oldest_request_at"].isoformat() if row["oldest_request_at"] else None,
        })
    return {"items": items}


@router.post("/vehicles/{vehicle_id}/restock", status_code=status.HTTP_200_OK)
async def restock_vehicle(
    vehicle_id: int,
    body: RestockBody,
    db: Session = Depends(get_db),
    current_user=Depends(MANAGER_SALES),
):
    """Restock a vehicle: increase stock + mark all Open requests as Fulfilled.

    The change_stock service handles:
    - Writing stock_movements row
    - Detecting stock rising from 0 → notifying restock requesters
    - Marking requests as Fulfilled
    """
    try:
        vehicle = change_stock(
            db=db,
            vehicle_id=vehicle_id,
            qty_change=body.quantity,
            reason="Restock",
            created_by=current_user.user_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    db.commit()

    return {
        "vehicle_id": vehicle.vehicle_id,
        "make": vehicle.make,
        "model": vehicle.model,
        "year": vehicle.year,
        "new_stock": vehicle.stock_quantity,
        "quantity_added": body.quantity,
    }
