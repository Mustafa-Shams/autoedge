"""Preserve the pre-payment owner and evidence for an assisted sale."""
from database import purchase_schema_0006 as purchase

revision = "0009_sales_assistance"
down_revision = "0008_showroom_receipts"
branch_labels = None
depends_on = None


def upgrade():
    if not purchase.bundled():
        purchase.add_assistance()


def downgrade():
    if not purchase.bundled():
        purchase.remove_assistance()
