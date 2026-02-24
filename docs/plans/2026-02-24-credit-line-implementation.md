# Credit Line Management Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a Credit Line entity so multiple cards can share a credit pool, expose available-credit computation, and wire up edit/delete on the cards page.

**Architecture:** New `credit_lines` table referenced by `credit_cards.credit_line_id` (nullable). A credit line's available credit is `total_limit + sum(current_balance of linked accounts)` — account balances are negative for credit card debt, so adding them shrinks the available pool. Manual override field on both lines and standalone cards. Frontend groups cards under their line headers; standalone cards show independently.

**Tech Stack:** FastAPI, SQLAlchemy async, Alembic, Pydantic v2, pytest-asyncio, Next.js 16, TypeScript strict, shadcn/ui

---

## Key facts for implementers

- **Balance math:** credit card accounts carry *negative* balances (e.g. ₱5,000 spent → balance = −5,000). So `available = total_limit + balance` (adding a negative number reduces availability).
- **Test DB:** tests run inside Docker: `docker compose run --rm api pytest`. conftest uses `Base.metadata.create_all` — new models must be imported in `api/app/models/__init__.py` (or wherever Base sees them) before tests run.
- **Import pattern:** models are auto-discovered if imported in `api/app/main.py` or transitively. Add `from app.models.credit_line import CreditLine` in `api/app/main.py` near the other model imports.
- **Migration IDs:** use the exact revision IDs shown below — do not regenerate them.
- **Alembic command:**
  ```bash
  DATABASE_URL="postgresql+asyncpg://finance:changeme@127.0.0.1:5435/finance_db" \
    docker compose run --rm api alembic upgrade head
  ```
- **Run tests:**
  ```bash
  docker compose run --rm api pytest
  ```

---

## Task 1: Migration — create `credit_lines` table

**Files:**
- Create: `api/migrations/versions/c1d2e3f4a5b6_create_credit_lines.py`

**Step 1: Create the migration file**

```python
"""create credit_lines table

Revision ID: c1d2e3f4a5b6
Revises: bad965c5317c
Create Date: 2026-02-24 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'c1d2e3f4a5b6'
down_revision: Union[str, Sequence[str], None] = 'bad965c5317c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'credit_lines',
        sa.Column('id', sa.UUID(), server_default=sa.text('uuidv7()'), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('total_limit', sa.Numeric(precision=15, scale=2), nullable=True),
        sa.Column('available_override', sa.Numeric(precision=15, scale=2), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_credit_lines_user_id', 'credit_lines', ['user_id'])


def downgrade() -> None:
    op.drop_index('ix_credit_lines_user_id', table_name='credit_lines')
    op.drop_table('credit_lines')
```

**Step 2: Apply migration**

```bash
DATABASE_URL="postgresql+asyncpg://finance:changeme@127.0.0.1:5435/finance_db" \
  docker compose run --rm api alembic upgrade head
```

Expected: `Running upgrade bad965c5317c -> c1d2e3f4a5b6, create credit_lines table`

**Step 3: Commit**

```bash
git add api/migrations/versions/c1d2e3f4a5b6_create_credit_lines.py
git commit -m "feat: migration — create credit_lines table"
```

---

## Task 2: Migration — extend `credit_cards` table

**Files:**
- Create: `api/migrations/versions/d2e3f4a5b6c7_extend_credit_cards.py`

**Step 1: Create the migration file**

```python
"""extend credit_cards with credit_line_id, card_name, available_override

Revision ID: d2e3f4a5b6c7
Revises: c1d2e3f4a5b6
Create Date: 2026-02-24 00:00:01.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'd2e3f4a5b6c7'
down_revision: Union[str, Sequence[str], None] = 'c1d2e3f4a5b6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('credit_cards', sa.Column('credit_line_id', sa.UUID(), nullable=True))
    op.add_column('credit_cards', sa.Column('card_name', sa.String(length=255), nullable=True))
    op.add_column('credit_cards', sa.Column('available_override', sa.Numeric(precision=15, scale=2), nullable=True))
    op.create_foreign_key(
        'fk_credit_cards_credit_line_id',
        'credit_cards', 'credit_lines',
        ['credit_line_id'], ['id'],
        ondelete='SET NULL',
    )
    op.create_index('ix_credit_cards_credit_line_id', 'credit_cards', ['credit_line_id'])


def downgrade() -> None:
    op.drop_index('ix_credit_cards_credit_line_id', table_name='credit_cards')
    op.drop_constraint('fk_credit_cards_credit_line_id', 'credit_cards', type_='foreignkey')
    op.drop_column('credit_cards', 'available_override')
    op.drop_column('credit_cards', 'card_name')
    op.drop_column('credit_cards', 'credit_line_id')
```

**Step 2: Apply migration**

```bash
DATABASE_URL="postgresql+asyncpg://finance:changeme@127.0.0.1:5435/finance_db" \
  docker compose run --rm api alembic upgrade head
```

Expected: `Running upgrade c1d2e3f4a5b6 -> d2e3f4a5b6c7, extend credit_cards ...`

**Step 3: Commit**

```bash
git add api/migrations/versions/d2e3f4a5b6c7_extend_credit_cards.py
git commit -m "feat: migration — extend credit_cards with credit_line fields"
```

---

## Task 3: CreditLine model + schemas

**Files:**
- Create: `api/app/models/credit_line.py`
- Modify: `api/app/models/credit_card.py`
- Create: `api/app/schemas/credit_line.py`
- Modify: `api/app/schemas/credit_card.py`

**Step 1: Create `api/app/models/credit_line.py`**

```python
import uuid
from datetime import datetime
from decimal import Decimal
from sqlalchemy import String, DateTime, Numeric, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class CreditLine(Base):
    __tablename__ = "credit_lines"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=func.uuidv7()
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    total_limit: Mapped[Decimal | None] = mapped_column(Numeric(15, 2), nullable=True)
    available_override: Mapped[Decimal | None] = mapped_column(Numeric(15, 2), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    cards: Mapped[list["CreditCard"]] = relationship(  # type: ignore[name-defined]
        "CreditCard", back_populates="credit_line", lazy="selectin"
    )
```

**Step 2: Update `api/app/models/credit_card.py`**

Add these imports at the top:
```python
from sqlalchemy.orm import relationship
```

Add these columns inside the `CreditCard` class (after `credit_limit`):
```python
    credit_line_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("credit_lines.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    card_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    available_override: Mapped[Decimal | None] = mapped_column(Numeric(15, 2), nullable=True)

    credit_line: Mapped["CreditLine | None"] = relationship(  # type: ignore[name-defined]
        "CreditLine", back_populates="cards"
    )
```

**Step 3: Create `api/app/schemas/credit_line.py`**

```python
import uuid
from decimal import Decimal
from pydantic import BaseModel


class CreditLineCreate(BaseModel):
    name: str
    total_limit: Decimal | None = None
    available_override: Decimal | None = None


class CreditLineUpdate(BaseModel):
    name: str | None = None
    total_limit: Decimal | None = None
    available_override: Decimal | None = None


class CreditCardInLine(BaseModel):
    """Minimal card info nested inside CreditLineResponse."""
    id: uuid.UUID
    bank_name: str
    card_name: str | None
    last_four: str
    statement_day: int
    due_day: int
    account_id: uuid.UUID
    closed_period: dict | None = None
    open_period: dict | None = None
    due_date: str | None = None
    days_until_due: int | None = None

    model_config = {"from_attributes": True}


class CreditLineResponse(BaseModel):
    id: uuid.UUID
    name: str
    total_limit: Decimal | None
    available_override: Decimal | None
    available_credit: Decimal | None  # computed
    cards: list[CreditCardInLine]

    model_config = {"from_attributes": True}
```

**Step 4: Update `api/app/schemas/credit_card.py`**

Add `credit_line_id`, `card_name`, `available_override`, `available_credit` to existing schemas:

In `CreditCardCreate`, add:
```python
    credit_line_id: uuid.UUID | None = None
    card_name: str | None = None
    available_override: Decimal | None = None
```

In `CreditCardUpdate`, add:
```python
    credit_line_id: uuid.UUID | None = None
    card_name: str | None = None
    available_override: Decimal | None = None
```

In `CreditCardResponse`, add:
```python
    credit_line_id: uuid.UUID | None = None
    card_name: str | None = None
    available_override: Decimal | None = None
    available_credit: Decimal | None = None  # computed, injected
```

**Step 5: Register CreditLine model so tests can see it**

In `api/app/main.py`, add this import near the top (with the other model-touching imports):
```python
from app.models import credit_line as _credit_line_model  # noqa: F401
```

**Step 6: Run existing tests to confirm nothing broke**

```bash
docker compose run --rm api pytest api/tests/test_credit_cards.py -v
```

Expected: all pass (model changes are additive/nullable).

**Step 7: Commit**

```bash
git add api/app/models/credit_line.py api/app/models/credit_card.py \
        api/app/schemas/credit_line.py api/app/schemas/credit_card.py \
        api/app/main.py
git commit -m "feat: CreditLine model and updated schemas"
```

---

## Task 4: CreditLine service + router

**Files:**
- Create: `api/app/services/credit_line.py`
- Create: `api/app/routers/credit_lines.py`
- Modify: `api/app/main.py`

**Step 1: Create `api/app/services/credit_line.py`**

```python
import uuid
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.credit_line import CreditLine
from app.models.credit_card import CreditCard
from app.models.account import Account
from app.services.account import compute_balances_bulk


async def compute_line_available_credit(
    db: AsyncSession,
    credit_line: CreditLine,
) -> Decimal | None:
    """
    If available_override is set, return it directly.
    Otherwise: total_limit + sum(current_balance for all linked accounts).
    Credit card accounts carry negative balances (debt), so adding them reduces availability.
    Returns None if total_limit is not set.
    """
    if credit_line.available_override is not None:
        return credit_line.available_override
    if credit_line.total_limit is None:
        return None

    cards = credit_line.cards  # loaded via selectin
    if not cards:
        return credit_line.total_limit

    account_ids = [c.account_id for c in cards]
    result = await db.execute(select(Account).where(Account.id.in_(account_ids)))
    accounts = result.scalars().all()

    balances = await compute_balances_bulk(db, list(accounts))
    total_balance = sum(balances.values(), Decimal("0.00"))
    return credit_line.total_limit + total_balance


async def compute_card_available_credit(
    db: AsyncSession,
    card: CreditCard,
) -> Decimal | None:
    """
    For standalone cards only (credit_line_id is None).
    If available_override is set, return it directly.
    Otherwise: credit_limit + current_account_balance.
    Returns None if credit_limit is not set.
    """
    if card.available_override is not None:
        return card.available_override
    if card.credit_limit is None:
        return None

    result = await db.execute(select(Account).where(Account.id == card.account_id))
    account = result.scalar_one_or_none()
    if account is None:
        return None

    balances = await compute_balances_bulk(db, [account])
    balance = balances.get(account.id, Decimal("0.00"))
    return card.credit_limit + balance
```

**Step 2: Create `api/app/routers/credit_lines.py`**

```python
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.dependencies import get_current_user
from app.models.credit_line import CreditLine
from app.models.credit_card import CreditCard
from app.models.user import User
from app.schemas.credit_line import CreditLineCreate, CreditLineUpdate, CreditLineResponse, CreditCardInLine
from app.services.credit_line import compute_line_available_credit
from app.services.credit_card import (
    get_closed_statement_period,
    get_open_billing_period,
    get_due_date,
    days_until_due,
)

router = APIRouter(prefix="/credit-lines", tags=["credit-lines"])


def _card_to_summary(card: CreditCard) -> CreditCardInLine:
    closed = get_closed_statement_period(card.statement_day)
    open_ = get_open_billing_period(card.statement_day)
    due = get_due_date(card.statement_day, card.due_day)
    return CreditCardInLine.model_validate({
        **card.__dict__,
        "closed_period": {k: str(v) for k, v in closed.items()},
        "open_period": {k: str(v) for k, v in open_.items()},
        "due_date": str(due),
        "days_until_due": days_until_due(due),
    })


async def _enrich(db: AsyncSession, line: CreditLine) -> CreditLineResponse:
    available = await compute_line_available_credit(db, line)
    return CreditLineResponse.model_validate({
        **line.__dict__,
        "available_credit": available,
        "cards": [_card_to_summary(c) for c in line.cards],
    })


@router.get("", response_model=list[CreditLineResponse])
async def list_credit_lines(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CreditLine).where(CreditLine.user_id == current_user.id)
    )
    lines = result.scalars().all()
    return [await _enrich(db, line) for line in lines]


@router.post("", response_model=CreditLineResponse, status_code=201)
async def create_credit_line(
    data: CreditLineCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    line = CreditLine(**data.model_dump(), user_id=current_user.id)
    db.add(line)
    await db.commit()
    await db.refresh(line)
    return await _enrich(db, line)


@router.patch("/{line_id}", response_model=CreditLineResponse)
async def update_credit_line(
    line_id: uuid.UUID,
    data: CreditLineUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CreditLine).where(CreditLine.id == line_id, CreditLine.user_id == current_user.id)
    )
    line = result.scalar_one_or_none()
    if not line:
        raise HTTPException(status_code=404, detail="Credit line not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(line, field, value)
    await db.commit()
    await db.refresh(line)
    return await _enrich(db, line)


@router.delete("/{line_id}", status_code=204)
async def delete_credit_line(
    line_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CreditLine).where(CreditLine.id == line_id, CreditLine.user_id == current_user.id)
    )
    line = result.scalar_one_or_none()
    if not line:
        raise HTTPException(status_code=404, detail="Credit line not found")
    # Detach cards: set credit_line_id = NULL on all linked cards
    cards_result = await db.execute(
        select(CreditCard).where(CreditCard.credit_line_id == line_id)
    )
    for card in cards_result.scalars().all():
        card.credit_line_id = None
    await db.delete(line)
    await db.commit()
```

**Step 3: Register the router in `api/app/main.py`**

Add after the existing router imports:
```python
from app.routers import credit_lines as credit_lines_router
```

Add after the existing `app.include_router(cc_router)` call:
```python
app.include_router(credit_lines_router.router)
```

**Step 4: Run tests**

```bash
docker compose run --rm api pytest api/tests/test_credit_cards.py -v
```

Expected: all pass.

**Step 5: Commit**

```bash
git add api/app/services/credit_line.py api/app/routers/credit_lines.py api/app/main.py
git commit -m "feat: CreditLine service and router"
```

---

## Task 5: Update CreditCard router to include available_credit + new fields

**Files:**
- Modify: `api/app/routers/credit_cards.py`

**Step 1: Update the `_enrich` function**

The existing `_enrich` in `credit_cards.py` needs to compute `available_credit` for standalone cards.

Replace the existing `_enrich` function with:

```python
async def _enrich(card: CreditCard, db: AsyncSession) -> CreditCardResponse:
    from app.services.credit_line import compute_card_available_credit
    closed = get_closed_statement_period(card.statement_day)
    open_ = get_open_billing_period(card.statement_day)
    due = get_due_date(card.statement_day, card.due_day)
    available = None
    if card.credit_line_id is None:
        available = await compute_card_available_credit(db, card)
    return CreditCardResponse.model_validate({
        **card.__dict__,
        "closed_period": {k: str(v) for k, v in closed.items()},
        "open_period": {k: str(v) for k, v in open_.items()},
        "due_date": due,
        "days_until_due": days_until_due(due),
        "available_credit": available,
    })
```

Note: `_enrich` now takes `db` as second argument. Update all call sites:
- `list_credit_cards`: change `[_enrich(c) for c in ...]` to `[await _enrich(c, db) for c in ...]`
- `create_credit_card`: change `return _enrich(card)` to `return await _enrich(card, db)`
- `update_credit_card`: change `return _enrich(card)` to `return await _enrich(card, db)`

Also update the `AsyncSession` import — add `db: AsyncSession = Depends(get_db)` parameter to list endpoint if not already present (it already is).

**Step 2: Run existing credit card tests**

```bash
docker compose run --rm api pytest api/tests/test_credit_cards.py -v
```

Expected: all pass. The new fields are nullable so existing tests are unaffected.

**Step 3: Commit**

```bash
git add api/app/routers/credit_cards.py
git commit -m "feat: credit card router returns available_credit and new fields"
```

---

## Task 6: API tests for credit lines

**Files:**
- Create: `api/tests/test_credit_lines.py`

**Step 1: Write the test file**

```python
import pytest_asyncio
from decimal import Decimal
from httpx import AsyncClient


@pytest_asyncio.fixture
async def cc_account_id(auth_client: AsyncClient) -> str:
    r = await auth_client.post("/accounts", json={
        "name": "BPI CC Account", "type": "credit_card"
    })
    assert r.status_code == 201
    return r.json()["id"]


@pytest_asyncio.fixture
async def credit_line_id(auth_client: AsyncClient) -> str:
    r = await auth_client.post("/credit-lines", json={
        "name": "BPI Credit Line",
        "total_limit": "50000.00",
    })
    assert r.status_code == 201
    return r.json()["id"]


async def test_list_credit_lines_empty(auth_client):
    r = await auth_client.get("/credit-lines")
    assert r.status_code == 200
    assert r.json() == []


async def test_create_credit_line(auth_client):
    r = await auth_client.post("/credit-lines", json={
        "name": "BPI Credit Line",
        "total_limit": "50000.00",
    })
    assert r.status_code == 201
    data = r.json()
    assert data["name"] == "BPI Credit Line"
    assert data["total_limit"] == "50000.00"
    assert data["available_credit"] == "50000.00"  # no cards yet
    assert data["cards"] == []


async def test_create_credit_line_no_limit(auth_client):
    r = await auth_client.post("/credit-lines", json={"name": "Unlimited Line"})
    assert r.status_code == 201
    data = r.json()
    assert data["total_limit"] is None
    assert data["available_credit"] is None


async def test_update_credit_line(auth_client, credit_line_id):
    r = await auth_client.patch(f"/credit-lines/{credit_line_id}", json={
        "name": "BPI Updated",
        "total_limit": "75000.00",
    })
    assert r.status_code == 200
    assert r.json()["name"] == "BPI Updated"
    assert r.json()["total_limit"] == "75000.00"


async def test_delete_credit_line_detaches_cards(auth_client, credit_line_id, cc_account_id):
    # Create a card in this line
    r = await auth_client.post("/credit-cards", json={
        "account_id": cc_account_id,
        "bank_name": "BPI",
        "last_four": "1234",
        "statement_day": 15,
        "due_day": 5,
        "credit_line_id": credit_line_id,
        "card_name": "Amore Cashback",
    })
    assert r.status_code == 201
    card_id = r.json()["id"]

    # Delete the line
    del_r = await auth_client.delete(f"/credit-lines/{credit_line_id}")
    assert del_r.status_code == 204

    # Card still exists, credit_line_id is now null
    card_r = await auth_client.get("/credit-cards")
    cards = card_r.json()
    card = next(c for c in cards if c["id"] == card_id)
    assert card["credit_line_id"] is None


async def test_delete_credit_line_not_found(auth_client):
    import uuid
    r = await auth_client.delete(f"/credit-lines/{uuid.uuid4()}")
    assert r.status_code == 404


async def test_available_credit_with_manual_override(auth_client):
    r = await auth_client.post("/credit-lines", json={
        "name": "Manual Line",
        "total_limit": "50000.00",
        "available_override": "12345.00",
    })
    assert r.status_code == 201
    assert r.json()["available_credit"] == "12345.00"


async def test_credit_card_with_credit_line(auth_client, credit_line_id, cc_account_id):
    r = await auth_client.post("/credit-cards", json={
        "account_id": cc_account_id,
        "bank_name": "BPI",
        "last_four": "5678",
        "statement_day": 15,
        "due_day": 5,
        "credit_line_id": credit_line_id,
        "card_name": "Rewards Blue",
    })
    assert r.status_code == 201
    data = r.json()
    assert data["credit_line_id"] == credit_line_id
    assert data["card_name"] == "Rewards Blue"
    # available_credit is None for line-backed cards (line owns it)
    assert data["available_credit"] is None


async def test_credit_lines_require_auth(client):
    r = await client.get("/credit-lines")
    assert r.status_code == 401


async def test_credit_line_available_credit_decreases_with_spending(
    auth_client, credit_line_id, cc_account_id
):
    # Attach card to the line
    await auth_client.post("/credit-cards", json={
        "account_id": cc_account_id,
        "bank_name": "BPI",
        "last_four": "9999",
        "statement_day": 15,
        "due_day": 5,
        "credit_line_id": credit_line_id,
    })

    # Add an expense transaction (simulates credit card spending)
    accounts_r = await auth_client.get("/accounts")
    account = next(a for a in accounts_r.json() if a["id"] == cc_account_id)

    # Add a category first
    cat_r = await auth_client.get("/categories")
    category_id = cat_r.json()[0]["id"]

    await auth_client.post("/transactions", json={
        "account_id": cc_account_id,
        "type": "expense",
        "amount": "5000.00",
        "date": "2026-02-24",
        "category_id": category_id,
        "description": "Test purchase",
    })

    # Available credit should now be 50000 - 5000 = 45000
    line_r = await auth_client.get("/credit-lines")
    line = next(l for l in line_r.json() if l["id"] == credit_line_id)
    assert Decimal(line["available_credit"]) == Decimal("45000.00")
```

**Step 2: Run the new tests**

```bash
docker compose run --rm api pytest api/tests/test_credit_lines.py -v
```

Expected: all pass.

**Step 3: Run full suite**

```bash
docker compose run --rm api pytest
```

Expected: all pass (160+ tests).

**Step 4: Commit**

```bash
git add api/tests/test_credit_lines.py
git commit -m "test: credit lines API tests"
```

---

## Task 7: Update existing credit card tests for new fields

**Files:**
- Modify: `api/tests/test_credit_cards.py`

The existing tests still pass, but some should be updated to verify the new fields are present in responses.

**Step 1: Add assertions to `test_create_credit_card`**

Add after the existing assertions:
```python
    assert data["credit_line_id"] is None
    assert data["card_name"] is None
    assert data["available_credit"] == "50000.00"  # 50000 limit, 0 balance
```

**Step 2: Add a test for card with card_name**

```python
async def test_create_credit_card_with_card_name(auth_client, cc_account_id):
    r = await auth_client.post("/credit-cards", json={
        "account_id": cc_account_id,
        "bank_name": "RCBC",
        "last_four": "4321",
        "credit_limit": "30000.00",
        "card_name": "Gold",
        "statement_day": 20,
        "due_day": 10,
    })
    assert r.status_code == 201
    data = r.json()
    assert data["card_name"] == "Gold"
    assert data["available_credit"] == "30000.00"
```

**Step 3: Run credit card tests**

```bash
docker compose run --rm api pytest api/tests/test_credit_cards.py -v
```

Expected: all pass.

**Step 4: Commit**

```bash
git add api/tests/test_credit_cards.py
git commit -m "test: update credit card tests for new fields"
```

---

## Task 8: Frontend — update types and grouped display on `/cards` page

**Files:**
- Modify: `frontend/src/app/(dashboard)/cards/page.tsx`

**Step 1: Update TypeScript interfaces**

Replace the existing `CreditCard` interface and add `CreditLine`:

```tsx
interface CreditCardInLine {
  id: string;
  bank_name: string;
  card_name: string | null;
  last_four: string;
  statement_day: number;
  due_day: number;
  account_id: string;
  closed_period: { period_start: string; period_end: string } | null;
  open_period: { period_start: string; period_end: string } | null;
  due_date: string | null;
  days_until_due: number | null;
}

interface CreditLine {
  id: string;
  name: string;
  total_limit: string | null;
  available_override: string | null;
  available_credit: string | null;
  cards: CreditCardInLine[];
}

interface CreditCard {
  id: string;
  bank_name: string;
  card_name: string | null;
  last_four: string;
  statement_day: number;
  due_day: number;
  credit_limit: string | null;
  available_credit: string | null;
  available_override: string | null;
  credit_line_id: string | null;
  closed_period: { period_start: string; period_end: string } | null;
  open_period: { period_start: string; period_end: string } | null;
  due_date: string | null;
  days_until_due: number | null;
}
```

**Step 2: Update state and data fetching**

Replace existing state/fetch logic with:

```tsx
const [cards, setCards] = useState<CreditCard[]>([]);
const [creditLines, setCreditLines] = useState<CreditLine[]>([]);
const [accounts, setAccounts] = useState<Account[]>([]);
const [loading, setLoading] = useState(true);

async function loadData() {
  try {
    const [c, a, cl] = await Promise.all([
      api.get<CreditCard[]>("/credit-cards"),
      api.get<Account[]>("/accounts"),
      api.get<CreditLine[]>("/credit-lines"),
    ]);
    setCards(c);
    setAccounts(a);
    setCreditLines(cl);
  } catch {
    setLoadError("Failed to load cards. Please refresh.");
  } finally {
    setLoading(false);
  }
}
```

**Step 3: Add a helper to render billing info (used by both grouped and standalone cards)**

Add this helper component inside the file (above `CardsPage`):

```tsx
function BillingInfo({ card }: { card: CreditCard | CreditCardInLine }) {
  return (
    <div className="space-y-2 mt-3">
      {card.closed_period && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-0.5">Current Statement</p>
          <p className="text-sm">{card.closed_period.period_start} → {card.closed_period.period_end}</p>
          {card.due_date && (
            <p className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
              Due: {card.due_date}
              {card.days_until_due !== null && (
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  card.days_until_due < 0
                    ? "bg-accent-red-dim text-accent-red"
                    : card.days_until_due <= 5
                    ? "bg-accent-amber-dim text-accent-amber"
                    : "bg-muted text-muted-foreground"
                }`}>
                  {card.days_until_due < 0 ? "Overdue" : `${card.days_until_due}d left`}
                </span>
              )}
            </p>
          )}
        </div>
      )}
      {card.open_period && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-0.5">Open Period</p>
          <p className="text-sm">{card.open_period.period_start} → {card.open_period.period_end}</p>
        </div>
      )}
    </div>
  );
}
```

**Step 4: Replace the cards grid with grouped display**

Replace the existing cards grid (the `cards.map(...)` section) with:

```tsx
<div className="space-y-6">
  {/* Credit Lines */}
  {creditLines.map((line) => (
    <div key={line.id} className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <div>
          <p className="text-sm font-semibold text-foreground">{line.name}</p>
          <p className="text-xs text-muted-foreground">
            {line.total_limit && `Total: ${formatPeso(line.total_limit)}`}
            {line.available_credit != null && ` · Available: ${formatPeso(line.available_credit)}`}
            {line.available_override != null && (
              <span className="ml-1 text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">manual</span>
            )}
          </p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {line.cards.map((c) => (
          <div key={c.id} className="rounded-xl border bg-card p-5 card-interactive">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg bg-accent-blue-dim flex items-center justify-center shrink-0">
                <CreditCardIcon className="h-4 w-4 text-accent-blue" />
              </div>
              <div>
                <p className="font-semibold text-foreground text-sm">{c.bank_name} ···{c.last_four}</p>
                {c.card_name && <p className="text-xs text-muted-foreground">{c.card_name}</p>}
              </div>
            </div>
            <BillingInfo card={c} />
          </div>
        ))}
      </div>
    </div>
  ))}

  {/* Standalone cards */}
  {cards.filter((c) => c.credit_line_id === null).length > 0 && (
    <div className="space-y-3">
      {creditLines.length > 0 && (
        <p className="text-sm font-semibold text-foreground px-1">Standalone</p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {cards.filter((c) => c.credit_line_id === null).map((c) => (
          <div key={c.id} className="rounded-xl border bg-card p-5 card-interactive">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg bg-accent-blue-dim flex items-center justify-center shrink-0">
                <CreditCardIcon className="h-4 w-4 text-accent-blue" />
              </div>
              <div>
                <p className="font-semibold text-foreground text-sm">{c.bank_name} ···{c.last_four}</p>
                {c.card_name && <p className="text-xs text-muted-foreground">{c.card_name}</p>}
              </div>
            </div>
            {(c.credit_limit || c.available_credit) && (
              <p className="text-xs text-muted-foreground mt-1">
                {c.credit_limit && `Total: ${formatPeso(c.credit_limit)}`}
                {c.available_credit != null && ` · Available: ${formatPeso(c.available_credit)}`}
                {c.available_override != null && (
                  <span className="ml-1 text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">manual</span>
                )}
              </p>
            )}
            <BillingInfo card={c} />
          </div>
        ))}
      </div>
    </div>
  )}
</div>
```

**Step 5: Add `formatPeso` import**

Add to imports:
```tsx
import { formatPeso } from "@/lib/utils";
```

**Step 6: Update the empty state check**

Change:
```tsx
) : cards.length === 0 ? (
```
To:
```tsx
) : cards.length === 0 && creditLines.length === 0 ? (
```

**Step 7: Verify in browser**

Navigate to `http://localhost:3000/cards`. Cards belonging to a credit line should appear grouped under the line name with total/available credit shown. Standalone cards appear below.

**Step 8: Commit**

```bash
git add 'frontend/src/app/(dashboard)/cards/page.tsx'
git commit -m "feat: cards page grouped display with credit line support"
```

---

## Task 9: Frontend — edit/delete card (three-dot menu)

**Files:**
- Modify: `frontend/src/app/(dashboard)/cards/page.tsx`

**Step 1: Add MoreHorizontal icon import**

Add to lucide-react import:
```tsx
import { Plus, CreditCard as CreditCardIcon, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
```

**Step 2: Add DropdownMenu imports**

```tsx
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
```

**Step 3: Add edit/delete state**

```tsx
const [editCard, setEditCard] = useState<CreditCard | null>(null);
const [editOpen, setEditOpen] = useState(false);
const [deleteCardId, setDeleteCardId] = useState<string | null>(null);
const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
const [deleteSubmitting, setDeleteSubmitting] = useState(false);
const [editSubmitting, setEditSubmitting] = useState(false);
const [editError, setEditError] = useState<string | null>(null);

// Edit form state (pre-filled when editCard changes)
const [editBankName, setEditBankName] = useState("");
const [editCardName, setEditCardName] = useState("");
const [editCreditLimit, setEditCreditLimit] = useState("");
const [editStatementDay, setEditStatementDay] = useState("15");
const [editDueDay, setEditDueDay] = useState("3");
```

**Step 4: Add openEdit helper**

```tsx
function openEdit(card: CreditCard) {
  setEditCard(card);
  setEditBankName(card.bank_name);
  setEditCardName(card.card_name ?? "");
  setEditCreditLimit(card.credit_limit ?? "");
  setEditStatementDay(String(card.statement_day));
  setEditDueDay(String(card.due_day));
  setEditError(null);
  setEditOpen(true);
}
```

**Step 5: Add handleEditCard and handleDeleteCard**

```tsx
async function handleEditCard() {
  if (!editCard) return;
  setEditSubmitting(true);
  setEditError(null);
  try {
    await api.patch(`/credit-cards/${editCard.id}`, {
      bank_name: editBankName || undefined,
      card_name: editCardName || null,
      credit_limit: editCreditLimit ? Number(editCreditLimit) : null,
      statement_day: Number(editStatementDay),
      due_day: Number(editDueDay),
    });
    setEditOpen(false);
    await loadData();
  } catch (e: unknown) {
    setEditError(e instanceof Error ? e.message : "Failed to update card");
  } finally {
    setEditSubmitting(false);
  }
}

async function handleDeleteCard() {
  if (!deleteCardId) return;
  setDeleteSubmitting(true);
  try {
    await api.delete(`/credit-cards/${deleteCardId}`);
    setDeleteConfirmOpen(false);
    setDeleteCardId(null);
    await loadData();
  } catch {
    // card delete failed — keep dialog open so user can retry
  } finally {
    setDeleteSubmitting(false);
  }
}
```

**Step 6: Add three-dot menu to each card**

In both the credit-line cards and standalone cards, add a three-dot menu to the card header. Replace the card header div:

```tsx
<div className="flex items-center justify-between mb-1">
  <div className="flex items-center gap-2">
    <div className="w-8 h-8 rounded-lg bg-accent-blue-dim flex items-center justify-center shrink-0">
      <CreditCardIcon className="h-4 w-4 text-accent-blue" />
    </div>
    <div>
      <p className="font-semibold text-foreground text-sm">{c.bank_name} ···{c.last_four}</p>
      {c.card_name && <p className="text-xs text-muted-foreground">{c.card_name}</p>}
    </div>
  </div>
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <button className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground">
        <MoreHorizontal className="h-4 w-4" />
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem onClick={() => openEdit(c as CreditCard)}>
        <Pencil className="h-4 w-4 mr-2" />Edit
      </DropdownMenuItem>
      <DropdownMenuItem
        className="text-destructive focus:text-destructive"
        onClick={() => { setDeleteCardId(c.id); setDeleteConfirmOpen(true); }}
      >
        <Trash2 className="h-4 w-4 mr-2" />Delete
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</div>
```

Note: `CreditCardInLine` cards in a line need the same menu. The `openEdit` call needs to build a compatible object — since `CreditCardInLine` doesn't have all `CreditCard` fields, cast with a partial: `openEdit({ ...c, credit_limit: null, available_credit: null, available_override: null, credit_line_id: line.id } as CreditCard)`.

**Step 7: Add Edit sheet and Delete confirmation**

Add before the closing `</div>` of the page:

```tsx
{/* Edit Card Sheet */}
<CrudSheet
  open={editOpen}
  onOpenChange={setEditOpen}
  title="Edit Credit Card"
  description="Update card details"
  onSave={handleEditCard}
  saveLabel={editSubmitting ? "Saving…" : "Save Changes"}
  saveDisabled={editSubmitting}
>
  <div className="space-y-4">
    <div className="space-y-2">
      <Label>Bank</Label>
      <Input value={editBankName} onChange={(e) => setEditBankName(e.target.value)} />
    </div>
    <div className="space-y-2">
      <Label>Card Name</Label>
      <Input value={editCardName} onChange={(e) => setEditCardName(e.target.value)} placeholder="e.g. Amore Cashback" />
    </div>
    {editCard?.credit_line_id === null && (
      <div className="space-y-2">
        <Label>Credit Limit</Label>
        <CurrencyInput value={editCreditLimit} onChange={setEditCreditLimit} placeholder="0.00" />
      </div>
    )}
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label>Statement Day</Label>
        <Input type="number" min="1" max="28" value={editStatementDay} onChange={(e) => setEditStatementDay(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>Due Day</Label>
        <Input type="number" min="1" max="28" value={editDueDay} onChange={(e) => setEditDueDay(e.target.value)} />
      </div>
    </div>
    {editError && <p className="text-sm text-destructive">{editError}</p>}
  </div>
</CrudSheet>

{/* Delete Confirmation */}
{deleteConfirmOpen && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
    <div className="bg-card rounded-xl border p-6 max-w-sm mx-4 space-y-4">
      <h2 className="text-lg font-semibold">Delete card?</h2>
      <p className="text-sm text-muted-foreground">This card and its billing cycle history will be removed. Your transactions are not affected.</p>
      <div className="flex gap-3 justify-end">
        <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)} disabled={deleteSubmitting}>Cancel</Button>
        <Button variant="destructive" onClick={handleDeleteCard} disabled={deleteSubmitting}>
          {deleteSubmitting ? "Deleting…" : "Delete"}
        </Button>
      </div>
    </div>
  </div>
)}
```

**Step 8: Verify in browser**

Each card should have a `⋯` menu. Clicking Edit opens a pre-filled sheet. Clicking Delete shows a confirmation. After delete the card disappears from the list.

**Step 9: Commit**

```bash
git add 'frontend/src/app/(dashboard)/cards/page.tsx'
git commit -m "feat: edit and delete credit card from cards page"
```

---

## Task 10: Frontend — credit line management (create/edit/delete)

**Files:**
- Modify: `frontend/src/app/(dashboard)/cards/page.tsx`

**Step 1: Add credit line state**

```tsx
const [lineOpen, setLineOpen] = useState(false);
const [lineSubmitting, setLineSubmitting] = useState(false);
const [lineError, setLineError] = useState<string | null>(null);
const [lineName, setLineName] = useState("");
const [lineTotalLimit, setLineTotalLimit] = useState("");

const [editLine, setEditLine] = useState<CreditLine | null>(null);
const [editLineOpen, setEditLineOpen] = useState(false);
const [editLineName, setEditLineName] = useState("");
const [editLineTotalLimit, setEditLineTotalLimit] = useState("");
const [editLineSubmitting, setEditLineSubmitting] = useState(false);
const [editLineError, setEditLineError] = useState<string | null>(null);

const [deleteLineId, setDeleteLineId] = useState<string | null>(null);
const [deleteLineConfirmOpen, setDeleteLineConfirmOpen] = useState(false);
const [deleteLineSubmitting, setDeleteLineSubmitting] = useState(false);
```

**Step 2: Add credit line handlers**

```tsx
async function handleAddLine() {
  setLineSubmitting(true);
  setLineError(null);
  try {
    await api.post("/credit-lines", {
      name: lineName,
      total_limit: lineTotalLimit ? Number(lineTotalLimit) : null,
    });
    setLineOpen(false);
    setLineName("");
    setLineTotalLimit("");
    await loadData();
  } catch (e: unknown) {
    setLineError(e instanceof Error ? e.message : "Failed to create credit line");
  } finally {
    setLineSubmitting(false);
  }
}

function openEditLine(line: CreditLine) {
  setEditLine(line);
  setEditLineName(line.name);
  setEditLineTotalLimit(line.total_limit ?? "");
  setEditLineError(null);
  setEditLineOpen(true);
}

async function handleEditLine() {
  if (!editLine) return;
  setEditLineSubmitting(true);
  setEditLineError(null);
  try {
    await api.patch(`/credit-lines/${editLine.id}`, {
      name: editLineName || undefined,
      total_limit: editLineTotalLimit ? Number(editLineTotalLimit) : null,
    });
    setEditLineOpen(false);
    await loadData();
  } catch (e: unknown) {
    setEditLineError(e instanceof Error ? e.message : "Failed to update credit line");
  } finally {
    setEditLineSubmitting(false);
  }
}

async function handleDeleteLine() {
  if (!deleteLineId) return;
  setDeleteLineSubmitting(true);
  try {
    await api.delete(`/credit-lines/${deleteLineId}`);
    setDeleteLineConfirmOpen(false);
    setDeleteLineId(null);
    await loadData();
  } catch {
    // keep dialog open
  } finally {
    setDeleteLineSubmitting(false);
  }
}
```

**Step 3: Add "Add Credit Line" button to the page header**

Next to the existing "Add Card" button:
```tsx
<div className="flex gap-2">
  <Button size="sm" variant="outline" onClick={() => setLineOpen(true)}>
    <Plus className="h-4 w-4 mr-1" />Add Credit Line
  </Button>
  <Button size="sm" onClick={() => setOpen(true)}>
    <Plus className="h-4 w-4 mr-1" />Add Card
  </Button>
</div>
```

**Step 4: Add three-dot menu to each credit line header**

Replace the existing line header with:
```tsx
<div className="flex items-center justify-between px-1">
  <div>
    <p className="text-sm font-semibold text-foreground">{line.name}</p>
    <p className="text-xs text-muted-foreground">
      {line.total_limit && `Total: ${formatPeso(line.total_limit)}`}
      {line.available_credit != null && ` · Available: ${formatPeso(line.available_credit)}`}
      {line.available_override != null && (
        <span className="ml-1 text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">manual</span>
      )}
    </p>
  </div>
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <button className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground">
        <MoreHorizontal className="h-4 w-4" />
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem onClick={() => openEditLine(line)}>
        <Pencil className="h-4 w-4 mr-2" />Edit line
      </DropdownMenuItem>
      <DropdownMenuItem
        className="text-destructive focus:text-destructive"
        onClick={() => { setDeleteLineId(line.id); setDeleteLineConfirmOpen(true); }}
      >
        <Trash2 className="h-4 w-4 mr-2" />Delete line
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</div>
```

**Step 5: Add Credit Line sheets and confirmation**

Add before the closing `</div>`:

```tsx
{/* Add Credit Line Sheet */}
<CrudSheet
  open={lineOpen}
  onOpenChange={setLineOpen}
  title="New Credit Line"
  description="A credit line groups cards that share a spending limit"
  onSave={handleAddLine}
  saveLabel={lineSubmitting ? "Creating…" : "Create Credit Line"}
  saveDisabled={lineSubmitting}
>
  <div className="space-y-4">
    <div className="space-y-2">
      <Label>Name</Label>
      <Input value={lineName} onChange={(e) => setLineName(e.target.value)} placeholder="BPI Credit Line" />
    </div>
    <div className="space-y-2">
      <Label>Total Limit</Label>
      <CurrencyInput value={lineTotalLimit} onChange={setLineTotalLimit} placeholder="0.00" />
    </div>
    {lineError && <p className="text-sm text-destructive">{lineError}</p>}
  </div>
</CrudSheet>

{/* Edit Credit Line Sheet */}
<CrudSheet
  open={editLineOpen}
  onOpenChange={setEditLineOpen}
  title="Edit Credit Line"
  description="Update credit line details"
  onSave={handleEditLine}
  saveLabel={editLineSubmitting ? "Saving…" : "Save Changes"}
  saveDisabled={editLineSubmitting}
>
  <div className="space-y-4">
    <div className="space-y-2">
      <Label>Name</Label>
      <Input value={editLineName} onChange={(e) => setEditLineName(e.target.value)} />
    </div>
    <div className="space-y-2">
      <Label>Total Limit</Label>
      <CurrencyInput value={editLineTotalLimit} onChange={setEditLineTotalLimit} placeholder="0.00" />
    </div>
    {editLineError && <p className="text-sm text-destructive">{editLineError}</p>}
  </div>
</CrudSheet>

{/* Delete Credit Line Confirmation */}
{deleteLineConfirmOpen && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
    <div className="bg-card rounded-xl border p-6 max-w-sm mx-4 space-y-4">
      <h2 className="text-lg font-semibold">Delete credit line?</h2>
      <p className="text-sm text-muted-foreground">Cards will become standalone. Your transactions are not affected.</p>
      <div className="flex gap-3 justify-end">
        <Button variant="outline" onClick={() => setDeleteLineConfirmOpen(false)} disabled={deleteLineSubmitting}>Cancel</Button>
        <Button variant="destructive" onClick={handleDeleteLine} disabled={deleteLineSubmitting}>
          {deleteLineSubmitting ? "Deleting…" : "Delete"}
        </Button>
      </div>
    </div>
  </div>
)}
```

**Step 6: Commit**

```bash
git add 'frontend/src/app/(dashboard)/cards/page.tsx'
git commit -m "feat: credit line create, edit, delete on cards page"
```

---

## Task 11: Frontend — update Add Card form with card_name and credit line picker

**Files:**
- Modify: `frontend/src/app/(dashboard)/cards/page.tsx`

**Step 1: Add cardName state**

Already uses `bankName`, `accountId`, etc. Add:
```tsx
const [cardName, setCardName] = useState("");
const [selectedLineId, setSelectedLineId] = useState("");
```

**Step 2: Update Add Card form — add Card Name and Credit Line fields**

In the Add Card `CrudSheet`, after the Last 4 Digits field, add:

```tsx
<div className="space-y-2">
  <Label>Card Name</Label>
  <Input
    value={cardName}
    onChange={(e) => setCardName(e.target.value)}
    placeholder="e.g. Amore Cashback"
  />
</div>
<div className="space-y-2">
  <Label>Credit Line</Label>
  <Select value={selectedLineId} onValueChange={setSelectedLineId}>
    <SelectTrigger>
      <SelectValue placeholder="None (standalone)" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="__none__">None (standalone)</SelectItem>
      {creditLines.map((l) => (
        <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>
```

**Step 3: Show Credit Limit field only for standalone cards**

Wrap the Credit Limit field with:
```tsx
{(!selectedLineId || selectedLineId === "__none__") && (
  <div className="space-y-2">
    <Label>Credit Limit</Label>
    <CurrencyInput value={creditLimit} onChange={setCreditLimit} placeholder="0.00" />
  </div>
)}
```

**Step 4: Update handleAdd to send new fields**

In `handleAdd`, update the `api.post("/credit-cards", ...)` call:

```tsx
await api.post("/credit-cards", {
  account_id: resolvedAccountId,
  bank_name: bankName,
  last_four: lastFour,
  card_name: cardName || null,
  credit_limit: (!selectedLineId || selectedLineId === "__none__") && creditLimit
    ? Number(creditLimit)
    : null,
  credit_line_id: (selectedLineId && selectedLineId !== "__none__")
    ? selectedLineId
    : null,
  statement_day: Number(statementDay),
  due_day: Number(dueDay),
});
```

**Step 5: Reset new state fields after successful add**

In the reset block after `setOpen(false)`:
```tsx
setCardName("");
setSelectedLineId("");
```

**Step 6: Verify in browser**

Open Add Card. The form should show Card Name and Credit Line picker. When a credit line is selected, Credit Limit field hides. On save, card appears under the correct group.

**Step 7: Commit**

```bash
git add 'frontend/src/app/(dashboard)/cards/page.tsx'
git commit -m "feat: add card form supports card name and credit line assignment"
```

---

## Task 12: Final verification

**Step 1: Run full API test suite**

```bash
docker compose run --rm api pytest -v
```

Expected: all tests pass (160+ including new credit line tests).

**Step 2: Run frontend tests**

```bash
cd frontend && bun vitest run
```

Expected: 47/47 pass.

**Step 3: Manual smoke test in browser**

1. Go to `/cards`
2. Create a credit line "BPI Credit Line" with limit ₱50,000
3. Add card "Amore Cashback" linked to the BPI Credit Line
4. Add card "Rewards Blue" linked to the BPI Credit Line
5. Add card "RCBC Gold" standalone with limit ₱30,000
6. Verify: BPI group shows both cards, available credit shows on the line header
7. Edit the RCBC Gold card → confirm changes saved
8. Delete the RCBC Gold card → confirm it disappears
9. Edit the BPI Credit Line → confirm name/limit changes
10. Delete the BPI Credit Line → confirm cards become standalone

**Step 4: Final commit if any fixes needed**

```bash
git add -p
git commit -m "fix: credit line smoke test fixes"
```
