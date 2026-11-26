"""Keep dated changes to appointments, offers and inspection terms."""
from alembic import op
import sqlalchemy as sa

revision = "0015_deal_activity"
down_revision = "0014_intake_units"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("deal_activity", sa.Column("activity_id", sa.Integer, primary_key=True),
        sa.Column("trade_in_id", sa.Integer, sa.ForeignKey("trade_in_requests.trade_in_id", ondelete="CASCADE")),
        sa.Column("test_drive_id", sa.Integer, sa.ForeignKey("test_drives.test_drive_id", ondelete="CASCADE")),
        sa.Column("at", sa.DateTime, nullable=False), sa.Column("title", sa.String(180), nullable=False))
    for name in ("trade_in_id", "test_drive_id"):
        op.create_index("ix_deal_activity_" + name, "deal_activity", [name])


def downgrade():
    op.drop_table("deal_activity")
