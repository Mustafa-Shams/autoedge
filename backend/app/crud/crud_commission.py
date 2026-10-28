from decimal import Decimal
from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.commission import Commission
from app.models.user import User
from app.models.sale import Sale
from app.models.vehicle import Vehicle
from app.schemas.commission import CommissionUpdate


def _enrich(c: Commission, db: Session) -> Commission:
    """Attach human-readable display fields onto the commission object."""
    staff = db.query(User).filter(User.user_id == c.staff_id).first()
    c.staff_name = staff.full_name if staff else None
    sale = db.query(Sale).filter(Sale.sale_id == c.sale_id).first()
    if sale:
        v = db.query(Vehicle).filter(Vehicle.vehicle_id == sale.vehicle_id).first()
        c.vehicle_info = f"{v.year} {v.make} {v.model}" if v else None
    else:
        c.vehicle_info = None
    return c


def get_commission(db: Session, commission_id: int) -> Optional[Commission]:
    c = db.query(Commission).filter(Commission.commission_id == commission_id).first()
    if c:
        _enrich(c, db)
    return c


def get_commissions(
    db: Session,
    skip: int = 0,
    limit: int = 20,
    staff_id: Optional[int] = None,
    status: Optional[str] = None,
) -> List[Commission]:
    q = db.query(Commission)
    if staff_id:
        q = q.filter(Commission.staff_id == staff_id)
    if status:
        q = q.filter(Commission.status == status)
    commissions = q.order_by(Commission.created_at.desc()).offset(skip).limit(limit).all()
    for c in commissions:
        _enrich(c, db)
    return commissions


def update_commission(db: Session, commission_id: int, obj_in: CommissionUpdate) -> Optional[Commission]:
    commission = get_commission(db, commission_id)
    if not commission:
        return None
    data = obj_in.model_dump(exclude_unset=True)
    if data.get("status") == "Paid" and not commission.paid_at:
        data["paid_at"] = datetime.now(timezone.utc)
    for field, value in data.items():
        setattr(commission, field, value)
    db.commit()
    db.refresh(commission)
    _enrich(commission, db)
    return commission


def get_commission_summary(db: Session) -> List[dict]:
    rows = (
        db.query(
            Commission.staff_id,
            User.full_name,
            func.count(Commission.commission_id).label("total_commissions"),
            func.sum(Commission.commission_amt).label("total_amount"),
            func.sum(
                func.case((Commission.status == "Pending", Commission.commission_amt), else_=0)
            ).label("pending_amount"),
            func.sum(
                func.case((Commission.status == "Paid", Commission.commission_amt), else_=0)
            ).label("paid_amount"),
        )
        .join(User, Commission.staff_id == User.user_id)
        .group_by(Commission.staff_id, User.full_name)
        .all()
    )
    return [
        {
            "staff_id": r.staff_id,
            "staff_name": r.full_name,
            "total_commissions": r.total_commissions,
            "total_amount": r.total_amount or Decimal("0"),
            "pending_amount": r.pending_amount or Decimal("0"),
            "paid_amount": r.paid_amount or Decimal("0"),
        }
        for r in rows
    ]
