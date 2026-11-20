"""Notification routes — spec 10.3.

GET  /store/notifications              — paginated list
GET  /store/notifications/unread-count — unread count
POST /store/notifications/{id}/read    — mark one as read
POST /store/notifications/read-all     — mark all as read
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.api.deps import get_current_customer, get_db
from app.models.customer import Customer
from app.models.notification import Notification
from app.schemas.store_schemas import (
    NotificationResponse,
    NotificationListResponse,
    UnreadCountResponse,
)

router = APIRouter(prefix="/store/notifications", tags=["store-notifications"])


@router.get("", response_model=NotificationListResponse)
async def list_notifications(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    customer: Customer = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    """List notifications for the current customer, newest first."""
    base = db.query(Notification).filter(
        Notification.customer_id == customer.customer_id,
    )

    total = base.count()

    items = (
        base.order_by(Notification.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return NotificationListResponse(
        items=[NotificationResponse.model_validate(n) for n in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/unread-count", response_model=UnreadCountResponse)
async def get_unread_count(
    customer: Customer = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    """Get the count of unread notifications."""
    count = db.query(func.count(Notification.notification_id)).filter(
        Notification.customer_id == customer.customer_id,
        Notification.is_read == False,
    ).scalar() or 0

    return UnreadCountResponse(count=count)


@router.post("/{notification_id}/read")
async def mark_read(
    notification_id: int,
    customer: Customer = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    """Mark a single notification as read."""
    notification = db.query(Notification).filter(
        Notification.notification_id == notification_id,
        Notification.customer_id == customer.customer_id,
    ).first()

    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    notification.is_read = True
    db.commit()

    return {"message": "Marked as read", "notification_id": notification_id}


@router.post("/read-all")
async def mark_all_read(
    customer: Customer = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    """Mark all notifications as read for the current customer."""
    updated = db.query(Notification).filter(
        Notification.customer_id == customer.customer_id,
        Notification.is_read == False,
    ).update({"is_read": True})
    db.commit()

    return {"message": f"Marked {updated} notifications as read"}
