"""Email sending service — spec 7.9.

Uses HTTPS API providers (Brevo or SendGrid) as Railway blocks SMTP.
Suppresses emails to demo/test domains to avoid sending to fake addresses.

Provider selection via EMAIL_PROVIDER setting:
  - "none":     Email delivery is skipped
  - "brevo":    Brevo HTTPS API (POST https://api.brevo.com/v3/smtp/email)
  - "sendgrid": SendGrid HTTPS API (POST https://api.sendgrid.com/v3/mail/send)
"""
import logging
from dataclasses import dataclass

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


async def _send_brevo(to_email: str, to_name: str, subject: str, body_html: str) -> httpx.Response:
    """Send email via Brevo HTTPS API."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        return await client.post(
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
                "to": [{"email": to_email, "name": to_name}],
                "subject": subject,
                "htmlContent": body_html,
            },
        )


async def _send_sendgrid(to_email: str, to_name: str, subject: str, body_html: str) -> httpx.Response:
    """Send email via SendGrid HTTPS API."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        return await client.post(
            "https://api.sendgrid.com/v3/mail/send",
            headers={
                "Authorization": f"Bearer {settings.EMAIL_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "personalizations": [{"to": [{"email": to_email, "name": to_name}]}],
                "from": {
                    "name": settings.EMAIL_FROM_NAME,
                    "email": settings.EMAIL_FROM_ADDRESS,
                },
                "subject": subject,
                "content": [{"type": "text/html", "value": body_html}],
            },
        )


PROVIDERS = {
    "brevo": _send_brevo,
    "sendgrid": _send_sendgrid,
}


NOT_CONFIGURED = "Email provider not configured"


def provider_configured() -> bool:
    return bool(
        settings.EMAIL_PROVIDER.lower() in PROVIDERS
        and settings.EMAIL_API_KEY
        and settings.EMAIL_FROM_ADDRESS
    )


@dataclass
class DeliveryResult:
    status: str
    provider_status: int | None
    provider_body: str | None
    detail: str | None


def _redact(message: str) -> str:
    key = settings.EMAIL_API_KEY
    if not key:
        return message
    return message.replace(key, "[redacted]").replace(repr(key)[1:-1], "[redacted]")


async def send(db: Session, email_id: int, *, retry: bool = False) -> DeliveryResult | None:
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
    provider_status = None
    provider_body = None
    detail = None
    if not provider_configured():
        email.status = "Skipped"
        email.error_message = NOT_CONFIGURED
    elif _is_suppressed_address(email.to_email):
        email.status = "Suppressed"
        detail = "Email suppressed for a demo or test address."
    else:
        try:
            recipient_name = email.customer.full_name if email.customer else None
            response = await PROVIDERS[settings.EMAIL_PROVIDER.lower()](
                email.to_email, recipient_name or email.to_email, email.subject, email.body_html,
            )
            provider_status = response.status_code
            provider_body = _redact(response.text)
            if response.is_success:
                email.status = "Sent"
                email.sent_at = utcnow()
            else:
                email.status = "Failed"
                email.error_message = f"HTTP {provider_status}: {provider_body}"
        except Exception as exc:
            email.status = "Failed"
            email.error_message = _redact(str(exc) or type(exc).__name__)

    key = settings.EMAIL_API_KEY
    logger.log(
        logging.WARNING if email.status == "Failed" else logging.INFO,
        "Email #%s %s provider=%s http_status=%s key_length=%d key_prefix=%r",
        email_id, email.status, settings.EMAIL_PROVIDER.lower() if provider_configured() else "unconfigured",
        provider_status, len(key), key[:8] if len(key) > 8 else "[withheld]",
    )
    result = DeliveryResult(email.status, provider_status, provider_body, email.error_message or detail)
    db.commit()
    return result
