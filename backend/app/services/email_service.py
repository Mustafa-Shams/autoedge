"""Email sending service — spec 7.9.

Uses HTTPS API providers (Brevo or SendGrid) as Railway blocks SMTP.
Suppresses emails to demo/test domains to avoid sending to fake addresses.

Provider selection via EMAIL_PROVIDER setting:
  - "none":     All emails → Suppressed
  - "brevo":    Brevo HTTPS API (POST https://api.brevo.com/v3/smtp/email)
  - "sendgrid": SendGrid HTTPS API (POST https://api.sendgrid.com/v3/mail/send)
"""
import logging
from datetime import datetime, timezone

import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.time import utcnow
from app.models.email_outbox import EmailOutbox

logger = logging.getLogger(__name__)

# Reserved test TLDs per RFC 2606 / 6761 — always suppressed
RESERVED_TLDS = {".test", ".invalid", ".example", ".localhost"}


def _is_suppressed_address(email: str) -> bool:
    """Check if an email address should be suppressed (not sent)."""
    if not email:
        return True

    domain = email.rsplit("@", 1)[-1].lower() if "@" in email else ""

    # Check reserved TLDs
    for tld in RESERVED_TLDS:
        if domain.endswith(tld):
            return True

    # Check configured suppress domains
    suppress_domains = [
        d.strip().lower()
        for d in settings.EMAIL_SUPPRESS_DOMAINS.split(",")
        if d.strip()
    ]
    if domain in suppress_domains:
        return True

    return False


async def _send_brevo(to_email: str, subject: str, body_html: str) -> None:
    """Send email via Brevo HTTPS API."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            "https://api.brevo.com/v3/smtp/email",
            headers={
                "api-key": settings.EMAIL_API_KEY,
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            json={
                "sender": {
                    "name": settings.EMAIL_FROM_NAME,
                    "email": settings.EMAIL_FROM_ADDRESS,
                },
                "to": [{"email": to_email}],
                "subject": subject,
                "htmlContent": body_html,
            },
        )
        resp.raise_for_status()


async def _send_sendgrid(to_email: str, subject: str, body_html: str) -> None:
    """Send email via SendGrid HTTPS API."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            "https://api.sendgrid.com/v3/mail/send",
            headers={
                "Authorization": f"Bearer {settings.EMAIL_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "personalizations": [{"to": [{"email": to_email}]}],
                "from": {
                    "name": settings.EMAIL_FROM_NAME,
                    "email": settings.EMAIL_FROM_ADDRESS,
                },
                "subject": subject,
                "content": [{"type": "text/html", "value": body_html}],
            },
        )
        resp.raise_for_status()


PROVIDERS = {
    "brevo": _send_brevo,
    "sendgrid": _send_sendgrid,
}


async def send(db: Session, email_id: int) -> None:
    """Send a queued email or mark it as Suppressed/Failed.

    This function is designed to be called from FastAPI's BackgroundTasks.
    A failed email NEVER breaks the main action — errors are logged and
    the email_outbox row is updated with status "Failed".
    """
    try:
        email = db.query(EmailOutbox).filter(
            EmailOutbox.email_id == email_id,
        ).first()

        if not email:
            logger.warning(f"Email #{email_id} not found in outbox")
            return

        if email.status != "Queued":
            logger.debug(f"Email #{email_id} already processed (status={email.status})")
            return

        # Check suppression
        provider = settings.EMAIL_PROVIDER.lower().strip()
        if provider == "none" or _is_suppressed_address(email.to_email):
            email.status = "Suppressed"
            db.commit()
            logger.info(f"Email #{email_id} to {email.to_email} → Suppressed")
            return

        # Check provider
        send_fn = PROVIDERS.get(provider)
        if not send_fn:
            email.status = "Failed"
            email.error_message = f"Unknown email provider: {provider}"
            db.commit()
            logger.error(f"Email #{email_id}: unknown provider '{provider}'")
            return

        # Check API key
        if not settings.EMAIL_API_KEY:
            email.status = "Failed"
            email.error_message = "EMAIL_API_KEY not configured"
            db.commit()
            logger.error(f"Email #{email_id}: EMAIL_API_KEY not set")
            return

        # Send
        await send_fn(email.to_email, email.subject, email.body_html)

        email.status = "Sent"
        email.sent_at = utcnow()
        db.commit()
        logger.info(f"Email #{email_id} to {email.to_email} → Sent via {provider}")

    except httpx.HTTPStatusError as exc:
        try:
            email.status = "Failed"
            email.error_message = f"HTTP {exc.response.status_code}: {exc.response.text[:500]}"
            db.commit()
        except Exception:
            db.rollback()
        logger.error(f"Email #{email_id} failed: HTTP {exc.response.status_code}")

    except Exception as exc:
        try:
            email.status = "Failed"
            email.error_message = str(exc)[:500]
            db.commit()
        except Exception:
            db.rollback()
        logger.error(f"Email #{email_id} failed: {exc}")
