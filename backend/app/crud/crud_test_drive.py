from typing import List, Optional
from datetime import date
from sqlalchemy.orm import Session
from app.models.test_drive import TestDrive
from app.schemas.test_drive import TestDriveCreate, TestDriveUpdate


def get_test_drive(db: Session, test_drive_id: int) -> Optional[TestDrive]:
    return db.query(TestDrive).filter(TestDrive.test_drive_id == test_drive_id).first()


def get_test_drives(
    db: Session,
    skip: int = 0,
    limit: int = 20,
    status: Optional[str] = None,
    lead_status: Optional[str] = None,
    assigned_to: Optional[int] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
) -> List[TestDrive]:
    q = db.query(TestDrive)
    if status:
        q = q.filter(TestDrive.status == status)
    if lead_status:
        q = q.filter(TestDrive.lead_status == lead_status)
    if assigned_to:
        q = q.filter(TestDrive.assigned_to == assigned_to)
    if date_from:
        q = q.filter(TestDrive.scheduled_date >= date_from)
    if date_to:
        q = q.filter(TestDrive.scheduled_date <= date_to)
    return q.offset(skip).limit(limit).all()


def create_test_drive(db: Session, obj_in: TestDriveCreate) -> TestDrive:
    db_td = TestDrive(**obj_in.model_dump())
    db.add(db_td)
    db.commit()
    db.refresh(db_td)
    return db_td


def update_test_drive(db: Session, test_drive_id: int, obj_in: TestDriveUpdate) -> Optional[TestDrive]:
    td = get_test_drive(db, test_drive_id)
    if not td:
        return None
    for field, value in obj_in.model_dump(exclude_unset=True).items():
        setattr(td, field, value)
    db.commit()
    db.refresh(td)
    return td


def delete_test_drive(db: Session, test_drive_id: int) -> Optional[TestDrive]:
    td = get_test_drive(db, test_drive_id)
    if not td:
        return None
    td.status = "Cancelled"
    db.commit()
    db.refresh(td)
    return td
