import uuid
import jwt
from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.config import settings
from app.core.database import get_db
from app.core.security import hash_password, verify_password, create_access_token, create_refresh_token, decode_token
from app.models.user import User
from app.schemas.auth import RegisterRequest, LoginRequest, UserResponse, UpdateProfileRequest, ChangePasswordRequest
from app.dependencies import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


def _cookie_kwargs() -> dict:
    kwargs: dict = {"httponly": True, "secure": settings.cookie_secure, "samesite": "lax"}
    if settings.cookie_domain and settings.cookie_domain != "localhost":
        kwargs["domain"] = settings.cookie_domain
    return kwargs


def _set_auth_cookies(response: Response, user_id: uuid.UUID, remember_me: bool = True) -> None:
    access_token = create_access_token(str(user_id))
    refresh_token = create_refresh_token(str(user_id))
    kw = _cookie_kwargs()
    response.set_cookie(
        "access_token",
        access_token,
        max_age=settings.jwt_access_token_expire_minutes * 60,
        **kw,
    )
    refresh_kw = {**kw}
    if remember_me:
        refresh_kw["max_age"] = settings.jwt_refresh_token_expire_days * 86400
    response.set_cookie("refresh_token", refresh_token, **refresh_kw)


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(data: RegisterRequest, response: Response, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(email=data.email, name=data.name, password_hash=hash_password(data.password))
    db.add(user)
    await db.commit()
    await db.refresh(user)
    _set_auth_cookies(response, user.id)
    return user


@router.post("/login", response_model=UserResponse)
async def login(data: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    _set_auth_cookies(response, user.id, remember_me=data.remember_me)
    return user


@router.post("/logout")
async def logout(response: Response):
    kw = _cookie_kwargs()
    response.delete_cookie("access_token", **kw)
    response.delete_cookie("refresh_token", **kw)
    return {"message": "Logged out"}


@router.post("/refresh", response_model=UserResponse)
async def refresh(
    response: Response,
    refresh_token: str | None = Cookie(default=None),
    db: AsyncSession = Depends(get_db),
):
    if not refresh_token:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = decode_token(refresh_token, token_type="refresh")
        user_id = uuid.UUID(payload["sub"])
    except (jwt.PyJWTError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    new_access = create_access_token(str(user.id))
    kw = _cookie_kwargs()
    response.set_cookie(
        "access_token",
        new_access,
        max_age=settings.jwt_access_token_expire_minutes * 60,
        **kw,
    )
    return user


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=UserResponse)
async def update_me(
    data: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    current_user.name = data.name
    await db.commit()
    await db.refresh(current_user)
    return current_user


@router.post("/change-password")
async def change_password(
    data: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not verify_password(data.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    current_user.password_hash = hash_password(data.new_password)
    await db.commit()
    return {"message": "Password updated"}
