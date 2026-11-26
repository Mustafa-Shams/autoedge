"""Allocate physical units without treating a listing VIN as verified."""
from alembic import op
import sqlalchemy as sa
from database import purchase_schema_0006 as purchase

revision = "0006_units_and_deals"
down_revision = "0005_staff_portal"
branch_labels = None
depends_on = None


CANDIDATES = ("deals", "inventory_units", "sales_assistance", "trade_acquisitions")


def check_empty_tables():
    conn = op.get_bind()
    # Fail if row-level security would hide records from the emptiness check.
    op.execute("SET LOCAL row_security = off")
    existing = []
    for name in CANDIDATES:
        kind = conn.scalar(sa.text("SELECT relkind FROM pg_class WHERE oid=to_regclass(:name)"),
                           {"name": "public." + name})
        if kind is None:
            continue
        if kind != "r":
            raise RuntimeError(f"Expected a regular table at public.{name}")
        op.execute(f"LOCK TABLE public.{name} IN ACCESS EXCLUSIVE MODE NOWAIT")
        if conn.scalar(sa.text(f"SELECT EXISTS (SELECT FROM public.{name})")):
            raise RuntimeError(f"Refusing to remove nonempty table public.{name}; all records preserved")
        existing.append("public." + name)
    return existing


def upgrade():
    if op.get_bind().scalar(sa.text("SELECT current_schema()")) != "public":
        raise RuntimeError("0006 requires the public schema")
    if purchase.bundled() and op.get_bind().scalar(sa.text(
        "SELECT version_num FROM public.alembic_version"
    )) == revision:
        return
    op.execute("LOCK TABLE vehicles, reservations, sales, enquiries, bank_transactions IN SHARE ROW EXCLUSIVE MODE")
    strays = check_empty_tables()
    if strays:
        # One restricted DROP permits references between the four empty tables.
        # PostgreSQL rejects dependencies from surviving relations and rolls back.
        op.execute("DROP TABLE " + ", ".join(strays) + " RESTRICT")
    # Stop atomically on ambiguous legacy ownership. Never guess a customer or VIN.
    op.execute("""
        DO $$ DECLARE bad_id integer; BEGIN
            SELECT r.reservation_id INTO bad_id FROM reservations r
            LEFT JOIN sales s ON s.reservation_id=r.reservation_id AND s.status='Completed'
            GROUP BY r.reservation_id
            HAVING count(s.sale_id) <> CASE WHEN r.status='Converted' THEN 1 ELSE 0 END
                OR bool_or(s.customer_id<>r.customer_id OR s.vehicle_id<>r.vehicle_id)
            LIMIT 1;
            IF FOUND THEN
                RAISE EXCEPTION 'Ambiguous completed sale for reservation %. Review ownership before upgrade.', bad_id;
            END IF;
        END $$;
    """)
    op.create_table(
        "inventory_units",
        sa.Column("unit_id", sa.Integer, primary_key=True),
        sa.Column("vehicle_id", sa.Integer, sa.ForeignKey("vehicles.vehicle_id", ondelete="CASCADE"), nullable=False),
        sa.Column("vin", sa.String(17), unique=True),
        sa.Column("verified_by", sa.Integer, sa.ForeignKey("users.user_id")),
        sa.Column("verified_at", sa.DateTime),
        sa.UniqueConstraint("vehicle_id", "unit_id", name="uq_unit_listing"),
        sa.CheckConstraint(
            "(vin IS NULL AND verified_at IS NULL AND verified_by IS NULL) OR "
            "(vin IS NOT NULL AND vin ~ '^[A-HJ-NPR-Z0-9]{17}$' "
            "AND verified_at IS NOT NULL AND verified_by IS NOT NULL)", name="ck_unit_verification",
        ),
    )
    op.create_index("ix_inventory_units_vehicle_id", "inventory_units", ["vehicle_id"])
    op.create_table(
        "deals",
        sa.Column("deal_id", sa.Integer, primary_key=True),
        sa.Column("customer_id", sa.Integer, sa.ForeignKey("customers.customer_id"), nullable=False),
        sa.Column("vehicle_id", sa.Integer, sa.ForeignKey("vehicles.vehicle_id"), nullable=False),
        sa.Column("unit_id", sa.Integer, unique=True),
        sa.Column("reservation_id", sa.Integer, sa.ForeignKey("reservations.reservation_id"), unique=True),
        sa.Column("sale_id", sa.Integer, sa.ForeignKey("sales.sale_id"), unique=True),
        sa.Column("stage", sa.String(20), nullable=False),
        sa.ForeignKeyConstraint(["vehicle_id", "unit_id"], ["inventory_units.vehicle_id", "inventory_units.unit_id"]),
        sa.CheckConstraint(
            "(stage IN ('Cancelled', 'Expired') AND unit_id IS NULL AND reservation_id IS NOT NULL) OR "
            "(stage = 'Reserved' AND unit_id IS NOT NULL AND reservation_id IS NOT NULL AND sale_id IS NULL) OR "
            "(stage IN ('Historical sale', 'Awaiting pickup', 'Collected') AND unit_id IS NOT NULL AND sale_id IS NOT NULL)",
            name="ck_deal_stage",
        ),
    )
    op.create_index("ix_deals_customer_id", "deals", ["customer_id"])
    op.execute("""
        INSERT INTO inventory_units(vehicle_id)
        SELECT v.vehicle_id FROM vehicles v, generate_series(1, v.stock_quantity);
    """)
    op.execute("""
        INSERT INTO deals(customer_id, vehicle_id, reservation_id, stage)
        SELECT customer_id, vehicle_id, reservation_id, status FROM reservations
        WHERE status IN ('Expired','Cancelled');
    """)
    op.execute("""
        DO $$ DECLARE item record; allocated integer; BEGIN
            FOR item IN
                SELECT r.customer_id, r.vehicle_id, r.reservation_id, NULL::integer AS sale_id,
                    'Reserved' AS stage FROM reservations r WHERE r.status='Active'
                UNION ALL
                SELECT s.customer_id, s.vehicle_id, s.reservation_id, s.sale_id, 'Historical sale'
                    FROM sales s WHERE s.status='Completed'
            LOOP
                INSERT INTO inventory_units(vehicle_id) VALUES (item.vehicle_id) RETURNING unit_id INTO allocated;
                INSERT INTO deals(customer_id,vehicle_id,unit_id,reservation_id,sale_id,stage)
                VALUES (item.customer_id,item.vehicle_id,allocated,item.reservation_id,item.sale_id,item.stage);
            END LOOP;
            IF EXISTS (
                SELECT FROM vehicles v WHERE v.stock_quantity <> (
                    SELECT count(*) FROM inventory_units u LEFT JOIN deals d USING(unit_id)
                    WHERE u.vehicle_id=v.vehicle_id AND d.deal_id IS NULL)
            ) OR EXISTS (
                SELECT FROM reservations r LEFT JOIN deals d USING(reservation_id) WHERE d.deal_id IS NULL
            ) OR EXISTS (
                SELECT FROM sales s LEFT JOIN deals d USING(sale_id) WHERE s.status='Completed' AND d.deal_id IS NULL
            ) THEN RAISE EXCEPTION 'Inventory or deal reconciliation failed'; END IF;
        END $$;
    """)
    op.execute("""
        CREATE FUNCTION stock_units_on_insert() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
            INSERT INTO inventory_units(vehicle_id) SELECT NEW.vehicle_id FROM generate_series(1, NEW.stock_quantity);
            RETURN NEW;
        END $$;
        CREATE TRIGGER stock_units_on_insert AFTER INSERT ON vehicles
        FOR EACH ROW EXECUTE FUNCTION stock_units_on_insert();
    """)

    purchase.add_wallet()
    purchase.add_receipts()
    purchase.add_assistance()
    purchase.add_acquisitions()
    purchase.base_column("enquiries", sa.Column("category", sa.Text), "TEXT")
    op.execute(f"COMMENT ON TABLE public.deals IS '{purchase.MARK}'")


def downgrade():
    op.execute("LOCK TABLE vehicles, reservations, sales, enquiries, bank_transactions IN SHARE ROW EXCLUSIVE MODE")
    check_empty_tables()
    if purchase.bundled():
        op.execute("""
            DO $$ BEGIN
                IF EXISTS (SELECT FROM sales WHERE checkout_key IS NOT NULL OR staff_id IS NULL)
                   OR EXISTS (SELECT FROM enquiries WHERE category IS NOT NULL OR sale_id IS NOT NULL)
                   OR EXISTS (SELECT FROM bank_transactions WHERE sale_id IS NOT NULL)
                THEN RAISE EXCEPTION 'Downgrade would discard purchase or enquiry data'; END IF;
            END $$;
        """)
        op.drop_column("enquiries", "category")
        purchase.remove_acquisitions()
        purchase.remove_assistance()
        purchase.remove_receipts()
        purchase.remove_wallet()
    op.execute("DROP TRIGGER stock_units_on_insert ON vehicles")
    op.execute("DROP FUNCTION stock_units_on_insert()")
    op.drop_table("deals")
    op.drop_table("inventory_units")
