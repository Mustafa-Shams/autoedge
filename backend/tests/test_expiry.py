"""P47 Expiry tests — spec section 14.

Verifies that:
- Expired reservations are closed with refund + stock restored
- Expired test drive requests change to Expired status
- Expired trade-in offers change to Expired status

All expiry happens via expire_stale() in reservation_service.

NOTE: All test files share the same SQLAlchemy engine. Each test manages
its own data via _fresh_db() + _setup_base_data().
"""
import os
import pytest
from decimal import Decimal
from datetime import timedelta, date, time

# Use SQLite for tests
os.environ["DATABASE_URL"] = "sqlite:///./test_expiry.db"
os.environ["SECRET_KEY"] = "test-secret-key-expiry"
os.environ["ALGORITHM"] = "HS256"
os.environ["ACCESS_TOKEN_EXPIRE_MINUTES"] = "60"
os.environ["CORS_ORIGINS"] = "http://localhost:5173"

from fastapi.testclient import TestClient
from app.main import app  # noqa: E402
from app.db.session import engine, SessionLocal
from app.db.base import Base
from app.core.security import hash_password, create_access_token
from app.core.time import utcnow
from app.models.customer import Customer
from app.models.customer_account import CustomerAccount
from app.models.bank_account import BankAccount
from app.models.bank_transaction import BankTransaction
from app.models.vehicle import Vehicle
from app.models.reservation import Reservation
from app.models.stock_movement import StockMovement
from app.models.test_drive import TestDrive
from app.models.trade_in_request import TradeInRequest
from app.services.reservation_service import expire_stale

# Recreate tables fresh
Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)

client = TestClient(app)


def _fresh_db():
    """Get a fresh database session and clean all data."""
    db = SessionLocal()
    for model in [StockMovement, BankTransaction, Reservation, TestDrive,
                  TradeInRequest, BankAccount, CustomerAccount, Customer, Vehicle]:
        db.query(model).delete()
    db.commit()
    return db


def _setup_base_data(db):
    """Create base customer + vehicle data."""
    customer = Customer(
        customer_id=1,
        full_name="Test Customer",
        email="test@test.com",
        phone="1234567890",
    )
    db.add(customer)
    db.flush()

    account = CustomerAccount(
        account_id=1,
        customer_id=1,
        email="test@test.com",
        password_hash=hash_password("Test@1234"),
        is_active=True,
    )
    db.add(account)

    bank = BankAccount(
        bank_account_id=1,
        customer_id=1,
        bank_name="Demo Bank",
        account_number="AE1234567890",
        card_last4="1234",
        balance=Decimal("40000.00"),
    )
    db.add(bank)

    txn = BankTransaction(
        bank_account_id=1,
        txn_type="Opening Balance",
        direction="Credit",
        amount=Decimal("40000.00"),
        balance_after=Decimal("40000.00"),
        reference_code="TXN-00000000-000001",
    )
    db.add(txn)

    vehicle = Vehicle(
        vehicle_id=1,
        make="BMW",
        model="3 Series",
        year=2024,
        color="Black",
        fuel_type="Gasoline",
        transmission="Automatic",
        body_type="Sedan",
        condition_type="New",
        mileage_km=0,
        price=Decimal("50000.00"),
        status="Available",
        stock_quantity=2,
        is_published=True,
    )
    db.add(vehicle)

    db.commit()
    return customer, bank, vehicle


# ═══════════════════════════════════════════════════════════════════
# Reservation expiry
# ═══════════════════════════════════════════════════════════════════

class TestReservationExpiry:
    """Stale reservations are expired with refund and stock restoration."""

    def test_expired_reservation_gets_refunded(self):
        """Reservation past expires_at → Expired + 90% refund + stock +1."""
        db = _fresh_db()
        try:
            customer, bank, vehicle = _setup_base_data(db)

            now = utcnow()
            deposit = Decimal("5000.00")

            # Simulate: balance was debited, stock was decremented
            bank.balance -= deposit
            vehicle.stock_quantity -= 1

            # Deposit debit transaction
            debit_txn = BankTransaction(
                bank_account_id=1,
                txn_type="Reservation Deposit",
                direction="Debit",
                amount=deposit,
                balance_after=bank.balance,
                reference_code="TXN-00000000-000010",
            )
            db.add(debit_txn)

            # Stock movement (use correct field name: change_qty)
            sm = StockMovement(
                vehicle_id=1,
                change_qty=-1,
                reason="Reserved",
            )
            db.add(sm)

            # Create reservation that is ALREADY EXPIRED
            reservation = Reservation(
                reservation_id=1,
                customer_id=1,
                vehicle_id=1,
                deposit_amount=deposit,
                hold_days=14,
                reserved_at=now - timedelta(days=15),
                expires_at=now - timedelta(days=1),  # Past!
                status="Active",
            )
            db.add(reservation)
            db.commit()

            balance_before = db.query(BankAccount).filter(BankAccount.bank_account_id == 1).first().balance
            stock_before = db.query(Vehicle).filter(Vehicle.vehicle_id == 1).first().stock_quantity

            # Run expiry
            count = expire_stale(db)
            db.commit()

            assert count >= 1, "Should have expired at least one reservation"

            # Verify reservation is Expired
            res = db.query(Reservation).filter(Reservation.reservation_id == 1).first()
            assert res.status == "Expired"
            assert res.closed_at is not None

            # Verify refund (90% of deposit)
            bank_after = db.query(BankAccount).filter(BankAccount.bank_account_id == 1).first()
            expected_refund = (deposit * Decimal("90") / Decimal("100")).quantize(Decimal("0.01"))
            assert bank_after.balance == balance_before + expected_refund, \
                f"Balance should be {balance_before + expected_refund}, got {bank_after.balance}"

            # Verify stock restored
            veh_after = db.query(Vehicle).filter(Vehicle.vehicle_id == 1).first()
            assert veh_after.stock_quantity == stock_before + 1, \
                f"Stock should be {stock_before + 1}, got {veh_after.stock_quantity}"

        finally:
            db.close()

    def test_non_expired_reservation_untouched(self):
        """Reservation not yet expired should NOT be changed."""
        db = _fresh_db()
        try:
            customer, bank, vehicle = _setup_base_data(db)

            now = utcnow()
            reservation = Reservation(
                reservation_id=2,
                customer_id=1,
                vehicle_id=1,
                deposit_amount=Decimal("3000.00"),
                hold_days=14,
                reserved_at=now,
                expires_at=now + timedelta(days=14),  # Future!
                status="Active",
            )
            db.add(reservation)
            db.commit()

            count = expire_stale(db)
            db.commit()

            res = db.query(Reservation).filter(Reservation.reservation_id == 2).first()
            assert res.status == "Active", "Non-expired reservation should stay Active"
        finally:
            db.close()


# ═══════════════════════════════════════════════════════════════════
# Test drive expiry
# ═══════════════════════════════════════════════════════════════════

class TestTestDriveExpiry:
    """Stale test drive requests are expired."""

    def test_expired_test_drive_becomes_expired(self):
        """Test drive request past expires_at → Expired status."""
        db = _fresh_db()
        try:
            customer, bank, vehicle = _setup_base_data(db)

            now = utcnow()
            td = TestDrive(
                test_drive_id=1,
                customer_id=1,
                vehicle_id=1,
                scheduled_date=date.today() - timedelta(days=3),
                scheduled_time=time(10, 0),
                status="Requested",
                source="Online",
                expires_at=now - timedelta(hours=1),  # Past!
            )
            db.add(td)
            db.commit()

            expire_stale(db)
            db.commit()

            td_after = db.query(TestDrive).filter(TestDrive.test_drive_id == 1).first()
            assert td_after.status == "Expired", f"Expected Expired, got {td_after.status}"

        finally:
            db.close()

    def test_active_test_drive_untouched(self):
        """Test drive with future expiry should NOT be changed."""
        db = _fresh_db()
        try:
            customer, bank, vehicle = _setup_base_data(db)

            now = utcnow()
            td = TestDrive(
                test_drive_id=2,
                customer_id=1,
                vehicle_id=1,
                scheduled_date=date.today() + timedelta(days=3),
                scheduled_time=time(14, 0),
                status="Requested",
                source="Online",
                expires_at=now + timedelta(hours=47),  # Future!
            )
            db.add(td)
            db.commit()

            expire_stale(db)
            db.commit()

            td_after = db.query(TestDrive).filter(TestDrive.test_drive_id == 2).first()
            assert td_after.status == "Requested", "Non-expired test drive should stay Requested"

        finally:
            db.close()


# ═══════════════════════════════════════════════════════════════════
# Trade-in offer expiry
# ═══════════════════════════════════════════════════════════════════

class TestTradeInExpiry:
    """Stale trade-in offers are expired."""

    def test_expired_trade_in_offer(self):
        """Trade-in with past offer_valid_until → Expired status."""
        db = _fresh_db()
        try:
            customer, bank, vehicle = _setup_base_data(db)

            now = utcnow()
            ti = TradeInRequest(
                trade_in_id=1,
                customer_id=1,
                target_vehicle_id=1,
                make="Honda",
                model="Civic",
                year=2019,
                mileage_km=60000,
                color="Silver",
                condition_rating="Good",
                description="Regular maintenance done",
                expected_price=Decimal("12000.00"),
                status="Offer Made",
                offered_value=Decimal("11000.00"),
                offer_valid_until=now - timedelta(hours=1),  # Past!
                created_at=now - timedelta(days=5),
                updated_at=now - timedelta(days=2),
            )
            db.add(ti)
            db.commit()

            expire_stale(db)
            db.commit()

            ti_after = db.query(TradeInRequest).filter(TradeInRequest.trade_in_id == 1).first()
            assert ti_after.status == "Expired", f"Expected Expired, got {ti_after.status}"

        finally:
            db.close()

    def test_active_trade_in_offer_untouched(self):
        """Trade-in with future offer_valid_until should NOT be changed."""
        db = _fresh_db()
        try:
            customer, bank, vehicle = _setup_base_data(db)

            now = utcnow()
            ti = TradeInRequest(
                trade_in_id=2,
                customer_id=1,
                target_vehicle_id=1,
                make="Ford",
                model="Focus",
                year=2021,
                mileage_km=30000,
                color="Red",
                condition_rating="Excellent",
                expected_price=Decimal("18000.00"),
                status="Offer Made",
                offered_value=Decimal("16500.00"),
                offer_valid_until=now + timedelta(days=5),  # Future!
                created_at=now - timedelta(days=1),
                updated_at=now,
            )
            db.add(ti)
            db.commit()

            expire_stale(db)
            db.commit()

            ti_after = db.query(TradeInRequest).filter(TradeInRequest.trade_in_id == 2).first()
            assert ti_after.status == "Offer Made", "Non-expired trade-in should stay Offer Made"

        finally:
            db.close()

    def test_submitted_trade_in_not_affected(self):
        """Submitted trade-in (no offer yet) should never be expired."""
        db = _fresh_db()
        try:
            customer, bank, vehicle = _setup_base_data(db)

            now = utcnow()
            ti = TradeInRequest(
                trade_in_id=3,
                customer_id=1,
                target_vehicle_id=1,
                make="Toyota",
                model="Corolla",
                year=2018,
                mileage_km=80000,
                color="White",
                condition_rating="Fair",
                expected_price=Decimal("10000.00"),
                status="Submitted",
                created_at=now - timedelta(days=10),
                updated_at=now - timedelta(days=10),
            )
            db.add(ti)
            db.commit()

            expire_stale(db)
            db.commit()

            ti_after = db.query(TradeInRequest).filter(TradeInRequest.trade_in_id == 3).first()
            assert ti_after.status == "Submitted", "Submitted trade-in should stay Submitted"

        finally:
            db.close()
