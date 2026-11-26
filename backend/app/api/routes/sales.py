from typing import List, Optional
from datetime import datetime
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from pydantic import BaseModel, Field

from app.api.deps import get_db, get_current_user, require_role, require_module, require_enquiry_access
from app.crud.crud_sale import get_sale, get_sales, create_sale, update_sale, get_sale_stats
from app.schemas.sale import SaleCreate, SaleUpdate, SaleResponse, SaleStats
from app.models.reservation import Reservation
from app.models.trade_in_request import TradeInRequest
from app.models.trade_acquisition import TradeAcquisition
from app.models.vehicle import Vehicle
from app.core.time import utcnow
from app.models.sale import Sale
from app.models.sales_assistance import SalesAssistance
from app.services.deal_service import handover
from app.services.purchase_service import cancel_purchase
from app.services.showroom_service import PaymentEvidence, ReturnAgreement, purchase_thread, set_pickup_deadline, verify_payment

router = APIRouter(prefix="/sales", tags=["sales"])

MANAGER_ONLY = require_role(["manager"])
MANAGER_SALES = require_role(["manager", "sales_executive"])


def sale_details(sale, db, viewer):
    if viewer.access.get("commissions", "none") == "none":
        return sale
    earned = sale.commission
    if earned and (viewer.role == "manager" or earned.staff_id == viewer.user_id):
        assistance = db.query(SalesAssistance).filter_by(sale_id=sale.sale_id).one_or_none()
        sale.commission_details = dict(amount=earned.commission_amt, rate=earned.rate_percent,
                                       owner=earned.staff.full_name, status=earned.status,
                                       evidence=f"{assistance.kind} · {assistance.note}" if assistance else "Historical sale attribution")
    return sale


class HandoverRequest(BaseModel):
    vin: str
    settlement_reference: str | None = Field(default=None, max_length=100)


class PickupSchedule(BaseModel):
    deadline: datetime


def managed_sale(sale_id: int, db: Session = Depends(get_db), user=Depends(MANAGER_SALES)):
    sale = db.query(Sale).filter_by(sale_id=sale_id).with_for_update().one_or_none()
    if sale is None:
        raise HTTPException(404, "Sale not found")
    if user.role != "manager" and sale.staff_id not in (None, user.user_id):
        raise HTTPException(403, "This sale belongs to another salesperson")
    return sale


@router.post("/{sale_id}/payment", response_model=SaleResponse)
def confirm_payment(body: PaymentEvidence, sale=Depends(managed_sale), db: Session = Depends(get_db),
                    user=Depends(MANAGER_SALES)):
    try:
        verify_payment(db, sale, user.user_id, body)
        db.commit()
        return get_sale(db, sale.sale_id)
    except ValueError as exc:
        db.rollback()
        raise HTTPException(409, str(exc)) from exc


@router.post("/{sale_id}/pickup-deadline", response_model=SaleResponse)
def schedule_pickup(body: PickupSchedule, sale=Depends(managed_sale), db: Session = Depends(get_db)):
    try:
        set_pickup_deadline(db, sale.sale_id, body.deadline)
        db.commit()
        return get_sale(db, sale.sale_id)
    except ValueError as exc:
        db.rollback()
        raise HTTPException(409, str(exc)) from exc


@router.post("/{sale_id}/conversation", dependencies=[Depends(require_module("enquiries")), Depends(require_enquiry_access())])
def start_conversation(sale=Depends(managed_sale), db: Session = Depends(get_db)):
    enquiry_id = purchase_thread(db, sale.sale_id)
    if enquiry_id is None:
        raise HTTPException(409, "A completed purchase is required")
    db.commit()
    return {"enquiry_id": enquiry_id}


@router.post("/{sale_id}/approve-refund", response_model=SaleResponse)
def approve_refund(sale_id: int, body: ReturnAgreement | None = None, db: Session = Depends(get_db), user=Depends(MANAGER_ONLY)):
    try:
        cancel_purchase(db, sale_id, manager_id=user.user_id, agree_trade_return=bool(body and body.agree_trade_return))
        db.commit()
        return get_sale(db, sale_id)
    except LookupError as exc:
        raise HTTPException(404, str(exc)) from exc
    except ValueError as exc:
        db.rollback()
        raise HTTPException(409, str(exc)) from exc


@router.post("/{sale_id}/handover", response_model=SaleResponse)
def confirm_handover(sale_id: int, body: HandoverRequest, sale=Depends(managed_sale), db: Session = Depends(get_db),
                     user=Depends(MANAGER_SALES)):
    try:
        handover(db, sale, user.user_id, body.vin, body.settlement_reference)
        db.commit()
    except ValueError as exc:
        db.rollback()
        raise HTTPException(409, str(exc)) from exc
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(409, "Handover could not be recorded. Check whether this VIN is already assigned.") from exc
    return get_sale(db, sale_id)


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
    return [sale_details(s, db, current_user) for s in get_sales(db, skip=skip, limit=limit, staff_id=staff_id, status=status)]


@router.post("/", response_model=SaleResponse, status_code=status.HTTP_201_CREATED)
async def record_sale(
    sale_in: SaleCreate,
    db: Session = Depends(get_db),
    user=Depends(MANAGER_SALES),
):
    if user.role != "manager" and sale_in.staff_id != user.user_id:
        raise HTTPException(403, "Sales staff can record their own sales")
    try:
        return create_sale(db, sale_in)
    except ValueError as exc:
        db.rollback()
        raise HTTPException(409, str(exc)) from exc


@router.get("/{sale_id}", response_model=SaleResponse)
async def get_sale_detail(
    sale_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    sale = get_sale(db, sale_id)
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    if current_user.role == "sales_executive" and sale.staff_id not in (None, current_user.user_id):
        raise HTTPException(status_code=403, detail="Forbidden")
    return sale_details(sale, db, current_user)


@router.put("/{sale_id}", response_model=SaleResponse)
async def update_sale_detail(
    sale_id: int,
    sale_in: SaleUpdate,
    db: Session = Depends(get_db),
    user=Depends(MANAGER_SALES),
):
    existing = db.get(Sale, sale_id)
    if existing and user.role != "manager" and existing.staff_id != user.user_id:
        raise HTTPException(403, "Sales staff can edit their own sales")
    try:
        sale = update_sale(db, sale_id, sale_in)
    except ValueError as exc:
        db.rollback()
        raise HTTPException(409, str(exc)) from exc
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
        .join(TradeAcquisition)
        .filter(
            TradeInRequest.customer_id == customer_id,
            TradeInRequest.status == "Accepted",
            TradeAcquisition.intake_at.isnot(None),
            TradeAcquisition.terms_version == TradeAcquisition.approved_version,
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
            "offered_value": str(ti.acquisition.inspected_value - ti.acquisition.excess_amount),
            "target_vehicle_id": ti.target_vehicle_id,
        })

    return {
        "customer_id": customer_id,
        "active_reservations": reservation_items,
        "accepted_trade_ins": trade_in_items,
    }
