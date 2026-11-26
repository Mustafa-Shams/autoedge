"""CRUD operations for sales — extended for storefront (spec 7.2).

When a sale becomes Completed:
- If reservation_id: convert reservation (Active → Converted), set deposit_credit,
  do NOT decrement stock again (already decremented on reserve).
- Else: lock vehicle, check stock ≥ 1, decrement stock, write stock_movement (Sale).
- If trade_in_id: set trade_in_credit, mark trade-in Completed.
- Allocate one physical unit for staff-verified pickup.
- Commission creation stays as in v1.0.
- Balance due = sale_price - discount - deposit_credit - trade_in_credit.
"""
from decimal import Decimal
from typing import List, Optional
from datetime import datetime, timezone

from sqlalchemy.orm import Session
from sqlalchemy import func, or_

from app.core.time import utcnow
from app.models.sale import Sale
from app.models.vehicle import Vehicle
from app.models.customer import Customer
from app.models.deal import Deal
from app.models.enquiry import Enquiry
from app.models.user import User
from app.models.reservation import Reservation
from app.models.stock_movement import StockMovement
from app.models.trade_in_request import TradeInRequest
from app.models.notification import Notification
from app.schemas.sale import SaleCreate, SaleUpdate
from app.services.notify_service import notify
from app.services.deal_service import assign_sale
from app.services.sales_assistance import attach_owner
from app.services.trade_acquisition import trade_credit
from app.services.stock_service import get_vehicle_for_update, sync_vehicle_status


def _enrich(sale: Sale, db: Session) -> Sale:
    """Attach human-readable display fields onto the ORM object."""
    v = db.query(Vehicle).filter(Vehicle.vehicle_id == sale.vehicle_id).first()
    c = db.query(Customer).filter(Customer.customer_id == sale.customer_id).first()
    s = db.query(User).filter(User.user_id == sale.staff_id).first()
    sale.vehicle_info = f"{v.year} {v.make} {v.model}" if v else None
    sale.customer_name = c.full_name if c else None
    sale.staff_name = s.full_name if s else None
    deal = db.query(Deal).filter_by(sale_id=sale.sale_id).one_or_none()
    sale.deal_id = deal.deal_id if deal else None
    sale.pickup_status = deal.stage if deal else None
    sale.refund_requested = bool(deal and deal.refund_requested_at)
    sale.unit_id = deal.unit_id if deal else None
    sale.payment_verified = bool(deal and (deal.payment_verified_at or sale.payment_type == "Demo Wallet"))
    acquisition = sale.trade_in.acquisition if sale.trade_in else None
    sale.excess_at_pickup = acquisition.excess_amount if acquisition else 0
    sale.cash_received = deal.cash_received if deal else None
    sale.external_funding = deal.external_funding if deal else None
    sale.pickup_deadline = deal.pickup_deadline.replace(tzinfo=timezone.utc) if deal and deal.pickup_deadline else None
    sale.enquiry_id = db.query(Enquiry.enquiry_id).filter_by(sale_id=sale.sale_id).scalar()

    # Calculate balance due at showroom
    sale.balance_due_at_showroom = (
        sale.sale_price - sale.discount - sale.deposit_credit - sale.trade_in_credit
    )
    if sale.payment_verified:
        sale.balance_due_at_showroom = Decimal("0")
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
        q = q.filter(or_(Sale.staff_id == staff_id, Sale.staff_id.is_(None)))
    if status:
        q = q.filter(Sale.status == status)
    sales = q.order_by(Sale.sale_date.desc()).offset(skip).limit(limit).all()
    for sale in sales:
        _enrich(sale, db)
    return sales


def complete_sale(db: Session, sale: Sale) -> None:
    """Handle all side effects when a sale transitions to Completed.

    Per spec 7.2:
    - If reservation_id: convert reservation, set deposit_credit, no stock decrement.
    - Else: lock vehicle, decrement stock, write stock_movement.
    - If trade_in_id: set trade_in_credit, mark trade-in Completed.
    - Keep the unit allocated through pickup.
    - Queue pickup. Assisted-sale commission is earned at handover.
    - Create purchase_completed notification.
    """
    vehicle = get_vehicle_for_update(db, sale.vehicle_id)

    # ── Handle reservation linkage ──
    reservation_id = sale.reservation_id
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
    trade_in_id = sale.trade_in_id
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
        if trade_in.target_vehicle_id and trade_in.target_vehicle_id != sale.vehicle_id:
            raise ValueError("Trade-in offer applies to another vehicle")

        # Set trade-in credit
        sale.trade_in_id = trade_in_id
        sale.trade_in_credit = trade_credit(trade_in, sale.customer_id, sale.vehicle_id,
                                           sale.sale_price - sale.discount - sale.deposit_credit)

        # Mark trade-in completed
        trade_in.status = "Completed"
        trade_in.updated_at = utcnow()

    deal = assign_sale(db, sale)
    attach_owner(db, sale, deal)

    # ── Notification + email ──
    vehicle_label = f"{vehicle.year} {vehicle.make} {vehicle.model}" if vehicle else "your vehicle"
    paid = sale.payment_type == "Demo Wallet"
    title = "Payment received" if paid else "Purchase recorded"
    next_action = ("Showroom staff will verify the VIN at pickup." if paid else
                   "The showroom will verify your payment before arranging pickup.")
    notify(
        db, customer_id=sale.customer_id, notification_type="purchase_completed",
        title=f"{title} · {vehicle_label}", message=f"{vehicle_label}. {next_action}",
        link_path=f"/account/deals/{deal.deal_id}",
        vehicle_label=vehicle_label, payment_confirmed=paid, sale_id=sale.sale_id,
    )


def create_sale(db: Session, obj_in: SaleCreate) -> Sale:
    if obj_in.payment_type not in ("Cash", "Finance", "Lease"):
        raise ValueError("Choose a staff payment method")
    if obj_in.status == "Completed":
        get_vehicle_for_update(db, obj_in.vehicle_id)
    sale_data = obj_in.model_dump()
    db_sale = Sale(**sale_data)
    db.add(db_sale)
    db.flush()  # get sale_id before commit

    if obj_in.status == "Completed":
        complete_sale(db, db_sale)

    db.commit()
    db.refresh(db_sale)
    _enrich(db_sale, db)
    return db_sale


def update_sale(db: Session, sale_id: int, obj_in: SaleUpdate) -> Optional[Sale]:
    sale = db.query(Sale).filter_by(sale_id=sale_id).with_for_update().first()
    if not sale:
        return None
    data = obj_in.model_dump(exclude_unset=True)
    if "payment_type" in data and data["payment_type"] not in ("Cash", "Finance", "Lease"):
        raise ValueError("Choose a staff payment method")
    settled = sale.status == "Completed" or db.query(Deal.deal_id).filter_by(sale_id=sale_id).first() is not None
    if settled and any(
        key != "notes" and value != getattr(sale, key) for key, value in data.items()
    ):
        raise ValueError("Only notes can be changed after a sale is completed")

    # Handle status transition to Completed
    if data.get("status") == "Completed" and sale.status != "Completed":
        # Apply the reservation/trade_in links from the update if provided
        if "reservation_id" in data and data["reservation_id"]:
            sale.reservation_id = data["reservation_id"]
        if "trade_in_id" in data and data["trade_in_id"]:
            sale.trade_in_id = data["trade_in_id"]

        for field, value in data.items():
            setattr(sale, field, value)

        complete_sale(db, sale)
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
