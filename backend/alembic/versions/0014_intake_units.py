"""Create private stock units at intake and retain the identity through publication."""
from alembic import op
import sqlalchemy as sa

revision = "0014_intake_units"
down_revision = "0013_deal_journey"
branch_labels = None
depends_on = None


def upgrade():
    for col in (sa.Column("ownership_reference", sa.String(100)), sa.Column("odometer_km", sa.Integer),
                sa.Column("checked_at", sa.DateTime), sa.Column("checked_by", sa.Integer, sa.ForeignKey("users.user_id")),
                sa.Column("intake_version", sa.Integer)):
        op.add_column("trade_acquisitions", col)
    op.add_column("inventory_units", sa.Column("intake_trade_id", sa.Integer, sa.ForeignKey("trade_acquisitions.trade_in_id")))
    op.create_unique_constraint("uq_unit_intake_trade", "inventory_units", ["intake_trade_id"])
    op.alter_column("inventory_units", "vehicle_id", nullable=True)
    op.create_check_constraint("ck_unit_origin", "inventory_units", "vehicle_id IS NOT NULL OR intake_trade_id IS NOT NULL")
    op.execute("""UPDATE inventory_units u SET intake_trade_id=a.trade_in_id FROM trade_acquisitions a
                  WHERE u.vehicle_id=a.listing_id AND u.vin=a.vin""")
    op.execute("""INSERT INTO inventory_units(intake_trade_id) SELECT trade_in_id FROM trade_acquisitions
                  WHERE intake_at IS NOT NULL AND listing_id IS NULL""")


def downgrade():
    op.execute("""DO $$ BEGIN IF EXISTS (SELECT FROM trade_acquisitions WHERE checked_at IS NOT NULL)
                  THEN RAISE EXCEPTION 'Downgrade would discard verified ownership records'; END IF; END $$""")
    op.execute("DELETE FROM inventory_units WHERE vehicle_id IS NULL")
    op.drop_constraint("ck_unit_origin", "inventory_units")
    op.alter_column("inventory_units", "vehicle_id", nullable=False)
    op.drop_column("inventory_units", "intake_trade_id")
    for name in ("intake_version", "checked_by", "checked_at", "odometer_km", "ownership_reference"):
        op.drop_column("trade_acquisitions", name)
