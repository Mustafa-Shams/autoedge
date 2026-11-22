from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_staff_session
from app.core.security import verify_password, create_access_token, hash_password
from app.crud.crud_user import get_user_by_email
from app.schemas.auth import TokenResponse
from app.schemas.user import StaffPasswordChange, UserResponse
from app.core.time import utcnow

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = get_user_by_email(db, email=form_data.username, lock=True)
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Inactive user")
    user.last_login_at = utcnow()
    token = _staff_token(user)
    db.commit()
    return token


def _staff_token(user):
    token = create_access_token(
        data={"sub": user.email, "auth_version": user.auth_version},
        scope="staff", role=user.role,
    )
    return TokenResponse(access_token=token, token_type="bearer", role=user.role)


@router.get("/me", response_model=UserResponse)
async def get_me(current_user=Depends(get_staff_session)):
    return current_user

@router.post("/change-password", response_model=TokenResponse)
def change_staff_password(
    body: StaffPasswordChange, user=Depends(get_staff_session), db: Session = Depends(get_db),
):
    user = db.query(type(user)).filter_by(user_id=user.user_id).populate_existing().with_for_update().one()
    if not user.is_active or not verify_password(body.current_password, user.password_hash):
        raise HTTPException(status_code=403, detail="Current password is incorrect.")
    if body.password == body.current_password:
        raise HTTPException(status_code=422, detail="Choose a different password.")
    user.password_hash = hash_password(body.password)
    user.must_change_password = False
    user.auth_version += 1
    token = _staff_token(user)
    db.commit()
    return token
