from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user, require_role
from app.crud.crud_commission import (
    get_commission, get_commissions, update_commission, get_commission_summary
)
from app.schemas.commission import CommissionUpdate, CommissionResponse, CommissionSummary

router = APIRouter(prefix="/commissions", tags=["commissions"])

MANAGER_ONLY = require_role(["manager"])


@router.get("/summary", response_model=List[CommissionSummary])
async def commission_summary(db: Session = Depends(get_db), _=Depends(MANAGER_ONLY)):
    return get_commission_summary(db)


@router.get("/", response_model=List[CommissionResponse])
async def list_commissions(
    skip: int = 0,
    limit: int = 20,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    staff_id = None if current_user.role == "manager" else current_user.user_id
    return get_commissions(db, skip=skip, limit=limit, staff_id=staff_id, status=status)


@router.get("/{commission_id}", response_model=CommissionResponse)
async def get_commission_detail(
    commission_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    c = get_commission(db, commission_id)
    if not c:
        raise HTTPException(status_code=404, detail="Commission not found")
    if current_user.role == "sales_executive" and c.staff_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    return c


@router.put("/{commission_id}", response_model=CommissionResponse)
async def update_commission_status(
    commission_id: int,
    commission_in: CommissionUpdate,
    db: Session = Depends(get_db),
    _=Depends(MANAGER_ONLY),
):
    c = update_commission(db, commission_id, commission_in)
    if not c:
        raise HTTPException(status_code=404, detail="Commission not found")
    return c
