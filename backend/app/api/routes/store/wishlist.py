"""Wishlist routes — GET/POST/DELETE per spec 10.3.

GET    /store/wishlist              — list all wishlist items with vehicle info
POST   /store/wishlist/{vehicle_id} — add vehicle to wishlist
DELETE /store/wishlist/{vehicle_id} — remove vehicle from wishlist
"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_customer, get_db
from app.models.customer import Customer
from app.models.vehicle import Vehicle
from app.models.wishlist_item import WishlistItem
from app.schemas.store_schemas import WishlistItemResponse

router = APIRouter(prefix="/store/wishlist", tags=["store-wishlist"])


def _vehicle_availability(stock_quantity: int) -> str:
    return "in_stock" if stock_quantity > 0 else "out_of_stock"


@router.get("", response_model=List[WishlistItemResponse])
async def get_wishlist(
    customer: Customer = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    """List all wishlist items for the current customer."""
    items = (
        db.query(WishlistItem)
        .filter(WishlistItem.customer_id == customer.customer_id)
        .order_by(WishlistItem.added_at.desc())
        .all()
    )

    result = []
    for item in items:
        vehicle = db.query(Vehicle).filter(
            Vehicle.vehicle_id == item.vehicle_id
        ).first()
        if not vehicle:
            continue  # Skip if vehicle was deleted

        result.append(WishlistItemResponse(
            vehicle_id=vehicle.vehicle_id,
            make=vehicle.make,
            model=vehicle.model,
            year=vehicle.year,
            price=vehicle.price,
            main_image_url=vehicle.main_image_url,
            fuel_type=vehicle.fuel_type,
            transmission=vehicle.transmission,
            body_type=vehicle.body_type,
            stock_quantity=vehicle.stock_quantity,
            availability=_vehicle_availability(vehicle.stock_quantity),
            added_at=item.added_at,
        ))

    return result


@router.post("/{vehicle_id}", status_code=201)
async def add_to_wishlist(
    vehicle_id: int,
    customer: Customer = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    """Add a vehicle to the customer's wishlist."""
    # Verify vehicle exists and is published
    vehicle = db.query(Vehicle).filter(
        Vehicle.vehicle_id == vehicle_id,
        Vehicle.is_published == True,
    ).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    # Check if already in wishlist
    existing = db.query(WishlistItem).filter(
        WishlistItem.customer_id == customer.customer_id,
        WishlistItem.vehicle_id == vehicle_id,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Vehicle already in wishlist")

    item = WishlistItem(
        customer_id=customer.customer_id,
        vehicle_id=vehicle_id,
    )
    db.add(item)
    db.commit()

    return {"message": "Added to wishlist", "vehicle_id": vehicle_id}


@router.delete("/{vehicle_id}", status_code=200)
async def remove_from_wishlist(
    vehicle_id: int,
    customer: Customer = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    """Remove a vehicle from the customer's wishlist."""
    item = db.query(WishlistItem).filter(
        WishlistItem.customer_id == customer.customer_id,
        WishlistItem.vehicle_id == vehicle_id,
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Vehicle not in wishlist")

    db.delete(item)
    db.commit()

    return {"message": "Removed from wishlist", "vehicle_id": vehicle_id}
