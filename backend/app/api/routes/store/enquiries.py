"""Store enquiry routes — customer-facing enquiry threads per spec 7.5.

POST /store/enquiries              — create a new enquiry
GET  /store/enquiries              — list my enquiries
GET  /store/enquiries/{id}         — get thread with messages
POST /store/enquiries/{id}/messages — reply to an enquiry
POST /store/enquiries/{id}/close   — close an enquiry
"""
from typing import Optional, List
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, field_validator
from sqlalchemy.orm import Session, joinedload

from app.services.deal_service import interest_id
from app.api.deps import get_db, get_current_customer
from app.core.time import utcnow
from app.models.customer_account import CustomerAccount
from app.models.enquiry import Enquiry, EnquiryMessage
from app.models.vehicle import Vehicle

router = APIRouter(prefix="/store/enquiries", tags=["store-enquiries"])


# ── Schemas ──────────────────────────────────────────────────────────


class CreateEnquiryRequest(BaseModel):
    vehicle_id: Optional[int] = None
    subject: str
    message: str

    @field_validator("subject")
    @classmethod
    def validate_subject(cls, v):
        v = v.strip()
        if len(v) < 3:
            raise ValueError("Subject must be at least 3 characters.")
        if len(v) > 150:
            raise ValueError("Subject must be at most 150 characters.")
        return v

    @field_validator("message")
    @classmethod
    def validate_message(cls, v):
        v = v.strip()
        if len(v) < 5:
            raise ValueError("Message must be at least 5 characters.")
        return v


class ReplyRequest(BaseModel):
    body: str

    @field_validator("body")
    @classmethod
    def validate_body(cls, v):
        v = v.strip()
        if len(v) < 1:
            raise ValueError("Reply body cannot be empty.")
        return v


class MessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    message_id: int
    enquiry_id: int
    sender_type: str
    sender_user_id: Optional[int] = None
    sender_name: Optional[str] = None
    body: str
    created_at: Optional[str] = None

    @field_validator("created_at", mode="before")
    @classmethod
    def fmt_dt(cls, v):
        if v and hasattr(v, "isoformat"):
            return v.isoformat()
        return v


class VehicleRef(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    vehicle_id: int
    make: Optional[str] = None
    model: Optional[str] = None
    year: Optional[int] = None
    main_image_url: Optional[str] = None


class EnquiryListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    enquiry_id: int
    sale_id: Optional[int] = None
    subject: str
    status: str
    vehicle_id: Optional[int] = None
    vehicle: Optional[VehicleRef] = None
    message_count: int = 0
    last_message_at: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    @field_validator("created_at", "updated_at", "last_message_at", mode="before")
    @classmethod
    def fmt_dt(cls, v):
        if v and hasattr(v, "isoformat"):
            return v.isoformat()
        return v


class EnquiryDetail(EnquiryListItem):
    messages: List[MessageResponse] = []


# ── Helpers ──────────────────────────────────────────────────────────


def _to_list_item(e: Enquiry) -> dict:
    msgs = e.messages or []
    vehicle_ref = None
    if e.vehicle:
        vehicle_ref = {
            "vehicle_id": e.vehicle.vehicle_id,
            "make": e.vehicle.make,
            "model": e.vehicle.model,
            "year": e.vehicle.year,
            "main_image_url": e.vehicle.main_image_url,
        }
    return {
        "enquiry_id": e.enquiry_id,
        "sale_id": e.sale_id,
        "deal_id": e.deal_id,
        "subject": e.subject,
        "status": e.status,
        "vehicle_id": e.vehicle_id,
        "vehicle": vehicle_ref,
        "message_count": len(msgs),
        "last_message_at": msgs[-1].created_at.isoformat() if msgs else None,
        "created_at": e.created_at.isoformat() if e.created_at else None,
        "updated_at": e.updated_at.isoformat() if e.updated_at else None,
    }


def _msg_response(m: EnquiryMessage) -> dict:
    sender_name = None
    if m.sender_type == "staff" and m.sender_user:
        sender_name = m.sender_user.full_name
    return {
        "message_id": m.message_id,
        "enquiry_id": m.enquiry_id,
        "sender_type": m.sender_type,
        "sender_user_id": m.sender_user_id,
        "sender_name": sender_name,
        "body": m.body,
        "created_at": m.created_at.isoformat() if m.created_at else None,
    }


# ── Routes ───────────────────────────────────────────────────────────


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_enquiry(
    body: CreateEnquiryRequest,
    db: Session = Depends(get_db),
    account: CustomerAccount = Depends(get_current_customer),
):
    """Start a new enquiry thread."""
    # Validate vehicle if provided
    if body.vehicle_id:
        vehicle = db.query(Vehicle).filter(Vehicle.vehicle_id == body.vehicle_id).first()
        if not vehicle:
            raise HTTPException(status_code=404, detail="Vehicle not found.")

    now = utcnow()
    enquiry = Enquiry(
        deal_id=interest_id(db, account.customer_id, body.vehicle_id),
        customer_id=account.customer_id,
        vehicle_id=body.vehicle_id,
        subject=body.subject.strip(),
        status="Open",
        created_at=now,
        updated_at=now,
    )
    db.add(enquiry)
    db.flush()

    # Add first message
    msg = EnquiryMessage(
        enquiry_id=enquiry.enquiry_id,
        sender_type="customer",
        body=body.message.strip(),
        created_at=now,
    )
    db.add(msg)
    db.commit()
    db.refresh(enquiry)

    return _to_list_item(enquiry)


@router.get("")
async def list_enquiries(
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    account: CustomerAccount = Depends(get_current_customer),
):
    """List my enquiries."""
    q = (
        db.query(Enquiry)
        .options(joinedload(Enquiry.messages), joinedload(Enquiry.vehicle))
        .filter(Enquiry.customer_id == account.customer_id)
    )
    if status_filter:
        q = q.filter(Enquiry.status == status_filter)
    enquiries = q.order_by(Enquiry.updated_at.desc()).all()
    return [_to_list_item(e) for e in enquiries]


@router.get("/{enquiry_id}")
async def get_enquiry_thread(
    enquiry_id: int,
    db: Session = Depends(get_db),
    account: CustomerAccount = Depends(get_current_customer),
):
    """Get enquiry thread with messages."""
    enquiry = (
        db.query(Enquiry)
        .options(
            joinedload(Enquiry.messages).joinedload(EnquiryMessage.sender_user),
            joinedload(Enquiry.vehicle),
        )
        .filter(
            Enquiry.enquiry_id == enquiry_id,
            Enquiry.customer_id == account.customer_id,
        )
        .first()
    )
    if not enquiry:
        raise HTTPException(status_code=404, detail="Enquiry not found.")

    data = _to_list_item(enquiry)
    data["messages"] = [_msg_response(m) for m in (enquiry.messages or [])]
    return data


@router.post("/{enquiry_id}/messages")
async def reply_to_enquiry(
    enquiry_id: int,
    body: ReplyRequest,
    db: Session = Depends(get_db),
    account: CustomerAccount = Depends(get_current_customer),
):
    """Reply to an enquiry (customer side). Sets status to Open."""
    enquiry = (
        db.query(Enquiry)
        .filter(
            Enquiry.enquiry_id == enquiry_id,
            Enquiry.customer_id == account.customer_id,
        )
        .first()
    )
    if not enquiry:
        raise HTTPException(status_code=404, detail="Enquiry not found.")

    if enquiry.status == "Closed":
        # Re-open on customer reply (spec: customer can re-open by replying)
        enquiry.status = "Open"

    now = utcnow()
    msg = EnquiryMessage(
        enquiry_id=enquiry_id,
        sender_type="customer",
        body=body.body.strip(),
        created_at=now,
    )
    db.add(msg)
    enquiry.updated_at = now
    db.commit()
    db.refresh(msg)

    return _msg_response(msg)


@router.post("/{enquiry_id}/close")
async def close_enquiry(
    enquiry_id: int,
    db: Session = Depends(get_db),
    account: CustomerAccount = Depends(get_current_customer),
):
    """Close an enquiry (customer side)."""
    enquiry = (
        db.query(Enquiry)
        .filter(
            Enquiry.enquiry_id == enquiry_id,
            Enquiry.customer_id == account.customer_id,
        )
        .first()
    )
    if not enquiry:
        raise HTTPException(status_code=404, detail="Enquiry not found.")

    enquiry.status = "Closed"
    enquiry.updated_at = utcnow()
    db.commit()

    return {"status": "Closed", "enquiry_id": enquiry_id}
