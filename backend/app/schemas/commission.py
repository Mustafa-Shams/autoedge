from datetime import datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, ConfigDict


class CommissionBase(BaseModel):
    staff_id: int
    sale_id: int
    rate_percent: Decimal = Decimal("2.50")
    commission_amt: Decimal
    status: str = "Pending"


class CommissionCreate(CommissionBase):
    pass


class CommissionUpdate(BaseModel):
    status: Optional[str] = None
    paid_at: Optional[datetime] = None


class CommissionResponse(CommissionBase):
    model_config = ConfigDict(from_attributes=True)

    commission_id: int
    created_at: datetime
    paid_at: Optional[datetime] = None


class CommissionSummary(BaseModel):
    staff_id: int
    staff_name: str
    total_commissions: int
    total_amount: Decimal
    pending_amount: Decimal
    paid_amount: Decimal
