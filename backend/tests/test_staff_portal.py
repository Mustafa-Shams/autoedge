"""Staff portal regressions exercised through the staff and storefront APIs."""
import json
import logging
import os
from functools import partial
from uuid import uuid4
from datetime import date, datetime, time, timedelta
from decimal import Decimal

import httpx
import pytest

os.environ.setdefault("SECRET_KEY", "staff-portal-test")

from fastapi.testclient import TestClient
from app.db.session import engine
from sqlalchemy.orm import sessionmaker

from app.api.deps import get_db
from app.core.config import Settings, settings
from app.core.security import create_access_token, hash_password
from app.core.time import utcnow
from app.main import app
from app.models.bank_account import BankAccount
from app.models.bank_transaction import BankTransaction
from app.models.customer import Customer
from app.models.deal import Deal, InventoryUnit
from app.models.commission import Commission
from app.models.enquiry import Enquiry, EnquiryMessage
from app.models.test_drive import TestDrive as Drive
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
def setup(monkeypatch, clean_database):
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
        held_unit = db.query(Deal).filter_by(reservation_id=reservation_id).one().unit_id
        staff_id = db.query(User.user_id).filter_by(role="manager").scalar()
    response = client.post(f"{API}/sales/", headers=manager, json={
        "staff_id": staff_id, "vehicle_id": vehicle_id, "customer_id": customer_id,
        "sale_price": 12000, "status": "Completed", "reservation_id": reservation_id,
    })
    assert response.status_code == 201, response.text
    vehicle = client.get(f"{API}/vehicles/{vehicle_id}", headers=manager).json()
    assert (vehicle["stock_quantity"], vehicle["status"]) == (0, "Sold")
    with sessions() as db:
        deal = db.query(Deal).filter_by(sale_id=response.json()["sale_id"]).one()
        assert (deal.unit_id, deal.reservation_id, deal.stage) == (held_unit, reservation_id, "Awaiting pickup")
        assert db.get(InventoryUnit, held_unit).vin is None
        assert db.query(CustomerVehicle).filter_by(source_sale_id=deal.sale_id).count() == 0


@pytest.mark.parametrize("use_hold", [False, True])
def test_purchase_payment_retry_and_verified_handover(setup, use_hold):
    client, sessions, manager = setup
    customer_id, buyer = signup(client)
    _, other = signup(client, "second@example.com")
    with sessions.begin() as db:
        vehicle_id = add_vehicle(db, stock=1, vin="LISTING-ONLY")
        _, tech = add_user(db, "technician")
    opened = client.post(f"{API}/store/enquiries", headers=buyer, json={
        "vehicle_id": vehicle_id, "subject": "Pickup options", "message": "When can I collect the car?"})
    assert opened.status_code == 201, opened.text
    journey = client.get(f"{API}/store/deals", headers=buyer).json()["items"][0]["id"]
    general = client.post(f"{API}/store/enquiries", headers=buyer, json={"subject":"Earlier question", "message":"Can we discuss pickup?"}).json()["enquiry_id"]
    link_path = f"{API}/store/deals/{journey}/enquiries/{general}"
    assert client.post(link_path, headers=other).status_code == 404
    assert client.post(link_path, headers=buyer).status_code == 200
    assert client.post(link_path, headers=buyer).status_code == 200
    hold = None
    if use_hold:
        terms = client.get(f"{API}/store/reservations/quote/{vehicle_id}?hold_days=14", headers=buyer).json()
        assert Decimal(terms["refund"]) == 1080
        request = dict(vehicle_id=vehicle_id, hold_days=14, password=PASSWORD, idempotency_key="deposit")
        url = f"{API}/store/reservations"
        assert client.post(url, headers=buyer, json={**request, "quote_token":terms["token"]+"x"}).status_code == 409
        result = client.post(url, headers=buyer, json={**request, "quote_token":terms["token"]}).json()
        assert result["deal_id"] == journey
        assert datetime.fromisoformat(result["expires_at"]) == datetime.fromisoformat(terms["expires_at"])
        hold = result["reservation_id"]
    quote = client.get(f"{API}/store/purchases/quote/{vehicle_id}", headers=buyer).json()
    assert quote["charge"] == (10800 if use_hold else 12000)
    body = dict(vehicle_id=vehicle_id, reservation_id=hold, expected_price=12000, expected_charge=quote["charge"],
                password=PASSWORD, idempotency_key=str(uuid4()))
    url = f"{API}/store/purchases"
    assert client.post(url, headers=buyer, json={**body, "expected_charge": 1}).status_code == 409
    assert client.post(url, headers=buyer, json={**body, "password": "wrong"}).status_code == 403
    response = client.post(url, headers=buyer, json=body)
    assert response.status_code == 200, response.text
    receipt = response.json()
    assert client.post(url, headers=buyer, json=body).json() == receipt
    assert receipt["deal_id"] == journey
    path = f"{API}/store/deals/{journey}"
    assert client.get(path, headers=other).status_code == 404
    assert client.get(f"{API}/deals/{journey}", headers=tech).status_code == 403
    for route, auth in [(path, buyer), (f"{API}/deals/{journey}", manager)]:
        history = client.get(route, headers=auth).json()
        assert history["due"] == 0 and any(e["detail"] == "When can I collect the car?" for e in history["events"])
    assert receipt["vin"] is None and receipt["stage"] == "Awaiting pickup"
    assert client.get(url, headers=other).json() == []
    handover = f"{API}/sales/{receipt['sale_id']}/handover"
    vin = {"vin": " jtdkn3du0a0123456 "}
    assert client.post(handover, headers=manager, json={"vin": "LISTING-ONLY"}).status_code == 409
    assert client.post(handover, headers=buyer, json=vin).status_code in (401, 403)
    assert client.post(handover, headers=tech, json=vin).status_code == 403
    for _ in range(2):
        res = client.post(handover, headers=manager, json=vin)
        assert res.status_code == 200, res.text
        assert res.json()["pickup_status"] == "Collected"
    assert client.post(handover, headers=manager, json={"vin": "JTDKN3DU0A0123457"}).status_code == 409
    assert client.post(f"{url}/{receipt['sale_id']}/cancel", headers=buyer).status_code == 409
    with sessions() as db:
        assert db.query(BankTransaction).filter_by(txn_type="Vehicle Purchase").count() == 1
        assert db.query(BankAccount).filter_by(customer_id=customer_id).one().balance == settings.DEMO_STARTING_BALANCE - 12000
        assert db.query(CustomerVehicle).one().vin_number == vin["vin"].strip().upper()
        unit = db.get(InventoryUnit, receipt["unit_id"])
        assert unit.verified_at and unit.verified_by
        assert db.query(Commission).count() == 0


def test_paid_cancellation_refunds_twenty_percent_including_deposit(setup):
    client, sessions, manager = setup
    customer_id, buyer = signup(client)
    _, other = signup(client, "other@example.com")
    with sessions.begin() as db:
        vehicle_id = add_vehicle(db, stock=1)
        _, sales = add_user(db, "sales_executive")
    hold = reserve(client, buyer, vehicle_id, "refund-hold")
    url = f"{API}/store/purchases"
    body = dict(vehicle_id=vehicle_id, reservation_id=hold, expected_price=12000, expected_charge=10800,
                password=PASSWORD, idempotency_key=str(uuid4()))
    with sessions.begin() as db:
        bank = db.query(BankAccount).filter_by(customer_id=customer_id).one()
        bank.balance = 100
    assert client.post(url, headers=buyer, json=body).status_code == 409
    with sessions.begin() as db:
        assert db.get(Reservation, hold).status == "Active"
        assert db.query(Deal).one().stage == "Reserved"
        assert db.query(BankTransaction).filter_by(txn_type="Vehicle Purchase").count() == 0
        db.query(BankAccount).filter_by(customer_id=customer_id).one().balance = 10800
    sale_id = client.post(url, headers=buyer, json=body).json()["sale_id"]
    approve = f"{API}/sales/{sale_id}/approve-refund"
    assert client.post(approve, headers=manager).status_code == 409
    assert client.post(f"{url}/{sale_id}/cancel", headers=other).status_code == 404
    assert client.post(f"{url}/{sale_id}/cancel", headers=buyer).status_code == 200
    assert client.post(approve, headers=sales).status_code == 403
    assert client.post(f"{API}/sales/{sale_id}/handover", headers=manager, json={"vin":"JTDKN3DU0A0123456"}).status_code == 409
    for _ in range(2):
        approved = client.post(approve, headers=manager)
        assert approved.status_code == 200, approved.text
    receipt = client.get(url, headers=buyer).json()[0]
    assert receipt["refund_amount"] == 2400 and receipt["stage"] == "Refunded"
    with sessions() as db:
        assert db.query(BankAccount).filter_by(customer_id=customer_id).one().balance == 2400
        assert db.query(StockMovement).filter_by(reason="Sale Refund").count() == 1
        assert db.get(Vehicle, vehicle_id).stock_quantity == 1
        assert db.query(Commission).count() == 0


def inspect_and_receive(client, manager, buyer, trade_id, value, excess=0):
    url = f"{API}/trade-ins/{trade_id}/acquisition"
    response = client.post(url, headers=manager, json={"action": "schedule", "appointment": "2026-11-23T06:00:00Z"})
    assert response.status_code == 200, response.text
    terms = {"action":"inspect", "version":0, "value":value, "findings":"Mileage and condition verified",
             "excess":excess, "settlement":"Separate agreed payment" if excess else None}
    assert client.post(url, headers=manager, json=terms).status_code == 200
    intake = {"action":"intake", "vin":"JTDKN3DU0A0123478", "version":1}
    assert client.post(url, headers=manager, json=intake).status_code == 422
    intake.update(ownership_verified=True, condition_verified=True, ownership_reference="DEMO-TITLE", odometer_km=41000)
    assert client.post(url, headers=manager, json=intake).status_code == 409
    respond = f"{API}/store/trade-ins/{trade_id}/inspection-response"
    assert client.post(respond, headers=buyer, json={"version":0,"accept":True}).status_code == 409
    assert client.post(respond, headers=buyer, json={"version":1,"accept":True}).status_code == 200
    received = client.post(url, headers=manager, json=intake)
    assert received.status_code == 200, received.text
    a = received.json()["acquisition"]
    assert a["stock_unit_id"] and a["checked"] and a["listing_id"] is None


@pytest.mark.parametrize("with_trade", [False, True])
def test_showroom_payment_messages_and_settlement(setup, with_trade):
    client, sessions, manager = setup
    customer_id, buyer = signup(client)
    _, other = signup(client, "different@example.com")
    with sessions.begin() as db:
        car = add_vehicle(db, stock=1)
        staff = db.query(User).filter_by(role="manager").one().user_id
        _, restricted = add_user(db, "sales_executive", module_access={"sales": "view"})
    trade_id = None
    if with_trade:
        response = client.post(f"{API}/store/trade-ins", headers=buyer, json={
            "make": "Toyota", "model": "Vitz", "year": 2013, "mileage_km": 85000,
            "condition_rating": "Good", "image_urls": [f"https://example.com/test-{i}.jpg" for i in range(3)],
        })
        trade_id = response.json()["trade_in_id"]
        assert client.put(f"{API}/trade-ins/{trade_id}", headers=manager, json={
            "status": "Offer Made", "offered_value": 2000}).status_code == 200
        assert client.post(f"{API}/store/trade-ins/{trade_id}/respond", headers=buyer, json={"accept": True}).status_code == 200
        inspect_and_receive(client, manager, buyer, trade_id, 2000)
    r = client.post(f"{API}/sales/", headers=manager, json={
        "vehicle_id": car, "customer_id": customer_id, "staff_id": staff, "payment_type": "Finance",
        "sale_price": 12000, "status": "Completed", "trade_in_id": trade_id})
    assert r.status_code == 201, r.text
    sale = r.json()["sale_id"]
    with sessions() as db:
        notice = db.query(Notification).filter_by(type="purchase_completed", customer_id=customer_id).one()
        assert notice.title.startswith("Purchase recorded") and notice.link_path == f"/account/deals/{r.json()['deal_id']}"
    staff_url = f"{API}/sales/{sale}"
    customer_url = f"{API}/store/purchases/{sale}"
    vin = {"vin": "JTDKN3DU0A0123456"}
    assert client.post(staff_url + "/handover", headers=manager, json=vin).status_code == 409
    data = {"cash_received": 3000, "external_funding": 7000 if with_trade else 9000,
            "reference": "local showroom receipt", "trade_received": with_trade}
    assert client.post(staff_url + "/payment", headers=restricted, json=data).status_code == 403
    assert client.post(staff_url + "/payment", headers=manager, json={**data,"cash_received": 3500}).status_code == 409
    for _ in range(2):
        verified = client.post(staff_url + "/payment", headers=manager, json=data)
        assert verified.status_code == 200, verified.text
        assert Decimal(verified.json()["balance_due_at_showroom"]) == 0
    assert client.post(staff_url + "/pickup-deadline", headers=manager, json={"deadline":"2099-12-05T18:00:00+05:00"}).status_code == 200
    assert client.post(customer_url + "/conversation", headers=other).status_code == 404
    thread = client.post(customer_url + "/conversation", headers=buyer).json()["enquiry_id"]
    assert client.post(staff_url + "/conversation", headers=manager).json()["enquiry_id"] == thread
    assert client.post(f"{API}/store/enquiries/{thread}/messages", headers=buyer, json={"body":"Can I collect Friday?"}).status_code == 200
    receipt = client.get(f"{API}/store/purchases", headers=buyer).json()[0]
    assert receipt["enquiry_id"] == thread and receipt["pickup_deadline"] == "2099-12-05T13:00:00+00:00"
    assert receipt["refund_if_cancelled"] == 600
    if with_trade:
        assert client.post(customer_url + "/cancel", headers=buyer).status_code == 409
    agreement = {"agree_trade_return": with_trade}
    assert client.post(customer_url + "/cancel", headers=buyer, json=agreement).status_code == 200
    if with_trade:
        assert client.post(staff_url + "/approve-refund", headers=manager).status_code == 409
    for _ in range(2):
        assert client.post(staff_url + "/approve-refund", headers=manager, json=agreement).status_code == 200
    with sessions() as db:
        assert db.get(Vehicle, car).stock_quantity == 1
        assert db.query(BankTransaction).filter_by(sale_id=sale, txn_type="Refund").one().amount == 600
        assert db.query(Commission).count() == 0
    if with_trade:
        assert client.get(f"{API}/trade-ins/{trade_id}", headers=manager).json()["status"] == "Cancelled"


@pytest.mark.parametrize("kind", ["Conversation", "Test drive", "Walk-in"])
def test_before_payment_assistance_is_consumed_once_at_pickup(setup, kind):
    client, sessions, manager = setup
    customer_id, buyer = signup(client)
    with sessions.begin() as db:
        vehicle = add_vehicle(db, stock=2)
        owner, sales = add_user(db, "sales_executive", handles_enquiries=True)
        _, tech = add_user(db, "technician")
        source_id = None
        if kind == "Conversation":
            thread = Enquiry(customer_id=customer_id, vehicle_id=vehicle, subject="Help comparing trims")
            db.add(thread)
            db.flush()
            source_id = thread.enquiry_id
            db.add(EnquiryMessage(enquiry_id=source_id, sender_type="staff", sender_user_id=owner, body="Compared the trims."))
        if kind == "Test drive":
            drive = Drive(customer_id=customer_id, vehicle_id=vehicle, assigned_to=owner, scheduled_date=date.today(), status="Completed")
            db.add(drive)
            db.flush()
            source_id = drive.test_drive_id
    url = f"{API}/sales/assistance"
    body = dict(owner_id=owner, customer_id=customer_id, vehicle_id=vehicle, kind=kind, source_id=source_id, note="Compared trims in person")
    assert client.post(url, headers=tech, json=body).status_code == 403
    if source_id:
        assert client.post(url, headers=sales, json={**body, "source_id": 10000}).status_code == 409
    for _ in range(2):
        saved = client.post(url, headers=sales, json=body)
        assert saved.status_code == 200, saved.text
    confirm = dict(vehicle_id=vehicle, expected_price=12000, expected_charge=12000, password=PASSWORD)
    for purchase_no in range(2):
        res = client.post(f"{API}/store/purchases", headers=buyer, json={**confirm, "idempotency_key": str(uuid4())})
        assert res.status_code == 200, res.text
        sale_id = res.json()["sale_id"]
        queue = client.get(f"{API}/today", headers=sales).json()["tasks"]
        assert any(t["path"] == f"/sales?receipt={sale_id}" and t["owner_id"] == owner
                   and t["deal_id"] == res.json()["deal_id"] for t in queue)
        assert not any(t["path"].startswith("/sales") for t in client.get(f"{API}/today", headers=tech).json()["tasks"])
        with sessions() as db:
            assert db.query(Commission).count() == purchase_no
        for _ in range(2):
            assert client.post(f"{API}/sales/{sale_id}/handover", headers=manager,
                               json={"vin": f"JTDKN3DU0A012345{purchase_no}"}).status_code == 200
        info = client.get(f"{API}/sales/{sale_id}", headers=manager).json()["commission_details"]
        if purchase_no == 0:
            assert Decimal(str(info["amount"])) == 300 and kind in info["evidence"]
        else:
            assert info is None
    with sessions() as db:
        commission = db.query(Commission).one()
        assert commission.staff_id == owner and commission.commission_amt == 300
    assert client.post(f"{url}/{saved.json()['assistance_id']}/close", headers=sales).status_code == 409


@pytest.mark.parametrize("scenario", ["credit", "excess", "standalone"])
def test_inspected_trade_credits_purchase_once_and_publishes_after_collection(setup, scenario):
    client, sessions, manager = setup
    _, buyer = signup(client)
    with sessions.begin() as db:
        car = add_vehicle(db, stock=1)
    response = client.post(f"{API}/store/trade-ins", headers=buyer, json={
        "make":"Toyota", "model":"Vitz", "year":2013, "mileage_km":51000,
        "target_vehicle_id":car, "condition_rating":"Good", "image_urls":[f"https://example.com/test-{i}.jpg" for i in range(3)]})
    trade = response.json()["trade_in_id"]
    url = f"{API}/trade-ins/{trade}"
    assert client.put(url, headers=manager, json={"status":"Offer Made","offered_value":4500}).status_code == 200
    assert client.post(f"{API}/store/trade-ins/{trade}/respond", headers=buyer, json={"accept":True}).json()["acquisition"]["listing_id"] is None
    deal_id = client.get(f"{API}/store/deals", headers=buyer).json()["items"][0]["id"]
    pending = client.get(f"{API}/store/deals/{deal_id}", headers=buyer).json()
    assert pending["credits"][0]["status"] == "Pending" and pending["due"] == 12000
    assert any("accepted" in e["title"] for e in pending["events"])
    value = 14000 if scenario == "excess" else 4000
    excess = max(value - 12000, 0)
    inspect_and_receive(client, manager, buyer, trade, value, excess)
    with sessions() as db:
        private = db.query(InventoryUnit).filter_by(intake_trade_id=trade).one()
        assert private.vehicle_id is None
        intake_unit = private.unit_id
    publish = {"action":"publish","retail_price":6400,"preparation_cost":300,
               "description":"Inspected used Toyota Vitz, 51,000 km.","photos_and_details_verified":True}
    assert client.post(url+"/acquisition", headers=manager, json=publish).status_code == 409
    if scenario == "standalone":
        pay = {"action":"acquisition-payment", "reference":"ACQ-001", "amount":value}
        assert client.post(url+"/acquisition", headers=manager, json={**pay,"amount":1}).status_code == 409
        for _ in range(2):
            assert client.post(url+"/acquisition", headers=manager, json=pay).status_code == 200
        # Older paid acquisitions have custody history but lack the ownership checklist.
        from app.models.trade_acquisition import TradeAcquisition
        with sessions.begin() as db:
            acquisition = db.get(TradeAcquisition, trade)
            acquisition.checked_at = acquisition.checked_by = acquisition.intake_version = None
            acquisition.ownership_reference = acquisition.odometer_km = None
        tasks = client.get(f"{API}/today", headers=manager).json()["tasks"]
        assert any(t["action"] == "Verify trade-in ownership and intake" and t["deal_id"] == deal_id for t in tasks)
        assert not client.get(url, headers=manager).json()["acquisition"]["ready_for_resale"]
        assert client.post(url+"/acquisition", headers=manager, json=publish).status_code == 409
        check = dict(action="intake", version=1, vin="JTDKN3DU0A0123478", ownership_verified=True,
                     condition_verified=True, ownership_reference="DEMO-TITLE", odometer_km=41000)
        assert client.post(url+"/acquisition", headers=manager, json=check).status_code == 200
    else:
        q = client.get(f"{API}/store/purchases/quote/{car}", params={"trade_in_id":trade}, headers=buyer).json()
        assert q["trade_in_credit"] == min(value,12000) and q["charge"] == max(0,12000-value)
        payload = dict(vehicle_id=car,trade_in_id=trade,expected_price=12000,expected_charge=q["charge"],
                       password=PASSWORD,idempotency_key=str(uuid4()))
        for _ in range(2):
            res = client.post(f"{API}/store/purchases", headers=buyer, json=payload)
            assert res.status_code == 200, res.text
        assert client.post(url+"/acquisition", headers=manager, json=publish).status_code == 409
        handover_url = f"{API}/sales/{res.json()['sale_id']}/handover"
        handover = {"vin":"JTDKN3DU0A0123499"}
        if excess:
            assert client.post(handover_url, headers=manager, json=handover).status_code == 409
            handover["settlement_reference"] = "EXCESS-001"
        assert client.post(handover_url, headers=manager, json=handover).status_code == 200
        if excess:
            assert client.get(url, headers=manager).json()["acquisition"]["settled_amount"] == excess
    queue = client.get(f"{API}/today", headers=manager).json()["tasks"]
    assert any(task["action"] == "Prepare resale listing" and task["path"] == f"/trade-ins?id={trade}" for task in queue)
    for _ in range(2):
        result = client.post(url+"/acquisition", headers=manager, json=publish)
        assert result.status_code == 200, result.text
    listing = result.json()["acquisition"]["listing_id"]
    with sessions() as db:
        assert db.get(InventoryUnit, intake_unit).vehicle_id == listing
    public = client.get(f"{API}/public/vehicles/{listing}").json()
    assert public["model"] == "Vitz" and Decimal(str(public["price"])) == 6400 and public["stock_quantity"] == 1
    with sessions() as db:
        assert db.query(Vehicle).count() == 2
        assert db.query(InventoryUnit).filter_by(vehicle_id=listing).one().vin == "JTDKN3DU0A0123478"


def test_expired_hold_cannot_charge_or_convert(setup):
    client, sessions, _ = setup
    _, buyer = signup(client)
    with sessions.begin() as db:
        vehicle = add_vehicle(db, stock=1)
    hold = reserve(client, buyer, vehicle, "expires-at-checkout")
    with sessions.begin() as db:
        db.get(Reservation, hold).expires_at = utcnow() - timedelta(seconds=1)
    response = client.post(f"{API}/store/purchases", headers=buyer, json=dict(
        vehicle_id=vehicle, reservation_id=hold, expected_price=12000, expected_charge=10800,
        password=PASSWORD, idempotency_key=str(uuid4())))
    assert response.status_code == 409, response.text
    with sessions() as db:
        assert db.get(Reservation, hold).status == "Expired"
        assert db.get(Vehicle, vehicle).stock_quantity == 1
        assert db.query(Deal).one().unit_id is None
        assert db.query(BankTransaction).filter_by(txn_type="Vehicle Purchase").count() == 0


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
        "subject": "Finance enquiry", "message": "What finance options are available?", "category": "Finance",
    })
    assert response.status_code == 201, response.text
    enquiry_id = response.json()["enquiry_id"]
    for staff in (manager, sales):
        response = client.get(f"{API}/enquiries", headers=staff, follow_redirects=False)
        item = response.json()["items"][0]
        assert response.status_code == 200 and item["enquiry_id"] == enquiry_id and item["assigned_to"] is None
        assert item["category"] == "Finance"
    for staff in (reception, technician):
        assert client.get(f"{API}/enquiries", headers=staff).status_code == 403

    access_path = f"{API}/users/{reception_id}/enquiry-access"
    assert client.put(access_path, headers=sales, json={"handles_enquiries": True}).status_code == 403
    assert client.put(access_path, headers=manager, json={"handles_enquiries": True}).json()["handles_enquiries"]
    # Finance belongs to sales; a receptionist sees it only once it is assigned to them.
    assert client.get(f"{API}/enquiries/{enquiry_id}", headers=reception).status_code == 404
    assert client.put(f"{API}/enquiries/{enquiry_id}", headers=manager, json={"assigned_to": reception_id}).status_code == 200
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
    config = Settings(_env_file=None, DATABASE_URL=settings.DATABASE_URL, SECRET_KEY="local-test")
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


def test_customer_test_drive_request_and_cancel(setup):
    client, sessions, _ = setup
    _, customer = signup(client)
    with sessions.begin() as db:
        vehicle_id = add_vehicle(db)
    day = date.today() + timedelta(days=4)
    if day.weekday() == 6:
        day += timedelta(days=1)
    url = f"{API}/store/test-drives"
    response = client.post(url, headers=customer, json={
        "vehicle_id": vehicle_id, "scheduled_date": day.isoformat(), "scheduled_time": "10:00",
    })
    assert response.status_code == 201, response.text
    drive = response.json()
    cancelled = client.post(f"{url}/{drive['test_drive_id']}/cancel", headers=customer)
    assert cancelled.status_code == 200, cancelled.text
    assert cancelled.json()["status"] == "Cancelled"


def test_service_cancellation_persists_refund_once(setup, monkeypatch):
    import asyncio
    from app.models.email_outbox import EmailOutbox

    def broken_template(**kwargs):
        raise RuntimeError("Fixture template failed")

    monkeypatch.setattr(email_service, "get_email_content", broken_template)
    client, sessions, _ = setup
    customer_id, customer = signup(client)
    with sessions.begin() as db:
        car = CustomerVehicle(customer_id=customer_id, make="Toyota", model="Corolla", year=2023)
        service = ServiceType(name="Inspection", base_price=80, booking_fee=30, duration_minutes=60)
        db.add_all([car, service])
        db.flush()
        day = date.today() + timedelta(days=4)
        if day.weekday() == 6:
            day += timedelta(days=1)
        payload = dict(cv_id=car.cv_id, service_type_id=service.service_type_id, booking_date=day.isoformat(),
                       time_slot="10:00", password=PASSWORD, idempotency_key="service-cancel-check")
    url = f"{API}/store/service-bookings"
    booking = client.post(url, headers=customer, json=payload)
    assert booking.status_code == 201, booking.text
    detail = f"{url}/{booking.json()['booking_id']}"
    assert client.post(detail + "/cancel", headers=customer).status_code == 200
    assert client.post(detail + "/cancel", headers=customer).status_code == 409
    receipt = client.get(detail + "/receipt", headers=customer).json()
    assert receipt["status"] == "Cancelled"
    assert Decimal(receipt["refund_amount"]) == 30
    with sessions() as db:
        # PostgreSQL's ck_bt_txn_type only accepts the established Refund ledger type.
        refunds = db.query(BankTransaction).filter_by(service_booking_id=booking.json()["booking_id"],
                                                      direction="Credit").all()
        assert [(t.txn_type, t.amount) for t in refunds] == [("Refund", Decimal("30.00"))]
    with sessions() as db:
        email = db.query(EmailOutbox).order_by(EmailOutbox.email_id.desc()).first()
        monkeypatch.setattr(email_service, "provider_configured", lambda: True)
        monkeypatch.setattr(email_service, "_is_suppressed_address", lambda _: False)
        result = asyncio.run(email_service.send(db, email.email_id, retry=True))
        assert result.status == "Failed" and result.detail == "Fixture template failed"
    assert client.get(detail + "/receipt", headers=customer).json() == receipt


@pytest.mark.parametrize("outcome", ["Completed", "Cancelled"])
def test_workshop_and_customer_share_the_same_car_and_receipt(setup, outcome):
    from app.models.technician_profile import TechnicianProfile

    client, sessions, manager = setup
    owner_id, owner = signup(client)
    _, other = signup(client, "other-service@example.com")
    with sessions.begin() as db:
        tech, _ = add_user(db, "technician")
        car = CustomerVehicle(customer_id=owner_id, make="Toyota", model="Corolla", year=2023)
        service = ServiceType(name="Workshop", base_price=80, booking_fee=30, duration_minutes=60)
        db.add_all([car, service, TechnicianProfile(user_id=tech, specialty="Mechanic")])
        db.flush()
        day = date.today() + timedelta(days=4)
        if day.weekday() == 6:
            day += timedelta(days=1)
        cv = car.cv_id
        payload = dict(cv_id=cv, service_type_id=service.service_type_id, booking_date=day.isoformat(),
                       time_slot="10:00", password=PASSWORD, idempotency_key="workshop-receipt")
    url = f"{API}/store/service-bookings"
    booked = client.post(url, headers=owner, json=payload)
    assert booked.status_code == 201, booked.text
    bid = booked.json()["booking_id"]
    assert client.post(url, headers=other, json=payload).status_code == 409
    confirmed = client.post(f"{API}/service-bookings/{bid}/confirm", headers=manager, json={"technician_id": tech})
    assert confirmed.status_code == 200, confirmed.text
    job = f"{API}/service/{confirmed.json()['service_job_id']}"
    receipt = f"{url}/{bid}/receipt"
    if outcome == "Completed":
        assert client.put(job, headers=manager, json={"status": "In Progress"}).status_code == 200
        assert client.get(receipt, headers=owner).json()["status"] == "In Progress"
        assert client.post(f"{url}/{bid}/cancel", headers=owner).status_code == 409
        part = client.post(job + "/parts", headers=manager, json={"part_name":"Oil filter","quantity":2,"unit_cost":8})
        assert part.status_code == 201, part.text
    changed = client.put(job, headers=manager, json={"status": outcome, "final_cost": 96})
    assert changed.status_code == 200, changed.text
    assert client.put(job, headers=manager, json={"status": outcome}).status_code == 200
    details = client.get(receipt, headers=owner).json()
    assert (details["status"], details["cv_id"], details["technician_name"]) == (outcome, cv, "Technician")
    if outcome == "Completed":
        assert Decimal(details["parts"][0]["total_cost"]) == 16 and Decimal(details["final_cost"]) == 96
    else:
        assert Decimal(details["refund_amount"]) == 30 and details["refund_reference"]
    assert client.get(receipt, headers=other).status_code == 404
    assert client.get(url, headers=owner, params={"cv_id":cv}).json()["total"] == 1
    assert client.get(url, headers=other, params={"cv_id":cv}).json()["total"] == 0
    assert client.delete(f"{API}/store/garage/{cv}", headers=owner).status_code == 409


def test_technician_profile_updates_upcoming_bookings_and_public_representation(setup):
    client, sessions, manager = setup
    customer_id, _ = signup(client)
    response = client.post(f"{API}/users/", headers=manager, json={
        "full_name": "New Technician", "email": "new-tech@autoedge.com", "role": "technician",
        "password": PASSWORD, "confirm_password": PASSWORD,
    })
    assert response.status_code == 201, response.text
    technician_id = response.json()["user_id"]
    with sessions() as db:
        from app.models.technician_profile import TechnicianProfile
        # The portal's default specialty must satisfy ck_tp_specialty on PostgreSQL.
        profile = db.get(TechnicianProfile, technician_id)
        assert profile.specialty == "General" and profile.is_bookable is False
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


def _ask(client, customer, category=None, vehicle_id=None, subject=None):
    body = {"subject": subject or f"About {category or 'something'}", "message": "Please get back to me."}
    if category:
        body["category"] = category
    if vehicle_id:
        body["vehicle_id"] = vehicle_id
    response = client.post(f"{API}/store/enquiries", headers=customer, json=body)
    assert response.status_code == 201, response.text
    return response.json()


def test_enquiry_category_validation_and_defaults(setup):
    client, sessions, _ = setup
    _, customer = signup(client)
    with sessions.begin() as db:
        vehicle_id = add_vehicle(db)
    assert client.get(f"{API}/store/enquiries/categories").json() == ["Vehicle/Price", "Finance", "Service", "General"]
    bad = client.post(f"{API}/store/enquiries", headers=customer,
                      json={"subject": "Hello", "message": "Wrong category", "category": "Pickup"})
    assert bad.status_code == 422
    assert _ask(client, customer, "Service")["category"] == "Service"
    assert _ask(client, customer, vehicle_id=vehicle_id)["category"] == "Vehicle/Price"
    assert _ask(client, customer)["category"] == "General"
    mine = client.get(f"{API}/store/enquiries", headers=customer).json()
    assert sorted(e["category"] for e in mine) == ["General", "Service", "Vehicle/Price"]


def test_enquiry_visibility_follows_role_categories(setup):
    client, sessions, manager = setup
    _, customer = signup(client)
    with sessions.begin() as db:
        vehicle_id = add_vehicle(db)
        sales_id, sales = add_user(db, "sales_executive", handles_enquiries=True)
        _, reception = add_user(db, "receptionist", handles_enquiries=True)
    ids = {c: _ask(client, customer, c)["enquiry_id"] for c in ("Vehicle/Price", "Finance", "Service", "General")}
    with sessions.begin() as db:
        # A legacy row without a category, about a car, counts as Vehicle/Price.
        legacy = Enquiry(customer_id=db.query(Customer.customer_id).scalar(), vehicle_id=vehicle_id,
                         subject="Legacy price question", status="Open")
        db.add(legacy)
        db.flush()
        legacy_id = legacy.enquiry_id

    def visible(staff, **params):
        response = client.get(f"{API}/enquiries", headers=staff, params=params)
        assert response.status_code == 200, response.text
        return {(e["enquiry_id"], e["category"]) for e in response.json()["items"]}

    assert visible(sales) == {(ids["Vehicle/Price"], "Vehicle/Price"), (ids["Finance"], "Finance"),
                              (legacy_id, "Vehicle/Price")}
    assert visible(reception) == {(ids["Service"], "Service"), (ids["General"], "General")}
    assert len(visible(manager)) == 5
    assert visible(manager, category="Finance") == {(ids["Finance"], "Finance")}
    assert visible(sales, category="Service") == set()
    blocked = f"{API}/enquiries/{ids['Service']}"
    assert client.get(blocked, headers=sales).status_code == 404
    assert client.post(blocked + "/reply", headers=sales, json={"body": "Hi"}).status_code == 404
    assert client.put(blocked, headers=sales, json={"status": "Closed"}).status_code == 404
    # Assignment overrides the category rule; staff with full access can recategorise a misfiled thread.
    assert client.put(blocked, headers=manager, json={"assigned_to": sales_id}).status_code == 200
    assert client.get(blocked, headers=sales).status_code == 200
    moved = client.put(f"{API}/enquiries/{ids['General']}", headers=reception, json={"category": "Finance"})
    assert moved.status_code == 200 and moved.json()["category"] == "Finance"
    assert ids["General"] in {i for i, _ in visible(sales)}
    assert ids["General"] not in {i for i, _ in visible(reception)}
    assert client.put(f"{API}/enquiries/{ids['Finance']}", headers=manager, json={"category": "Pickup"}).status_code == 422


def test_today_routes_enquiries_by_category(setup):
    client, sessions, manager = setup
    _, customer = signup(client)
    with sessions.begin() as db:
        _, sales = add_user(db, "sales_executive", handles_enquiries=True)
        _, reception = add_user(db, "receptionist", handles_enquiries=True)
    finance = _ask(client, customer, "Finance", subject="Loan for a car")["enquiry_id"]
    service = _ask(client, customer, "Service", subject="Brake noise")["enquiry_id"]

    def enquiry_tasks(staff):
        tasks = client.get(f"{API}/today", headers=staff).json()["tasks"]
        return {t["path"]: t for t in tasks if t["path"].startswith("/enquiries/")}

    assert set(enquiry_tasks(sales)) == {f"/enquiries/{finance}"}
    assert set(enquiry_tasks(reception)) == {f"/enquiries/{service}"}
    everyone = enquiry_tasks(manager)
    assert everyone[f"/enquiries/{finance}"]["owner"] == "Sales_Executive"
    assert everyone[f"/enquiries/{service}"]["owner"] == "Receptionist"
    assert everyone[f"/enquiries/{finance}"]["detail"] == "Finance · Loan for a car"


def test_deal_timeline_shows_visible_enquiry_categories(setup):
    client, sessions, manager = setup
    _, customer = signup(client)
    with sessions.begin() as db:
        vehicle_id = add_vehicle(db)
        _, sales = add_user(db, "sales_executive", handles_enquiries=True)
    first = _ask(client, customer, "Finance", vehicle_id=vehicle_id, subject="Monthly payments")
    deal_id = first["deal_id"]
    general = _ask(client, customer, subject="Opening hours")["enquiry_id"]
    staff_deal = client.get(f"{API}/deals/{deal_id}", headers=sales).json()
    assert [u["id"] for u in staff_deal["unlinked_enquiries"]] == []  # General is not a sales category.
    manager_deal = client.get(f"{API}/deals/{deal_id}", headers=manager).json()
    assert [u["id"] for u in manager_deal["unlinked_enquiries"]] == [general]
    linked = client.post(f"{API}/store/deals/{deal_id}/enquiries/{general}", headers=customer)
    assert linked.status_code == 200, linked.text
    with sessions() as db:
        assert db.get(Enquiry, general).category == "Vehicle/Price"
    titles = [e["title"] for e in client.get(f"{API}/deals/{deal_id}", headers=sales).json()["events"]]
    assert "Finance · Monthly payments" in titles and "Vehicle/Price · Opening hours" in titles
    customer_titles = [e["title"] for e in client.get(f"{API}/store/deals/{deal_id}", headers=customer).json()["events"]]
    assert "Finance · Monthly payments" in customer_titles
