"""Staff portal regressions exercised through the staff and storefront APIs."""
import json
import logging
import os
from functools import partial
from datetime import date, time, timedelta
from decimal import Decimal

import httpx
import pytest

os.environ["DATABASE_URL"] = "sqlite://"
os.environ.setdefault("SECRET_KEY", "staff-portal-test")

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_db
from app.core.config import Settings, settings
from app.core.security import create_access_token, hash_password
from app.core.time import utcnow
from app.db.base import Base
from app.main import app
from app.models.bank_account import BankAccount
from app.models.bank_transaction import BankTransaction
from app.models.customer import Customer
from app.models.customer_vehicle import CustomerVehicle
from app.models.notification import Notification
from app.models.reservation import Reservation
from app.models.service_booking import ServiceBooking
from app.models.service_type import ServiceType
from app.models.stock_movement import StockMovement
from app.models.user import User
from app.models.vehicle import Vehicle
from app.services import email_service
from app.services.reservation_service import expire_stale

API = "/api/v1"
PASSWORD = "LocalPass91"


@pytest.fixture
def setup(monkeypatch):
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine, autoflush=False)
    monkeypatch.setattr(settings, "EMAIL_PROVIDER", "none")

    def use_test_db():
        with sessions() as db:
            yield db

    app.dependency_overrides[get_db] = use_test_db
    try:
        with sessions.begin() as db:
            db.add(User(email="manager@autoedge.com", full_name="Manager", role="manager",
                        password_hash=hash_password(PASSWORD)))
        yield TestClient(app), sessions, staff_headers("manager@autoedge.com")
    finally:
        app.dependency_overrides.pop(get_db)
        engine.dispose()


def headers(token):
    return {"Authorization": f"Bearer {token}"}


def staff_headers(email):
    return headers(create_access_token({"sub": email}, scope="staff"))


def signup(client, email="buyer@example.com"):
    response = client.post(f"{API}/store/auth/register", json={
        "full_name": "Local Buyer", "email": email, "phone": "+923001234567",
        "password": PASSWORD, "confirm_password": PASSWORD,
    })
    assert response.status_code == 201, response.text
    payload = response.json()
    return payload["customer"]["customer_id"], headers(payload["access_token"])


def add_vehicle(db, model="Fortuner", year=2023, price="12000", stock=3, vin=None):
    vehicle = Vehicle(
        make="Toyota", model=model, year=year, color="Pearl White",
        fuel_type="Gasoline", transmission="Automatic", body_type="SUV",
        condition_type="Used", price=Decimal(price), stock_quantity=stock, is_published=True,
        vin_number=vin, status="Available",
    )
    db.add(vehicle)
    db.flush()
    return vehicle.vehicle_id


def add_user(db, role, handles_enquiries=False, module_access=None):
    email = f"{role}@autoedge.com"
    user = User(email=email, full_name=role.title(), role=role,
                password_hash=hash_password(PASSWORD), handles_enquiries=handles_enquiries,
                module_access=module_access or {})
    db.add(user)
    db.flush()
    return user.user_id, staff_headers(email)


def reserve(client, customer, vehicle_id, key):
    response = client.post(f"{API}/store/reservations", headers=customer, json={
        "vehicle_id": vehicle_id, "hold_days": 7, "password": PASSWORD, "idempotency_key": key,
    })
    assert response.status_code == 201, response.text
    return response.json()["reservation_id"]


def test_stock_status_after_manual_edits_and_a_reserved_sale(setup):
    client, sessions, manager = setup
    customer_id, customer = signup(client)
    response = client.post(f"{API}/vehicles/", headers=manager, json={
        "make": "Toyota", "model": "Fortuner", "year": 2023, "price": 12000, "stock_quantity": 0,
    })
    assert response.status_code == 201, response.text
    vehicle_id = response.json()["vehicle_id"]
    assert response.json()["status"] == "Sold"
    response = client.put(f"{API}/vehicles/{vehicle_id}", headers=manager,
                          json={"stock_quantity": 1, "status": "Reserved"})
    assert response.json()["status"] == "Available"
    reservation_id = reserve(client, customer, vehicle_id, "convert-test")
    with sessions() as db:
        staff_id = db.query(User.user_id).filter_by(role="manager").scalar()
    response = client.post(f"{API}/sales/", headers=manager, json={
        "staff_id": staff_id, "vehicle_id": vehicle_id, "customer_id": customer_id,
        "sale_price": 12000, "status": "Completed", "reservation_id": reservation_id,
    })
    assert response.status_code == 201, response.text
    vehicle = client.get(f"{API}/vehicles/{vehicle_id}", headers=manager).json()
    assert (vehicle["stock_quantity"], vehicle["status"]) == (0, "Sold")


def test_service_job_form_has_real_vehicle_customer_and_technician_options(setup):
    client, sessions, manager = setup
    customer_id, _ = signup(client)
    with sessions.begin() as db:
        vehicle_id = add_vehicle(db)
        tech_id, _ = add_user(db, "technician")
        _, receptionist = add_user(db, "receptionist")

    options = client.get(f"{API}/service/form-options", headers=receptionist).json()
    assert [v["vehicle_id"] for v in options["vehicles"]] == [vehicle_id]
    assert [c["customer_id"] for c in options["customers"]] == [customer_id]
    assert [t["user_id"] for t in options["technicians"]] == [tech_id]
    job = client.post(f"{API}/service/", headers=manager, json={
        "vehicle_id": vehicle_id, "customer_id": customer_id, "technician_id": tech_id,
        "job_type": "Oil change",
    })
    assert job.status_code == 201, job.text
    assert job.json()["technician_id"] == tech_id


def test_vehicle_search_reserved_filter_sort_and_pagination(setup):
    client, sessions, manager = setup
    _, customer = signup(client)
    with sessions.begin() as db:
        first = add_vehicle(db, price="12000", vin="JT000ABCDEFGHIJKL")
        second = add_vehicle(db, price="14000", year=2024)
        add_vehicle(db, model="Corolla", price="9000")
    reserve(client, customer, first, "reserve-first")
    reserve(client, customer, second, "reserve-second")

    def list_vehicles(**params):
        response = client.get(f"{API}/vehicles/", headers=manager, params=params)
        assert response.status_code == 200, response.text
        return response.json()

    for search in ("TOYOTA fortuner", "fortuner 2023 white", "jt000 pearl", "  toyota   2023  "):
        result = list_vehicles(search=search)
        assert first in [item["vehicle_id"] for item in result["items"]]
    assert list_vehicles(search="fortuner camry")["total"] == 0
    assert list_vehicles(search="%")["total"] == 0
    for skip, expected in enumerate((second, first)):
        page = list_vehicles(search="toyota fortuner", status="Reserved", sort="price",
                             direction="desc", skip=skip, limit=1)
        assert page["total"] == 2
        row = page["items"][0]
        assert (row["vehicle_id"], row["status"], row["active_reservation_count"]) == (expected, "Available", 1)


@pytest.mark.parametrize("read_from", ["staff-list", "store-detail", "failed-create", "cancel", "background"])
def test_expiry_atomic_refund_and_repeat_safety(setup, read_from):
    client, sessions, manager = setup
    customer_id, customer = signup(client)
    with sessions.begin() as db:
        vehicle_id = add_vehicle(db, stock=1)
    reservation_id = reserve(client, customer, vehicle_id, "due-hold")
    with sessions.begin() as db:
        db.get(Reservation, reservation_id).expires_at = utcnow() - timedelta(hours=2)

    if read_from == "staff-list":
        response = client.get(f"{API}/reservations", headers=manager, params={"status_filter": "Expired"})
        assert response.json()["items"][0]["status"] == "Expired"
    elif read_from == "store-detail":
        response = client.get(f"{API}/store/reservations/{reservation_id}", headers=customer)
        assert response.json()["status"] == "Expired"
        assert response.json()["expires_at"].endswith("Z")
    elif read_from == "cancel":
        response = client.post(f"{API}/reservations/{reservation_id}/cancel", headers=manager)
        assert response.status_code == 409, response.text
    elif read_from == "failed-create":
        response = client.post(f"{API}/store/reservations", headers=customer, json={
            "vehicle_id": vehicle_id, "hold_days": 7, "password": "WrongPass9",
            "idempotency_key": "failed-reservation",
        })
        assert response.status_code == 401, response.text
    else:
        with sessions.begin() as db:
            assert expire_stale(db) == 1

    with sessions.begin() as db:
        assert expire_stale(db) == 0
        assert db.get(Reservation, reservation_id).status == "Expired"
        assert db.get(Vehicle, vehicle_id).stock_quantity == 1
        assert db.query(BankAccount).filter_by(customer_id=customer_id).one().balance == settings.DEMO_STARTING_BALANCE - Decimal("120")
        refund = db.query(BankTransaction).filter_by(reservation_id=reservation_id, txn_type="Refund").one()
        assert refund.amount == Decimal("1080.00")
        assert db.query(StockMovement).filter_by(reference_id=reservation_id, reason="Reservation Expired").one().change_qty == 1
        assert db.query(Notification).filter_by(customer_id=customer_id, type="reservation_expired").count() == 1


def test_staff_customer_provisioning_reset_and_deactivation(setup):
    client, sessions, manager = setup
    data = {
        "full_name": "Staff Created", "email": "StaffCreated@example.com", "phone": "+923001234567",
        "password": PASSWORD, "confirm_password": PASSWORD,
    }
    assert client.post(f"{API}/customers/", headers=manager, json={**data, "confirm_password": "different"}).status_code == 422
    response = client.post(f"{API}/customers/", headers=manager, json=data)
    assert response.status_code == 201, response.text
    assert "password" not in response.json() and "password_hash" not in response.json()
    customer_id = response.json()["customer_id"]
    assert client.post(f"{API}/customers/", headers=manager, json={**data, "email": data["email"].lower()}).status_code == 409
    with sessions() as db:
        bank = db.query(BankAccount).filter_by(customer_id=customer_id).one()
        opening = db.query(BankTransaction).filter_by(bank_account_id=bank.bank_account_id).one()
        assert opening.txn_type == "Opening Balance"
        assert bank.balance == settings.DEMO_STARTING_BALANCE == opening.amount

    login = {"email": data["email"], "password": PASSWORD}
    response = client.post(f"{API}/store/auth/login", json=login)
    assert response.status_code == 200, response.text
    customer = headers(response.json()["access_token"])
    new = "ChangedPass92"
    assert client.put(f"{API}/customers/{customer_id}", headers=manager, json={
        "new_password": new, "confirm_password": new,
    }).status_code == 200
    assert client.post(f"{API}/store/auth/login", json=login).status_code == 401
    assert client.post(f"{API}/store/auth/login", json={**login, "password": new}).status_code == 200
    assert client.delete(f"{API}/customers/{customer_id}", headers=manager).status_code == 409
    assert client.post(f"{API}/customers/{customer_id}/deactivate", headers=manager).json()["is_active"] is False
    assert client.get(f"{API}/store/me", headers=customer).status_code == 403
    assert client.post(f"{API}/store/auth/login", json={**login, "password": new}).status_code == 403


def test_legacy_customer_can_gain_an_account_or_be_deleted(setup):
    client, sessions, manager = setup
    with sessions.begin() as db:
        legacy = Customer(full_name="Legacy Customer", email="legacy@example.com", phone="03001234567")
        disposable = Customer(full_name="Disposable", phone="03001234567")
        db.add_all([legacy, disposable])
        db.flush()
        legacy_id, disposable_id = legacy.customer_id, disposable.customer_id
    assert client.delete(f"{API}/customers/{disposable_id}", headers=manager).status_code == 204
    updated = client.put(f"{API}/customers/{legacy_id}", headers=manager, json={
        "new_password": PASSWORD, "confirm_password": PASSWORD,
    })
    assert updated.status_code == 200, updated.text
    assert client.post(f"{API}/store/auth/login", json={
        "email": "legacy@example.com", "password": PASSWORD,
    }).status_code == 200
    with sessions() as db:
        assert db.query(BankAccount).filter_by(customer_id=legacy_id).count() == 1


def test_trade_in_photos_and_offer_are_available_to_staff(setup):
    client, sessions, manager = setup
    _, customer = signup(client)
    with sessions.begin() as db:
        _, sales = add_user(db, "sales_executive")
    photos = [f"https://example.com/trade-{i}.jpg" for i in range(3)]
    response = client.post(f"{API}/store/trade-ins", headers=customer, json={
        "make": "Toyota", "model": "Fortuner", "year": 2023, "mileage_km": 20000,
        "condition_rating": "Good", "image_urls": photos,
    })
    assert response.status_code == 201, response.text
    trade_in_id = response.json()["trade_in_id"]
    item = client.get(f"{API}/trade-ins/{trade_in_id}", headers=manager).json()
    assert [photo["image_url"] for photo in item["images"]] == photos
    updated = client.put(f"{API}/trade-ins/{trade_in_id}", headers=sales, json={
        "status": "Offer Made", "offered_value": 9000,
    })
    assert updated.status_code == 200, updated.text
    detail = client.get(f"{API}/trade-ins/{trade_in_id}", headers=manager).json()
    assert detail["status"] == "Offer Made"
    assert detail["offered_value"] == 9000
    assert detail["offer_valid_until"].endswith("+00:00")


def test_review_moderation_exposes_full_review_and_visibility(setup):
    client, sessions, manager = setup
    _, customer = signup(client)
    with sessions.begin() as db:
        car_id = add_vehicle(db)
        _, sales = add_user(db, "sales_executive")
    body = "A complete review of the car with enough text to truncate in the table. " * 4
    review = client.post(f"{API}/store/reviews", headers=customer, json={
        "vehicle_id": car_id, "rating": 4, "title": "My review", "body": body,
    })
    assert review.status_code == 201, review.text
    assert client.get(f"{API}/reviews", headers=sales).status_code == 403
    info = client.get(f"{API}/reviews", headers=manager).json()["items"][0]
    assert info["body"] == body.strip() and info["title"] == "My review"
    assert info["rating"] == 4 and info["created_at"]
    assert info["customer_name"] == "Local Buyer" and "Fortuner" in info["vehicle_label"]
    endpoint = f"{API}/reviews/{info['review_id']}/visibility"
    for visible in (False, True):
        response = client.put(endpoint, headers=manager, json={"is_visible": visible})
        assert response.status_code == 200, response.text
        assert client.get(f"{API}/reviews", headers=manager).json()["items"][0]["is_visible"] is visible


def test_store_enquiry_appears_for_manager_and_flagged_staff_with_reply(setup):
    client, sessions, manager = setup
    _, customer = signup(client)
    with sessions.begin() as db:
        salesperson, sales = add_user(db, "sales_executive", handles_enquiries=True)
        reception_id, reception = add_user(db, "receptionist")
        _, technician = add_user(db, "technician", handles_enquiries=True)
    response = client.post(f"{API}/store/enquiries", headers=customer, json={
        "subject": "Finance enquiry", "message": "What finance options are available?",
    })
    assert response.status_code == 201, response.text
    enquiry_id = response.json()["enquiry_id"]
    for staff in (manager, sales):
        response = client.get(f"{API}/enquiries", headers=staff, follow_redirects=False)
        item = response.json()["items"][0]
        assert response.status_code == 200 and item["enquiry_id"] == enquiry_id and item["assigned_to"] is None
    for staff in (reception, technician):
        assert client.get(f"{API}/enquiries", headers=staff).status_code == 403

    access_path = f"{API}/users/{reception_id}/enquiry-access"
    assert client.put(access_path, headers=sales, json={"handles_enquiries": True}).status_code == 403
    assert client.put(access_path, headers=manager, json={"handles_enquiries": True}).json()["handles_enquiries"]
    assert client.get(f"{API}/enquiries/{enquiry_id}", headers=reception).status_code == 200
    assert client.post(f"{API}/enquiries/{enquiry_id}/reply", headers=reception, json={
        "body": "Please visit us to discuss finance options.",
    }).status_code == 200
    assert client.put(f"{API}/enquiries/{enquiry_id}", headers=manager, json={"assigned_to": salesperson}).status_code == 200
    assert client.get(f"{API}/users/{salesperson}/activity", headers=manager).json()["enquiries"][0]["enquiry_id"] == enquiry_id
    assert client.get(f"{API}/store/enquiries/{enquiry_id}", headers=customer).json()["status"] == "Answered"


def test_email_skipped_provider_failure_and_manager_retry(setup, monkeypatch):
    client, sessions, manager = setup
    signup(client, "buyer@autoedge.com")
    with sessions.begin() as db:
        _, sales = add_user(db, "sales_executive")
    log = client.get(f"{API}/email-log", headers=manager).json()
    assert log["provider_configured"] is False
    row = log["items"][0]
    assert (row["status"], row["error_message"]) == ("Skipped", "Email provider not configured")
    retry = f"{API}/email-log/{row['email_id']}/retry"
    assert client.post(retry, headers=sales).status_code == 403
    assert client.post(retry, headers=manager).json()["status"] == "Skipped"

    async def fail(*_):
        raise RuntimeError("Provider returned a delivery error")

    async def succeed(*_):
        return httpx.Response(201, json={"messageId": "accepted"})

    monkeypatch.setattr(settings, "EMAIL_PROVIDER", "brevo")
    monkeypatch.setattr(settings, "EMAIL_API_KEY", "dummy-api-key")
    monkeypatch.setattr(settings, "EMAIL_FROM_ADDRESS", "sender@autoedge.com")
    monkeypatch.setattr(settings, "EMAIL_SUPPRESS_DOMAINS", "")
    monkeypatch.setitem(email_service.PROVIDERS, "brevo", fail)
    assert client.post(retry, headers=manager).json()["status"] == "Failed"
    assert client.get(f"{API}/email-log", headers=manager).json()["items"][0]["error_message"] == "Provider returned a delivery error"
    monkeypatch.setitem(email_service.PROVIDERS, "brevo", succeed)
    assert client.post(retry, headers=manager).json()["status"] == "Sent"
    sent = client.get(f"{API}/email-log", headers=manager).json()["items"][0]
    assert sent["error_message"] is None and sent["sent_at"]
    assert client.post(retry, headers=manager).status_code == 409


@pytest.fixture
def brevo(monkeypatch):
    key = "fake-key-123456789-for-tests"
    monkeypatch.setenv("EMAIL_API_KEY", f'  "{key} \r\n" \n')
    monkeypatch.setenv("EMAIL_FROM_ADDRESS", " ' sender@autoedge.com ' \n")
    monkeypatch.setenv("EMAIL_FROM_NAME", ' "AutoEdge Mail" ')
    monkeypatch.setenv("EMAIL_PROVIDER", ' "Brevo" ')
    config = Settings(_env_file=None, DATABASE_URL="sqlite://", SECRET_KEY="local-test")
    assert config.EMAIL_API_KEY == key
    monkeypatch.setattr(email_service, "settings", config)
    return key


def mock_email_http(monkeypatch, handler):
    monkeypatch.setattr(httpx, "AsyncClient", partial(httpx.AsyncClient, transport=httpx.MockTransport(handler)))


@pytest.mark.parametrize("code", [201, 401, 503])
def test_manager_email_test_returns_and_records_provider_response(setup, monkeypatch, caplog, brevo, code):
    client, sessions, manager = setup
    recipient = "recipient@showroom.org"
    body = {
        201: '{"messageId":"sample-message"}',
        401: '{"message":"Key not found","code":"unauthorized"}',
        503: "Provider unavailable " + ("x" * 600) + " " + brevo,
    }[code]
    requests = []

    def provider(request):
        requests.append(request)
        return httpx.Response(code, text=body)

    mock_email_http(monkeypatch, provider)
    with sessions.begin() as db:
        _, sales = add_user(db, "sales_executive")
    url = f"{API}/email-log/test"
    assert client.post(url, json={"to": recipient}).status_code == 401
    assert client.post(url, headers=sales, json={"to": recipient}).status_code == 403
    assert client.post(url, headers=manager, json={"to": "invalid"}).status_code == 422
    assert requests == []
    with caplog.at_level(logging.INFO, logger=email_service.__name__):
        response = client.post(url, headers=manager, json={"to": recipient})
    assert response.status_code == code, response.text
    [request] = requests
    assert request.method == "POST" and str(request.url) == "https://api.brevo.com/v3/smtp/email"
    assert request.headers.get_list("api-key") == [brevo]
    assert request.headers["content-type"] == request.headers["accept"] == "application/json"
    assert "authorization" not in request.headers
    assert json.loads(request.content) == {
        "sender": {"name": "AutoEdge Mail", "email": "sender@autoedge.com"},
        "to": [{"email": recipient, "name": recipient}],
        "subject": "AutoEdge email delivery test",
        "htmlContent": "<p>This is a test email from the AutoEdge staff portal.</p>",
    }
    expected_body = body.replace(brevo, "[redacted]")
    assert response.json()["provider_status"] == code
    assert response.json()["provider_body"] == expected_body
    row, = client.get(f"{API}/email-log", headers=manager).json()["items"]
    assert row["status"] == ("Sent" if code == 201 else "Failed")
    assert row["error_message"] == (None if code == 201 else f"HTTP {code}: {expected_body}")
    assert f"key_length={len(brevo)}" in caplog.text and brevo[:8] in caplog.text
    assert brevo not in caplog.text + response.text


def test_email_test_distinguishes_local_failures_from_provider_http(setup, monkeypatch, brevo):
    client, _, manager = setup
    attempts = []

    def offline(request):
        attempts.append(request)
        raise httpx.ConnectError("Unable to connect")

    mock_email_http(monkeypatch, offline)
    url = f"{API}/email-log/test"
    suppressed = client.post(url, headers=manager, json={"to": "buyer@example.com"})
    assert suppressed.status_code == 422 and suppressed.json()["status"] == "Suppressed"
    response = client.post(url, headers=manager, json={"to": "buyer@showroom.org"})
    assert response.status_code == 502 and response.json()["provider_status"] is None
    assert response.json()["detail"] == "Unable to connect"
    monkeypatch.setattr(email_service.settings, "EMAIL_API_KEY", ' "  " ')
    skipped = client.post(url, headers=manager, json={"to": "buyer@showroom.org"})
    assert skipped.status_code == 503 and skipped.json()["status"] == "Skipped"
    assert skipped.json()["provider_body"] is None and len(attempts) == 1


def test_customer_email_retry_uses_customer_name_and_same_brevo_request(setup, monkeypatch, brevo):
    client, _, manager = setup
    recipient = "buyer@showroom.org"
    # Queue a skipped welcome email first so it can be retried through the staff API.
    with monkeypatch.context() as patch:
        patch.setattr(email_service.settings, "EMAIL_PROVIDER", "none")
        signup(client, recipient)
    row, = client.get(f"{API}/email-log", headers=manager).json()["items"]
    requests = []

    def provider(request):
        requests.append(request)
        return httpx.Response(401, text='{"message":"Key not found","code":"unauthorized"}')

    mock_email_http(monkeypatch, provider)
    result = client.post(f"{API}/email-log/{row['email_id']}/retry", headers=manager)
    assert result.json()["status"] == "Failed"
    [request] = requests
    assert request.headers["api-key"] == brevo
    assert json.loads(request.content)["to"] == [{"email": recipient, "name": "Local Buyer"}]
    row, = client.get(f"{API}/email-log", headers=manager).json()["items"]
    assert row["error_message"] == 'HTTP 401: {"message":"Key not found","code":"unauthorized"}'


def test_staff_roles_overrides_password_reset_and_deactivation(setup):
    client, sessions, manager = setup
    staff_data = {
        "full_name": "New Sales Executive", "email": "new-sales@autoedge.com", "role": "sales_executive",
        "phone": "03001234567", "is_active": True, "handles_enquiries": True,
        "module_access": {"vehicles": "view", "customers": "none", "staff": "full"},
        "password": PASSWORD, "confirm_password": PASSWORD,
    }
    created = client.post(f"{API}/users/", headers=manager, json=staff_data)
    assert created.status_code == 201, created.text
    assert client.post(f"{API}/users/", headers=manager, json=staff_data).status_code == 409
    info = created.json()
    assert info["access"]["staff"] == "none"
    assert info["access"]["vehicles"] == "view"
    assert "password" not in info and "password_hash" not in info

    def login(password):
        return client.post(f"{API}/auth/login", data={"username": staff_data["email"], "password": password})

    token = headers(login(PASSWORD).json()["access_token"])
    assert client.get(f"{API}/auth/me", headers=token).json()["must_change_password"]
    assert client.get(f"{API}/vehicles/", headers=token).status_code == 403
    response = client.post(f"{API}/auth/change-password", headers=token, json={
        "current_password": PASSWORD, "password": "ChangedPass91", "confirm_password": "ChangedPass91",
    })
    assert response.status_code == 200, response.text
    staff = headers(response.json()["access_token"])
    assert client.get(f"{API}/auth/me", headers=token).status_code == 401
    assert client.get(f"{API}/vehicles/", headers=staff).status_code == 200
    assert client.post(f"{API}/vehicles/", headers=staff, json={}).status_code == 403
    assert client.get(f"{API}/customers/", headers=staff).status_code == 403
    assert client.get(f"{API}/users/", headers=staff).status_code == 403

    url = f"{API}/users/{info['user_id']}"
    assert client.put(url, headers=manager, json={"full_name": "Updated staff", "phone": "03001230000"}).json()["full_name"] == "Updated staff"
    assert client.post(f"{url}/reset-password", headers=manager, json={
        "password": "Temporary1", "confirm_password": "Temporary1",
    }).status_code == 204
    assert client.get(f"{API}/auth/me", headers=staff).status_code == 401
    reset_token = headers(login("Temporary1").json()["access_token"])
    assert client.get(f"{API}/vehicles/", headers=reset_token).status_code == 403
    assert client.delete(f"{API}/users/1", headers=manager).status_code == 409
    assert client.put(f"{API}/users/1", headers=manager, json={"role": "technician"}).status_code == 409
    assert client.delete(url, headers=manager).json()["is_active"] is False
    assert login("Temporary1").status_code == 403
    assert client.get(f"{API}/auth/me", headers=reset_token).status_code == 401
    assert client.delete(url + "/permanent", headers=manager).status_code == 204


def test_technician_profile_updates_upcoming_bookings_and_public_representation(setup):
    client, sessions, manager = setup
    customer_id, _ = signup(client)
    response = client.post(f"{API}/users/", headers=manager, json={
        "full_name": "New Technician", "email": "new-tech@autoedge.com", "role": "technician",
        "password": PASSWORD, "confirm_password": PASSWORD,
    })
    assert response.status_code == 201, response.text
    technician_id = response.json()["user_id"]
    url = f"{API}/technician-profiles/{technician_id}"
    photo_url = "https://example.com/technician.jpg"
    response = client.put(url, headers=manager, json={
        "full_name": "Local Technician", "phone": "03001234567", "specialty": "Mechanic",
        "years_experience": 8, "certifications": "ASE", "skills": "Diagnostics, Brakes",
        "working_days": "Mon, Tue", "working_hours": "09:00–17:00",
        "hourly_rate": "50.25", "bio": "Workshop technician.", "photo_url": photo_url, "is_bookable": True,
    })
    assert response.status_code == 200, response.text
    saved = response.json()
    assert saved["hourly_rate"] == "50.25" and saved["skills"] == "Diagnostics, Brakes"
    with sessions.begin() as db:
        owned = CustomerVehicle(customer_id=customer_id, make="Toyota", model="Fortuner", year=2023)
        service = ServiceType(name="Inspection", base_price=Decimal("80"), booking_fee=Decimal("30"), duration_minutes=60)
        db.add_all([owned, service])
        db.flush()
        db.add(ServiceBooking(customer_id=customer_id, cv_id=owned.cv_id, service_type_id=service.service_type_id,
                              technician_id=technician_id, booking_date=date.today() + timedelta(days=3),
                              time_slot=time(10), fee_amount=Decimal("30"), status="Confirmed"))
    profile = client.get(url, headers=manager).json()
    assert profile["upcoming_bookings"][0]["service_type"] == "Inspection"
    public = client.get(f"{API}/public/technicians").json()[0]
    assert (public["photo_url"], public["specialty"], public["years_experience"]) == (photo_url, "Mechanic", 8)
    assert "phone" not in public and "email" not in public
    assert client.delete(f"{API}/users/{technician_id}", headers=manager).status_code == 200
    assert client.get(f"{API}/public/technicians").json() == []
    assert client.delete(f"{API}/users/{technician_id}/permanent", headers=manager).status_code == 409
