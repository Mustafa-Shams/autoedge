"""Tests for vehicle image handling — Decision #23.

Covers:
- Bulk replace images (PUT /vehicles/{id}/images/bulk)
- GET /vehicles/{id} includes images in response
- Primary image uniqueness (main_image_url always set correctly)
- Sort ordering preserved
- Max 8 additional limit
- URL validation (reject non-http)
- Duplicate URL rejection
- Delete all images via empty bulk
- Single image add/delete still works
"""
import os
import pytest
from fastapi.testclient import TestClient

os.environ["SECRET_KEY"] = "test-secret-key-for-vehicle-images"
os.environ["ALGORITHM"] = "HS256"
os.environ["ACCESS_TOKEN_EXPIRE_MINUTES"] = "60"
os.environ["CORS_ORIGINS"] = "http://localhost:5173"

from app.main import app  # noqa: E402
from app.db.session import engine  # noqa: E402
from app.db.base import Base  # noqa: E402

client = TestClient(app)


def _staff_token():
    """Login as default staff user (admin@autoedge.com) or create one."""
    from app.db.session import SessionLocal
    from app.models.user import User
    from app.core.security import hash_password

    db = SessionLocal()
    user = db.query(User).filter(User.email == "imgtest@autoedge.com").first()
    if not user:
        user = User(
            full_name="Image Test Admin",
            email="imgtest@autoedge.com",
            password_hash=hash_password("TestPass123"),
            role="manager",
            is_active=True,
        )
        db.add(user)
        db.commit()
    db.close()

    resp = client.post("/api/v1/auth/login", data={
        "username": "imgtest@autoedge.com",
        "password": "TestPass123",
    })
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    return resp.json()["access_token"]


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _create_vehicle(token, make="TestMake", model="TestModel"):
    """Create a test vehicle and return its ID."""
    resp = client.post("/api/v1/vehicles/", json={
        "make": make,
        "model": model,
        "year": 2024,
        "price": 25000.00,
        "condition_type": "New",
        "main_image_url": "https://example.com/main.jpg",
    }, headers=_auth(token))
    assert resp.status_code == 201, f"Create vehicle failed: {resp.text}"
    return resp.json()["vehicle_id"]


class TestBulkReplaceImages:
    """PUT /vehicles/{id}/images/bulk"""

    def test_bulk_replace_sets_main_and_additional(self):
        token = _staff_token()
        vid = _create_vehicle(token, "BulkTest", "Model1")

        resp = client.put(f"/api/v1/vehicles/{vid}/images/bulk", json={
            "main_image_url": "https://example.com/front.jpg",
            "images": [
                {"image_url": "https://example.com/side.jpg", "sort_order": 1},
                {"image_url": "https://example.com/back.jpg", "sort_order": 2},
                {"image_url": "https://example.com/interior.jpg", "sort_order": 3},
            ],
        }, headers=_auth(token))
        assert resp.status_code == 200
        data = resp.json()
        assert data["main_image_url"] == "https://example.com/front.jpg"
        assert len(data["images"]) == 3
        # Check sort order preserved
        urls = [img["image_url"] for img in data["images"]]
        assert urls == [
            "https://example.com/side.jpg",
            "https://example.com/back.jpg",
            "https://example.com/interior.jpg",
        ]

    def test_bulk_replace_overwrites_previous_images(self):
        token = _staff_token()
        vid = _create_vehicle(token, "BulkTest", "Overwrite")

        # First set
        client.put(f"/api/v1/vehicles/{vid}/images/bulk", json={
            "main_image_url": "https://example.com/old-main.jpg",
            "images": [
                {"image_url": "https://example.com/old1.jpg", "sort_order": 1},
                {"image_url": "https://example.com/old2.jpg", "sort_order": 2},
            ],
        }, headers=_auth(token))

        # Replace with new set
        resp = client.put(f"/api/v1/vehicles/{vid}/images/bulk", json={
            "main_image_url": "https://example.com/new-main.jpg",
            "images": [
                {"image_url": "https://example.com/new1.jpg", "sort_order": 1},
            ],
        }, headers=_auth(token))
        assert resp.status_code == 200
        data = resp.json()
        assert data["main_image_url"] == "https://example.com/new-main.jpg"
        assert len(data["images"]) == 1
        assert data["images"][0]["image_url"] == "https://example.com/new1.jpg"

    def test_bulk_replace_clear_all_images(self):
        token = _staff_token()
        vid = _create_vehicle(token, "BulkTest", "ClearAll")

        # Add images first
        client.put(f"/api/v1/vehicles/{vid}/images/bulk", json={
            "main_image_url": "https://example.com/main.jpg",
            "images": [{"image_url": "https://example.com/extra.jpg", "sort_order": 1}],
        }, headers=_auth(token))

        # Clear all
        resp = client.put(f"/api/v1/vehicles/{vid}/images/bulk", json={
            "main_image_url": None,
            "images": [],
        }, headers=_auth(token))
        assert resp.status_code == 200
        data = resp.json()
        assert data["main_image_url"] is None
        assert len(data["images"]) == 0

    def test_bulk_replace_vehicle_not_found(self):
        token = _staff_token()
        resp = client.put("/api/v1/vehicles/99999/images/bulk", json={
            "main_image_url": None,
            "images": [],
        }, headers=_auth(token))
        assert resp.status_code == 404


class TestImageValidation:
    """Validation rules for bulk image replacement."""

    def test_reject_invalid_url(self):
        token = _staff_token()
        vid = _create_vehicle(token, "ValTest", "InvalidURL")
        resp = client.put(f"/api/v1/vehicles/{vid}/images/bulk", json={
            "main_image_url": "https://example.com/main.jpg",
            "images": [
                {"image_url": "not-a-url", "sort_order": 1},
            ],
        }, headers=_auth(token))
        assert resp.status_code == 422

    def test_reject_invalid_main_url(self):
        token = _staff_token()
        vid = _create_vehicle(token, "ValTest", "InvalidMain")
        resp = client.put(f"/api/v1/vehicles/{vid}/images/bulk", json={
            "main_image_url": "ftp://invalid.com/image.jpg",
            "images": [],
        }, headers=_auth(token))
        assert resp.status_code == 422

    def test_reject_more_than_8_images(self):
        token = _staff_token()
        vid = _create_vehicle(token, "ValTest", "TooMany")
        images = [{"image_url": f"https://example.com/img{i}.jpg", "sort_order": i}
                  for i in range(9)]
        resp = client.put(f"/api/v1/vehicles/{vid}/images/bulk", json={
            "main_image_url": "https://example.com/main.jpg",
            "images": images,
        }, headers=_auth(token))
        assert resp.status_code == 422

    def test_reject_duplicate_urls(self):
        token = _staff_token()
        vid = _create_vehicle(token, "ValTest", "Duplicates")
        resp = client.put(f"/api/v1/vehicles/{vid}/images/bulk", json={
            "main_image_url": "https://example.com/main.jpg",
            "images": [
                {"image_url": "https://example.com/same.jpg", "sort_order": 1},
                {"image_url": "https://example.com/same.jpg", "sort_order": 2},
            ],
        }, headers=_auth(token))
        assert resp.status_code == 422

    def test_accept_exactly_8_images(self):
        token = _staff_token()
        vid = _create_vehicle(token, "ValTest", "Exactly8")
        images = [{"image_url": f"https://example.com/img{i}.jpg", "sort_order": i}
                  for i in range(8)]
        resp = client.put(f"/api/v1/vehicles/{vid}/images/bulk", json={
            "main_image_url": "https://example.com/main.jpg",
            "images": images,
        }, headers=_auth(token))
        assert resp.status_code == 200
        assert len(resp.json()["images"]) == 8


class TestGetVehicleIncludesImages:
    """GET /vehicles/{id} should include images[] in the response."""

    def test_get_vehicle_returns_images(self):
        token = _staff_token()
        vid = _create_vehicle(token, "GetTest", "WithImages")

        # Add images via bulk
        client.put(f"/api/v1/vehicles/{vid}/images/bulk", json={
            "main_image_url": "https://example.com/main.jpg",
            "images": [
                {"image_url": "https://example.com/a.jpg", "sort_order": 1},
                {"image_url": "https://example.com/b.jpg", "sort_order": 2},
            ],
        }, headers=_auth(token))

        # GET should include images
        resp = client.get(f"/api/v1/vehicles/{vid}", headers=_auth(token))
        assert resp.status_code == 200
        data = resp.json()
        assert "images" in data
        assert len(data["images"]) == 2
        assert data["images"][0]["image_url"] == "https://example.com/a.jpg"
        assert data["images"][1]["image_url"] == "https://example.com/b.jpg"

    def test_get_vehicle_no_images(self):
        token = _staff_token()
        vid = _create_vehicle(token, "GetTest", "NoImages")
        resp = client.get(f"/api/v1/vehicles/{vid}", headers=_auth(token))
        assert resp.status_code == 200
        data = resp.json()
        assert "images" in data
        assert data["images"] == []


class TestSortOrder:
    """Sort order is preserved and returned correctly."""

    def test_sort_order_preserved(self):
        token = _staff_token()
        vid = _create_vehicle(token, "SortTest", "Order")

        resp = client.put(f"/api/v1/vehicles/{vid}/images/bulk", json={
            "main_image_url": "https://example.com/main.jpg",
            "images": [
                {"image_url": "https://example.com/third.jpg", "sort_order": 3},
                {"image_url": "https://example.com/first.jpg", "sort_order": 1},
                {"image_url": "https://example.com/second.jpg", "sort_order": 2},
            ],
        }, headers=_auth(token))
        assert resp.status_code == 200
        images = resp.json()["images"]
        # Should be returned sorted by sort_order (via model relationship order_by)
        sort_orders = [img["sort_order"] for img in images]
        assert sort_orders == sorted(sort_orders), f"Images not sorted: {sort_orders}"

    def test_reorder_via_bulk_replace(self):
        token = _staff_token()
        vid = _create_vehicle(token, "SortTest", "Reorder")

        # Initial order
        client.put(f"/api/v1/vehicles/{vid}/images/bulk", json={
            "main_image_url": "https://example.com/main.jpg",
            "images": [
                {"image_url": "https://example.com/a.jpg", "sort_order": 1},
                {"image_url": "https://example.com/b.jpg", "sort_order": 2},
                {"image_url": "https://example.com/c.jpg", "sort_order": 3},
            ],
        }, headers=_auth(token))

        # Swap order
        resp = client.put(f"/api/v1/vehicles/{vid}/images/bulk", json={
            "main_image_url": "https://example.com/main.jpg",
            "images": [
                {"image_url": "https://example.com/c.jpg", "sort_order": 1},
                {"image_url": "https://example.com/a.jpg", "sort_order": 2},
                {"image_url": "https://example.com/b.jpg", "sort_order": 3},
            ],
        }, headers=_auth(token))
        assert resp.status_code == 200
        urls = [img["image_url"] for img in resp.json()["images"]]
        assert urls[0] == "https://example.com/c.jpg"
        assert urls[1] == "https://example.com/a.jpg"
        assert urls[2] == "https://example.com/b.jpg"


class TestSingleImageEndpoints:
    """Legacy single image add/delete still works alongside bulk."""

    def test_add_single_image(self):
        token = _staff_token()
        vid = _create_vehicle(token, "SingleTest", "Add")
        resp = client.post(f"/api/v1/vehicles/{vid}/images", json={
            "image_url": "https://example.com/single.jpg",
            "sort_order": 1,
        }, headers=_auth(token))
        assert resp.status_code == 201
        assert resp.json()["image_url"] == "https://example.com/single.jpg"

    def test_delete_single_image(self):
        token = _staff_token()
        vid = _create_vehicle(token, "SingleTest", "Delete")

        # Add
        add_resp = client.post(f"/api/v1/vehicles/{vid}/images", json={
            "image_url": "https://example.com/to-delete.jpg",
            "sort_order": 1,
        }, headers=_auth(token))
        image_id = add_resp.json()["image_id"]

        # Delete
        resp = client.delete(f"/api/v1/vehicles/{vid}/images/{image_id}", headers=_auth(token))
        assert resp.status_code == 200
        assert resp.json()["detail"] == "Image deleted"


class TestUnauthorizedAccess:
    """Image endpoints require auth."""

    def test_bulk_replace_no_token(self):
        resp = client.put("/api/v1/vehicles/1/images/bulk", json={
            "main_image_url": None, "images": [],
        })
        assert resp.status_code == 401

    def test_add_image_no_token(self):
        resp = client.post("/api/v1/vehicles/1/images", json={
            "image_url": "https://example.com/x.jpg",
        })
        assert resp.status_code == 401
