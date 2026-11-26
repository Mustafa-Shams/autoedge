"""Run on a disposable loopback PostgreSQL server via TEST_DATABASE_URL."""
import os
import subprocess
import sys
from pathlib import Path
from uuid import uuid4
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from types import SimpleNamespace

import pytest
from sqlalchemy import create_engine, text
from app.core.test_database import test_database_url as local_url


@pytest.fixture
def local_pg():
    url = local_url()
    name = "autoedge_test_" + uuid4().hex
    admin = create_engine(url, isolation_level="AUTOCOMMIT")
    db = create_engine(url.set(database=name))
    with admin.connect() as conn:
        conn.exec_driver_sql(f"CREATE DATABASE {name} TEMPLATE template0")
    env = dict(os.environ, AUTOEDGE_TESTING="1", TEST_DATABASE_URL=db.url.render_as_string(hide_password=False), SECRET_KEY="local-test")

    def migrate(*args, check=True):
        return subprocess.run([sys.executable, "-m", "alembic", *args], cwd=Path(__file__).resolve().parents[1],
                              env=env, capture_output=True, text=True, check=check)

    try:
        yield db, migrate
    finally:
        db.dispose()
        with admin.connect() as conn:
            conn.exec_driver_sql(f"DROP DATABASE {name}")
        admin.dispose()


def test_unit_backfill_and_ambiguous_ownership(local_pg):
    db, migrate = local_pg
    migrate("upgrade", "0005_staff_portal")
    with db.begin() as conn:
        conn.exec_driver_sql("""
            INSERT INTO vehicles(make,model,year,price,stock_quantity,vin_number)
            VALUES ('Test','A',2024,10000,2,'LEGACY'), ('Test','B',2024,10000,0,NULL);
            INSERT INTO customers(full_name,phone) VALUES ('Customer','123456789');
            INSERT INTO users(full_name,email,password_hash,role) VALUES ('Staff','test@example.com','unused','manager');
            INSERT INTO reservations(customer_id,vehicle_id,deposit_amount,hold_days,expires_at,status)
            SELECT 1,1,1000,7,now(),stage FROM unnest(ARRAY['Active','Converted','Cancelled','Expired']) stage;
            INSERT INTO sales(vehicle_id,customer_id,staff_id,sale_price,status,reservation_id)
            VALUES (2,1,1,10000,'Completed',2),(1,1,1,10000,'Completed',NULL),(2,1,1,10000,'Pending',NULL);
        """)
    failure = migrate("upgrade", "0006_units_and_deals", check=False)
    assert failure.returncode and "Ambiguous completed sale for reservation 2" in failure.stderr
    with db.begin() as conn:
        assert conn.scalar(text("SELECT version_num FROM alembic_version")) == "0005_staff_portal"
        conn.exec_driver_sql("UPDATE sales SET vehicle_id=1 WHERE sale_id=1")
        before = conn.exec_driver_sql("SELECT sale_id,vehicle_id,customer_id,staff_id,sale_price,status,reservation_id FROM sales ORDER BY sale_id").all()
    for attempt in range(2):
        migrate("upgrade", "0006_units_and_deals")
        with db.connect() as conn:
            assert conn.scalar(text("SELECT count(*) FROM inventory_units WHERE vehicle_id=1 AND vin IS NULL")) == 5
            assert conn.scalar(text("SELECT count(*) FROM inventory_units WHERE vehicle_id=2")) == 0
            assert conn.scalar(text("SELECT count(*) FROM deals WHERE sale_id=1 AND reservation_id=2")) == 1
            assert conn.scalar(text("SELECT count(*) FROM deals WHERE unit_id IS NULL")) == 2
            assert conn.exec_driver_sql("SELECT sale_id,vehicle_id,customer_id,staff_id,sale_price,status,reservation_id FROM sales ORDER BY sale_id").all() == before
        if attempt == 0:
            refused = migrate("downgrade", "0005_staff_portal", check=False)
            assert refused.returncode and "nonempty table" in refused.stderr

    from sqlalchemy.orm import Session
    from app.crud.crud_sale import create_sale
    from app.models.deal import Deal
    from app.schemas.sale import SaleCreate
    from app.services.deal_service import available_units

    migrate("upgrade", "head")
    with Session(db) as session:
        held = session.query(Deal).filter_by(reservation_id=1).one()
        held_unit_id = held.unit_id
        session.execute(text("UPDATE reservations SET expires_at=now()+interval '1 day' WHERE reservation_id=1"))
        sale = create_sale(session, SaleCreate(vehicle_id=1, customer_id=1, staff_id=1,
                           sale_price=10000, status="Completed", reservation_id=1))
        assert (sale.unit_id, sale.pickup_status) == (held_unit_id, "Awaiting pickup")
        assert available_units(session, 1).count() == 2


def test_workshop_migration_preserves_appointment_and_reserves_slot(local_pg):
    from sqlalchemy.exc import IntegrityError

    db, migrate = local_pg
    migrate("upgrade", "0010_trade_acquisitions")
    with db.begin() as conn:
        conn.exec_driver_sql("""
            INSERT INTO customers(full_name,phone) VALUES ('Owner','123456789');
            INSERT INTO users(full_name,email,password_hash,role) VALUES ('Mechanic','qa@example.com','unused','technician');
            INSERT INTO customer_vehicles(customer_id,make,model,year) VALUES (1,'Test','A',2024);
            INSERT INTO service_types(name,base_price,booking_fee) VALUES ('Workshop',80,20);
            INSERT INTO service_jobs(customer_id,customer_vehicle_id,technician_id,job_type,status)
            VALUES (1,1,1,'Workshop','In Progress');
            INSERT INTO service_bookings(customer_id,cv_id,service_type_id,technician_id,booking_date,time_slot,
                                         fee_amount,status,service_job_id)
            VALUES (1,1,1,1,current_date,'10:00',20,'Confirmed',1);
        """)
    for attempt in range(2):
        migrate("upgrade", "head")
        with db.connect() as conn:
            assert conn.execute(text("SELECT status,service_job_id,fee_amount FROM service_bookings")).one() == ("In Progress", 1, 20)
        with pytest.raises(IntegrityError), db.begin() as conn:
            conn.exec_driver_sql("""INSERT INTO service_bookings(customer_id,cv_id,service_type_id,technician_id,booking_date,
                time_slot,fee_amount,status) VALUES (1,1,1,1,current_date,'10:00',20,'Booked')""")
        if attempt == 0:
            migrate("downgrade", "0010_trade_acquisitions")
            with db.connect() as conn:
                assert conn.scalar(text("SELECT status FROM service_bookings")) == "Confirmed"


@pytest.mark.parametrize("retry", [False, True])
def test_concurrent_purchase_of_last_unit(local_pg, retry):
    from sqlalchemy.orm import Session
    from app.core.security import hash_password
    from app.services.purchase_service import PurchaseConflict, PurchaseRequest, purchase

    db, migrate = local_pg
    migrate("upgrade", "head")
    with db.begin() as conn:
        conn.exec_driver_sql("""
            INSERT INTO vehicles(make,model,year,price,stock_quantity) VALUES ('Test','Race',2024,10000,1);
            INSERT INTO customers(full_name,phone) VALUES ('One','111111'),('Two','222222');
            INSERT INTO bank_accounts(customer_id,account_number,card_last4,balance)
            VALUES (1,'000000000001','0001',11000),(2,'000000000002','0002',11000);
        """)
    barrier = Barrier(2)
    key = uuid4()
    password_hash = hash_password("local-password")

    def buy(customer_id):
        account = SimpleNamespace(customer_id=customer_id, password_hash=password_hash)
        body = PurchaseRequest(vehicle_id=1, expected_price=10000, expected_charge=10000, password="local-password",
                               idempotency_key=key if retry else uuid4())
        with Session(db) as session:
            barrier.wait(timeout=10)
            try:
                sale_id = purchase(session, account, body).sale_id
                session.commit()
                return sale_id
            except PurchaseConflict:
                session.rollback()
                return None

    with ThreadPoolExecutor(2) as pool:
        results = list(pool.map(buy, [1, 1 if retry else 2]))
    assert results.count(None) == (0 if retry else 1)
    assert set(r for r in results if r is not None) == {1}
    with db.connect() as conn:
        assert conn.scalar(text("SELECT sum(balance) FROM bank_accounts")) == 12000
        for table in ("sales", "deals", "bank_transactions", "inventory_units", "stock_movements"):
            assert conn.scalar(text(f"SELECT count(*) FROM {table}")) == 1
        assert conn.scalar(text("SELECT stock_quantity FROM vehicles")) == 0


def test_interests_and_private_intake_backfill(local_pg):
    db, migrate = local_pg
    migrate("upgrade", "0012_email_render")
    with db.begin() as conn:
        conn.exec_driver_sql("""
            INSERT INTO customers(full_name,phone) VALUES ('Buyer','555123456');
            INSERT INTO vehicles(make,model,year,price,stock_quantity) VALUES ('Toyota','A',2024,9000,1);
            INSERT INTO enquiries(customer_id,vehicle_id,subject,status) VALUES (1,1,'Availability','Open');
            INSERT INTO test_drives(customer_id,vehicle_id,scheduled_date,status,lead_status,source) VALUES (1,1,current_date,'Scheduled','New','Staff');
            INSERT INTO trade_in_requests(customer_id,target_vehicle_id,make,model,year,mileage_km,condition_rating,status)
                VALUES (1,1,'Demo','Car',2020,22000,'Good','Accepted');
            INSERT INTO trade_acquisitions(trade_in_id,intake_at,vin) VALUES (1,now(),'JTDKN3DU0A0123478');
        """)
    migrate("upgrade", "head")
    with db.connect() as conn:
        ids = [conn.scalar(text(f"SELECT deal_id FROM {table}")) for table in
               ("enquiries","test_drives","trade_in_requests","deals")]
        assert ids[0] and len(set(ids)) == 1
        assert conn.execute(text("SELECT vehicle_id FROM inventory_units WHERE intake_trade_id=1")).one() == (None,)
        assert conn.execute(text("SELECT checked_at,ownership_reference FROM trade_acquisitions")).one() == (None,None)
        assert conn.scalar(text("SELECT stock_quantity FROM vehicles")) == 1


def test_reconcile_four_empty_tables_and_inspect(local_pg):
    import json

    db, migrate = local_pg
    migrate("upgrade", "0005_staff_portal")
    from app.models import Deal, InventoryUnit, SalesAssistance, TradeAcquisition
    Deal.metadata.create_all(db, tables=[m.__table__ for m in
                             (Deal, InventoryUnit, SalesAssistance, TradeAcquisition)])
    with db.begin() as conn:
        conn.exec_driver_sql("ALTER TABLE deals DROP COLUMN cash_received")
        conn.exec_driver_sql("ALTER TABLE sales ADD COLUMN checkout_key varchar(36)")
        conn.exec_driver_sql("INSERT INTO customers(full_name,phone) VALUES ('Preserved','123')")
        original = conn.exec_driver_sql("SELECT * FROM customers").one()
    for attempt in range(2):
        migrate("upgrade", "0006_units_and_deals")
        migrate("upgrade", "0006_units_and_deals")
        with db.connect() as conn:
            assert conn.exec_driver_sql("SELECT * FROM customers").one() == original
            conn.exec_driver_sql("SELECT category,sale_id FROM enquiries")
            conn.exec_driver_sql("SELECT checkout_key FROM sales")
            conn.exec_driver_sql("SELECT cash_received FROM deals")
        script = Path(__file__).resolve().parents[2] / "scripts/db_check.py"
        result = subprocess.run([sys.executable, str(script), db.url.render_as_string(hide_password=False)],
                                capture_output=True, text=True)
        assert result.returncode == 0, result.stderr
        catalog = json.loads(result.stdout)
        assert catalog["transaction_read_only"] and catalog["alembic_version"]["public"] == ["0006_units_and_deals"]
        counts = {t["name"]: t["rows"] for t in catalog["tables"]}
        assert counts["customers"] == 1
        assert all(counts[n] == 0 for n in ("deals","inventory_units","sales_assistance","trade_acquisitions"))
        assert catalog["views"] and any(t["name"] == "stock_units_on_insert" for t in catalog["triggers"])
        if attempt == 0:
            migrate("downgrade", "0005_staff_portal")
            with db.connect() as conn:
                assert conn.scalar(text("SELECT version_num FROM alembic_version")) == "0005_staff_portal"
                assert conn.scalar(text("SELECT to_regclass('public.deals') IS NULL"))
    migrate("upgrade", "head")


@pytest.mark.parametrize("stray", ["deals","inventory_units","sales_assistance","trade_acquisitions"])
def test_nonempty_stray_aborts_atomically(local_pg, stray):
    db, migrate = local_pg
    migrate("upgrade", "0005_staff_portal")
    with db.begin() as conn:
        for table in ("deals","inventory_units","sales_assistance","trade_acquisitions"):
            conn.exec_driver_sql(f"CREATE TABLE {table} (marker integer)")
        conn.exec_driver_sql(f"INSERT INTO {stray} VALUES (9)")
    result = migrate("upgrade","0006_units_and_deals", check=False)
    assert result.returncode and f"nonempty table public.{stray}" in result.stderr
    with db.connect() as conn:
        assert conn.scalar(text("SELECT version_num FROM alembic_version")) == "0005_staff_portal"
        assert conn.scalar(text(f"SELECT marker FROM {stray}")) == 9
        for table in ("deals","inventory_units","sales_assistance","trade_acquisitions"):
            conn.exec_driver_sql(f"SELECT marker FROM {table}")


def test_existing_enquiry_values_survive_upgrade_and_refused_downgrade(local_pg):
    db, migrate = local_pg
    migrate("upgrade", "0005_staff_portal")
    with db.begin() as conn:
        conn.exec_driver_sql("ALTER TABLE enquiries ADD COLUMN category text")
        conn.exec_driver_sql("INSERT INTO customers(full_name,phone) VALUES ('Buyer','123')")
        conn.exec_driver_sql("""INSERT INTO enquiries(customer_id,subject,status,category)
                               VALUES (1,'Question','Open','Pickup')""")
    migrate("upgrade", "0006_units_and_deals")
    result = migrate("downgrade", "0005_staff_portal", check=False)
    assert result.returncode and "discard purchase or enquiry data" in result.stderr
    with db.connect() as conn:
        assert conn.exec_driver_sql("SELECT subject,category FROM enquiries").one() == ("Question", "Pickup")
        assert conn.scalar(text("SELECT version_num FROM alembic_version")) == "0006_units_and_deals"
