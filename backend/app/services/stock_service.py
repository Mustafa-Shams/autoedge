"""Stock service — row-locked stock changes with movement ledger.

Every stock change writes a stock_movements row.
When stock rises from 0, notifies restock requesters.
"""
from typing import Optional

from sqlalchemy.orm import Session

from app.core.time import utcnow
from app.models.vehicle import Vehicle
from app.models.stock_movement import StockMovement
from app.models.restock_request import RestockRequest
from app.services.notify_service import notify


def get_vehicle_for_update(db: Session, vehicle_id: int) -> Optional[Vehicle]:
    """Get vehicle with row lock (FOR UPDATE). Lock this FIRST per Article XIII."""
    return (
        db.query(Vehicle)
        .filter(Vehicle.vehicle_id == vehicle_id)
        .with_for_update()
        .first()
    )


def change_stock(
    db: Session,
    vehicle_id: int,
    qty_change: int,
    reason: str,
    reference_id: Optional[int] = None,
    created_by: Optional[int] = None,
) -> Vehicle:
    """Change vehicle stock quantity and write a stock_movements row.

    If stock rises from 0 to above 0, notifies all customers with Open restock
    requests for this vehicle (in request order).

    Must be called inside a transaction with the vehicle row already locked.
    """
    vehicle = get_vehicle_for_update(db, vehicle_id)
    if vehicle is None:
        raise ValueError(f"Vehicle {vehicle_id} not found")

    old_stock = vehicle.stock_quantity
    new_stock = old_stock + qty_change

    if new_stock < 0:
        raise ValueError(f"Stock cannot go below zero (current={old_stock}, change={qty_change})")

    vehicle.stock_quantity = new_stock

    # Write stock movement ledger entry
    movement = StockMovement(
        vehicle_id=vehicle_id,
        change_qty=qty_change,
        reason=reason,
        reference_id=reference_id,
        created_by=created_by,
    )
    db.add(movement)
    db.flush()

    # If stock rises from 0 to above 0, notify restock requesters
    if old_stock == 0 and new_stock > 0:
        _notify_restock_requesters(db, vehicle)

    return vehicle


def _notify_restock_requesters(db: Session, vehicle: Vehicle) -> None:
    """Notify all customers with Open restock requests for this vehicle.

    Mark requests as Fulfilled and send notifications in request order.
    """
    open_requests = (
        db.query(RestockRequest)
        .filter(
            RestockRequest.vehicle_id == vehicle.vehicle_id,
            RestockRequest.status == "Open",
        )
        .order_by(RestockRequest.created_at.asc())
        .all()
    )

    now = utcnow()
    vehicle_label = f"{vehicle.year} {vehicle.make} {vehicle.model}"

    for req in open_requests:
        # Mark request as fulfilled
        req.status = "Fulfilled"
        req.fulfilled_at = now

        # Create notification + email for the customer
        notify(
            db,
            customer_id=req.customer_id,
            notification_type="restock_available",
            title=f"{vehicle_label} is back in stock!",
            message=f"Great news! The {vehicle_label} you requested is now available. "
                    f"There are {vehicle.stock_quantity} unit(s) in stock.",
            link_path=f"/cars/{vehicle.vehicle_id}",
            vehicle_label=vehicle_label,
            vehicle_id=vehicle.vehicle_id,
        )

    db.flush()
