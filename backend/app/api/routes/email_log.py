"""Staff Email Log route — spec 10.4, 9.

GET /email-log — List all email outbox entries with filters [manager only].
"""
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_role
from app.models.email_outbox import EmailOutbox
from app.models.customer import Customer

router = APIRouter(prefix="/email-log", tags=["staff-email-log"])

MANAGER = require_role(["manager"])


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
        status: Queued | Sent | Suppressed | Failed
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
        "total": total,
        "page": page,
        "page_size": page_size,
    }
