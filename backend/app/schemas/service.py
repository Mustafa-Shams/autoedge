from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, ConfigDict


class ServicePartBase(BaseModel):
    part_name: str
    part_number: Optional[str] = None
    quantity: int = 1
    unit_cost: Decimal


class ServicePartCreate(ServicePartBase):
    pass


class ServicePartResponse(ServicePartBase):
    model_config = ConfigDict(from_attributes=True)

    part_id: int
    job_id: int
    total_cost: Decimal


class ServiceJobBase(BaseModel):
    vehicle_id: int
    customer_id: int
    technician_id: Optional[int] = None
    job_type: str
    description: Optional[str] = None
    status: str = "Pending"
    job_date: Optional[date] = None
    estimated_cost: Optional[Decimal] = None
    final_cost: Optional[Decimal] = None
    notes: Optional[str] = None


class ServiceJobCreate(ServiceJobBase):
    pass


class ServiceJobUpdate(BaseModel):
    technician_id: Optional[int] = None
    job_type: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    job_date: Optional[date] = None
    estimated_cost: Optional[Decimal] = None
    final_cost: Optional[Decimal] = None
    notes: Optional[str] = None


class ServiceJobResponse(ServiceJobBase):
    model_config = ConfigDict(from_attributes=True)

    job_id: int
    created_at: datetime
    parts: List[ServicePartResponse] = []
    # Enriched display fields (populated by CRUD layer)
    vehicle_info: Optional[str] = None     # "2023 Toyota Camry"
    customer_name: Optional[str] = None    # "Ali Hassan"
    technician_name: Optional[str] = None  # "Tom Tech"
