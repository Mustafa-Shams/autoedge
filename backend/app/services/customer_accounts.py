"""Provision storefront credentials and the demo ledger in the caller's transaction."""
import random
import string

from fastapi import BackgroundTasks
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_password
from app.models.bank_account import BankAccount
from app.models.bank_transaction import BankTransaction
from app.models.customer import Customer
from app.models.customer_account import CustomerAccount
from app.services.bank_service import _ensure_unique_ref
from app.services.notify_service import notify


def _generate_account_number() -> str:
    """Generate a random account number like 'AE' + 10 random digits."""
    digits = "".join(random.choices(string.digits, k=10))
    return f"AE{digits}"


def _generate_card_last4() -> str:
    """Generate a random 4-digit card_last4 for display."""
    return "".join(random.choices(string.digits, k=4))


def _open_demo_bank_account(db: Session, customer_id: int) -> None:
    if db.query(BankAccount.bank_account_id).filter_by(customer_id=customer_id).first():
        return
    # 3. Create bank account
    # Ensure unique account_number
    acct_number = _generate_account_number()
    while db.query(BankAccount).filter(BankAccount.account_number == acct_number).first():
        acct_number = _generate_account_number()

    card_last4 = _generate_card_last4()
    starting_balance = settings.DEMO_STARTING_BALANCE

    bank_acct = BankAccount(
        customer_id=customer_id,
        bank_name="AutoEdge Demo Bank",
        account_number=acct_number,
        card_last4=card_last4,
        balance=starting_balance,
    )
    db.add(bank_acct)
    db.flush()  # Get bank_account_id

    # 4. Credit Opening Balance transaction
    ref_code = _ensure_unique_ref(db)
    opening_txn = BankTransaction(
        bank_account_id=bank_acct.bank_account_id,
        txn_type="Opening Balance",
        direction="Credit",
        amount=starting_balance,
        balance_after=starting_balance,
        reference_code=ref_code,
        description=f"Welcome to AutoEdge! Starting demo balance of ${starting_balance:,.2f}",
    )
    db.add(opening_txn)



def open_customer_account(
    db: Session, customer: Customer, password: str, background_tasks: BackgroundTasks | None = None,
) -> CustomerAccount:
    account = CustomerAccount(
        customer_id=customer.customer_id,
        email=customer.email,
        password_hash=hash_password(password),
        is_active=customer.is_active,
        email_verified=False,
    )
    db.add(account)
    _open_demo_bank_account(db, customer.customer_id)
    notify(
        db, customer_id=customer.customer_id, notification_type="welcome",
        title="Welcome to AutoEdge!",
        message=f"Your account has been created. You have a demo balance of ${settings.DEMO_STARTING_BALANCE:,.2f} to explore our showroom. Browse cars, reserve your favorite, book test drives, and more!",
        link_path="/account", background_tasks=background_tasks,
    )
    return account
