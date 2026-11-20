"""Staff reservation routes — spec section 10.4.

GET  /reservations              — List all reservations (filtered)
GET  /reservations/{id}         — Single reservation detail
POST /reservations/{id}/cancel  — Staff cancel with refund (manager only)
"""
from typing import Optional
from decimal import Decimal, ROUND_HALF_UP

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_role
from app.core.config import settings
from app.models.reservation import Reservation
from app.models.vehicle import Vehicle
from app.models.customer import Customer
from app.models.customer_account import CustomerAccount
from app.services.reservation_service import cancel_by_staff, ReservationError
from app.schemas.store_bank import (
    StaffReservationResponse,
    StaffReservationListResponse,
    ReservationCancelResponse,
)

router = APIRouter(prefix="/reservations", tags=["staff-reservations"])

ALLOWED_ROLES = ["manager", "sales_executive", "receptionist"]


def _enrich_staff_reservation(res: Reservation, db: Session) -> StaffReservationResponse:
    """Add vehicle + customer info to a reservation response for staff."""
    vehicle = db.query(Vehicle).filter(
        Vehicle.vehicle_id == res.vehicle_id
    ).first()
    customer = db.query(Customer).filter(
        Customer.customer_id == res.customer_id
    ).first()
    account = db.query(CustomerAccount).filter(
        CustomerAccount.customer_id == res.customer_id
    ).first()

    return StaffReservationResponse(
        reservation_id=res.reservation_id,
        customer_id=res.customer_id,
        vehicle_id=res.vehicle_id,
        deposit_amount=res.deposit_amount,
        hold_days=res.hold_days,
        reserved_at=res.reserved_at,
        expires_at=res.expires_at,
        status=res.status,
        closed_at=res.closed_at,
        notes=res.notes,
        customer_name=customer.full_name if customer else None,
        customer_email=account.email if account else (customer.email if customer else None),
        customer_phone=customer.phone if customer else None,
        vehicle_make=vehicle.make if vehicle else None,
        vehicle_model=vehicle.model if vehicle else None,
        vehicle_year=vehicle.year if vehicle else None,
        vehicle_price=vehicle.price if vehicle else None,
    )


@router.get("", response_model=StaffReservationListResponse)
async def list_reservations(
    status_filter: Optional[str] = None,
    vehicle_id: Optional[int] = None,
    customer_id: Optional[int] = None,
    page: int = 1,
    page_size: int = 20,
    current_user=Depends(require_role(ALLOWED_ROLES)),
    db: Session = Depends(get_db),
):
    """List all reservations with optional filters."""
    page_size = min(page_size, 50)
    if page < 1:
        page = 1

    q = db.query(Reservation)
    if status_filter:
        q = q.filter(Reservation.status == status_filter)
    if vehicle_id:
        q = q.filter(Reservation.vehicle_id == vehicle_id)
    if customer_id:
        q = q.filter(Reservation.customer_id == customer_id)

    total = q.count()
    reservations = (
        q.order_by(Reservation.reserved_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return StaffReservationListResponse(
        items=[_enrich_staff_reservation(r, db) for r in reservations],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{reservation_id}", response_model=StaffReservationResponse)
async def get_reservation(
    reservation_id: int,
    current_user=Depends(require_role(ALLOWED_ROLES)),
    db: Session = Depends(get_db),
):
    """Get a single reservation detail (staff view)."""
    reservation = db.query(Reservation).filter(
        Reservation.reservation_id == reservation_id
    ).first()

    if reservation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reservation not found",
        )

    return _enrich_staff_reservation(reservation, db)


@router.post("/{reservation_id}/cancel", response_model=ReservationCancelResponse)
async def staff_cancel_reservation(
    reservation_id: int,
    current_user=Depends(require_role(["manager"])),
    db: Session = Depends(get_db),
):
    """Cancel a reservation (manager only) with refund."""
    try:
        reservation = cancel_by_staff(db, reservation_id)
        db.commit()

        fee_percent = Decimal(str(settings.CANCELLATION_FEE_PERCENT))
        refund = (
            reservation.deposit_amount * (100 - fee_percent) / 100
        ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        fee = reservation.deposit_amount - refund

        return ReservationCancelResponse(
            reservation_id=reservation.reservation_id,
            status=reservation.status,
            refund_amount=refund,
            fee_amount=fee,
            message=f"Reservation cancelled by staff. ${refund:,.2f} refunded "
                    f"(${fee:,.2f} cancellation fee).",
        )

    except ReservationError as e:
        db.rollback()
        raise HTTPException(status_code=e.status_code, detail=e.message)
