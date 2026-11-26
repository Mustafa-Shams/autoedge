import os
import sys
from pydantic_settings import BaseSettings
from pydantic import ConfigDict, field_validator
from decimal import Decimal


_in_tests = os.getenv("AUTOEDGE_TESTING") == "1" or "pytest" in sys.modules


class Settings(BaseSettings):
    model_config = ConfigDict(env_file=None if _in_tests else ".env", validate_assignment=True)

    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    CORS_ORIGINS: str = "http://localhost:5173"

    # Storefront settings
    SHOWROOM_TIMEZONE: str = "Asia/Karachi"
    DEMO_STARTING_BALANCE: Decimal = Decimal("50000.00")
    RESERVATION_DEPOSIT_PERCENT: int = 10
    RESERVATION_MIN_HOLD_DAYS: int = 7
    RESERVATION_MAX_HOLD_DAYS: int = 30
    CANCELLATION_FEE_PERCENT: int = 10
    MAX_ACTIVE_RESERVATIONS_PER_CUSTOMER: int = 3
    MAX_ACTIVE_TEST_DRIVES_PER_CUSTOMER: int = 3
    TEST_DRIVE_REQUEST_EXPIRY_HOURS: int = 48
    TRADE_IN_OFFER_VALID_DAYS: int = 7

    # Email settings
    EMAIL_PROVIDER: str = "none"  # brevo | sendgrid | none
    EMAIL_API_KEY: str = ""
    EMAIL_FROM_ADDRESS: str = ""
    EMAIL_FROM_NAME: str = "AutoEdge"
    EMAIL_SUPPRESS_DOMAINS: str = "example.com,example.org,example.net,email.com,test.com,autoedge.com"

    @field_validator("EMAIL_PROVIDER", "EMAIL_API_KEY", "EMAIL_FROM_ADDRESS", "EMAIL_FROM_NAME")
    @classmethod
    def clean_email_setting(cls, value: str) -> str:
        value = value.strip()
        while len(value) >= 2 and value[0] in {"'", '"'} and value[-1] == value[0]:
            value = value[1:-1].strip()
        return value

    # Store URLs
    STORE_BASE_URL: str = "http://localhost:5174"

    # Image sources (local only — used by fetch_vehicle_images.py)
    PEXELS_API_KEY: str = ""
    UNSPLASH_ACCESS_KEY: str = ""


if _in_tests:
    from app.core.test_database import test_database_url

    settings = Settings(_env_file=None, DATABASE_URL=test_database_url().render_as_string(hide_password=False),
                        SECRET_KEY="local-test-only", EMAIL_PROVIDER="none")
else:
    settings = Settings()
