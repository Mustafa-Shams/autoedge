"""Support enquiry categories and the portal's General technician specialty."""
from alembic import op
import sqlalchemy as sa
from database import purchase_schema_0006 as purchase

revision = "0016_enquiry_category"
down_revision = "0015_deal_activity"
branch_labels = None
depends_on = None


def specialty_check(allow_general):
    # The previous constraint has different names in Alembic and the SQL installer.
    op.execute("ALTER TABLE technician_profiles DROP CONSTRAINT IF EXISTS ck_tp_specialty")
    op.execute("ALTER TABLE technician_profiles DROP CONSTRAINT IF EXISTS technician_profiles_specialty_check")
    values = "'Mechanic','Electrician','AC Specialist','Body & Paint','Tyre & Alignment'"
    if allow_general:
        values += ",'General'"
        op.create_check_constraint("ck_tp_specialty", "technician_profiles", f"specialty IN ({values})")
        return
    # Downgrade keeps technicians created with General: the 0015 rule applies to new and changed rows,
    # and is validated in full only when no such technician remains.
    op.execute("ALTER TABLE technician_profiles ADD CONSTRAINT ck_tp_specialty "
               f"CHECK (specialty IN ({values})) NOT VALID")
    if not op.get_bind().scalar(sa.text("SELECT EXISTS (SELECT FROM technician_profiles WHERE specialty='General')")):
        op.execute("ALTER TABLE technician_profiles VALIDATE CONSTRAINT ck_tp_specialty")


def upgrade():
    specialty_check(True)
    purchase.base_column("enquiries", sa.Column("category", sa.Text), "TEXT")


def downgrade():
    specialty_check(False)
    if not purchase.bundled():
        op.execute("LOCK TABLE enquiries IN ACCESS EXCLUSIVE MODE")
        if op.get_bind().scalar(sa.text("SELECT EXISTS (SELECT FROM enquiries WHERE category IS NOT NULL)")):
            raise RuntimeError("Downgrade would discard enquiry categories")
        op.drop_column("enquiries", "category")
