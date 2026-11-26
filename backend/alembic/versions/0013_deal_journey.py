"""Extend the existing deal identity to vehicle-specific showroom activity."""
from alembic import op
import sqlalchemy as sa

revision = "0013_deal_journey"
down_revision = "0012_email_render"
branch_labels = None
depends_on = None

tables = ("enquiries", "test_drives", "trade_in_requests", "sales_assistance")
previous = """(stage = 'Refunded' AND sale_id IS NOT NULL AND unit_id IS NULL AND refund_approved_by IS NOT NULL)
 OR (stage IN ('Cancelled','Expired') AND unit_id IS NULL AND reservation_id IS NOT NULL)
 OR (stage='Reserved' AND unit_id IS NOT NULL AND reservation_id IS NOT NULL AND sale_id IS NULL)
 OR (stage IN ('Historical sale','Awaiting pickup','Collected') AND unit_id IS NOT NULL AND sale_id IS NOT NULL)"""


def upgrade():
    op.drop_constraint("ck_deal_stage", "deals")
    op.create_check_constraint("ck_deal_stage", "deals", previous + """ OR
        (stage IN ('Shopping','Earlier activity') AND unit_id IS NULL AND sale_id IS NULL AND reservation_id IS NULL)""")
    op.create_index("uq_shopping_pair", "deals", ["customer_id","vehicle_id"], unique=True,
                    postgresql_where=sa.text("stage='Shopping'"))
    for table in tables:
        op.add_column(table, sa.Column("deal_id", sa.Integer, sa.ForeignKey("deals.deal_id", ondelete="SET NULL")))
        op.create_index(f"ix_{table}_deal_id", table, ["deal_id"])
    for table in ("enquiries","sales_assistance"):
        op.execute(f"UPDATE {table} x SET deal_id=d.deal_id FROM deals d WHERE x.sale_id=d.sale_id")
    op.execute("""UPDATE trade_in_requests t SET deal_id=d.deal_id FROM deals d JOIN sales s USING (sale_id)
        WHERE t.trade_in_id=s.trade_in_id""")
    for table, key in (("enquiries","enquiry_id"),("test_drives","test_drive_id")):
        op.execute(f"""UPDATE {table} x SET deal_id=a.deal_id FROM sales_assistance a
            WHERE x.{key}=a.{key} AND a.deal_id IS NOT NULL""")
    # Keep ambiguous historical activity available without crediting it to a past buyer transaction.
    for table in tables:
        vehicle = "target_vehicle_id" if table == "trade_in_requests" else "vehicle_id"
        op.execute(f"""UPDATE {table} x SET deal_id=d.deal_id FROM deals d WHERE x.deal_id IS NULL
            AND d.customer_id=x.customer_id AND d.vehicle_id=x.{vehicle} AND d.stage='Reserved'
            AND (SELECT count(*) FROM deals h WHERE h.customer_id=x.customer_id AND h.vehicle_id=x.{vehicle})=1""")
        op.execute(f"""INSERT INTO deals(customer_id,vehicle_id,stage)
            SELECT DISTINCT x.customer_id,x.{vehicle},CASE WHEN EXISTS (SELECT FROM deals d WHERE
                d.customer_id=x.customer_id AND d.vehicle_id=x.{vehicle}) THEN 'Earlier activity' ELSE 'Shopping' END
            FROM {table} x WHERE x.{vehicle} IS NOT NULL AND x.deal_id IS NULL AND NOT EXISTS
            (SELECT FROM deals d WHERE d.customer_id=x.customer_id AND d.vehicle_id=x.{vehicle}
                AND d.stage IN ('Earlier activity','Shopping'))""")
        op.execute(f"""UPDATE {table} x SET deal_id=d.deal_id FROM deals d WHERE x.deal_id IS NULL
            AND d.customer_id=x.customer_id AND d.vehicle_id=x.{vehicle} AND d.stage IN ('Shopping','Earlier activity')""")


def downgrade():
    for table in tables:
        op.drop_column(table,"deal_id")
    op.execute("DELETE FROM deals WHERE stage IN ('Earlier activity','Shopping')")
    op.drop_index("uq_shopping_pair",table_name="deals")
    op.drop_constraint("ck_deal_stage","deals")
    op.create_check_constraint("ck_deal_stage","deals",previous)
