"""Store staff access, technician profiles, customer status, and skipped email delivery."""

from alembic import op
import sqlalchemy as sa

revision = "0005_staff_portal"
down_revision = "0004_store_triggers_views"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("customers", sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()))
    op.execute("""
        UPDATE customers SET is_active = FALSE
        WHERE EXISTS (
            SELECT 1 FROM customer_accounts
            WHERE customer_accounts.customer_id = customers.customer_id AND NOT customer_accounts.is_active
        )
    """)

    op.add_column("users", sa.Column("phone", sa.String(20)))
    op.add_column("users", sa.Column("last_login_at", sa.DateTime()))
    op.add_column("users", sa.Column("module_access", sa.JSON(), nullable=False, server_default=sa.text("'{}'")))
    op.add_column("users", sa.Column("must_change_password", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("users", sa.Column("auth_version", sa.Integer(), nullable=False, server_default="0"))

    op.add_column("technician_profiles", sa.Column("certifications", sa.Text()))
    op.add_column("technician_profiles", sa.Column("skills", sa.Text()))
    op.add_column("technician_profiles", sa.Column("working_days", sa.String(50)))
    op.add_column("technician_profiles", sa.Column("working_hours", sa.String(30)))
    op.add_column("technician_profiles", sa.Column("hourly_rate", sa.Numeric(10, 2)))

    op.execute("ALTER TABLE email_outbox DROP CONSTRAINT IF EXISTS ck_eo_status")
    op.execute("ALTER TABLE email_outbox DROP CONSTRAINT IF EXISTS email_outbox_status_check")
    op.create_check_constraint(
        "ck_eo_status", "email_outbox", "status IN ('Queued','Sent','Failed','Suppressed','Skipped')",
    )
    op.execute("""
        UPDATE email_outbox SET status = 'Skipped', error_message = 'Email provider not configured'
        WHERE status = 'Failed' AND (
            error_message IN ('EMAIL_API_KEY not configured', 'EMAIL_FROM_ADDRESS not configured')
            OR error_message LIKE 'Unknown email provider:%'
        )
    """)

    op.create_index(
        "idx_res_vehicle_active_expiry", "reservations", ["vehicle_id", "expires_at"],
        postgresql_where=sa.text("status = 'Active'"),
    )
    # Re-run the existing stock trigger for legacy manual status edits and converted holds.
    op.execute("""
        UPDATE vehicles v SET stock_quantity = v.stock_quantity
        WHERE v.status IS DISTINCT FROM CASE
            WHEN v.stock_quantity > 0 THEN 'Available'
            WHEN EXISTS (SELECT 1 FROM reservations r
                         WHERE r.vehicle_id = v.vehicle_id AND r.status = 'Active') THEN 'Reserved'
            ELSE 'Sold' END
    """)


def downgrade() -> None:
    op.drop_index("idx_res_vehicle_active_expiry", table_name="reservations")
    op.execute("UPDATE email_outbox SET status = 'Suppressed' WHERE status = 'Skipped'")
    op.drop_constraint("ck_eo_status", "email_outbox", type_="check")
    op.create_check_constraint(
        "ck_eo_status", "email_outbox", "status IN ('Queued','Sent','Failed','Suppressed')",
    )

    for column in ("hourly_rate", "working_hours", "working_days", "skills", "certifications"):
        op.drop_column("technician_profiles", column)
    for column in ("auth_version", "must_change_password", "module_access", "last_login_at", "phone"):
        op.drop_column("users", column)
    op.drop_column("customers", "is_active")
