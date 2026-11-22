"""Email sending service — spec 7.9.

Uses HTTPS API providers (Brevo or SendGrid) as Railway blocks SMTP.
Suppresses emails to demo/test domains to avoid sending to fake addresses.

Provider selection via EMAIL_PROVIDER setting:
  - "none":     Email delivery is skipped
  - "brevo":    Brevo HTTPS API (POST https://api.brevo.com/v3/smtp/email)
  - "sendgrid": SendGrid HTTPS API (POST https://api.sendgrid.com/v3/mail/send)
"""
import logging

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


NOT_CONFIGURED = "Email provider not configured"


def provider_configured() -> bool:
    return bool(
        settings.EMAIL_PROVIDER.strip().lower() in PROVIDERS
        and settings.EMAIL_API_KEY.strip()
        and settings.EMAIL_FROM_ADDRESS.strip()
    )


async def send(db: Session, email_id: int, *, retry: bool = False) -> str | None:
    """Claim an outbox row so the worker and manual retries cannot send it together."""
    statuses = ("Failed", "Skipped") if retry else ("Queued",)
    email = (
        db.query(EmailOutbox)
        .filter(EmailOutbox.email_id == email_id, EmailOutbox.status.in_(statuses))
        .populate_existing().with_for_update(skip_locked=True).first()
    )
    if email is None:
        return None

    email.error_message = None
    if not provider_configured():
        email.status = "Skipped"
        email.error_message = NOT_CONFIGURED
    elif _is_suppressed_address(email.to_email):
        email.status = "Suppressed"
    else:
        try:
            await PROVIDERS[settings.EMAIL_PROVIDER.strip().lower()](
                email.to_email, email.subject, email.body_html,
            )
        except httpx.HTTPStatusError as exc:
            email.status = "Failed"
            email.error_message = f"HTTP {exc.response.status_code}: {exc.response.text[:500]}"
        except Exception as exc:
            email.status = "Failed"
            email.error_message = str(exc) or type(exc).__name__
        else:
            email.status = "Sent"
            email.sent_at = utcnow()

    if email.status == "Failed":
        email.error_message = email.error_message.replace(settings.EMAIL_API_KEY, "[redacted]")
        logger.warning("Email #%s failed: %s", email_id, email.error_message)
    result = email.status
    db.commit()
    return result
