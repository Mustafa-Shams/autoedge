from pydantic_settings import BaseSettings
from pydantic import ConfigDict
from decimal import Decimal


class Settings(BaseSettings):
    model_config = ConfigDict(env_file=".env")

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

    # Store URLs
    STORE_BASE_URL: str = "http://localhost:5174"

    # Image sources (local only — used by fetch_vehicle_images.py)
    PEXELS_API_KEY: str = ""
    UNSPLASH_ACCESS_KEY: str = ""


settings = Settings()
