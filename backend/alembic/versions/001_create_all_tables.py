"""create_all_tables

Revision ID: 001_create_all_tables
Revises: 
Create Date: 2026-10-28

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '001_create_all_tables'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ─── TABLE 1: users ─────────────────────────────────────────────────────
    op.create_table(
        'users',
        sa.Column('user_id', sa.Integer(), primary_key=True),
        sa.Column('full_name', sa.String(100), nullable=False),
        sa.Column('email', sa.String(150), nullable=False, unique=True),
        sa.Column('password_hash', sa.String(255), nullable=False),
        sa.Column('role', sa.String(30), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint(
            "role IN ('manager','sales_executive','technician','receptionist')",
            name='ck_users_role'
        ),
    )
    op.create_index('idx_users_email', 'users', ['email'])
    op.create_index('idx_users_role', 'users', ['role'])
    op.create_index('idx_users_active', 'users', ['is_active'])

    # ─── TABLE 2: vehicles ──────────────────────────────────────────────────
    op.create_table(
        'vehicles',
        sa.Column('vehicle_id', sa.Integer(), primary_key=True),
        sa.Column('make', sa.String(50), nullable=False),
        sa.Column('model', sa.String(50), nullable=False),
        sa.Column('year', sa.Integer(), nullable=False),
        sa.Column('color', sa.String(40)),
        sa.Column('fuel_type', sa.String(20)),
        sa.Column('transmission', sa.String(20)),
        sa.Column('body_type', sa.String(20)),
        sa.Column('condition_type', sa.String(15), nullable=False, server_default='New'),
        sa.Column('mileage_km', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('vin_number', sa.String(30), unique=True),
        sa.Column('price', sa.Numeric(12, 2), nullable=False),
        sa.Column('status', sa.String(15), nullable=False, server_default='Available'),
        sa.Column('notes', sa.Text()),
        sa.Column('date_added', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint(
            "condition_type IN ('New','Used','Certified')",
            name='ck_vehicles_condition'
        ),
        sa.CheckConstraint(
            "status IN ('Available','Reserved','Sold')",
            name='ck_vehicles_status'
        ),
    )
    op.create_index('idx_vehicles_status', 'vehicles', ['status'])
    op.create_index('idx_vehicles_make_model', 'vehicles', ['make', 'model'])
    op.create_index('idx_vehicles_year', 'vehicles', ['year'])
    op.create_index('idx_vehicles_price', 'vehicles', ['price'])
    op.create_index('idx_vehicles_condition', 'vehicles', ['condition_type'])

    # ─── TABLE 3: customers ─────────────────────────────────────────────────
    op.create_table(
        'customers',
        sa.Column('customer_id', sa.Integer(), primary_key=True),
        sa.Column('full_name', sa.String(100), nullable=False),
        sa.Column('email', sa.String(150), unique=True),
        sa.Column('phone', sa.String(20), nullable=False),
        sa.Column('address', sa.Text()),
        sa.Column('id_type', sa.String(20)),
        sa.Column('id_number', sa.String(50)),
        sa.Column('notes', sa.Text()),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('idx_customers_phone', 'customers', ['phone'])
    op.create_index('idx_customers_email', 'customers', ['email'])
    op.create_index('idx_customers_fullname', 'customers', ['full_name'])

    # ─── TABLE 4: test_drives ───────────────────────────────────────────────
    op.create_table(
        'test_drives',
        sa.Column('test_drive_id', sa.Integer(), primary_key=True),
        sa.Column('customer_id', sa.Integer(), sa.ForeignKey('customers.customer_id', ondelete='CASCADE'), nullable=False),
        sa.Column('vehicle_id', sa.Integer(), sa.ForeignKey('vehicles.vehicle_id', ondelete='CASCADE'), nullable=False),
        sa.Column('assigned_to', sa.Integer(), sa.ForeignKey('users.user_id')),
        sa.Column('booking_date', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('scheduled_date', sa.Date(), nullable=False),
        sa.Column('status', sa.String(20), nullable=False, server_default='Scheduled'),
        sa.Column('notes', sa.Text()),
        sa.Column('lead_status', sa.String(20), nullable=False, server_default='New'),
        sa.CheckConstraint(
            "status IN ('Scheduled','Completed','Cancelled','No-Show')",
            name='ck_td_status'
        ),
        sa.CheckConstraint(
            "lead_status IN ('New','Interested','Hot','Converted','Lost')",
            name='ck_td_lead'
        ),
    )
    op.create_index('idx_td_customer', 'test_drives', ['customer_id'])
    op.create_index('idx_td_vehicle', 'test_drives', ['vehicle_id'])
    op.create_index('idx_td_assigned', 'test_drives', ['assigned_to'])
    op.create_index('idx_td_status', 'test_drives', ['status'])
    op.create_index('idx_td_lead', 'test_drives', ['lead_status'])
    op.create_index('idx_td_scheduled', 'test_drives', ['scheduled_date'])
    op.create_index('idx_td_staff_date', 'test_drives', ['assigned_to', 'scheduled_date'])

    # ─── TABLE 5: sales ─────────────────────────────────────────────────────
    op.create_table(
        'sales',
        sa.Column('sale_id', sa.Integer(), primary_key=True),
        sa.Column('vehicle_id', sa.Integer(), sa.ForeignKey('vehicles.vehicle_id', ondelete='RESTRICT'), nullable=False),
        sa.Column('customer_id', sa.Integer(), sa.ForeignKey('customers.customer_id', ondelete='RESTRICT'), nullable=False),
        sa.Column('staff_id', sa.Integer(), sa.ForeignKey('users.user_id'), nullable=False),
        sa.Column('sale_date', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('sale_price', sa.Numeric(12, 2), nullable=False),
        sa.Column('discount', sa.Numeric(10, 2), nullable=False, server_default='0'),
        sa.Column('payment_type', sa.String(30), nullable=False, server_default='Cash'),
        sa.Column('status', sa.String(20), nullable=False, server_default='Pending'),
        sa.Column('notes', sa.Text()),
        sa.CheckConstraint(
            "payment_type IN ('Cash','Finance','Lease')",
            name='ck_sales_payment'
        ),
        sa.CheckConstraint(
            "status IN ('Pending','Completed','Cancelled')",
            name='ck_sales_status'
        ),
    )
    op.create_index('idx_sales_vehicle', 'sales', ['vehicle_id'])
    op.create_index('idx_sales_customer', 'sales', ['customer_id'])
    op.create_index('idx_sales_staff', 'sales', ['staff_id'])
    op.create_index('idx_sales_status', 'sales', ['status'])
    op.create_index('idx_sales_date', 'sales', ['sale_date'])
    op.create_index('idx_sales_staff_date', 'sales', ['staff_id', 'sale_date'])

    # ─── TABLE 6: service_jobs ──────────────────────────────────────────────
    op.create_table(
        'service_jobs',
        sa.Column('job_id', sa.Integer(), primary_key=True),
        sa.Column('vehicle_id', sa.Integer(), sa.ForeignKey('vehicles.vehicle_id', ondelete='RESTRICT'), nullable=False),
        sa.Column('customer_id', sa.Integer(), sa.ForeignKey('customers.customer_id', ondelete='RESTRICT'), nullable=False),
        sa.Column('technician_id', sa.Integer(), sa.ForeignKey('users.user_id')),
        sa.Column('job_type', sa.String(50), nullable=False),
        sa.Column('description', sa.Text()),
        sa.Column('status', sa.String(20), nullable=False, server_default='Pending'),
        sa.Column('job_date', sa.Date(), nullable=False, server_default=sa.func.current_date()),
        sa.Column('estimated_cost', sa.Numeric(10, 2)),
        sa.Column('final_cost', sa.Numeric(10, 2)),
        sa.Column('notes', sa.Text()),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint(
            "status IN ('Pending','In Progress','Completed','Cancelled')",
            name='ck_sj_status'
        ),
    )
    op.create_index('idx_sj_vehicle', 'service_jobs', ['vehicle_id'])
    op.create_index('idx_sj_customer', 'service_jobs', ['customer_id'])
    op.create_index('idx_sj_technician', 'service_jobs', ['technician_id'])
    op.create_index('idx_sj_status', 'service_jobs', ['status'])
    op.create_index('idx_sj_date', 'service_jobs', ['job_date'])
    op.create_index('idx_sj_tech_date', 'service_jobs', ['technician_id', 'job_date'])

    # ─── TABLE 7: service_parts ─────────────────────────────────────────────
    op.create_table(
        'service_parts',
        sa.Column('part_id', sa.Integer(), primary_key=True),
        sa.Column('job_id', sa.Integer(), sa.ForeignKey('service_jobs.job_id', ondelete='CASCADE'), nullable=False),
        sa.Column('part_name', sa.String(100), nullable=False),
        sa.Column('part_number', sa.String(50)),
        sa.Column('quantity', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('unit_cost', sa.Numeric(10, 2), nullable=False),
        sa.Column('total_cost', sa.Numeric(10, 2)),  # computed on application side
    )
    op.create_index('idx_parts_job', 'service_parts', ['job_id'])

    # ─── TABLE 8: commissions ───────────────────────────────────────────────
    op.create_table(
        'commissions',
        sa.Column('commission_id', sa.Integer(), primary_key=True),
        sa.Column('staff_id', sa.Integer(), sa.ForeignKey('users.user_id', ondelete='CASCADE'), nullable=False),
        sa.Column('sale_id', sa.Integer(), sa.ForeignKey('sales.sale_id', ondelete='CASCADE'), nullable=False, unique=True),
        sa.Column('rate_percent', sa.Numeric(5, 2), nullable=False, server_default='2.50'),
        sa.Column('commission_amt', sa.Numeric(10, 2), nullable=False),
        sa.Column('status', sa.String(20), nullable=False, server_default='Pending'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('paid_at', sa.DateTime()),
        sa.CheckConstraint(
            "status IN ('Pending','Approved','Paid')",
            name='ck_comm_status'
        ),
    )
    op.create_index('idx_comm_staff', 'commissions', ['staff_id'])
    op.create_index('idx_comm_sale', 'commissions', ['sale_id'])
    op.create_index('idx_comm_status', 'commissions', ['status'])
    op.create_index('idx_comm_staff_status', 'commissions', ['staff_id', 'status'])


def downgrade() -> None:
    op.drop_table('commissions')
    op.drop_table('service_parts')
    op.drop_table('service_jobs')
    op.drop_table('sales')
    op.drop_table('test_drives')
    op.drop_table('customers')
    op.drop_table('vehicles')
    op.drop_table('users')
