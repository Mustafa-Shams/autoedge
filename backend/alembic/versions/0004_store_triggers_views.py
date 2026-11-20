"""store_triggers_views — trigger and views for storefront

Revision ID: 0004_store_triggers_views
Revises: 0003_store_alterations
Create Date: 2026-11-08

"""
from alembic import op

revision = '0004_store_triggers_views'
down_revision = '0003_store_alterations'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Trigger: sync vehicle status based on stock_quantity ──────────────
    op.execute("""
        CREATE OR REPLACE FUNCTION fn_sync_vehicle_status()
        RETURNS TRIGGER AS $$
        BEGIN
            IF NEW.stock_quantity > 0 THEN
                NEW.status := 'Available';
            ELSIF EXISTS (
                SELECT 1 FROM reservations
                WHERE vehicle_id = NEW.vehicle_id AND status = 'Active'
            ) THEN
                NEW.status := 'Reserved';
            ELSE
                NEW.status := 'Sold';
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    op.execute("""
        CREATE TRIGGER trg_vehicle_status_sync
        BEFORE UPDATE OF stock_quantity ON vehicles
        FOR EACH ROW EXECUTE FUNCTION fn_sync_vehicle_status();
    """)

    # ── View: public vehicle catalog ─────────────────────────────────────
    op.execute("""
        CREATE OR REPLACE VIEW v_vehicle_catalog AS
        SELECT v.vehicle_id, v.make, v.model, v.year, v.color, v.fuel_type,
               v.transmission, v.body_type, v.condition_type, v.mileage_km,
               v.price, v.stock_quantity, v.main_image_url, v.description,
               v.engine, v.horsepower, v.seats, v.drivetrain,
               COALESCE(rv.avg_rating, 0)::NUMERIC(3,2) AS avg_rating,
               COALESCE(rv.review_count, 0)             AS review_count,
               COALESCE(rq.open_requests, 0)            AS open_restock_requests
        FROM vehicles v
        LEFT JOIN (SELECT vehicle_id, AVG(rating) AS avg_rating, COUNT(*) AS review_count
                   FROM reviews WHERE is_visible = TRUE GROUP BY vehicle_id) rv
            ON rv.vehicle_id = v.vehicle_id
        LEFT JOIN (SELECT vehicle_id, COUNT(*) AS open_requests
                   FROM restock_requests WHERE status = 'Open' GROUP BY vehicle_id) rq
            ON rq.vehicle_id = v.vehicle_id
        WHERE v.is_published = TRUE;
    """)

    # ── View: restock priority ───────────────────────────────────────────
    op.execute("""
        CREATE OR REPLACE VIEW v_restock_priority AS
        SELECT v.vehicle_id, v.make, v.model, v.year, v.price,
               COUNT(rr.request_id) AS open_requests,
               MIN(rr.created_at)   AS oldest_request_at
        FROM vehicles v
        JOIN restock_requests rr ON rr.vehicle_id = v.vehicle_id AND rr.status = 'Open'
        WHERE v.stock_quantity = 0
        GROUP BY v.vehicle_id, v.make, v.model, v.year, v.price
        ORDER BY open_requests DESC, oldest_request_at ASC;
    """)


def downgrade() -> None:
    op.execute("DROP VIEW IF EXISTS v_restock_priority")
    op.execute("DROP VIEW IF EXISTS v_vehicle_catalog")
    op.execute("DROP TRIGGER IF EXISTS trg_vehicle_status_sync ON vehicles")
    op.execute("DROP FUNCTION IF EXISTS fn_sync_vehicle_status()")
