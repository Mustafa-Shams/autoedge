"""Track inspection, versioned consent, physical custody and resale."""
from database import purchase_schema_0006 as purchase

revision = "0010_trade_acquisitions"
down_revision = "0009_sales_assistance"
branch_labels = None
depends_on = None


def upgrade():
    if not purchase.bundled():
        purchase.add_acquisitions()


def downgrade():
    if not purchase.bundled():
        purchase.remove_acquisitions()
