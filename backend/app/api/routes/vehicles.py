"""Vehicle routes — extended for P46 storefront integration.

Spec 10.4: PUT /vehicles/{id} now accepts stock_quantity, description,
main_image_url, engine, horsepower, seats, drivetrain, is_published.
Manual stock edits write a stock_movements row (handled in crud_vehicle).

Decision #23: Added PUT /vehicles/{id}/images/bulk for atomic image replacement.
GET /vehicles/{id} now returns images[] in the response.
"""
from decimal import Decimal
from typing import List, Literal, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_role
from app.crud.crud_vehicle import (
    get_vehicle, get_vehicle_page, get_available_vehicles,
    create_vehicle, update_vehicle, delete_vehicle,
)
from app.schemas.vehicle import (
    VehicleCreate, VehicleUpdate, VehicleResponse,
    BulkImageRequest, VehicleImageResponse,
)
from app.models.vehicle import Vehicle
from app.models.vehicle_image import VehicleImage

router = APIRouter(prefix="/vehicles", tags=["vehicles"])

ALL_ROLES = require_role(["manager", "sales_executive", "technician", "receptionist"])
MANAGER_SALES = require_role(["manager", "sales_executive"])
MANAGER_ONLY = require_role(["manager"])


@router.get("/available", response_model=List[VehicleResponse])
async def list_available_vehicles(db: Session = Depends(get_db), _=Depends(ALL_ROLES)):
    return get_available_vehicles(db)


@router.get("/")
async def list_vehicles(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    status: Optional[str] = None,
    make: Optional[str] = None,
    year: Optional[int] = None,
    price_min: Optional[Decimal] = None,
    price_max: Optional[Decimal] = None,
    condition_type: Optional[str] = None,
    search: Optional[str] = Query(None, max_length=200),
    sort: Literal["vehicle_id", "make", "model", "year", "color", "condition_type",
                  "price", "stock_quantity", "status", "is_published"] = "vehicle_id",
    direction: Literal["asc", "desc"] = "asc",
    db: Session = Depends(get_db),
    _=Depends(ALL_ROLES),
):
    filter_kw = dict(status=status, make=make, year=year,
                     price_min=price_min, price_max=price_max,
                     condition_type=condition_type, search=search)
    items, total = get_vehicle_page(db, skip, limit, sort, direction, **filter_kw)
    return {
        "items": [
            VehicleResponse.model_validate(vehicle).model_copy(update={"active_reservation_count": count})
            for vehicle, count in items
        ],
        "total": total,
        "skip": skip,
        "limit": limit,
    }


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
    current_user=Depends(MANAGER_SALES),
):
    v = update_vehicle(db, vehicle_id, vehicle_in, current_user_id=current_user.user_id)
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


# ── Vehicle image management (spec 10.4, Decision #23) ───────────────

@router.put("/{vehicle_id}/images/bulk", response_model=VehicleResponse)
async def bulk_replace_images(
    vehicle_id: int,
    body: BulkImageRequest,
    db: Session = Depends(get_db),
    _=Depends(MANAGER_SALES),
):
    """Atomically replace all images for a vehicle.

    Sets main_image_url on the vehicle, deletes all existing VehicleImage
    rows, and inserts new ones with correct sort_order. Transactional —
    failure cannot leave the vehicle half-saved.
    """
    v = db.query(Vehicle).filter(Vehicle.vehicle_id == vehicle_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    # Update main_image_url on the vehicle row
    v.main_image_url = body.main_image_url

    # Delete all existing additional images
    db.query(VehicleImage).filter(VehicleImage.vehicle_id == vehicle_id).delete()

    # Insert new images with explicit sort_order
    for i, img in enumerate(body.images):
        db.add(VehicleImage(
            vehicle_id=vehicle_id,
            image_url=img.image_url,
            sort_order=img.sort_order if img.sort_order else i + 1,
            credit=img.credit,
            source_url=img.source_url,
        ))

    db.commit()
    db.refresh(v)
    return v


@router.post("/{vehicle_id}/images", status_code=status.HTTP_201_CREATED)
async def add_vehicle_image(
    vehicle_id: int,
    body: dict,
    db: Session = Depends(get_db),
    _=Depends(MANAGER_SALES),
):
    """Add an image to a vehicle. Body: {image_url, sort_order?, credit?, source_url?}"""
    v = get_vehicle(db, vehicle_id)
    if not v:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    image = VehicleImage(
        vehicle_id=vehicle_id,
        image_url=body["image_url"],
        sort_order=body.get("sort_order", 0),
        credit=body.get("credit"),
        source_url=body.get("source_url"),
    )
    db.add(image)
    db.commit()
    db.refresh(image)
    return {
        "image_id": image.image_id,
        "vehicle_id": image.vehicle_id,
        "image_url": image.image_url,
        "sort_order": image.sort_order,
        "credit": image.credit,
        "source_url": image.source_url,
    }


@router.delete("/{vehicle_id}/images/{image_id}")
async def delete_vehicle_image(
    vehicle_id: int,
    image_id: int,
    db: Session = Depends(get_db),
    _=Depends(MANAGER_SALES),
):
    """Delete a vehicle image."""
    image = db.query(VehicleImage).filter(
        VehicleImage.image_id == image_id,
        VehicleImage.vehicle_id == vehicle_id,
    ).first()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")
    db.delete(image)
    db.commit()
    return {"detail": "Image deleted"}
