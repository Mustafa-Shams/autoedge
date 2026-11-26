from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_role
from app.models.customer import Customer
from app.models.user import User
from app.models.vehicle import Vehicle
from app.crud.crud_service import (
    get_service_job, get_service_jobs, create_service_job, update_service_job,
    add_part, get_parts, delete_part,
)
from app.services.service_booking_service import ServiceBookingError
from app.schemas.service import (
    ServiceJobCreate, ServiceJobUpdate, ServiceJobResponse,
    ServicePartCreate, ServicePartResponse,
)

router = APIRouter(prefix="/service", tags=["service"])

ALLOWED = require_role(["manager", "technician", "receptionist"])
TECH_MANAGER = require_role(["manager", "technician"])


@router.get("/", response_model=List[ServiceJobResponse])
async def list_service_jobs(
    skip: int = 0,
    limit: int = 20,
    status: Optional[str] = None,
    technician_id: Optional[int] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    db: Session = Depends(get_db),
    _=Depends(ALLOWED),
):
    return get_service_jobs(db, skip=skip, limit=limit, status=status,
                            technician_id=technician_id, date_from=date_from, date_to=date_to)


@router.post("/", response_model=ServiceJobResponse, status_code=status.HTTP_201_CREATED)
async def create_job(
    job_in: ServiceJobCreate,
    db: Session = Depends(get_db),
    _=Depends(ALLOWED),
):
    return create_service_job(db, job_in)


@router.get("/form-options")
def get_form_options(db: Session = Depends(get_db), _=Depends(ALLOWED)):
    vehicles = db.query(Vehicle.vehicle_id, Vehicle.year, Vehicle.make, Vehicle.model).order_by(
        Vehicle.make, Vehicle.model, Vehicle.year, Vehicle.vehicle_id
    )
    customers = db.query(Customer.customer_id, Customer.full_name).order_by(Customer.full_name, Customer.customer_id)
    technicians = db.query(User.user_id, User.full_name).filter(
        User.role == "technician", User.is_active.is_(True),
    ).order_by(User.full_name)
    return {
        "vehicles": [row._asdict() for row in vehicles],
        "customers": [row._asdict() for row in customers],
        "technicians": [row._asdict() for row in technicians],
    }


@router.get("/{job_id}", response_model=ServiceJobResponse)
async def get_job_detail(job_id: int, db: Session = Depends(get_db), _=Depends(ALLOWED)):
    job = get_service_job(db, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Service job not found")
    return job


@router.put("/{job_id}", response_model=ServiceJobResponse)
async def update_job(
    job_id: int,
    job_in: ServiceJobUpdate,
    db: Session = Depends(get_db),
    _=Depends(TECH_MANAGER),
):
    try:
        job = update_service_job(db, job_id, job_in)
    except ServiceBookingError as exc:
        db.rollback()
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    if not job:
        raise HTTPException(status_code=404, detail="Service job not found")
    return job


@router.post("/{job_id}/parts", response_model=ServicePartResponse, status_code=status.HTTP_201_CREATED)
async def add_part_to_job(
    job_id: int,
    part_in: ServicePartCreate,
    db: Session = Depends(get_db),
    _=Depends(TECH_MANAGER),
):
    job = get_service_job(db, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Service job not found")
    return add_part(db, job_id, part_in)


@router.get("/{job_id}/parts", response_model=List[ServicePartResponse])
async def list_parts(job_id: int, db: Session = Depends(get_db), _=Depends(ALLOWED)):
    return get_parts(db, job_id)


@router.delete("/{job_id}/parts/{part_id}", response_model=ServicePartResponse)
async def remove_part(
    job_id: int,
    part_id: int,
    db: Session = Depends(get_db),
    _=Depends(TECH_MANAGER),
):
    part = delete_part(db, job_id, part_id)
    if not part:
        raise HTTPException(status_code=404, detail="Part not found")
    return part
