from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_role
from app.core.security import hash_password
from app.crud.crud_user import create_user, get_user, get_users, lock_managed_user, update_user
from app.db.base import Base
from app.models.enquiry import Enquiry
from app.models.service_job import ServiceJob
from app.models.user import User
from app.schemas.user import StaffPassword, UserCreate, UserResponse, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])
MANAGER = require_role(["manager"])


class EnquiryAccessUpdate(BaseModel):
    handles_enquiries: bool


@router.get("/", response_model=list[UserResponse])
def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    role: str | None = None,
    db: Session = Depends(get_db),
    _=Depends(MANAGER),
):
    return get_users(db, skip=skip, limit=limit, role=role)


@router.post("/", response_model=UserResponse, status_code=201)
def create_new_user(user_in: UserCreate, db: Session = Depends(get_db), _=Depends(MANAGER)):
    try:
        return create_user(db, user_in)
    except (IntegrityError, ValueError) as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="A staff account with this email already exists.") from exc


def _target(db: Session, user_id: int, actor: User) -> tuple[User, int]:
    try:
        user, active_managers = lock_managed_user(db, user_id, actor.user_id)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user, active_managers


def _protect_manager(user: User, actor: User, active_managers: int, removing_access: bool) -> None:
    if removing_access and user.role == "manager" and user.is_active:
        if user.user_id == actor.user_id:
            raise HTTPException(status_code=409, detail="You cannot remove your own manager access.")
        if active_managers <= 1:
            raise HTTPException(status_code=409, detail="At least one active manager is required.")


@router.get("/{user_id}", response_model=UserResponse)
def get_user_by_id(user_id: int, db: Session = Depends(get_db), _=Depends(MANAGER)):
    user = get_user(db, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.get("/{user_id}/activity")
def staff_activity(user_id: int, db: Session = Depends(get_db), _=Depends(MANAGER)):
    if get_user(db, user_id) is None:
        raise HTTPException(status_code=404, detail="User not found")
    enquiries = (
        db.query(Enquiry.enquiry_id, Enquiry.subject, Enquiry.status)
        .filter_by(assigned_to=user_id).order_by(Enquiry.updated_at.desc()).limit(10)
    )
    jobs = (
        db.query(ServiceJob.job_id, ServiceJob.job_type, ServiceJob.status, ServiceJob.job_date)
        .filter_by(technician_id=user_id).order_by(ServiceJob.job_date.desc()).limit(10)
    )
    return {
        "enquiries": [row._asdict() for row in enquiries],
        "jobs": [row._asdict() for row in jobs],
    }


@router.put("/{user_id}", response_model=UserResponse)
def update_user_by_id(
    user_id: int, user_in: UserUpdate, db: Session = Depends(get_db), actor=Depends(MANAGER),
):
    user, managers = _target(db, user_id, actor)
    removing_access = user_in.is_active is False or user_in.role not in (None, "manager")
    _protect_manager(user, actor, managers, removing_access)
    return update_user(db, user, user_in)


@router.put("/{user_id}/enquiry-access", response_model=UserResponse)
def toggle_enquiry_access(
    user_id: int, body: EnquiryAccessUpdate, db: Session = Depends(get_db), actor=Depends(MANAGER),
):
    user, _ = _target(db, user_id, actor)
    return update_user(db, user, UserUpdate(handles_enquiries=body.handles_enquiries))


@router.post("/{user_id}/reset-password", status_code=204)
def reset_password(
    user_id: int, body: StaffPassword, db: Session = Depends(get_db), actor=Depends(MANAGER),
):
    user, _ = _target(db, user_id, actor)
    user.password_hash = hash_password(body.password)
    user.must_change_password = True
    user.auth_version += 1
    db.commit()


@router.delete("/{user_id}", response_model=UserResponse)
def deactivate_user(user_id: int, db: Session = Depends(get_db), actor=Depends(MANAGER)):
    user, managers = _target(db, user_id, actor)
    _protect_manager(user, actor, managers, True)
    return update_user(db, user, UserUpdate(is_active=False))


@router.delete("/{user_id}/permanent", status_code=204)
def permanently_delete_user(user_id: int, db: Session = Depends(get_db), actor=Depends(MANAGER)):
    user, managers = _target(db, user_id, actor)
    _protect_manager(user, actor, managers, True)
    if user.is_active:
        raise HTTPException(status_code=409, detail="Deactivate this user before deleting their account.")
    for table in Base.metadata.tables.values():
        for key in table.foreign_keys:
            if key.column is User.__table__.c.user_id and db.execute(
                select(key.parent).where(key.parent == user_id).limit(1)
            ).first():
                raise HTTPException(status_code=409, detail="This user has linked records and can only be deactivated.")
    try:
        db.execute(delete(User).where(User.user_id == user_id))
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="This user has linked records and can only be deactivated.") from exc
