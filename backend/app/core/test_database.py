"""Resolve an explicit local PostgreSQL target without loading application settings."""
import os
import re
from urllib.parse import unquote

from sqlalchemy.engine import make_url
from sqlalchemy.exc import ArgumentError


def test_database_url():
    value = os.environ.get("TEST_DATABASE_URL", "")
    if not value:
        raise ValueError("Tests require an explicit TEST_DATABASE_URL")
    try:
        url = make_url(value)
    except (ValueError, ArgumentError):
        raise ValueError("Invalid TEST_DATABASE_URL") from None
    if (url.drivername not in {"postgresql", "postgresql+psycopg2"}
            or url.host not in {"localhost", "127.0.0.1"}
            or not re.fullmatch(r"[A-Za-z0-9_.-]+", url.database or "")
            or any(marker in unquote(value).lower() for marker in ("neon.tech", "railway", "supabase"))
            or set(url.query) - {"sslmode", "connect_timeout"}
            or any(os.getenv(key) for key in ("PGSERVICE", "PGHOSTADDR"))):
        raise ValueError("TEST_DATABASE_URL must select local PostgreSQL on localhost or 127.0.0.1 without routing overrides")
    return url.set(host="127.0.0.1")
