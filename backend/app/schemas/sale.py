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
    pass


class SaleUpdate(BaseModel):
    sale_price: Optional[Decimal] = None
    discount: Optional[Decimal] = None
    payment_type: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class SaleResponse(SaleBase):
    model_config = ConfigDict(from_attributes=True)

    sale_id: int
    sale_date: datetime
    # Enriched display fields (populated by CRUD layer)
    vehicle_info: Optional[str] = None    # "2023 Toyota Camry"
    customer_name: Optional[str] = None   # "Ali Hassan"
    staff_name: Optional[str] = None      # "Sarah Sales"


class SaleStats(BaseModel):
    total_sales: int
    completed_sales: int
    total_revenue: Decimal
    this_month_revenue: Decimal
