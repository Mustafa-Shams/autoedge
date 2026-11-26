import pytest

from app.core.test_database import test_database_url as resolve


def test_missing_test_url_ignores_database_url(monkeypatch):
    monkeypatch.delenv("TEST_DATABASE_URL", raising=False)
    monkeypatch.setenv("DATABASE_URL", "postgresql://localhost/production")
    with pytest.raises(ValueError, match="explicit TEST_DATABASE_URL"):
        resolve()


@pytest.mark.parametrize("url", [
    "postgresql://example.org/test", "postgresql://127.0.0.2/test",
    "postgresql://localhost/test?host=example.org", "postgresql://localhost/test?service=prod",
    "postgresql://localhost/test?hostaddr=8.8.8.8", "postgresql:///test", "sqlite://",
    "postgresql://localhost/NeOn.TeCh", "postgresql://localhost/Railway",
    "postgresql://localhost/supa%62ase",
])
def test_unsafe_url_is_rejected(monkeypatch, url):
    monkeypatch.setenv("TEST_DATABASE_URL", url)
    with pytest.raises(ValueError):
        resolve()


@pytest.mark.parametrize("host", ["localhost", "127.0.0.1"])
def test_loopback_is_allowed(monkeypatch, host):
    monkeypatch.setenv("TEST_DATABASE_URL", f"postgresql://{host}:55432/test")
    assert resolve().host == "127.0.0.1"


@pytest.mark.parametrize("variable", ["PGHOSTADDR", "PGSERVICE"])
def test_libpq_routing_override_is_rejected(monkeypatch, variable):
    monkeypatch.setenv("TEST_DATABASE_URL", "postgresql://localhost/test")
    monkeypatch.setenv(variable, "external")
    with pytest.raises(ValueError):
        resolve()


def test_collection_needs_no_database_listener():
    import os
    import subprocess
    import sys
    from pathlib import Path

    backend = Path(__file__).resolve().parents[1]
    env = dict(os.environ, TEST_DATABASE_URL="postgresql://127.0.0.1:1/collect_only",
               DATABASE_URL="postgresql://ignored.invalid/unused")
    command = [sys.executable, "-m", "pytest", "tests", "--collect-only", "-q", "-p", "no:cacheprovider"]
    # Collect the full suite to catch database access hidden at module scope.
    child = subprocess.run(command, env=env, cwd=backend, capture_output=True, text=True)
    assert child.returncode == 0, child.stdout + child.stderr
    preloaded = [sys.executable, "-c", "import sys, pytest; sys.modules['app.db.session'] = object(); "
                 "sys.exit(pytest.main(['--collect-only', '-q', 'tests']))"]
    blocked = subprocess.run(preloaded, env=env, cwd=backend, capture_output=True, text=True)
    assert blocked.returncode == 4 and "before database isolation" in blocked.stderr
    env.pop("TEST_DATABASE_URL")
    refused = subprocess.run(command, env=env, cwd=backend, capture_output=True, text=True)
    assert refused.returncode == 4 and "explicit TEST_DATABASE_URL" in refused.stderr
