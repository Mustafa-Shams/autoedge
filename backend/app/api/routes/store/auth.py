"""Customer authentication routes — spec sections 7.1, 10.2.

POST /store/auth/register   — Create account + bank + welcome notification
POST /store/auth/login      — Email + password → token
GET  /store/auth/check-email — Live availability check
"""
import random
import string
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.core.config import settings
from app.core.security import hash_password, verify_password, create_access_token
from app.core.time import utcnow
from app.models.customer import Customer
from app.models.customer_account import CustomerAccount
from app.models.bank_account import BankAccount
from app.models.bank_transaction import BankTransaction
from app.models.notification import Notification
from app.models.email_outbox import EmailOutbox
from app.services.notify_service import notify
from app.schemas.store_auth import (
    RegisterRequest,
    LoginRequest,
    CheckEmailResponse,
    CustomerProfileResponse,
    CustomerTokenResponse,
)

router = APIRouter(prefix="/store/auth", tags=["store-auth"])


def _generate_account_number() -> str:
    """Generate a random account number like 'AE' + 10 random digits."""
    digits = "".join(random.choices(string.digits, k=10))
    return f"AE{digits}"


def _generate_card_last4() -> str:
    """Generate a random 4-digit card_last4 for display."""
    return "".join(random.choices(string.digits, k=4))


def _generate_reference_code() -> str:
    """Generate a unique transaction reference code."""
    now = datetime.now(timezone.utc)
    date_part = now.strftime("%Y%m%d")
    rand_part = "".join(random.choices(string.digits, k=6))
    return f"TXN-{date_part}-{rand_part}"


@router.post("/register", response_model=CustomerTokenResponse, status_code=status.HTTP_201_CREATED)
async def register(
    req: RegisterRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Register a new customer account per spec 7.1.

    In ONE transaction:
    1. Create or link customer row
    2. Create customer_account
    3. Create bank_account with starting balance
    4. Credit Opening Balance transaction
    5. Create welcome notification
    6. Create welcome email_outbox row
    """
    normalized_email = req.email.strip().lower()

    # Check if account already exists (case-insensitive)
    existing_account = db.query(CustomerAccount).filter(
        CustomerAccount.email == normalized_email
    ).first()
    if existing_account:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    # Look for existing customer with same email (walk-in created by staff)
    existing_customer = db.query(Customer).filter(
        Customer.email.ilike(normalized_email)
    ).first()

    try:
        # 1. Create or link customer
        if existing_customer and existing_customer.account is None:
            # Link to existing walk-in customer
            customer = existing_customer
            # Update customer info from registration
            customer.full_name = req.full_name
            customer.phone = req.phone
        else:
            # Create new customer
            customer = Customer(
                full_name=req.full_name,
                email=normalized_email,
                phone=req.phone,
            )
            db.add(customer)
            db.flush()  # Get customer_id

        # 2. Create customer account
        password_hashed = hash_password(req.password)
        account = CustomerAccount(
            customer_id=customer.customer_id,
            email=normalized_email,
            password_hash=password_hashed,
            is_active=True,
            email_verified=False,
            last_login_at=utcnow(),
        )
        db.add(account)
        db.flush()  # Get account_id

        # 3. Create bank account
        # Ensure unique account_number
        acct_number = _generate_account_number()
        while db.query(BankAccount).filter(BankAccount.account_number == acct_number).first():
            acct_number = _generate_account_number()

        card_last4 = _generate_card_last4()
        starting_balance = settings.DEMO_STARTING_BALANCE

        bank_acct = BankAccount(
            customer_id=customer.customer_id,
            bank_name="AutoEdge Demo Bank",
            account_number=acct_number,
            card_last4=card_last4,
            balance=starting_balance,
        )
        db.add(bank_acct)
        db.flush()  # Get bank_account_id

        # 4. Credit Opening Balance transaction
        ref_code = _generate_reference_code()
        # Ensure unique reference code
        while db.query(BankTransaction).filter(BankTransaction.reference_code == ref_code).first():
            ref_code = _generate_reference_code()

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

        # 5. Create welcome notification + email via notify service
        notify(
            db,
            customer_id=customer.customer_id,
            notification_type="welcome",
            title="Welcome to AutoEdge!",
            message=f"Your account has been created. You have a demo balance of ${starting_balance:,.2f} to explore our showroom. Browse cars, reserve your favorite, book test drives, and more!",
            link_path="/account",
            background_tasks=background_tasks,
        )

        db.commit()
        db.refresh(account)
        db.refresh(customer)

    except Exception:
        db.rollback()
        raise

    # Create token (auto-login)
    token = create_access_token(
        data={"sub": f"customer:{account.account_id}"},
        scope="customer",
        role="customer",
        customer_id=customer.customer_id,
    )

    return CustomerTokenResponse(
        access_token=token,
        token_type="bearer",
        role="customer",
        customer=CustomerProfileResponse(
            customer_id=customer.customer_id,
            full_name=customer.full_name,
            email=account.email,
            phone=customer.phone,
            address=customer.address,
        ),
    )


@router.post("/login", response_model=CustomerTokenResponse)
async def login(req: LoginRequest, db: Session = Depends(get_db)):
    """Customer login — spec section 7.1.

    Trim + lowercase email, verify with bcrypt, generic error on any failure.
    """
    normalized_email = req.email.strip().lower()

    # Find the account
    account = db.query(CustomerAccount).filter(
        CustomerAccount.email == normalized_email
    ).first()

    if not account or not verify_password(req.password, account.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not account.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive",
        )

    # Update last_login_at
    account.last_login_at = utcnow()
    db.commit()

    # Load customer
    customer = account.customer

    # Create token
    token = create_access_token(
        data={"sub": f"customer:{account.account_id}"},
        scope="customer",
        role="customer",
        customer_id=customer.customer_id,
    )

    return CustomerTokenResponse(
        access_token=token,
        token_type="bearer",
        role="customer",
        customer=CustomerProfileResponse(
            customer_id=customer.customer_id,
            full_name=customer.full_name,
            email=account.email,
            phone=customer.phone,
            address=customer.address,
        ),
    )


@router.get("/check-email", response_model=CheckEmailResponse)
async def check_email(email: str, db: Session = Depends(get_db)):
    """Live validation: is this email available for registration?"""
    normalized = email.strip().lower()
    existing = db.query(CustomerAccount).filter(
        CustomerAccount.email == normalized
    ).first()
    return CheckEmailResponse(available=existing is None)
