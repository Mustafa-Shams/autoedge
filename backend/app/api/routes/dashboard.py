from decimal import Decimal
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, extract

from app.api.deps import get_db, require_role, get_current_user
from app.models.vehicle import Vehicle
from app.models.sale import Sale
from app.models.service_job import ServiceJob
from app.models.commission import Commission
from app.models.user import User
from app.models.reservation import Reservation
from app.models.test_drive import TestDrive
from app.models.enquiry import Enquiry
from app.models.restock_request import RestockRequest

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

MANAGER_ONLY = require_role(["manager"])


@router.get("/stats")
async def dashboard_stats(
    db: Session = Depends(get_db),
    current_user=Depends(MANAGER_ONLY),
):
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

    # ── P46 storefront additions per spec 10.4 / 11.5 ──

    # Active reservations count
    active_reservations = db.query(func.count(Reservation.reservation_id)).filter(
        Reservation.status == "Active"
    ).scalar() or 0

    # Pending test drive requests (Requested status = online requests awaiting staff action)
    pending_test_drive_requests = db.query(func.count(TestDrive.test_drive_id)).filter(
        TestDrive.status == "Requested"
    ).scalar() or 0

    # Open enquiries (only shown if caller has enquiry access — manager always does)
    open_enquiries = db.query(func.count(Enquiry.enquiry_id)).filter(
        Enquiry.status == "Open"
    ).scalar() or 0

    # Out-of-stock vehicles that have at least one open restock request
    out_of_stock_with_requests = (
        db.query(func.count(func.distinct(Vehicle.vehicle_id)))
        .join(RestockRequest, RestockRequest.vehicle_id == Vehicle.vehicle_id)
        .filter(
            Vehicle.stock_quantity == 0,
            RestockRequest.status == "Open",
        )
        .scalar() or 0
    )

    return {
        "total_vehicles": total_vehicles,
        "available_vehicles": available_vehicles,
        "sold_this_month": sold_this_month,
        "total_revenue_this_month": str(total_revenue_this_month),
        "pending_service_jobs": pending_service_jobs,
        # P46 additions
        "active_reservations": active_reservations,
        "pending_test_drive_requests": pending_test_drive_requests,
        "open_enquiries": open_enquiries,
        "out_of_stock_with_requests": out_of_stock_with_requests,
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
