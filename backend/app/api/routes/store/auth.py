"""Customer authentication routes — spec sections 7.1, 10.2.

POST /store/auth/register   — Create account + bank + welcome notification
POST /store/auth/login      — Email + password → token
GET  /store/auth/check-email — Live availability check
"""
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.core.security import verify_password, create_access_token
from app.core.time import utcnow
from app.models.customer import Customer
from app.models.customer_account import CustomerAccount
from app.services.customer_accounts import open_customer_account
from app.schemas.store_auth import (
    RegisterRequest,
    LoginRequest,
    CheckEmailResponse,
    CustomerProfileResponse,
    CustomerTokenResponse,
)

router = APIRouter(prefix="/store/auth", tags=["store-auth"])


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
        func.lower(Customer.email) == normalized_email
    ).with_for_update().first()

    if existing_customer and not existing_customer.is_active:
        raise HTTPException(status_code=409, detail="This account is inactive.")

    try:
        # 1. Create or link customer
        if existing_customer and existing_customer.account is None:
            # Link to existing walk-in customer
            customer = existing_customer
            # Update customer info from registration
            customer.email = normalized_email
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

        account = open_customer_account(db, customer, req.password, background_tasks)
        account.last_login_at = utcnow()

        db.commit()
        db.refresh(account)
        db.refresh(customer)

    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="An account with this email already exists.") from exc

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

    if not account.is_active or not account.customer.is_active:
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
