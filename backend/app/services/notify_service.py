"""Notification fan-out service — spec 7.9.

notify(db, customer_id, type, title, message, link_path, background_tasks, **template_kwargs)

Steps:
1. INSERT notifications (always, for every customer — primary channel).
2. INSERT email_outbox (Queued) addressed to the customer's email.
3. Schedule email sending via BackgroundTasks (runs after commit).

A failed email never breaks the main action.
"""
import logging
from typing import Optional

from fastapi import BackgroundTasks
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.customer import Customer
from app.models.notification import Notification
from app.models.email_outbox import EmailOutbox
from app.services.email_templates import get_email_content
from app.services.email_service import NOT_CONFIGURED, provider_configured

logger = logging.getLogger(__name__)


def notify(
    db: Session,
    customer_id: int,
    notification_type: str,
    title: str,
    message: str,
    link_path: Optional[str] = None,
    background_tasks: Optional[BackgroundTasks] = None,
    **template_kwargs,
) -> Notification:
    """Create a notification and queue an email for a customer.

    Args:
        db: Database session (caller manages commit/rollback).
        customer_id: The customer to notify.
        notification_type: One of the 18 notification types (e.g. "reservation_confirmed").
        title: Short notification title for the bell UI.
        message: Notification body text.
        link_path: Storefront link path (e.g. "/account/reservations").
        background_tasks: FastAPI BackgroundTasks instance for async email sending.
            If None, email is queued but not sent immediately (will be sent on next poll).
        **template_kwargs: Additional kwargs passed to the email template function.

    Returns:
        The created Notification object (not yet committed — caller must commit).
    """
    # 1. Create notification (always)
    notification = Notification(
        customer_id=customer_id,
        type=notification_type,
        title=title,
        message=message,
        link_path=link_path,
    )
    db.add(notification)

    # 2. Queue email
    customer = db.query(Customer).filter(
        Customer.customer_id == customer_id,
    ).first()

    if customer and customer.email:
        # Try to get email content from template
        email_content = get_email_content(
            notification_type=notification_type,
            store_url=settings.STORE_BASE_URL.rstrip("/"),
            customer_name=customer.full_name or "Customer",
            **template_kwargs,
        )

        if email_content:
            subject, body_html = email_content
        else:
            # Fallback: use notification title/message as email
            subject = title
            body_html = f"""<html><body style="font-family:Arial,sans-serif;background:#0D0F17;padding:20px;">
<div style="max-width:600px;margin:0 auto;background:#161821;border:1px solid #2A2D3E;border-radius:12px;padding:24px;">
<h2 style="color:#E4E6F0;">{title}</h2>
<p style="color:#A0A4B8;line-height:1.6;">{message}</p>
{f'<a href="{settings.STORE_BASE_URL.rstrip("/")}{link_path}" style="color:#4D7FFF;">View Details</a>' if link_path else ''}
</div></body></html>"""

        configured = provider_configured()
        email = EmailOutbox(
            customer_id=customer_id,
            to_email=customer.email,
            subject=subject,
            body_html=body_html,
            status="Queued" if configured else "Skipped",
            error_message=None if configured else NOT_CONFIGURED,
        )
        db.add(email)
        db.flush()  # Get the email_id for background task

        # 3. Schedule async email sending
        if background_tasks and configured:
            email_id = email.email_id
            background_tasks.add_task(_send_email_background, email_id)

    return notification


async def _send_email_background(email_id: int) -> None:
    """Background task to send a single email.

    Gets its own DB session so it's independent of the main transaction.
    """
    from app.db.session import SessionLocal
    from app.services import email_service

    db = SessionLocal()
    try:
        await email_service.send(db, email_id)
    except Exception as exc:
        logger.error(f"Background email send failed for #{email_id}: {exc}")
    finally:
        db.close()
