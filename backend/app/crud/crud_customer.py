from typing import List, Optional

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.customer import Customer
from app.models.customer_account import CustomerAccount
from app.schemas.customer import CustomerCreate, CustomerUpdate
from app.services.customer_accounts import open_customer_account


def get_customer(db: Session, customer_id: int) -> Optional[Customer]:
    return db.get(Customer, customer_id)


def get_customers(
    db: Session, skip: int = 0, limit: int = 20, search: Optional[str] = None,
) -> List[Customer]:
    query = db.query(Customer)
    if search:
        pattern = f"%{search}%"
        query = query.filter(or_(
            Customer.full_name.ilike(pattern), Customer.email.ilike(pattern), Customer.phone.ilike(pattern),
        ))
    return query.order_by(Customer.customer_id).offset(skip).limit(limit).all()


def _check_email(db: Session, email: str, customer_id: int | None = None) -> None:
    for model in (Customer, CustomerAccount):
        query = db.query(model.customer_id).filter(func.lower(model.email) == email)
        if customer_id is not None:
            query = query.filter(model.customer_id != customer_id)
        if query.first():
            raise ValueError("A customer with this email already exists.")


def create_customer(db: Session, obj_in: CustomerCreate) -> Customer:
    data = obj_in.model_dump(exclude={"password", "confirm_password"})
    data["email"] = data["email"].strip().lower()
    _check_email(db, data["email"])
    customer = Customer(**data)
    db.add(customer)
    db.flush()
    open_customer_account(db, customer, obj_in.password)
    db.commit()
    return customer


def update_customer(db: Session, customer_id: int, obj_in: CustomerUpdate) -> Optional[Customer]:
    customer = db.scalars(
        select(Customer).where(Customer.customer_id == customer_id).with_for_update()
    ).first()
    if not customer:
        return None

    data = obj_in.model_dump(exclude_unset=True, exclude={"confirm_password", "new_password"})
    email = data.get("email", customer.email)
    if email:
        email = email.strip().lower()
        _check_email(db, email, customer_id)
    if (customer.account or obj_in.new_password) and not email:
        raise ValueError("An email address is required for a storefront account.")
    if "email" in data:
        data["email"] = email
    for field, value in data.items():
        setattr(customer, field, value)

    if customer.account:
        if customer.account.email != email:
            customer.account.email = email
            customer.account.email_verified = False
        if obj_in.new_password:
            customer.account.password_hash = hash_password(obj_in.new_password)
    elif obj_in.new_password:
        open_customer_account(db, customer, obj_in.new_password)

    db.commit()
    return customer
