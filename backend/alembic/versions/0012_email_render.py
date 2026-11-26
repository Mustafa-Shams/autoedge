"""Persist notification template inputs for post-commit delivery."""
from alembic import op
import sqlalchemy as sa

revision = "0012_email_render"
down_revision = "0011_workshop_status"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("email_outbox", sa.Column("render_context", sa.JSON()))


def downgrade():
    op.drop_column("email_outbox", "render_context")
