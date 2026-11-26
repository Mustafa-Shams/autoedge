"""Staff enquiry routes — staff-facing enquiry management per spec 7.5 and 9.

GET  /enquiries              — list all enquiries (with filters)
GET  /enquiries/{id}         — get thread detail
POST /enquiries/{id}/reply   — staff reply
PUT  /enquiries/{id}         — update status/assignment
PUT  /users/{id}/enquiry-access — toggle handles_enquiries (manager only)
"""
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_db, get_current_user, require_role, require_enquiry_access
from app.core.enquiry_categories import CATEGORIES, can_see, category_expression, effective_category, visible_filter
from app.core.time import utcnow
from app.models.enquiry import Enquiry, EnquiryMessage
from app.models.notification import Notification
from app.models.user import User
from app.services.notify_service import notify

router = APIRouter(prefix="/enquiries", tags=["staff-enquiries"])

ENQUIRY_ACCESS = require_enquiry_access()
MANAGER_ONLY = require_role(["manager"])


# ── Schemas ──────────────────────────────────────────────────────────


class StaffReplyRequest(BaseModel):
    body: str

    @field_validator("body")
    @classmethod
    def validate_body(cls, v):
        v = v.strip()
        if len(v) < 1:
            raise ValueError("Reply body cannot be empty.")
        return v


class UpdateEnquiryRequest(BaseModel):
    status: Optional[str] = None
    assigned_to: Optional[int] = None
    category: Optional[Literal[CATEGORIES]] = None


class ToggleEnquiryAccess(BaseModel):
    handles_enquiries: bool


# ── Helper ───────────────────────────────────────────────────────────


def _visible_or_404(enquiry, user):
    # Same 404 as a missing row: do not reveal threads outside the user's categories.
    if not enquiry or not can_see(user, enquiry):
        raise HTTPException(status_code=404, detail="Enquiry not found.")
    return enquiry


def _enquiry_to_dict(e: Enquiry) -> dict:
    msgs = []
    for m in (e.messages or []):
        sender_name = None
        if m.sender_type == "staff" and m.sender_user:
            sender_name = m.sender_user.full_name
        elif m.sender_type == "customer" and e.customer:
            sender_name = e.customer.full_name
        msgs.append({
            "message_id": m.message_id,
            "enquiry_id": m.enquiry_id,
            "sender_type": m.sender_type,
            "sender_user_id": m.sender_user_id,
            "sender_name": sender_name,
            "body": m.body,
            "created_at": m.created_at.isoformat() if m.created_at else None,
        })

    vehicle_ref = None
    if e.vehicle:
        vehicle_ref = {
            "vehicle_id": e.vehicle.vehicle_id,
            "make": e.vehicle.make,
            "model": e.vehicle.model,
            "year": e.vehicle.year,
        }

    customer_ref = None
    if e.customer:
        customer_ref = {
            "customer_id": e.customer.customer_id,
            "full_name": e.customer.full_name,
            "email": e.customer.email,
        }

    assigned_name = None
    if e.assigned_staff:
        assigned_name = e.assigned_staff.full_name

    return {
        "enquiry_id": e.enquiry_id,
        "sale_id": e.sale_id,
        "deal_id": e.deal_id,
        "subject": e.subject,
        "category": effective_category(e),
        "status": e.status,
        "vehicle_id": e.vehicle_id,
        "vehicle": vehicle_ref,
        "customer_id": e.customer_id,
        "customer": customer_ref,
        "assigned_to": e.assigned_to,
        "assigned_name": assigned_name,
        "message_count": len(msgs),
        "messages": msgs,
        "created_at": e.created_at.isoformat() if e.created_at else None,
        "updated_at": e.updated_at.isoformat() if e.updated_at else None,
    }


# ── Routes ───────────────────────────────────────────────────────────


@router.get("")
@router.get("/", include_in_schema=False)
async def list_enquiries(
    status_filter: Optional[str] = None,
    assigned_to: Optional[int] = None,
    vehicle_id: Optional[int] = None,
    category: Optional[Literal[CATEGORIES]] = None,
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_db),
    current_user=Depends(ENQUIRY_ACCESS),
):
    """List all enquiries (staff with enquiry access)."""
    q = (
        db.query(Enquiry)
        .options(
            joinedload(Enquiry.messages),
            joinedload(Enquiry.vehicle),
            joinedload(Enquiry.customer),
            joinedload(Enquiry.assigned_staff),
        )
    )
    if status_filter:
        q = q.filter(Enquiry.status == status_filter)
    if assigned_to:
        q = q.filter(Enquiry.assigned_to == assigned_to)
    if vehicle_id:
        q = q.filter(Enquiry.vehicle_id == vehicle_id)
    visible = visible_filter(current_user)
    if visible is not None:
        q = q.filter(visible)
    if category:
        q = q.filter(category_expression() == category)

    total = q.count()
    items = (
        q.order_by(Enquiry.updated_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return {
        "items": [_enquiry_to_dict(e) for e in items],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/{enquiry_id}")
async def get_enquiry_detail(
    enquiry_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(ENQUIRY_ACCESS),
):
    """Get enquiry thread detail (staff)."""
    enquiry = (
        db.query(Enquiry)
        .options(
            joinedload(Enquiry.messages).joinedload(EnquiryMessage.sender_user),
            joinedload(Enquiry.vehicle),
            joinedload(Enquiry.customer),
            joinedload(Enquiry.assigned_staff),
        )
        .filter(Enquiry.enquiry_id == enquiry_id)
        .first()
    )
    return _enquiry_to_dict(_visible_or_404(enquiry, current_user))


@router.post("/{enquiry_id}/reply")
async def staff_reply(
    enquiry_id: int,
    body: StaffReplyRequest,
    db: Session = Depends(get_db),
    current_user=Depends(ENQUIRY_ACCESS),
):
    """Staff replies to an enquiry. Sets status to Answered. Notifies customer."""
    enquiry = _visible_or_404(db.query(Enquiry).filter(Enquiry.enquiry_id == enquiry_id).first(), current_user)

    now = utcnow()

    # Set status to Answered (spec: staff reply sets Answered)
    enquiry.status = "Answered"
    enquiry.updated_at = now

    # Create message
    msg = EnquiryMessage(
        enquiry_id=enquiry_id,
        sender_type="staff",
        sender_user_id=current_user.user_id,
        body=body.body.strip(),
        created_at=now,
    )
    db.add(msg)

    # Notify customer (spec: staff reply triggers enquiry_replied notification)
    notify(
        db,
        customer_id=enquiry.customer_id,
        notification_type="enquiry_replied",
        title="New Reply to Your Enquiry",
        message=f"Staff has replied to your enquiry: \"{enquiry.subject}\"",
        link_path=f"/account/enquiries/{enquiry_id}",
        subject_line=enquiry.subject,
    )

    db.commit()

    return {
        "message_id": msg.message_id,
        "enquiry_id": enquiry_id,
        "sender_type": "staff",
        "sender_user_id": current_user.user_id,
        "sender_name": current_user.full_name,
        "body": msg.body,
        "created_at": msg.created_at.isoformat(),
    }


@router.put("/{enquiry_id}")
async def update_enquiry(
    enquiry_id: int,
    body: UpdateEnquiryRequest,
    db: Session = Depends(get_db),
    current_user=Depends(ENQUIRY_ACCESS),
):
    """Update enquiry status, assignment or category (staff)."""
    enquiry = _visible_or_404(db.query(Enquiry).filter(Enquiry.enquiry_id == enquiry_id).first(), current_user)

    if body.status is not None:
        if body.status not in ("Open", "Answered", "Closed"):
            raise HTTPException(status_code=422, detail="Invalid status.")
        enquiry.status = body.status

    if body.assigned_to is not None:
        # Verify the user exists
        user = db.query(User).filter(User.user_id == body.assigned_to).first()
        if not user:
            raise HTTPException(status_code=404, detail="Staff user not found.")
        enquiry.assigned_to = body.assigned_to

    if body.category is not None:
        enquiry.category = body.category

    enquiry.updated_at = utcnow()
    db.commit()
    db.refresh(enquiry)

    return {"enquiry_id": enquiry.enquiry_id, "status": enquiry.status, "assigned_to": enquiry.assigned_to,
            "category": effective_category(enquiry)}


# ── Enquiry access toggle (manager only, on users route) ─────────


@router.put("/users/{user_id}/enquiry-access")
async def toggle_enquiry_access(
    user_id: int,
    body: ToggleEnquiryAccess,
    db: Session = Depends(get_db),
    current_user=Depends(MANAGER_ONLY),
):
    """Toggle a staff member's handles_enquiries flag (manager only). Spec 9."""
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    user.handles_enquiries = body.handles_enquiries
    db.commit()

    return {"user_id": user.user_id, "handles_enquiries": user.handles_enquiries}
