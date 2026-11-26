"""Refuse unsafe targets before collection. Only a newly created child DB is reset."""
import subprocess
import sys
from pathlib import Path
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, text

from app.core.test_database import test_database_url


def pytest_configure(config):
    try:
        source = test_database_url()
    except ValueError as exc:
        raise pytest.UsageError(str(exc)) from None
    if "app.core.config" in sys.modules or "app.db.session" in sys.modules:
        raise pytest.UsageError("Application settings loaded before database isolation; start pytest in a fresh process")
    environment = pytest.MonkeyPatch()
    config.add_cleanup(environment.undo)
    environment.setenv("AUTOEDGE_TESTING", "1")
    environment.delenv("DATABASE_URL", raising=False)
    name = "autoedge_test_" + uuid4().hex
    global _session_child_name
    _session_child_name = name
    environment.setenv("TEST_DATABASE_URL", source.set(database=name).render_as_string(hide_password=False))
    if config.option.collectonly:
        return
    admin = create_engine(source, isolation_level="AUTOCOMMIT")
    config.add_cleanup(admin.dispose)
    with admin.connect() as conn:
        conn.exec_driver_sql(f"CREATE DATABASE {name} TEMPLATE template0")

    def remove_child():
        from app.db.session import engine
        engine.dispose()
        with admin.connect() as conn:
            conn.exec_driver_sql(f"DROP DATABASE {name} WITH (FORCE)")

    config.add_cleanup(remove_child)
    subprocess.run([sys.executable, "-m", "alembic", "upgrade", "head"], check=True,
                   cwd=Path(__file__).resolve().parents[1])


def reset_child():
    from app.db.session import engine
    import app.models  # Register all tables even for a guard-only test selection.
    from app.db.base import Base
    if engine.url != test_database_url() or engine.url.database != _session_child_name:
        raise RuntimeError("Refusing to connect to an engine outside this pytest session")
    # Confirm the responding database before issuing TRUNCATE.
    with engine.begin() as conn:
        if conn.scalar(text("SELECT current_database()")) != _session_child_name:
            raise RuntimeError("Refusing to reset a database outside this pytest session")
        tables = ", ".join('public."' + name + '"' for name in Base.metadata.tables)
        conn.exec_driver_sql(f"TRUNCATE {tables} RESTART IDENTITY")


@pytest.fixture(scope="module", autouse=True)
def clean_module_database():
    reset_child()


@pytest.fixture
def clean_database():
    reset_child()
