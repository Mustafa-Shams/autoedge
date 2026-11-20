"""store_tables — create all 19 new storefront tables

Revision ID: 0002_store_tables
Revises: 001_create_all_tables
Create Date: 2026-11-08

"""
from alembic import op
import sqlalchemy as sa

revision = '0002_store_tables'
down_revision = '001_create_all_tables'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Sequence for txn reference codes ─────────────────────────────────
    op.execute("CREATE SEQUENCE IF NOT EXISTS txn_ref_seq START 1")

    # ── 1. customer_accounts ─────────────────────────────────────────────
    op.create_table(
        'customer_accounts',
        sa.Column('account_id', sa.Integer(), primary_key=True),
        sa.Column('customer_id', sa.Integer(),
                  sa.ForeignKey('customers.customer_id', ondelete='CASCADE'),
                  nullable=False, unique=True),
        sa.Column('email', sa.String(150), nullable=False, unique=True),
        sa.Column('password_hash', sa.String(255), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('email_verified', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('last_login_at', sa.DateTime()),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.execute(
        "ALTER TABLE customer_accounts "
        "ADD CONSTRAINT chk_ca_email_lower CHECK (email = LOWER(TRIM(email)))"
    )

    # ── 2. vehicle_images ────────────────────────────────────────────────
    op.create_table(
        'vehicle_images',
        sa.Column('image_id', sa.Integer(), primary_key=True),
        sa.Column('vehicle_id', sa.Integer(),
                  sa.ForeignKey('vehicles.vehicle_id', ondelete='CASCADE'),
                  nullable=False),
        sa.Column('image_url', sa.Text(), nullable=False),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('credit', sa.Text()),
        sa.Column('source_url', sa.Text()),
    )
    op.create_index('idx_vimg_vehicle', 'vehicle_images', ['vehicle_id', 'sort_order'])

    # ── 3. reservations ──────────────────────────────────────────────────
    op.create_table(
        'reservations',
        sa.Column('reservation_id', sa.Integer(), primary_key=True),
        sa.Column('customer_id', sa.Integer(),
                  sa.ForeignKey('customers.customer_id', ondelete='RESTRICT'),
                  nullable=False),
        sa.Column('vehicle_id', sa.Integer(),
                  sa.ForeignKey('vehicles.vehicle_id', ondelete='RESTRICT'),
                  nullable=False),
        sa.Column('deposit_amount', sa.Numeric(12, 2), nullable=False),
        sa.Column('hold_days', sa.Integer(), nullable=False),
        sa.Column('reserved_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('status', sa.String(15), nullable=False, server_default="'Active'"),
        sa.Column('closed_at', sa.DateTime()),
        sa.Column('notes', sa.Text()),
        sa.CheckConstraint('deposit_amount > 0', name='ck_res_deposit_pos'),
        sa.CheckConstraint('hold_days BETWEEN 7 AND 30', name='ck_res_hold_days'),
        sa.CheckConstraint(
            "status IN ('Active','Converted','Cancelled','Expired')",
            name='ck_res_status'),
    )
    op.create_index('idx_res_customer', 'reservations', ['customer_id'])
    op.create_index('idx_res_vehicle', 'reservations', ['vehicle_id'])
    op.create_index('idx_res_status', 'reservations', ['status'])
    op.execute(
        "CREATE INDEX idx_res_expiry ON reservations(expires_at) WHERE status = 'Active'"
    )
    op.execute(
        "CREATE UNIQUE INDEX uq_res_active_per_customer_vehicle "
        "ON reservations (customer_id, vehicle_id) WHERE status = 'Active'"
    )

    # ── 4. customer_vehicles ─────────────────────────────────────────────
    op.create_table(
        'customer_vehicles',
        sa.Column('cv_id', sa.Integer(), primary_key=True),
        sa.Column('customer_id', sa.Integer(),
                  sa.ForeignKey('customers.customer_id', ondelete='CASCADE'),
                  nullable=False),
        sa.Column('make', sa.String(50), nullable=False),
        sa.Column('model', sa.String(50), nullable=False),
        sa.Column('year', sa.Integer(), nullable=False),
        sa.Column('color', sa.String(40)),
        sa.Column('plate_number', sa.String(20)),
        sa.Column('vin_number', sa.String(30)),
        sa.Column('source_sale_id', sa.Integer(),
                  sa.ForeignKey('sales.sale_id', ondelete='SET NULL')),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('idx_cv_customer', 'customer_vehicles', ['customer_id'])
    op.execute(
        "CREATE UNIQUE INDEX uq_cv_plate "
        "ON customer_vehicles(customer_id, plate_number) WHERE plate_number IS NOT NULL"
    )

    # ── 5. service_types ─────────────────────────────────────────────────
    op.create_table(
        'service_types',
        sa.Column('service_type_id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.String(60), nullable=False, unique=True),
        sa.Column('description', sa.Text()),
        sa.Column('base_price', sa.Numeric(10, 2), nullable=False),
        sa.Column('booking_fee', sa.Numeric(8, 2), nullable=False),
        sa.Column('duration_minutes', sa.Integer(), nullable=False, server_default='60'),
        sa.Column('required_specialty', sa.String(30)),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
    )

    # ── 6. technician_profiles ───────────────────────────────────────────
    op.create_table(
        'technician_profiles',
        sa.Column('user_id', sa.Integer(),
                  sa.ForeignKey('users.user_id', ondelete='CASCADE'),
                  primary_key=True),
        sa.Column('specialty', sa.String(30), nullable=False),
        sa.Column('years_experience', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('bio', sa.Text()),
        sa.Column('photo_url', sa.Text()),
        sa.Column('is_bookable', sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.execute(
        "ALTER TABLE technician_profiles ADD CONSTRAINT ck_tp_specialty "
        "CHECK (specialty IN ('Mechanic','Electrician','AC Specialist','Body & Paint','Tyre & Alignment'))"
    )

    # ── 7. service_bookings ──────────────────────────────────────────────
    op.create_table(
        'service_bookings',
        sa.Column('booking_id', sa.Integer(), primary_key=True),
        sa.Column('customer_id', sa.Integer(),
                  sa.ForeignKey('customers.customer_id', ondelete='RESTRICT'),
                  nullable=False),
        sa.Column('cv_id', sa.Integer(),
                  sa.ForeignKey('customer_vehicles.cv_id', ondelete='RESTRICT'),
                  nullable=False),
        sa.Column('service_type_id', sa.Integer(),
                  sa.ForeignKey('service_types.service_type_id'),
                  nullable=False),
        sa.Column('technician_id', sa.Integer(),
                  sa.ForeignKey('users.user_id')),
        sa.Column('booking_date', sa.Date(), nullable=False),
        sa.Column('time_slot', sa.Time(), nullable=False),
        sa.Column('notes', sa.Text()),
        sa.Column('fee_amount', sa.Numeric(8, 2), nullable=False),
        sa.Column('status', sa.String(15), nullable=False, server_default="'Booked'"),
        sa.Column('service_job_id', sa.Integer(),
                  sa.ForeignKey('service_jobs.job_id', ondelete='SET NULL')),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint(
            "status IN ('Booked','Confirmed','Completed','Cancelled','No-Show')",
            name='ck_sb_status'),
    )
    op.create_index('idx_sb_customer', 'service_bookings', ['customer_id'])
    op.create_index('idx_sb_status', 'service_bookings', ['status'])
    op.create_index('idx_sb_date', 'service_bookings', ['booking_date'])
    op.execute(
        "CREATE UNIQUE INDEX uq_sb_tech_slot "
        "ON service_bookings (technician_id, booking_date, time_slot) "
        "WHERE technician_id IS NOT NULL AND status IN ('Booked','Confirmed')"
    )

    # ── 8. bank_accounts ─────────────────────────────────────────────────
    op.create_table(
        'bank_accounts',
        sa.Column('bank_account_id', sa.Integer(), primary_key=True),
        sa.Column('customer_id', sa.Integer(),
                  sa.ForeignKey('customers.customer_id', ondelete='CASCADE'),
                  nullable=False, unique=True),
        sa.Column('bank_name', sa.String(60), nullable=False,
                  server_default="'AutoEdge Demo Bank'"),
        sa.Column('account_number', sa.String(20), nullable=False, unique=True),
        sa.Column('card_last4', sa.String(4), nullable=False),
        sa.Column('balance', sa.Numeric(14, 2), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint('balance >= 0', name='ck_ba_balance_nonneg'),
    )

    # ── 9. bank_transactions ─────────────────────────────────────────────
    op.create_table(
        'bank_transactions',
        sa.Column('txn_id', sa.Integer(), primary_key=True),
        sa.Column('bank_account_id', sa.Integer(),
                  sa.ForeignKey('bank_accounts.bank_account_id', ondelete='CASCADE'),
                  nullable=False),
        sa.Column('txn_type', sa.String(30), nullable=False),
        sa.Column('direction', sa.String(6), nullable=False),
        sa.Column('amount', sa.Numeric(12, 2), nullable=False),
        sa.Column('balance_after', sa.Numeric(14, 2), nullable=False),
        sa.Column('reference_code', sa.String(30), nullable=False, unique=True),
        sa.Column('idempotency_key', sa.String(64), unique=True),
        sa.Column('description', sa.String(200)),
        sa.Column('reservation_id', sa.Integer(),
                  sa.ForeignKey('reservations.reservation_id', ondelete='SET NULL')),
        sa.Column('service_booking_id', sa.Integer(),
                  sa.ForeignKey('service_bookings.booking_id', ondelete='SET NULL')),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint(
            "txn_type IN ('Opening Balance','Top Up','Reservation Deposit','Service Booking Fee','Refund')",
            name='ck_bt_txn_type'),
        sa.CheckConstraint(
            "direction IN ('Credit','Debit')",
            name='ck_bt_direction'),
        sa.CheckConstraint('amount > 0', name='ck_bt_amount_pos'),
    )
    op.create_index('idx_bt_account_date', 'bank_transactions',
                    ['bank_account_id', sa.text('created_at DESC')])
    op.create_index('idx_bt_reservation', 'bank_transactions', ['reservation_id'])
    op.create_index('idx_bt_booking', 'bank_transactions', ['service_booking_id'])

    # ── 10. stock_movements ──────────────────────────────────────────────
    op.create_table(
        'stock_movements',
        sa.Column('movement_id', sa.Integer(), primary_key=True),
        sa.Column('vehicle_id', sa.Integer(),
                  sa.ForeignKey('vehicles.vehicle_id', ondelete='CASCADE'),
                  nullable=False),
        sa.Column('change_qty', sa.Integer(), nullable=False),
        sa.Column('reason', sa.String(30), nullable=False),
        sa.Column('reference_id', sa.Integer()),
        sa.Column('created_by', sa.Integer(),
                  sa.ForeignKey('users.user_id')),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint('change_qty <> 0', name='ck_sm_change_nonzero'),
        sa.CheckConstraint(
            "reason IN ('Reservation','Reservation Cancelled','Reservation Expired','Sale','Restock','Manual Adjustment')",
            name='ck_sm_reason'),
    )
    op.create_index('idx_sm_vehicle', 'stock_movements', ['vehicle_id'])

    # ── 11. restock_requests ─────────────────────────────────────────────
    op.create_table(
        'restock_requests',
        sa.Column('request_id', sa.Integer(), primary_key=True),
        sa.Column('customer_id', sa.Integer(),
                  sa.ForeignKey('customers.customer_id', ondelete='CASCADE'),
                  nullable=False),
        sa.Column('vehicle_id', sa.Integer(),
                  sa.ForeignKey('vehicles.vehicle_id', ondelete='CASCADE'),
                  nullable=False),
        sa.Column('status', sa.String(12), nullable=False, server_default="'Open'"),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('fulfilled_at', sa.DateTime()),
        sa.CheckConstraint(
            "status IN ('Open','Fulfilled','Withdrawn')",
            name='ck_rr_status'),
    )
    op.create_index('idx_rr_vehicle_status', 'restock_requests', ['vehicle_id', 'status'])
    op.execute(
        "CREATE UNIQUE INDEX uq_rr_open "
        "ON restock_requests (customer_id, vehicle_id) WHERE status = 'Open'"
    )

    # ── 12. enquiries ────────────────────────────────────────────────────
    op.create_table(
        'enquiries',
        sa.Column('enquiry_id', sa.Integer(), primary_key=True),
        sa.Column('customer_id', sa.Integer(),
                  sa.ForeignKey('customers.customer_id', ondelete='CASCADE'),
                  nullable=False),
        sa.Column('vehicle_id', sa.Integer(),
                  sa.ForeignKey('vehicles.vehicle_id', ondelete='SET NULL')),
        sa.Column('subject', sa.String(150), nullable=False),
        sa.Column('status', sa.String(10), nullable=False, server_default="'Open'"),
        sa.Column('assigned_to', sa.Integer(),
                  sa.ForeignKey('users.user_id')),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint(
            "status IN ('Open','Answered','Closed')",
            name='ck_enq_status'),
    )
    op.create_index('idx_enq_customer', 'enquiries', ['customer_id'])
    op.create_index('idx_enq_status', 'enquiries', ['status'])
    op.create_index('idx_enq_assigned', 'enquiries', ['assigned_to'])

    # ── 13. enquiry_messages ─────────────────────────────────────────────
    op.create_table(
        'enquiry_messages',
        sa.Column('message_id', sa.Integer(), primary_key=True),
        sa.Column('enquiry_id', sa.Integer(),
                  sa.ForeignKey('enquiries.enquiry_id', ondelete='CASCADE'),
                  nullable=False),
        sa.Column('sender_type', sa.String(10), nullable=False),
        sa.Column('sender_user_id', sa.Integer(),
                  sa.ForeignKey('users.user_id')),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint(
            "sender_type IN ('customer','staff')",
            name='ck_em_sender_type'),
    )
    op.create_index('idx_em_enquiry', 'enquiry_messages', ['enquiry_id', 'created_at'])

    # ── 14. trade_in_requests ────────────────────────────────────────────
    op.create_table(
        'trade_in_requests',
        sa.Column('trade_in_id', sa.Integer(), primary_key=True),
        sa.Column('customer_id', sa.Integer(),
                  sa.ForeignKey('customers.customer_id', ondelete='CASCADE'),
                  nullable=False),
        sa.Column('target_vehicle_id', sa.Integer(),
                  sa.ForeignKey('vehicles.vehicle_id', ondelete='SET NULL')),
        sa.Column('make', sa.String(50), nullable=False),
        sa.Column('model', sa.String(50), nullable=False),
        sa.Column('year', sa.Integer(), nullable=False),
        sa.Column('mileage_km', sa.Integer(), nullable=False),
        sa.Column('color', sa.String(40)),
        sa.Column('condition_rating', sa.String(10), nullable=False),
        sa.Column('description', sa.Text()),
        sa.Column('expected_price', sa.Numeric(12, 2)),
        sa.Column('indicative_low', sa.Numeric(12, 2)),
        sa.Column('indicative_high', sa.Numeric(12, 2)),
        sa.Column('status', sa.String(15), nullable=False, server_default="'Submitted'"),
        sa.Column('offered_value', sa.Numeric(12, 2)),
        sa.Column('offer_valid_until', sa.DateTime()),
        sa.Column('appraised_by', sa.Integer(),
                  sa.ForeignKey('users.user_id')),
        sa.Column('staff_notes', sa.Text()),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint('mileage_km >= 0', name='ck_ti_mileage'),
        sa.CheckConstraint(
            "condition_rating IN ('Excellent','Good','Fair','Poor')",
            name='ck_ti_condition'),
        sa.CheckConstraint(
            "status IN ('Submitted','Under Review','Offer Made','Accepted','Declined','Expired','Completed','Cancelled')",
            name='ck_ti_status'),
    )
    op.create_index('idx_ti_customer', 'trade_in_requests', ['customer_id'])
    op.create_index('idx_ti_status', 'trade_in_requests', ['status'])

    # ── 15. trade_in_images ──────────────────────────────────────────────
    op.create_table(
        'trade_in_images',
        sa.Column('image_id', sa.Integer(), primary_key=True),
        sa.Column('trade_in_id', sa.Integer(),
                  sa.ForeignKey('trade_in_requests.trade_in_id', ondelete='CASCADE'),
                  nullable=False),
        sa.Column('image_url', sa.Text(), nullable=False),
        sa.Column('uploaded_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('idx_tii_trade', 'trade_in_images', ['trade_in_id'])

    # ── 16. reviews ──────────────────────────────────────────────────────
    op.create_table(
        'reviews',
        sa.Column('review_id', sa.Integer(), primary_key=True),
        sa.Column('vehicle_id', sa.Integer(),
                  sa.ForeignKey('vehicles.vehicle_id', ondelete='CASCADE'),
                  nullable=False),
        sa.Column('customer_id', sa.Integer(),
                  sa.ForeignKey('customers.customer_id', ondelete='CASCADE'),
                  nullable=False),
        sa.Column('rating', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(120)),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('is_visible', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint('rating BETWEEN 1 AND 5', name='ck_rev_rating'),
        sa.UniqueConstraint('vehicle_id', 'customer_id',
                            name='uq_review_one_per_customer_vehicle'),
    )
    op.create_index('idx_rev_vehicle', 'reviews', ['vehicle_id', 'is_visible'])

    # ── 17. wishlist_items ───────────────────────────────────────────────
    op.create_table(
        'wishlist_items',
        sa.Column('customer_id', sa.Integer(),
                  sa.ForeignKey('customers.customer_id', ondelete='CASCADE'),
                  primary_key=True),
        sa.Column('vehicle_id', sa.Integer(),
                  sa.ForeignKey('vehicles.vehicle_id', ondelete='CASCADE'),
                  primary_key=True),
        sa.Column('added_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    # ── 18. notifications ────────────────────────────────────────────────
    op.create_table(
        'notifications',
        sa.Column('notification_id', sa.Integer(), primary_key=True),
        sa.Column('customer_id', sa.Integer(),
                  sa.ForeignKey('customers.customer_id', ondelete='CASCADE'),
                  nullable=False),
        sa.Column('type', sa.String(40), nullable=False),
        sa.Column('title', sa.String(150), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('link_path', sa.String(200)),
        sa.Column('is_read', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('idx_notif_customer', 'notifications',
                    ['customer_id', 'is_read'])

    # ── 19. email_outbox ─────────────────────────────────────────────────
    op.create_table(
        'email_outbox',
        sa.Column('email_id', sa.Integer(), primary_key=True),
        sa.Column('customer_id', sa.Integer(),
                  sa.ForeignKey('customers.customer_id', ondelete='SET NULL')),
        sa.Column('to_email', sa.String(150), nullable=False),
        sa.Column('subject', sa.String(200), nullable=False),
        sa.Column('body_html', sa.Text(), nullable=False),
        sa.Column('status', sa.String(12), nullable=False, server_default="'Queued'"),
        sa.Column('error_message', sa.Text()),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('sent_at', sa.DateTime()),
        sa.CheckConstraint(
            "status IN ('Queued','Sent','Failed','Suppressed')",
            name='ck_eo_status'),
    )
    op.create_index('idx_eo_status', 'email_outbox', ['status'])


def downgrade() -> None:
    op.drop_table('email_outbox')
    op.drop_table('notifications')
    op.drop_table('wishlist_items')
    op.drop_table('reviews')
    op.drop_table('trade_in_images')
    op.drop_table('trade_in_requests')
    op.drop_table('enquiry_messages')
    op.drop_table('enquiries')
    op.drop_table('restock_requests')
    op.drop_table('stock_movements')
    op.drop_table('bank_transactions')
    op.drop_table('bank_accounts')
    op.drop_table('service_bookings')
    op.drop_table('technician_profiles')
    op.drop_table('service_types')
    op.drop_table('customer_vehicles')
    op.drop_table('reservations')
    op.drop_table('vehicle_images')
    op.drop_table('customer_accounts')
    op.execute("DROP SEQUENCE IF EXISTS txn_ref_seq")
