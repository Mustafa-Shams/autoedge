"""Bank service — row-locked debit/credit/top-up with full ledger trail.

All money is Decimal. Every balance change writes a bank_transactions row.
Lock order per Article XIII: vehicle → reservation → bank_account.
"""
import random
import string
from datetime import datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.time import utcnow
from app.models.bank_account import BankAccount
from app.models.bank_transaction import BankTransaction


def generate_reference_code() -> str:
    """Generate a unique transaction reference code: TXN-YYYYMMDD-NNNNNN."""
    now = datetime.now(timezone.utc)
    date_part = now.strftime("%Y%m%d")
    rand_part = "".join(random.choices(string.digits, k=6))
    return f"TXN-{date_part}-{rand_part}"


def _ensure_unique_ref(db: Session) -> str:
    """Generate a reference code that doesn't already exist."""
    for _ in range(10):
        ref = generate_reference_code()
        exists = db.query(BankTransaction).filter(
            BankTransaction.reference_code == ref
        ).first()
        if not exists:
            return ref
    # Extremely unlikely fallback — add extra digits
    return generate_reference_code() + "".join(random.choices(string.digits, k=4))


def get_bank_account_for_update(db: Session, customer_id: int) -> Optional[BankAccount]:
    """Get bank account with row lock (FOR UPDATE).

    Must be called AFTER locking vehicle and reservation rows (lock order).
    """
    return (
        db.query(BankAccount)
        .filter(BankAccount.customer_id == customer_id)
        .with_for_update()
        .first()
    )


def debit(
    db: Session,
    customer_id: int,
    amount: Decimal,
    txn_type: str,
    description: str,
    idempotency_key: Optional[str] = None,
    reservation_id: Optional[int] = None,
    service_booking_id: Optional[int] = None,
) -> BankTransaction:
    """Debit the customer's bank account.

    The bank_account row must already be locked (FOR UPDATE).
    Raises ValueError if insufficient funds.
    Returns the created BankTransaction.
    """
    amount = amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    if amount <= 0:
        raise ValueError("Debit amount must be positive")

    bank_acct = get_bank_account_for_update(db, customer_id)
    if bank_acct is None:
        raise ValueError("No bank account found for customer")

    if bank_acct.balance < amount:
        raise ValueError("Insufficient funds")

    # Update balance
    new_balance = bank_acct.balance - amount
    bank_acct.balance = new_balance

    # Create transaction record
    ref_code = _ensure_unique_ref(db)
    txn = BankTransaction(
        bank_account_id=bank_acct.bank_account_id,
        txn_type=txn_type,
        direction="Debit",
        amount=amount,
        balance_after=new_balance,
        reference_code=ref_code,
        idempotency_key=idempotency_key,
        description=description,
        reservation_id=reservation_id,
        service_booking_id=service_booking_id,
    )
    db.add(txn)
    db.flush()
    return txn


def credit(
    db: Session,
    customer_id: int,
    amount: Decimal,
    txn_type: str,
    description: str,
    idempotency_key: Optional[str] = None,
    reservation_id: Optional[int] = None,
    service_booking_id: Optional[int] = None,
) -> BankTransaction:
    """Credit the customer's bank account.

    The bank_account row must already be locked (FOR UPDATE).
    Returns the created BankTransaction.
    """
    amount = amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    if amount <= 0:
        raise ValueError("Credit amount must be positive")

    bank_acct = get_bank_account_for_update(db, customer_id)
    if bank_acct is None:
        raise ValueError("No bank account found for customer")

    # Update balance
    new_balance = bank_acct.balance + amount
    bank_acct.balance = new_balance

    # Create transaction record
    ref_code = _ensure_unique_ref(db)
    txn = BankTransaction(
        bank_account_id=bank_acct.bank_account_id,
        txn_type=txn_type,
        direction="Credit",
        amount=amount,
        balance_after=new_balance,
        reference_code=ref_code,
        idempotency_key=idempotency_key,
        description=description,
        reservation_id=reservation_id,
        service_booking_id=service_booking_id,
    )
    db.add(txn)
    db.flush()
    return txn


def top_up(
    db: Session,
    customer_id: int,
    amount: Decimal,
) -> BankTransaction:
    """Top up the customer's bank account with demo funds.

    Limits per spec section 8:
    - Amount: 100.00 to 50,000.00
    - Max 5 top-ups per rolling 24 hours
    """
    amount = amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    if amount < Decimal("100.00"):
        raise ValueError("Minimum top-up amount is $100.00")
    if amount > Decimal("50000.00"):
        raise ValueError("Maximum top-up amount is $50,000.00")

    # Check rate limit: max 5 top-ups in 24 hours
    cutoff = utcnow() - timedelta(hours=24)
    bank_acct = (
        db.query(BankAccount)
        .filter(BankAccount.customer_id == customer_id)
        .with_for_update()
        .first()
    )
    if bank_acct is None:
        raise ValueError("No bank account found for customer")

    recent_topups = (
        db.query(func.count(BankTransaction.txn_id))
        .filter(
            BankTransaction.bank_account_id == bank_acct.bank_account_id,
            BankTransaction.txn_type == "Top Up",
            BankTransaction.created_at >= cutoff,
        )
        .scalar()
    ) or 0

    if recent_topups >= 5:
        raise ValueError("Maximum 5 top-ups per 24 hours. Please try again later.")

    # Credit the account
    new_balance = bank_acct.balance + amount
    bank_acct.balance = new_balance

    ref_code = _ensure_unique_ref(db)
    txn = BankTransaction(
        bank_account_id=bank_acct.bank_account_id,
        txn_type="Top Up",
        direction="Credit",
        amount=amount,
        balance_after=new_balance,
        reference_code=ref_code,
        description=f"Demo funds top-up of ${amount:,.2f}",
    )
    db.add(txn)
    db.flush()
    return txn


def get_statement(
    db: Session,
    customer_id: int,
    page: int = 1,
    page_size: int = 20,
    txn_type: Optional[str] = None,
) -> dict:
    """Get paginated bank statement for a customer."""
    bank_acct = (
        db.query(BankAccount)
        .filter(BankAccount.customer_id == customer_id)
        .first()
    )
    if bank_acct is None:
        return {"items": [], "total": 0, "page": page, "page_size": page_size}

    q = db.query(BankTransaction).filter(
        BankTransaction.bank_account_id == bank_acct.bank_account_id
    )
    if txn_type in ("Debit", "Credit"):
        q = q.filter(BankTransaction.direction == txn_type)
    elif txn_type:
        q = q.filter(BankTransaction.txn_type == txn_type)

    total = q.count()
    items = (
        q.order_by(BankTransaction.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return {"items": items, "total": total, "page": page, "page_size": page_size}
