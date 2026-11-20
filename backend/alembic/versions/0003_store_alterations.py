"""store_alterations — alter existing tables for storefront

Revision ID: 0003_store_alterations
Revises: 0002_store_tables
Create Date: 2026-11-08

"""
from alembic import op
import sqlalchemy as sa

revision = '0003_store_alterations'
down_revision = '0002_store_tables'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── users: who handles customer enquiries ────────────────────────────
    op.add_column('users',
        sa.Column('handles_enquiries', sa.Boolean(), nullable=False, server_default=sa.false()))

    # ── vehicles: storefront fields + stock ──────────────────────────────
    op.add_column('vehicles',
        sa.Column('stock_quantity', sa.Integer(), nullable=False, server_default='1'))
    op.add_column('vehicles', sa.Column('description', sa.Text()))
    op.add_column('vehicles', sa.Column('main_image_url', sa.Text()))
    op.add_column('vehicles', sa.Column('engine', sa.String(60)))
    op.add_column('vehicles', sa.Column('horsepower', sa.Integer()))
    op.add_column('vehicles', sa.Column('seats', sa.Integer()))
    op.add_column('vehicles', sa.Column('drivetrain', sa.String(20)))
    op.add_column('vehicles',
        sa.Column('is_published', sa.Boolean(), nullable=False, server_default=sa.true()))
    op.execute(
        "ALTER TABLE vehicles ADD CONSTRAINT ck_veh_stock CHECK (stock_quantity >= 0)"
    )
    op.create_index('idx_vehicles_stock', 'vehicles', ['stock_quantity'])
    op.create_index('idx_vehicles_published', 'vehicles', ['is_published'])
    op.create_index('idx_vehicles_body', 'vehicles', ['body_type'])
    op.create_index('idx_vehicles_fuel', 'vehicles', ['fuel_type'])

    # ── test_drives: online requests, time slots, 48h expiry ─────────────
    op.add_column('test_drives', sa.Column('scheduled_time', sa.Time()))
    op.add_column('test_drives',
        sa.Column('source', sa.String(10), nullable=False, server_default="'Staff'"))
    op.add_column('test_drives', sa.Column('expires_at', sa.DateTime()))
    # Find and drop the real status constraint name, then recreate
    op.execute("""
        DO $$
        DECLARE cname text;
        BEGIN
            SELECT conname INTO cname
            FROM pg_constraint
            WHERE conrelid = 'test_drives'::regclass AND contype = 'c'
              AND pg_get_constraintdef(oid) ILIKE '%status%';
            IF cname IS NOT NULL THEN
                EXECUTE 'ALTER TABLE test_drives DROP CONSTRAINT ' || quote_ident(cname);
            END IF;
        END $$;
    """)
    op.execute(
        "ALTER TABLE test_drives ADD CONSTRAINT ck_td_status "
        "CHECK (status IN ('Requested','Scheduled','Completed','Cancelled','No-Show','Expired'))"
    )
    op.execute(
        "ALTER TABLE test_drives ADD CONSTRAINT ck_td_source "
        "CHECK (source IN ('Staff','Online'))"
    )
    op.execute(
        "CREATE UNIQUE INDEX uq_td_slot "
        "ON test_drives (vehicle_id, scheduled_date, scheduled_time) "
        "WHERE status IN ('Requested','Scheduled') AND scheduled_time IS NOT NULL"
    )
    op.execute(
        "CREATE INDEX idx_td_expires ON test_drives(expires_at) WHERE status = 'Requested'"
    )

    # ── sales: link to reservation and trade-in, record credits ──────────
    op.add_column('sales',
        sa.Column('reservation_id', sa.Integer(),
                  sa.ForeignKey('reservations.reservation_id')))
    op.add_column('sales',
        sa.Column('trade_in_id', sa.Integer(),
                  sa.ForeignKey('trade_in_requests.trade_in_id')))
    op.add_column('sales',
        sa.Column('deposit_credit', sa.Numeric(12, 2), nullable=False, server_default='0'))
    op.add_column('sales',
        sa.Column('trade_in_credit', sa.Numeric(12, 2), nullable=False, server_default='0'))
    op.create_index('idx_sales_reservation', 'sales', ['reservation_id'])

    # ── service_jobs: a job may belong to a customer-owned car ────────────
    op.alter_column('service_jobs', 'vehicle_id', nullable=True)
    op.add_column('service_jobs',
        sa.Column('customer_vehicle_id', sa.Integer(),
                  sa.ForeignKey('customer_vehicles.cv_id', ondelete='RESTRICT')))
    op.execute(
        "ALTER TABLE service_jobs ADD CONSTRAINT chk_sj_vehicle_ref "
        "CHECK (vehicle_id IS NOT NULL OR customer_vehicle_id IS NOT NULL)"
    )
    op.create_index('idx_sj_cust_vehicle', 'service_jobs', ['customer_vehicle_id'])


def downgrade() -> None:
    op.drop_index('idx_sj_cust_vehicle', 'service_jobs')
    op.execute("ALTER TABLE service_jobs DROP CONSTRAINT IF EXISTS chk_sj_vehicle_ref")
    op.drop_column('service_jobs', 'customer_vehicle_id')
    op.alter_column('service_jobs', 'vehicle_id', nullable=False)

    op.drop_index('idx_sales_reservation', 'sales')
    op.drop_column('sales', 'trade_in_credit')
    op.drop_column('sales', 'deposit_credit')
    op.drop_column('sales', 'trade_in_id')
    op.drop_column('sales', 'reservation_id')

    op.execute("DROP INDEX IF EXISTS idx_td_expires")
    op.execute("DROP INDEX IF EXISTS uq_td_slot")
    op.execute("ALTER TABLE test_drives DROP CONSTRAINT IF EXISTS ck_td_source")
    op.execute("ALTER TABLE test_drives DROP CONSTRAINT IF EXISTS ck_td_status")
    op.drop_column('test_drives', 'expires_at')
    op.drop_column('test_drives', 'source')
    op.drop_column('test_drives', 'scheduled_time')

    op.drop_index('idx_vehicles_fuel', 'vehicles')
    op.drop_index('idx_vehicles_body', 'vehicles')
    op.drop_index('idx_vehicles_published', 'vehicles')
    op.drop_index('idx_vehicles_stock', 'vehicles')
    op.execute("ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS ck_veh_stock")
    op.drop_column('vehicles', 'is_published')
    op.drop_column('vehicles', 'drivetrain')
    op.drop_column('vehicles', 'seats')
    op.drop_column('vehicles', 'horsepower')
    op.drop_column('vehicles', 'engine')
    op.drop_column('vehicles', 'main_image_url')
    op.drop_column('vehicles', 'description')
    op.drop_column('vehicles', 'stock_quantity')

    op.drop_column('users', 'handles_enquiries')
