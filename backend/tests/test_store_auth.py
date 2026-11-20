"""P32 Gate tests — Customer auth + token scopes.

Tests:
1. Register works and returns token + profile
2. Duplicate email → 409
3. Mismatched confirm_password → 422
4. Login with trimmed/cased email works
5. Customer token on GET /api/v1/users → 401
6. Staff token on GET /api/v1/store/me → 401
7. check-email returns availability correctly
8. Change password works
9. Profile GET/PUT works
"""
import os
import pytest
from fastapi.testclient import TestClient

# Use in-memory SQLite for tests
os.environ["DATABASE_URL"] = "sqlite:///./test.db"
os.environ["SECRET_KEY"] = "test-secret-key-for-testing-only"
os.environ["ALGORITHM"] = "HS256"
os.environ["ACCESS_TOKEN_EXPIRE_MINUTES"] = "60"
os.environ["CORS_ORIGINS"] = "http://localhost:5173"

from app.main import app  # noqa: E402
from app.db.session import engine
from app.db.base import Base

# Create all tables in SQLite for testing
Base.metadata.create_all(bind=engine)

client = TestClient(app)


class TestCustomerRegistration:
    """Test customer registration flow."""

    def test_register_success(self):
        """Register creates account and returns token + profile."""
        resp = client.post("/api/v1/store/auth/register", json={
            "full_name": "Test User",
            "email": "testuser@example.com",
            "phone": "+92-300-1234567",
            "password": "SecurePass1",
            "confirm_password": "SecurePass1",
        })
        assert resp.status_code == 201, f"Expected 201, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "access_token" in data
        assert data["role"] == "customer"
        assert data["customer"]["full_name"] == "Test User"
        assert data["customer"]["email"] == "testuser@example.com"

    def test_register_duplicate_email_409(self):
        """Registering the same email again → 409."""
        resp = client.post("/api/v1/store/auth/register", json={
            "full_name": "Another User",
            "email": "testuser@example.com",
            "phone": "+92-300-9999999",
            "password": "SecurePass1",
            "confirm_password": "SecurePass1",
        })
        assert resp.status_code == 409

    def test_register_duplicate_email_case_insensitive(self):
        """Email duplication check is case-insensitive."""
        resp = client.post("/api/v1/store/auth/register", json={
            "full_name": "Case Test",
            "email": "TestUser@Example.COM",
            "phone": "+92-300-8888888",
            "password": "SecurePass1",
            "confirm_password": "SecurePass1",
        })
        assert resp.status_code == 409

    def test_register_mismatched_passwords_422(self):
        """Mismatched confirm_password → 422."""
        resp = client.post("/api/v1/store/auth/register", json={
            "full_name": "Mismatch User",
            "email": "mismatch@example.com",
            "phone": "+92-300-7777777",
            "password": "SecurePass1",
            "confirm_password": "DifferentPass2",
        })
        assert resp.status_code == 422

    def test_register_weak_password_422(self):
        """Weak password (no digits) → 422."""
        resp = client.post("/api/v1/store/auth/register", json={
            "full_name": "Weak Pass User",
            "email": "weak@example.com",
            "phone": "+92-300-6666666",
            "password": "nodigits",
            "confirm_password": "nodigits",
        })
        assert resp.status_code == 422

    def test_register_short_password_422(self):
        """Short password → 422."""
        resp = client.post("/api/v1/store/auth/register", json={
            "full_name": "Short Pass User",
            "email": "short@example.com",
            "phone": "+92-300-5555555",
            "password": "Ab1",
            "confirm_password": "Ab1",
        })
        assert resp.status_code == 422


class TestCustomerLogin:
    """Test customer login flow."""

    def test_login_success(self):
        """Login with correct credentials returns token."""
        # Register first
        client.post("/api/v1/store/auth/register", json={
            "full_name": "Login Test",
            "email": "logintest@example.com",
            "phone": "+92-300-1111111",
            "password": "LoginPass1",
            "confirm_password": "LoginPass1",
        })
        # Login
        resp = client.post("/api/v1/store/auth/login", json={
            "email": "logintest@example.com",
            "password": "LoginPass1",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert data["role"] == "customer"

    def test_login_trimmed_email(self):
        """Login works with pasted trailing spaces (trimmed)."""
        resp = client.post("/api/v1/store/auth/login", json={
            "email": "  logintest@example.com  ",
            "password": "LoginPass1",
        })
        assert resp.status_code == 200

    def test_login_case_insensitive_email(self):
        """Login works with different email casing."""
        resp = client.post("/api/v1/store/auth/login", json={
            "email": "LoginTest@Example.COM",
            "password": "LoginPass1",
        })
        assert resp.status_code == 200

    def test_login_wrong_password_401(self):
        """Wrong password → 401 with generic error."""
        resp = client.post("/api/v1/store/auth/login", json={
            "email": "logintest@example.com",
            "password": "WrongPass123",
        })
        assert resp.status_code == 401
        assert resp.json()["detail"] == "Invalid email or password"

    def test_login_nonexistent_email_401(self):
        """Non-existent email → 401 (same generic error)."""
        resp = client.post("/api/v1/store/auth/login", json={
            "email": "nobody@example.com",
            "password": "SomePass123",
        })
        assert resp.status_code == 401


class TestTokenScopeIsolation:
    """Test that customer and staff tokens are properly isolated."""

    def _get_customer_token(self) -> str:
        """Register and get a customer token."""
        resp = client.post("/api/v1/store/auth/register", json={
            "full_name": "Scope Test",
            "email": "scopetest@example.com",
            "phone": "+92-300-2222222",
            "password": "ScopePass1",
            "confirm_password": "ScopePass1",
        })
        if resp.status_code == 409:
            # Already registered, login instead
            resp = client.post("/api/v1/store/auth/login", json={
                "email": "scopetest@example.com",
                "password": "ScopePass1",
            })
        return resp.json()["access_token"]

    def test_customer_token_on_staff_endpoint_401(self):
        """Customer token on GET /api/v1/users → 401."""
        token = self._get_customer_token()
        resp = client.get(
            "/api/v1/users/",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 401

    def test_customer_token_on_staff_vehicles_401(self):
        """Customer token on GET /api/v1/vehicles/ → 401."""
        token = self._get_customer_token()
        resp = client.get(
            "/api/v1/vehicles/",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 401

    def test_staff_token_on_store_me_401(self):
        """Staff token on GET /store/me → 401.

        We create a staff-scope token manually since we don't have a staff user
        in the SQLite test DB.
        """
        from app.core.security import create_access_token
        staff_token = create_access_token(
            data={"sub": "admin@autoedge.com"},
            scope="staff",
            role="manager",
        )
        resp = client.get(
            "/api/v1/store/me",
            headers={"Authorization": f"Bearer {staff_token}"},
        )
        assert resp.status_code == 401


class TestCheckEmail:
    """Test check-email endpoint."""

    def test_email_available(self):
        """Unregistered email → available: true."""
        resp = client.get("/api/v1/store/auth/check-email", params={"email": "fresh@example.com"})
        assert resp.status_code == 200
        assert resp.json()["available"] is True

    def test_email_taken(self):
        """Registered email → available: false."""
        # testuser@example.com was registered in TestCustomerRegistration
        resp = client.get("/api/v1/store/auth/check-email", params={"email": "testuser@example.com"})
        assert resp.status_code == 200
        assert resp.json()["available"] is False


class TestCustomerProfile:
    """Test customer profile endpoints."""

    def _get_token(self) -> str:
        resp = client.post("/api/v1/store/auth/login", json={
            "email": "testuser@example.com",
            "password": "SecurePass1",
        })
        return resp.json()["access_token"]

    def test_get_profile(self):
        """GET /store/me returns profile."""
        token = self._get_token()
        resp = client.get(
            "/api/v1/store/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["full_name"] == "Test User"

    def test_update_profile(self):
        """PUT /store/me updates allowed fields."""
        token = self._get_token()
        resp = client.put(
            "/api/v1/store/me",
            headers={"Authorization": f"Bearer {token}"},
            json={"full_name": "Updated Name", "phone": "+92-300-0000000"},
        )
        assert resp.status_code == 200
        assert resp.json()["full_name"] == "Updated Name"

    def test_change_password(self):
        """POST /store/me/change-password works."""
        token = self._get_token()
        resp = client.post(
            "/api/v1/store/me/change-password",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "current_password": "SecurePass1",
                "new_password": "NewSecure2",
                "confirm_password": "NewSecure2",
            },
        )
        assert resp.status_code == 200

        # Login with new password
        resp2 = client.post("/api/v1/store/auth/login", json={
            "email": "testuser@example.com",
            "password": "NewSecure2",
        })
        assert resp2.status_code == 200

    def test_change_password_wrong_current(self):
        """Wrong current password → 401."""
        # After test_change_password, the password is NewSecure2
        resp = client.post("/api/v1/store/auth/login", json={
            "email": "testuser@example.com",
            "password": "NewSecure2",
        })
        token = resp.json()["access_token"]
        resp = client.post(
            "/api/v1/store/me/change-password",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "current_password": "WrongCurrent1",
                "new_password": "AnotherPass3",
                "confirm_password": "AnotherPass3",
            },
        )
        assert resp.status_code == 401
