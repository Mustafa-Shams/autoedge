from decimal import Decimal
from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.commission import Commission
from app.models.user import User
from app.schemas.commission import CommissionUpdate


def get_commission(db: Session, commission_id: int) -> Optional[Commission]:
    return db.query(Commission).filter(Commission.commission_id == commission_id).first()


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
    return q.order_by(Commission.created_at.desc()).offset(skip).limit(limit).all()


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
