from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
import bcrypt
from app.core.config import settings


def verify_password(plain: str, hashed: str) -> bool:
    """Verify a plain password against a bcrypt hash."""
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def hash_password(plain: str) -> str:
    """Hash a password using bcrypt."""
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(plain.encode("utf-8"), salt).decode("utf-8")


def create_access_token(
    data: dict,
    scope: str = "staff",
    role: str | None = None,
    customer_id: int | None = None,
) -> str:
    """Create a JWT with scope claim.

    Staff tokens:    {"sub": email, "scope": "staff", "role": role}
    Customer tokens: {"sub": "customer:<account_id>", "scope": "customer",
                      "role": "customer", "customer_id": customer_id}
    """
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    to_encode.update({"exp": expire, "scope": scope})
    if role:
        to_encode["role"] = role
    if customer_id is not None:
        to_encode["customer_id"] = customer_id
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> dict:
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
