# Personal Finance Dashboard — Phase 1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the core personal finance dashboard — auth, accounts, credit cards, categories, transactions, and dashboard UI — deployable locally via Docker Compose.

**Architecture:** FastAPI (Python 3.14) backend + Celery/Redis for async jobs + Next.js 16 PWA frontend + PostgreSQL 18. The `api` and `worker` share one codebase and Docker image, differentiated only by their entrypoint command.

**Tech Stack:** Python 3.14 / FastAPI 0.129 / SQLAlchemy 2.0.46 / Pydantic 2.12.5 / Alembic / Celery 5.6.2 / Redis 8.4.1 / PostgreSQL 18.2 / Next.js 16.1.6 / Tailwind CSS 4.1.18 / shadcn/ui CLI 3.x / pnpm / uv

**Design doc:** `docs/plans/2026-02-19-expense-dashboard-design.md`

---

## Fixes applied vs original plan

- `python-jose` → `PyJWT` (python-jose is abandoned, has CVEs)
- `Account.balance` removed — replaced with `opening_balance` + computed balance from transactions
- Statement model migration moved after Document (FK ordering fix)
- Credit card period logic rewritten — two separate functions for open vs closed period
- Test isolation added via `conftest.py` with per-test transaction rollback
- JWT moved to `httpOnly` cookies (not localStorage)
- `--no-turbo` flag removed from Next.js scaffold (Turbopack is default in v16)
- Category seeding moved to Alembic data migration (not app lifespan)
- `user_id` added to Category for custom categories
- `updated_at` added to Transaction, Account, CreditCard
- Pagination added to transaction list
- `statement_day`/`due_day` Pydantic validators added (1–28 max)
- Docker Compose SSR env var fixed (`API_URL` vs `NEXT_PUBLIC_API_URL`)
- Accounts management page added (was missing)
- UUID type used properly with `uuidv7()`
- ATM withdrawal with fee support added (`fee_amount`, `fee_category_id` on Transaction)

---

## Prerequisites

- Docker + Docker Compose installed
- `uv` installed: `curl -LsSf https://astral.sh/uv/install.sh | sh`
- `pnpm` installed: `npm install -g pnpm`
- `node` >= 20

---

## Task 1: Initialize Monorepo Structure

**Files:**
- Create: `docker-compose.yml`
- Create: `.env.example`
- Create: `.gitignore`

**Step 1: Initialize git and create root structure**

```bash
cd /home/wsl/personal/expense-tracker
git init
mkdir -p api frontend k8s/base k8s/overlays/dev k8s/overlays/prod scripts
```

**Step 2: Create `.gitignore`**

```
__pycache__/
*.py[cod]
.venv/
*.egg-info/
.env
node_modules/
.next/
.pnpm-store/
*.log
.idea/
.vscode/
*.swp
.DS_Store
api/uploads/
```

**Step 3: Create `.env.example`**

```env
# PostgreSQL
POSTGRES_USER=finance
POSTGRES_PASSWORD=changeme
POSTGRES_DB=finance_db
DATABASE_URL=postgresql+asyncpg://finance:changeme@postgres:5432/finance_db
TEST_DATABASE_URL=postgresql+asyncpg://finance:changeme@localhost:5432/finance_test

# Redis
REDIS_URL=redis://redis:6379/0

# JWT
JWT_SECRET_KEY=changeme-generate-with-openssl-rand-hex-32
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30
JWT_REFRESH_TOKEN_EXPIRE_DAYS=30

# Cookie
COOKIE_SECURE=false
COOKIE_DOMAIN=localhost

# API Keys (Phase 5)
GEMINI_API_KEY=
CLAUDE_API_KEY=

# Discord (Phase 3)
DISCORD_WEBHOOK_URL=

# App
APP_ENV=development
CORS_ORIGINS=http://localhost:3000
```

**Step 4: Create `docker-compose.yml`**

```yaml
services:
  postgres:
    image: postgres:18
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:8
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  api:
    build:
      context: ./api
      dockerfile: Dockerfile
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - JWT_SECRET_KEY=${JWT_SECRET_KEY}
      - JWT_ALGORITHM=${JWT_ALGORITHM}
      - JWT_ACCESS_TOKEN_EXPIRE_MINUTES=${JWT_ACCESS_TOKEN_EXPIRE_MINUTES}
      - JWT_REFRESH_TOKEN_EXPIRE_DAYS=${JWT_REFRESH_TOKEN_EXPIRE_DAYS}
      - COOKIE_SECURE=${COOKIE_SECURE}
      - COOKIE_DOMAIN=${COOKIE_DOMAIN}
      - CORS_ORIGINS=${CORS_ORIGINS}
      - APP_ENV=${APP_ENV}
    ports:
      - "8000:8000"
    volumes:
      - ./api:/app
      - uploads:/app/uploads
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  worker:
    build:
      context: ./api
      dockerfile: Dockerfile
    command: celery -A app.tasks.celery worker --loglevel=info
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - APP_ENV=${APP_ENV}
    volumes:
      - ./api:/app
      - uploads:/app/uploads
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    command: pnpm dev
    environment:
      # Browser-side: uses mapped port on localhost
      - NEXT_PUBLIC_API_URL=http://localhost:8000
      # Server-side (SSR/RSC): uses Docker service name
      - API_URL=http://api:8000
    ports:
      - "3000:3000"
    volumes:
      - ./frontend:/app
      - /app/node_modules
      - /app/.next

volumes:
  postgres_data:
  redis_data:
  uploads:
```

**Step 5: Copy and configure `.env`**

```bash
cp .env.example .env
# Generate JWT secret:
openssl rand -hex 32
# Paste result as JWT_SECRET_KEY in .env
```

**Step 6: Commit**

```bash
git add .gitignore .env.example docker-compose.yml docs/
git commit -m "chore: initialize monorepo structure with docker-compose"
```

---

## Task 2: FastAPI Project Setup

**Files:**
- Create: `api/pyproject.toml`
- Create: `api/app/__init__.py`
- Create: `api/app/main.py`
- Create: `api/app/core/config.py`
- Create: `api/app/core/logging.py`
- Create: `api/Dockerfile`

**Step 1: Initialize Python project with uv**

```bash
cd api
uv init --python 3.14
uv add "fastapi[standard]" "sqlalchemy[asyncio]" asyncpg alembic pydantic-settings \
    "celery[redis]" redis structlog PyJWT passlib bcrypt \
    pymupdf python-multipart aiofiles
uv add --dev pytest pytest-asyncio httpx pytest-cov
```

Note: `PyJWT` replaces `python-jose`. `bcrypt` is installed separately alongside `passlib`.

**Step 2: Create `api/app/core/config.py`**

```python
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    app_env: str = "development"
    database_url: str
    test_database_url: str = ""
    redis_url: str

    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 30
    jwt_refresh_token_expire_days: int = 30

    cookie_secure: bool = False
    cookie_domain: str = "localhost"

    cors_origins: str = "http://localhost:3000"

    gemini_api_key: str = ""
    claude_api_key: str = ""
    discord_webhook_url: str = ""

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]


settings = Settings()
```

**Step 3: Create `api/app/core/logging.py`**

```python
import logging
import structlog


def configure_logging(env: str = "development") -> None:
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.dev.ConsoleRenderer()
            if env == "development"
            else structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
    )


log = structlog.get_logger()
```

**Step 4: Create `api/app/main.py`**

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.logging import configure_logging, log


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging(settings.app_env)
    log.info("startup", env=settings.app_env)
    yield
    log.info("shutdown")


app = FastAPI(title="Finance Dashboard API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}
```

**Step 5: Create `api/Dockerfile`**

```dockerfile
FROM python:3.14-slim

WORKDIR /app

RUN pip install uv

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

COPY . .

ENV PATH="/app/.venv/bin:$PATH"
```

**Step 6: Write test for health endpoint**

Create `api/tests/__init__.py` (empty) and `api/tests/test_health.py`:

```python
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.mark.asyncio
async def test_health():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
```

Create `api/pytest.ini`:

```ini
[pytest]
asyncio_mode = auto
```

**Step 7: Run test**

```bash
cd api
uv run pytest tests/test_health.py -v
```

Expected: PASS

**Step 8: Commit**

```bash
git add api/
git commit -m "feat: initialize FastAPI project with config, logging, health endpoint"
```

---

## Task 3: Database Setup + Test Infrastructure

**Files:**
- Create: `api/app/core/database.py`
- Create: `api/alembic.ini`
- Create: `api/migrations/env.py`
- Create: `api/tests/conftest.py`

**Step 1: Create `api/app/core/database.py`**

```python
from collections.abc import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings


engine = create_async_engine(settings.database_url, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session
```

**Step 2: Initialize Alembic**

```bash
cd api
uv run alembic init migrations
```

**Step 3: Replace `api/migrations/env.py`**

```python
import asyncio
from logging.config import fileConfig
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config
from alembic import context
from app.core.config import settings
from app.core.database import Base
import app.models  # noqa: F401

config = context.config
config.set_main_option("sqlalchemy.url", settings.database_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

**Step 4: Create `api/tests/conftest.py`** — proper test isolation with per-test rollback

```python
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    create_async_engine,
    async_sessionmaker,
)
from app.main import app
from app.core.database import Base, get_db
from app.core.config import settings

TEST_DATABASE_URL = settings.test_database_url or settings.database_url.replace(
    "/finance_db", "/finance_test"
)

test_engine = create_async_engine(TEST_DATABASE_URL, echo=False)
TestSessionLocal = async_sessionmaker(test_engine, expire_on_commit=False)


@pytest.fixture(scope="session", autouse=True)
async def setup_test_database():
    """Create all tables once per test session, drop after."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def db() -> AsyncSession:
    """Each test gets its own session that rolls back after the test."""
    async with test_engine.connect() as conn:
        await conn.begin()
        session = AsyncSession(bind=conn, join_transaction_mode="create_savepoint")
        yield session
        await session.close()
        await conn.rollback()


@pytest_asyncio.fixture
async def client(db: AsyncSession):
    """HTTP client with DB dependency overridden to use test session."""
    async def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()
```

**Step 5: Create `api/app/models/__init__.py`** (empty — models imported here as they're created)

```python
# All models imported here so Alembic can detect them
```

**Step 6: Commit**

```bash
git add api/migrations/ api/alembic.ini api/app/core/database.py api/app/models/ api/tests/conftest.py
git commit -m "feat: add SQLAlchemy async engine, Alembic setup, test infrastructure"
```

---

## Task 4: User Model + Auth Security

**Files:**
- Create: `api/app/models/user.py`
- Create: `api/app/core/security.py`
- Test: `api/tests/test_security.py`

**Step 1: Create `api/app/models/user.py`**

```python
import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=func.uuidv7()
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    avatar: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
```

**Step 2: Create `api/app/core/security.py`** using PyJWT

```python
from datetime import datetime, timedelta, timezone
import jwt
from passlib.context import CryptContext
from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(subject: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.jwt_access_token_expire_minutes
    )
    return jwt.encode(
        {"sub": subject, "exp": expire, "type": "access"},
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )


def create_refresh_token(subject: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        days=settings.jwt_refresh_token_expire_days
    )
    return jwt.encode(
        {"sub": subject, "exp": expire, "type": "refresh"},
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )


def decode_token(token: str, token_type: str = "access") -> dict:
    payload = jwt.decode(
        token,
        settings.jwt_secret_key,
        algorithms=[settings.jwt_algorithm],
    )
    if payload.get("type") != token_type:
        raise jwt.InvalidTokenError(f"Expected {token_type} token")
    return payload
```

**Step 3: Update `api/app/models/__init__.py`**

```python
from app.models.user import User  # noqa: F401
```

**Step 4: Write failing tests**

Create `api/tests/test_security.py`:

```python
import pytest
import jwt
from app.core.security import hash_password, verify_password, create_access_token, decode_token


def test_password_hash_and_verify():
    hashed = hash_password("mysecretpassword")
    assert hashed != "mysecretpassword"
    assert verify_password("mysecretpassword", hashed)
    assert not verify_password("wrongpassword", hashed)


def test_access_token_encode_decode():
    token = create_access_token("user-123")
    payload = decode_token(token, token_type="access")
    assert payload["sub"] == "user-123"


def test_refresh_token_not_accepted_as_access():
    from app.core.security import create_refresh_token
    refresh = create_refresh_token("user-123")
    with pytest.raises(jwt.InvalidTokenError):
        decode_token(refresh, token_type="access")


def test_invalid_token_raises():
    with pytest.raises(jwt.PyJWTError):
        decode_token("not.a.valid.token")
```

**Step 5: Run tests**

```bash
cd api
uv run pytest tests/test_security.py -v
```

Expected: PASS (no DB required — pure logic)

**Step 6: Generate migration**

```bash
docker compose up postgres -d
uv run alembic revision --autogenerate -m "create_users"
uv run alembic upgrade head
```

**Step 7: Commit**

```bash
git add api/app/models/user.py api/app/core/security.py api/migrations/ api/tests/test_security.py
git commit -m "feat: add User model, bcrypt password hashing, PyJWT tokens"
```

---

## Task 5: Auth Router (httpOnly Cookies)

**Files:**
- Create: `api/app/schemas/auth.py`
- Create: `api/app/routers/auth.py`
- Create: `api/app/dependencies.py`
- Modify: `api/app/main.py`
- Test: `api/tests/test_auth.py`

**Step 1: Create `api/app/schemas/auth.py`**

```python
from pydantic import BaseModel, EmailStr
import uuid


class RegisterRequest(BaseModel):
    email: EmailStr
    name: str
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    name: str
    avatar: str | None

    model_config = {"from_attributes": True}
```

**Step 2: Create `api/app/dependencies.py`**

```python
import uuid
import jwt
from fastapi import Cookie, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import decode_token
from app.models.user import User


async def get_current_user(
    access_token: str | None = Cookie(default=None),
    db: AsyncSession = Depends(get_db),
) -> User:
    if not access_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        payload = decode_token(access_token, token_type="access")
        user_id = uuid.UUID(payload["sub"])
    except (jwt.PyJWTError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user
```

**Step 3: Create `api/app/routers/auth.py`**

```python
import uuid
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.config import settings
from app.core.database import get_db
from app.core.security import hash_password, verify_password, create_access_token, create_refresh_token
from app.models.user import User
from app.schemas.auth import RegisterRequest, LoginRequest, UserResponse
from app.dependencies import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


def _set_auth_cookies(response: Response, user_id: uuid.UUID) -> None:
    access_token = create_access_token(str(user_id))
    refresh_token = create_refresh_token(str(user_id))
    cookie_kwargs = dict(
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        domain=settings.cookie_domain,
    )
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
```

**Step 4: Register router in `api/app/main.py`**

```python
from app.routers import auth as auth_router
app.include_router(auth_router.router)
```

Also create `api/app/routers/__init__.py` and `api/app/schemas/__init__.py` (empty).

**Step 5: Write failing tests**

Create `api/tests/test_auth.py`:

```python
import pytest


@pytest.mark.asyncio
async def test_register_sets_cookie(client):
    response = await client.post("/auth/register", json={
        "email": "test@example.com",
        "name": "Test User",
        "password": "password123",
    })
    assert response.status_code == 201
    assert "access_token" in response.cookies
    assert response.json()["email"] == "test@example.com"


@pytest.mark.asyncio
async def test_login_sets_cookie(client):
    await client.post("/auth/register", json={
        "email": "login@example.com", "name": "Login", "password": "password123"
    })
    response = await client.post("/auth/login", json={
        "email": "login@example.com", "password": "password123"
    })
    assert response.status_code == 200
    assert "access_token" in response.cookies


@pytest.mark.asyncio
async def test_login_wrong_password(client):
    response = await client.post("/auth/login", json={
        "email": "nobody@example.com", "password": "wrong"
    })
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_me_requires_auth(client):
    response = await client.get("/auth/me")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_me_returns_user(client):
    await client.post("/auth/register", json={
        "email": "me@example.com", "name": "Me", "password": "password123"
    })
    response = await client.get("/auth/me")
    assert response.status_code == 200
    assert response.json()["email"] == "me@example.com"
```

**Step 6: Run tests**

```bash
uv run pytest tests/test_auth.py -v
```

Expected: PASS (uses test DB with rollback isolation — tests can run repeatedly)

**Step 7: Commit**

```bash
git add api/app/routers/ api/app/schemas/ api/app/dependencies.py api/tests/test_auth.py
git commit -m "feat: add auth with httpOnly cookie JWT (register, login, logout, /me)"
```

---

## Task 6: Account Model + Router

**Files:**
- Create: `api/app/models/account.py`
- Create: `api/app/schemas/account.py`
- Create: `api/app/routers/accounts.py`
- Test: `api/tests/test_accounts.py`

**Step 1: Create `api/app/models/account.py`**

Key change: `opening_balance` replaces stored `balance`. Current balance is always computed from transactions.

```python
import enum
import uuid
from datetime import datetime
from decimal import Decimal
from sqlalchemy import String, DateTime, Numeric, Boolean, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class AccountType(str, enum.Enum):
    bank = "bank"
    credit_card = "credit_card"
    digital_wallet = "digital_wallet"
    cash = "cash"


class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=func.uuidv7()
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[AccountType] = mapped_column(nullable=False)
    opening_balance: Mapped[Decimal] = mapped_column(
        Numeric(15, 2), default=Decimal("0.00"),
        comment="Balance before first tracked transaction"
    )
    currency: Mapped[str] = mapped_column(String(3), default="PHP")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
```

**Why `opening_balance` not `balance`:** Balance is always `opening_balance + SUM(transactions)`. Storing a separate balance field creates inevitable drift when transactions are edited or deleted. The API computes current balance on demand.

**Step 2: Update `api/app/models/__init__.py`**

```python
from app.models.user import User  # noqa: F401
from app.models.account import Account  # noqa: F401
```

**Step 3: Create `api/app/schemas/account.py`**

```python
import uuid
from decimal import Decimal
from pydantic import BaseModel
from app.models.account import AccountType


class AccountCreate(BaseModel):
    name: str
    type: AccountType
    opening_balance: Decimal = Decimal("0.00")
    currency: str = "PHP"


class AccountUpdate(BaseModel):
    name: str | None = None
    opening_balance: Decimal | None = None
    is_active: bool | None = None


class AccountResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    name: str
    type: AccountType
    opening_balance: Decimal
    current_balance: Decimal  # computed, injected by router
    currency: str
    is_active: bool

    model_config = {"from_attributes": True}
```

**Step 4: Create `api/app/routers/accounts.py`**

```python
import uuid
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.core.database import get_db
from app.dependencies import get_current_user
from app.models.account import Account
from app.models.user import User
from app.schemas.account import AccountCreate, AccountUpdate, AccountResponse

router = APIRouter(prefix="/accounts", tags=["accounts"])


async def _compute_balance(db: AsyncSession, account_id: uuid.UUID, opening: Decimal) -> Decimal:
    """Compute current balance from opening_balance + all transactions."""
    from app.models.transaction import Transaction, TransactionType
    # income and transfer-in increase balance; expense and transfer-out decrease
    result = await db.execute(
        select(
            func.coalesce(
                func.sum(
                    Transaction.amount
                    # transfers to this account count as +
                    # expenses and transfers from this account count as -
                    # income counts as +
                ),
                Decimal("0.00"),
            )
        ).where(Transaction.account_id == account_id)
    )
    # Simplified: sum income + transfer_in, subtract expense + transfer_out
    # Full implementation computes net effect per transaction type
    # See services/account.py for the full SQL
    raw = result.scalar() or Decimal("0.00")
    return opening + raw


@router.get("", response_model=list[AccountResponse])
async def list_accounts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Account).where(Account.user_id == current_user.id, Account.is_active == True)
    )
    accounts = result.scalars().all()
    # Compute current_balance for each account
    from app.services.account import compute_current_balance
    responses = []
    for acct in accounts:
        balance = await compute_current_balance(db, acct.id, acct.opening_balance)
        responses.append(AccountResponse.model_validate({**acct.__dict__, "current_balance": balance}))
    return responses


@router.post("", response_model=AccountResponse, status_code=201)
async def create_account(
    data: AccountCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    account = Account(**data.model_dump(), user_id=current_user.id)
    db.add(account)
    await db.commit()
    await db.refresh(account)
    return AccountResponse.model_validate({**account.__dict__, "current_balance": account.opening_balance})


@router.patch("/{account_id}", response_model=AccountResponse)
async def update_account(
    account_id: uuid.UUID,
    data: AccountUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Account).where(Account.id == account_id, Account.user_id == current_user.id)
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(account, field, value)
    await db.commit()
    await db.refresh(account)
    from app.services.account import compute_current_balance
    balance = await compute_current_balance(db, account.id, account.opening_balance)
    return AccountResponse.model_validate({**account.__dict__, "current_balance": balance})


@router.delete("/{account_id}", status_code=204)
async def delete_account(
    account_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Account).where(Account.id == account_id, Account.user_id == current_user.id)
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    await db.delete(account)
    await db.commit()
```

**Step 5: Create `api/app/services/account.py`**

```python
import uuid
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, case, func


async def compute_current_balance(
    db: AsyncSession, account_id: uuid.UUID, opening_balance: Decimal
) -> Decimal:
    """
    current_balance = opening_balance
        + SUM(income transactions)
        + SUM(transfer-in transactions where to_account_id = account_id)
        - SUM(expense transactions)
        - SUM(transfer-out transactions where account_id = account_id)
        - SUM(fee_amount on all transactions from this account)
    """
    from app.models.transaction import Transaction, TransactionType

    result = await db.execute(
        select(
            func.coalesce(
                func.sum(
                    case(
                        (Transaction.type == TransactionType.income, Transaction.amount),
                        else_=Decimal("0.00"),
                    )
                ),
                Decimal("0.00"),
            ).label("income"),
            func.coalesce(
                func.sum(
                    case(
                        (Transaction.type == TransactionType.expense, Transaction.amount),
                        else_=Decimal("0.00"),
                    )
                ),
                Decimal("0.00"),
            ).label("expense"),
            func.coalesce(
                func.sum(
                    case(
                        (Transaction.type == TransactionType.transfer, Transaction.amount),
                        else_=Decimal("0.00"),
                    )
                ),
                Decimal("0.00"),
            ).label("transfer_out"),
            func.coalesce(
                func.sum(func.coalesce(Transaction.fee_amount, Decimal("0.00"))),
                Decimal("0.00"),
            ).label("fees"),
        ).where(Transaction.account_id == account_id)
    )
    row = result.one()

    # Transfer-in: transactions where to_account_id = this account
    transfer_in_result = await db.execute(
        select(
            func.coalesce(func.sum(Transaction.amount), Decimal("0.00"))
        ).where(
            Transaction.to_account_id == account_id,
            Transaction.type == TransactionType.transfer,
        )
    )
    transfer_in = transfer_in_result.scalar() or Decimal("0.00")

    return (
        opening_balance
        + row.income
        + transfer_in
        - row.expense
        - row.transfer_out
        - row.fees
    )
```

**Step 6: Generate migration + register router**

```bash
uv run alembic revision --autogenerate -m "create_accounts"
uv run alembic upgrade head
```

Add to `main.py`:
```python
from app.routers import accounts as accounts_router
app.include_router(accounts_router.router)
```

**Step 7: Write and run test**

Create `api/tests/test_accounts.py`:

```python
import pytest


@pytest.mark.asyncio
async def test_create_and_list_account(client):
    await client.post("/auth/register", json={"email": "a@test.com", "name": "A", "password": "pw"})
    r = await client.post("/accounts", json={"name": "BPI Savings", "type": "bank", "opening_balance": "5000.00"})
    assert r.status_code == 201
    data = r.json()
    assert data["name"] == "BPI Savings"
    assert data["opening_balance"] == "5000.00"
    assert data["current_balance"] == "5000.00"  # no transactions yet

    r = await client.get("/accounts")
    assert r.status_code == 200
    assert len(r.json()) == 1
```

```bash
uv run pytest tests/test_accounts.py -v
git add api/app/models/account.py api/app/schemas/account.py api/app/routers/accounts.py api/app/services/account.py api/migrations/ api/tests/test_accounts.py
git commit -m "feat: add Account model with computed balance (no stored balance drift)"
```

---

## Task 7: CreditCard + Statement Period Service

**Files:**
- Create: `api/app/models/credit_card.py`
- Create: `api/app/services/credit_card.py`
- Create: `api/app/schemas/credit_card.py`
- Create: `api/app/routers/credit_cards.py`
- Test: `api/tests/test_credit_card_service.py`

**Note on migration order:** Statement model is NOT created here — it references `documents` table which doesn't exist yet. Statement model is added in Task 10 after Document is created.

**Step 1: Create `api/app/models/credit_card.py`**

```python
import uuid
from datetime import datetime
from decimal import Decimal
from sqlalchemy import String, DateTime, Integer, Numeric, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class CreditCard(Base):
    __tablename__ = "credit_cards"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=func.uuidv7()
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE")
    )
    account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="CASCADE")
    )
    bank_name: Mapped[str] = mapped_column(String(255), nullable=False)
    last_four: Mapped[str] = mapped_column(String(4), nullable=False)
    credit_limit: Mapped[Decimal | None] = mapped_column(Numeric(15, 2), nullable=True)
    statement_day: Mapped[int] = mapped_column(Integer, nullable=False)
    due_day: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
```

**Step 2: Create `api/app/services/credit_card.py`**

Two separate functions: one for the last **closed** statement (what you owe), one for the **open** billing period (where new charges go).

```python
from datetime import date
import calendar


def get_closed_statement_period(statement_day: int, reference: date | None = None) -> dict:
    """
    Returns the most recently CLOSED statement period.
    Used for: "what is my current outstanding bill?"

    Example: statement_day=15, today=Feb 19
    → period_start: Jan 16, period_end: Feb 15  (this statement is outstanding)
    """
    today = reference or date.today()

    if today.day > statement_day:
        # Statement already closed this month
        close_year, close_month = today.year, today.month
    else:
        # Statement hasn't closed yet this month; last close was previous month
        close_month = today.month - 1 if today.month > 1 else 12
        close_year = today.year if today.month > 1 else today.year - 1

    close_day = min(statement_day, calendar.monthrange(close_year, close_month)[1])
    period_end = date(close_year, close_month, close_day)

    # Period started the day after the previous close
    prev_month = close_month - 1 if close_month > 1 else 12
    prev_year = close_year if close_month > 1 else close_year - 1
    start_day = min(statement_day + 1, calendar.monthrange(prev_year, prev_month)[1])
    period_start = date(prev_year, prev_month, start_day)

    return {"period_start": period_start, "period_end": period_end}


def get_open_billing_period(statement_day: int, reference: date | None = None) -> dict:
    """
    Returns the currently OPEN billing period (where new charges are being recorded).
    Used for: "which period does this new transaction belong to?"

    Example: statement_day=15, today=Feb 19
    → period_start: Feb 16, period_end: Mar 15  (charges after Feb 15 go here)
    """
    closed = get_closed_statement_period(statement_day, reference)
    closed_end = closed["period_end"]

    # Open period starts the day after the last close
    open_start_month = closed_end.month + 1 if closed_end.month < 12 else 1
    open_start_year = closed_end.year if closed_end.month < 12 else closed_end.year + 1
    open_start_day = min(statement_day + 1, calendar.monthrange(open_start_year, open_start_month)[1])
    period_start = date(open_start_year, open_start_month, open_start_day)

    # Open period ends on statement_day of the following month
    open_end_month = open_start_month + 1 if open_start_month < 12 else 1
    open_end_year = open_start_year if open_start_month < 12 else open_start_year + 1
    open_end_day = min(statement_day, calendar.monthrange(open_end_year, open_end_month)[1])
    period_end = date(open_end_year, open_end_month, open_end_day)

    return {"period_start": period_start, "period_end": period_end}


def get_due_date(statement_day: int, due_day: int, reference: date | None = None) -> date:
    """
    Returns the payment due date for the currently outstanding statement.
    """
    closed = get_closed_statement_period(statement_day, reference)
    period_end = closed["period_end"]

    due_month = period_end.month + 1 if period_end.month < 12 else 1
    due_year = period_end.year if period_end.month < 12 else period_end.year + 1
    due_day_actual = min(due_day, calendar.monthrange(due_year, due_month)[1])
    return date(due_year, due_month, due_day_actual)


def days_until_due(due_date: date, reference: date | None = None) -> int:
    today = reference or date.today()
    return (due_date - today).days
```

**Step 3: Write failing tests first**

Create `api/tests/test_credit_card_service.py`:

```python
from datetime import date
from app.services.credit_card import (
    get_closed_statement_period,
    get_open_billing_period,
    get_due_date,
    days_until_due,
)


def test_closed_period_after_statement_day():
    # statement_day=15, today=Feb 19 (after close) → last close was Feb 15
    result = get_closed_statement_period(15, reference=date(2026, 2, 19))
    assert result["period_end"] == date(2026, 2, 15)
    assert result["period_start"] == date(2026, 1, 16)


def test_closed_period_before_statement_day():
    # statement_day=25, today=Feb 19 (before close) → last close was Jan 25
    result = get_closed_statement_period(25, reference=date(2026, 2, 19))
    assert result["period_end"] == date(2026, 1, 25)
    assert result["period_start"] == date(2025, 12, 26)


def test_open_period_after_statement_day():
    # statement_day=15, today=Feb 19 → open period is Feb 16 – Mar 15
    result = get_open_billing_period(15, reference=date(2026, 2, 19))
    assert result["period_start"] == date(2026, 2, 16)
    assert result["period_end"] == date(2026, 3, 15)


def test_due_date():
    # statement_day=15, due_day=3, today=Feb 19 → due Mar 3
    due = get_due_date(15, 3, reference=date(2026, 2, 19))
    assert due == date(2026, 3, 3)


def test_days_until_due():
    assert days_until_due(date(2026, 3, 3), reference=date(2026, 2, 19)) == 12


def test_days_until_due_overdue():
    assert days_until_due(date(2026, 2, 10), reference=date(2026, 2, 19)) == -9


def test_statement_day_on_last_day_of_month():
    # statement_day=31, Feb only has 28 days — should not crash
    result = get_closed_statement_period(31, reference=date(2026, 2, 19))
    assert result["period_end"].month in (1, 2)
```

**Step 4: Run tests**

```bash
uv run pytest tests/test_credit_card_service.py -v
```

Expected: PASS (pure logic, no DB)

**Step 5: Create `api/app/schemas/credit_card.py`**

```python
import uuid
from datetime import date
from decimal import Decimal
from pydantic import BaseModel, field_validator


class CreditCardCreate(BaseModel):
    account_id: uuid.UUID
    bank_name: str
    last_four: str
    credit_limit: Decimal | None = None
    statement_day: int
    due_day: int

    @field_validator("statement_day", "due_day")
    @classmethod
    def validate_day(cls, v: int) -> int:
        if not 1 <= v <= 28:
            raise ValueError("Day must be between 1 and 28 (capped at 28 to avoid month-end edge cases)")
        return v

    @field_validator("last_four")
    @classmethod
    def validate_last_four(cls, v: str) -> str:
        if not v.isdigit() or len(v) != 4:
            raise ValueError("last_four must be exactly 4 digits")
        return v


class CreditCardResponse(BaseModel):
    id: uuid.UUID
    account_id: uuid.UUID
    bank_name: str
    last_four: str
    credit_limit: Decimal | None
    statement_day: int
    due_day: int
    closed_period: dict | None = None   # injected: last closed statement period
    open_period: dict | None = None     # injected: current open billing period
    due_date: date | None = None        # injected: next payment due date
    days_until_due: int | None = None   # injected

    model_config = {"from_attributes": True}
```

**Step 6: Create router + generate migration**

Create `api/app/routers/credit_cards.py` with CRUD endpoints. The list/get endpoints inject `closed_period`, `open_period`, `due_date`, `days_until_due` from the service.

```bash
uv run alembic revision --autogenerate -m "create_credit_cards"
uv run alembic upgrade head
```

Add to `main.py`: `from app.routers import credit_cards as cc_router` and `app.include_router(cc_router.router)`.

**Step 7: Commit**

```bash
git add api/app/models/credit_card.py api/app/services/credit_card.py api/app/schemas/credit_card.py api/app/routers/credit_cards.py api/migrations/ api/tests/test_credit_card_service.py
git commit -m "feat: add CreditCard model, two-function statement period service with tests"
```

---

## Task 8: Category Model + Alembic Data Migration

**Files:**
- Create: `api/app/models/category.py`
- Create: `api/app/schemas/category.py`
- Create: `api/app/routers/categories.py`
- Create: `api/migrations/versions/<hash>_seed_categories.py`

**Step 1: Create `api/app/models/category.py`**

```python
import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, Boolean, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=func.uuidv7()
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True,
        comment="NULL for system categories, set for user-created categories"
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    icon: Mapped[str | None] = mapped_column(String(50), nullable=True)
    color: Mapped[str | None] = mapped_column(String(7), nullable=True)
    type: Mapped[str] = mapped_column(String(20), nullable=False)  # income | expense | transfer
    is_system: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
```

**Step 2: Generate schema migration**

```bash
uv run alembic revision --autogenerate -m "create_categories"
uv run alembic upgrade head
```

**Step 3: Create seed data migration**

```bash
uv run alembic revision -m "seed_system_categories"
```

Edit the generated file — add `upgrade()` that inserts all system categories and `downgrade()` that deletes them:

```python
from alembic import op
import sqlalchemy as sa

CATEGORIES = [
    # Income
    ("Salary", "income", "💼", "#22c55e"),
    ("13th Month Pay", "income", "🎁", "#22c55e"),
    ("Bonus / Incentive", "income", "⭐", "#22c55e"),
    ("Overtime Pay", "income", "⏰", "#22c55e"),
    ("Freelance / Project", "income", "💻", "#16a34a"),
    ("Business Revenue", "income", "🏪", "#16a34a"),
    ("Consulting / Professional Fees", "income", "🤝", "#16a34a"),
    ("Rental Income", "income", "🏠", "#16a34a"),
    ("Interest Income", "income", "💰", "#16a34a"),
    ("Dividends", "income", "📈", "#16a34a"),
    ("Capital Gains", "income", "📊", "#16a34a"),
    ("SSS Benefit", "income", "🏛️", "#15803d"),
    ("PhilHealth Reimbursement", "income", "🏥", "#15803d"),
    ("Pag-IBIG Dividend", "income", "🏦", "#15803d"),
    ("Government Aid / Ayuda", "income", "🤲", "#15803d"),
    ("Remittance Received", "income", "✈️", "#15803d"),
    ("Gift / Cash Gift", "income", "🎀", "#15803d"),
    ("Tax Refund", "income", "📋", "#15803d"),
    ("Sale of Items", "income", "🛍️", "#15803d"),
    ("Refund / Cashback", "income", "↩️", "#15803d"),
    ("Other Income", "income", "➕", "#15803d"),
    # Expense — Food
    ("Groceries", "expense", "🛒", "#f97316"),
    ("Dining Out", "expense", "🍽️", "#f97316"),
    ("Food Delivery", "expense", "🛵", "#f97316"),
    ("Coffee & Drinks", "expense", "☕", "#f97316"),
    ("Snacks", "expense", "🍿", "#f97316"),
    # Expense — Housing & Utilities
    ("Rent / Amortization", "expense", "🏠", "#3b82f6"),
    ("Electricity", "expense", "⚡", "#3b82f6"),
    ("Water", "expense", "💧", "#3b82f6"),
    ("Internet / Broadband", "expense", "📡", "#3b82f6"),
    ("Mobile / Postpaid", "expense", "📱", "#3b82f6"),
    ("Gas / LPG", "expense", "🔥", "#3b82f6"),
    ("Home Supplies", "expense", "🧹", "#3b82f6"),
    ("Home Maintenance", "expense", "🔧", "#3b82f6"),
    ("Condo / HOA Dues", "expense", "🏢", "#3b82f6"),
    # Expense — Transportation
    ("Public Transit", "expense", "🚌", "#8b5cf6"),
    ("Ride-Hailing", "expense", "🚗", "#8b5cf6"),
    ("Fuel / Gas", "expense", "⛽", "#8b5cf6"),
    ("Toll Fees", "expense", "🛣️", "#8b5cf6"),
    ("Vehicle Maintenance", "expense", "🔩", "#8b5cf6"),
    ("Parking", "expense", "🅿️", "#8b5cf6"),
    # Expense — Healthcare
    ("Medicine / Pharmacy", "expense", "💊", "#ec4899"),
    ("Doctor / Clinic", "expense", "🏥", "#ec4899"),
    ("Hospital / Procedure", "expense", "🩺", "#ec4899"),
    ("Health Insurance / HMO", "expense", "🛡️", "#ec4899"),
    ("Gym / Fitness", "expense", "🏋️", "#ec4899"),
    ("Wellness / Self-Care", "expense", "💆", "#ec4899"),
    # Expense — Financial Obligations
    ("Credit Card Interest & Fees", "expense", "💳", "#ef4444"),
    ("Loan Interest", "expense", "🏦", "#ef4444"),
    ("SSS Contribution", "expense", "🏛️", "#ef4444"),
    ("PhilHealth Contribution", "expense", "🏥", "#ef4444"),
    ("Pag-IBIG Contribution", "expense", "🏦", "#ef4444"),
    ("Tax Payment", "expense", "📋", "#ef4444"),
    # Expense — Insurance
    ("Life Insurance Premium", "expense", "🛡️", "#64748b"),
    ("Non-Life Insurance", "expense", "🚘", "#64748b"),
    # Expense — Education
    ("Tuition / School Fees", "expense", "🎓", "#0ea5e9"),
    ("School Supplies", "expense", "📚", "#0ea5e9"),
    ("Training / Online Course", "expense", "💡", "#0ea5e9"),
    ("Dependent Allowance", "expense", "👨‍👩‍👧", "#0ea5e9"),
    # Expense — Subscriptions
    ("Streaming", "expense", "📺", "#a855f7"),
    ("Software / Cloud", "expense", "☁️", "#a855f7"),
    ("Gaming", "expense", "🎮", "#a855f7"),
    # Expense — Shopping
    ("Clothing & Apparel", "expense", "👗", "#f59e0b"),
    ("Gadgets & Electronics", "expense", "🖥️", "#f59e0b"),
    ("Online Shopping", "expense", "🛍️", "#f59e0b"),
    ("Personal Care / Beauty", "expense", "💄", "#f59e0b"),
    # Expense — Family & Social
    ("Family Support / Allowance", "expense", "👨‍👩‍👧", "#10b981"),
    ("Gift / Pasalubong", "expense", "🎁", "#10b981"),
    ("Celebrations", "expense", "🎉", "#10b981"),
    ("Charitable Giving", "expense", "🙏", "#10b981"),
    # Expense — Travel
    ("Accommodation", "expense", "🏨", "#06b6d4"),
    ("Airfare / Long-Distance", "expense", "✈️", "#06b6d4"),
    ("Tourist Activities", "expense", "🏖️", "#06b6d4"),
    # Expense — Misc
    ("Bank / Transaction Fees", "expense", "🏦", "#6b7280"),
    ("ATM Fees", "expense", "🏧", "#6b7280"),
    ("Government Fees", "expense", "🏛️", "#6b7280"),
    ("Pet Care", "expense", "🐾", "#6b7280"),
    ("Other / Miscellaneous", "expense", "📦", "#6b7280"),
    # Transfer
    ("Bank to Bank", "transfer", "🏦", "#94a3b8"),
    ("Bank to E-Wallet", "transfer", "📲", "#94a3b8"),
    ("E-Wallet to Bank", "transfer", "🏧", "#94a3b8"),
    ("ATM Withdrawal", "transfer", "🏧", "#94a3b8"),
    ("To Savings / Investment", "transfer", "💹", "#94a3b8"),
    ("GCash / Maya Send", "transfer", "📤", "#94a3b8"),
    ("Bank Transfer to Person", "transfer", "👤", "#94a3b8"),
    ("Remittance Sent", "transfer", "🌏", "#94a3b8"),
    ("Credit Card Payment", "transfer", "💳", "#94a3b8"),
    ("Loan Principal Payment", "transfer", "📉", "#94a3b8"),
]


def upgrade() -> None:
    categories_table = sa.table(
        "categories",
        sa.column("id", sa.String),
        sa.column("user_id", sa.String),
        sa.column("name", sa.String),
        sa.column("type", sa.String),
        sa.column("icon", sa.String),
        sa.column("color", sa.String),
        sa.column("is_system", sa.Boolean),
    )
    op.bulk_insert(
        categories_table,
        [
            {"id": sa.text("uuidv7()"), "user_id": None, "name": name,
             "type": ctype, "icon": icon, "color": color, "is_system": True}
            for name, ctype, icon, color in CATEGORIES
        ],
    )


def downgrade() -> None:
    op.execute("DELETE FROM categories WHERE is_system = TRUE")
```

```bash
uv run alembic upgrade head
```

**Step 4: Update `api/app/models/__init__.py`**

```python
from app.models.user import User  # noqa: F401
from app.models.account import Account  # noqa: F401
from app.models.credit_card import CreditCard  # noqa: F401
from app.models.category import Category  # noqa: F401
```

**Step 5: Commit**

```bash
git add api/app/models/category.py api/app/schemas/category.py api/app/routers/categories.py api/migrations/
git commit -m "feat: add Category model with Alembic seed migration (no startup seeding)"
```

---

## Task 9: Document Model (must come before Statement)

**Files:**
- Create: `api/app/models/document.py`
- Create: `api/app/tasks/celery.py`
- Create: `api/app/tasks/documents.py`

**Critical ordering note:** Document table is created here (Task 9) before Statement (Task 10) because Statement has a FK to `documents.id`. Do not reorder these tasks.

**Step 1: Create `api/app/models/document.py`**

```python
import enum
import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, Text, func, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class DocumentType(str, enum.Enum):
    receipt = "receipt"
    cc_statement = "cc_statement"
    other = "other"


class DocumentStatus(str, enum.Enum):
    pending = "pending"
    processing = "processing"
    done = "done"
    failed = "failed"


class DocumentSourceModel(str, enum.Enum):
    manual_paste = "manual_paste"
    gemini = "gemini"
    claude = "claude"
    ollama = "ollama"


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=func.uuidv7()
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    filename: Mapped[str] = mapped_column(String(500), nullable=False)
    file_path: Mapped[str] = mapped_column(String(1000), nullable=False)
    document_type: Mapped[DocumentType] = mapped_column(nullable=False)
    status: Mapped[DocumentStatus] = mapped_column(default=DocumentStatus.pending)
    celery_task_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    source_model: Mapped[DocumentSourceModel | None] = mapped_column(nullable=True)
    extracted_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
```

**Step 2: Create `api/app/tasks/celery.py`**

```python
from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "finance",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["app.tasks.documents", "app.tasks.notifications"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="Asia/Manila",
    enable_utc=True,
)
```

**Step 3: Create placeholder `api/app/tasks/documents.py`**

```python
from app.tasks.celery import celery_app
from app.core.logging import log


@celery_app.task(bind=True, max_retries=3)
def process_document(self, document_id: str) -> dict:
    """OCR/PDF parsing — implemented in Phase 2."""
    log.info("process_document.placeholder", document_id=document_id)
    return {"status": "placeholder"}
```

**Step 4: Update `api/app/models/__init__.py`**

```python
from app.models.user import User  # noqa: F401
from app.models.account import Account  # noqa: F401
from app.models.credit_card import CreditCard  # noqa: F401
from app.models.category import Category  # noqa: F401
from app.models.document import Document  # noqa: F401
```

**Step 5: Generate migration**

```bash
uv run alembic revision --autogenerate -m "create_documents"
uv run alembic upgrade head
```

**Step 6: Commit**

```bash
git add api/app/models/document.py api/app/tasks/ api/migrations/
git commit -m "feat: add Document model and Celery setup (before Statement — FK ordering)"
```

---

## Task 10: Statement Model + Transaction Model

**Files:**
- Create: `api/app/models/statement.py`
- Create: `api/app/models/transaction.py`
- Create: `api/app/schemas/transaction.py`
- Create: `api/app/routers/transactions.py`
- Test: `api/tests/test_transactions.py`

**Step 1: Create `api/app/models/statement.py`**

Now safe to create — `documents` table exists from Task 9.

```python
import uuid
from datetime import datetime, date
from decimal import Decimal
from sqlalchemy import String, DateTime, Date, Numeric, Boolean, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class Statement(Base):
    __tablename__ = "statements"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=func.uuidv7()
    )
    credit_card_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("credit_cards.id", ondelete="CASCADE")
    )
    document_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("documents.id", ondelete="SET NULL"), nullable=True
    )
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    total_amount: Mapped[Decimal | None] = mapped_column(Numeric(15, 2), nullable=True)
    minimum_due: Mapped[Decimal | None] = mapped_column(Numeric(15, 2), nullable=True)
    is_paid: Mapped[bool] = mapped_column(Boolean, default=False)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
```

**Step 2: Create `api/app/models/transaction.py`**

Includes `fee_amount` and `fee_category_id` for ATM withdrawals and other transactions with bank fees.

```python
import enum
import uuid
from datetime import datetime, date
from decimal import Decimal
from sqlalchemy import String, DateTime, Date, Numeric, ForeignKey, func, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class TransactionType(str, enum.Enum):
    income = "income"
    expense = "expense"
    transfer = "transfer"


class TransactionSubType(str, enum.Enum):
    # Income
    salary = "salary"
    thirteenth_month = "thirteenth_month"
    bonus = "bonus"
    overtime = "overtime"
    freelance = "freelance"
    business = "business"
    consulting = "consulting"
    rental = "rental"
    interest = "interest"
    dividends = "dividends"
    capital_gains = "capital_gains"
    sss_benefit = "sss_benefit"
    philhealth_reimbursement = "philhealth_reimbursement"
    pagibig_dividend = "pagibig_dividend"
    government_aid = "government_aid"
    remittance_received = "remittance_received"
    gift_received = "gift_received"
    tax_refund = "tax_refund"
    sale_of_items = "sale_of_items"
    refund_cashback = "refund_cashback"
    other_income = "other_income"
    # Expense
    regular = "regular"
    gift_given = "gift_given"
    bill_payment = "bill_payment"
    subscription = "subscription"
    other_expense = "other_expense"
    # Transfer
    own_account = "own_account"
    sent_to_person = "sent_to_person"
    atm_withdrawal = "atm_withdrawal"


class TransactionSource(str, enum.Enum):
    manual = "manual"
    paste_ai = "paste_ai"
    pdf = "pdf"
    csv_import = "csv_import"


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=func.uuidv7()
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("accounts.id"), nullable=False
    )
    category_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("categories.id"), nullable=True
    )
    to_account_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("accounts.id"), nullable=True,
        comment="For transfer type: destination account (own_account sub_type only)"
    )
    document_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("documents.id"), nullable=True
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    type: Mapped[TransactionType] = mapped_column(nullable=False)
    sub_type: Mapped[TransactionSubType | None] = mapped_column(nullable=True)
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    source: Mapped[TransactionSource] = mapped_column(default=TransactionSource.manual)

    # ATM withdrawal fee support
    # Example: withdraw ₱5,000 from GCash at other bank ATM
    #   amount = 5000.00 (what you received as cash)
    #   fee_amount = 18.00 (ATM fee charged by bank)
    #   Total deducted from account = 5,018.00
    #   fee_category defaults to "ATM Fees" or "Bank / Transaction Fees"
    fee_amount: Mapped[Decimal | None] = mapped_column(
        Numeric(15, 2), nullable=True,
        comment="Optional fee charged on this transaction (e.g. ATM fee, bank charge)"
    )
    fee_category_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("categories.id"), nullable=True,
        comment="Category for the fee (defaults to ATM Fees / Bank Transaction Fees)"
    )

    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
```

**Step 3: Create `api/app/schemas/transaction.py`**

```python
import uuid
from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel, model_validator
from app.models.transaction import TransactionType, TransactionSubType, TransactionSource


class TransactionCreate(BaseModel):
    account_id: uuid.UUID
    category_id: uuid.UUID | None = None
    to_account_id: uuid.UUID | None = None
    amount: Decimal
    description: str = ""
    type: TransactionType
    sub_type: TransactionSubType | None = None
    date: date
    source: TransactionSource = TransactionSource.manual
    fee_amount: Decimal | None = None
    fee_category_id: uuid.UUID | None = None

    @model_validator(mode="after")
    def validate_transfer_fields(self) -> "TransactionCreate":
        if self.type == TransactionType.transfer:
            if self.sub_type == TransactionSubType.own_account and not self.to_account_id:
                raise ValueError("to_account_id required for own_account transfers")
        if self.amount <= 0:
            raise ValueError("amount must be positive")
        if self.fee_amount is not None and self.fee_amount < 0:
            raise ValueError("fee_amount cannot be negative")
        return self


class TransactionResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    account_id: uuid.UUID
    category_id: uuid.UUID | None
    to_account_id: uuid.UUID | None
    amount: Decimal
    description: str
    type: TransactionType
    sub_type: TransactionSubType | None
    date: date
    source: TransactionSource
    fee_amount: Decimal | None
    fee_category_id: uuid.UUID | None
    created_by: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
```

**Step 4: Create `api/app/routers/transactions.py`** with pagination

```python
import uuid
from datetime import date
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.dependencies import get_current_user
from app.models.transaction import Transaction, TransactionType
from app.models.user import User
from app.schemas.transaction import TransactionCreate, TransactionResponse

router = APIRouter(prefix="/transactions", tags=["transactions"])


@router.get("", response_model=list[TransactionResponse])
async def list_transactions(
    type: TransactionType | None = Query(None),
    account_id: uuid.UUID | None = Query(None),
    category_id: uuid.UUID | None = Query(None),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(Transaction).where(Transaction.user_id == current_user.id)
    if type:
        q = q.where(Transaction.type == type)
    if account_id:
        q = q.where(Transaction.account_id == account_id)
    if category_id:
        q = q.where(Transaction.category_id == category_id)
    if date_from:
        q = q.where(Transaction.date >= date_from)
    if date_to:
        q = q.where(Transaction.date <= date_to)
    q = q.order_by(Transaction.date.desc(), Transaction.created_at.desc())
    q = q.limit(limit).offset(offset)
    result = await db.execute(q)
    return result.scalars().all()


@router.post("", response_model=TransactionResponse, status_code=201)
async def create_transaction(
    data: TransactionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    txn = Transaction(
        **data.model_dump(),
        user_id=current_user.id,
        created_by=current_user.id,
    )
    db.add(txn)
    await db.commit()
    await db.refresh(txn)
    return txn


@router.patch("/{transaction_id}", response_model=TransactionResponse)
async def update_transaction(
    transaction_id: uuid.UUID,
    data: TransactionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Transaction).where(
            Transaction.id == transaction_id,
            Transaction.user_id == current_user.id,
        )
    )
    txn = result.scalar_one_or_none()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(txn, field, value)
    await db.commit()
    await db.refresh(txn)
    return txn


@router.delete("/{transaction_id}", status_code=204)
async def delete_transaction(
    transaction_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Transaction).where(
            Transaction.id == transaction_id,
            Transaction.user_id == current_user.id,
        )
    )
    txn = result.scalar_one_or_none()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    await db.delete(txn)
    await db.commit()
```

**Step 5: Update `api/app/models/__init__.py`**

```python
from app.models.user import User  # noqa: F401
from app.models.account import Account  # noqa: F401
from app.models.credit_card import CreditCard  # noqa: F401
from app.models.category import Category  # noqa: F401
from app.models.document import Document  # noqa: F401
from app.models.statement import Statement  # noqa: F401
from app.models.transaction import Transaction  # noqa: F401
```

**Step 6: Write test for ATM withdrawal fee**

```python
@pytest.mark.asyncio
async def test_atm_withdrawal_with_fee(client):
    """₱5,000 ATM withdrawal with ₱18 fee — total deducted ₱5,018"""
    await client.post("/auth/register", json={"email": "atm@test.com", "name": "ATM", "password": "pw"})
    acct = await client.post("/accounts", json={"name": "GCash", "type": "digital_wallet", "opening_balance": "10000.00"})
    acct_id = acct.json()["id"]
    cash_acct = await client.post("/accounts", json={"name": "Cash Wallet", "type": "cash"})
    cash_id = cash_acct.json()["id"]

    r = await client.post("/transactions", json={
        "account_id": acct_id,
        "to_account_id": cash_id,
        "amount": "5000.00",
        "fee_amount": "18.00",
        "type": "transfer",
        "sub_type": "atm_withdrawal",
        "date": "2026-02-19",
        "description": "ATM withdrawal BDO",
    })
    assert r.status_code == 201
    data = r.json()
    assert data["amount"] == "5000.00"
    assert data["fee_amount"] == "18.00"

    # GCash balance should be 10000 - 5000 (transfer out) - 18 (fee) = 4982
    r = await client.get(f"/accounts/{acct_id}")
    assert r.json()["current_balance"] == "4982.00"
```

**Step 7: Generate migration + run tests**

```bash
uv run alembic revision --autogenerate -m "create_statements_and_transactions"
uv run alembic upgrade head
uv run pytest tests/test_transactions.py -v
```

**Step 8: Commit**

```bash
git add api/app/models/ api/app/schemas/transaction.py api/app/routers/transactions.py api/migrations/
git commit -m "feat: add Statement + Transaction models with ATM fee support and pagination"
```

---

## Task 11: Notion CSV Import Script

**Files:**
- Create: `scripts/import_notion.py`

```python
"""
One-time Notion CSV import script.
Run: cd /home/wsl/personal/expense-tracker && uv run python scripts/import_notion.py
"""
import asyncio
import csv
import re
import sys
from datetime import datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "api"))

from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.models.transaction import Transaction, TransactionType, TransactionSource
from app.models.category import Category
from app.models.account import Account, AccountType
from app.models.user import User


def parse_amount(raw: str) -> Decimal | None:
    if not raw or not raw.strip():
        return None
    cleaned = raw.strip().replace("₱", "").replace(",", "").strip()
    try:
        v = Decimal(cleaned)
        return v if v > 0 else None
    except InvalidOperation:
        return None


def parse_date(raw: str):
    if not raw or not raw.strip():
        return None
    try:
        return datetime.strptime(raw.strip().strip('"'), "%B %d, %Y").date()
    except ValueError:
        return None


def extract_category_name(raw: str) -> str:
    match = re.match(r'^"?([^(]+?)\s*\(https?://', raw.strip())
    return match.group(1).strip() if match else raw.strip().strip('"').strip()


CSV_TO_SYSTEM_CATEGORY = {
    "Food & Drinks": "Dining Out",
    "Groceries": "Groceries",
    "Transport": "Public Transit",
    "Housing": "Rent / Amortization",
    "Entertainment": "Other / Miscellaneous",
    "Subscriptions": "Streaming",
    "Credit Cards and Loans": "Credit Card Interest & Fees",
    "Laguna Waters": "Water",
}


async def main():
    data_dir = Path(__file__).parent.parent / "data"
    csv_files = list(data_dir.glob("Expenses *_all.csv"))
    if not csv_files:
        print("No Expenses *_all.csv found in data/")
        sys.exit(1)

    csv_path = csv_files[0]
    print(f"Importing from: {csv_path}")

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).limit(1))
        user = result.scalar_one_or_none()
        if not user:
            print("No users found. Register first via the API.")
            sys.exit(1)

        acct_result = await db.execute(
            select(Account).where(Account.user_id == user.id, Account.name == "Imported (Cash)")
        )
        account = acct_result.scalar_one_or_none()
        if not account:
            account = Account(
                user_id=user.id, name="Imported (Cash)", type=AccountType.cash
            )
            db.add(account)
            await db.flush()

        imported = skipped = 0

        with open(csv_path, newline="", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                amount = parse_amount(row.get("Amount", ""))
                txn_date = parse_date(row.get("Date", ""))
                if not amount or not txn_date:
                    skipped += 1
                    continue

                cat_name = CSV_TO_SYSTEM_CATEGORY.get(
                    extract_category_name(row.get("Category", "")),
                    "Other / Miscellaneous"
                )
                cat = (await db.execute(select(Category).where(Category.name == cat_name))).scalar_one_or_none()

                db.add(Transaction(
                    user_id=user.id,
                    account_id=account.id,
                    category_id=cat.id if cat else None,
                    amount=amount,
                    description=row.get("Expense", "").strip().strip('"'),
                    type=TransactionType.expense,
                    date=txn_date,
                    source=TransactionSource.csv_import,
                    created_by=user.id,
                ))
                imported += 1

        await db.commit()
        print(f"Done. Imported: {imported}, Skipped: {skipped}")


if __name__ == "__main__":
    asyncio.run(main())
```

**Commit:**

```bash
git add scripts/import_notion.py
git commit -m "feat: add one-time Notion CSV import script"
```

---

## Task 12: Next.js Frontend Setup

**Step 1: Scaffold (Turbopack is default in v16 — no flag needed)**

```bash
cd /home/wsl/personal/expense-tracker
pnpm create next-app@latest frontend \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*"
```

**Step 2: Install shadcn/ui**

```bash
cd frontend
pnpm dlx shadcn@latest init
```

**Step 3: Install dependencies**

```bash
pnpm add @tanstack/react-query lucide-react
pnpm add -D @types/node
```

**Note on PWA:** `next-pwa` (original) is abandoned. Use `@ducanh2912/next-pwa` — the maintained fork:

```bash
pnpm add @ducanh2912/next-pwa
```

Verify it supports Next.js 16 before proceeding. If not, use Next.js App Router's native `manifest.ts` for PWA basics and add a manual `sw.js` service worker.

**Step 4: Add shadcn components**

```bash
pnpm dlx shadcn@latest add button card input label form select badge toast dialog sheet dropdown-menu avatar separator skeleton
```

**Step 5: Create `frontend/Dockerfile`**

```dockerfile
FROM node:22-alpine
WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install
COPY . .
EXPOSE 3000
CMD ["pnpm", "dev"]
```

**Step 6: Create `frontend/src/lib/api.ts`**

Two base URLs — browser uses `NEXT_PUBLIC_API_URL`, SSR uses `API_URL`:

```typescript
function getBaseUrl(): string {
  // Server-side (SSR, RSC): use Docker service name
  if (typeof window === "undefined") {
    return process.env.API_URL || "http://api:8000";
  }
  // Client-side: use public URL (mapped port)
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${getBaseUrl()}${path}`, {
    ...options,
    credentials: "include", // send httpOnly cookies on every request
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(error.detail || response.statusText);
  }

  if (response.status === 204) return undefined as T;
  return response.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
```

**Step 7: Create route group directories**

```bash
mkdir -p "frontend/src/app/(auth)/login"
mkdir -p "frontend/src/app/(auth)/register"
mkdir -p "frontend/src/app/(dashboard)/transactions/new"
mkdir -p "frontend/src/app/(dashboard)/scan"
mkdir -p "frontend/src/app/(dashboard)/cards"
mkdir -p "frontend/src/app/(dashboard)/accounts"
mkdir -p "frontend/src/app/(dashboard)/documents"
mkdir -p "frontend/src/app/(dashboard)/notifications"
mkdir -p "frontend/src/app/(dashboard)/settings"
```

**Step 8: Commit**

```bash
git add frontend/
git commit -m "feat: initialize Next.js 16 frontend with Tailwind v4, shadcn/ui, httpOnly cookie api client"
```

---

## Task 13: Auth Pages (httpOnly Cookie Flow)

**Files:**
- Create: `frontend/src/app/(auth)/layout.tsx`
- Create: `frontend/src/app/(auth)/login/page.tsx`
- Create: `frontend/src/app/(auth)/register/page.tsx`
- Create: `frontend/src/hooks/useAuth.ts`

**Step 1: `useAuth.ts`** — no localStorage; cookies handled by browser automatically

```typescript
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

interface UserResponse {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
}

export function useAuth() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function login(email: string, password: string) {
    setLoading(true);
    setError(null);
    try {
      await api.post<UserResponse>("/auth/login", { email, password });
      // Cookie is set by the server response — no localStorage needed
      router.push("/");
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function register(email: string, name: string, password: string) {
    setLoading(true);
    setError(null);
    try {
      await api.post<UserResponse>("/auth/register", { email, name, password });
      router.push("/");
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await api.post("/auth/logout", {});
    router.push("/login");
    router.refresh();
  }

  return { login, register, logout, error, loading };
}
```

**Step 2: Auth middleware** — create `frontend/src/middleware.ts` to protect dashboard routes

```typescript
import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const token = request.cookies.get("access_token");
  const isAuthRoute = request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/register");

  if (!token && !isAuthRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (token && isAuthRoute) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)"],
};
```

**Step 3: Create login/register pages** using shadcn `Card`, `Form`, `Input`, `Button`. Clean centered layout.

**Step 4: Commit**

```bash
git add frontend/src/app/\(auth\)/ frontend/src/hooks/useAuth.ts frontend/src/middleware.ts
git commit -m "feat: add auth pages with httpOnly cookie flow and Next.js middleware guard"
```

---

## Task 14: Dashboard Layout + Sidebar

Same as before — `Sidebar.tsx` with nav links, responsive sheet drawer on mobile.

**Add `/accounts` to the sidebar nav:**

```
Dashboard (/)
Transactions (/transactions)
Scan Receipt (/scan)
Accounts (/accounts)
Credit Cards (/cards)
Documents (/documents)
Notifications (/notifications)
Settings (/settings)
```

**Commit:**

```bash
git add frontend/src/app/\(dashboard\)/ frontend/src/components/
git commit -m "feat: add dashboard layout with responsive sidebar"
```

---

## Task 15: Dashboard Home Page

Three widgets: Monthly Overview (income / expenses / net), Recent Transactions (last 10), Upcoming Dues (credit cards due in 30 days).

Backend needs a summary endpoint — add `GET /dashboard/summary` to a new `api/app/routers/dashboard.py`:

```python
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case
from datetime import date
from app.core.database import get_db
from app.dependencies import get_current_user
from app.models.transaction import Transaction, TransactionType
from app.models.user import User

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary")
async def summary(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    today = date.today()
    month_start = today.replace(day=1)

    result = await db.execute(
        select(
            func.coalesce(
                func.sum(case((Transaction.type == TransactionType.income, Transaction.amount), else_=0)), 0
            ).label("total_income"),
            func.coalesce(
                func.sum(case((Transaction.type == TransactionType.expense, Transaction.amount), else_=0)), 0
            ).label("total_expenses"),
        ).where(
            Transaction.user_id == current_user.id,
            Transaction.date >= month_start,
            Transaction.date <= today,
        )
    )
    row = result.one()
    return {
        "month": today.strftime("%B %Y"),
        "total_income": row.total_income,
        "total_expenses": row.total_expenses,
        "net": row.total_income - row.total_expenses,
    }
```

**Commit:**

```bash
git add frontend/src/app/\(dashboard\)/page.tsx frontend/src/components/app/ api/app/routers/dashboard.py
git commit -m "feat: add dashboard home with monthly overview, recent transactions, upcoming dues"
```

---

## Task 16: Transaction Pages

- `/transactions` — list with filters (type, date range, account), paginated (50 per page), amounts color-coded
- `/transactions/new` — form: type → sub_type (filtered by type) → account → category → amount → fee_amount (shown for ATM withdrawal sub_type) → description → date

**ATM Withdrawal UI note:** When `sub_type = atm_withdrawal` is selected, show a second "ATM Fee" field (defaults to ₱18). The form should display: "You will receive ₱{amount}. Total deducted: ₱{amount + fee}."

**Commit:**

```bash
git add frontend/src/app/\(dashboard\)/transactions/
git commit -m "feat: add transaction list and new transaction form with ATM fee support"
```

---

## Task 17: Accounts Page

**Files:**
- Create: `frontend/src/app/(dashboard)/accounts/page.tsx`
- Create: `frontend/src/components/app/AccountCard.tsx`

Accounts page shows all accounts with:
- Name, type badge (bank / digital wallet / cash / credit card)
- Opening balance
- **Current balance** (computed, from API)
- "Add Account" button → modal with form

This page was missing from the original plan. It's essential for Phase 1 — without it there's no way to manage accounts through the UI.

**Commit:**

```bash
git add frontend/src/app/\(dashboard\)/accounts/
git commit -m "feat: add accounts management page with computed balance display"
```

---

## Task 18: Credit Cards Page

Same as before — list credit cards with closed period / open period / due date / days remaining.

**Key display:** Show BOTH the closed statement (what you owe now) and the open period (where new charges go). This was the ambiguity in the original plan — both are now surfaced.

**Commit:**

```bash
git add frontend/src/app/\(dashboard\)/cards/
git commit -m "feat: add credit card page with closed and open billing period display"
```

---

## Task 19: Settings Page

- Profile: name, email
- API Keys: Gemini API key, Claude API key (write-only — shown as masked after save, use `type="password"`)

**Commit:**

```bash
git add frontend/src/app/\(dashboard\)/settings/
git commit -m "feat: add settings page"
```

---

## Task 20: Kubernetes Base Manifests

Same structure as before — Kustomize base + overlays. Key addition: `Secret` manifest templates for all sensitive env vars.

```bash
git add k8s/
git commit -m "feat: add Kubernetes base manifests with Kustomize overlays"
```

---

## Task 21: End-to-End Smoke Test

**Step 1: Start everything**

```bash
cd /home/wsl/personal/expense-tracker
docker compose up --build -d
```

**Step 2: Run migrations**

```bash
docker compose exec api uv run alembic upgrade head
```

**Step 3: Verify health**

```bash
curl http://localhost:8000/health
# Expected: {"status": "ok"}
```

**Step 4: Run all API tests**

```bash
docker compose exec api uv run pytest tests/ -v
```

Expected: All PASS, each test isolated via rollback.

**Step 5: Manual smoke test**

```
Open http://localhost:3000
→ Register account
→ Add a bank account (opening balance ₱10,000)
→ Add a GCash account (opening balance ₱5,000)
→ Add a credit card (BPI, statement_day=15, due_day=3)
→ Add a transaction (expense, Groceries, ₱500)
→ Add ATM withdrawal (₱2,000 from GCash, fee ₱18)
→ Verify GCash balance = 5000 - 2000 - 18 = ₱2,982
→ Verify dashboard monthly expense total updated
→ Verify credit card shows correct due date
```

**Step 6: Import Notion data**

```bash
docker compose exec api uv run python scripts/import_notion.py
```

**Step 7: Final commit**

```bash
git add .
git commit -m "chore: phase 1 complete — core finance dashboard"
```

---

## Summary

Phase 1 delivers:
- Two-user auth with httpOnly cookie JWT (no localStorage token exposure)
- Account management with computed balances (no drift)
- Credit card tracking with separate closed-period and open-period functions
- Full transaction CRUD with ATM withdrawal + fee support
- 85+ PH-specific categories via Alembic data migration (no startup race condition)
- Dashboard with monthly overview, recent transactions, upcoming dues
- Paginated transaction list
- Mobile-friendly PWA with responsive sidebar + Next.js middleware auth guard
- Notion CSV import script
- Docker Compose local dev + Kubernetes base manifests

Next: Phase 2 — Smart Input (receipt scan + paste from AI, PDF upload, credit card statement parsing)
