from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_current_customer, get_db
from app.models.vehicle import Vehicle
from app.services.purchase_service import PurchaseRequest, purchase, quote, receipts, cancel_purchase
from app.services.reservation_service import sweep_due_reservations
from app.services.showroom_service import ReturnAgreement, purchase_thread

router = APIRouter(prefix="/store/purchases", tags=["store-purchases"])


@router.get("/quote/{vehicle_id}")
def checkout_quote(vehicle_id: int, reservation_id: int | None = None, trade_in_id: int | None = None,
                   account=Depends(get_current_customer), db: Session = Depends(get_db)):
    sweep_due_reservations(db)
    try:
        return quote(db, db.get(Vehicle, vehicle_id), account.customer_id, reservation_id, trade_in_id)
    except ValueError as exc:
        raise HTTPException(409, str(exc)) from exc


@router.get("")
def my_purchases(account=Depends(get_current_customer), db: Session = Depends(get_db)):
    return receipts(db, account.customer_id)


@router.post("/{sale_id}/cancel")
def request_cancellation(sale_id: int, body: ReturnAgreement | None = None, account=Depends(get_current_customer), db: Session = Depends(get_db)):
    try:
        cancel_purchase(db, sale_id, customer_id=account.customer_id, agree_trade_return=bool(body and body.agree_trade_return))
        db.commit()
        return {"requested": True}
    except LookupError as exc:
        raise HTTPException(404, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(409, str(exc)) from exc


@router.post("/{sale_id}/conversation")
def start_conversation(sale_id: int, account=Depends(get_current_customer), db: Session = Depends(get_db)):
    enquiry_id = purchase_thread(db, sale_id, account.customer_id)
    if enquiry_id is None:
        raise HTTPException(404, "Purchase not found")
    db.commit()
    return {"enquiry_id": enquiry_id}


@router.post("")
def checkout(request: PurchaseRequest, account=Depends(get_current_customer), db: Session = Depends(get_db)):
    sweep_due_reservations(db)
    try:
        sale = purchase(db, account, request)
        result = receipts(db, account.customer_id, sale.sale_id)[0]
        db.commit()
        return result
    except PermissionError as exc:
        db.rollback()
        raise HTTPException(403, str(exc)) from exc
    except ValueError as exc:
        db.rollback()
        raise HTTPException(409, str(exc)) from exc
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(409, "Purchase conflict. Review your purchases before retrying.") from exc
