"""Link conversations to receipts and record showroom payment evidence."""
from database import purchase_schema_0006 as purchase

revision = "0008_showroom_receipts"
down_revision = "0007_wallet_purchase"
branch_labels = None
depends_on = None


def upgrade():
    if not purchase.bundled():
        purchase.add_receipts()


def downgrade():
    if not purchase.bundled():
        purchase.remove_receipts()
