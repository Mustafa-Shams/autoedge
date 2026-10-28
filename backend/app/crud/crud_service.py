from datetime import date
from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.service_job import ServiceJob
from app.models.service_part import ServicePart
from app.models.vehicle import Vehicle
from app.models.customer import Customer
from app.models.user import User
from app.schemas.service import ServiceJobCreate, ServiceJobUpdate, ServicePartCreate


def _enrich(job: ServiceJob, db: Session) -> ServiceJob:
    """Attach human-readable display fields."""
    v = db.query(Vehicle).filter(Vehicle.vehicle_id == job.vehicle_id).first()
    c = db.query(Customer).filter(Customer.customer_id == job.customer_id).first()
    job.vehicle_info = f"{v.year} {v.make} {v.model}" if v else None
    job.customer_name = c.full_name if c else None
    if job.technician_id:
        t = db.query(User).filter(User.user_id == job.technician_id).first()
        job.technician_name = t.full_name if t else None
    else:
        job.technician_name = None
    return job


def get_service_job(db: Session, job_id: int) -> Optional[ServiceJob]:
    job = db.query(ServiceJob).filter(ServiceJob.job_id == job_id).first()
    if job:
        _enrich(job, db)
    return job


def get_service_jobs(
    db: Session,
    skip: int = 0,
    limit: int = 20,
    status: Optional[str] = None,
    technician_id: Optional[int] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
) -> List[ServiceJob]:
    q = db.query(ServiceJob)
    if status:
        q = q.filter(ServiceJob.status == status)
    if technician_id:
        q = q.filter(ServiceJob.technician_id == technician_id)
    if date_from:
        q = q.filter(ServiceJob.job_date >= date_from)
    if date_to:
        q = q.filter(ServiceJob.job_date <= date_to)
    jobs = q.order_by(ServiceJob.created_at.desc()).offset(skip).limit(limit).all()
    for job in jobs:
        _enrich(job, db)
    return jobs


def create_service_job(db: Session, obj_in: ServiceJobCreate) -> ServiceJob:
    job = ServiceJob(**obj_in.model_dump())
    db.add(job)
    db.commit()
    db.refresh(job)
    _enrich(job, db)
    return job


def update_service_job(db: Session, job_id: int, obj_in: ServiceJobUpdate) -> Optional[ServiceJob]:
    job = db.query(ServiceJob).filter(ServiceJob.job_id == job_id).first()
    if not job:
        return None
    data = obj_in.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(job, field, value)
    db.commit()
    db.refresh(job)
    _enrich(job, db)
    return job


def add_part(db: Session, job_id: int, obj_in: ServicePartCreate) -> ServicePart:
    part = ServicePart(job_id=job_id, **obj_in.model_dump())
    db.add(part)
    db.commit()
    db.refresh(part)
    return part


def get_parts(db: Session, job_id: int) -> List[ServicePart]:
    return db.query(ServicePart).filter(ServicePart.job_id == job_id).all()


def delete_part(db: Session, job_id: int, part_id: int) -> Optional[ServicePart]:
    part = db.query(ServicePart).filter(
        ServicePart.part_id == part_id,
        ServicePart.job_id == job_id,
    ).first()
    if not part:
        return None
    db.delete(part)
    db.commit()
    return part
