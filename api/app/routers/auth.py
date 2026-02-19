import uuid
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.config import settings
from app.core.database import get_db
from app.core.security import hash_password, verify_password, create_access_token, create_refresh_token
from app.models.user import User
from app.schemas.auth import RegisterRequest, LoginRequest, UserResponse, UpdateProfileRequest
from app.dependencies import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


def _set_auth_cookies(response: Response, user_id: uuid.UUID) -> None:
    access_token = create_access_token(str(user_id))
    refresh_token = create_refresh_token(str(user_id))
    cookie_kwargs = dict(
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
    )
    if settings.cookie_domain and settings.cookie_domain != "localhost":
        cookie_kwargs["domain"] = settings.cookie_domain
    response.set_cookie("access_token", access_token,
                        max_age=settings.jwt_access_token_expire_minutes * 60, **cookie_kwargs)
    response.set_cookie("refresh_token", refresh_token,
                        max_age=settings.jwt_refresh_token_expire_days * 86400, **cookie_kwargs)


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
    _set_auth_cookies(response, user.id)
    return user


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("access_token")
    response.delete_cookie("refresh_token")
    return {"message": "Logged out"}


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
