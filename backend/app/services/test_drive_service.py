"""Test drive service — online test drive requests per spec 7.3.

Handles: request, validate slots, check limits, set expiry, confirm/decline.
Allowed slots: hourly 09:00–17:00, Monday–Saturday.
Date from today to +30 days; a slot today must start at least 2 hours from now.
Vehicle must be published with stock_quantity > 0.
"""
from datetime import date, time, timedelta, datetime, timezone
from typing import List, Optional

from sqlalchemy import and_, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.time import utcnow
from app.models.test_drive import TestDrive
from app.models.vehicle import Vehicle
from app.services.notify_service import notify


# Valid hourly slots 09:00 through 17:00 (last slot is 17:00, the drive takes ~1 hour)
VALID_SLOTS = [time(h, 0) for h in range(9, 18)]

# Days of week: 0=Mon, 5=Sat, 6=Sun
VALID_WEEKDAYS = {0, 1, 2, 3, 4, 5}  # Monday–Saturday (exclude Sunday)


class TestDriveError(Exception):
    """Base exception for test drive errors."""
    def __init__(self, message: str, status_code: int = 400):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


def _slot_datetime(d: date, t: time) -> datetime:
    """Combine date and time into a UTC-aware datetime."""
    return datetime.combine(d, t, tzinfo=timezone.utc)


def validate_slot(scheduled_date: date, scheduled_time: time) -> None:
    """Validate the requested slot against business rules."""
    now = utcnow()
    today = now.date()

    # Must not be in the past
    if scheduled_date < today:
        raise TestDriveError("Cannot schedule a test drive in the past.", 422)

    # Must be within 30 days
    max_date = today + timedelta(days=30)
    if scheduled_date > max_date:
        raise TestDriveError(
            f"Test drive must be within 30 days (by {max_date.isoformat()}).", 422
        )

    # Must be Mon–Sat
    if scheduled_date.weekday() not in VALID_WEEKDAYS:
        raise TestDriveError("Test drives are only available Monday through Saturday.", 422)

    # Must be a valid hourly slot
    if scheduled_time not in VALID_SLOTS:
        valid_str = ", ".join(s.strftime("%H:%M") for s in VALID_SLOTS)
        raise TestDriveError(
            f"Invalid time slot. Available slots: {valid_str}", 422
        )

    # If today, must be at least 2 hours from now
    if scheduled_date == today:
        slot_dt = _slot_datetime(scheduled_date, scheduled_time)
        if slot_dt <= now + timedelta(hours=2):
            raise TestDriveError(
                "A test drive today must start at least 2 hours from now.", 422
            )


def request_test_drive(
    db: Session,
    customer_id: int,
    vehicle_id: int,
    scheduled_date: date,
    scheduled_time: time,
    notes: Optional[str] = None,
) -> TestDrive:
    """Create a test drive request per spec 7.3."""
    # Validate slot
    validate_slot(scheduled_date, scheduled_time)

    # Vehicle must be published and in stock
    vehicle = (
        db.query(Vehicle)
        .filter(Vehicle.vehicle_id == vehicle_id)
        .first()
    )
    if not vehicle:
        raise TestDriveError("Vehicle not found.", 404)
    if not vehicle.is_published:
        raise TestDriveError("This vehicle is not available for test drives.", 404)
    if vehicle.stock_quantity <= 0:
        raise TestDriveError(
            "This vehicle is out of stock and not available for test drives.", 409
        )

    # Check active test drive limit
    active_count = (
        db.query(func.count(TestDrive.test_drive_id))
        .filter(
            TestDrive.customer_id == customer_id,
            TestDrive.status.in_(["Requested", "Scheduled"]),
        )
        .scalar()
    )
    if active_count >= settings.MAX_ACTIVE_TEST_DRIVES_PER_CUSTOMER:
        raise TestDriveError(
            f"You can have at most {settings.MAX_ACTIVE_TEST_DRIVES_PER_CUSTOMER} active test drive requests.",
            409,
        )

    # Calculate expiry: LEAST(utcnow() + 48h, slot start)
    now = utcnow()
    slot_start = _slot_datetime(scheduled_date, scheduled_time)
    expiry_48h = now + timedelta(hours=settings.TEST_DRIVE_REQUEST_EXPIRY_HOURS)
    expires_at = min(expiry_48h, slot_start)

    # Insert test drive
    td = TestDrive(
        customer_id=customer_id,
        vehicle_id=vehicle_id,
        scheduled_date=scheduled_date,
        scheduled_time=scheduled_time,
        source="Online",
        status="Requested",
        lead_status="New",
        notes=notes,
        expires_at=expires_at,
    )

    try:
        db.add(td)
        db.flush()  # Flush to catch uq_td_slot IntegrityError
    except IntegrityError:
        db.rollback()
        raise TestDriveError("That slot was just taken. Please choose another.", 409)

    # Notification
    vehicle_name = f"{vehicle.year} {vehicle.make} {vehicle.model}"
    notify(
        db,
        customer_id=customer_id,
        notification_type="test_drive_requested",
        title="Test Drive Request Submitted",
        message=f"Your test drive request for {vehicle_name} on "
                f"{scheduled_date.strftime('%b %d, %Y')} at {scheduled_time.strftime('%H:%M')} "
                f"has been submitted. We'll confirm shortly.",
        link_path="/account/test-drives",
        vehicle_label=vehicle_name,
        date=scheduled_date.strftime("%b %d, %Y"),
        time=scheduled_time.strftime("%H:%M"),
    )
    db.commit()
    db.refresh(td)

    return td


def cancel_test_drive(
    db: Session,
    customer_id: int,
    test_drive_id: int,
) -> TestDrive:
    """Cancel a test drive request (customer action).
    
    Customer may cancel while Requested/Scheduled up to 2 hours before the slot.
    """
    td = (
        db.query(TestDrive)
        .filter(
            TestDrive.test_drive_id == test_drive_id,
            TestDrive.customer_id == customer_id,
        )
        .first()
    )
    if not td:
        raise TestDriveError("Test drive not found.", 404)

    if td.status not in ("Requested", "Scheduled"):
        raise TestDriveError(
            f"Cannot cancel a test drive with status '{td.status}'.", 409
        )

    # Check 2-hour cancellation window
    now = utcnow()
    if td.scheduled_time:
        slot_dt = _slot_datetime(td.scheduled_date, td.scheduled_time)
        if slot_dt <= now + timedelta(hours=2):
            raise TestDriveError(
                "Cannot cancel a test drive less than 2 hours before the scheduled time.", 409
            )

    td.status = "Cancelled"

    # Notification
    vehicle = db.query(Vehicle).filter(Vehicle.vehicle_id == td.vehicle_id).first()
    vehicle_name = f"{vehicle.year} {vehicle.make} {vehicle.model}" if vehicle else "vehicle"
    notify(
        db,
        customer_id=customer_id,
        notification_type="test_drive_requested",  # cancel uses generic type
        title="Test Drive Cancelled",
        message=f"Your test drive for {vehicle_name} on "
                f"{td.scheduled_date.strftime('%b %d, %Y')} has been cancelled.",
        link_path="/account/test-drives",
    )
    db.commit()
    db.refresh(td)

    return td


def confirm_test_drive(
    db: Session,
    test_drive_id: int,
    assigned_to: Optional[int] = None,
) -> TestDrive:
    """Staff confirms a test drive request → status='Scheduled'.
    
    Sets assigned_to, clears expires_at, notifies customer.
    """
    td = db.query(TestDrive).filter(TestDrive.test_drive_id == test_drive_id).first()
    if not td:
        raise TestDriveError("Test drive not found.", 404)

    if td.status != "Requested":
        raise TestDriveError(
            f"Can only confirm a test drive with status 'Requested' (current: '{td.status}').",
            409,
        )

    td.status = "Scheduled"
    td.expires_at = None  # Confirmed — no longer expires
    if assigned_to:
        td.assigned_to = assigned_to

    # Notification
    vehicle = db.query(Vehicle).filter(Vehicle.vehicle_id == td.vehicle_id).first()
    vehicle_name = f"{vehicle.year} {vehicle.make} {vehicle.model}" if vehicle else "vehicle"
    notify(
        db,
        customer_id=td.customer_id,
        notification_type="test_drive_confirmed",
        title="Test Drive Confirmed!",
        message=f"Your test drive for {vehicle_name} on "
                f"{td.scheduled_date.strftime('%b %d, %Y')} at "
                f"{td.scheduled_time.strftime('%H:%M') if td.scheduled_time else 'TBD'} "
                f"has been confirmed.",
        link_path="/account/test-drives",
        vehicle_label=vehicle_name,
        date=td.scheduled_date.strftime("%b %d, %Y"),
        time=td.scheduled_time.strftime("%H:%M") if td.scheduled_time else "TBD",
    )
    db.commit()
    db.refresh(td)

    return td


def decline_test_drive(
    db: Session,
    test_drive_id: int,
    reason: str,
) -> TestDrive:
    """Staff declines a test drive request (reason required) → Cancelled, notify."""
    td = db.query(TestDrive).filter(TestDrive.test_drive_id == test_drive_id).first()
    if not td:
        raise TestDriveError("Test drive not found.", 404)

    if td.status != "Requested":
        raise TestDriveError(
            f"Can only decline a test drive with status 'Requested' (current: '{td.status}').",
            409,
        )

    td.status = "Cancelled"
    td.notes = (td.notes or "") + f"\n[Declined] {reason}" if td.notes else f"[Declined] {reason}"

    # Notification
    vehicle = db.query(Vehicle).filter(Vehicle.vehicle_id == td.vehicle_id).first()
    vehicle_name = f"{vehicle.year} {vehicle.make} {vehicle.model}" if vehicle else "vehicle"
    notify(
        db,
        customer_id=td.customer_id,
        notification_type="test_drive_declined",
        title="Test Drive Declined",
        message=f"Your test drive request for {vehicle_name} was declined. Reason: {reason}",
        link_path="/account/test-drives",
        vehicle_label=vehicle_name,
        reason=reason,
    )
    db.commit()
    db.refresh(td)

    return td


def get_customer_test_drives(
    db: Session,
    customer_id: int,
    status_filter: Optional[str] = None,
) -> List[TestDrive]:
    """Get all test drives for a customer, most recent first."""
    q = db.query(TestDrive).filter(TestDrive.customer_id == customer_id)
    if status_filter:
        q = q.filter(TestDrive.status == status_filter)
    return q.order_by(TestDrive.scheduled_date.desc(), TestDrive.test_drive_id.desc()).all()
