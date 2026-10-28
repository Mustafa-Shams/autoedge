from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_role
from app.crud.crud_customer import get_customer, get_customers, create_customer, update_customer
from app.schemas.customer import CustomerCreate, CustomerUpdate, CustomerResponse
from app.models.test_drive import TestDrive
from app.models.sale import Sale
from app.models.service_job import ServiceJob

router = APIRouter(prefix="/customers", tags=["customers"])

ALLOWED = require_role(["manager", "sales_executive", "receptionist"])


@router.get("/", response_model=List[CustomerResponse])
async def list_customers(
    skip: int = 0,
    limit: int = 20,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    _=Depends(ALLOWED),
):
    return get_customers(db, skip=skip, limit=limit, search=search)


@router.post("/", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED)
async def create_new_customer(
    customer_in: CustomerCreate,
    db: Session = Depends(get_db),
    _=Depends(ALLOWED),
):
    return create_customer(db, customer_in)


@router.get("/{customer_id}", response_model=CustomerResponse)
async def get_customer_detail(customer_id: int, db: Session = Depends(get_db), _=Depends(ALLOWED)):
    c = get_customer(db, customer_id)
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")
    return c


@router.put("/{customer_id}", response_model=CustomerResponse)
async def update_customer_detail(
    customer_id: int,
    customer_in: CustomerUpdate,
    db: Session = Depends(get_db),
    _=Depends(ALLOWED),
):
    c = update_customer(db, customer_id, customer_in)
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")
    return c


@router.get("/{customer_id}/history")
async def get_customer_history(
    customer_id: int,
    db: Session = Depends(get_db),
    _=Depends(ALLOWED),
):
    c = get_customer(db, customer_id)
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")
    test_drives = db.query(TestDrive).filter(TestDrive.customer_id == customer_id).all()
    sales = db.query(Sale).filter(Sale.customer_id == customer_id).all()
    service_jobs = db.query(ServiceJob).filter(ServiceJob.customer_id == customer_id).all()
    return {
        "customer_id": customer_id,
        "test_drives": [{"test_drive_id": t.test_drive_id, "status": t.status, "scheduled_date": str(t.scheduled_date)} for t in test_drives],
        "sales": [{"sale_id": s.sale_id, "status": s.status, "sale_price": str(s.sale_price)} for s in sales],
        "service_jobs": [{"job_id": j.job_id, "status": j.status, "job_type": j.job_type} for j in service_jobs],
    }
