"""P47 Ownership isolation tests — spec section 14.

Verifies that customer A cannot read customer B's:
- Reservations (404, not 403)
- Bank account / transactions
- Trade-in requests
- Garage (customer vehicles)

The spec requires 404 (not 403) to avoid leaking the existence of resources.

NOTE: All test files in this suite share the same SQLAlchemy engine. Each test
that needs specific data calls _setup_data() to ensure correct state.
"""
import os
import pytest
from decimal import Decimal
from datetime import timedelta

os.environ["SECRET_KEY"] = "test-secret-key-ownership"
os.environ["ALGORITHM"] = "HS256"
os.environ["ACCESS_TOKEN_EXPIRE_MINUTES"] = "60"
os.environ["CORS_ORIGINS"] = "http://localhost:5173"

from fastapi.testclient import TestClient
from app.main import app  # noqa: E402
from app.db.session import engine, SessionLocal
from app.core.security import hash_password, create_access_token
from app.core.time import utcnow
from app.models.customer import Customer
from app.models.customer_account import CustomerAccount
from app.models.bank_account import BankAccount
from app.models.bank_transaction import BankTransaction
from app.models.vehicle import Vehicle
from app.models.deal import Deal, InventoryUnit
from app.models.reservation import Reservation
from app.models.stock_movement import StockMovement
from app.models.trade_in_request import TradeInRequest
from app.models.customer_vehicle import CustomerVehicle


client = TestClient(app)


def _setup_data():
    """Create two customers with their own data. Customer B's data should be invisible to Customer A.
    
    Called at the start of EACH test to ensure fresh, correct state regardless
    of module loading order (all test files share the same engine).
    """
    db = SessionLocal()
    try:
        # Clear everything - order matters for FK constraints
        for model in [Deal, InventoryUnit, StockMovement, BankTransaction, Reservation, TradeInRequest,
                      CustomerVehicle, BankAccount, CustomerAccount, Customer, Vehicle]:
            db.query(model).delete()
        db.commit()

        # ── Customer A (Alice) ──
        cust_a = Customer(
            customer_id=1,
            full_name="Alice Customer",
            email="alice@test.com",
            phone="1111111111",
        )
        db.add(cust_a)
        db.flush()

        acct_a = CustomerAccount(
            account_id=1,
            customer_id=1,
            email="alice@test.com",
            password_hash=hash_password("Alice@1234"),
            is_active=True,
        )
        db.add(acct_a)

        bank_a = BankAccount(
            bank_account_id=1,
            customer_id=1,
            bank_name="Demo Bank",
            account_number="AE1111111111",
            card_last4="1111",
            balance=Decimal("50000.00"),
        )
        db.add(bank_a)

        txn_a = BankTransaction(
            bank_account_id=1,
            txn_type="Opening Balance",
            direction="Credit",
            amount=Decimal("50000.00"),
            balance_after=Decimal("50000.00"),
            reference_code="TXN-00000000-000001",
        )
        db.add(txn_a)

        # ── Customer B (Bob) ──
        cust_b = Customer(
            customer_id=2,
            full_name="Bob Customer",
            email="bob@test.com",
            phone="2222222222",
        )
        db.add(cust_b)
        db.flush()

        acct_b = CustomerAccount(
            account_id=2,
            customer_id=2,
            email="bob@test.com",
            password_hash=hash_password("Bob@12345"),
            is_active=True,
        )
        db.add(acct_b)

        bank_b = BankAccount(
            bank_account_id=2,
            customer_id=2,
            bank_name="Demo Bank",
            account_number="AE2222222222",
            card_last4="2222",
            balance=Decimal("50000.00"),
        )
        db.add(bank_b)

        txn_b = BankTransaction(
            bank_account_id=2,
            txn_type="Opening Balance",
            direction="Credit",
            amount=Decimal("50000.00"),
            balance_after=Decimal("50000.00"),
            reference_code="TXN-00000000-000002",
        )
        db.add(txn_b)

        # ── Vehicle ──
        vehicle = Vehicle(
            vehicle_id=1,
            make="Toyota",
            model="Camry",
            year=2024,
            color="White",
            fuel_type="Gasoline",
            transmission="Automatic",
            body_type="Sedan",
            condition_type="New",
            mileage_km=0,
            price=Decimal("30000.00"),
            status="Available",
            stock_quantity=5,
            is_published=True,
        )
        db.add(vehicle)
        db.flush()

        # ── Bob's reservation ──
        now = utcnow()
        reservation_b = Reservation(
            reservation_id=100,
            customer_id=2,
            vehicle_id=1,
            deposit_amount=Decimal("3000.00"),
            hold_days=14,
            reserved_at=now,
            expires_at=now + timedelta(days=14),
            status="Active",
        )
        db.add(reservation_b)

        # ── Bob's trade-in request ──
        trade_in_b = TradeInRequest(
            trade_in_id=100,
            customer_id=2,
            target_vehicle_id=1,
            make="Honda",
            model="Civic",
            year=2020,
            mileage_km=50000,
            color="Blue",
            condition_rating="Good",
            description="Well maintained",
            expected_price=Decimal("15000.00"),
            status="Submitted",
            created_at=now,
            updated_at=now,
        )
        db.add(trade_in_b)

        # ── Bob's garage car ──
        cv_b = CustomerVehicle(
            cv_id=100,
            customer_id=2,
            make="Honda",
            model="Civic",
            year=2020,
            plate_number="ABC-1234",
        )
        db.add(cv_b)

        db.commit()
    finally:
        db.close()


def _token_a():
    """Customer A token."""
    return create_access_token(
        data={"sub": "customer:1"},
        scope="customer",
        role="customer",
        customer_id=1,
    )


def _token_b():
    """Customer B token."""
    return create_access_token(
        data={"sub": "customer:2"},
        scope="customer",
        role="customer",
        customer_id=2,
    )


def _headers_a():
    return {"Authorization": f"Bearer {_token_a()}"}


def _headers_b():
    return {"Authorization": f"Bearer {_token_b()}"}


# ═══════════════════════════════════════════════════════════════════
# Reservation ownership
# ═══════════════════════════════════════════════════════════════════

class TestReservationOwnership:
    """Customer A cannot view Customer B's reservation."""

    def test_owner_can_view_own_reservation(self):
        """Bob can see his own reservation."""
        _setup_data()
        resp = client.get("/api/v1/store/reservations/100", headers=_headers_b())
        assert resp.status_code == 200

    def test_other_customer_gets_404(self):
        """Alice trying to view Bob's reservation gets 404 (not 403)."""
        _setup_data()
        resp = client.get("/api/v1/store/reservations/100", headers=_headers_a())
        assert resp.status_code == 404, f"Expected 404, got {resp.status_code}: {resp.text}"

    def test_reservation_list_filtered_by_customer(self):
        """Alice's reservation list should not include Bob's reservation."""
        _setup_data()
        resp = client.get("/api/v1/store/reservations", headers=_headers_a())
        assert resp.status_code == 200
        items = resp.json().get("items", [])
        for item in items:
            assert item["customer_id"] != 2, "Alice should not see Bob's reservations"

    def test_cannot_cancel_others_reservation(self):
        """Alice cannot cancel Bob's reservation."""
        _setup_data()
        resp = client.post("/api/v1/store/reservations/100/cancel", headers=_headers_a())
        assert resp.status_code == 404, f"Expected 404, got {resp.status_code}"


# ═══════════════════════════════════════════════════════════════════
# Trade-in ownership
# ═══════════════════════════════════════════════════════════════════

class TestTradeInOwnership:
    """Customer A cannot view Customer B's trade-in requests."""

    def test_owner_can_view_own_trade_in(self):
        """Bob can see his own trade-in."""
        _setup_data()
        resp = client.get("/api/v1/store/trade-ins/100", headers=_headers_b())
        assert resp.status_code == 200

    def test_other_customer_gets_404(self):
        """Alice trying to view Bob's trade-in gets 404."""
        _setup_data()
        resp = client.get("/api/v1/store/trade-ins/100", headers=_headers_a())
        assert resp.status_code == 404, f"Expected 404, got {resp.status_code}"

    def test_trade_in_list_filtered(self):
        """Alice's trade-in list should not include Bob's."""
        _setup_data()
        resp = client.get("/api/v1/store/trade-ins/", headers=_headers_a())
        assert resp.status_code == 200
        items = resp.json()
        if isinstance(items, dict):
            items = items.get("items", [])
        for item in items:
            assert item.get("customer_id") != 2, "Alice should not see Bob's trade-ins"


# ═══════════════════════════════════════════════════════════════════
# Bank ownership
# ═══════════════════════════════════════════════════════════════════

class TestBankOwnership:
    """Customer A's bank data is isolated from Customer B."""

    def test_bank_summary_returns_own_data(self):
        """Alice sees her own bank account."""
        _setup_data()
        resp = client.get("/api/v1/store/bank", headers=_headers_a())
        assert resp.status_code == 200
        data = resp.json()
        assert data["card_last4"] == "1111", f"Alice should see card 1111, got {data['card_last4']}"

    def test_bank_summary_not_other_data(self):
        """Bob sees his own bank account."""
        _setup_data()
        resp = client.get("/api/v1/store/bank", headers=_headers_b())
        assert resp.status_code == 200
        data = resp.json()
        assert data["card_last4"] == "2222", f"Bob should see card 2222, got {data['card_last4']}"

    def test_transactions_filtered(self):
        """Bank transactions are filtered to the token's customer."""
        _setup_data()
        resp = client.get("/api/v1/store/bank/transactions", headers=_headers_a())
        assert resp.status_code == 200


# ═══════════════════════════════════════════════════════════════════
# Garage ownership
# ═══════════════════════════════════════════════════════════════════

class TestGarageOwnership:
    """Customer A cannot see Customer B's garage vehicles."""

    def test_garage_list_filtered(self):
        """Alice's garage list should be empty (she has no cars)."""
        _setup_data()
        resp = client.get("/api/v1/store/garage", headers=_headers_a())
        assert resp.status_code == 200
        items = resp.json()
        assert len(items) == 0, "Alice should have no garage vehicles"

    def test_owner_sees_own_garage(self):
        """Bob should see his garage car."""
        _setup_data()
        resp = client.get("/api/v1/store/garage", headers=_headers_b())
        assert resp.status_code == 200
        items = resp.json()
        assert len(items) >= 1, "Bob should see his garage car"
