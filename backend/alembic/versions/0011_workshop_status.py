"""Keep active workshop appointments reserved while work is in progress."""
from alembic import op

revision = "0011_workshop_status"
down_revision = "0010_trade_acquisitions"
branch_labels = None
depends_on = None


def status_rules(active, statuses):
    op.drop_index("uq_sb_tech_slot", table_name="service_bookings")
    op.drop_constraint("ck_sb_status", "service_bookings", type_="check")
    op.create_check_constraint("ck_sb_status", "service_bookings", f"status IN ({statuses})")
    op.execute(f"""CREATE UNIQUE INDEX uq_sb_tech_slot ON service_bookings
        (technician_id, booking_date, time_slot)
        WHERE technician_id IS NOT NULL AND status IN ({active})""")


def upgrade():
    status_rules("'Booked','Confirmed','In Progress'", "'Booked','Confirmed','In Progress','Completed','Cancelled','No-Show'")
    op.execute("""UPDATE service_jobs j SET status='Cancelled' FROM service_bookings b
        WHERE b.service_job_id=j.job_id AND b.status='Cancelled' AND j.status IN ('Pending','In Progress')""")
    op.execute("""UPDATE service_bookings b SET status=j.status FROM service_jobs j
        WHERE b.service_job_id=j.job_id AND b.status='Confirmed' AND j.status IN ('In Progress','Completed')""")


def downgrade():
    op.execute("UPDATE service_bookings SET status='Confirmed' WHERE status='In Progress'")
    status_rules("'Booked','Confirmed'", "'Booked','Confirmed','Completed','Cancelled','No-Show'")
