"""Staff Email Log route — spec 10.4, 9.

GET /email-log — List all email outbox entries with filters [manager only].
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_role
from app.models.email_outbox import EmailOutbox
from app.models.customer import Customer
from app.services.email_service import DeliveryResult, provider_configured, send

router = APIRouter(prefix="/email-log", tags=["staff-email-log"])

MANAGER = require_role(["manager"])


class TestEmailRequest(BaseModel):
    to: EmailStr = Field(max_length=150)


@router.get("")
async def list_email_log(
    status: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    _=Depends(MANAGER),
    db: Session = Depends(get_db),
):
    """List all email outbox entries. Manager only.

    Filters:
        status: Queued | Sent | Suppressed | Failed | Skipped
    """
    q = db.query(EmailOutbox)

    if status:
        q = q.filter(EmailOutbox.status == status)

    total = q.count()

    emails = (
        q.order_by(EmailOutbox.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    items = []
    for e in emails:
        # Get customer name
        customer_name = None
        if e.customer_id:
            customer = db.query(Customer).filter(
                Customer.customer_id == e.customer_id
            ).first()
            customer_name = customer.full_name if customer else None

        items.append({
            "email_id": e.email_id,
            "customer_id": e.customer_id,
            "customer_name": customer_name,
            "to_email": e.to_email,
            "subject": e.subject,
            "status": e.status,
            "error_message": e.error_message,
            "created_at": e.created_at.isoformat() if e.created_at else None,
            "sent_at": e.sent_at.isoformat() if e.sent_at else None,
        })

    return {
        "items": items,
        "provider_configured": provider_configured(),
        "total": total,
        "page": page,
        "page_size": page_size,
    }

@router.post("/test")
async def send_test_email(
    body: TestEmailRequest,
    response: Response,
    db: Session = Depends(get_db),
    _=Depends(MANAGER),
) -> DeliveryResult:
    """Record a manager's test and deliver it with the normal outbox sender."""
    email = EmailOutbox(
        to_email=str(body.to),
        subject="AutoEdge email delivery test",
        body_html="<p>This is a test email from the AutoEdge staff portal.</p>",
        status="Queued",
    )
    db.add(email)
    # Keep the new row private to this transaction until send() records the outcome.
    db.flush()
    result = await send(db, email.email_id)
    if result is None:
        raise HTTPException(status_code=409, detail="Test email could not be claimed.")
    if result.provider_status is not None:
        response.status_code = result.provider_status
    else:
        response.status_code = {"Skipped": 503, "Suppressed": 422, "Failed": 502}[result.status]
    return result


@router.post("/{email_id}/retry")
async def retry_email(email_id: int, db: Session = Depends(get_db), _=Depends(MANAGER)):
    if db.get(EmailOutbox, email_id) is None:
        raise HTTPException(status_code=404, detail="Email log entry not found.")
    result = await send(db, email_id, retry=True)
    if result is None:
        raise HTTPException(status_code=409, detail="This email cannot be retried or is already being processed.")
    return {"email_id": email_id, "status": result.status}
