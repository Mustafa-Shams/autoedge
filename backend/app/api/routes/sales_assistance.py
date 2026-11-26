from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, StringConstraints
from sqlalchemy.orm import Session

from app.services.deal_service import interest_id
from app.api.deps import get_db, require_role
from app.services.sales_assistance import evidence, open_record
from app.core.time import utcnow
from app.models.enquiry import Enquiry
from app.models.test_drive import TestDrive
from app.models.customer import Customer
from app.models.sales_assistance import SalesAssistance
from app.models.user import User
from app.services.stock_service import get_vehicle_for_update

router = APIRouter(prefix="/sales/assistance", tags=["sales"])
sales_user = require_role(["manager", "sales_executive"])


class AssistanceInput(BaseModel):
    customer_id: int
    vehicle_id: int
    owner_id: int
    kind: Literal["Conversation", "Test drive", "Walk-in"]
    source_id: int | None = None
    note: Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=500)]


@router.get("")
def options(customer_id: int, vehicle_id: int, user=Depends(sales_user), db: Session = Depends(get_db)):
    owners = db.query(User).filter_by(role="sales_executive", is_active=True)
    if user.role != "manager":
        owners = owners.filter_by(user_id=user.user_id)
    current = open_record(db, customer_id, vehicle_id)
    return {"owners": [{"id": u.user_id, "name": u.full_name} for u in owners.order_by(User.full_name)],
            "sources": evidence(db, user, customer_id, vehicle_id),
            "current": {"id": current.assistance_id, "owner_id": current.owner_id, "kind": current.kind, "owner": db.get(User, current.owner_id).full_name,
                        "note": current.note} if current else None}


@router.post("")
def record_assistance(body: AssistanceInput, user=Depends(sales_user), db: Session = Depends(get_db)):
    if user.role != "manager" and user.user_id != body.owner_id:
        raise HTTPException(403, "Only a manager can assign another salesperson")
    owner = db.query(User).filter_by(user_id=body.owner_id, role="sales_executive", is_active=True).one_or_none()
    if owner is None or not db.get(Customer, body.customer_id) or not get_vehicle_for_update(db, body.vehicle_id):
        raise HTTPException(404, "Customer, listing or active salesperson not found")
    existing = open_record(db, body.customer_id, body.vehicle_id)
    if existing:
        if (existing.owner_id, existing.kind, existing.note, existing.enquiry_id or existing.test_drive_id) == (
            body.owner_id, body.kind, body.note, body.source_id):
            return {"assistance_id": existing.assistance_id}
        raise HTTPException(409, "This customer already has an owner for this vehicle")
    record = SalesAssistance(
        deal_id=interest_id(db, body.customer_id, body.vehicle_id), customer_id=body.customer_id, vehicle_id=body.vehicle_id, recorded_by=user.user_id,
                             owner_id=body.owner_id, kind=body.kind, note=body.note)
    if body.kind == "Walk-in":
        if body.source_id is not None:
            raise HTTPException(422, "Record the walk-in appointment details in the note")
    else:
        valid = any((s["kind"], s["source_id"], s["owner_id"]) == (body.kind, body.source_id, body.owner_id)
                    for s in evidence(db, user, body.customer_id, body.vehicle_id))
        if not valid:
            raise HTTPException(409, "Choose evidence for this salesperson, customer and car")
        source = "enquiry_id" if body.kind == "Conversation" else "test_drive_id"
        if db.query(SalesAssistance).filter_by(**{source: body.source_id}).first():
            raise HTTPException(409, "This evidence has already been used")
        evidence_row = db.get(Enquiry if body.kind == "Conversation" else TestDrive, body.source_id)
        if evidence_row.deal_id not in (None, record.deal_id):
            raise HTTPException(409, "This activity belongs to a different deal")
        evidence_row.deal_id = record.deal_id
        setattr(record, source, body.source_id)
    db.add(record)
    db.commit()
    return {"assistance_id": record.assistance_id}


@router.post("/{assistance_id}/close")
def close_assistance(assistance_id: int, user=Depends(sales_user), db: Session = Depends(get_db)):
    record = db.get(SalesAssistance, assistance_id)
    if not record or (user.role != "manager" and record.owner_id != user.user_id):
        raise HTTPException(404, "Assistance record not found")
    get_vehicle_for_update(db, record.vehicle_id)
    db.refresh(record)
    if record.sale_id:
        raise HTTPException(409, "A paid sale already uses this assistance record")
    record.closed_at = record.closed_at or utcnow()
    db.commit()
    return {"closed": True}
