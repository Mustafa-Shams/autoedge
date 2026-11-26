"""Pydantic v2 schemas for bank, reservations, and related store features."""
from typing import Optional, List
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, field_validator


# ── Bank ────────────────────────────────────────────────────────────

class BankSummaryResponse(BaseModel):
    """Bank account summary for GET /store/bank."""
    model_config = ConfigDict(from_attributes=True)

    bank_account_id: int
    bank_name: str
    account_number_masked: str  # ••••••4821
    card_last4: str
    balance: Decimal
    customer_name: str


class BankTransactionResponse(BaseModel):
    deal_id: int | None = None
    """A single bank transaction."""
    model_config = ConfigDict(from_attributes=True)

    txn_id: int
    txn_type: str
    direction: str
    amount: Decimal
    balance_after: Decimal
    reference_code: str
    description: Optional[str] = None
    reservation_id: Optional[int] = None
    service_booking_id: Optional[int] = None
    sale_id: Optional[int] = None
    created_at: datetime


class BankStatementResponse(BaseModel):
    """Paginated bank statement."""
    items: List[BankTransactionResponse]
    total: int
    page: int
    page_size: int


class TopUpRequest(BaseModel):
    """Request to top up bank balance."""
    amount: Decimal

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, v: Decimal) -> Decimal:
        if v < Decimal("100.00"):
            raise ValueError("Minimum top-up amount is $100.00")
        if v > Decimal("50000.00"):
            raise ValueError("Maximum top-up amount is $50,000.00")
        return v


class TopUpResponse(BaseModel):
    """Response after successful top-up."""
    model_config = ConfigDict(from_attributes=True)

    txn_id: int
    reference_code: str
    amount: Decimal
    new_balance: Decimal
    message: str = "Demo funds added successfully"


# ── Reservations ────────────────────────────────────────────────────

class ReserveRequest(BaseModel):
    """Request to reserve a vehicle."""
    quote_token: str | None = None
    vehicle_id: int
    hold_days: int
    password: str
    idempotency_key: str

    @field_validator("hold_days")
    @classmethod
    def validate_hold_days(cls, v: int) -> int:
        if v < 7:
            raise ValueError("Minimum hold period is 7 days")
        if v > 30:
            raise ValueError("Maximum hold period is 30 days")
        return v

    @field_validator("idempotency_key")
    @classmethod
    def validate_idempotency_key(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Idempotency key is required")
        return v


class ReservationResponse(BaseModel):
    deal_id: int | None = None
    """A single reservation."""
    model_config = ConfigDict(from_attributes=True)

    reservation_id: int
    customer_id: int
    vehicle_id: int
    deposit_amount: Decimal
    hold_days: int
    reserved_at: datetime
    expires_at: datetime
    status: str
    closed_at: Optional[datetime] = None
    notes: Optional[str] = None
    # Enriched fields
    vehicle_make: Optional[str] = None
    vehicle_model: Optional[str] = None
    vehicle_year: Optional[int] = None
    vehicle_price: Optional[Decimal] = None
    vehicle_main_image_url: Optional[str] = None


class ReservationListResponse(BaseModel):
    """Paginated reservations."""
    items: List[ReservationResponse]
    total: int
    page: int
    page_size: int


class ReservationReceiptResponse(BaseModel):
    """Receipt data for a reservation."""
    reservation_id: int
    receipt_number: str  # RSV-000123
    status: str
    vehicle_label: str
    vehicle_price: Decimal
    deposit_amount: Decimal
    hold_days: int
    reserved_at: datetime
    expires_at: datetime
    # Transaction info
    reference_code: Optional[str] = None
    amount_charged: Optional[Decimal] = None
    balance_after_charge: Optional[Decimal] = None
    # Refund info (if cancelled/expired)
    refund_amount: Optional[Decimal] = None
    refund_reference: Optional[str] = None
    # Bank info
    bank_name: Optional[str] = None
    card_last4: Optional[str] = None
    # Balance due
    balance_due_at_showroom: Optional[Decimal] = None


class ReservationCancelResponse(BaseModel):
    """Response after cancelling a reservation."""
    reservation_id: int
    status: str
    refund_amount: Decimal
    fee_amount: Decimal
    message: str


# ── Staff Reservation ───────────────────────────────────────────────

class StaffReservationResponse(BaseModel):
    """Reservation as seen by staff — includes customer info."""
    model_config = ConfigDict(from_attributes=True)

    reservation_id: int
    customer_id: int
    vehicle_id: int
    deposit_amount: Decimal
    hold_days: int
    reserved_at: datetime
    expires_at: datetime
    status: str
    closed_at: Optional[datetime] = None
    notes: Optional[str] = None
    # Enriched fields
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = None
    vehicle_make: Optional[str] = None
    vehicle_model: Optional[str] = None
    vehicle_year: Optional[int] = None
    vehicle_price: Optional[Decimal] = None


class StaffReservationListResponse(BaseModel):
    """Paginated staff reservation list."""
    items: List[StaffReservationResponse]
    total: int
    page: int
    page_size: int
