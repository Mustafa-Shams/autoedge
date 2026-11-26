from datetime import datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, ConfigDict


class SaleBase(BaseModel):
    vehicle_id: int
    customer_id: int
    staff_id: int
    sale_price: Decimal
    discount: Decimal = Decimal("0")
    payment_type: str = "Cash"
    status: str = "Pending"
    notes: Optional[str] = None


class SaleCreate(SaleBase):
    # Storefront reservation / trade-in linkage (spec 7.2)
    reservation_id: Optional[int] = None
    trade_in_id: Optional[int] = None


class SaleUpdate(BaseModel):
    sale_price: Optional[Decimal] = None
    discount: Optional[Decimal] = None
    payment_type: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    # Storefront reservation / trade-in linkage (spec 7.2)
    reservation_id: Optional[int] = None
    trade_in_id: Optional[int] = None


class SaleResponse(SaleBase):
    model_config = ConfigDict(from_attributes=True)

    sale_id: int
    deal_id: int | None = None
    commission_details: dict | None = None
    staff_id: Optional[int] = None
    sale_date: datetime
    pickup_status: Optional[str] = None
    refund_requested: bool = False
    payment_verified: bool = False
    excess_at_pickup: Decimal = Decimal("0")
    cash_received: Optional[Decimal] = None
    external_funding: Optional[Decimal] = None
    pickup_deadline: Optional[datetime] = None
    enquiry_id: Optional[int] = None
    unit_id: Optional[int] = None
    # Storefront additions
    reservation_id: Optional[int] = None
    trade_in_id: Optional[int] = None
    deposit_credit: Decimal = Decimal("0")
    trade_in_credit: Decimal = Decimal("0")
    balance_due_at_showroom: Optional[Decimal] = None
    # Enriched display fields (populated by CRUD layer)
    vehicle_info: Optional[str] = None    # "2023 Toyota Camry"
    customer_name: Optional[str] = None   # "Ali Hassan"
    staff_name: Optional[str] = None      # "Sarah Sales"


class SaleStats(BaseModel):
    total_sales: int
    completed_sales: int
    total_revenue: Decimal
    this_month_revenue: Decimal
