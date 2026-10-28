"""Smoke tests for all AutoEdge API routes."""
import os
import pytest
from fastapi.testclient import TestClient

# Use in-memory SQLite for tests to avoid needing a real DB
os.environ["DATABASE_URL"] = "sqlite:///./test.db"
os.environ["SECRET_KEY"] = "test-secret-key-for-testing-only"
os.environ["ALGORITHM"] = "HS256"
os.environ["ACCESS_TOKEN_EXPIRE_MINUTES"] = "60"
os.environ["CORS_ORIGINS"] = "http://localhost:5173"

from app.main import app  # noqa: E402 — import after env vars set
from app.db.session import engine
from app.db.base import Base

# Create all tables in SQLite for testing
Base.metadata.create_all(bind=engine)

client = TestClient(app)


def test_root():
    """API root returns 200."""
    response = client.get("/")
    assert response.status_code == 200
    assert "AutoEdge" in response.json()["message"]


def test_health():
    """Health check returns ok."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_login_invalid_credentials():
    """Login with wrong creds returns 401."""
    response = client.post(
        "/api/v1/auth/login",
        data={"username": "wrong@email.com", "password": "wrongpass"},
    )
    assert response.status_code == 401


def test_protected_route_without_token():
    """Protected route without token returns 401."""
    response = client.get("/api/v1/vehicles/")
    assert response.status_code == 401


def test_protected_route_with_bad_token():
    """Protected route with invalid token returns 401."""
    response = client.get(
        "/api/v1/vehicles/",
        headers={"Authorization": "Bearer invalidtoken"},
    )
    assert response.status_code == 401


def test_docs_accessible():
    """Swagger docs are accessible."""
    response = client.get("/docs")
    assert response.status_code == 200


def test_redoc_accessible():
    """ReDoc is accessible."""
    response = client.get("/redoc")
    assert response.status_code == 200
