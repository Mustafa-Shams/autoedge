"""Pydantic v2 schemas for wishlist, notifications, and other store features."""
from typing import Optional, List
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict


# ── Wishlist ─────────────────────────────────────────────────────────

class WishlistItemResponse(BaseModel):
    """A wishlist item with vehicle info."""
    model_config = ConfigDict(from_attributes=True)

    vehicle_id: int
    make: str
    model: str
    year: int
    price: Decimal
    main_image_url: Optional[str] = None
    fuel_type: Optional[str] = None
    transmission: Optional[str] = None
    body_type: Optional[str] = None
    stock_quantity: int = 0
    availability: str = "in_stock"
    added_at: datetime


# ── Notifications ────────────────────────────────────────────────────

class NotificationResponse(BaseModel):
    """A single notification."""
    model_config = ConfigDict(from_attributes=True)

    notification_id: int
    type: str
    title: str
    message: str
    link_path: Optional[str] = None
    is_read: bool
    created_at: datetime


class NotificationListResponse(BaseModel):
    """Paginated notifications."""
    items: List[NotificationResponse]
    total: int
    page: int
    page_size: int


class UnreadCountResponse(BaseModel):
    """Unread notification count."""
    count: int
