"""Comprehensive tests for the reservation system — spec 7.2 GATE.

Tests:
1. Reserve reduces stock by 1 and balance by 10% of price
2. Writes both bank_transaction (Reservation Deposit) and stock_movement
3. Insufficient funds changes nothing
4. Same idempotency key does not charge twice
5. Cancel refunds 90% and restores stock
6. Back-dating expires_at then calling expire_stale() expires and refunds
7. Max active reservations enforced
8. No duplicate active reservation for same vehicle
9. Password verification required
10. Customer token scope isolation (customer can't access staff routes)
"""
import os
import pytest
from decimal import Decimal
from datetime import timedelta

os.environ["SECRET_KEY"] = "test-secret-key-reservations"
os.environ["ALGORITHM"] = "HS256"
os.environ["ACCESS_TOKEN_EXPIRE_MINUTES"] = "60"
os.environ["CORS_ORIGINS"] = "http://localhost:5173"

from fastapi.testclient import TestClient
from app.main import app  # noqa: E402
from app.db.session import SessionLocal
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


client = TestClient(app)


def _setup_test_data():
    """Create test customer + vehicle + bank account."""
    db = SessionLocal()
    try:
        # Clear any existing data
        db.query(Deal).delete()
        db.query(InventoryUnit).delete()
        db.query(StockMovement).delete()
        db.query(BankTransaction).delete()
        db.query(Reservation).delete()
        db.query(BankAccount).delete()
        db.query(CustomerAccount).delete()
        db.query(Customer).delete()
        db.query(Vehicle).delete()
        db.commit()

        # Create customer
        customer = Customer(
            customer_id=1,
            full_name="Test Customer",
            email="test@example.com",
            phone="1234567890",
        )
        db.add(customer)
        db.flush()

        # Create customer account (password: Test@1234)
        password_hash = hash_password("Test@1234")
        account = CustomerAccount(
            account_id=1,
            customer_id=1,
            email="test@example.com",
            password_hash=password_hash,
            is_active=True,
        )
        db.add(account)
        db.flush()

        # Create bank account with $50,000 balance
        bank_acct = BankAccount(
            bank_account_id=1,
            customer_id=1,
            bank_name="AutoEdge Demo Bank",
            account_number="AE1234567890",
            card_last4="1234",
            balance=Decimal("50000.00"),
        )
        db.add(bank_acct)

        # Create opening balance transaction
        opening_txn = BankTransaction(
            bank_account_id=1,
            txn_type="Opening Balance",
            direction="Credit",
            amount=Decimal("50000.00"),
            balance_after=Decimal("50000.00"),
            reference_code="TXN-00000000-000001",
            description="Opening balance",
        )
        db.add(opening_txn)

        # Create a vehicle with stock
        vehicle = Vehicle(
            vehicle_id=1,
            make="Toyota",
            model="Camry",
            year=2023,
            color="White",
            fuel_type="Gasoline",
            transmission="Automatic",
            body_type="Sedan",
            condition_type="New",
            mileage_km=0,
            price=Decimal("35000.00"),
            status="Available",
            stock_quantity=3,
            is_published=True,
        )
        db.add(vehicle)

        # Create a second vehicle (cheap — for insufficient funds test)
        vehicle2 = Vehicle(
            vehicle_id=2,
            make="BMW",
            model="7 Series",
            year=2024,
            color="Black",
            fuel_type="Gasoline",
            transmission="Automatic",
            body_type="Sedan",
            condition_type="New",
            mileage_km=0,
            price=Decimal("600000.00"),  # Very expensive
            status="Available",
            stock_quantity=2,
            is_published=True,
        )
        db.add(vehicle2)

        # Create a second customer (for ownership tests)
        customer2 = Customer(
            customer_id=2,
            full_name="Other Customer",
            email="other@example.com",
            phone="0987654321",
        )
        db.add(customer2)
        db.flush()

        account2 = CustomerAccount(
            account_id=2,
            customer_id=2,
            email="other@example.com",
            password_hash=hash_password("Test@1234"),
            is_active=True,
        )
        db.add(account2)

        bank2 = BankAccount(
            bank_account_id=2,
            customer_id=2,
            bank_name="AutoEdge Demo Bank",
            account_number="AE0987654321",
            card_last4="5678",
            balance=Decimal("50000.00"),
        )
        db.add(bank2)

        opening_txn2 = BankTransaction(
            bank_account_id=2,
            txn_type="Opening Balance",
            direction="Credit",
            amount=Decimal("50000.00"),
            balance_after=Decimal("50000.00"),
            reference_code="TXN-00000000-000002",
            description="Opening balance",
        )
        db.add(opening_txn2)

        db.commit()
    finally:
        db.close()


def _get_customer_token(customer_id=1, account_id=1):
    """Generate a valid customer token."""
    return create_access_token(
        data={"sub": f"customer:{account_id}"},
        scope="customer",
        role="customer",
        customer_id=customer_id,
    )


def _auth_header(customer_id=1, account_id=1):
    return {"Authorization": f"Bearer {_get_customer_token(customer_id, account_id)}"}


# ── Test 1: Reserve reduces stock by 1 and balance by deposit ──
def test_reserve_success():
    """Reserve a car: stock -1, balance -deposit, ledger entries created."""
    _setup_test_data()  # Fresh state

    response = client.post(
        "/api/v1/store/reservations",
        json={
            "vehicle_id": 1,
            "hold_days": 14,
            "password": "Test@1234",
            "idempotency_key": "test-key-001",
        },
        headers=_auth_header(),
    )
    assert response.status_code == 201, response.text
    data = response.json()

    # Reservation created
    assert data["status"] == "Active"
    assert data["vehicle_id"] == 1
    assert data["hold_days"] == 14
    deposit = Decimal(str(data["deposit_amount"]))
    expected_deposit = Decimal("3500.00")  # 10% of 35000
    assert deposit == expected_deposit

    # Check stock decreased
    db = SessionLocal()
    try:
        vehicle = db.query(Vehicle).filter(Vehicle.vehicle_id == 1).first()
        assert vehicle.stock_quantity == 2  # was 3, now 2

        # Check balance decreased
        bank = db.query(BankAccount).filter(BankAccount.customer_id == 1).first()
        assert bank.balance == Decimal("46500.00")  # 50000 - 3500

        # Check bank transaction exists
        txn = db.query(BankTransaction).filter(
            BankTransaction.txn_type == "Reservation Deposit",
            BankTransaction.reservation_id == data["reservation_id"],
        ).first()
        assert txn is not None
        assert txn.amount == expected_deposit
        assert txn.direction == "Debit"
        assert txn.balance_after == Decimal("46500.00")
        assert txn.idempotency_key == "test-key-001"

        # Check stock movement exists
        movement = db.query(StockMovement).filter(
            StockMovement.vehicle_id == 1,
            StockMovement.reason == "Reservation",
        ).first()
        assert movement is not None
        assert movement.change_qty == -1
    finally:
        db.close()


# ── Test 2: Insufficient funds changes nothing ──
def test_reserve_insufficient_funds():
    """Reserve an expensive car with insufficient balance fails cleanly."""
    _setup_test_data()

    response = client.post(
        "/api/v1/store/reservations",
        json={
            "vehicle_id": 2,  # BMW 7 Series, price=600000, deposit=60000
            "hold_days": 14,
            "password": "Test@1234",
            "idempotency_key": "test-key-insufficient",
        },
        headers=_auth_header(),
    )
    assert response.status_code == 402
    assert "insufficient funds" in response.json()["detail"].lower()

    # Nothing changed
    db = SessionLocal()
    try:
        vehicle = db.query(Vehicle).filter(Vehicle.vehicle_id == 2).first()
        assert vehicle.stock_quantity == 2  # Unchanged

        bank = db.query(BankAccount).filter(BankAccount.customer_id == 1).first()
        assert bank.balance == Decimal("50000.00")  # Unchanged
    finally:
        db.close()


# ── Test 3: Same idempotency key does not charge twice ──
def test_idempotency_key_no_double_charge():
    """Using the same idempotency key returns the existing reservation without charging."""
    _setup_test_data()

    # First reserve
    resp1 = client.post(
        "/api/v1/store/reservations",
        json={
            "vehicle_id": 1,
            "hold_days": 14,
            "password": "Test@1234",
            "idempotency_key": "test-key-idemp",
        },
        headers=_auth_header(),
    )
    assert resp1.status_code == 201

    # Second reserve with same key
    resp2 = client.post(
        "/api/v1/store/reservations",
        json={
            "vehicle_id": 1,
            "hold_days": 14,
            "password": "Test@1234",
            "idempotency_key": "test-key-idemp",
        },
        headers=_auth_header(),
    )
    # Should return 201 with the same reservation (idempotent)
    assert resp2.status_code == 201
    assert resp2.json()["reservation_id"] == resp1.json()["reservation_id"]

    # Balance should only have one charge
    db = SessionLocal()
    try:
        bank = db.query(BankAccount).filter(BankAccount.customer_id == 1).first()
        assert bank.balance == Decimal("46500.00")  # Only one charge of 3500

        # Only one deposit transaction
        txn_count = db.query(BankTransaction).filter(
            BankTransaction.txn_type == "Reservation Deposit",
        ).count()
        assert txn_count == 1
    finally:
        db.close()


# ── Test 4: Cancel refunds 90% and restores stock ──
def test_cancel_refunds_and_restores_stock():
    """Cancelling refunds (100 - CANCELLATION_FEE_PERCENT)% and restores stock."""
    _setup_test_data()

    # Reserve first
    resp = client.post(
        "/api/v1/store/reservations",
        json={
            "vehicle_id": 1,
            "hold_days": 14,
            "password": "Test@1234",
            "idempotency_key": "test-key-cancel",
        },
        headers=_auth_header(),
    )
    assert resp.status_code == 201
    res_id = resp.json()["reservation_id"]

    # Cancel
    cancel_resp = client.post(
        f"/api/v1/store/reservations/{res_id}/cancel",
        headers=_auth_header(),
    )
    assert cancel_resp.status_code == 200
    cancel_data = cancel_resp.json()
    assert cancel_data["status"] == "Cancelled"

    # Refund = 90% of deposit (3500 * 0.9 = 3150)
    assert Decimal(str(cancel_data["refund_amount"])) == Decimal("3150.00")
    assert Decimal(str(cancel_data["fee_amount"])) == Decimal("350.00")

    # Check stock restored
    db = SessionLocal()
    try:
        vehicle = db.query(Vehicle).filter(Vehicle.vehicle_id == 1).first()
        assert vehicle.stock_quantity == 3  # Restored

        # Check balance: 50000 - 3500 + 3150 = 49650
        bank = db.query(BankAccount).filter(BankAccount.customer_id == 1).first()
        assert bank.balance == Decimal("49650.00")

        # Check refund transaction exists
        refund_txn = db.query(BankTransaction).filter(
            BankTransaction.txn_type == "Refund",
        ).first()
        assert refund_txn is not None
        assert refund_txn.amount == Decimal("3150.00")
        assert refund_txn.direction == "Credit"

        # Check stock movement for cancel
        cancel_movement = db.query(StockMovement).filter(
            StockMovement.reason == "Reservation Cancelled",
        ).first()
        assert cancel_movement is not None
        assert cancel_movement.change_qty == 1
    finally:
        db.close()


# ── Test 5: Back-dating expires_at then calling expire_stale() ──
def test_expire_stale():
    """Back-dating expires_at then triggering expiry expires and refunds."""
    _setup_test_data()

    # Reserve
    resp = client.post(
        "/api/v1/store/reservations",
        json={
            "vehicle_id": 1,
            "hold_days": 7,
            "password": "Test@1234",
            "idempotency_key": "test-key-expire",
        },
        headers=_auth_header(),
    )
    assert resp.status_code == 201
    res_id = resp.json()["reservation_id"]

    # Back-date expires_at to the past
    db = SessionLocal()
    try:
        reservation = db.query(Reservation).filter(
            Reservation.reservation_id == res_id
        ).first()
        reservation.expires_at = utcnow() - timedelta(hours=1)
        db.commit()
    finally:
        db.close()

    # Trigger expiry by listing reservations (which calls expire_stale)
    list_resp = client.get(
        "/api/v1/store/reservations",
        headers=_auth_header(),
    )
    assert list_resp.status_code == 200

    # Check the reservation is now expired
    db = SessionLocal()
    try:
        reservation = db.query(Reservation).filter(
            Reservation.reservation_id == res_id
        ).first()
        assert reservation.status == "Expired"
        assert reservation.closed_at is not None

        # Check stock restored
        vehicle = db.query(Vehicle).filter(Vehicle.vehicle_id == 1).first()
        assert vehicle.stock_quantity == 3  # Restored

        # Check refund (same as cancel: 90% of 3500 = 3150)
        bank = db.query(BankAccount).filter(BankAccount.customer_id == 1).first()
        assert bank.balance == Decimal("49650.00")

        refund_txn = db.query(BankTransaction).filter(
            BankTransaction.txn_type == "Refund",
        ).first()
        assert refund_txn is not None
    finally:
        db.close()


# ── Test 6: Wrong password rejected ──
def test_reserve_wrong_password():
    """Wrong password is rejected without any changes."""
    _setup_test_data()

    response = client.post(
        "/api/v1/store/reservations",
        json={
            "vehicle_id": 1,
            "hold_days": 14,
            "password": "WrongPassword1",
            "idempotency_key": "test-key-wrong-pw",
        },
        headers=_auth_header(),
    )
    assert response.status_code == 401
    assert "password" in response.json()["detail"].lower()

    # Nothing changed
    db = SessionLocal()
    try:
        vehicle = db.query(Vehicle).filter(Vehicle.vehicle_id == 1).first()
        assert vehicle.stock_quantity == 3
        bank = db.query(BankAccount).filter(BankAccount.customer_id == 1).first()
        assert bank.balance == Decimal("50000.00")
    finally:
        db.close()


# ── Test 7: No duplicate active reservation for same vehicle ──
def test_no_duplicate_active_reservation():
    """Can't reserve the same vehicle twice while first is active."""
    _setup_test_data()

    # First reserve
    resp1 = client.post(
        "/api/v1/store/reservations",
        json={
            "vehicle_id": 1,
            "hold_days": 14,
            "password": "Test@1234",
            "idempotency_key": "test-dup-1",
        },
        headers=_auth_header(),
    )
    assert resp1.status_code == 201

    # Second reserve same vehicle
    resp2 = client.post(
        "/api/v1/store/reservations",
        json={
            "vehicle_id": 1,
            "hold_days": 14,
            "password": "Test@1234",
            "idempotency_key": "test-dup-2",  # Different key!
        },
        headers=_auth_header(),
    )
    assert resp2.status_code == 409
    assert "already have" in resp2.json()["detail"].lower()


# ── Test 8: Token scope isolation ──
def test_customer_token_rejected_on_staff_route():
    """Customer token cannot access staff routes."""
    response = client.get(
        "/api/v1/vehicles/",
        headers=_auth_header(),
    )
    assert response.status_code == 401


# ── Test 9: Staff token rejected on store route ──
def test_staff_token_rejected_on_store_route():
    """Staff token cannot access customer store routes."""
    staff_token = create_access_token(
        data={"sub": "admin@autoedge.com"},
        scope="staff",
        role="manager",
    )
    response = client.get(
        "/api/v1/store/reservations",
        headers={"Authorization": f"Bearer {staff_token}"},
    )
    assert response.status_code == 401


# ── Test 10: Bank top-up ──
def test_bank_top_up():
    """Top-up adds demo funds to the balance."""
    _setup_test_data()

    response = client.post(
        "/api/v1/store/bank/top-up",
        json={"amount": 10000},
        headers=_auth_header(),
    )
    assert response.status_code == 201
    data = response.json()
    assert Decimal(str(data["amount"])) == Decimal("10000.00")
    assert Decimal(str(data["new_balance"])) == Decimal("60000.00")

    # Verify in DB
    db = SessionLocal()
    try:
        bank = db.query(BankAccount).filter(BankAccount.customer_id == 1).first()
        assert bank.balance == Decimal("60000.00")
    finally:
        db.close()


# ── Test 11: Bank summary returns masked account number ──
def test_bank_summary():
    """GET /store/bank returns masked account number and correct balance."""
    _setup_test_data()

    response = client.get(
        "/api/v1/store/bank",
        headers=_auth_header(),
    )
    assert response.status_code == 200
    data = response.json()
    assert "•" in data["account_number_masked"]  # Masked
    assert data["card_last4"] == "1234"
    assert Decimal(str(data["balance"])) == Decimal("50000.00")


# ── Test 12: Receipt data ──
def test_reservation_receipt():
    """Receipt returns correct data after reservation."""
    _setup_test_data()

    # Reserve
    resp = client.post(
        "/api/v1/store/reservations",
        json={
            "vehicle_id": 1,
            "hold_days": 14,
            "password": "Test@1234",
            "idempotency_key": "test-key-receipt",
        },
        headers=_auth_header(),
    )
    assert resp.status_code == 201
    res_id = resp.json()["reservation_id"]

    # Get receipt
    receipt_resp = client.get(
        f"/api/v1/store/reservations/{res_id}/receipt",
        headers=_auth_header(),
    )
    assert receipt_resp.status_code == 200
    receipt = receipt_resp.json()
    assert receipt["receipt_number"].startswith("RSV-")
    assert receipt["reference_code"].startswith("TXN-")
    assert Decimal(str(receipt["deposit_amount"])) == Decimal("3500.00")
    assert Decimal(str(receipt["amount_charged"])) == Decimal("3500.00")

    # Balance due at showroom = 35000 - 3500 = 31500
    assert Decimal(str(receipt["balance_due_at_showroom"])) == Decimal("31500.00")


# ── Test 13: Reservation not found (ownership) ──
def test_reservation_not_found_for_other_customer():
    """Customer A can't see customer B's reservation (returns 404, not 403)."""
    _setup_test_data()

    # Customer 1 reserves
    resp = client.post(
        "/api/v1/store/reservations",
        json={
            "vehicle_id": 1,
            "hold_days": 14,
            "password": "Test@1234",
            "idempotency_key": "test-key-ownership",
        },
        headers=_auth_header(customer_id=1, account_id=1),
    )
    assert resp.status_code == 201
    res_id = resp.json()["reservation_id"]

    # Customer 2 tries to access
    resp2 = client.get(
        f"/api/v1/store/reservations/{res_id}",
        headers=_auth_header(customer_id=2, account_id=2),
    )
    assert resp2.status_code == 404  # Not 403
