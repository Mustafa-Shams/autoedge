"""Customer bank routes — spec sections 8, 10.3.

GET  /store/bank              — Account summary (balance, card_last4, bank_name, masked number)
GET  /store/bank/transactions — Paginated statement
POST /store/bank/top-up       — Add demo funds
"""
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_customer
from app.models.bank_account import BankAccount
from app.models.customer import Customer
from app.models.customer_account import CustomerAccount
from app.services.notify_service import notify
from app.services import bank_service
from app.schemas.store_bank import (
    BankSummaryResponse,
    BankTransactionResponse,
    BankStatementResponse,
    TopUpRequest,
    TopUpResponse,
)

router = APIRouter(prefix="/store/bank", tags=["store-bank"])


def _mask_account_number(account_number: str) -> str:
    """Mask all but last 4 digits: AE1234567890 → ••••••7890"""
    if len(account_number) <= 4:
        return account_number
    return "•" * (len(account_number) - 4) + account_number[-4:]


@router.get("", response_model=BankSummaryResponse)
async def get_bank_summary(
    account: CustomerAccount = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    """Get bank account summary — balance, masked number, card_last4."""
    bank_acct = db.query(BankAccount).filter(
        BankAccount.customer_id == account.customer_id
    ).first()

    if bank_acct is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No bank account found",
        )

    customer = db.query(Customer).filter(
        Customer.customer_id == account.customer_id
    ).first()

    return BankSummaryResponse(
        bank_account_id=bank_acct.bank_account_id,
        bank_name=bank_acct.bank_name,
        account_number_masked=_mask_account_number(bank_acct.account_number),
        card_last4=bank_acct.card_last4,
        balance=bank_acct.balance,
        customer_name=customer.full_name if customer else "Customer",
    )


@router.get("/transactions", response_model=BankStatementResponse)
async def get_transactions(
    page: int = 1,
    page_size: int = 20,
    txn_type: str = None,
    account: CustomerAccount = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    """Get paginated bank statement."""
    page_size = min(page_size, 50)
    if page < 1:
        page = 1

    result = bank_service.get_statement(
        db,
        customer_id=account.customer_id,
        page=page,
        page_size=page_size,
        txn_type=txn_type,
    )

    return BankStatementResponse(
        items=[
            BankTransactionResponse(
                txn_id=txn.txn_id,
                txn_type=txn.txn_type,
                direction=txn.direction,
                amount=txn.amount,
                balance_after=txn.balance_after,
                reference_code=txn.reference_code,
                description=txn.description,
                reservation_id=txn.reservation_id,
                service_booking_id=txn.service_booking_id,
                created_at=txn.created_at,
            )
            for txn in result["items"]
        ],
        total=result["total"],
        page=result["page"],
        page_size=result["page_size"],
    )


@router.post("/top-up", response_model=TopUpResponse, status_code=status.HTTP_201_CREATED)
async def top_up_balance(
    req: TopUpRequest,
    account: CustomerAccount = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    """Top up bank balance with demo funds.

    Limits: $100–$50,000 per top-up, max 5 per 24 hours.
    """
    try:
        txn = bank_service.top_up(
            db,
            customer_id=account.customer_id,
            amount=req.amount,
        )
        db.commit()

        # Notification for top-up
        notify(
            db,
            customer_id=account.customer_id,
            notification_type="top_up",
            title=f"Balance Topped Up — ${txn.amount:,.2f}",
            message=f"Your AutoEdge Demo Bank account has been topped up by ${txn.amount:,.2f}. "
                    f"New balance: ${txn.balance_after:,.2f}.",
            link_path="/account/bank",
            amount=f"${txn.amount:,.2f}",
            new_balance=f"${txn.balance_after:,.2f}",
        )
        db.commit()

        return TopUpResponse(
            txn_id=txn.txn_id,
            reference_code=txn.reference_code,
            amount=txn.amount,
            new_balance=txn.balance_after,
            message=f"Demo funds of ${txn.amount:,.2f} added successfully",
        )

    except ValueError as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS
            if "5 top-ups" in str(e)
            else status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get("/sensitive")
async def get_bank_sensitive(
    account: CustomerAccount = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    """Get sensitive bank details (full account number, demo CVV) — owner only."""
    bank_acct = db.query(BankAccount).filter(
        BankAccount.customer_id == account.customer_id
    ).first()
    if not bank_acct:
        raise HTTPException(status_code=404, detail="No bank account found")
    return {
        "account_number": bank_acct.account_number,
        "card_last4": bank_acct.card_last4,
        "demo_cvv": "123",
    }
