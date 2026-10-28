from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_role
from app.crud.crud_test_drive import (
    get_test_drive, get_test_drives, create_test_drive,
    update_test_drive, delete_test_drive,
)
from app.schemas.test_drive import TestDriveCreate, TestDriveUpdate, TestDriveResponse

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
