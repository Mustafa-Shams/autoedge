from typing import List, Optional
from datetime import date
from sqlalchemy.orm import Session
from app.models.service_job import ServiceJob
from app.models.service_part import ServicePart
from app.schemas.service import ServiceJobCreate, ServiceJobUpdate, ServicePartCreate


def get_service_job(db: Session, job_id: int) -> Optional[ServiceJob]:
    return db.query(ServiceJob).filter(ServiceJob.job_id == job_id).first()


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
    return q.order_by(ServiceJob.created_at.desc()).offset(skip).limit(limit).all()


def create_service_job(db: Session, obj_in: ServiceJobCreate) -> ServiceJob:
    db_job = ServiceJob(**obj_in.model_dump())
    db.add(db_job)
    db.commit()
    db.refresh(db_job)
    return db_job


def update_service_job(db: Session, job_id: int, obj_in: ServiceJobUpdate) -> Optional[ServiceJob]:
    job = get_service_job(db, job_id)
    if not job:
        return None
    for field, value in obj_in.model_dump(exclude_unset=True).items():
        setattr(job, field, value)
    db.commit()
    db.refresh(job)
    return job


def add_part(db: Session, job_id: int, obj_in: ServicePartCreate) -> ServicePart:
    db_part = ServicePart(job_id=job_id, **obj_in.model_dump())
    db.add(db_part)
    db.commit()
    db.refresh(db_part)
    return db_part


def get_parts(db: Session, job_id: int) -> List[ServicePart]:
    return db.query(ServicePart).filter(ServicePart.job_id == job_id).all()


def delete_part(db: Session, job_id: int, part_id: int) -> Optional[ServicePart]:
    part = db.query(ServicePart).filter(
        ServicePart.part_id == part_id, ServicePart.job_id == job_id
    ).first()
    if not part:
        return None
    db.delete(part)
    db.commit()
    return part
