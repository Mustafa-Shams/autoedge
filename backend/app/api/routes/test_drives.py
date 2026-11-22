from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.models.user import User
from app.api.deps import get_db, require_role
from app.crud.crud_test_drive import (
    get_test_drive, get_test_drives, create_test_drive,
    update_test_drive, delete_test_drive,
)
from app.schemas.test_drive import TestDriveCreate, TestDriveUpdate, TestDriveResponse
from app.services.test_drive_service import (
    confirm_test_drive as svc_confirm,
    decline_test_drive as svc_decline,
    TestDriveError,
)

router = APIRouter(prefix="/test-drives", tags=["test-drives"])

ALLOWED = require_role(["manager", "sales_executive", "receptionist"])


@router.get("/", response_model=List[TestDriveResponse])
async def list_test_drives(
    skip: int = 0,
    limit: int = 20,
    status: Optional[str] = None,
    lead_status: Optional[str] = None,
    assigned_to: Optional[int] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    db: Session = Depends(get_db),
    _=Depends(ALLOWED),
):
    return get_test_drives(db, skip=skip, limit=limit, status=status,
                           lead_status=lead_status, assigned_to=assigned_to,
                           date_from=date_from, date_to=date_to)


@router.post("/", response_model=TestDriveResponse, status_code=status.HTTP_201_CREATED)
async def book_test_drive(
    td_in: TestDriveCreate,
    db: Session = Depends(get_db),
    _=Depends(ALLOWED),
):
    return create_test_drive(db, td_in)


@router.get("/sales-staff")
def list_sales_staff(db: Session = Depends(get_db), _=Depends(ALLOWED)):
    users = db.query(User.user_id, User.full_name).filter(
        User.role == "sales_executive", User.is_active.is_(True),
    ).order_by(User.full_name)
    return [row._asdict() for row in users]


@router.get("/{test_drive_id}", response_model=TestDriveResponse)
async def get_test_drive_detail(test_drive_id: int, db: Session = Depends(get_db), _=Depends(ALLOWED)):
    td = get_test_drive(db, test_drive_id)
    if not td:
        raise HTTPException(status_code=404, detail="Test drive not found")
    return td


@router.put("/{test_drive_id}", response_model=TestDriveResponse)
async def update_test_drive_detail(
    test_drive_id: int,
    td_in: TestDriveUpdate,
    db: Session = Depends(get_db),
    _=Depends(ALLOWED),
):
    td = update_test_drive(db, test_drive_id, td_in)
    if not td:
        raise HTTPException(status_code=404, detail="Test drive not found")
    return td


@router.delete("/{test_drive_id}", response_model=TestDriveResponse)
async def cancel_test_drive(test_drive_id: int, db: Session = Depends(get_db), _=Depends(ALLOWED)):
    td = delete_test_drive(db, test_drive_id)
    if not td:
        raise HTTPException(status_code=404, detail="Test drive not found")
    return td



# ── Storefront additions: confirm / decline ──────────────────────────


class ConfirmBody(BaseModel):
    assigned_to: Optional[int] = None


class DeclineBody(BaseModel):
    reason: str


@router.post("/{test_drive_id}/confirm", response_model=TestDriveResponse)
async def confirm_online_test_drive(
    test_drive_id: int,
    body: ConfirmBody,
    db: Session = Depends(get_db),
    current_user=Depends(ALLOWED),
):
    """Confirm a test drive request (Requested → Scheduled). Spec 7.3."""
    try:
        td = svc_confirm(db, test_drive_id, body.assigned_to or current_user.user_id)
    except TestDriveError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    # Enrich for response
    from app.crud.crud_test_drive import _enrich
    _enrich(td, db)
    return td


@router.post("/{test_drive_id}/decline", response_model=TestDriveResponse)
async def decline_online_test_drive(
    test_drive_id: int,
    body: DeclineBody,
    db: Session = Depends(get_db),
    _=Depends(ALLOWED),
):
    """Decline a test drive request (Requested → Cancelled). Spec 7.3."""
    if not body.reason or not body.reason.strip():
        raise HTTPException(status_code=422, detail="Reason is required when declining a test drive.")
    try:
        td = svc_decline(db, test_drive_id, body.reason.strip())
    except TestDriveError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    # Enrich for response
    from app.crud.crud_test_drive import _enrich
    _enrich(td, db)
    return td
