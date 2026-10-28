from decimal import Decimal
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, extract

from app.api.deps import get_db, require_role
from app.models.vehicle import Vehicle
from app.models.sale import Sale
from app.models.service_job import ServiceJob
from app.models.commission import Commission
from app.models.user import User

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

MANAGER_ONLY = require_role(["manager"])


@router.get("/stats")
async def dashboard_stats(db: Session = Depends(get_db), _=Depends(MANAGER_ONLY)):
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    total_vehicles = db.query(func.count(Vehicle.vehicle_id)).scalar() or 0
    available_vehicles = db.query(func.count(Vehicle.vehicle_id)).filter(Vehicle.status == "Available").scalar() or 0
    sold_this_month = db.query(func.count(Sale.sale_id)).filter(
        Sale.status == "Completed", Sale.sale_date >= month_start
    ).scalar() or 0
    total_revenue_this_month = db.query(func.sum(Sale.sale_price - Sale.discount)).filter(
        Sale.status == "Completed", Sale.sale_date >= month_start
    ).scalar() or Decimal("0")
    pending_service_jobs = db.query(func.count(ServiceJob.job_id)).filter(
        ServiceJob.status.in_(["Pending", "In Progress"])
    ).scalar() or 0

    return {
        "total_vehicles": total_vehicles,
        "available_vehicles": available_vehicles,
        "sold_this_month": sold_this_month,
        "total_revenue_this_month": str(total_revenue_this_month),
        "pending_service_jobs": pending_service_jobs,
    }


@router.get("/monthly")
async def monthly_revenue(db: Session = Depends(get_db), _=Depends(MANAGER_ONLY)):
    rows = (
        db.query(
            extract("year", Sale.sale_date).label("year"),
            extract("month", Sale.sale_date).label("month"),
            func.sum(Sale.sale_price - Sale.discount).label("revenue"),
        )
        .filter(Sale.status == "Completed")
        .group_by("year", "month")
        .order_by("year", "month")
        .limit(12)
        .all()
    )
    months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
    return [
        {"month": months[int(r.month) - 1], "year": int(r.year), "revenue": float(r.revenue or 0)}
        for r in rows
    ]


@router.get("/top-staff")
async def top_staff(db: Session = Depends(get_db), _=Depends(MANAGER_ONLY)):
    rows = (
        db.query(
            User.user_id,
            User.full_name,
            func.count(Sale.sale_id).label("total_sales"),
            func.sum(Commission.commission_amt).label("total_commission"),
        )
        .join(Sale, Sale.staff_id == User.user_id)
        .outerjoin(Commission, Commission.staff_id == User.user_id)
        .filter(Sale.status == "Completed")
        .group_by(User.user_id, User.full_name)
        .order_by(func.sum(Commission.commission_amt).desc())
        .limit(5)
        .all()
    )
    return [
        {
            "staff_id": r.user_id,
            "staff_name": r.full_name,
            "total_sales": r.total_sales,
            "total_commission": float(r.total_commission or 0),
        }
        for r in rows
    ]
