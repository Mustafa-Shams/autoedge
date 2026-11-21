"""Store test drive routes — customer-facing test drive requests per spec 7.3.

POST /store/test-drives — request a test drive
GET  /store/test-drives — list my test drives
POST /store/test-drives/{id}/cancel — cancel a test drive
"""
from datetime import date, time
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, field_validator
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_customer
from app.models.customer_account import CustomerAccount
from app.services.test_drive_service import (
    request_test_drive,
    cancel_test_drive,
    get_customer_test_drives,
    TestDriveError,
)

router = APIRouter(prefix="/store/test-drives", tags=["store-test-drives"])


# ── Schemas ──────────────────────────────────────────────────────────


class TestDriveRequest(BaseModel):
    vehicle_id: int
    scheduled_date: date
    scheduled_time: str  # Accept as string "HH:MM", parse to time
    notes: Optional[str] = None

    @field_validator("scheduled_time")
    @classmethod
    def parse_time(cls, v):
        """Parse HH:MM string to validate format. Returns as string, converted to time in route."""
        if isinstance(v, str):
            parts = v.strip().split(":")
            if len(parts) != 2:
                raise ValueError("Time must be in HH:MM format")
            try:
                h, m = int(parts[0]), int(parts[1])
                if not (0 <= h <= 23 and 0 <= m <= 59):
                    raise ValueError()
                return f"{h:02d}:{m:02d}"
            except (ValueError, TypeError):
                raise ValueError("Time must be in HH:MM format")
        return v


class TestDriveVehicleInfo(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    vehicle_id: int
    make: Optional[str] = None
    model: Optional[str] = None
    year: Optional[int] = None
    color: Optional[str] = None
    main_image_url: Optional[str] = None


class TestDriveResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    test_drive_id: int
    customer_id: int
    vehicle_id: int
    scheduled_date: date
    scheduled_time: Optional[str] = None
    status: str
    source: str
    lead_status: str
    notes: Optional[str] = None
    expires_at: Optional[str] = None
    assigned_to: Optional[int] = None
    booking_date: Optional[str] = None
    vehicle: Optional[TestDriveVehicleInfo] = None

    @field_validator("scheduled_time", mode="before")
    @classmethod
    def format_time(cls, v):
        if v is None:
            return None
        if hasattr(v, "strftime"):
            return v.strftime("%H:%M")
        return str(v)

    @field_validator("expires_at", "booking_date", mode="before")
    @classmethod
    def format_datetime(cls, v):
        if v is None:
            return None
        if hasattr(v, "isoformat"):
            return v.isoformat()
        return str(v)


def _enrich_response(td) -> dict:
    """Convert a TestDrive ORM object to a response dict with vehicle info."""
    data = {
        "test_drive_id": td.test_drive_id,
        "customer_id": td.customer_id,
        "vehicle_id": td.vehicle_id,
        "scheduled_date": td.scheduled_date,
        "scheduled_time": td.scheduled_time.strftime("%H:%M") if td.scheduled_time else None,
        "status": td.status,
        "source": td.source,
        "lead_status": td.lead_status,
        "notes": td.notes,
        "expires_at": td.expires_at.isoformat() if td.expires_at else None,
        "assigned_to": td.assigned_to,
        "booking_date": td.booking_date.isoformat() if td.booking_date else None,
    }
    if td.vehicle:
        data["vehicle"] = {
            "vehicle_id": td.vehicle.vehicle_id,
            "make": td.vehicle.make,
            "model": td.vehicle.model,
            "year": td.vehicle.year,
            "color": td.vehicle.color,
            "main_image_url": td.vehicle.main_image_url,
        }
    return data


# ── Routes ───────────────────────────────────────────────────────────


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_test_drive(
    body: TestDriveRequest,
    db: Session = Depends(get_db),
    account: CustomerAccount = Depends(get_current_customer),
):
    """Request a test drive (customer action)."""
    # Parse time string to time object
    parts = body.scheduled_time.split(":")
    sched_time = time(int(parts[0]), int(parts[1]))

    try:
        td = request_test_drive(
            db=db,
            customer_id=account.customer_id,
            vehicle_id=body.vehicle_id,
            scheduled_date=body.scheduled_date,
            scheduled_time=sched_time,
            notes=body.notes,
        )
    except TestDriveError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)

    return _enrich_response(td)


@router.get("")
async def list_test_drives(
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    account: CustomerAccount = Depends(get_current_customer),
):
    """List my test drives."""
    tds = get_customer_test_drives(db, account.customer_id, status_filter)
    return [_enrich_response(td) for td in tds]


@router.post("/{test_drive_id}/cancel")
async def cancel_my_test_drive(
    test_drive_id: int,
    db: Session = Depends(get_db),
    account: CustomerAccount = Depends(get_current_customer),
):
    """Cancel a test drive request (customer action)."""
    try:
        td = cancel_test_drive(db, account.customer_id, test_drive_id)
    except TestDriveError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)

    return _enrich_response(td)
