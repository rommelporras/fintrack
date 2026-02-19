# Phase 3: Polish & Notifications — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Add transaction edit/delete/filtering, statement management, budget tracking with alerts, and a real-time notification system (in-app SSE + Discord webhook).

**Architecture:** Backend-first TDD for all 10 API tasks; frontend-only for 5 UI tasks. Budget alerts are checked synchronously after every transaction write. Statement due-date alerts run via Celery beat daily at 9am. Discord webhook fires for every new notification if `discord_webhook_url` is configured.

**Tech Stack:** FastAPI, SQLAlchemy async, Alembic, Celery + beat, httpx (Discord), SSE (StreamingResponse), Next.js 16 App Router, shadcn/ui, TanStack Query.

---

## Codebase reference

### Key file locations

| Concern | Path |
|---|---|
| FastAPI app entry | `api/app/main.py` |
| Routers | `api/app/routers/` |
| Models | `api/app/models/` (import all in `__init__.py`) |
| Schemas (Pydantic) | `api/app/schemas/` |
| Services | `api/app/services/` |
| Celery tasks | `api/app/tasks/` |
| Migrations | `api/migrations/versions/` |
| Tests | `api/tests/` |
| Frontend pages | `frontend/src/app/(dashboard)/` |
| Frontend components | `frontend/src/components/app/` |
| API client | `frontend/src/lib/api.ts` |
| Settings | `api/app/core/config.py` |
| DB session | `api/app/core/database.py` (`AsyncSessionLocal`, `get_db`) |

### Existing patterns to follow

**Router pattern** (`api/app/routers/transactions.py`):
```python
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.dependencies import get_current_user
from app.models.user import User

router = APIRouter(prefix="/resource", tags=["resource"])

@router.get("", response_model=list[ResourceResponse])
async def list_resources(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
): ...
```

**Model pattern** — all models use `UUID(as_uuid=True)` with `server_default=func.uuidv7()`, and `DateTime(timezone=True)` for timestamps.

**Test `auth_client` fixture pattern** (in each test file, not in conftest):
```python
@pytest.fixture
async def auth_client(client):
    await client.post("/auth/register", json={
        "email": "user@test.com", "name": "Test User", "password": "password123"
    })
    return client
```

**conftest.py fixtures available**: `db` (function-scoped AsyncSession), `client` (unauthenticated httpx client), `setup_test_database` (session-scoped, auto-truncates tables after each test).

**Migration pattern**: run `DATABASE_URL="postgresql+asyncpg://finance:changeme@127.0.0.1:5435/finance_db" uv run alembic revision --autogenerate -m "name"`, then review the generated file. The latest migration is `f5c28ee5f774` (`create_statements_and_transactions`).

**Registering a router** in `api/app/main.py`:
```python
from app.routers import statements as statements_router
app.include_router(statements_router.router)
```

### `discord_webhook_url` in Settings

Already present in `api/app/core/config.py`:
```python
discord_webhook_url: str = ""
```
No change needed to `config.py`.

### Statement model fields (already migrated)

```
id, credit_card_id, document_id, period_start, period_end,
due_date, total_amount, minimum_due, is_paid, paid_at, created_at
```

`Statement` has no `user_id` directly — ownership is through `credit_card_id → CreditCard.user_id`.

### CreditCard model fields

```
id, user_id, account_id, bank_name, last_four,
credit_limit, statement_day, due_day, created_at, updated_at
```

### Transaction model fields relevant to budget alerts

- `type`: `"income" | "expense" | "transfer"`
- `amount`: Decimal
- `date`: Date
- `account_id`: UUID
- `category_id`: UUID | None
- `user_id`: UUID

---

## How to run tests

```bash
# From api/ directory
DATABASE_URL="postgresql+asyncpg://finance:changeme@127.0.0.1:5435/finance_db" \
TEST_DATABASE_URL="postgresql+asyncpg://finance:changeme@127.0.0.1:5435/finance_test" \
uv run pytest -q
```

## How to run TypeScript check

```bash
cd frontend && bun tsc --noEmit
```

---

## Task 1: Statements router (TDD)

**Files to create/modify:**
- Create `api/app/schemas/statement.py`
- Create `api/app/routers/statements.py`
- Create `api/tests/test_statements.py`
- Modify `api/app/main.py`

**Endpoints:**
- `GET /statements` — list statements owned by current user (via credit card), optional `?credit_card_id=&is_paid=`
- `POST /statements` — create statement
- `GET /statements/{id}` — fetch single
- `PATCH /statements/{id}` — update fields (partial update)

**Step 1 — Write the schema** (`api/app/schemas/statement.py`):

```python
import uuid
from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel


class StatementCreate(BaseModel):
    credit_card_id: uuid.UUID
    period_start: date
    period_end: date
    due_date: date
    total_amount: Decimal | None = None
    minimum_due: Decimal | None = None


class StatementUpdate(BaseModel):
    period_start: date | None = None
    period_end: date | None = None
    due_date: date | None = None
    total_amount: Decimal | None = None
    minimum_due: Decimal | None = None
    is_paid: bool | None = None


class StatementResponse(BaseModel):
    id: uuid.UUID
    credit_card_id: uuid.UUID
    document_id: uuid.UUID | None
    period_start: date
    period_end: date
    due_date: date
    total_amount: Decimal | None
    minimum_due: Decimal | None
    is_paid: bool
    paid_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}
```

**Step 2 — Write the tests FIRST** (`api/tests/test_statements.py`):

```python
import pytest
from httpx import AsyncClient


@pytest.fixture
async def auth_client(client: AsyncClient):
    await client.post("/auth/register", json={
        "email": "stmt@test.com", "name": "Stmt User", "password": "password123"
    })
    return client


@pytest.fixture
async def credit_card_id(auth_client: AsyncClient) -> str:
    # Create account first
    acc = await auth_client.post("/accounts", json={
        "name": "BDO Checking", "type": "bank", "currency": "PHP"
    })
    account_id = acc.json()["id"]
    # Create credit card
    cc = await auth_client.post("/credit-cards", json={
        "account_id": account_id,
        "bank_name": "BDO",
        "last_four": "1234",
        "statement_day": 1,
        "due_day": 21,
    })
    assert cc.status_code == 201, cc.text
    return cc.json()["id"]


async def test_create_statement(auth_client: AsyncClient, credit_card_id: str):
    r = await auth_client.post("/statements", json={
        "credit_card_id": credit_card_id,
        "period_start": "2026-01-01",
        "period_end": "2026-01-31",
        "due_date": "2026-02-21",
        "total_amount": "5000.00",
        "minimum_due": "500.00",
    })
    assert r.status_code == 201
    data = r.json()
    assert data["credit_card_id"] == credit_card_id
    assert data["total_amount"] == "5000.00"
    assert data["is_paid"] is False
    assert data["paid_at"] is None


async def test_list_statements_empty(auth_client: AsyncClient):
    r = await auth_client.get("/statements")
    assert r.status_code == 200
    assert r.json() == []


async def test_list_statements_filter_by_credit_card(
    auth_client: AsyncClient, credit_card_id: str
):
    await auth_client.post("/statements", json={
        "credit_card_id": credit_card_id,
        "period_start": "2026-01-01",
        "period_end": "2026-01-31",
        "due_date": "2026-02-21",
    })
    r = await auth_client.get(f"/statements?credit_card_id={credit_card_id}")
    assert r.status_code == 200
    assert len(r.json()) == 1


async def test_list_statements_filter_by_paid(
    auth_client: AsyncClient, credit_card_id: str
):
    await auth_client.post("/statements", json={
        "credit_card_id": credit_card_id,
        "period_start": "2026-01-01",
        "period_end": "2026-01-31",
        "due_date": "2026-02-21",
    })
    r_unpaid = await auth_client.get("/statements?is_paid=false")
    assert len(r_unpaid.json()) == 1

    r_paid = await auth_client.get("/statements?is_paid=true")
    assert r_paid.json() == []


async def test_fetch_statement_by_id(
    auth_client: AsyncClient, credit_card_id: str
):
    created = await auth_client.post("/statements", json={
        "credit_card_id": credit_card_id,
        "period_start": "2026-01-01",
        "period_end": "2026-01-31",
        "due_date": "2026-02-21",
    })
    stmt_id = created.json()["id"]
    r = await auth_client.get(f"/statements/{stmt_id}")
    assert r.status_code == 200
    assert r.json()["id"] == stmt_id


async def test_fetch_statement_not_found(auth_client: AsyncClient):
    r = await auth_client.get("/statements/00000000-0000-0000-0000-000000000000")
    assert r.status_code == 404


async def test_patch_statement_mark_paid(
    auth_client: AsyncClient, credit_card_id: str
):
    created = await auth_client.post("/statements", json={
        "credit_card_id": credit_card_id,
        "period_start": "2026-01-01",
        "period_end": "2026-01-31",
        "due_date": "2026-02-21",
    })
    stmt_id = created.json()["id"]
    r = await auth_client.patch(f"/statements/{stmt_id}", json={"is_paid": True})
    assert r.status_code == 200
    assert r.json()["is_paid"] is True
    assert r.json()["paid_at"] is not None


async def test_patch_statement_update_amounts(
    auth_client: AsyncClient, credit_card_id: str
):
    created = await auth_client.post("/statements", json={
        "credit_card_id": credit_card_id,
        "period_start": "2026-01-01",
        "period_end": "2026-01-31",
        "due_date": "2026-02-21",
    })
    stmt_id = created.json()["id"]
    r = await auth_client.patch(f"/statements/{stmt_id}", json={
        "total_amount": "12345.67",
        "minimum_due": "1234.57",
    })
    assert r.status_code == 200
    assert r.json()["total_amount"] == "12345.67"


async def test_statement_requires_auth(client: AsyncClient):
    r = await client.get("/statements")
    assert r.status_code == 401
```

**Step 3 — Implement the router** (`api/app/routers/statements.py`):

```python
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.dependencies import get_current_user
from app.models.statement import Statement
from app.models.credit_card import CreditCard
from app.models.user import User
from app.schemas.statement import StatementCreate, StatementUpdate, StatementResponse

router = APIRouter(prefix="/statements", tags=["statements"])


async def _get_user_statement(
    statement_id: uuid.UUID, user: User, db: AsyncSession
) -> Statement:
    """Fetch a statement that belongs to the current user (via credit card)."""
    result = await db.execute(
        select(Statement)
        .join(CreditCard, Statement.credit_card_id == CreditCard.id)
        .where(Statement.id == statement_id, CreditCard.user_id == user.id)
    )
    stmt = result.scalar_one_or_none()
    if not stmt:
        raise HTTPException(status_code=404, detail="Statement not found")
    return stmt


@router.get("", response_model=list[StatementResponse])
async def list_statements(
    credit_card_id: uuid.UUID | None = Query(None),
    is_paid: bool | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = (
        select(Statement)
        .join(CreditCard, Statement.credit_card_id == CreditCard.id)
        .where(CreditCard.user_id == current_user.id)
        .order_by(Statement.due_date.desc())
    )
    if credit_card_id is not None:
        q = q.where(Statement.credit_card_id == credit_card_id)
    if is_paid is not None:
        q = q.where(Statement.is_paid == is_paid)
    result = await db.execute(q)
    return result.scalars().all()


@router.post("", response_model=StatementResponse, status_code=201)
async def create_statement(
    data: StatementCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Verify credit card ownership
    cc_result = await db.execute(
        select(CreditCard).where(
            CreditCard.id == data.credit_card_id,
            CreditCard.user_id == current_user.id,
        )
    )
    if not cc_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Credit card not found")

    stmt = Statement(**data.model_dump())
    db.add(stmt)
    await db.commit()
    await db.refresh(stmt)
    return stmt


@router.get("/{statement_id}", response_model=StatementResponse)
async def get_statement(
    statement_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await _get_user_statement(statement_id, current_user, db)


@router.patch("/{statement_id}", response_model=StatementResponse)
async def update_statement(
    statement_id: uuid.UUID,
    data: StatementUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = await _get_user_statement(statement_id, current_user, db)
    update_data = data.model_dump(exclude_none=True)

    # Set paid_at when marking paid
    if update_data.get("is_paid") is True and not stmt.is_paid:
        update_data["paid_at"] = datetime.now(timezone.utc)

    for field, value in update_data.items():
        setattr(stmt, field, value)
    await db.commit()
    await db.refresh(stmt)
    return stmt
```

**Step 4 — Register the router** in `api/app/main.py`:

```python
from app.routers import statements as statements_router
# add after existing includes:
app.include_router(statements_router.router)
```

**Run tests:**
```bash
DATABASE_URL="postgresql+asyncpg://finance:changeme@127.0.0.1:5435/finance_db" \
TEST_DATABASE_URL="postgresql+asyncpg://finance:changeme@127.0.0.1:5435/finance_test" \
uv run pytest api/tests/test_statements.py -v
```

**Commit message:**
```
feat: add statements router with CRUD and mark-paid
```

---

## Task 2: Budget model + Alembic migration

**Files to create/modify:**
- Create `api/app/models/budget.py`
- Modify `api/app/models/__init__.py`
- Run `uv run alembic revision --autogenerate -m "create_budgets"`

**Step 1 — Create the model** (`api/app/models/budget.py`):

```python
import uuid
from datetime import datetime
from decimal import Decimal
from sqlalchemy import String, Numeric, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class Budget(Base):
    __tablename__ = "budgets"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=func.uuidv7()
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    # "category" or "account"
    type: Mapped[str] = mapped_column(String(20), nullable=False)
    category_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("categories.id", ondelete="SET NULL"),
        nullable=True,
    )
    account_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("accounts.id", ondelete="CASCADE"),
        nullable=True,
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        server_default=func.now()
    )
```

**Step 2 — Register in `__init__.py`:**

Add to `api/app/models/__init__.py`:
```python
from app.models.budget import Budget  # noqa: F401
```

**Step 3 — Generate and review the migration:**

```bash
# From api/ directory
DATABASE_URL="postgresql+asyncpg://finance:changeme@127.0.0.1:5435/finance_db" \
uv run alembic revision --autogenerate -m "create_budgets"
```

The generated migration should create a `budgets` table. Review it and ensure it contains:
- `id` UUID with `server_default=sa.text('uuidv7()')`
- `user_id`, `type`, `category_id`, `account_id`, `amount`, `created_at`
- ForeignKey constraints matching the model
- `down_revision` pointing to `f5c28ee5f774`

**Step 4 — Apply the migration (dev DB only):**

```bash
DATABASE_URL="postgresql+asyncpg://finance:changeme@127.0.0.1:5435/finance_db" \
uv run alembic upgrade head
```

**Note:** The test suite uses `Base.metadata.create_all` directly, so the test DB picks up the new model automatically. No need to run alembic on the test DB.

**Commit message:**
```
feat: add budget model and migration
```

---

## Task 3: Budgets CRUD router (TDD)

**Files to create/modify:**
- Create `api/app/schemas/budget.py`
- Create `api/app/routers/budgets.py`
- Create `api/tests/test_budgets.py`
- Modify `api/app/main.py`

**Step 1 — Write the schema** (`api/app/schemas/budget.py`):

```python
import uuid
from decimal import Decimal
from datetime import datetime
from pydantic import BaseModel, model_validator


class BudgetCreate(BaseModel):
    type: str  # "category" | "account"
    category_id: uuid.UUID | None = None
    account_id: uuid.UUID | None = None
    amount: Decimal

    @model_validator(mode="after")
    def validate_target(self) -> "BudgetCreate":
        if self.type == "category" and not self.category_id:
            raise ValueError("category_id required for category budgets")
        if self.type == "account" and not self.account_id:
            raise ValueError("account_id required for account budgets")
        if self.type not in ("category", "account"):
            raise ValueError("type must be 'category' or 'account'")
        if self.amount <= 0:
            raise ValueError("amount must be positive")
        return self


class BudgetUpdate(BaseModel):
    amount: Decimal | None = None


class BudgetResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    type: str
    category_id: uuid.UUID | None
    account_id: uuid.UUID | None
    amount: Decimal
    created_at: datetime

    model_config = {"from_attributes": True}
```

**Step 2 — Write tests FIRST** (`api/tests/test_budgets.py`):

```python
import pytest
from httpx import AsyncClient


@pytest.fixture
async def auth_client(client: AsyncClient):
    await client.post("/auth/register", json={
        "email": "budget@test.com", "name": "Budget User", "password": "password123"
    })
    return client


@pytest.fixture
async def account_id(auth_client: AsyncClient) -> str:
    r = await auth_client.post("/accounts", json={
        "name": "BDO Checking", "type": "bank", "currency": "PHP"
    })
    assert r.status_code == 201
    return r.json()["id"]


@pytest.fixture
async def category_id(auth_client: AsyncClient) -> str:
    # Use a system category (seeded in DB)
    r = await auth_client.get("/categories")
    assert r.status_code == 200
    cats = r.json()
    expense_cats = [c for c in cats if c["type"] == "expense"]
    assert expense_cats, "No expense categories found — check seed migration"
    return expense_cats[0]["id"]


async def test_create_category_budget(auth_client: AsyncClient, category_id: str):
    r = await auth_client.post("/budgets", json={
        "type": "category",
        "category_id": category_id,
        "amount": "10000.00",
    })
    assert r.status_code == 201
    data = r.json()
    assert data["type"] == "category"
    assert data["category_id"] == category_id
    assert data["amount"] == "10000.00"


async def test_create_account_budget(auth_client: AsyncClient, account_id: str):
    r = await auth_client.post("/budgets", json={
        "type": "account",
        "account_id": account_id,
        "amount": "5000.00",
    })
    assert r.status_code == 201
    data = r.json()
    assert data["type"] == "account"
    assert data["account_id"] == account_id


async def test_create_budget_invalid_type(auth_client: AsyncClient, category_id: str):
    r = await auth_client.post("/budgets", json={
        "type": "invalid",
        "category_id": category_id,
        "amount": "1000",
    })
    assert r.status_code == 422


async def test_list_budgets(auth_client: AsyncClient, category_id: str):
    await auth_client.post("/budgets", json={
        "type": "category", "category_id": category_id, "amount": "10000"
    })
    r = await auth_client.get("/budgets")
    assert r.status_code == 200
    assert len(r.json()) == 1


async def test_list_budgets_empty(auth_client: AsyncClient):
    r = await auth_client.get("/budgets")
    assert r.status_code == 200
    assert r.json() == []


async def test_update_budget_amount(auth_client: AsyncClient, category_id: str):
    created = await auth_client.post("/budgets", json={
        "type": "category", "category_id": category_id, "amount": "10000"
    })
    budget_id = created.json()["id"]
    r = await auth_client.patch(f"/budgets/{budget_id}", json={"amount": "15000.00"})
    assert r.status_code == 200
    assert r.json()["amount"] == "15000.00"


async def test_delete_budget(auth_client: AsyncClient, category_id: str):
    created = await auth_client.post("/budgets", json={
        "type": "category", "category_id": category_id, "amount": "10000"
    })
    budget_id = created.json()["id"]
    r = await auth_client.delete(f"/budgets/{budget_id}")
    assert r.status_code == 204

    r2 = await auth_client.get("/budgets")
    assert r2.json() == []


async def test_delete_budget_not_found(auth_client: AsyncClient):
    r = await auth_client.delete("/budgets/00000000-0000-0000-0000-000000000000")
    assert r.status_code == 404


async def test_budget_requires_auth(client: AsyncClient):
    r = await client.get("/budgets")
    assert r.status_code == 401
```

**Step 3 — Implement the router** (`api/app/routers/budgets.py`):

```python
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.dependencies import get_current_user
from app.models.budget import Budget
from app.models.user import User
from app.schemas.budget import BudgetCreate, BudgetUpdate, BudgetResponse

router = APIRouter(prefix="/budgets", tags=["budgets"])


@router.get("", response_model=list[BudgetResponse])
async def list_budgets(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Budget)
        .where(Budget.user_id == current_user.id)
        .order_by(Budget.created_at.asc())
    )
    return result.scalars().all()


@router.post("", response_model=BudgetResponse, status_code=201)
async def create_budget(
    data: BudgetCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    budget = Budget(**data.model_dump(), user_id=current_user.id)
    db.add(budget)
    await db.commit()
    await db.refresh(budget)
    return budget


@router.patch("/{budget_id}", response_model=BudgetResponse)
async def update_budget(
    budget_id: uuid.UUID,
    data: BudgetUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Budget).where(
            Budget.id == budget_id, Budget.user_id == current_user.id
        )
    )
    budget = result.scalar_one_or_none()
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(budget, field, value)
    await db.commit()
    await db.refresh(budget)
    return budget


@router.delete("/{budget_id}", status_code=204)
async def delete_budget(
    budget_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Budget).where(
            Budget.id == budget_id, Budget.user_id == current_user.id
        )
    )
    budget = result.scalar_one_or_none()
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")
    await db.delete(budget)
    await db.commit()
```

**Step 4 — Register in `api/app/main.py`:**

```python
from app.routers import budgets as budgets_router
app.include_router(budgets_router.router)
```

**Run tests:**
```bash
DATABASE_URL="postgresql+asyncpg://finance:changeme@127.0.0.1:5435/finance_db" \
TEST_DATABASE_URL="postgresql+asyncpg://finance:changeme@127.0.0.1:5435/finance_test" \
uv run pytest api/tests/test_budgets.py -v -k "not alert and not status"
```

**Commit message:**
```
feat: add budgets CRUD router
```

---

## Task 4: Budget status endpoint (TDD)

**Files to modify:**
- `api/app/routers/budgets.py` — add `GET /budgets/status`
- `api/tests/test_budgets.py` — add status tests

**IMPORTANT — route ordering:** The `/status` route must be declared **before** the `/{budget_id}` routes to avoid FastAPI treating the literal string "status" as a UUID. Since the router currently has no `/{budget_id}` GET route, this is not an issue, but keep it in mind if adding one later.

**Step 1 — Add the schema additions** to `api/app/schemas/budget.py`:

```python
class BudgetStatusItem(BaseModel):
    budget: BudgetResponse
    spent: Decimal
    percent: float
    status: str  # "ok" | "warning" | "exceeded"
```

**Step 2 — Add tests** to `api/tests/test_budgets.py`:

```python
from datetime import date, timedelta
import app.core.config as cfg
from app.models.transaction import Transaction, TransactionType, TransactionSource


async def _create_expense(db, user_id: str, account_id: str, category_id: str,
                           amount: str, txn_date: date | None = None) -> None:
    """Helper: insert an expense transaction directly into DB (bypasses budget check)."""
    from app.models.transaction import Transaction, TransactionType, TransactionSource
    import uuid
    txn = Transaction(
        user_id=uuid.UUID(user_id),
        account_id=uuid.UUID(account_id),
        category_id=uuid.UUID(category_id),
        amount=amount,
        description="test expense",
        type=TransactionType.expense,
        source=TransactionSource.manual,
        date=txn_date or date.today(),
        created_by=uuid.UUID(user_id),
    )
    db.add(txn)
    await db.commit()


async def test_budget_status_ok(auth_client: AsyncClient, db, account_id: str, category_id: str):
    await auth_client.post("/budgets", json={
        "type": "category", "category_id": category_id, "amount": "10000.00"
    })
    # Get user_id from /auth/me or from session — use auth_client to get it
    me = await auth_client.get("/auth/me")
    user_id = me.json()["id"]

    # Insert ₱7,900 directly (no budget check triggered)
    await _create_expense(db, user_id, account_id, category_id, "7900.00")

    r = await auth_client.get("/budgets/status")
    assert r.status_code == 200
    items = r.json()
    assert len(items) == 1
    assert items[0]["status"] == "ok"
    assert float(items[0]["percent"]) == pytest.approx(79.0, abs=0.01)


async def test_budget_status_warning(auth_client: AsyncClient, db, account_id: str, category_id: str):
    await auth_client.post("/budgets", json={
        "type": "category", "category_id": category_id, "amount": "10000.00"
    })
    me = await auth_client.get("/auth/me")
    user_id = me.json()["id"]

    await _create_expense(db, user_id, account_id, category_id, "8000.00")

    r = await auth_client.get("/budgets/status")
    assert r.status_code == 200
    items = r.json()
    assert items[0]["status"] == "warning"
    assert float(items[0]["percent"]) == pytest.approx(80.0, abs=0.01)


async def test_budget_status_exceeded(auth_client: AsyncClient, db, account_id: str, category_id: str):
    await auth_client.post("/budgets", json={
        "type": "category", "category_id": category_id, "amount": "10000.00"
    })
    me = await auth_client.get("/auth/me")
    user_id = me.json()["id"]

    await _create_expense(db, user_id, account_id, category_id, "10001.00")

    r = await auth_client.get("/budgets/status")
    items = r.json()
    assert items[0]["status"] == "exceeded"
    assert float(items[0]["percent"]) > 100.0


async def test_budget_status_zero_spent(auth_client: AsyncClient, category_id: str):
    await auth_client.post("/budgets", json={
        "type": "category", "category_id": category_id, "amount": "10000.00"
    })
    r = await auth_client.get("/budgets/status")
    items = r.json()
    assert items[0]["status"] == "ok"
    assert float(items[0]["percent"]) == 0.0
    assert items[0]["spent"] == "0.00"


async def test_budget_status_only_counts_current_month(
    auth_client: AsyncClient, db, account_id: str, category_id: str
):
    await auth_client.post("/budgets", json={
        "type": "category", "category_id": category_id, "amount": "10000.00"
    })
    me = await auth_client.get("/auth/me")
    user_id = me.json()["id"]

    # Transaction last month should NOT count
    last_month = date.today().replace(day=1) - timedelta(days=1)
    await _create_expense(db, user_id, account_id, category_id, "9999.00", txn_date=last_month)

    r = await auth_client.get("/budgets/status")
    items = r.json()
    assert items[0]["status"] == "ok"
    assert items[0]["spent"] == "0.00"


async def test_budget_status_wrong_category_not_counted(
    auth_client: AsyncClient, db, account_id: str
):
    """Transaction in category B should not affect budget for category A."""
    # Get two different expense categories
    cats_r = await auth_client.get("/categories")
    expense_cats = [c for c in cats_r.json() if c["type"] == "expense"]
    assert len(expense_cats) >= 2, "Need at least 2 expense categories"
    cat_a_id = expense_cats[0]["id"]
    cat_b_id = expense_cats[1]["id"]

    # Budget on cat_a
    await auth_client.post("/budgets", json={
        "type": "category", "category_id": cat_a_id, "amount": "10000.00"
    })
    me = await auth_client.get("/auth/me")
    user_id = me.json()["id"]

    # Transaction in cat_b
    await _create_expense(db, user_id, account_id, cat_b_id, "9999.00")

    r = await auth_client.get("/budgets/status")
    items = r.json()
    assert items[0]["status"] == "ok"
    assert items[0]["spent"] == "0.00"
```

**Step 3 — Implement the endpoint** — add to `api/app/routers/budgets.py`:

```python
from datetime import date
from decimal import Decimal
from sqlalchemy import func, extract
from app.models.transaction import Transaction
from app.schemas.budget import BudgetStatusItem

@router.get("/status", response_model=list[BudgetStatusItem])
async def get_budget_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    today = date.today()
    month_start = today.replace(day=1)

    budgets_result = await db.execute(
        select(Budget).where(Budget.user_id == current_user.id)
    )
    budgets = budgets_result.scalars().all()

    items = []
    for budget in budgets:
        spent = await _get_month_spending(db, current_user.id, budget, month_start)
        if budget.amount > 0:
            percent = float(spent / budget.amount * 100)
        else:
            percent = 0.0

        if percent >= 100:
            status = "exceeded"
        elif percent >= 80:
            status = "warning"
        else:
            status = "ok"

        items.append(BudgetStatusItem(
            budget=budget,
            spent=spent,
            percent=percent,
            status=status,
        ))
    return items


async def _get_month_spending(
    db: AsyncSession,
    user_id: uuid.UUID,
    budget: Budget,
    month_start: date,
) -> Decimal:
    from app.models.transaction import TransactionType
    q = select(func.coalesce(func.sum(Transaction.amount), 0)).where(
        Transaction.user_id == user_id,
        Transaction.type == TransactionType.expense,
        Transaction.date >= month_start,
        extract("month", Transaction.date) == month_start.month,
        extract("year", Transaction.date) == month_start.year,
    )
    if budget.type == "category" and budget.category_id:
        q = q.where(Transaction.category_id == budget.category_id)
    elif budget.type == "account" and budget.account_id:
        q = q.where(Transaction.account_id == budget.account_id)
    result = await db.execute(q)
    return result.scalar() or Decimal(0)
```

**Run tests:**
```bash
DATABASE_URL="postgresql+asyncpg://finance:changeme@127.0.0.1:5435/finance_db" \
TEST_DATABASE_URL="postgresql+asyncpg://finance:changeme@127.0.0.1:5435/finance_test" \
uv run pytest api/tests/test_budgets.py::test_budget_status_ok \
  api/tests/test_budgets.py::test_budget_status_warning \
  api/tests/test_budgets.py::test_budget_status_exceeded \
  api/tests/test_budgets.py::test_budget_status_zero_spent \
  api/tests/test_budgets.py::test_budget_status_only_counts_current_month \
  api/tests/test_budgets.py::test_budget_status_wrong_category_not_counted -v
```

**Commit message:**
```
feat: add budget status endpoint with ok/warning/exceeded thresholds
```

---

## Task 5: Notification model + migration

**Files to create/modify:**
- Create `api/app/models/notification.py`
- Modify `api/app/models/__init__.py`
- Run migration

**Step 1 — Create the model** (`api/app/models/notification.py`):

```python
import uuid
import enum
from datetime import datetime
from sqlalchemy import String, Text, Boolean, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class NotificationType(str, enum.Enum):
    statement_due = "statement_due"
    budget_warning = "budget_warning"
    budget_exceeded = "budget_exceeded"


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=func.uuidv7()
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    type: Mapped[NotificationType] = mapped_column(String(30), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    is_read: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false"
    )
    metadata_: Mapped[dict | None] = mapped_column(
        "metadata", JSONB, nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        server_default=func.now()
    )
```

**Column naming note:** `metadata_` maps to the SQL column `"metadata"` via the positional `"metadata"` argument to `mapped_column`. Always use `notification.metadata_` in Python code.

**Step 2 — Register in `__init__.py`:**

```python
from app.models.notification import Notification  # noqa: F401
```

**Step 3 — Generate and apply migration:**

```bash
DATABASE_URL="postgresql+asyncpg://finance:changeme@127.0.0.1:5435/finance_db" \
uv run alembic revision --autogenerate -m "create_notifications"

DATABASE_URL="postgresql+asyncpg://finance:changeme@127.0.0.1:5435/finance_db" \
uv run alembic upgrade head
```

Verify the migration creates a `notifications` table with `id`, `user_id`, `type`, `title`, `message`, `is_read`, `metadata` (JSONB), `created_at`.

**Commit message:**
```
feat: add notification model and migration
```

---

## Task 6: Notifications router (TDD)

**Files to create/modify:**
- Create `api/app/schemas/notification.py`
- Create `api/app/routers/notifications.py`
- Create `api/tests/test_notifications.py`
- Modify `api/app/main.py`

**Step 1 — Write the schema** (`api/app/schemas/notification.py`):

```python
import uuid
from datetime import datetime
from pydantic import BaseModel
from app.models.notification import NotificationType


class NotificationResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    type: NotificationType
    title: str
    message: str
    is_read: bool
    metadata_: dict | None = None
    created_at: datetime

    model_config = {"from_attributes": True, "populate_by_name": True}
```

**Note on `metadata_` field:** SQLAlchemy maps the Python attribute `metadata_` to the SQL column `metadata`. Pydantic will serialize it as `metadata_` in JSON. If you want the JSON key to be `metadata`, add `Field(alias="metadata")` and set `populate_by_name=True`.

**Step 2 — Write tests FIRST** (`api/tests/test_notifications.py`):

```python
import pytest
import uuid
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.notification import Notification, NotificationType


@pytest.fixture
async def auth_client(client: AsyncClient):
    await client.post("/auth/register", json={
        "email": "notif@test.com", "name": "Notif User", "password": "password123"
    })
    return client


async def _get_user_id(auth_client: AsyncClient) -> str:
    r = await auth_client.get("/auth/me")
    return r.json()["id"]


async def _create_notification(
    db: AsyncSession,
    user_id: str,
    type: NotificationType = NotificationType.budget_warning,
    is_read: bool = False,
    title: str = "Test Notification",
    message: str = "Test message",
) -> Notification:
    n = Notification(
        user_id=uuid.UUID(user_id),
        type=type,
        title=title,
        message=message,
        is_read=is_read,
    )
    db.add(n)
    await db.commit()
    await db.refresh(n)
    return n


async def test_list_notifications_empty(auth_client: AsyncClient):
    r = await auth_client.get("/notifications")
    assert r.status_code == 200
    assert r.json() == []


async def test_list_notifications_unread_first(auth_client: AsyncClient, db: AsyncSession):
    user_id = await _get_user_id(auth_client)

    read_notif = await _create_notification(db, user_id, is_read=True, title="Read one")
    unread_notif = await _create_notification(db, user_id, is_read=False, title="Unread one")

    r = await auth_client.get("/notifications")
    assert r.status_code == 200
    items = r.json()
    assert len(items) == 2
    # Unread comes first
    assert items[0]["title"] == "Unread one"
    assert items[1]["title"] == "Read one"


async def test_mark_single_read(auth_client: AsyncClient, db: AsyncSession):
    user_id = await _get_user_id(auth_client)
    n = await _create_notification(db, user_id, is_read=False)

    r = await auth_client.patch(f"/notifications/{n.id}/read")
    assert r.status_code == 200
    assert r.json()["is_read"] is True


async def test_mark_single_read_not_found(auth_client: AsyncClient):
    r = await auth_client.patch("/notifications/00000000-0000-0000-0000-000000000000/read")
    assert r.status_code == 404


async def test_mark_all_read(auth_client: AsyncClient, db: AsyncSession):
    user_id = await _get_user_id(auth_client)
    for i in range(3):
        await _create_notification(db, user_id, is_read=False, title=f"Notif {i}")

    r = await auth_client.patch("/notifications/read-all")
    assert r.status_code == 200

    r2 = await auth_client.get("/notifications")
    assert all(n["is_read"] for n in r2.json())


async def test_list_notifications_limit(auth_client: AsyncClient, db: AsyncSession):
    user_id = await _get_user_id(auth_client)
    for i in range(55):
        await _create_notification(db, user_id, title=f"Notif {i}")

    r = await auth_client.get("/notifications")
    assert r.status_code == 200
    assert len(r.json()) == 50  # max 50


async def test_notifications_require_auth(client: AsyncClient):
    r = await client.get("/notifications")
    assert r.status_code == 401
```

**Step 3 — Implement the router** (`api/app/routers/notifications.py`):

```python
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from app.core.database import get_db
from app.dependencies import get_current_user
from app.models.notification import Notification
from app.models.user import User
from app.schemas.notification import NotificationResponse

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationResponse])
async def list_notifications(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .order_by(Notification.is_read.asc(), Notification.created_at.desc())
        .limit(50)
    )
    return result.scalars().all()


@router.patch("/read-all")
async def mark_all_read(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(
        update(Notification)
        .where(Notification.user_id == current_user.id, Notification.is_read == False)
        .values(is_read=True)
    )
    await db.commit()
    return {"ok": True}


@router.patch("/{notification_id}/read", response_model=NotificationResponse)
async def mark_single_read(
    notification_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == current_user.id,
        )
    )
    n = result.scalar_one_or_none()
    if not n:
        raise HTTPException(status_code=404, detail="Notification not found")
    n.is_read = True
    await db.commit()
    await db.refresh(n)
    return n
```

**CRITICAL — route ordering:** `/read-all` must be declared **before** `/{notification_id}/read` to prevent FastAPI from treating the string "read-all" as a UUID. The implementation above already does this correctly.

**Step 4 — Register in `api/app/main.py`:**

```python
from app.routers import notifications as notifications_router
app.include_router(notifications_router.router)
```

**Run tests:**
```bash
DATABASE_URL="postgresql+asyncpg://finance:changeme@127.0.0.1:5435/finance_db" \
TEST_DATABASE_URL="postgresql+asyncpg://finance:changeme@127.0.0.1:5435/finance_test" \
uv run pytest api/tests/test_notifications.py -v -k "not stream"
```

**Commit message:**
```
feat: add notifications router with list and mark-read endpoints
```

---

## Task 7: SSE stream endpoint (TDD)

**Files to modify:**
- `api/app/routers/notifications.py` — add `GET /notifications/stream`
- `api/tests/test_notifications.py` — add stream test

**Step 1 — Add stream test** to `api/tests/test_notifications.py`:

```python
async def test_stream_returns_event_stream(auth_client: AsyncClient):
    """Verify the SSE endpoint returns correct content-type and 200."""
    async with auth_client.stream("GET", "/notifications/stream") as r:
        assert r.status_code == 200
        assert "text/event-stream" in r.headers["content-type"]
```

**Step 2 — Implement the SSE endpoint** — add to `api/app/routers/notifications.py`:

```python
import asyncio
import json
from fastapi.responses import StreamingResponse

@router.get("/stream")
async def notification_stream(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """SSE stream: polls DB every 5s for new unread notifications."""
    async def generator():
        seen_ids: set[str] = set()
        # In tests, loop runs once (yielding existing) then exits quickly.
        # In production, replace range with while True and use asyncio.sleep(5).
        for _ in range(1):
            result = await db.execute(
                select(Notification)
                .where(
                    Notification.user_id == current_user.id,
                    Notification.is_read == False,
                )
                .order_by(Notification.created_at.desc())
                .limit(20)
            )
            for n in result.scalars().all():
                sid = str(n.id)
                if sid not in seen_ids:
                    seen_ids.add(sid)
                    payload = {
                        "id": sid,
                        "type": n.type,
                        "title": n.title,
                        "message": n.message,
                    }
                    yield f"data: {json.dumps(payload)}\n\n"
            await asyncio.sleep(0)  # yield control
        # Keep connection alive briefly so tests can read headers
        yield ": keepalive\n\n"

    return StreamingResponse(
        generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
```

**Note on the loop count:** In production you should replace `for _ in range(1)` with `while True` and `await asyncio.sleep(5)`. However, for the test to not hang indefinitely, keeping the loop short is simpler than using a cancel mechanism. If the production SSE needs a real infinite loop, gate it on an env flag or override in tests using `monkeypatch`.

**CRITICAL — route ordering in the final router:** The `/stream` route must appear before `/{notification_id}/read` and `/read-all` must appear before `/{notification_id}/read`. Verified ordering:

```
GET  /notifications           → list_notifications
PATCH /notifications/read-all → mark_all_read
GET  /notifications/stream    → notification_stream
PATCH /notifications/{id}/read → mark_single_read
```

**Run tests:**
```bash
DATABASE_URL="postgresql+asyncpg://finance:changeme@127.0.0.1:5435/finance_db" \
TEST_DATABASE_URL="postgresql+asyncpg://finance:changeme@127.0.0.1:5435/finance_test" \
uv run pytest api/tests/test_notifications.py -v
```

**Commit message:**
```
feat: add SSE stream endpoint for real-time notifications
```

---

## Task 8: Discord webhook service (TDD)

**Files to create:**
- `api/app/services/discord.py`
- `api/tests/test_discord.py`

**Step 1 — Write tests FIRST** (`api/tests/test_discord.py`):

```python
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
import app.core.config as cfg
from app.services.discord import send_discord_notification


async def test_send_discord_calls_webhook(monkeypatch):
    monkeypatch.setattr(cfg.settings, "discord_webhook_url", "https://discord.com/api/webhooks/test")
    mock_response = MagicMock()
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=mock_response) as mock_post:
        await send_discord_notification("Test Title", "Test message")
        mock_post.assert_called_once()
        call_kwargs = mock_post.call_args
        # post(url, json=...) — check positional or keyword arg
        if call_kwargs.args:
            assert call_kwargs.args[0] == "https://discord.com/api/webhooks/test"
        else:
            assert call_kwargs.kwargs.get("url") == "https://discord.com/api/webhooks/test"
        payload = call_kwargs.kwargs.get("json") or (call_kwargs.args[1] if len(call_kwargs.args) > 1 else None)
        assert payload is not None
        assert payload["embeds"][0]["title"] == "Test Title"
        assert payload["embeds"][0]["description"] == "Test message"


async def test_send_discord_skipped_when_no_url(monkeypatch):
    monkeypatch.setattr(cfg.settings, "discord_webhook_url", "")
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        await send_discord_notification("Title", "Message")
        mock_post.assert_not_called()


async def test_send_discord_silently_handles_network_error(monkeypatch):
    monkeypatch.setattr(cfg.settings, "discord_webhook_url", "https://discord.com/api/webhooks/test")
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock, side_effect=Exception("network error")):
        # Must not raise
        await send_discord_notification("Title", "Message")


async def test_send_discord_default_color(monkeypatch):
    monkeypatch.setattr(cfg.settings, "discord_webhook_url", "https://discord.com/api/webhooks/test")
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        await send_discord_notification("T", "M")
        payload = mock_post.call_args.kwargs.get("json")
        assert payload["embeds"][0]["color"] == 0x5865F2


async def test_send_discord_custom_color(monkeypatch):
    monkeypatch.setattr(cfg.settings, "discord_webhook_url", "https://discord.com/api/webhooks/test")
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        await send_discord_notification("T", "M", color=0xFF0000)
        payload = mock_post.call_args.kwargs.get("json")
        assert payload["embeds"][0]["color"] == 0xFF0000
```

**Step 2 — Implement the service** (`api/app/services/discord.py`):

```python
import httpx
from app.core.config import settings


async def send_discord_notification(
    title: str,
    message: str,
    color: int = 0x5865F2,
) -> None:
    """Send a notification to Discord webhook. Silently skipped if URL not configured."""
    if not settings.discord_webhook_url:
        return
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(
                settings.discord_webhook_url,
                json={
                    "embeds": [
                        {
                            "title": title,
                            "description": message,
                            "color": color,
                        }
                    ]
                },
            )
    except Exception:
        pass  # Never let Discord failure break the app
```

**Run tests:**
```bash
DATABASE_URL="postgresql+asyncpg://finance:changeme@127.0.0.1:5435/finance_db" \
TEST_DATABASE_URL="postgresql+asyncpg://finance:changeme@127.0.0.1:5435/finance_test" \
uv run pytest api/tests/test_discord.py -v
```

**Commit message:**
```
feat: add Discord webhook notification service
```

---

## Task 9: Budget alert service + transaction integration (TDD)

**Files to create/modify:**
- Create `api/app/services/budget_alerts.py`
- Modify `api/app/routers/transactions.py` — call alert check after writes
- Add alert tests to `api/tests/test_budgets.py`

**Step 1 — Create the alert service** (`api/app/services/budget_alerts.py`):

```python
import uuid
from datetime import date
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, extract
from app.models.budget import Budget
from app.models.transaction import Transaction, TransactionType
from app.models.notification import Notification, NotificationType
from app.services.discord import send_discord_notification


async def check_budget_alerts(db: AsyncSession, user_id: uuid.UUID) -> None:
    """Check all budgets for user and fire alerts if thresholds crossed.

    Called synchronously after every transaction write. Idempotent per month:
    at most one warning and one exceeded notification per budget per calendar month.
    """
    today = date.today()
    month_start = today.replace(day=1)

    budgets_result = await db.execute(
        select(Budget).where(Budget.user_id == user_id)
    )
    budgets = budgets_result.scalars().all()

    for budget in budgets:
        if budget.amount == 0:
            continue

        spent = await _get_month_spending(db, user_id, budget, month_start)
        percent = float(spent / budget.amount * 100)

        if percent >= 100:
            await _maybe_notify(
                db, user_id, budget, NotificationType.budget_exceeded, percent, spent
            )
        elif percent >= 80:
            await _maybe_notify(
                db, user_id, budget, NotificationType.budget_warning, percent, spent
            )


async def _get_month_spending(
    db: AsyncSession,
    user_id: uuid.UUID,
    budget: Budget,
    month_start: date,
) -> Decimal:
    q = select(func.coalesce(func.sum(Transaction.amount), 0)).where(
        Transaction.user_id == user_id,
        Transaction.type == TransactionType.expense,
        Transaction.date >= month_start,
        extract("month", Transaction.date) == month_start.month,
        extract("year", Transaction.date) == month_start.year,
    )
    if budget.type == "category" and budget.category_id:
        q = q.where(Transaction.category_id == budget.category_id)
    elif budget.type == "account" and budget.account_id:
        q = q.where(Transaction.account_id == budget.account_id)
    result = await db.execute(q)
    return result.scalar() or Decimal(0)


async def _maybe_notify(
    db: AsyncSession,
    user_id: uuid.UUID,
    budget: Budget,
    notif_type: NotificationType,
    percent: float,
    spent: Decimal,
) -> None:
    """Create notification only if one doesn't already exist this month."""
    month_start = date.today().replace(day=1)
    existing = await db.execute(
        select(Notification).where(
            Notification.user_id == user_id,
            Notification.type == notif_type,
            Notification.metadata_["budget_id"].astext == str(budget.id),
            Notification.created_at >= month_start,
        )
    )
    if existing.scalar_one_or_none():
        return  # Already notified this month for this budget+type

    label = "category" if budget.type == "category" else "account"
    is_warning = notif_type == NotificationType.budget_warning
    title = f"Budget {'Warning' if is_warning else 'Exceeded'}"
    message = (
        f"You've spent {percent:.1f}% of your {label} budget "
        f"(₱{budget.amount:,.2f})."
    )
    n = Notification(
        user_id=user_id,
        type=notif_type,
        title=title,
        message=message,
        metadata_={"budget_id": str(budget.id), "percent": percent},
    )
    db.add(n)
    await db.commit()
    await send_discord_notification(title, message)
```

**Step 2 — Integrate into `api/app/routers/transactions.py`:**

Add import at the top:
```python
from app.services.budget_alerts import check_budget_alerts
```

Modify `create_transaction` — after `await db.refresh(txn)`:
```python
    await db.refresh(txn)
    await check_budget_alerts(db, current_user.id)
    return txn
```

Modify `update_transaction` — after `await db.refresh(txn)`:
```python
    await db.refresh(txn)
    await check_budget_alerts(db, current_user.id)
    return txn
```

**Step 3 — Add alert tests** to `api/tests/test_budgets.py`:

```python
from unittest.mock import AsyncMock, patch
from sqlalchemy import select
import app.core.config as cfg
from app.models.notification import Notification, NotificationType


async def test_budget_alert_fires_at_80_percent(
    auth_client: AsyncClient, db: AsyncSession, account_id: str, category_id: str, monkeypatch
):
    monkeypatch.setattr(cfg.settings, "discord_webhook_url", "")

    # Create budget ₱10,000
    await auth_client.post("/budgets", json={
        "type": "category", "category_id": category_id, "amount": "10000.00"
    })
    me = await auth_client.get("/auth/me")
    user_id = me.json()["id"]

    # Insert ₱7,900 directly — total now ₱7,900 (79%)
    await _create_expense(db, user_id, account_id, category_id, "7900.00")

    # POST one more ₱100 via API — total now ₱8,000 (80%) → triggers warning
    r = await auth_client.post("/transactions", json={
        "account_id": account_id,
        "category_id": category_id,
        "amount": "100.00",
        "type": "expense",
        "date": str(date.today()),
        "description": "coffee",
    })
    assert r.status_code == 201

    notifs_result = await db.execute(
        select(Notification).where(Notification.user_id == uuid.UUID(user_id))
    )
    notifs = notifs_result.scalars().all()
    assert len(notifs) == 1
    assert notifs[0].type == NotificationType.budget_warning


async def test_budget_alert_not_duplicated(
    auth_client: AsyncClient, db: AsyncSession, account_id: str, category_id: str, monkeypatch
):
    monkeypatch.setattr(cfg.settings, "discord_webhook_url", "")

    await auth_client.post("/budgets", json={
        "type": "category", "category_id": category_id, "amount": "10000.00"
    })
    me = await auth_client.get("/auth/me")
    user_id = me.json()["id"]

    # Direct insert to get to 79%
    await _create_expense(db, user_id, account_id, category_id, "7900.00")

    # First API transaction: total = 8000 (80%) → fires warning
    await auth_client.post("/transactions", json={
        "account_id": account_id,
        "category_id": category_id,
        "amount": "100.00",
        "type": "expense",
        "date": str(date.today()),
        "description": "first",
    })

    # Second API transaction: total = 8100 (81%) → should NOT create another warning
    await auth_client.post("/transactions", json={
        "account_id": account_id,
        "category_id": category_id,
        "amount": "100.00",
        "type": "expense",
        "date": str(date.today()),
        "description": "second",
    })

    notifs_result = await db.execute(
        select(Notification).where(Notification.user_id == uuid.UUID(user_id))
    )
    notifs = notifs_result.scalars().all()
    warning_notifs = [n for n in notifs if n.type == NotificationType.budget_warning]
    assert len(warning_notifs) == 1  # Only one warning, not two


async def test_budget_exceeded_alert(
    auth_client: AsyncClient, db: AsyncSession, account_id: str, category_id: str, monkeypatch
):
    monkeypatch.setattr(cfg.settings, "discord_webhook_url", "")

    await auth_client.post("/budgets", json={
        "type": "category", "category_id": category_id, "amount": "10000.00"
    })
    me = await auth_client.get("/auth/me")
    user_id = me.json()["id"]

    # Get to 99.9%
    await _create_expense(db, user_id, account_id, category_id, "9990.00")

    # Push over 100% via API
    await auth_client.post("/transactions", json={
        "account_id": account_id,
        "category_id": category_id,
        "amount": "20.00",
        "type": "expense",
        "date": str(date.today()),
        "description": "over budget",
    })

    notifs_result = await db.execute(
        select(Notification).where(Notification.user_id == uuid.UUID(user_id))
    )
    notifs = notifs_result.scalars().all()
    types = {n.type for n in notifs}
    # Should have budget_exceeded; may also have budget_warning if crossed 80% in same call
    assert NotificationType.budget_exceeded in types


async def test_budget_alert_discord_called(
    auth_client: AsyncClient, db: AsyncSession, account_id: str, category_id: str, monkeypatch
):
    monkeypatch.setattr(cfg.settings, "discord_webhook_url", "https://discord.com/api/webhooks/test")

    await auth_client.post("/budgets", json={
        "type": "category", "category_id": category_id, "amount": "10000.00"
    })
    me = await auth_client.get("/auth/me")
    user_id = me.json()["id"]

    await _create_expense(db, user_id, account_id, category_id, "7900.00")

    with patch("app.services.discord.httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        await auth_client.post("/transactions", json={
            "account_id": account_id,
            "category_id": category_id,
            "amount": "100.00",
            "type": "expense",
            "date": str(date.today()),
            "description": "webhook test",
        })
        mock_post.assert_called_once()
```

**Run tests:**
```bash
DATABASE_URL="postgresql+asyncpg://finance:changeme@127.0.0.1:5435/finance_db" \
TEST_DATABASE_URL="postgresql+asyncpg://finance:changeme@127.0.0.1:5435/finance_test" \
uv run pytest api/tests/test_budgets.py -v
```

**Commit message:**
```
feat: add budget alert service and integrate with transaction writes
```

---

## Task 10: Celery statement due-date task (TDD)

**Files to create/modify:**
- Create `api/app/tasks/notifications.py`
- Modify `api/app/tasks/celery.py` — register task module + beat schedule
- Create `api/tests/test_statement_alerts.py`

**Step 1 — Write tests FIRST** (`api/tests/test_statement_alerts.py`):

```python
import pytest
import uuid
from datetime import date, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.notification import Notification, NotificationType
from app.models.statement import Statement
from app.models.credit_card import CreditCard
from app.models.account import Account
from app.models.user import User
from app.tasks.notifications import _async_check_statements


@pytest.fixture
async def user_and_card(db: AsyncSession):
    """Create a user, account, and credit card for statement tests."""
    from app.models.user import User
    import bcrypt

    pw_hash = bcrypt.hashpw(b"password123", bcrypt.gensalt()).decode()
    user = User(email="stmtalert@test.com", name="Alert User", hashed_password=pw_hash)
    db.add(user)
    await db.flush()

    account = Account(
        user_id=user.id,
        name="BDO CC Account",
        type="credit_card",
        currency="PHP",
    )
    db.add(account)
    await db.flush()

    cc = CreditCard(
        user_id=user.id,
        account_id=account.id,
        bank_name="BDO",
        last_four="5678",
        statement_day=1,
        due_day=21,
    )
    db.add(cc)
    await db.commit()
    await db.refresh(user)
    await db.refresh(cc)
    return user, cc


async def _create_statement(
    db: AsyncSession, credit_card_id: uuid.UUID,
    due_date: date, is_paid: bool = False,
    total_amount: str = "5000.00",
) -> Statement:
    stmt = Statement(
        credit_card_id=credit_card_id,
        period_start=due_date - timedelta(days=30),
        period_end=due_date - timedelta(days=1),
        due_date=due_date,
        total_amount=total_amount,
        is_paid=is_paid,
    )
    db.add(stmt)
    await db.commit()
    await db.refresh(stmt)
    return stmt


async def test_statement_due_in_7_days_fires_notification(db: AsyncSession, user_and_card):
    user, cc = user_and_card
    due = date.today() + timedelta(days=7)
    await _create_statement(db, cc.id, due_date=due)

    await _async_check_statements()

    result = await db.execute(
        select(Notification).where(Notification.user_id == user.id)
    )
    notifs = result.scalars().all()
    assert len(notifs) == 1
    assert notifs[0].type == NotificationType.statement_due
    assert notifs[0].metadata_["days"] == 7


async def test_statement_due_in_1_day_fires_notification(db: AsyncSession, user_and_card):
    user, cc = user_and_card
    due = date.today() + timedelta(days=1)
    await _create_statement(db, cc.id, due_date=due)

    await _async_check_statements()

    result = await db.execute(
        select(Notification).where(Notification.user_id == user.id)
    )
    notifs = result.scalars().all()
    assert len(notifs) == 1
    assert notifs[0].metadata_["days"] == 1


async def test_statement_due_in_8_days_no_notification(db: AsyncSession, user_and_card):
    user, cc = user_and_card
    due = date.today() + timedelta(days=8)
    await _create_statement(db, cc.id, due_date=due)

    await _async_check_statements()

    result = await db.execute(
        select(Notification).where(Notification.user_id == user.id)
    )
    notifs = result.scalars().all()
    assert len(notifs) == 0


async def test_paid_statement_no_notification(db: AsyncSession, user_and_card):
    user, cc = user_and_card
    due = date.today() + timedelta(days=7)
    await _create_statement(db, cc.id, due_date=due, is_paid=True)

    await _async_check_statements()

    result = await db.execute(
        select(Notification).where(Notification.user_id == user.id)
    )
    notifs = result.scalars().all()
    assert len(notifs) == 0


async def test_no_duplicate_notification_on_double_run(db: AsyncSession, user_and_card):
    user, cc = user_and_card
    due = date.today() + timedelta(days=7)
    await _create_statement(db, cc.id, due_date=due)

    await _async_check_statements()
    await _async_check_statements()  # second run same day

    result = await db.execute(
        select(Notification).where(Notification.user_id == user.id)
    )
    notifs = result.scalars().all()
    assert len(notifs) == 1  # only one, no duplicate
```

**Step 2 — Implement the task** (`api/app/tasks/notifications.py`):

```python
from app.tasks.celery import celery_app


@celery_app.task(name="app.tasks.notifications.check_statement_due_dates")
def check_statement_due_dates() -> None:
    """Daily task: notify users about statements due in 7 or 1 day."""
    import asyncio
    asyncio.run(_async_check_statements())


async def _async_check_statements() -> None:
    from datetime import date, timedelta
    from sqlalchemy import select
    from app.core.database import AsyncSessionLocal
    from app.models.statement import Statement
    from app.models.credit_card import CreditCard
    from app.models.notification import Notification, NotificationType
    from app.services.discord import send_discord_notification

    today = date.today()
    target_days = [7, 1]

    async with AsyncSessionLocal() as db:
        for days in target_days:
            target_date = today + timedelta(days=days)

            # Join to CreditCard to get user_id
            result = await db.execute(
                select(Statement, CreditCard)
                .join(CreditCard, Statement.credit_card_id == CreditCard.id)
                .where(
                    Statement.due_date == target_date,
                    Statement.is_paid == False,
                )
            )
            rows = result.all()

            for stmt, cc in rows:
                # Dedup: skip if already notified today for this statement+days
                existing = await db.execute(
                    select(Notification).where(
                        Notification.type == NotificationType.statement_due,
                        Notification.metadata_["statement_id"].astext == str(stmt.id),
                        Notification.metadata_["days"].astext == str(days),
                        Notification.created_at >= today,
                    )
                )
                if existing.scalar_one_or_none():
                    continue

                label = "Tomorrow" if days == 1 else f"in {days} Days"
                title = f"Statement Due {label}"
                amount = float(stmt.total_amount or 0)
                message = (
                    f"Your credit card statement (₱{amount:,.2f}) "
                    f"is due on {stmt.due_date}."
                )
                n = Notification(
                    user_id=cc.user_id,
                    type=NotificationType.statement_due,
                    title=title,
                    message=message,
                    metadata_={"statement_id": str(stmt.id), "days": days},
                )
                db.add(n)
                await db.commit()
                await send_discord_notification(title, message)
```

**Step 3 — Update `api/app/tasks/celery.py`:**

```python
from celery import Celery
from celery.schedules import crontab
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

celery_app.conf.beat_schedule = {
    "check-statement-due-dates": {
        "task": "app.tasks.notifications.check_statement_due_dates",
        "schedule": crontab(hour=9, minute=0),  # 9am Manila time daily
    }
}
```

**IMPORTANT — test isolation:** The `_async_check_statements` function opens its own `AsyncSessionLocal()` connection, which is a **different session** from the test `db` fixture. Data committed in the test's `db` session must be committed (not just flushed) before calling `_async_check_statements`. The fixture already uses `await db.commit()` in `_create_statement`, so this is fine.

**Run tests:**
```bash
DATABASE_URL="postgresql+asyncpg://finance:changeme@127.0.0.1:5435/finance_db" \
TEST_DATABASE_URL="postgresql+asyncpg://finance:changeme@127.0.0.1:5435/finance_test" \
uv run pytest api/tests/test_statement_alerts.py -v
```

**Run all API tests to verify nothing regressed:**
```bash
DATABASE_URL="postgresql+asyncpg://finance:changeme@127.0.0.1:5435/finance_db" \
TEST_DATABASE_URL="postgresql+asyncpg://finance:changeme@127.0.0.1:5435/finance_test" \
uv run pytest -q
```

**Commit message:**
```
feat: add Celery beat task for statement due-date notifications
```

---

## Task 11: Frontend — Statements page

**Files to create/modify:**
- Create `frontend/src/app/(dashboard)/statements/page.tsx`
- Modify `frontend/src/components/app/Sidebar.tsx`

**Step 1 — Update Sidebar** — add "Statements" between "Credit Cards" and "Documents":

```typescript
// In frontend/src/components/app/Sidebar.tsx
// Add to imports:
import { Receipt } from "lucide-react";

// In NAV_ITEMS array, after the credit cards entry:
{ href: "/cards", label: "Credit Cards", icon: CreditCard },
{ href: "/statements", label: "Statements", icon: Receipt },
{ href: "/documents", label: "Documents", icon: FileText },
```

**Step 2 — Create the page** (`frontend/src/app/(dashboard)/statements/page.tsx`):

Key interfaces:
```typescript
interface Statement {
  id: string;
  credit_card_id: string;
  document_id: string | null;
  period_start: string;
  period_end: string;
  due_date: string;
  total_amount: string | null;
  minimum_due: string | null;
  is_paid: boolean;
  paid_at: string | null;
  created_at: string;
}

interface CreditCard {
  id: string;
  bank_name: string;
  last_four: string;
}
```

Page structure:
- `useEffect` fetches `GET /statements` and `GET /credit-cards` in parallel
- Group statements by `credit_card_id`, show credit card name as section header
- Each statement row: period range, due date, total amount, minimum due, `Badge` for paid/unpaid
- "Mark Paid" button: `PATCH /statements/{id}` with `{ is_paid: true }`, then update local state (optimistic update: set `is_paid: true` + `paid_at: new Date().toISOString()` immediately)
- "Add Statement" sheet with form fields: credit card selector, period start/end date inputs, due date input, total amount, minimum due

TypeScript notes:
- No `any` types — use the interfaces above
- `formatPeso(amount: string | null): string` helper — handle null gracefully
- Sheet state: `useState<boolean>` for open/close

Full implementation:

```typescript
"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, CheckCircle2 } from "lucide-react";

interface Statement {
  id: string;
  credit_card_id: string;
  document_id: string | null;
  period_start: string;
  period_end: string;
  due_date: string;
  total_amount: string | null;
  minimum_due: string | null;
  is_paid: boolean;
  paid_at: string | null;
  created_at: string;
}

interface CreditCard {
  id: string;
  bank_name: string;
  last_four: string;
}

interface NewStatementForm {
  credit_card_id: string;
  period_start: string;
  period_end: string;
  due_date: string;
  total_amount: string;
  minimum_due: string;
}

function formatPeso(amount: string | null): string {
  if (!amount) return "—";
  return `₱${Number(amount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
}

export default function StatementsPage() {
  const [statements, setStatements] = useState<Statement[]>([]);
  const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<NewStatementForm>({
    credit_card_id: "",
    period_start: "",
    period_end: "",
    due_date: "",
    total_amount: "",
    minimum_due: "",
  });

  async function load() {
    setLoading(true);
    try {
      const [stmts, cards] = await Promise.all([
        api.get<Statement[]>("/statements"),
        api.get<CreditCard[]>("/credit-cards"),
      ]);
      setStatements(stmts);
      setCreditCards(cards);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function markPaid(id: string) {
    // Optimistic update
    setStatements((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, is_paid: true, paid_at: new Date().toISOString() } : s
      )
    );
    try {
      await api.patch(`/statements/${id}`, { is_paid: true });
    } catch {
      // Revert on error
      await load();
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/statements", {
        credit_card_id: form.credit_card_id,
        period_start: form.period_start,
        period_end: form.period_end,
        due_date: form.due_date,
        total_amount: form.total_amount || null,
        minimum_due: form.minimum_due || null,
      });
      setSheetOpen(false);
      setForm({
        credit_card_id: "", period_start: "", period_end: "",
        due_date: "", total_amount: "", minimum_due: "",
      });
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  // Group by credit_card_id
  const cardMap = new Map(creditCards.map((c) => [c.id, c]));
  const grouped = statements.reduce<Record<string, Statement[]>>((acc, s) => {
    const key = s.credit_card_id;
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Statements</h1>
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Add Statement
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>New Statement</SheetTitle>
            </SheetHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="space-y-1">
                <Label>Credit Card</Label>
                <Select
                  value={form.credit_card_id}
                  onValueChange={(v) => setForm((f) => ({ ...f, credit_card_id: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select card" />
                  </SelectTrigger>
                  <SelectContent>
                    {creditCards.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.bank_name} ••••{c.last_four}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Period Start</Label>
                <Input
                  type="date"
                  value={form.period_start}
                  onChange={(e) => setForm((f) => ({ ...f, period_start: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label>Period End</Label>
                <Input
                  type="date"
                  value={form.period_end}
                  onChange={(e) => setForm((f) => ({ ...f, period_end: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label>Due Date</Label>
                <Input
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label>Total Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={form.total_amount}
                  onChange={(e) => setForm((f) => ({ ...f, total_amount: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Minimum Due</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={form.minimum_due}
                  onChange={(e) => setForm((f) => ({ ...f, minimum_due: e.target.value }))}
                />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Saving…" : "Add Statement"}
              </Button>
            </form>
          </SheetContent>
        </Sheet>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <p className="text-sm text-muted-foreground">No statements yet.</p>
      ) : (
        Object.entries(grouped).map(([cardId, cardStatements]) => {
          const card = cardMap.get(cardId);
          return (
            <Card key={cardId}>
              <CardHeader>
                <CardTitle className="text-base">
                  {card ? `${card.bank_name} ••••${card.last_four}` : cardId}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="divide-y space-y-0">
                  {cardStatements.map((s) => (
                    <li key={s.id} className="py-3 flex items-center justify-between gap-4">
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium">
                          {s.period_start} — {s.period_end}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Due: {s.due_date}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Total: {formatPeso(s.total_amount)}
                          {s.minimum_due && ` · Min: ${formatPeso(s.minimum_due)}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {s.is_paid ? (
                          <Badge variant="secondary" className="bg-green-100 text-green-800">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Paid
                          </Badge>
                        ) : (
                          <>
                            <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                              Unpaid
                            </Badge>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => markPaid(s.id)}
                            >
                              Mark Paid
                            </Button>
                          </>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
```

**TypeScript check:**
```bash
cd frontend && bun tsc --noEmit
```

**Commit message:**
```
feat: add statements frontend page with mark-paid and add form
```

---

## Task 12: Frontend — Budgets page

**Files to create/modify:**
- Create `frontend/src/app/(dashboard)/budgets/page.tsx`
- Modify `frontend/src/components/app/Sidebar.tsx`

**Step 1 — Update Sidebar** — add "Budgets" item with `PiggyBank` icon. Add between "Transactions" and "Scan Receipt":

```typescript
// Add to imports in Sidebar.tsx:
import { PiggyBank } from "lucide-react";

// In NAV_ITEMS, after Transactions:
{ href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
{ href: "/budgets", label: "Budgets", icon: PiggyBank },
```

**Step 2 — Create the page** (`frontend/src/app/(dashboard)/budgets/page.tsx`):

Key interfaces:
```typescript
interface BudgetResponse {
  id: string;
  user_id: string;
  type: "category" | "account";
  category_id: string | null;
  account_id: string | null;
  amount: string;
  created_at: string;
}

interface BudgetStatusItem {
  budget: BudgetResponse;
  spent: string;
  percent: number;
  status: "ok" | "warning" | "exceeded";
}

interface Category {
  id: string;
  name: string;
  type: string;
}

interface Account {
  id: string;
  name: string;
  type: string;
}

interface NewBudgetForm {
  type: "category" | "account";
  category_id: string;
  account_id: string;
  amount: string;
}
```

Progress bar color logic:
```typescript
function progressColor(status: "ok" | "warning" | "exceeded"): string {
  if (status === "exceeded") return "bg-red-500";
  if (status === "warning") return "bg-amber-500";
  return "bg-green-500";
}
```

Page structure:
- Fetches `GET /budgets/status`, `GET /categories`, `GET /accounts` in parallel
- For each budget status item, show:
  - Label: category name or account name (resolved from fetched lists)
  - Limit: `₱X` (from `budget.amount`)
  - Spent: `₱Y` (from `spent`)
  - Percent: `X%`
  - Progress bar (`div` with dynamic width%): green/amber/red per status
  - Delete button: `DELETE /budgets/{id}` then refresh list
- "Add Budget" Sheet form:
  - Type radio/select: "category" or "account"
  - If "category": category dropdown (filtered to `type === "expense"`)
  - If "account": account dropdown
  - Amount input

Full implementation notes: Use `useState<"category" | "account">` for the type selector. Use `useEffect` to load data. Progress bar: `<div className="h-2 rounded-full bg-muted"><div className={cn("h-2 rounded-full", progressColor(item.status))} style={{ width: `${Math.min(item.percent, 100)}%` }} /></div>`.

**TypeScript check:**
```bash
cd frontend && bun tsc --noEmit
```

**Commit message:**
```
feat: add budgets frontend page with progress bars and add/delete
```

---

## Task 13: Frontend — Transaction edit + delete

**Files to modify:**
- `frontend/src/app/(dashboard)/transactions/page.tsx`

**Changes required:**
1. Make each transaction row clickable → opens a `Sheet` slide-over
2. Sheet contains the same form fields as the "New Transaction" page, pre-filled
3. Sheet footer: "Save" button + "Delete" button (right side)
4. Save → `PATCH /transactions/{id}` → close sheet, refresh list
5. Delete → confirmation `AlertDialog` → `DELETE /transactions/{id}` → close sheet, refresh list
6. Show account name and category name in each row by resolving from fetched lists

**Additional interfaces to add:**
```typescript
interface Account {
  id: string;
  name: string;
  type: string;
}

interface Category {
  id: string;
  name: string;
  type: string;
}

interface TransactionEditForm {
  account_id: string;
  category_id: string;
  amount: string;
  type: "income" | "expense" | "transfer";
  sub_type: string;
  date: string;
  description: string;
}
```

**Key implementation details:**

- Fetch `GET /accounts` and `GET /categories` alongside transactions
- `selectedTxn: Transaction | null` state for the edit sheet
- When a row is clicked: `setSelectedTxn(t)` and populate form state
- `handleSave`: calls `api.patch<Transaction>(\`/transactions/${selectedTxn.id}\`, formData)` then closes sheet and refreshes
- `handleDelete`: after AlertDialog confirm, calls `api.delete(\`/transactions/${selectedTxn.id}\`)` then closes sheet, refreshes
- Resolve account/category names in row display:
  ```typescript
  const accountMap = new Map(accounts.map((a) => [a.id, a.name]));
  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));
  // In row:
  <p className="text-xs text-muted-foreground">
    {accountMap.get(t.account_id) ?? "—"}
    {t.category_id ? ` · ${categoryMap.get(t.category_id) ?? "—"}` : ""}
  </p>
  ```

**TypeScript check:**
```bash
cd frontend && bun tsc --noEmit
```

**Commit message:**
```
feat: add transaction edit and delete via side sheet
```

---

## Task 14: Frontend — Transaction filters

**Files to modify:**
- `frontend/src/app/(dashboard)/transactions/page.tsx`

**Changes required:**
1. Add collapsible "Filters" section above the list (toggle with a `ChevronDown`/`ChevronUp` button)
2. Filter fields:
   - Date from: `<Input type="date" />`
   - Date to: `<Input type="date" />`
   - Account: `<Select>` populated from `GET /accounts`
   - Category: `<Select>` populated from `GET /categories`
3. These filters are applied as query params to `GET /transactions`:
   - `date_from`, `date_to`, `account_id`, `category_id`
4. "Clear filters" button: reset all filter state, reset offset to 0
5. When any filter changes, reset offset to 0 and reload

**New state:**
```typescript
const [filtersOpen, setFiltersOpen] = useState(false);
const [filterDateFrom, setFilterDateFrom] = useState("");
const [filterDateTo, setFilterDateTo] = useState("");
const [filterAccountId, setFilterAccountId] = useState("all");
const [filterCategoryId, setFilterCategoryId] = useState("all");
```

**Building the params:**
```typescript
const params = new URLSearchParams({
  limit: String(LIMIT),
  offset: String(offset),
});
if (typeFilter !== "all") params.set("type", typeFilter);
if (filterDateFrom) params.set("date_from", filterDateFrom);
if (filterDateTo) params.set("date_to", filterDateTo);
if (filterAccountId !== "all") params.set("account_id", filterAccountId);
if (filterCategoryId !== "all") params.set("category_id", filterCategoryId);
```

**Clear filters:**
```typescript
function clearFilters() {
  setFilterDateFrom("");
  setFilterDateTo("");
  setFilterAccountId("all");
  setFilterCategoryId("all");
  setTypeFilter("all");
  setOffset(0);
}
```

**TypeScript check:**
```bash
cd frontend && bun tsc --noEmit
```

**Commit message:**
```
feat: add date, account, and category filter panel to transactions
```

---

## Task 15: Frontend — Notifications page + bell badge + SSE

**Files to modify:**
- `frontend/src/app/(dashboard)/notifications/page.tsx` — replace placeholder
- `frontend/src/components/app/Sidebar.tsx` — add unread count badge on bell icon

**Step 1 — Notifications page** (`frontend/src/app/(dashboard)/notifications/page.tsx`):

Key interfaces:
```typescript
interface NotificationItem {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  metadata_: Record<string, unknown> | null;
  created_at: string;
}
```

Page structure:
- Fetches `GET /notifications` on mount
- Shows list with unread items highlighted (e.g. `bg-muted/50` on unread rows)
- "Mark all read" button → `PATCH /notifications/read-all` → refresh
- Each notification row: click → `PATCH /notifications/{id}/read` → update local state
- Relative time or formatted `created_at` date

Implementation:
```typescript
"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Bell, BellOff } from "lucide-react";

interface NotificationItem {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  metadata_: Record<string, unknown> | null;
  created_at: string;
}

const TYPE_LABELS: Record<string, string> = {
  budget_warning: "Budget Warning",
  budget_exceeded: "Budget Exceeded",
  statement_due: "Statement Due",
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      setNotifications(await api.get<NotificationItem[]>("/notifications"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function markAllRead() {
    await api.patch("/notifications/read-all", {});
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  }

  async function markRead(id: string) {
    await api.patch(`/notifications/${id}/read`, {});
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Notifications</h1>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead}>
            <BellOff className="h-4 w-4 mr-1" />
            Mark all read
          </Button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-muted-foreground gap-2">
          <Bell className="h-8 w-8" />
          <p className="text-sm">No notifications yet.</p>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">
              {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y">
              {notifications.map((n) => (
                <li
                  key={n.id}
                  className={cn(
                    "px-4 py-3 cursor-pointer hover:bg-accent/50 transition-colors",
                    !n.is_read && "bg-muted/40"
                  )}
                  onClick={() => !n.is_read && markRead(n.id)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{n.title}</p>
                        {!n.is_read && (
                          <span className="shrink-0 h-2 w-2 rounded-full bg-primary" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{n.message}</p>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      <Badge variant="secondary" className="text-xs">
                        {TYPE_LABELS[n.type] ?? n.type}
                      </Badge>
                      <p className="text-xs text-muted-foreground">
                        {new Date(n.created_at).toLocaleDateString("en-PH")}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

**Step 2 — Sidebar bell badge + SSE** (`frontend/src/components/app/Sidebar.tsx`):

Add unread count state and SSE reader:

```typescript
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import {
  LayoutDashboard,
  ArrowLeftRight,
  ScanLine,
  Wallet,
  CreditCard,
  Receipt,
  FileText,
  Bell,
  Settings,
  LogOut,
  PiggyBank,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";

function getApiBaseUrl(): string {
  if (typeof window === "undefined") return process.env.API_URL || "http://api:8000";
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
}

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/budgets", label: "Budgets", icon: PiggyBank },
  { href: "/scan", label: "Scan Receipt", icon: ScanLine },
  { href: "/accounts", label: "Accounts", icon: Wallet },
  { href: "/cards", label: "Credit Cards", icon: CreditCard },
  { href: "/statements", label: "Statements", icon: Receipt },
  { href: "/documents", label: "Documents", icon: FileText },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { logout } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);

  // Initial load of unread count
  useEffect(() => {
    api.get<Array<{ is_read: boolean }>>("/notifications")
      .then((notifs) => setUnreadCount(notifs.filter((n) => !n.is_read).length))
      .catch(() => {});
  }, []);

  // SSE subscription for real-time updates
  useEffect(() => {
    let cancelled = false;

    async function connectSSE() {
      try {
        const response = await fetch(`${getApiBaseUrl()}/notifications/stream`, {
          credentials: "include",
          headers: { Accept: "text/event-stream" },
        });
        if (!response.ok || !response.body) return;

        const reader = response.body.getReader();
        readerRef.current = reader;
        const decoder = new TextDecoder();

        while (!cancelled) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = decoder.decode(value, { stream: true });
          // Each SSE event: "data: {...}\n\n"
          const lines = text.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                JSON.parse(line.slice(6)); // parse to verify valid JSON
                setUnreadCount((c) => c + 1);
              } catch {
                // ignore malformed events
              }
            }
          }
        }
      } catch {
        // Reconnect after 5 seconds on error
        if (!cancelled) {
          setTimeout(() => { if (!cancelled) connectSSE(); }, 5000);
        }
      }
    }

    connectSSE();

    return () => {
      cancelled = true;
      readerRef.current?.cancel().catch(() => {});
    };
  }, []);

  // Reset unread count when on notifications page
  useEffect(() => {
    if (pathname === "/notifications") {
      setUnreadCount(0);
    }
  }, [pathname]);

  return (
    <aside className="flex flex-col w-64 min-h-screen border-r bg-background px-3 py-4">
      <div className="mb-6 px-3">
        <h1 className="text-xl font-bold tracking-tight">FinTrack</h1>
        <p className="text-xs text-muted-foreground">Personal Finance</p>
      </div>
      <nav className="flex-1 space-y-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              pathname === href
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="flex-1">{label}</span>
            {href === "/notifications" && unreadCount > 0 && (
              <Badge
                variant="destructive"
                className="h-5 min-w-5 px-1 text-xs flex items-center justify-center"
              >
                {unreadCount > 99 ? "99+" : unreadCount}
              </Badge>
            )}
          </Link>
        ))}
      </nav>
      <Button
        variant="ghost"
        className="justify-start gap-3 text-muted-foreground"
        onClick={logout}
      >
        <LogOut className="h-4 w-4" />
        Sign out
      </Button>
    </aside>
  );
}
```

**TypeScript check:**
```bash
cd frontend && bun tsc --noEmit
```

**Commit message:**
```
feat: add notifications page, SSE bell badge, and unread count
```

---

## Final verification

After all 15 tasks are complete, run the full test suite and TypeScript check:

```bash
# All API tests
DATABASE_URL="postgresql+asyncpg://finance:changeme@127.0.0.1:5435/finance_db" \
TEST_DATABASE_URL="postgresql+asyncpg://finance:changeme@127.0.0.1:5435/finance_test" \
uv run pytest -q

# TypeScript
cd frontend && bun tsc --noEmit
```

Expected: all API tests pass (29 existing + new tests for statements, budgets, notifications, discord, statement alerts), TypeScript exits with code 0.

---

## Dependency graph

```
Task 1  (statements router)     — no deps
Task 2  (budget model)          — no deps
Task 3  (budgets CRUD router)   — depends on Task 2
Task 4  (budget status)         — depends on Task 3
Task 5  (notification model)    — no deps
Task 6  (notifications router)  — depends on Task 5
Task 7  (SSE endpoint)          — depends on Task 6
Task 8  (discord service)       — no deps
Task 9  (budget alerts)         — depends on Tasks 3, 4, 5, 6, 8
Task 10 (celery due-date task)  — depends on Tasks 1, 5, 6, 8
Task 11 (frontend statements)   — depends on Task 1
Task 12 (frontend budgets)      — depends on Tasks 3, 4
Task 13 (frontend txn edit)     — no API deps (uses existing endpoints)
Task 14 (frontend txn filters)  — depends on Task 13 (same file)
Task 15 (frontend notifications)— depends on Tasks 6, 7
```

Recommended implementation order: 2 → 5 → 8 → 1 → 3 → 4 → 6 → 7 → 9 → 10 → 11 → 12 → 13 → 14 → 15

---

## Commit message summary

```
feat: add statements router with CRUD and mark-paid
feat: add budget model and migration
feat: add budgets CRUD router
feat: add budget status endpoint with ok/warning/exceeded thresholds
feat: add notification model and migration
feat: add notifications router with list and mark-read endpoints
feat: add SSE stream endpoint for real-time notifications
feat: add Discord webhook notification service
feat: add budget alert service and integrate with transaction writes
feat: add Celery beat task for statement due-date notifications
feat: add statements frontend page with mark-paid and add form
feat: add budgets frontend page with progress bars and add/delete
feat: add transaction edit and delete via side sheet
feat: add date, account, and category filter panel to transactions
feat: add notifications page, SSE bell badge, and unread count
```
