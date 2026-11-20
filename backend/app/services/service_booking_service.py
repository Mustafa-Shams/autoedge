"""Service booking transactional service — same bank-debit pattern as reservation_service.

Full transactional flow with:
- Row locking (bank_account FOR UPDATE, spec Article XIII)
- Idempotency keys (no double charging)
- Bank transaction ledger entries via bank_service
- Technician slot conflict check
- Booking fee = service_type.booking_fee
- Notifications on state changes
"""
from datetime import datetime, time, timedelta
from decimal import Decimal
from typing import Optional

from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import verify_password
from app.core.time import utcnow
from app.models.bank_account import BankAccount
from app.models.bank_transaction import BankTransaction
from app.models.customer_account import CustomerAccount
from app.models.customer_vehicle import CustomerVehicle
from app.models.service_booking import ServiceBooking
from app.models.service_type import ServiceType
from app.models.technician_profile import TechnicianProfile
from app.models.user import User
from app.services import bank_service
from app.services.notify_service import notify


class ServiceBookingError(Exception):
    """Base exception for service booking errors."""
    def __init__(self, message: str, status_code: int = 400):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


def book_service(
    db: Session,
    customer_id: int,
    cv_id: int,
    service_type_id: int,
    technician_id: Optional[int],
    booking_date,
    time_slot: str,
    notes: Optional[str],
    password: str,
    idempotency_key: str,
) -> ServiceBooking:
    """Create a service booking with bank debit per spec 7.8.

    Full transactional flow:
    1. Verify customer password
    2. Check idempotency key
    3. Validate inputs (vehicle ownership, service type, date, slot)
    4. Check technician availability if specified
    5. Lock bank account, check balance >= booking_fee
    6. Debit bank, create ServiceBooking, create notification
    """
    import zoneinfo

    # 1. Verify customer password
    account = db.query(CustomerAccount).filter(
        CustomerAccount.customer_id == customer_id
    ).first()
    if account is None:
        raise ServiceBookingError("Account not found", 404)

    if not verify_password(password, account.password_hash):
        raise ServiceBookingError("Incorrect password", 401)

    # 2. Check idempotency — if this key already has a transaction, return existing booking
    if idempotency_key:
        existing_txn = db.query(BankTransaction).filter(
            BankTransaction.idempotency_key == idempotency_key
        ).first()
        if existing_txn and existing_txn.service_booking_id:
            existing_booking = db.query(ServiceBooking).filter(
                ServiceBooking.booking_id == existing_txn.service_booking_id
            ).first()
            if existing_booking:
                return existing_booking

    # 3. Validate customer vehicle belongs to this customer
    vehicle = db.query(CustomerVehicle).filter(
        and_(
            CustomerVehicle.cv_id == cv_id,
            CustomerVehicle.customer_id == customer_id,
        )
    ).first()
    if not vehicle:
        raise ServiceBookingError("Vehicle not found in your garage", 404)

    # 4. Validate service type exists and is active; get booking fee
    service_type = db.query(ServiceType).filter(
        ServiceType.service_type_id == service_type_id,
        ServiceType.is_active == True,
    ).first()
    if not service_type:
        raise ServiceBookingError("Service type not found or inactive", 404)

    booking_fee = service_type.booking_fee
    if booking_fee is None or booking_fee <= 0:
        raise ServiceBookingError("Service type has no valid booking fee", 400)

    # 5. Validate booking date (tomorrow → +30 days, Mon–Sat)
    tz = zoneinfo.ZoneInfo(settings.SHOWROOM_TIMEZONE)
    now_local = datetime.now(tz)
    today_local = now_local.date()
    tomorrow = today_local + timedelta(days=1)
    max_date = today_local + timedelta(days=30)

    if booking_date < tomorrow:
        raise ServiceBookingError("Booking date must be at least tomorrow", 422)
    if booking_date > max_date:
        raise ServiceBookingError("Booking date cannot be more than 30 days from today", 422)
    if booking_date.weekday() == 6:  # Sunday
        raise ServiceBookingError("Bookings are only available Monday to Saturday", 422)

    # 6. Validate time slot (09:00–16:00 hourly)
    valid_slots = [f"{h:02d}:00" for h in range(9, 17)]
    if time_slot not in valid_slots:
        raise ServiceBookingError(
            f"Invalid time slot. Must be one of: {', '.join(valid_slots)}", 422
        )
    slot_time = time(int(time_slot.split(":")[0]), 0)

    # 7. If technician specified, validate and check slot availability
    if technician_id:
        profile = db.query(TechnicianProfile).filter(
            TechnicianProfile.user_id == technician_id,
            TechnicianProfile.is_bookable == True,
        ).first()
        if not profile:
            raise ServiceBookingError("Technician not found or unavailable", 404)

        # Check if service type requires a specific specialty
        if service_type.required_specialty:
            if profile.specialty.lower() != service_type.required_specialty.lower():
                raise ServiceBookingError(
                    f"Technician's specialty ({profile.specialty}) does not match "
                    f"required specialty ({service_type.required_specialty})", 422
                )

        # Check slot conflict for this technician on this date/time
        slot_conflict = db.query(ServiceBooking).filter(
            and_(
                ServiceBooking.technician_id == technician_id,
                ServiceBooking.booking_date == booking_date,
                ServiceBooking.time_slot == slot_time,
                ServiceBooking.status.in_(["Booked", "Confirmed", "In Progress"]),
            )
        ).first()
        if slot_conflict:
            raise ServiceBookingError("Technician is already booked for this time slot", 409)

    # 8. Lock bank account (last in lock order per Article XIII)
    bank_acct = (
        db.query(BankAccount)
        .filter(BankAccount.customer_id == customer_id)
        .with_for_update()
        .first()
    )
    if bank_acct is None:
        raise ServiceBookingError("No bank account found. Please set up your bank account first.", 400)
    if bank_acct.balance < booking_fee:
        raise ServiceBookingError("Payment declined: insufficient funds", 402)

    # 9. Create the booking
    vehicle_label = f"{vehicle.year} {vehicle.make} {vehicle.model}"
    now = utcnow()

    booking = ServiceBooking(
        customer_id=customer_id,
        cv_id=cv_id,
        service_type_id=service_type_id,
        technician_id=technician_id,
        booking_date=booking_date,
        time_slot=slot_time,
        notes=notes,
        fee_amount=booking_fee,
        status="Booked",
    )
    db.add(booking)
    db.flush()  # Get booking_id

    # 10. Debit bank account via bank_service
    new_balance = bank_acct.balance - booking_fee
    bank_acct.balance = new_balance

    ref_code = bank_service._ensure_unique_ref(db)
    txn = BankTransaction(
        bank_account_id=bank_acct.bank_account_id,
        txn_type="Service Booking Fee",
        direction="Debit",
        amount=booking_fee,
        balance_after=new_balance,
        reference_code=ref_code,
        idempotency_key=idempotency_key,
        description=f"Booking fee for {service_type.name} — {vehicle_label}",
        service_booking_id=booking.booking_id,
    )
    db.add(txn)

    # 11. Create notification + email
    notify(
        db,
        customer_id=customer_id,
        notification_type="service_booked",
        title=f"Service Booking Confirmed — {service_type.name}",
        message=(
            f"Your service booking for {vehicle_label} ({service_type.name}) "
            f"on {booking_date.strftime('%b %d, %Y')} at {time_slot} has been placed. "
            f"Booking fee of ${booking_fee:,.2f} has been charged."
        ),
        link_path="/account/service-bookings",
        service_type=service_type.name,
        vehicle_label=vehicle_label,
        date=booking_date.strftime("%b %d, %Y"),
        time=time_slot,
        fee=f"${booking_fee:,.2f}",
    )

    db.flush()
    return booking


def cancel_booking(
    db: Session,
    customer_id: int,
    booking_id: int,
) -> ServiceBooking:
    """Cancel a service booking per spec 7.8.

    ≥24h before slot → 100% refund.
    <24h before slot → no refund.
    Only Booked or Confirmed can be cancelled.
    """
    import zoneinfo

    # Lock booking
    booking = (
        db.query(ServiceBooking)
        .filter(
            ServiceBooking.booking_id == booking_id,
            ServiceBooking.customer_id == customer_id,
        )
        .with_for_update()
        .first()
    )
    if booking is None:
        raise ServiceBookingError("Booking not found", 404)
    if booking.status not in ("Booked", "Confirmed"):
        raise ServiceBookingError(
            f"Cannot cancel a booking with status '{booking.status}'", 409
        )

    # Determine if ≥24h before slot (using showroom timezone)
    tz = zoneinfo.ZoneInfo(settings.SHOWROOM_TIMEZONE)
    slot_datetime = datetime.combine(booking.booking_date, booking.time_slot, tzinfo=tz)
    now = datetime.now(tz)
    hours_until_slot = (slot_datetime - now).total_seconds() / 3600

    refunded = False
    refund_amount = Decimal("0.00")

    if hours_until_slot >= 24:
        # Full refund
        refund_amount = booking.fee_amount

        bank_acct = (
            db.query(BankAccount)
            .filter(BankAccount.customer_id == customer_id)
            .with_for_update()
            .first()
        )

        if bank_acct and refund_amount > 0:
            new_balance = bank_acct.balance + refund_amount
            bank_acct.balance = new_balance

            ref_code = bank_service._ensure_unique_ref(db)
            refund_txn = BankTransaction(
                bank_account_id=bank_acct.bank_account_id,
                txn_type="Service Booking Refund",
                direction="Credit",
                amount=refund_amount,
                balance_after=new_balance,
                reference_code=ref_code,
                description=f"Refund for cancelled service booking #{booking.booking_id}",
                service_booking_id=booking.booking_id,
            )
            db.add(refund_txn)
            refunded = True

    # Update status
    booking.status = "Cancelled"
    booking.updated_at = utcnow()

    # Load service_type for notification
    service_type = db.query(ServiceType).filter(
        ServiceType.service_type_id == booking.service_type_id
    ).first()
    service_name = service_type.name if service_type else "Service"

    # Notification
    if refunded:
        msg = (
            f"Your service booking #{booking.booking_id} for {service_name} has been cancelled. "
            f"${refund_amount:,.2f} has been refunded to your account."
        )
    else:
        msg = (
            f"Your service booking #{booking.booking_id} for {service_name} has been cancelled. "
            f"No refund — cancellation was within 24 hours of the booking slot."
        )

    notify(
        db,
        customer_id=customer_id,
        notification_type="service_booked",  # reuse service_booked type for cancellation message
        title="Service Booking Cancelled",
        message=msg,
        link_path="/account/service-bookings",
    )

    db.flush()
    return booking


def confirm_booking(
    db: Session,
    booking_id: int,
    technician_id: int,
) -> ServiceBooking:
    """Staff confirms a booking: assign technician, create service_job, link it.

    Per spec 7.8 step 5:
    - Assigns technician (if "No Preference" was chosen → staff assigns now)
    - Creates service_jobs row
    - Links service_job_id in booking
    - Status → Confirmed
    """
    from app.models.service_job import ServiceJob

    booking = db.query(ServiceBooking).filter(
        ServiceBooking.booking_id == booking_id,
    ).first()
    if booking is None:
        raise ServiceBookingError("Booking not found", 404)
    if booking.status != "Booked":
        raise ServiceBookingError(
            f"Cannot confirm a booking with status '{booking.status}'", 409
        )

    # Validate technician
    profile = db.query(TechnicianProfile).filter(
        TechnicianProfile.user_id == technician_id,
    ).first()
    if not profile:
        raise ServiceBookingError("Technician not found", 404)

    # Check service type specialty match
    service_type = db.query(ServiceType).filter(
        ServiceType.service_type_id == booking.service_type_id,
    ).first()
    if service_type and service_type.required_specialty:
        if profile.specialty.lower() != service_type.required_specialty.lower():
            raise ServiceBookingError(
                f"Technician specialty ({profile.specialty}) does not match "
                f"required ({service_type.required_specialty})", 422
            )

    # Check slot conflict
    slot_conflict = db.query(ServiceBooking).filter(
        and_(
            ServiceBooking.technician_id == technician_id,
            ServiceBooking.booking_date == booking.booking_date,
            ServiceBooking.time_slot == booking.time_slot,
            ServiceBooking.booking_id != booking.booking_id,
            ServiceBooking.status.in_(["Booked", "Confirmed", "In Progress"]),
        )
    ).first()
    if slot_conflict:
        raise ServiceBookingError("Technician already has a booking at this time slot", 409)

    # Load customer vehicle for the service job
    cv = db.query(CustomerVehicle).filter(
        CustomerVehicle.cv_id == booking.cv_id,
    ).first()

    # Create service job
    job = ServiceJob(
        vehicle_id=None,  # No inventory vehicle — customer's own car
        customer_id=booking.customer_id,
        technician_id=technician_id,
        job_type=service_type.name if service_type else "Service",
        description=booking.notes or f"Service booking #{booking.booking_id}",
        status="Pending",
        job_date=booking.booking_date,
        estimated_cost=service_type.base_price if service_type else None,
        customer_vehicle_id=booking.cv_id,
    )
    db.add(job)
    db.flush()  # Get job_id

    # Update booking
    booking.technician_id = technician_id
    booking.service_job_id = job.job_id
    booking.status = "Confirmed"
    booking.updated_at = utcnow()

    # Notify customer
    tech_user = db.query(User).filter(User.user_id == technician_id).first()
    tech_name = tech_user.full_name if tech_user else "a technician"
    service_name = service_type.name if service_type else "your service"

    notify(
        db,
        customer_id=booking.customer_id,
        notification_type="service_confirmed",
        title="Service Booking Confirmed",
        message=(
            f"Your booking for {service_name} on "
            f"{booking.booking_date.strftime('%b %d, %Y')} at "
            f"{booking.time_slot.strftime('%H:%M')} has been confirmed. "
            f"Technician: {tech_name}."
        ),
        link_path="/account/service-bookings",
        service_type=service_name,
        technician_name=tech_name,
        date=booking.booking_date.strftime("%b %d, %Y"),
        time=booking.time_slot.strftime("%H:%M"),
    )

    db.flush()
    return booking


def complete_booking_from_job(db: Session, job_id: int) -> Optional[ServiceBooking]:
    """When a service job is marked Completed, also mark the linked booking.

    Per spec 7.8 step 7:
    When linked service_jobs.status = Completed → service_bookings.status → Completed.
    """
    booking = db.query(ServiceBooking).filter(
        ServiceBooking.service_job_id == job_id,
    ).first()
    if not booking:
        return None
    if booking.status in ("Completed", "Cancelled"):
        return booking

    booking.status = "Completed"
    booking.updated_at = utcnow()

    # Load service type for notification
    service_type = db.query(ServiceType).filter(
        ServiceType.service_type_id == booking.service_type_id,
    ).first()
    service_name = service_type.name if service_type else "Service"

    # Load vehicle label for email template
    cv = db.query(CustomerVehicle).filter(
        CustomerVehicle.cv_id == booking.cv_id,
    ).first()
    vehicle_label = f"{cv.year} {cv.make} {cv.model}" if cv else "your vehicle"

    notify(
        db,
        customer_id=booking.customer_id,
        notification_type="service_completed",
        title="Service Complete",
        message=(
            f"Your {service_name} service has been completed. "
            f"Thank you for choosing AutoEdge!"
        ),
        link_path="/account/service-bookings",
        service_type=service_name,
        vehicle_label=vehicle_label,
    )

    db.flush()
    return booking


def get_booking_receipt(
    db: Session,
    customer_id: int,
    booking_id: int,
) -> Optional[dict]:
    """Get receipt data for a service booking."""
    booking = db.query(ServiceBooking).filter(
        ServiceBooking.booking_id == booking_id,
        ServiceBooking.customer_id == customer_id,
    ).first()
    if booking is None:
        return None

    service_type = db.query(ServiceType).filter(
        ServiceType.service_type_id == booking.service_type_id,
    ).first()

    cv = db.query(CustomerVehicle).filter(
        CustomerVehicle.cv_id == booking.cv_id,
    ).first()

    # Get the debit transaction
    debit_txn = db.query(BankTransaction).filter(
        BankTransaction.service_booking_id == booking_id,
        BankTransaction.direction == "Debit",
    ).first()

    # Get the refund transaction (if any)
    refund_txn = db.query(BankTransaction).filter(
        BankTransaction.service_booking_id == booking_id,
        BankTransaction.direction == "Credit",
    ).first()

    bank_acct = db.query(BankAccount).filter(
        BankAccount.customer_id == customer_id,
    ).first()

    technician = None
    if booking.technician_id:
        tech_user = db.query(User).filter(User.user_id == booking.technician_id).first()
        if tech_user:
            technician = tech_user.full_name

    return {
        "booking": booking,
        "service_type": service_type,
        "customer_vehicle": cv,
        "debit_transaction": debit_txn,
        "refund_transaction": refund_txn,
        "bank_account": bank_acct,
        "technician_name": technician,
    }
