from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class TestDriveBase(BaseModel):
    customer_id: int
    vehicle_id: int
    assigned_to: Optional[int] = None
    scheduled_date: date
    status: str = "Scheduled"
    notes: Optional[str] = None
    lead_status: str = "New"


class TestDriveCreate(TestDriveBase):
    pass


class TestDriveUpdate(BaseModel):
    assigned_to: Optional[int] = None
    scheduled_date: Optional[date] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    lead_status: Optional[str] = None


class TestDriveResponse(TestDriveBase):
    model_config = ConfigDict(from_attributes=True)

    test_drive_id: int
    booking_date: datetime
    # Enriched display fields (populated by CRUD layer)
    customer_name: Optional[str] = None        # "Ali Hassan"
    vehicle_info: Optional[str] = None         # "2023 Toyota Camry"
    assigned_staff_name: Optional[str] = None  # "Sarah Sales"
