"""Customer account routes — spec section 10.3.

GET  /store/me                 — Customer profile
PUT  /store/me                 — Update profile (name, phone, address; email is read-only)
POST /store/me/change-password — Change password
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_customer
from app.core.security import verify_password, hash_password
from app.models.customer import Customer
from app.models.customer_account import CustomerAccount
from app.schemas.store_auth import (
    CustomerProfileResponse,
    CustomerProfileUpdate,
    ChangePasswordRequest,
)

router = APIRouter(prefix="/store/me", tags=["store-account"])


@router.get("", response_model=CustomerProfileResponse)
async def get_profile(
    account: CustomerAccount = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    """Return the current customer's profile."""
    customer = account.customer
    return CustomerProfileResponse(
        customer_id=customer.customer_id,
        full_name=customer.full_name,
        email=account.email,
        phone=customer.phone,
        address=customer.address,
    )


@router.put("", response_model=CustomerProfileResponse)
async def update_profile(
    updates: CustomerProfileUpdate,
    account: CustomerAccount = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    """Update customer profile. Email is read-only (Article XV)."""
    customer = db.query(Customer).filter(
        Customer.customer_id == account.customer_id
    ).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    update_data = updates.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(customer, field, value)

    db.commit()
    db.refresh(customer)

    return CustomerProfileResponse(
        customer_id=customer.customer_id,
        full_name=customer.full_name,
        email=account.email,
        phone=customer.phone,
        address=customer.address,
    )


@router.post("/change-password", status_code=status.HTTP_200_OK)
async def change_password(
    req: ChangePasswordRequest,
    account: CustomerAccount = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    """Change password — verify current, validate new, update hash."""
    # Verify current password
    if not verify_password(req.current_password, account.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Current password is incorrect",
        )

    # Update password hash
    account.password_hash = hash_password(req.new_password)
    db.commit()

    return {"message": "Password changed successfully"}
