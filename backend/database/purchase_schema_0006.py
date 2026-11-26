"""Frozen purchase DDL shared by the consolidated 0006 and its historical successors."""
from alembic import op
import sqlalchemy as sa


MARK = "AutoEdge consolidated purchase schema 0006"


def bundled():
    return op.get_bind().scalar(sa.text(
        "SELECT obj_description(to_regclass('public.deals'), 'pg_class')"
    )) == MARK


def base_column(table, column, expected, foreign_key=None):
    """Adopt a compatible existing nullable column or install it without a backfill."""
    inspector = sa.inspect(op.get_bind())
    columns = {c["name"]: c for c in inspector.get_columns(table)}
    prior = columns.get(column.name)
    if prior is None:
        op.add_column(table, column)
    elif str(prior["type"]) != expected or not prior["nullable"]:
        raise RuntimeError(f"Incompatible existing column {table}.{column.name}; migration rolled back")
    if foreign_key:
        foreign_table, foreign_column = foreign_key
        keys = [k for k in inspector.get_foreign_keys(table) if column.name in k["constrained_columns"]]
        if not keys:
            op.create_foreign_key(None, table, foreign_table, [column.name], [foreign_column])
        elif not all(k["constrained_columns"] == [column.name] and k["referred_table"] == foreign_table
                     and k["referred_schema"] in (None, "public") and k["referred_columns"] == [foreign_column]
                     for k in keys):
            raise RuntimeError(f"Incompatible foreign key on {table}.{column.name}")


def ensure_unique(name, table, columns):
    for item in sa.inspect(op.get_bind()).get_unique_constraints(table):
        if item["name"] == name:
            if item["column_names"] != columns:
                raise RuntimeError(f"Incompatible existing constraint {name}")
            return
    op.create_unique_constraint(name, table, columns)


def payment_checks(wallet):
    for name in ("ck_sales_payment", "sales_payment_type_check"):
        op.execute(f"ALTER TABLE sales DROP CONSTRAINT IF EXISTS {name}")
    for name in ("ck_bt_txn_type", "bank_transactions_txn_type_check"):
        op.execute(f"ALTER TABLE bank_transactions DROP CONSTRAINT IF EXISTS {name}")
    payments = "'Cash','Finance','Lease'" + (",'Demo Wallet'" if wallet else "")
    transactions = "'Opening Balance','Top Up','Reservation Deposit','Service Booking Fee','Refund'"
    if wallet:
        transactions += ",'Vehicle Purchase'"
    op.create_check_constraint("ck_sales_payment", "sales", f"payment_type IN ({payments})")
    op.create_check_constraint("ck_bt_txn_type", "bank_transactions", f"txn_type IN ({transactions})")


def add_wallet():
    op.alter_column("sales", "staff_id", nullable=True)
    base_column("sales", sa.Column("checkout_key", sa.String(36)), "VARCHAR(36)")
    ensure_unique("uq_sale_checkout", "sales", ["customer_id", "checkout_key"])
    base_column("bank_transactions", sa.Column("sale_id", sa.Integer), "INTEGER", ("sales", "sale_id"))
    indexes = {i["name"]: i for i in sa.inspect(op.get_bind()).get_indexes("bank_transactions")}
    index = indexes.get("ix_bank_transactions_sale_id")
    if index is None:
        op.create_index("ix_bank_transactions_sale_id", "bank_transactions", ["sale_id"])
    elif index["column_names"] != ["sale_id"] or index["unique"] or index["dialect_options"].get("postgresql_where"):
        raise RuntimeError("Incompatible existing ix_bank_transactions_sale_id")
    payment_checks(True)
    op.add_column("deals", sa.Column("refund_requested_at", sa.DateTime))
    op.add_column("deals", sa.Column("refund_approved_by", sa.Integer, sa.ForeignKey("users.user_id")))
    op.execute("""
        DO $$ DECLARE original text; BEGIN
            SELECT pg_get_expr(conbin,conrelid) INTO original FROM pg_constraint
            WHERE conrelid='deals'::regclass AND conname='ck_deal_stage';
            ALTER TABLE deals RENAME CONSTRAINT ck_deal_stage TO ck_deal_stage_original;
            EXECUTE 'ALTER TABLE deals ADD CONSTRAINT ck_deal_stage CHECK ((' || original ||
                ') OR (stage=''Refunded'' AND sale_id IS NOT NULL AND unit_id IS NULL AND refund_approved_by IS NOT NULL))';
            ALTER TABLE deals DROP CONSTRAINT ck_deal_stage_original;
        END $$;
    """)
    op.execute("ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS ck_sm_reason")
    op.execute("ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS stock_movements_reason_check")
    op.create_check_constraint("ck_sm_reason", "stock_movements",
        "reason IN ('Reservation','Reservation Cancelled','Reservation Expired','Sale','Restock','Manual Adjustment','Sale Refund')")


def remove_wallet():
    payment_checks(False)
    op.alter_column("sales", "staff_id", nullable=False)
    op.drop_column("bank_transactions", "sale_id")
    op.drop_column("sales", "checkout_key")
    op.drop_constraint("ck_deal_stage", "deals")
    op.drop_column("deals", "refund_approved_by")
    op.drop_column("deals", "refund_requested_at")
    op.create_check_constraint("ck_deal_stage", "deals",
        "(stage IN ('Cancelled','Expired') AND unit_id IS NULL AND reservation_id IS NOT NULL) OR "
        "(stage='Reserved' AND unit_id IS NOT NULL AND reservation_id IS NOT NULL AND sale_id IS NULL) OR "
        "(stage IN ('Historical sale','Awaiting pickup','Collected') AND unit_id IS NOT NULL AND sale_id IS NOT NULL)")
    op.drop_constraint("ck_sm_reason", "stock_movements")
    op.create_check_constraint("ck_sm_reason", "stock_movements",
        "reason IN ('Reservation','Reservation Cancelled','Reservation Expired','Sale','Restock','Manual Adjustment')")


def add_receipts():
    base_column("enquiries", sa.Column("sale_id", sa.Integer), "INTEGER", ("sales", "sale_id"))
    ensure_unique("uq_enquiry_sale", "enquiries", ["sale_id"])
    op.add_column("deals", sa.Column("cash_received", sa.Numeric(12, 2)))
    op.add_column("deals", sa.Column("external_funding", sa.Numeric(12, 2)))
    op.add_column("deals", sa.Column("payment_reference", sa.String(100)))
    op.add_column("deals", sa.Column("payment_verified_by", sa.Integer, sa.ForeignKey("users.user_id")))
    op.add_column("deals", sa.Column("payment_verified_at", sa.DateTime))
    op.add_column("deals", sa.Column("pickup_deadline", sa.DateTime))


def remove_receipts():
    op.execute("""
        DO $$ BEGIN
            IF EXISTS (SELECT FROM enquiries WHERE sale_id IS NOT NULL)
                OR EXISTS (SELECT FROM deals WHERE payment_verified_at IS NOT NULL OR pickup_deadline IS NOT NULL)
            THEN RAISE EXCEPTION 'Downgrade would discard purchase evidence'; END IF;
        END $$;
    """)
    for name in ("pickup_deadline", "payment_verified_at", "payment_verified_by", "payment_reference",
                 "external_funding", "cash_received"):
        op.drop_column("deals", name)
    op.drop_column("enquiries", "sale_id")


def add_assistance():
    op.create_table("sales_assistance",
        sa.Column("assistance_id", sa.Integer, primary_key=True),
        sa.Column("customer_id", sa.Integer, sa.ForeignKey("customers.customer_id"), nullable=False),
        sa.Column("vehicle_id", sa.Integer, sa.ForeignKey("vehicles.vehicle_id"), nullable=False),
        sa.Column("owner_id", sa.Integer, sa.ForeignKey("users.user_id"), nullable=False),
        sa.Column("recorded_by", sa.Integer, sa.ForeignKey("users.user_id"), nullable=False),
        sa.Column("kind", sa.String(20), nullable=False), sa.Column("note", sa.String(500), nullable=False),
        sa.Column("enquiry_id", sa.Integer, sa.ForeignKey("enquiries.enquiry_id"), unique=True),
        sa.Column("test_drive_id", sa.Integer, sa.ForeignKey("test_drives.test_drive_id"), unique=True),
        sa.Column("recorded_at", sa.DateTime, nullable=False), sa.Column("closed_at", sa.DateTime),
        sa.Column("sale_id", sa.Integer, sa.ForeignKey("sales.sale_id"), unique=True),
        sa.CheckConstraint("(kind='Conversation' AND enquiry_id IS NOT NULL AND test_drive_id IS NULL) OR "
                           "(kind='Test drive' AND test_drive_id IS NOT NULL AND enquiry_id IS NULL) OR "
                           "(kind='Walk-in' AND enquiry_id IS NULL AND test_drive_id IS NULL)", name="ck_assistance_source"))
    op.create_index("uq_open_assistance", "sales_assistance", ["customer_id","vehicle_id"], unique=True,
                    postgresql_where=sa.text("closed_at IS NULL"))


def remove_assistance():
    op.execute("""DO $$ BEGIN IF EXISTS (SELECT FROM sales_assistance) THEN
        RAISE EXCEPTION 'Downgrade would discard sales assistance records'; END IF; END $$""")
    op.drop_table("sales_assistance")


def add_acquisitions():
    money = sa.Numeric(12, 2)
    op.create_table("trade_acquisitions",
        sa.Column("trade_in_id", sa.Integer, sa.ForeignKey("trade_in_requests.trade_in_id"), primary_key=True),
        sa.Column("inspection_at", sa.DateTime), sa.Column("inspected_value", money), sa.Column("findings", sa.Text),
        sa.Column("terms_version", sa.Integer, nullable=False, server_default="0"), sa.Column("approved_version", sa.Integer),
        sa.Column("excess_amount", money, nullable=False, server_default="0"), sa.Column("excess_terms", sa.Text),
        sa.Column("terms_by", sa.Integer, sa.ForeignKey("users.user_id")), sa.Column("vin", sa.String(17)),
        sa.Column("intake_at", sa.DateTime), sa.Column("intake_by", sa.Integer, sa.ForeignKey("users.user_id")),
        sa.Column("returned_at", sa.DateTime), sa.Column("settlement_reference", sa.String(100)),
        sa.Column("settled_amount", money), sa.Column("settled_at", sa.DateTime),
        sa.Column("settlement_by", sa.Integer, sa.ForeignKey("users.user_id")),
        sa.Column("preparation_cost", money), sa.Column("retail_price", money), sa.Column("retail_description", sa.Text),
        sa.Column("listing_id", sa.Integer, sa.ForeignKey("vehicles.vehicle_id"), unique=True),
        sa.Column("published_by", sa.Integer, sa.ForeignKey("users.user_id")))
    op.execute("INSERT INTO trade_acquisitions(trade_in_id) SELECT trade_in_id FROM trade_in_requests WHERE status='Accepted'")
    op.create_index("uq_held_trade_vin", "trade_acquisitions", ["vin"], unique=True,
                    postgresql_where=sa.text("returned_at IS NULL AND listing_id IS NULL"))
    op.add_column("inventory_units", sa.Column("superseded_by_trade", sa.Integer, sa.ForeignKey("trade_in_requests.trade_in_id")))
    op.create_unique_constraint("uq_unit_following_trade", "inventory_units", ["superseded_by_trade"])
    op.drop_constraint("inventory_units_vin_key", "inventory_units")
    op.create_index("uq_current_unit_vin", "inventory_units", ["vin"], unique=True,
                    postgresql_where=sa.text("superseded_by_trade IS NULL"))


def remove_acquisitions():
    op.execute("""DO $$ BEGIN IF EXISTS (SELECT FROM trade_acquisitions)
        THEN RAISE EXCEPTION 'Downgrade would discard trade-in records'; END IF; END $$""")
    op.drop_index("uq_current_unit_vin", table_name="inventory_units")
    op.create_unique_constraint("inventory_units_vin_key", "inventory_units", ["vin"])
    op.drop_column("inventory_units", "superseded_by_trade")
    op.drop_table("trade_acquisitions")
