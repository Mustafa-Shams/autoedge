"""Read-only checks that a database upgraded to the redesign head is consistent.

Usage (PowerShell): $env:DB_CHECK_URL = "<connection string>"; python scripts/post_migration_check.py
The connection string is never printed. Exit code 0 when every check passes, 1 otherwise.
"""
import os
import sys

import psycopg2

EXPECTED_HEAD = "0016_enquiry_category"
CHECKS = [
    ("Alembic is at the redesign head",
     f"SELECT version_num <> '{EXPECTED_HEAD}' FROM alembic_version"),
    ("Every reservation has a deal",
     "SELECT count(*) FROM reservations r LEFT JOIN deals d USING (reservation_id) WHERE d.deal_id IS NULL"),
    ("Every completed sale has a deal",
     "SELECT count(*) FROM sales s LEFT JOIN deals d USING (sale_id) WHERE s.status='Completed' AND d.deal_id IS NULL"),
    ("Every active reservation holds one unit",
     "SELECT count(*) FROM reservations r JOIN deals d USING (reservation_id) "
     "WHERE r.status='Active' AND (d.stage <> 'Reserved' OR d.unit_id IS NULL)"),
    ("Free units match listing stock",
     "SELECT count(*) FROM vehicles v WHERE v.stock_quantity <> (SELECT count(*) FROM inventory_units u "
     "LEFT JOIN deals d ON d.unit_id=u.unit_id WHERE u.vehicle_id=v.vehicle_id AND d.deal_id IS NULL)"),
    ("Both vehicle triggers exist",
     "SELECT 2 - count(*) FROM pg_trigger WHERE NOT tgisinternal "
     "AND tgname IN ('trg_vehicle_status_sync','stock_units_on_insert')"),
    ("Both catalogue views exist",
     "SELECT 2 - count(*) FROM pg_views WHERE schemaname='public' "
     "AND viewname IN ('v_vehicle_catalog','v_restock_priority')"),
]


def main():
    dsn = os.environ.get("DB_CHECK_URL")
    if not dsn:
        sys.exit("Set DB_CHECK_URL to the database to check")
    try:
        conn = psycopg2.connect(dsn)
    except psycopg2.Error as exc:
        sys.exit(f"Connection failed ({exc.pgcode or 'connection error'})")
    failed = 0
    try:
        conn.set_session(readonly=True, isolation_level="REPEATABLE READ")
        with conn, conn.cursor() as cur:
            for label, query in CHECKS:
                cur.execute(query)
                problems = cur.fetchone()[0]
                bad = bool(problems) if isinstance(problems, bool) else problems > 0
                failed += bad
                print(f"{'FAIL' if bad else 'ok  '}  {label}" + (f" ({problems})" if bad and not isinstance(problems, bool) else ""))
    finally:
        conn.close()
    print("All checks passed." if not failed else f"{failed} check(s) failed.")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
