from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr, field_validator, model_validator

from app.schemas.store_auth import RegisterRequest


class CustomerBase(BaseModel):
    full_name: str
    email: Optional[EmailStr] = None
    phone: str
    address: Optional[str] = None
    id_type: Optional[str] = None
    id_number: Optional[str] = None
    notes: Optional[str] = None


class CustomerCreate(CustomerBase):
    email: EmailStr
    password: str
    confirm_password: str

    @field_validator("password")
    @classmethod
    def validate_password(cls, value):
        return RegisterRequest.validate_password(value)

    @model_validator(mode="after")
    def passwords_match(self):
        if self.password != self.confirm_password:
            raise ValueError("Passwords do not match")
        return self


class CustomerUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    id_type: Optional[str] = None
    id_number: Optional[str] = None
    notes: Optional[str] = None
    new_password: Optional[str] = None
    confirm_password: Optional[str] = None

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, value):
        return RegisterRequest.validate_password(value) if value is not None else None

    @model_validator(mode="after")
    def passwords_match(self):
        if self.new_password != self.confirm_password:
            raise ValueError("Passwords do not match")
        return self


class CustomerResponse(CustomerBase):
    model_config = ConfigDict(from_attributes=True)

    customer_id: int
    created_at: datetime
    is_active: bool
