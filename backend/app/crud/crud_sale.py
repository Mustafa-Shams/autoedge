from decimal import Decimal
from typing import List, Optional
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.sale import Sale
from app.models.vehicle import Vehicle
from app.models.commission import Commission
from app.schemas.sale import SaleCreate, SaleUpdate


def get_sale(db: Session, sale_id: int) -> Optional[Sale]:
    return db.query(Sale).filter(Sale.sale_id == sale_id).first()


def get_sales(
    db: Session,
    skip: int = 0,
    limit: int = 20,
    staff_id: Optional[int] = None,
    status: Optional[str] = None,
) -> List[Sale]:
    q = db.query(Sale)
    if staff_id:
        q = q.filter(Sale.staff_id == staff_id)
    if status:
        q = q.filter(Sale.status == status)
    return q.order_by(Sale.sale_date.desc()).offset(skip).limit(limit).all()


def create_sale(db: Session, obj_in: SaleCreate) -> Sale:
    db_sale = Sale(**obj_in.model_dump())
    db.add(db_sale)
    db.flush()  # get sale_id before commit

    if obj_in.status == "Completed":
        # Update vehicle status
        vehicle = db.query(Vehicle).filter(Vehicle.vehicle_id == obj_in.vehicle_id).first()
        if vehicle:
            vehicle.status = "Sold"

        # Auto-create commission at 2.5%
        rate = Decimal("2.50")
        commission_amt = (obj_in.sale_price - obj_in.discount) * rate / 100
        commission = Commission(
            staff_id=obj_in.staff_id,
            sale_id=db_sale.sale_id,
            rate_percent=rate,
            commission_amt=commission_amt,
        )
        db.add(commission)

    db.commit()
    db.refresh(db_sale)
    return db_sale


def update_sale(db: Session, sale_id: int, obj_in: SaleUpdate) -> Optional[Sale]:
    sale = get_sale(db, sale_id)
    if not sale:
        return None
    data = obj_in.model_dump(exclude_unset=True)

    # Handle status change to Completed
    if data.get("status") == "Completed" and sale.status != "Completed":
        vehicle = db.query(Vehicle).filter(Vehicle.vehicle_id == sale.vehicle_id).first()
        if vehicle:
            vehicle.status = "Sold"
        if not sale.commission:
            rate = Decimal("2.50")
            commission_amt = (sale.sale_price - sale.discount) * rate / 100
            commission = Commission(
                staff_id=sale.staff_id,
                sale_id=sale.sale_id,
                rate_percent=rate,
                commission_amt=commission_amt,
            )
            db.add(commission)

    for field, value in data.items():
        setattr(sale, field, value)
    db.commit()
    db.refresh(sale)
    return sale


def get_sale_stats(db: Session) -> dict:
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    total = db.query(func.count(Sale.sale_id)).scalar() or 0
    completed = db.query(func.count(Sale.sale_id)).filter(Sale.status == "Completed").scalar() or 0
    total_rev = db.query(func.sum(Sale.sale_price - Sale.discount)).filter(Sale.status == "Completed").scalar() or Decimal("0")
    month_rev = db.query(func.sum(Sale.sale_price - Sale.discount)).filter(
        Sale.status == "Completed", Sale.sale_date >= month_start
    ).scalar() or Decimal("0")
    return {
        "total_sales": total,
        "completed_sales": completed,
        "total_revenue": total_rev,
        "this_month_revenue": month_rev,
    }
