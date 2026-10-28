from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_role
from app.crud.crud_service import (
    get_service_job, get_service_jobs, create_service_job, update_service_job,
    add_part, get_parts, delete_part,
)
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
    job = update_service_job(db, job_id, job_in)
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
