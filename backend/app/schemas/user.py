from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

from app.core.staff_access import MODULES
from app.schemas.store_auth import RegisterRequest

StaffRole = Literal["manager", "sales_executive", "receptionist", "technician"]
AccessLevel = Literal["none", "view", "full"]


class StaffPassword(BaseModel):
    password: str
    confirm_password: str

    @field_validator("password")
    @classmethod
    def password_strength(cls, value):
        return RegisterRequest.validate_password(value)

    @model_validator(mode="after")
    def passwords_match(self):
        if self.password != self.confirm_password:
            raise ValueError("Passwords do not match")
        return self


class StaffPasswordChange(StaffPassword):
    current_password: str


class AccessOverrides(BaseModel):
    module_access: dict[str, AccessLevel] = Field(default_factory=dict)

    @field_validator("module_access")
    @classmethod
    def known_modules(cls, value):
        if set(value) - set(MODULES):
            raise ValueError("Unknown staff module")
        return value


class UserCreate(StaffPassword, AccessOverrides):
    full_name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    role: StaffRole
    is_active: bool = True
    handles_enquiries: bool = False
    phone: str | None = Field(None, max_length=20)

    model_config = ConfigDict(str_strip_whitespace=False)


class UserUpdate(AccessOverrides):
    full_name: str | None = Field(None, min_length=1, max_length=100)
    phone: str | None = Field(None, max_length=20)
    role: StaffRole | None = None
    is_active: bool | None = None
    handles_enquiries: bool | None = None

    @model_validator(mode="after")
    def required_values_are_not_null(self):
        for key in ("full_name", "role", "is_active", "handles_enquiries"):
            if key in self.model_fields_set and getattr(self, key) is None:
                raise ValueError(f"{key} cannot be empty")
        return self


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: int
    full_name: str
    email: EmailStr
    role: str
    is_active: bool
    phone: str | None
    created_at: datetime
    last_login_at: datetime | None
    handles_enquiries: bool
    module_access: dict[str, AccessLevel]
    access: dict[str, AccessLevel]
    must_change_password: bool
