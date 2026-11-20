"""Customer service booking routes — spec section 7.8.

POST /store/service-bookings              — Book a service (bank debit + password)
GET  /store/service-bookings              — List my bookings
GET  /store/service-bookings/{id}/receipt — Receipt data
POST /store/service-bookings/{id}/cancel  — Cancel (≥24h → full refund)
"""
from datetime import date
from decimal import Decimal
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, ConfigDict
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_customer
from app.models.customer_account import CustomerAccount
from app.models.customer_vehicle import CustomerVehicle
from app.models.service_booking import ServiceBooking
from app.models.service_type import ServiceType
from app.models.user import User
from app.services.service_booking_service import (
    book_service,
    cancel_booking,
    get_booking_receipt,
    ServiceBookingError,
)

router = APIRouter(prefix="/store/service-bookings", tags=["store-service-bookings"])


# ── Schemas ──────────────────────────────────────────────────────────

class BookServiceRequest(BaseModel):
    cv_id: int
    service_type_id: int
    technician_id: Optional[int] = None  # None = "No Preference"
    booking_date: date
    time_slot: str = Field(..., pattern=r"^\d{2}:00$")
    notes: Optional[str] = Field(None, max_length=500)
    password: str = Field(..., min_length=1)
    idempotency_key: str = Field(..., min_length=1, max_length=64)


class ServiceBookingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    booking_id: int
    customer_id: int
    cv_id: int
    service_type_id: int
    technician_id: Optional[int] = None
    booking_date: date
    time_slot: str
    notes: Optional[str] = None
    fee_amount: Decimal
    status: str
    service_job_id: Optional[int] = None
    created_at: str
    updated_at: str
    # Enriched fields
    vehicle_label: Optional[str] = None
    service_type_name: Optional[str] = None
    technician_name: Optional[str] = None
    reference_code: Optional[str] = None
    balance_after: Optional[Decimal] = None


class ServiceBookingListResponse(BaseModel):
    items: List[ServiceBookingResponse]
    total: int
    page: int
    page_size: int


class BookingReceiptResponse(BaseModel):
    booking_id: int
    receipt_number: str
    status: str
    vehicle_label: str
    service_type_name: str
    booking_date: date
    time_slot: str
    fee_amount: Decimal
    technician_name: Optional[str] = None
    reference_code: Optional[str] = None
    amount_charged: Optional[Decimal] = None
    balance_after_charge: Optional[Decimal] = None
    refund_amount: Optional[Decimal] = None
    refund_reference: Optional[str] = None
    bank_name: Optional[str] = None
    card_last4: Optional[str] = None


class BookingCancelResponse(BaseModel):
    booking_id: int
    status: str
    refunded: bool
    refund_amount: Decimal
    message: str


# ── Helpers ──────────────────────────────────────────────────────────

def _enrich_booking(booking: ServiceBooking, db: Session) -> ServiceBookingResponse:
    """Add human-readable fields to a booking response."""
    cv = db.query(CustomerVehicle).filter(
        CustomerVehicle.cv_id == booking.cv_id
    ).first()
    vehicle_label = f"{cv.year} {cv.make} {cv.model}" if cv else "Unknown Vehicle"

    st = db.query(ServiceType).filter(
        ServiceType.service_type_id == booking.service_type_id
    ).first()
    service_type_name = st.name if st else "Unknown"

    tech_name = None
    if booking.technician_id:
        tech = db.query(User).filter(User.user_id == booking.technician_id).first()
        tech_name = tech.full_name if tech else None

    # Get reference code from bank transaction
    from app.models.bank_transaction import BankTransaction
    txn = db.query(BankTransaction).filter(
        BankTransaction.service_booking_id == booking.booking_id,
        BankTransaction.direction == "Debit",
    ).first()
    ref_code = txn.reference_code if txn else None
    balance_after = txn.balance_after if txn else None

    time_str = booking.time_slot.strftime("%H:%M") if booking.time_slot else ""

    return ServiceBookingResponse(
        booking_id=booking.booking_id,
        customer_id=booking.customer_id,
        cv_id=booking.cv_id,
        service_type_id=booking.service_type_id,
        technician_id=booking.technician_id,
        booking_date=booking.booking_date,
        time_slot=time_str,
        notes=booking.notes,
        fee_amount=booking.fee_amount,
        status=booking.status,
        service_job_id=booking.service_job_id,
        created_at=booking.created_at.isoformat() if booking.created_at else "",
        updated_at=booking.updated_at.isoformat() if booking.updated_at else "",
        vehicle_label=vehicle_label,
        service_type_name=service_type_name,
        technician_name=tech_name,
        reference_code=ref_code,
        balance_after=balance_after,
    )


# ── Routes ───────────────────────────────────────────────────────────

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_service_booking(
    req: BookServiceRequest,
    account: CustomerAccount = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    """Book a service — debit booking_fee from bank with password confirmation."""
    try:
        booking = book_service(
            db,
            customer_id=account.customer_id,
            cv_id=req.cv_id,
            service_type_id=req.service_type_id,
            technician_id=req.technician_id,
            booking_date=req.booking_date,
            time_slot=req.time_slot,
            notes=req.notes,
            password=req.password,
            idempotency_key=req.idempotency_key,
        )
        db.commit()
        db.refresh(booking)
        return _enrich_booking(booking, db)

    except ServiceBookingError as e:
        db.rollback()
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while processing your booking",
        )


@router.get("")
async def list_service_bookings(
    status_filter: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
    account: CustomerAccount = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    """List the customer's service bookings with optional status filter."""
    page_size = min(page_size, 50)
    if page < 1:
        page = 1

    q = db.query(ServiceBooking).filter(
        ServiceBooking.customer_id == account.customer_id
    )
    if status_filter:
        q = q.filter(ServiceBooking.status == status_filter)

    total = q.count()
    bookings = (
        q.order_by(ServiceBooking.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return ServiceBookingListResponse(
        items=[_enrich_booking(b, db) for b in bookings],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{booking_id}/receipt", response_model=BookingReceiptResponse)
async def get_service_booking_receipt(
    booking_id: int,
    account: CustomerAccount = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    """Get receipt data for a service booking."""
    data = get_booking_receipt(db, account.customer_id, booking_id)
    if data is None:
        raise HTTPException(status_code=404, detail="Booking not found")

    booking = data["booking"]
    st = data["service_type"]
    cv = data["customer_vehicle"]
    dep_txn = data["debit_transaction"]
    ref_txn = data["refund_transaction"]
    bank = data["bank_account"]

    vehicle_label = f"{cv.year} {cv.make} {cv.model}" if cv else "Unknown Vehicle"
    time_str = booking.time_slot.strftime("%H:%M") if booking.time_slot else ""

    return BookingReceiptResponse(
        booking_id=booking.booking_id,
        receipt_number=f"SVC-{booking.booking_id:06d}",
        status=booking.status,
        vehicle_label=vehicle_label,
        service_type_name=st.name if st else "Unknown",
        booking_date=booking.booking_date,
        time_slot=time_str,
        fee_amount=booking.fee_amount,
        technician_name=data["technician_name"],
        reference_code=dep_txn.reference_code if dep_txn else None,
        amount_charged=dep_txn.amount if dep_txn else None,
        balance_after_charge=dep_txn.balance_after if dep_txn else None,
        refund_amount=ref_txn.amount if ref_txn else None,
        refund_reference=ref_txn.reference_code if ref_txn else None,
        bank_name=bank.bank_name if bank else None,
        card_last4=bank.card_last4 if bank else None,
    )


@router.post("/{booking_id}/cancel", response_model=BookingCancelResponse)
async def cancel_service_booking(
    booking_id: int,
    account: CustomerAccount = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    """Cancel a service booking.

    ≥24h before slot → 100% refund.
    <24h before slot → no refund.
    """
    try:
        booking = cancel_booking(
            db,
            customer_id=account.customer_id,
            booking_id=booking_id,
        )
        db.commit()

        refunded = booking.status == "Cancelled"
        # Check if a refund txn was created
        from app.models.bank_transaction import BankTransaction
        refund_txn = db.query(BankTransaction).filter(
            BankTransaction.service_booking_id == booking_id,
            BankTransaction.direction == "Credit",
        ).first()

        refund_amount = refund_txn.amount if refund_txn else Decimal("0.00")
        was_refunded = refund_txn is not None

        if was_refunded:
            message = f"Booking cancelled. ${refund_amount:,.2f} refunded to your account."
        else:
            message = (
                "Booking cancelled. No refund — cancellation was within 24 hours "
                "of the booking time."
            )

        return BookingCancelResponse(
            booking_id=booking.booking_id,
            status=booking.status,
            refunded=was_refunded,
            refund_amount=refund_amount,
            message=message,
        )

    except ServiceBookingError as e:
        db.rollback()
        raise HTTPException(status_code=e.status_code, detail=e.message)
