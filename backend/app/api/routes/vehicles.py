from decimal import Decimal
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_role
from app.crud.crud_vehicle import (
    get_vehicle, get_vehicles, get_available_vehicles,
    create_vehicle, update_vehicle, delete_vehicle,
)
from app.schemas.vehicle import VehicleCreate, VehicleUpdate, VehicleResponse

router = APIRouter(prefix="/vehicles", tags=["vehicles"])

ALL_ROLES = require_role(["manager", "sales_executive", "technician", "receptionist"])
MANAGER_SALES = require_role(["manager", "sales_executive"])
MANAGER_ONLY = require_role(["manager"])


@router.get("/available", response_model=List[VehicleResponse])
async def list_available_vehicles(db: Session = Depends(get_db), _=Depends(ALL_ROLES)):
    return get_available_vehicles(db)


@router.get("/", response_model=List[VehicleResponse])
async def list_vehicles(
    skip: int = 0,
    limit: int = 20,
    status: Optional[str] = None,
    make: Optional[str] = None,
    year: Optional[int] = None,
    price_min: Optional[Decimal] = None,
    price_max: Optional[Decimal] = None,
    condition_type: Optional[str] = None,
    db: Session = Depends(get_db),
    _=Depends(ALL_ROLES),
):
    return get_vehicles(db, skip=skip, limit=limit, status=status, make=make,
                        year=year, price_min=price_min, price_max=price_max,
                        condition_type=condition_type)


@router.get("/{vehicle_id}", response_model=VehicleResponse)
async def get_vehicle_detail(vehicle_id: int, db: Session = Depends(get_db), _=Depends(ALL_ROLES)):
    v = get_vehicle(db, vehicle_id)
    if not v:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return v


@router.post("/", response_model=VehicleResponse, status_code=status.HTTP_201_CREATED)
async def create_new_vehicle(
    vehicle_in: VehicleCreate,
    db: Session = Depends(get_db),
    _=Depends(MANAGER_SALES),
):
    return create_vehicle(db, vehicle_in)


@router.put("/{vehicle_id}", response_model=VehicleResponse)
async def update_vehicle_detail(
    vehicle_id: int,
    vehicle_in: VehicleUpdate,
    db: Session = Depends(get_db),
    _=Depends(MANAGER_SALES),
):
    v = update_vehicle(db, vehicle_id, vehicle_in)
    if not v:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return v


@router.delete("/{vehicle_id}", response_model=VehicleResponse)
async def delete_vehicle_by_id(
    vehicle_id: int,
    db: Session = Depends(get_db),
    _=Depends(MANAGER_ONLY),
):
    v = delete_vehicle(db, vehicle_id)
    if not v:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return v
