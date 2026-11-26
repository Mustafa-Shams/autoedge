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


SNAPSHOT_QUERIES = {
    "columns": """SELECT table_name, column_name, data_type, character_maximum_length, numeric_precision,
                  numeric_scale, is_nullable, column_default FROM information_schema.columns
                  WHERE table_schema='public' ORDER BY 1,2""",
    "indexes": "SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY 1,2",
    "constraints": """SELECT c.conrelid::regclass::text, c.conname, pg_get_constraintdef(c.oid), c.convalidated
                      FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace
                      WHERE n.nspname='public' ORDER BY 1,2""",
    "triggers": """SELECT c.relname, t.tgname, pg_get_triggerdef(t.oid) FROM pg_trigger t
                   JOIN pg_class c ON c.oid=t.tgrelid WHERE NOT t.tgisinternal ORDER BY 1,2""",
    "views": "SELECT viewname, definition FROM pg_views WHERE schemaname='public' ORDER BY 1",
    "functions": """SELECT p.proname, md5(p.prosrc) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
                    WHERE n.nspname='public' ORDER BY 1""",
}


def schema_snapshot(db):
    with db.connect() as conn:
        return {key: conn.exec_driver_sql(query).all() for key, query in SNAPSHOT_QUERIES.items()}


# Known, reviewed differences between Base.metadata and the migrated schema. Anything else is drift.
ACCEPTED_MODEL_DIFFERENCES = {
    ("add_constraint", "commissions", "uq_commission_sale"),  # Same column is already UNIQUE (commissions_sale_id_key).
    ("remove_constraint", "customer_accounts", "customer_accounts_email_key"),  # Model spells it as a unique index.
    ("add_index", "customer_accounts", "ix_customer_accounts_email"),
    ("remove_constraint", "users", "users_email_key"),
    ("add_index", "users", "ix_users_email"),
    ("remove_constraint", "reviews", "uq_review_one_per_customer_vehicle"),  # Database is stricter than the model.
    ("remove_column", "service_parts", "total_cost"),  # Model computes it as a property.
    ("remove_table_comment", "deals", None),  # 0006 installation marker.
}


def model_differences(db):
    import re
    import app.models  # noqa: F401
    from alembic.autogenerate import compare_metadata
    from alembic.migration import MigrationContext
    from app.db.base import Base

    found = set()
    with db.connect() as conn:
        context = MigrationContext.configure(conn, opts={"compare_type": True})
        for diff in compare_metadata(context, Base.metadata):
            for item in diff if isinstance(diff, list) else [diff]:
                kind = item[0]
                if kind in ("add_index", "remove_index"):
                    index = item[1]
                    named = index.name.startswith(("idx_", "uq_"))
                    pk_only = (re.fullmatch(r"ix_\w+", index.name) and len(index.columns) == 1
                               and list(index.columns)[0].primary_key)
                    # Migrations name their indexes; models mark primary keys index=True.
                    if (kind == "remove_index" and named) or (kind == "add_index" and pk_only):
                        continue
                    found.add((kind, index.table.name, index.name))
                elif kind in ("add_constraint", "remove_constraint"):
                    found.add((kind, item[1].table.name, item[1].name))
                elif kind in ("add_column", "remove_column"):
                    found.add((kind, item[2], item[3].name))
                elif kind in ("add_table", "remove_table"):
                    found.add((kind, item[1].name, None))
                elif kind.startswith("modify_"):
                    found.add((kind, item[2], item[3]))
                elif kind == "remove_table_comment":
                    found.add((kind, item[1].name, None))
                else:
                    found.add((kind, repr(item)[:120], None))
    return found


def test_full_round_trip_with_strays_matches_models(local_pg):
    """0005 with the four empty strays -> head -> 0005 -> head reproduces one schema that matches the models."""
    db, migrate = local_pg
    migrate("upgrade", "0005_staff_portal")
    at_0005 = schema_snapshot(db)
    from app.models import Deal, InventoryUnit, SalesAssistance, TradeAcquisition
    # Neon received these from create_all with the models of the time.
    Deal.metadata.create_all(db, tables=[m.__table__ for m in (Deal, InventoryUnit, SalesAssistance, TradeAcquisition)])
    migrate("upgrade", "head")
    first_head = schema_snapshot(db)
    assert {name for name, *_ in first_head["triggers"]} == {"vehicles"}
    assert {row[1] for row in first_head["triggers"]} == {"stock_units_on_insert", "trg_vehicle_status_sync"}
    assert {row[0] for row in first_head["views"]} == {"v_vehicle_catalog", "v_restock_priority"}
    assert model_differences(db) == ACCEPTED_MODEL_DIFFERENCES
    migrate("downgrade", "0005_staff_portal")
    assert schema_snapshot(db) == at_0005
    migrate("upgrade", "head")
    assert schema_snapshot(db) == first_head


def test_enquiry_category_downgrade_keeps_general_technicians(local_pg):
    db, migrate = local_pg
    migrate("upgrade", "head")
    with db.begin() as conn:
        conn.exec_driver_sql("""INSERT INTO users(full_name,email,password_hash,role)
                               VALUES ('Tech','tech@example.com','unused','technician')""")
        conn.exec_driver_sql("INSERT INTO technician_profiles(user_id,specialty,is_bookable) VALUES (1,'General',false)")
    migrate("downgrade", "0015_deal_activity")
    with db.connect() as conn:
        assert conn.scalar(text("SELECT specialty FROM technician_profiles")) == "General"
        # The 0015 rule still applies to new rows; existing rows are kept for review.
        assert conn.scalar(text("SELECT convalidated FROM pg_constraint WHERE conname='ck_tp_specialty'")) is False
    with pytest.raises(Exception, match="ck_tp_specialty"):
        with db.begin() as conn:
            conn.exec_driver_sql("UPDATE technician_profiles SET specialty='Painter'")
    migrate("upgrade", "head")
    with db.connect() as conn:
        assert conn.scalar(text("SELECT convalidated FROM pg_constraint WHERE conname='ck_tp_specialty'")) is True
