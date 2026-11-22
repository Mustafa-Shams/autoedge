"""CRUD operations for sales — extended for storefront (spec 7.2).

When a sale becomes Completed:
- If reservation_id: convert reservation (Active → Converted), set deposit_credit,
  do NOT decrement stock again (already decremented on reserve).
- Else: lock vehicle, check stock ≥ 1, decrement stock, write stock_movement (Sale).
- If trade_in_id: set trade_in_credit, mark trade-in Completed.
- Create customer_vehicle so car appears in the customer's garage.
- Commission creation stays as in v1.0.
- Balance due = sale_price - discount - deposit_credit - trade_in_credit.
"""
from decimal import Decimal
from typing import List, Optional
from datetime import datetime, timezone

from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.time import utcnow
from app.models.sale import Sale
from app.models.vehicle import Vehicle
from app.models.customer import Customer
from app.models.customer_vehicle import CustomerVehicle
from app.models.user import User
from app.models.commission import Commission
from app.models.reservation import Reservation
from app.models.stock_movement import StockMovement
from app.models.trade_in_request import TradeInRequest
from app.models.notification import Notification
from app.schemas.sale import SaleCreate, SaleUpdate
from app.services.notify_service import notify
from app.services.stock_service import get_vehicle_for_update, sync_vehicle_status


def _enrich(sale: Sale, db: Session) -> Sale:
    """Attach human-readable display fields onto the ORM object."""
    v = db.query(Vehicle).filter(Vehicle.vehicle_id == sale.vehicle_id).first()
    c = db.query(Customer).filter(Customer.customer_id == sale.customer_id).first()
    s = db.query(User).filter(User.user_id == sale.staff_id).first()
    sale.vehicle_info = f"{v.year} {v.make} {v.model}" if v else None
    sale.customer_name = c.full_name if c else None
    sale.staff_name = s.full_name if s else None

    # Calculate balance due at showroom
    sale.balance_due_at_showroom = (
        sale.sale_price - sale.discount - sale.deposit_credit - sale.trade_in_credit
    )
    return sale


def get_sale(db: Session, sale_id: int) -> Optional[Sale]:
    sale = db.query(Sale).filter(Sale.sale_id == sale_id).first()
    if sale:
        _enrich(sale, db)
    return sale


def get_sales(
    db: Session,
    skip: int = 0,
    limit: int = 20,
    staff_id: Optional[int] = None,
    status: Optional[str] = None,
) -> List[Sale]:
    q = db.query(Sale)
    if staff_id:
        q = q.filter(Sale.staff_id == staff_id)
    if status:
        q = q.filter(Sale.status == status)
    sales = q.order_by(Sale.sale_date.desc()).offset(skip).limit(limit).all()
    for sale in sales:
        _enrich(sale, db)
    return sales


def _handle_completion(db: Session, sale: Sale, obj_in) -> None:
    """Handle all side effects when a sale transitions to Completed.

    Per spec 7.2:
    - If reservation_id: convert reservation, set deposit_credit, no stock decrement.
    - Else: lock vehicle, decrement stock, write stock_movement.
    - If trade_in_id: set trade_in_credit, mark trade-in Completed.
    - Create customer_vehicle (garage entry).
    - Create commission at 2.5%.
    - Create purchase_completed notification.
    """
    vehicle = get_vehicle_for_update(db, sale.vehicle_id)

    # ── Handle reservation linkage ──
    reservation_id = getattr(obj_in, 'reservation_id', None) or sale.reservation_id
    if reservation_id:
        reservation = (
            db.query(Reservation)
            .filter(Reservation.reservation_id == reservation_id)
            .with_for_update()
            .first()
        )
        if reservation is None:
            raise ValueError(f"Reservation {reservation_id} not found")
        if reservation.status != "Active":
            raise ValueError(f"Reservation {reservation_id} is not Active (status: {reservation.status})")
        if reservation.expires_at < utcnow():
            raise ValueError("Reservation has expired")
        if reservation.vehicle_id != sale.vehicle_id:
            raise ValueError("Reservation vehicle does not match sale vehicle")
        if reservation.customer_id != sale.customer_id:
            raise ValueError("Reservation customer does not match sale customer")

        # Convert reservation
        reservation.status = "Converted"
        reservation.closed_at = utcnow()
        db.flush()
        sync_vehicle_status(db, vehicle)

        # Set deposit credit on the sale
        sale.reservation_id = reservation_id
        sale.deposit_credit = reservation.deposit_amount

        # Stock is NOT decremented (already done on reserve)
    else:
        # No reservation — lock vehicle and decrement stock
        if vehicle:
            if vehicle.stock_quantity < 1:
                raise ValueError("Vehicle is out of stock")
            vehicle.stock_quantity -= 1
            sync_vehicle_status(db, vehicle)

            # Write stock movement
            movement = StockMovement(
                vehicle_id=vehicle.vehicle_id,
                change_qty=-1,
                reason="Sale",
                reference_id=sale.sale_id,
                created_by=sale.staff_id,
            )
            db.add(movement)

    # ── Handle trade-in linkage ──
    trade_in_id = getattr(obj_in, 'trade_in_id', None) or sale.trade_in_id
    if trade_in_id:
        trade_in = (
            db.query(TradeInRequest)
            .filter(TradeInRequest.trade_in_id == trade_in_id)
            .with_for_update()
            .first()
        )
        if trade_in is None:
            raise ValueError(f"Trade-in {trade_in_id} not found")
        if trade_in.status != "Accepted":
            raise ValueError(f"Trade-in {trade_in_id} is not Accepted (status: {trade_in.status})")
        if trade_in.customer_id != sale.customer_id:
            raise ValueError("Trade-in customer does not match sale customer")

        # Set trade-in credit
        sale.trade_in_id = trade_in_id
        sale.trade_in_credit = trade_in.offered_value or Decimal("0")

        # Mark trade-in completed
        trade_in.status = "Completed"
        trade_in.updated_at = utcnow()

    # ── Create customer_vehicle (garage entry) ──
    if vehicle:
        cv = CustomerVehicle(
            customer_id=sale.customer_id,
            make=vehicle.make,
            model=vehicle.model,
            year=vehicle.year,
            color=vehicle.color,
            vin_number=vehicle.vin_number,
            source_sale_id=sale.sale_id,
        )
        db.add(cv)

    # ── Auto-create commission at 2.5% ──
    existing_comm = db.query(Commission).filter(Commission.sale_id == sale.sale_id).first()
    if not existing_comm:
        rate = Decimal("2.50")
        commission_amt = (sale.sale_price - sale.discount) * rate / 100
        commission = Commission(
            staff_id=sale.staff_id,
            sale_id=sale.sale_id,
            rate_percent=rate,
            commission_amt=commission_amt,
        )
        db.add(commission)

    # ── Notification + email ──
    vehicle_label = f"{vehicle.year} {vehicle.make} {vehicle.model}" if vehicle else "your vehicle"
    notify(
        db,
        customer_id=sale.customer_id,
        notification_type="purchase_completed",
        title=f"Purchase Complete — {vehicle_label}",
        message=f"Congratulations! Your purchase of the {vehicle_label} is complete. "
                f"The car has been added to your garage.",
        link_path="/account/garage",
        vehicle_label=vehicle_label,
    )


def create_sale(db: Session, obj_in: SaleCreate) -> Sale:
    if obj_in.status == "Completed":
        get_vehicle_for_update(db, obj_in.vehicle_id)
    sale_data = obj_in.model_dump()
    db_sale = Sale(**sale_data)
    db.add(db_sale)
    db.flush()  # get sale_id before commit

    if obj_in.status == "Completed":
        _handle_completion(db, db_sale, obj_in)

    db.commit()
    db.refresh(db_sale)
    _enrich(db_sale, db)
    return db_sale


def update_sale(db: Session, sale_id: int, obj_in: SaleUpdate) -> Optional[Sale]:
    sale = db.query(Sale).filter_by(sale_id=sale_id).with_for_update().first()
    if not sale:
        return None
    data = obj_in.model_dump(exclude_unset=True)

    # Handle status transition to Completed
    if data.get("status") == "Completed" and sale.status != "Completed":
        # Apply the reservation/trade_in links from the update if provided
        if "reservation_id" in data and data["reservation_id"]:
            sale.reservation_id = data["reservation_id"]
        if "trade_in_id" in data and data["trade_in_id"]:
            sale.trade_in_id = data["trade_in_id"]

        for field, value in data.items():
            setattr(sale, field, value)

        _handle_completion(db, sale, obj_in)
    else:
        # Cancelling a Completed sale is NOT supported (spec 7.2)
        if sale.status == "Completed" and data.get("status") == "Cancelled":
            raise ValueError("Cannot cancel a Completed sale")

        for field, value in data.items():
            setattr(sale, field, value)

    db.commit()
    db.refresh(sale)
    _enrich(sale, db)
    return sale


def get_sale_stats(db: Session) -> dict:
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    total = db.query(func.count(Sale.sale_id)).scalar() or 0
    completed = db.query(func.count(Sale.sale_id)).filter(Sale.status == "Completed").scalar() or 0
    total_rev = db.query(func.sum(Sale.sale_price - Sale.discount)).filter(Sale.status == "Completed").scalar() or Decimal("0")
    month_rev = db.query(func.sum(Sale.sale_price - Sale.discount)).filter(
        Sale.status == "Completed", Sale.sale_date >= month_start
    ).scalar() or Decimal("0")
    return {
        "total_sales": total,
        "completed_sales": completed,
        "total_revenue": total_rev,
        "this_month_revenue": month_rev,
    }
