from datetime import datetime, timezone


def utcnow() -> datetime:
    """Return current UTC time as naive datetime (for DB storage)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)
