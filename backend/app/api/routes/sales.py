from typing import List, Optional
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user, require_role
from app.crud.crud_sale import get_sale, get_sales, create_sale, update_sale, get_sale_stats
from app.schemas.sale import SaleCreate, SaleUpdate, SaleResponse, SaleStats
from app.models.reservation import Reservation
from app.models.trade_in_request import TradeInRequest
from app.models.vehicle import Vehicle
from app.core.time import utcnow

router = APIRouter(prefix="/sales", tags=["sales"])

MANAGER_ONLY = require_role(["manager"])
MANAGER_SALES = require_role(["manager", "sales_executive"])


@router.get("/stats", response_model=SaleStats)
async def sales_stats(db: Session = Depends(get_db), _=Depends(MANAGER_ONLY)):
    return get_sale_stats(db)


@router.get("/", response_model=List[SaleResponse])
async def list_sales(
    skip: int = 0,
    limit: int = 20,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    staff_id = None if current_user.role == "manager" else current_user.user_id
    return get_sales(db, skip=skip, limit=limit, staff_id=staff_id, status=status)


@router.post("/", response_model=SaleResponse, status_code=status.HTTP_201_CREATED)
async def record_sale(
    sale_in: SaleCreate,
    db: Session = Depends(get_db),
    _=Depends(MANAGER_SALES),
):
    return create_sale(db, sale_in)


@router.get("/{sale_id}", response_model=SaleResponse)
async def get_sale_detail(
    sale_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    sale = get_sale(db, sale_id)
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    if current_user.role == "sales_executive" and sale.staff_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    return sale


@router.put("/{sale_id}", response_model=SaleResponse)
async def update_sale_detail(
    sale_id: int,
    sale_in: SaleUpdate,
    db: Session = Depends(get_db),
    _=Depends(MANAGER_SALES),
):
    sale = update_sale(db, sale_id, sale_in)
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    return sale


# ── P46: Customer credits for the sales form (spec 11.5) ─────────────

@router.get("/customer-credits/{customer_id}")
async def get_customer_credits(
    customer_id: int,
    db: Session = Depends(get_db),
    _=Depends(MANAGER_SALES),
):
    """Get a customer's Active reservations and Accepted trade-ins for the sales form.

    Per spec 11.5: after choosing a customer, the form shows their Active reservations
    and Accepted trade-ins; selecting them fills the credits and shows "Balance due at showroom".
    """
    # Active reservations
    reservations = (
        db.query(Reservation)
        .filter(
            Reservation.customer_id == customer_id,
            Reservation.status == "Active",
            Reservation.expires_at >= utcnow(),
        )
        .all()
    )
    reservation_items = []
    for r in reservations:
        v = db.query(Vehicle).filter(Vehicle.vehicle_id == r.vehicle_id).first()
        vehicle_label = f"{v.year} {v.make} {v.model}" if v else f"Vehicle #{r.vehicle_id}"
        reservation_items.append({
            "reservation_id": r.reservation_id,
            "vehicle_id": r.vehicle_id,
            "vehicle_label": vehicle_label,
            "deposit_amount": str(r.deposit_amount),
            "hold_days": r.hold_days,
            "reserved_at": r.reserved_at.isoformat() if r.reserved_at else None,
            "expires_at": r.expires_at.isoformat() if r.expires_at else None,
        })

    # Accepted trade-ins
    trade_ins = (
        db.query(TradeInRequest)
        .filter(
            TradeInRequest.customer_id == customer_id,
            TradeInRequest.status == "Accepted",
        )
        .all()
    )
    trade_in_items = []
    for ti in trade_ins:
        trade_in_items.append({
            "trade_in_id": ti.trade_in_id,
            "make": ti.make,
            "model": ti.model,
            "year": ti.year,
            "offered_value": str(ti.offered_value) if ti.offered_value else "0",
            "target_vehicle_id": ti.target_vehicle_id,
        })

    return {
        "customer_id": customer_id,
        "active_reservations": reservation_items,
        "accepted_trade_ins": trade_in_items,
    }
