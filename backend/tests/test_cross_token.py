"""P47 Cross-token isolation tests — spec section 14.

Verifies that:
- Customer tokens cannot access ANY staff endpoint
- Staff tokens cannot access ANY store endpoint
- No token at all gets 401 on protected endpoints
"""
import os
import pytest

os.environ["SECRET_KEY"] = "test-secret-key-cross-token"
os.environ["ALGORITHM"] = "HS256"
os.environ["ACCESS_TOKEN_EXPIRE_MINUTES"] = "60"
os.environ["CORS_ORIGINS"] = "http://localhost:5173"

from fastapi.testclient import TestClient
from app.main import app  # noqa: E402
from app.db.session import SessionLocal
from app.core.security import hash_password, create_access_token
from app.core.time import utcnow
from app.models.user import User
from app.models.customer import Customer
from app.models.customer_account import CustomerAccount
from app.models.bank_account import BankAccount
from app.models.bank_transaction import BankTransaction
from app.models.vehicle import Vehicle
from app.models.deal import Deal, InventoryUnit
from decimal import Decimal


client = TestClient(app)


def _setup_data():
    """Create a staff user and a customer for token generation."""
    db = SessionLocal()
    try:
        # Clear
        for model in [Deal, InventoryUnit, BankTransaction, BankAccount, CustomerAccount, Customer, Vehicle, User]:
            db.query(model).delete()
        db.commit()

        # Staff user (manager)
        staff = User(
            user_id=1,
            full_name="Manager Admin",
            email="manager@test.com",
            role="manager",
            password_hash=hash_password("Admin@1234"),
            is_active=True,
        )
        db.add(staff)

        # Customer
        customer = Customer(
            customer_id=1,
            full_name="Customer One",
            email="cust1@test.com",
            phone="0987654321",
        )
        db.add(customer)
        db.flush()

        # Customer account
        account = CustomerAccount(
            account_id=1,
            customer_id=1,
            email="cust1@test.com",
            password_hash=hash_password("Cust@1234"),
            is_active=True,
        )
        db.add(account)

        # Bank account
        bank = BankAccount(
            bank_account_id=1,
            customer_id=1,
            bank_name="Demo Bank",
            account_number="AE1111111111",
            card_last4="1111",
            balance=Decimal("10000.00"),
        )
        db.add(bank)

        txn = BankTransaction(
            bank_account_id=1,
            txn_type="Opening Balance",
            direction="Credit",
            amount=Decimal("10000.00"),
            balance_after=Decimal("10000.00"),
            reference_code="TXN-00000000-000001",
            description="Opening balance",
        )
        db.add(txn)

        # Vehicle
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

        db.commit()
    finally:
        db.close()


def _customer_token():
    """Generate a valid customer token."""
    return create_access_token(
        data={"sub": "customer:1"},
        scope="customer",
        role="customer",
        customer_id=1,
    )


def _staff_token():
    """Generate a valid staff (manager) token."""
    return create_access_token(
        data={"sub": "manager@test.com"},
        scope="staff",
        role="manager",
    )


def _customer_headers():
    return {"Authorization": f"Bearer {_customer_token()}"}


def _staff_headers():
    return {"Authorization": f"Bearer {_staff_token()}"}


# ═══════════════════════════════════════════════════════════════════
# Customer token on staff routes → 401
# ═══════════════════════════════════════════════════════════════════

class TestCustomerTokenOnStaffRoutes:
    """Customer tokens must be rejected on all staff endpoints."""

    def test_customer_on_users_list(self):
        _setup_data()
        resp = client.get("/api/v1/users/", headers=_customer_headers())
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"

    def test_customer_on_vehicles_list(self):
        resp = client.get("/api/v1/vehicles/", headers=_customer_headers())
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"

    def test_customer_on_dashboard_stats(self):
        resp = client.get("/api/v1/dashboard/stats", headers=_customer_headers())
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"

    def test_customer_on_sales_list(self):
        resp = client.get("/api/v1/sales/", headers=_customer_headers())
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"

    def test_customer_on_test_drives_list(self):
        resp = client.get("/api/v1/test-drives/", headers=_customer_headers())
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"

    def test_customer_on_service_list(self):
        resp = client.get("/api/v1/service/", headers=_customer_headers())
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"

    def test_customer_on_commissions(self):
        resp = client.get("/api/v1/commissions/", headers=_customer_headers())
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"

    def test_customer_on_customers_list(self):
        resp = client.get("/api/v1/customers/", headers=_customer_headers())
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"

    def test_customer_on_staff_reservations(self):
        resp = client.get("/api/v1/reservations", headers=_customer_headers())
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"

    def test_customer_on_staff_trade_ins(self):
        resp = client.get("/api/v1/trade-ins", headers=_customer_headers())
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"

    def test_customer_on_staff_restock(self):
        # Staff restock route: /api/v1/restock/priority (no prefix on router)
        resp = client.get("/api/v1/restock/priority", headers=_customer_headers())
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"

    def test_customer_on_reviews_moderation(self):
        resp = client.get("/api/v1/reviews/", headers=_customer_headers())
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"

    def test_customer_on_email_log(self):
        resp = client.get("/api/v1/email-log", headers=_customer_headers())
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"

    def test_customer_on_enquiries_staff(self):
        resp = client.get("/api/v1/enquiries/", headers=_customer_headers())
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"

    def test_customer_on_service_bookings_staff(self):
        resp = client.get("/api/v1/service-bookings/", headers=_customer_headers())
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"


# ═══════════════════════════════════════════════════════════════════
# Staff token on store routes → 401
# ═══════════════════════════════════════════════════════════════════

class TestStaffTokenOnStoreRoutes:
    """Staff tokens must be rejected on all store (customer) endpoints."""

    def test_staff_on_store_me(self):
        resp = client.get("/api/v1/store/me", headers=_staff_headers())
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"

    def test_staff_on_store_bank(self):
        resp = client.get("/api/v1/store/bank", headers=_staff_headers())
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"

    def test_staff_on_store_reservations(self):
        resp = client.get("/api/v1/store/reservations", headers=_staff_headers())
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"

    def test_staff_on_store_wishlist(self):
        resp = client.get("/api/v1/store/wishlist", headers=_staff_headers())
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"

    def test_staff_on_store_notifications(self):
        resp = client.get("/api/v1/store/notifications", headers=_staff_headers())
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"

    def test_staff_on_store_trade_ins(self):
        resp = client.get("/api/v1/store/trade-ins/", headers=_staff_headers())
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"

    def test_staff_on_store_garage(self):
        resp = client.get("/api/v1/store/garage", headers=_staff_headers())
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"

    def test_staff_on_store_service_bookings(self):
        resp = client.get("/api/v1/store/service-bookings", headers=_staff_headers())
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"

    def test_staff_on_store_reviews(self):
        resp = client.get("/api/v1/store/reviews/", headers=_staff_headers())
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"

    def test_staff_on_store_enquiries(self):
        resp = client.get("/api/v1/store/enquiries/", headers=_staff_headers())
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"

    def test_staff_on_store_test_drives(self):
        resp = client.get("/api/v1/store/test-drives/", headers=_staff_headers())
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"

    def test_staff_on_store_restock(self):
        resp = client.get("/api/v1/store/restock-requests", headers=_staff_headers())
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"


# ═══════════════════════════════════════════════════════════════════
# No token at all → 401
# ═══════════════════════════════════════════════════════════════════

class TestNoTokenRejected:
    """Endpoints must reject requests with no Authorization header."""

    def test_no_token_staff_users(self):
        resp = client.get("/api/v1/users/")
        assert resp.status_code == 401

    def test_no_token_staff_vehicles(self):
        resp = client.get("/api/v1/vehicles/")
        assert resp.status_code == 401

    def test_no_token_store_me(self):
        resp = client.get("/api/v1/store/me")
        assert resp.status_code == 401

    def test_no_token_store_bank(self):
        resp = client.get("/api/v1/store/bank")
        assert resp.status_code == 401

    def test_no_token_store_reservations(self):
        resp = client.get("/api/v1/store/reservations")
        assert resp.status_code == 401


# ═══════════════════════════════════════════════════════════════════
# Public routes accessible without token
# ═══════════════════════════════════════════════════════════════════

class TestPublicRoutesAccessible:
    """Public endpoints must work without any token."""

    def test_public_vehicles(self):
        resp = client.get("/api/v1/public/vehicles")
        assert resp.status_code == 200

    def test_public_vehicle_filters(self):
        resp = client.get("/api/v1/public/vehicles/filters")
        assert resp.status_code == 200

    def test_public_featured(self):
        resp = client.get("/api/v1/public/vehicles/featured")
        assert resp.status_code == 200

    def test_public_service_types(self):
        resp = client.get("/api/v1/public/service-types")
        assert resp.status_code == 200

    def test_public_technicians(self):
        resp = client.get("/api/v1/public/technicians")
        assert resp.status_code == 200

    def test_health(self):
        # Health endpoint is at root, not under /api/v1
        resp = client.get("/health")
        assert resp.status_code == 200

    def test_docs(self):
        resp = client.get("/docs")
        assert resp.status_code == 200
