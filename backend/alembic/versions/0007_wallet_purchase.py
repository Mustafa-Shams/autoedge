"""Record self-service sales and link wallet payment receipts."""
from database import purchase_schema_0006 as purchase

revision = "0007_wallet_purchase"
down_revision = "0006_units_and_deals"
branch_labels = None
depends_on = None


def upgrade():
    if not purchase.bundled():
        purchase.add_wallet()


def downgrade():
    if not purchase.bundled():
        purchase.remove_wallet()
