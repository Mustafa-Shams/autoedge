"""Pydantic v2 schemas for customer storefront authentication and account."""
import re
from typing import Optional
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, EmailStr, field_validator, model_validator


class RegisterRequest(BaseModel):
    """Customer registration request — spec section 7.1."""
    full_name: str
    email: EmailStr
    phone: str
    password: str
    confirm_password: str

    @field_validator("full_name", mode="before")
    @classmethod
    def trim_name(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 1:
            raise ValueError("Full name is required")
        if len(v) > 100:
            raise ValueError("Full name must be 100 characters or fewer")
        return v

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.strip().lower()

    @field_validator("phone", mode="before")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        v = v.strip()
        # Allow digits, spaces, +, -
        cleaned = re.sub(r"[\s\+\-]", "", v)
        if not cleaned.isdigit():
            raise ValueError("Phone must contain only digits, spaces, + and -")
        if len(v) < 7 or len(v) > 20:
            raise ValueError("Phone must be 7–20 characters")
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not re.search(r"[a-zA-Z]", v):
            raise ValueError("Password must contain at least one letter")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one digit")
        return v

    @model_validator(mode="after")
    def passwords_match(self):
        if self.password != self.confirm_password:
            raise ValueError("Passwords do not match")
        return self


class LoginRequest(BaseModel):
    """Customer login request — spec section 7.1."""
    email: str
    password: str

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.strip().lower()

    @field_validator("password", mode="before")
    @classmethod
    def trim_password(cls, v: str) -> str:
        return v.strip()


class CheckEmailResponse(BaseModel):
    """Response for check-email endpoint."""
    available: bool


class CustomerProfileResponse(BaseModel):
    """Customer profile returned after login/register and on GET /store/me."""
    model_config = ConfigDict(from_attributes=True)

    customer_id: int
    full_name: str
    email: str
    phone: str
    address: Optional[str] = None


class CustomerTokenResponse(BaseModel):
    """Token + profile returned on register/login."""
    access_token: str
    token_type: str = "bearer"
    role: str = "customer"
    customer: CustomerProfileResponse


class CustomerProfileUpdate(BaseModel):
    """Update customer profile — email is read-only."""
    full_name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None

    @field_validator("full_name", mode="before")
    @classmethod
    def trim_name(cls, v):
        if v is None:
            return v
        v = v.strip()
        if len(v) < 1:
            raise ValueError("Full name is required")
        if len(v) > 100:
            raise ValueError("Full name must be 100 characters or fewer")
        return v

    @field_validator("phone", mode="before")
    @classmethod
    def validate_phone(cls, v):
        if v is None:
            return v
        v = v.strip()
        cleaned = re.sub(r"[\s\+\-]", "", v)
        if not cleaned.isdigit():
            raise ValueError("Phone must contain only digits, spaces, + and -")
        if len(v) < 7 or len(v) > 20:
            raise ValueError("Phone must be 7–20 characters")
        return v


class ChangePasswordRequest(BaseModel):
    """Change password — spec section 10.3."""
    current_password: str
    new_password: str
    confirm_password: str

    @field_validator("new_password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not re.search(r"[a-zA-Z]", v):
            raise ValueError("Password must contain at least one letter")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one digit")
        return v

    @model_validator(mode="after")
    def passwords_match(self):
        if self.new_password != self.confirm_password:
            raise ValueError("New passwords do not match")
        return self


class BankAccountSummary(BaseModel):
    """Bank account info returned in registration and on GET /store/bank."""
    model_config = ConfigDict(from_attributes=True)

    bank_account_id: int
    bank_name: str
    account_number: str  # will be masked in the route
    card_last4: str
    balance: Decimal
