from typing import List, Optional
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from app.models.user import User
from app.models.technician_profile import TechnicianProfile
from app.schemas.user import UserCreate, UserUpdate
from app.core.security import hash_password


def get_user(db: Session, user_id: int) -> Optional[User]:
    return db.query(User).filter(User.user_id == user_id).first()


def get_user_by_email(db: Session, email: str, *, lock: bool = False) -> Optional[User]:
    query = select(User).where(func.lower(User.email) == email.strip().lower())
    if lock:
        query = query.with_for_update()
    return db.scalars(query).first()


def get_users(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    role: Optional[str] = None,
    is_active: Optional[bool] = None,
) -> List[User]:
    q = db.query(User)
    if role:
        q = q.filter(User.role == role)
    if is_active is not None:
        q = q.filter(User.is_active == is_active)
    return q.order_by(User.user_id).offset(skip).limit(limit).all()



def create_user(db: Session, obj_in: UserCreate) -> User:
    email = obj_in.email.strip().lower()
    if get_user_by_email(db, email):
        raise ValueError("A staff account with this email already exists.")
    db_user = User(
        **obj_in.model_dump(exclude={"password", "confirm_password", "email"}),
        email=email,
        password_hash=hash_password(obj_in.password),
        must_change_password=True,
    )
    db.add(db_user)
    _ensure_technician_profile(db_user)
    db.commit()
    return db_user


def lock_managed_user(db: Session, user_id: int, actor_id: int) -> tuple[User | None, int]:
    """Serialize manager status/role changes before acquiring the target lock."""
    managers = db.scalars(
        select(User).where(User.role == "manager", User.is_active.is_(True))
        .order_by(User.user_id).execution_options(populate_existing=True).with_for_update()
    ).all()
    if not any(manager.user_id == actor_id for manager in managers):
        raise PermissionError("An active manager is required.")
    target = db.scalars(
        select(User).where(User.user_id == user_id)
        .execution_options(populate_existing=True).with_for_update()
    ).first()
    return target, len(managers)


def _ensure_technician_profile(user: User) -> None:
    if user.role == "technician" and user.technician_profile is None:
        user.technician_profile = TechnicianProfile(specialty="General", is_bookable=False)


def update_user(db: Session, user: User, obj_in: UserUpdate) -> User:
    data = obj_in.model_dump(exclude_unset=True)
    if user.is_active and data.get("is_active") is False:
        user.auth_version += 1
    for field, value in data.items():
        setattr(user, field, value)
    _ensure_technician_profile(user)
    db.commit()
    return user
