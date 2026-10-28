from datetime import date
from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.test_drive import TestDrive
from app.models.customer import Customer
from app.models.vehicle import Vehicle
from app.models.user import User
from app.schemas.test_drive import TestDriveCreate, TestDriveUpdate


def _enrich(td: TestDrive, db: Session) -> TestDrive:
    """Attach human-readable display fields."""
    c = db.query(Customer).filter(Customer.customer_id == td.customer_id).first()
    v = db.query(Vehicle).filter(Vehicle.vehicle_id == td.vehicle_id).first()
    td.customer_name = c.full_name if c else None
    td.vehicle_info = f"{v.year} {v.make} {v.model}" if v else None
    if td.assigned_to:
        u = db.query(User).filter(User.user_id == td.assigned_to).first()
        td.assigned_staff_name = u.full_name if u else None
    else:
        td.assigned_staff_name = None
    return td


def get_test_drive(db: Session, test_drive_id: int) -> Optional[TestDrive]:
    td = db.query(TestDrive).filter(TestDrive.test_drive_id == test_drive_id).first()
    if td:
        _enrich(td, db)
    return td


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
    tds = q.order_by(TestDrive.scheduled_date.desc()).offset(skip).limit(limit).all()
    for td in tds:
        _enrich(td, db)
    return tds


def create_test_drive(db: Session, obj_in: TestDriveCreate) -> TestDrive:
    td = TestDrive(**obj_in.model_dump())
    db.add(td)
    db.commit()
    db.refresh(td)
    _enrich(td, db)
    return td


def update_test_drive(db: Session, test_drive_id: int, obj_in: TestDriveUpdate) -> Optional[TestDrive]:
    td = db.query(TestDrive).filter(TestDrive.test_drive_id == test_drive_id).first()
    if not td:
        return None
    data = obj_in.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(td, field, value)
    db.commit()
    db.refresh(td)
    _enrich(td, db)
    return td


def delete_test_drive(db: Session, test_drive_id: int) -> Optional[TestDrive]:
    td = db.query(TestDrive).filter(TestDrive.test_drive_id == test_drive_id).first()
    if not td:
        return None
    db.delete(td)
    db.commit()
    return td
