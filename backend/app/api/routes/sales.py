from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user, require_role
from app.crud.crud_sale import get_sale, get_sales, create_sale, update_sale, get_sale_stats
from app.schemas.sale import SaleCreate, SaleUpdate, SaleResponse, SaleStats

router = APIRouter(prefix="/sales", tags=["sales"])

MANAGER_ONLY = require_role(["manager"])
MANAGER_SALES = require_role(["manager", "sales_executive"])


@router.get("/stats", response_model=SaleStats)
async def sales_stats(db: Session = Depends(get_db), _=Depends(MANAGER_ONLY)):
    return get_sale_stats(db)


@router.get("/", response_model=List[SaleResponse])
async def list_sales(
    skip: int = 0,
    limit: int = 20,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    staff_id = None if current_user.role == "manager" else current_user.user_id
    return get_sales(db, skip=skip, limit=limit, staff_id=staff_id, status=status)


@router.post("/", response_model=SaleResponse, status_code=status.HTTP_201_CREATED)
async def record_sale(
    sale_in: SaleCreate,
    db: Session = Depends(get_db),
    _=Depends(MANAGER_SALES),
):
    return create_sale(db, sale_in)


@router.get("/{sale_id}", response_model=SaleResponse)
async def get_sale_detail(
    sale_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    sale = get_sale(db, sale_id)
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    if current_user.role == "sales_executive" and sale.staff_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    return sale


@router.put("/{sale_id}", response_model=SaleResponse)
async def update_sale_detail(
    sale_id: int,
    sale_in: SaleUpdate,
    db: Session = Depends(get_db),
    _=Depends(MANAGER_SALES),
):
    sale = update_sale(db, sale_id, sale_in)
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    return sale
