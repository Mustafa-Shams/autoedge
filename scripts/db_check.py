"""Print a consistent PostgreSQL catalog and row-count snapshot as JSON."""
import argparse
import json
import sys

import psycopg2
from psycopg2 import sql


def inspect_database(dsn):
    conn = psycopg2.connect(dsn)
    try:
        conn.set_session(readonly=True, isolation_level="REPEATABLE READ")
        with conn, conn.cursor() as cursor:
            cursor.execute("SET LOCAL row_security = off")  # Fail if a policy would hide rows.
            cursor.execute("SHOW transaction_read_only")
            if cursor.fetchone() != ("on",):
                raise RuntimeError("Expected a read-only transaction")
            cursor.execute("""
                SELECT n.nspname, c.relname, c.relkind
                FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
                WHERE n.nspname <> 'information_schema' AND n.nspname !~ '^pg_'
                  AND c.relkind IN ('r','p','v','m') ORDER BY 1,2
            """)
            tables, views, versions = [], [], {}
            for schema, name, kind in cursor.fetchall():
                if kind in ("v", "m"):
                    views.append({"schema": schema, "name": name, "materialized": kind == "m"})
                    continue
                relation = sql.Identifier(schema, name)
                cursor.execute(sql.SQL("SELECT count(*) FROM {}").format(relation))
                tables.append({"schema": schema, "name": name, "rows": cursor.fetchone()[0]})
                if name == "alembic_version":
                    cursor.execute(sql.SQL("SELECT version_num FROM {} ORDER BY version_num").format(relation))
                    versions[schema] = [row[0] for row in cursor.fetchall()]
            cursor.execute("""
                SELECT n.nspname, c.relname, t.tgname FROM pg_trigger t
                JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
                WHERE NOT t.tgisinternal AND n.nspname <> 'information_schema' AND n.nspname !~ '^pg_'
                ORDER BY 1,2,3
            """)
            triggers = [dict(schema=s, table=t, name=n) for s,t,n in cursor.fetchall()]
            return {"transaction_read_only": True, "alembic_version": versions, "tables": tables,
                    "views": views, "triggers": triggers}
    finally:
        conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("connection_string", help="PostgreSQL URI or libpq connection string")
    try:
        print(json.dumps(inspect_database(parser.parse_args().connection_string), indent=2))
    except psycopg2.Error as exc:
        # Connection diagnostics can include supplied credentials or DSN fragments.
        sys.exit(f"PostgreSQL inspection failed ({exc.pgcode or 'connection error'})")
