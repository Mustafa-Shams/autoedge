from typing import Generator
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.session import SessionLocal

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")
# Optional token scheme — does not raise 401 if missing
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


def get_db() -> Generator:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_staff_session(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    """Get the current staff user from a JWT. Rejects customer tokens."""
    from app.crud.crud_user import get_user_by_email
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_access_token(token)
        # Enforce staff scope — reject tokens without scope or with customer scope
        scope = payload.get("scope")
        if scope != "staff":
            raise credentials_exception
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = get_user_by_email(db, email=email)
    if user is None or not user.is_active or payload.get("auth_version", 0) != user.auth_version:
        raise credentials_exception
    return user


def get_current_user(user=Depends(get_staff_session)):
    if user.must_change_password:
        raise HTTPException(status_code=403, detail="Change your temporary password before using the staff portal.")
    return user


def require_module(module: str):
    def check_module(request: Request, user=Depends(get_current_user)):
        level = user.access.get(module, "none")
        if level == "none" or (level == "view" and request.method not in {"GET", "HEAD"}):
            raise HTTPException(status_code=403, detail="Insufficient module access")
        return user
    return check_module


def get_current_customer(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    """Get the current customer from a JWT. Rejects staff tokens."""
    from app.models.customer_account import CustomerAccount
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_access_token(token)
        scope = payload.get("scope")
        if scope != "customer":
            raise credentials_exception
        customer_id = payload.get("customer_id")
        if customer_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    account = db.query(CustomerAccount).filter(
        CustomerAccount.customer_id == customer_id
    ).first()
    if account is None:
        raise credentials_exception
    if not account.is_active or not account.customer.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive",
        )
    return account


def get_optional_customer(
    token: str | None = Depends(oauth2_scheme_optional),
    db: Session = Depends(get_db),
):
    """Get customer if logged in, else return None. For public pages with optional personalization."""
    if token is None:
        return None
    try:
        return get_current_customer.__wrapped__(token=token, db=db)
    except Exception:
        return None


def require_role(allowed_roles: list):
    def role_checker(current_user=Depends(get_current_user)):
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return current_user
    return role_checker


def require_enquiry_access():
    """Staff must be manager, or (sales_executive|receptionist) with handles_enquiries=True."""
    def checker(current_user=Depends(get_current_user)):
        if current_user.role == "manager":
            return current_user
        if current_user.role in ("sales_executive", "receptionist") and current_user.handles_enquiries:
            return current_user
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions",
        )
    return checker
