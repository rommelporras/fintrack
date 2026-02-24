# Institution Normalization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Introduce a first-class `institutions` table (banks, digital wallets, government agencies, in-house lenders), link accounts and credit lines to it, remove `bank_name` from credit cards entirely, and lay the `loans` table schema for a future sprint.

**Architecture:** New `institutions` table anchors all financial entities. Accounts and credit lines gain an `institution_id` FK. Credit cards lose `bank_name` (institution is always derived via credit_line → institution or account → institution). The `AccountType` enum is renamed to reflect account nature (`bank`→`savings`, `digital_wallet`→`wallet`) with `checking` and `loan` added. A `loans` table is migrated but has no routes or frontend yet.

**Tech Stack:** Python 3.14, FastAPI, SQLAlchemy async, Alembic, Pydantic v2, PostgreSQL, Next.js 16, shadcn/ui, Tailwind v4, Vitest.

**Design doc:** `docs/plans/2026-02-24-institution-normalization-design.md`

---

## Conventions to follow

- Migrations live in `api/migrations/versions/`. Every migration file starts with:
  ```python
  """<description>

  Revision ID: <id>
  Revises: <down_revision>
  Create Date: 2026-02-24
  """

  # revision identifiers, used by Alembic.
  revision: str = "<id>"
  down_revision: str | None = "<prev_id>"
  branch_labels: str | tuple[str, ...] | None = None
  depends_on: str | tuple[str, ...] | None = None
  ```
- Use `op.f()` for all constraint names.
- Run tests: `docker compose run --rm api pytest api/tests/<file>.py -v`
- Run all tests: `docker compose run --rm api pytest`
- Apply migration: `DATABASE_URL="postgresql+asyncpg://finance:changeme@127.0.0.1:5435/finance_db" docker compose run --rm api alembic upgrade head`

---

## Task 1: `institutions` table migration

**Files:**
- Create: `api/migrations/versions/e1f2a3b4c5d6_create_institutions.py`

**Step 1: Create the migration file**

```python
"""Create institutions table

Revision ID: e1f2a3b4c5d6
Revises: d2e3f4a5b6c7
Create Date: 2026-02-24
"""

# revision identifiers, used by Alembic.
revision: str = "e1f2a3b4c5d6"
down_revision: str | None = "d2e3f4a5b6c7"
branch_labels: str | tuple[str, ...] | None = None
depends_on: str | tuple[str, ...] | None = None

import sqlalchemy as sa
from alembic import op


def upgrade() -> None:
    op.create_table(
        "institutions",
        sa.Column("id", sa.UUID(), server_default=sa.text("uuidv7()"), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column(
            "type",
            sa.Enum("traditional", "digital", "government", "in_house", name="institutiontype"),
            nullable=False,
        ),
        sa.Column("color", sa.String(7), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"],
            name=op.f("fk_institutions_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_institutions")),
    )
    op.create_index(op.f("ix_institutions_user_id"), "institutions", ["user_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_institutions_user_id"), table_name="institutions")
    op.drop_table("institutions")
    op.execute("DROP TYPE IF EXISTS institutiontype")
```

**Step 2: Apply the migration**

```bash
DATABASE_URL="postgresql+asyncpg://finance:changeme@127.0.0.1:5435/finance_db" \
  docker compose run --rm api alembic upgrade head
```

Expected: `Running upgrade d2e3f4a5b6c7 -> e1f2a3b4c5d6, Create institutions table`

**Step 3: Commit**

```bash
git add api/migrations/versions/e1f2a3b4c5d6_create_institutions.py
git commit -m "feat: add institutions table migration"
```

---

## Task 2: Institution model, schemas, router, tests

**Files:**
- Create: `api/app/models/institution.py`
- Modify: `api/app/models/__init__.py`
- Create: `api/app/schemas/institution.py`
- Create: `api/app/routers/institutions.py`
- Modify: `api/app/main.py`
- Create: `api/tests/test_institutions.py`

**Step 1: Write failing tests first**

Create `api/tests/test_institutions.py`:

```python
import pytest_asyncio
from httpx import AsyncClient


async def test_list_institutions_empty(auth_client):
    r = await auth_client.get("/institutions")
    assert r.status_code == 200
    assert r.json() == []


async def test_create_institution(auth_client):
    r = await auth_client.post("/institutions", json={
        "name": "BPI",
        "type": "traditional",
        "color": "#e63c2f",
    })
    assert r.status_code == 201
    data = r.json()
    assert data["name"] == "BPI"
    assert data["type"] == "traditional"
    assert data["color"] == "#e63c2f"
    assert "id" in data


async def test_create_institution_minimal(auth_client):
    r = await auth_client.post("/institutions", json={
        "name": "GCash",
        "type": "digital",
    })
    assert r.status_code == 201
    data = r.json()
    assert data["color"] is None


async def test_update_institution(auth_client):
    r = await auth_client.post("/institutions", json={"name": "Maya", "type": "digital"})
    inst_id = r.json()["id"]

    r = await auth_client.patch(f"/institutions/{inst_id}", json={"color": "#0abf53"})
    assert r.status_code == 200
    assert r.json()["color"] == "#0abf53"


async def test_delete_institution(auth_client):
    r = await auth_client.post("/institutions", json={"name": "Temp", "type": "digital"})
    inst_id = r.json()["id"]

    r = await auth_client.delete(f"/institutions/{inst_id}")
    assert r.status_code == 204

    r = await auth_client.get("/institutions")
    assert r.json() == []


async def test_delete_institution_blocked_when_referenced(auth_client):
    r = await auth_client.post("/institutions", json={"name": "BDO", "type": "traditional"})
    inst_id = r.json()["id"]

    # Link an account to this institution
    await auth_client.post("/accounts", json={
        "name": "BDO Savings",
        "type": "savings",
        "institution_id": inst_id,
    })

    r = await auth_client.delete(f"/institutions/{inst_id}")
    assert r.status_code == 409


async def test_institutions_require_auth(client):
    r = await client.get("/institutions")
    assert r.status_code == 401
```

**Step 2: Run tests to confirm they fail**

```bash
docker compose run --rm api pytest api/tests/test_institutions.py -v
```

Expected: ImportError or 404 — module/route does not exist yet.

**Step 3: Create `api/app/models/institution.py`**

```python
import enum
import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, Enum, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class InstitutionType(str, enum.Enum):
    traditional = "traditional"
    digital = "digital"
    government = "government"
    in_house = "in_house"


class Institution(Base):
    __tablename__ = "institutions"

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
    type: Mapped[InstitutionType] = mapped_column(
        Enum(InstitutionType, name="institutiontype"), nullable=False
    )
    color: Mapped[str | None] = mapped_column(String(7), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    accounts: Mapped[list["Account"]] = relationship(  # type: ignore[name-defined]
        "Account", back_populates="institution", lazy="select"
    )
    credit_lines: Mapped[list["CreditLine"]] = relationship(  # type: ignore[name-defined]
        "CreditLine", back_populates="institution", lazy="select"
    )
```

**Step 4: Register in `api/app/models/__init__.py`**

Add after the last import:
```python
from app.models.institution import Institution  # noqa: F401
```

**Step 5: Create `api/app/schemas/institution.py`**

```python
import uuid
from pydantic import BaseModel
from app.models.institution import InstitutionType


class InstitutionCreate(BaseModel):
    name: str
    type: InstitutionType
    color: str | None = None


class InstitutionUpdate(BaseModel):
    name: str | None = None
    type: InstitutionType | None = None
    color: str | None = None


class InstitutionBrief(BaseModel):
    """Minimal institution info for embedding in other responses."""
    id: uuid.UUID
    name: str
    type: InstitutionType
    color: str | None

    model_config = {"from_attributes": True}


class InstitutionResponse(InstitutionBrief):
    user_id: uuid.UUID
```

**Step 6: Create `api/app/routers/institutions.py`**

```python
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.core.database import get_db
from app.dependencies import get_current_user
from app.models.institution import Institution
from app.models.account import Account
from app.models.credit_line import CreditLine
from app.models.user import User
from app.schemas.institution import InstitutionCreate, InstitutionUpdate, InstitutionResponse

router = APIRouter(prefix="/institutions", tags=["institutions"])


@router.get("", response_model=list[InstitutionResponse])
async def list_institutions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Institution).where(Institution.user_id == current_user.id)
    )
    return result.scalars().all()


@router.post("", response_model=InstitutionResponse, status_code=201)
async def create_institution(
    data: InstitutionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    institution = Institution(**data.model_dump(), user_id=current_user.id)
    db.add(institution)
    await db.commit()
    await db.refresh(institution)
    return institution


@router.patch("/{institution_id}", response_model=InstitutionResponse)
async def update_institution(
    institution_id: uuid.UUID,
    data: InstitutionUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Institution).where(
            Institution.id == institution_id,
            Institution.user_id == current_user.id,
        )
    )
    institution = result.scalar_one_or_none()
    if not institution:
        raise HTTPException(status_code=404, detail="Institution not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(institution, field, value)
    await db.commit()
    await db.refresh(institution)
    return institution


@router.delete("/{institution_id}", status_code=204)
async def delete_institution(
    institution_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Institution).where(
            Institution.id == institution_id,
            Institution.user_id == current_user.id,
        )
    )
    institution = result.scalar_one_or_none()
    if not institution:
        raise HTTPException(status_code=404, detail="Institution not found")

    # Block delete if any accounts or credit lines reference it
    account_count = await db.scalar(
        select(func.count()).where(Account.institution_id == institution_id)
    )
    line_count = await db.scalar(
        select(func.count()).where(CreditLine.institution_id == institution_id)
    )
    if (account_count or 0) + (line_count or 0) > 0:
        raise HTTPException(
            status_code=409,
            detail="Institution is referenced by accounts or credit lines. Unlink them first.",
        )

    await db.delete(institution)
    await db.commit()
```

**Note:** `Account.institution_id` and `CreditLine.institution_id` do not exist yet — the router file will fail to import until Task 3 and Task 5 add those columns. For now, add a `# type: ignore` comment on those lines OR skip the reference check and add it in Task 3's commit. The simplest approach: skip the reference check for now, add it in Task 3 after `institution_id` is added to Account/CreditLine. Remove the `account_count`/`line_count` check from this file and add it back in Task 3.

Simplified version of the delete route for Task 2 (add the check back in Task 3):

```python
@router.delete("/{institution_id}", status_code=204)
async def delete_institution(
    institution_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Institution).where(
            Institution.id == institution_id,
            Institution.user_id == current_user.id,
        )
    )
    institution = result.scalar_one_or_none()
    if not institution:
        raise HTTPException(status_code=404, detail="Institution not found")
    await db.delete(institution)
    await db.commit()
```

**Step 7: Register router in `api/app/main.py`**

Find where other routers are imported and registered. Add:
```python
from app.routers.institutions import router as institutions_router
# ...
app.include_router(institutions_router)
```

**Step 8: Run tests (skip the blocked-delete test for now — mark with `@pytest.mark.skip`)**

```bash
docker compose run --rm api pytest api/tests/test_institutions.py -v -k "not blocked"
```

Expected: All pass except `test_delete_institution_blocked_when_referenced` which you've skipped.

**Note:** `test_delete_institution_blocked_when_referenced` uses `type: "savings"` for the account — this needs Task 3 to pass. Skip it for now.

**Step 9: Commit**

```bash
git add api/migrations/versions/e1f2a3b4c5d6_create_institutions.py \
        api/app/models/institution.py \
        api/app/models/__init__.py \
        api/app/schemas/institution.py \
        api/app/routers/institutions.py \
        api/app/main.py \
        api/tests/test_institutions.py
git commit -m "feat: institutions CRUD — model, schema, router, tests"
```

---

## Task 3: Accounts migration — add `institution_id`, rename enum values

**Files:**
- Create: `api/migrations/versions/e2f3a4b5c6d7_accounts_add_institution_enum_rename.py`

**Step 1: Understand what needs to happen**

PostgreSQL supports `ALTER TYPE ... RENAME VALUE` (Postgres 10+). The existing enum type is named `accounttype`. We:
1. Rename `bank` → `savings`
2. Rename `digital_wallet` → `wallet`
3. Add `checking`
4. Add `loan`
5. Add nullable `institution_id` FK column to `accounts`

**Step 2: Create the migration file**

```python
"""Accounts: add institution_id FK and rename AccountType enum values

Revision ID: e2f3a4b5c6d7
Revises: e1f2a3b4c5d6
Create Date: 2026-02-24
"""

# revision identifiers, used by Alembic.
revision: str = "e2f3a4b5c6d7"
down_revision: str | None = "e1f2a3b4c5d6"
branch_labels: str | tuple[str, ...] | None = None
depends_on: str | tuple[str, ...] | None = None

import sqlalchemy as sa
from alembic import op


def upgrade() -> None:
    # Rename existing enum values
    op.execute("ALTER TYPE accounttype RENAME VALUE 'bank' TO 'savings'")
    op.execute("ALTER TYPE accounttype RENAME VALUE 'digital_wallet' TO 'wallet'")
    # Add new enum values
    op.execute("ALTER TYPE accounttype ADD VALUE IF NOT EXISTS 'checking'")
    op.execute("ALTER TYPE accounttype ADD VALUE IF NOT EXISTS 'loan'")

    # Add institution_id FK column (nullable, SET NULL on institution delete)
    op.add_column("accounts", sa.Column("institution_id", sa.UUID(), nullable=True))
    op.create_foreign_key(
        op.f("fk_accounts_institution_id_institutions"),
        "accounts",
        "institutions",
        ["institution_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(op.f("ix_accounts_institution_id"), "accounts", ["institution_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_accounts_institution_id"), table_name="accounts")
    op.drop_constraint(
        op.f("fk_accounts_institution_id_institutions"),
        "accounts",
        type_="foreignkey",
    )
    op.drop_column("accounts", "institution_id")
    # Note: PostgreSQL does not support removing enum values without recreating the type.
    # Renaming back is possible:
    op.execute("ALTER TYPE accounttype RENAME VALUE 'savings' TO 'bank'")
    op.execute("ALTER TYPE accounttype RENAME VALUE 'wallet' TO 'digital_wallet'")
```

**Step 3: Apply the migration**

```bash
DATABASE_URL="postgresql+asyncpg://finance:changeme@127.0.0.1:5435/finance_db" \
  docker compose run --rm api alembic upgrade head
```

Expected: `Running upgrade e1f2a3b4c5d6 -> e2f3a4b5c6d7`

**Step 4: Commit**

```bash
git add api/migrations/versions/e2f3a4b5c6d7_accounts_add_institution_enum_rename.py
git commit -m "feat: accounts migration — institution_id FK, rename enum values"
```

---

## Task 4: Update Account model, schemas, router, and tests

**Files:**
- Modify: `api/app/models/account.py`
- Modify: `api/app/schemas/account.py`
- Modify: `api/app/routers/accounts.py`
- Modify: `api/app/routers/institutions.py` (add blocked-delete check)
- Modify: `api/tests/test_accounts.py`
- Modify: `api/tests/test_institutions.py` (unskip blocked-delete test)
- Modify: `api/tests/test_credit_cards.py` (update fixture: `type: "credit_card"` stays valid)
- Modify: `api/tests/test_credit_lines.py` (update fixture)

**Step 1: Update `api/app/models/account.py`**

Replace the `AccountType` enum and add `institution_id`:

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
    savings = "savings"
    checking = "checking"
    wallet = "wallet"
    credit_card = "credit_card"
    loan = "loan"
    cash = "cash"


class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=func.uuidv7()
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    institution_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("institutions.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[AccountType] = mapped_column(nullable=False)
    opening_balance: Mapped[Decimal] = mapped_column(
        Numeric(15, 2),
        default=Decimal("0.00"),
        comment="Balance before first tracked transaction",
    )
    currency: Mapped[str] = mapped_column(String(3), default="PHP")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    institution: Mapped["Institution | None"] = relationship(  # type: ignore[name-defined]
        "Institution", back_populates="accounts", lazy="selectin"
    )
```

**Step 2: Update `api/app/schemas/account.py`**

```python
import uuid
from decimal import Decimal
from pydantic import BaseModel
from app.models.account import AccountType
from app.schemas.institution import InstitutionBrief


class AccountCreate(BaseModel):
    name: str
    type: AccountType
    institution_id: uuid.UUID | None = None
    opening_balance: Decimal = Decimal("0.00")
    currency: str = "PHP"
    is_active: bool = True


class AccountUpdate(BaseModel):
    name: str | None = None
    institution_id: uuid.UUID | None = None
    opening_balance: Decimal | None = None
    is_active: bool | None = None


class AccountResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    institution_id: uuid.UUID | None
    institution: InstitutionBrief | None
    name: str
    type: AccountType
    opening_balance: Decimal
    current_balance: Decimal  # computed, injected by router
    currency: str
    is_active: bool

    model_config = {"from_attributes": True}
```

**Step 3: Update `api/app/routers/accounts.py`**

The `_to_response` helper needs to include the institution. Since `Account.institution` is loaded via `selectin`, it's already available as `account.institution`. Update `_to_response`:

```python
async def _to_response(db: AsyncSession, account: Account) -> AccountResponse:
    balance = await compute_current_balance(db, account.id, account.opening_balance)
    return AccountResponse.model_validate({
        **account.__dict__,
        "current_balance": balance,
        "institution": account.institution,
    })
```

The `list_accounts` route uses `compute_balances_bulk` and builds responses directly. Update it the same way:

```python
@router.get("", response_model=list[AccountResponse])
async def list_accounts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Account).where(Account.user_id == current_user.id, Account.is_active == True)
    )
    accounts = result.scalars().all()
    balances = await compute_balances_bulk(db, accounts)
    return [
        AccountResponse.model_validate({
            **a.__dict__,
            "current_balance": balances[a.id],
            "institution": a.institution,
        })
        for a in accounts
    ]
```

**Step 4: Add blocked-delete check back to `api/app/routers/institutions.py`**

Now that `Account.institution_id` exists, update the delete route to the full version shown in Task 2 Step 6 (the version with `account_count` and `line_count` checks). Replace the simplified `delete_institution` with the full version.

Also add the import for `CreditLine` at the top of `routers/institutions.py` if not already there.

**Step 5: Write failing tests for accounts with institution**

In `api/tests/test_accounts.py`, add at the end:

```python
async def test_create_account_with_institution(auth_client):
    # Create institution first
    r = await auth_client.post("/institutions", json={"name": "BPI", "type": "traditional"})
    inst_id = r.json()["id"]

    r = await auth_client.post("/accounts", json={
        "name": "BPI Savings",
        "type": "savings",
        "institution_id": inst_id,
        "opening_balance": "50000.00",
    })
    assert r.status_code == 201
    data = r.json()
    assert data["institution_id"] == inst_id
    assert data["institution"]["name"] == "BPI"
    assert data["institution"]["type"] == "traditional"


async def test_account_institution_is_null_for_cash(auth_client):
    r = await auth_client.post("/accounts", json={
        "name": "Cash Wallet",
        "type": "cash",
    })
    assert r.status_code == 201
    assert r.json()["institution_id"] is None
    assert r.json()["institution"] is None
```

**Step 6: Update existing account tests that use old enum values**

In `api/tests/test_accounts.py`, find and replace:
- `"type": "bank"` → `"type": "savings"`
- `"type": "digital_wallet"` → `"type": "wallet"`
- Check all other test files for the same pattern

In `api/tests/test_credit_cards.py`, fixture `cc_account_id` uses `"type": "credit_card"` — this value is unchanged, no update needed.

In `api/tests/test_credit_lines.py`, fixture `cc_account_id` uses `"type": "credit_card"` — unchanged.

**Step 7: Unskip `test_delete_institution_blocked_when_referenced`**

In `api/tests/test_institutions.py`, remove the `@pytest.mark.skip` decorator from `test_delete_institution_blocked_when_referenced`.

**Step 8: Run all tests**

```bash
docker compose run --rm api pytest api/tests/test_accounts.py api/tests/test_institutions.py -v
```

Expected: All pass.

**Step 9: Run full test suite**

```bash
docker compose run --rm api pytest
```

Expected: All existing tests pass (credit_cards, credit_lines tests unaffected since `credit_card` enum value is unchanged).

**Step 10: Commit**

```bash
git add api/app/models/account.py \
        api/app/schemas/account.py \
        api/app/routers/accounts.py \
        api/app/routers/institutions.py \
        api/tests/test_accounts.py \
        api/tests/test_institutions.py
git commit -m "feat: link accounts to institutions — model, schema, router, tests"
```

---

## Task 5: Credit lines migration — add `institution_id`

**Files:**
- Create: `api/migrations/versions/e3f4a5b6c7d8_credit_lines_add_institution_id.py`

**Step 1: Create the migration file**

```python
"""Credit lines: add institution_id FK

Revision ID: e3f4a5b6c7d8
Revises: e2f3a4b5c6d7
Create Date: 2026-02-24
"""

# revision identifiers, used by Alembic.
revision: str = "e3f4a5b6c7d8"
down_revision: str | None = "e2f3a4b5c6d7"
branch_labels: str | tuple[str, ...] | None = None
depends_on: str | tuple[str, ...] | None = None

import sqlalchemy as sa
from alembic import op


def upgrade() -> None:
    op.add_column("credit_lines", sa.Column("institution_id", sa.UUID(), nullable=True))
    op.create_foreign_key(
        op.f("fk_credit_lines_institution_id_institutions"),
        "credit_lines",
        "institutions",
        ["institution_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(op.f("ix_credit_lines_institution_id"), "credit_lines", ["institution_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_credit_lines_institution_id"), table_name="credit_lines")
    op.drop_constraint(
        op.f("fk_credit_lines_institution_id_institutions"),
        "credit_lines",
        type_="foreignkey",
    )
    op.drop_column("credit_lines", "institution_id")
```

**Step 2: Apply the migration**

```bash
DATABASE_URL="postgresql+asyncpg://finance:changeme@127.0.0.1:5435/finance_db" \
  docker compose run --rm api alembic upgrade head
```

**Step 3: Commit**

```bash
git add api/migrations/versions/e3f4a5b6c7d8_credit_lines_add_institution_id.py
git commit -m "feat: credit_lines migration — add institution_id FK"
```

---

## Task 6: Update CreditLine model, schemas, router, tests

**Files:**
- Modify: `api/app/models/credit_line.py`
- Modify: `api/app/schemas/credit_line.py`
- Modify: `api/app/routers/credit_lines.py`
- Modify: `api/tests/test_credit_lines.py`

**Step 1: Update `api/app/models/credit_line.py`**

Add `institution_id` column and `institution` relationship:

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
    institution_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("institutions.id", ondelete="SET NULL"),
        nullable=True,
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

    institution: Mapped["Institution | None"] = relationship(  # type: ignore[name-defined]
        "Institution", back_populates="credit_lines", lazy="selectin"
    )
    cards: Mapped[list["CreditCard"]] = relationship(  # type: ignore[name-defined]
        "CreditCard", back_populates="credit_line", lazy="selectin"
    )
```

**Step 2: Update `api/app/schemas/credit_line.py`**

Add `institution_id` and `institution` to create/update/response. Remove `bank_name` from `CreditCardInLine`:

```python
import uuid
from decimal import Decimal
from pydantic import BaseModel
from app.schemas.institution import InstitutionBrief


class CreditLineCreate(BaseModel):
    name: str
    institution_id: uuid.UUID | None = None
    total_limit: Decimal | None = None
    available_override: Decimal | None = None


class CreditLineUpdate(BaseModel):
    name: str | None = None
    institution_id: uuid.UUID | None = None
    total_limit: Decimal | None = None
    available_override: Decimal | None = None


class CreditCardInLine(BaseModel):
    """Minimal card info nested inside CreditLineResponse."""
    id: uuid.UUID
    card_name: str | None        # bank_name removed — card identified by card_name + last_four
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
    institution_id: uuid.UUID | None
    institution: InstitutionBrief | None
    name: str
    total_limit: Decimal | None
    available_override: Decimal | None
    available_credit: Decimal | None  # computed
    cards: list[CreditCardInLine]

    model_config = {"from_attributes": True}
```

**Step 3: Update `api/app/routers/credit_lines.py`**

Update `_card_to_summary` to not use `bank_name`, and update `_enrich` to include `institution`:

```python
def _card_to_summary(card: CreditCard) -> CreditCardInLine:
    closed = get_closed_statement_period(card.statement_day)
    open_ = get_open_billing_period(card.statement_day)
    due = get_due_date(card.statement_day, card.due_day)
    return CreditCardInLine.model_validate({
        **card.__dict__,
        "closed_period": {k: str(v) for k, v in closed.items()},
        "open_period": {k: str(v) for k, v in open_.items()},
        "due_date": str(due) if due else None,
        "days_until_due": days_until_due(due),
    })


async def _enrich(db: AsyncSession, line: CreditLine) -> CreditLineResponse:
    available = await compute_line_available_credit(db, line)
    return CreditLineResponse.model_validate({
        **line.__dict__,
        "institution": line.institution,
        "available_credit": available,
        "cards": [_card_to_summary(c) for c in line.cards],
    })
```

**Step 4: Update tests in `api/tests/test_credit_lines.py`**

The fixture creates a credit line with `bank_name` on the card — update to not use `bank_name` (we remove that in Task 8, but for now the `bank_name` field on the card POST is still present). No changes needed to the credit line fixture itself. However, add a new test for institution linkage:

```python
async def test_create_credit_line_with_institution(auth_client):
    r = await auth_client.post("/institutions", json={"name": "BPI", "type": "traditional"})
    inst_id = r.json()["id"]

    r = await auth_client.post("/credit-lines", json={
        "name": "BPI Credit Line",
        "total_limit": "378000.00",
        "institution_id": inst_id,
    })
    assert r.status_code == 201
    data = r.json()
    assert data["institution_id"] == inst_id
    assert data["institution"]["name"] == "BPI"
```

**Step 5: Run tests**

```bash
docker compose run --rm api pytest api/tests/test_credit_lines.py -v
```

Expected: All pass.

**Step 6: Run full suite**

```bash
docker compose run --rm api pytest
```

**Step 7: Commit**

```bash
git add api/app/models/credit_line.py \
        api/app/schemas/credit_line.py \
        api/app/routers/credit_lines.py \
        api/tests/test_credit_lines.py
git commit -m "feat: link credit lines to institutions — model, schema, router, tests"
```

---

## Task 7: Credit cards migration — data migration + drop `bank_name`

**Files:**
- Create: `api/migrations/versions/e4f5a6b7c8d9_credit_cards_migrate_bank_name.py`

**Step 1: Create the migration file**

This migration:
1. For in-line cards (`credit_line_id IS NOT NULL`) where `card_name IS NULL`: copy `bank_name` → `card_name`
2. Drop `bank_name` column

```python
"""Credit cards: copy bank_name to card_name for in-line cards, drop bank_name

Revision ID: e4f5a6b7c8d9
Revises: e3f4a5b6c7d8
Create Date: 2026-02-24
"""

# revision identifiers, used by Alembic.
revision: str = "e4f5a6b7c8d9"
down_revision: str | None = "e3f4a5b6c7d8"
branch_labels: str | tuple[str, ...] | None = None
depends_on: str | tuple[str, ...] | None = None

import sqlalchemy as sa
from alembic import op


def upgrade() -> None:
    # For in-line cards (credit_line_id IS NOT NULL) with no card_name:
    # copy bank_name → card_name so existing product names are preserved.
    op.execute("""
        UPDATE credit_cards
        SET card_name = bank_name
        WHERE credit_line_id IS NOT NULL
          AND (card_name IS NULL OR card_name = '')
    """)

    # Drop bank_name column entirely
    op.drop_column("credit_cards", "bank_name")


def downgrade() -> None:
    # Restore bank_name column (nullable — we can't recover the original values)
    op.add_column(
        "credit_cards",
        sa.Column("bank_name", sa.String(255), nullable=True),
    )
    # Fill with card_name as a best-effort restore
    op.execute("UPDATE credit_cards SET bank_name = COALESCE(card_name, 'Unknown')")
    # Make it non-nullable
    op.alter_column("credit_cards", "bank_name", nullable=False)
```

**Step 2: Apply the migration**

```bash
DATABASE_URL="postgresql+asyncpg://finance:changeme@127.0.0.1:5435/finance_db" \
  docker compose run --rm api alembic upgrade head
```

**Step 3: Commit**

```bash
git add api/migrations/versions/e4f5a6b7c8d9_credit_cards_migrate_bank_name.py
git commit -m "feat: credit_cards migration — copy bank_name to card_name, drop bank_name"
```

---

## Task 8: Update CreditCard model, schemas, router, tests

**Files:**
- Modify: `api/app/models/credit_card.py`
- Modify: `api/app/schemas/credit_card.py`
- Modify: `api/app/routers/credit_cards.py`
- Modify: `api/tests/test_credit_cards.py`

**Step 1: Update `api/app/models/credit_card.py`**

Remove `bank_name`:

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
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
    )
    account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="CASCADE"), index=True
    )
    last_four: Mapped[str] = mapped_column(String(4), nullable=False)
    credit_limit: Mapped[Decimal | None] = mapped_column(Numeric(15, 2), nullable=True)
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

    statement_day: Mapped[int] = mapped_column(Integer, nullable=False)
    due_day: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
```

**Step 2: Update `api/app/schemas/credit_card.py`**

Remove `bank_name` from all schemas. Add `institution: InstitutionBrief | None` to response:

```python
import uuid
from datetime import date
from decimal import Decimal
from pydantic import BaseModel, field_validator
from app.schemas.institution import InstitutionBrief


class CreditCardCreate(BaseModel):
    account_id: uuid.UUID
    last_four: str
    credit_limit: Decimal | None = None
    statement_day: int
    due_day: int
    credit_line_id: uuid.UUID | None = None
    card_name: str | None = None
    available_override: Decimal | None = None

    @field_validator("statement_day", "due_day")
    @classmethod
    def validate_day(cls, v: int) -> int:
        if not 1 <= v <= 28:
            raise ValueError("Day must be between 1 and 28")
        return v

    @field_validator("last_four")
    @classmethod
    def validate_last_four(cls, v: str) -> str:
        if not v.isdigit() or len(v) != 4:
            raise ValueError("last_four must be exactly 4 digits")
        return v


class CreditCardUpdate(BaseModel):
    credit_limit: Decimal | None = None
    statement_day: int | None = None
    due_day: int | None = None
    credit_line_id: uuid.UUID | None = None
    card_name: str | None = None
    available_override: Decimal | None = None

    @field_validator("statement_day", "due_day")
    @classmethod
    def validate_day(cls, v: int | None) -> int | None:
        if v is not None and not 1 <= v <= 28:
            raise ValueError("Day must be between 1 and 28")
        return v


class CreditCardResponse(BaseModel):
    id: uuid.UUID
    account_id: uuid.UUID
    institution: InstitutionBrief | None  # derived from credit_line.institution or account.institution
    last_four: str
    credit_limit: Decimal | None
    statement_day: int
    due_day: int
    closed_period: dict | None = None
    open_period: dict | None = None
    due_date: date | None = None
    days_until_due: int | None = None
    credit_line_id: uuid.UUID | None = None
    card_name: str | None = None
    available_override: Decimal | None = None
    available_credit: Decimal | None = None

    model_config = {"from_attributes": True}
```

**Step 3: Update `api/app/routers/credit_cards.py`**

Update `_enrich` to derive and inject `institution`. To load the account's institution, we need to fetch the account. Add an account → institution lookup:

```python
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.dependencies import get_current_user
from app.models.credit_card import CreditCard
from app.models.account import Account
from app.models.user import User
from app.schemas.credit_card import CreditCardCreate, CreditCardUpdate, CreditCardResponse
from app.services.credit_card import (
    get_closed_statement_period,
    get_open_billing_period,
    get_due_date,
    days_until_due,
)
from app.services.credit_line import compute_card_available_credit

router = APIRouter(prefix="/credit-cards", tags=["credit-cards"])


async def _get_institution(card: CreditCard, db: AsyncSession):
    """Derive institution from credit_line (if in-line) or from account (if standalone)."""
    if card.credit_line_id is not None:
        # credit_line is loaded via relationship; credit_line.institution via selectin
        if card.credit_line and card.credit_line.institution:
            return card.credit_line.institution
        return None
    # Standalone: load account and its institution
    result = await db.execute(select(Account).where(Account.id == card.account_id))
    account = result.scalar_one_or_none()
    if account and account.institution:
        return account.institution
    return None


async def _enrich(card: CreditCard, db: AsyncSession) -> CreditCardResponse:
    closed = get_closed_statement_period(card.statement_day)
    open_ = get_open_billing_period(card.statement_day)
    due = get_due_date(card.statement_day, card.due_day)
    available = None
    if card.credit_line_id is None:
        available = await compute_card_available_credit(db, card)
    institution = await _get_institution(card, db)
    return CreditCardResponse.model_validate({
        **card.__dict__,
        "institution": institution,
        "closed_period": {k: str(v) for k, v in closed.items()},
        "open_period": {k: str(v) for k, v in open_.items()},
        "due_date": due,
        "days_until_due": days_until_due(due),
        "available_credit": available,
    })
```

The list/create/update/delete route functions remain identical — only `_enrich` changed.

**Step 4: Update `api/tests/test_credit_cards.py`**

Remove `bank_name` from all test request bodies. Update assertions that check `bank_name`:

- In `cc_account_id` fixture: stays as `"type": "credit_card"` (unchanged)
- In `test_create_credit_card`: remove `"bank_name": "BPI"` from POST body, remove `assert data["bank_name"] == "BPI"`
- In `test_create_credit_card_with_card_name`: remove `"bank_name": "RCBC"`
- In `test_create_credit_card_invalid_last_four`: remove `"bank_name": "BPI"`
- In `test_create_credit_card_invalid_statement_day`: remove `"bank_name": "BPI"`
- In `test_update_credit_card`: remove `bank_name` from any PATCH bodies
- Search the entire file for `bank_name` and remove every occurrence

Also update `api/tests/test_credit_lines.py`:
- In `test_delete_credit_line_detaches_cards` fixture: remove `"bank_name": "BPI"` from the POST `/credit-cards` body
- Search for all `bank_name` occurrences and remove them

**Step 5: Run credit card and credit line tests**

```bash
docker compose run --rm api pytest api/tests/test_credit_cards.py api/tests/test_credit_lines.py -v
```

Expected: All pass.

**Step 6: Run full test suite**

```bash
docker compose run --rm api pytest
```

Expected: All pass.

**Step 7: Commit**

```bash
git add api/app/models/credit_card.py \
        api/app/schemas/credit_card.py \
        api/app/routers/credit_cards.py \
        api/tests/test_credit_cards.py \
        api/tests/test_credit_lines.py
git commit -m "feat: remove bank_name from credit cards, add institution to response"
```

---

## Task 9: Loans table migration + model (schema only)

**Files:**
- Create: `api/migrations/versions/e5f6a7b8c9e0_create_loans.py`
- Create: `api/app/models/loan.py`
- Modify: `api/app/models/__init__.py`

**Step 1: Create the migration**

```python
"""Create loans table (schema only — no routes or UI yet)

Revision ID: e5f6a7b8c9e0
Revises: e4f5a6b7c8d9
Create Date: 2026-02-24
"""

# revision identifiers, used by Alembic.
revision: str = "e5f6a7b8c9e0"
down_revision: str | None = "e4f5a6b7c8d9"
branch_labels: str | tuple[str, ...] | None = None
depends_on: str | tuple[str, ...] | None = None

import sqlalchemy as sa
from alembic import op


def upgrade() -> None:
    op.create_table(
        "loans",
        sa.Column("id", sa.UUID(), server_default=sa.text("uuidv7()"), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("institution_id", sa.UUID(), nullable=True),
        sa.Column("account_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column(
            "type",
            sa.Enum("auto", "housing", "personal", "education", "other", name="loantype"),
            nullable=False,
        ),
        sa.Column("original_principal", sa.Numeric(15, 2), nullable=False),
        sa.Column("interest_rate", sa.Numeric(7, 4), nullable=True),
        sa.Column("term_months", sa.Integer(), nullable=True),
        sa.Column("monthly_amortization", sa.Numeric(15, 2), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column(
            "status",
            sa.Enum("active", "paid_off", "transferred", name="loanstatus"),
            nullable=False,
            server_default="active",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"],
            name=op.f("fk_loans_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["institution_id"], ["institutions.id"],
            name=op.f("fk_loans_institution_id_institutions"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["account_id"], ["accounts.id"],
            name=op.f("fk_loans_account_id_accounts"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_loans")),
    )
    op.create_index(op.f("ix_loans_user_id"), "loans", ["user_id"])
    op.create_index(op.f("ix_loans_institution_id"), "loans", ["institution_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_loans_institution_id"), table_name="loans")
    op.drop_index(op.f("ix_loans_user_id"), table_name="loans")
    op.drop_table("loans")
    op.execute("DROP TYPE IF EXISTS loantype")
    op.execute("DROP TYPE IF EXISTS loanstatus")
```

**Step 2: Apply the migration**

```bash
DATABASE_URL="postgresql+asyncpg://finance:changeme@127.0.0.1:5435/finance_db" \
  docker compose run --rm api alembic upgrade head
```

**Step 3: Create `api/app/models/loan.py`**

```python
import enum
import uuid
from datetime import date, datetime
from decimal import Decimal
from sqlalchemy import String, Date, DateTime, Integer, Numeric, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class LoanType(str, enum.Enum):
    auto = "auto"
    housing = "housing"
    personal = "personal"
    education = "education"
    other = "other"


class LoanStatus(str, enum.Enum):
    active = "active"
    paid_off = "paid_off"
    transferred = "transferred"


class Loan(Base):
    __tablename__ = "loans"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=func.uuidv7()
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    institution_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("institutions.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("accounts.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[LoanType] = mapped_column(nullable=False)
    original_principal: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    interest_rate: Mapped[Decimal | None] = mapped_column(Numeric(7, 4), nullable=True)
    term_months: Mapped[int | None] = mapped_column(Integer, nullable=True)
    monthly_amortization: Mapped[Decimal | None] = mapped_column(Numeric(15, 2), nullable=True)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[LoanStatus] = mapped_column(nullable=False, default=LoanStatus.active)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    institution: Mapped["Institution | None"] = relationship(  # type: ignore[name-defined]
        "Institution", lazy="selectin"
    )
```

**Step 4: Register in `api/app/models/__init__.py`**

```python
from app.models.loan import Loan  # noqa: F401
```

**Step 5: Apply migration and run tests**

```bash
docker compose run --rm api pytest
```

Expected: All pass (no new tests; loans has no routes yet).

**Step 6: Commit**

```bash
git add api/migrations/versions/e5f6a7b8c9e0_create_loans.py \
        api/app/models/loan.py \
        api/app/models/__init__.py
git commit -m "feat: loans table migration and model (schema only, no routes)"
```

---

## Task 10: Frontend — `/institutions` page

**Files:**
- Create: `frontend/src/app/(dashboard)/institutions/page.tsx`
- Modify: `frontend/src/app/(dashboard)/layout.tsx` (add nav link)

**Step 1: Read the layout file to find where nav items are defined**

Read `frontend/src/app/(dashboard)/layout.tsx` fully before modifying it.

**Step 2: Create `frontend/src/app/(dashboard)/institutions/page.tsx`**

```tsx
"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Building2, Pencil, Trash2, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CrudSheet } from "@/components/app/CrudSheet";

interface Institution {
  id: string;
  name: string;
  type: "traditional" | "digital" | "government" | "in_house";
  color: string | null;
}

const TYPE_LABELS: Record<Institution["type"], string> = {
  traditional: "Traditional Bank",
  digital: "Digital / E-Wallet",
  government: "Government Agency",
  in_house: "In-House / Developer",
};

const TYPE_ORDER: Institution["type"][] = ["traditional", "digital", "government", "in_house"];

export default function InstitutionsPage() {
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Add form
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<Institution["type"]>("traditional");
  const [color, setColor] = useState("");

  // Edit form
  const [editInst, setEditInst] = useState<Institution | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState<Institution["type"]>("traditional");
  const [editColor, setEditColor] = useState("");

  // Delete
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function load() {
    try {
      const data = await api.get<Institution[]>("/institutions");
      setInstitutions(data);
    } catch {
      setLoadError("Failed to load institutions. Please refresh.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleAdd() {
    setSubmitting(true);
    setError(null);
    try {
      await api.post("/institutions", {
        name,
        type,
        color: color || null,
      });
      setOpen(false);
      setName("");
      setType("traditional");
      setColor("");
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create institution");
    } finally {
      setSubmitting(false);
    }
  }

  function openEdit(inst: Institution) {
    setEditInst(inst);
    setEditName(inst.name);
    setEditType(inst.type);
    setEditColor(inst.color ?? "");
    setEditError(null);
    setEditOpen(true);
  }

  async function handleEdit() {
    if (!editInst) return;
    setEditSubmitting(true);
    setEditError(null);
    try {
      await api.patch(`/institutions/${editInst.id}`, {
        name: editName || undefined,
        type: editType,
        color: editColor || null,
      });
      setEditOpen(false);
      await load();
    } catch (e: unknown) {
      setEditError(e instanceof Error ? e.message : "Failed to update institution");
    } finally {
      setEditSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleteSubmitting(true);
    setDeleteError(null);
    try {
      await api.delete(`/institutions/${deleteId}`);
      setDeleteConfirmOpen(false);
      setDeleteId(null);
      await load();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to delete institution";
      setDeleteError(msg.includes("referenced") ? "This institution is linked to accounts or credit lines. Remove those links first." : msg);
    } finally {
      setDeleteSubmitting(false);
    }
  }

  // Group by type
  const grouped = TYPE_ORDER.reduce<Record<string, Institution[]>>((acc, t) => {
    acc[t] = institutions.filter((i) => i.type === t);
    return acc;
  }, {} as Record<string, Institution[]>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Institutions
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Banks, wallets, and lenders you deal with
          </p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />Add Institution
        </Button>
      </div>

      {/* Add Sheet */}
      <CrudSheet
        open={open}
        onOpenChange={setOpen}
        title="New Institution"
        description="Add a bank, wallet, government agency, or in-house lender"
        onSave={handleAdd}
        saveLabel={submitting ? "Creating…" : "Create"}
        saveDisabled={submitting}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="BPI" />
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as Institution["type"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TYPE_ORDER.map((t) => (
                  <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Color <span className="text-muted-foreground text-xs">(optional hex, e.g. #e63c2f)</span></Label>
            <Input value={color} onChange={(e) => setColor(e.target.value)} placeholder="#e63c2f" maxLength={7} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      </CrudSheet>

      {/* Edit Sheet */}
      <CrudSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        title="Edit Institution"
        description="Update institution details"
        onSave={handleEdit}
        saveLabel={editSubmitting ? "Saving…" : "Save Changes"}
        saveDisabled={editSubmitting}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={editType} onValueChange={(v) => setEditType(v as Institution["type"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TYPE_ORDER.map((t) => (
                  <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Color <span className="text-muted-foreground text-xs">(optional hex)</span></Label>
            <Input value={editColor} onChange={(e) => setEditColor(e.target.value)} placeholder="#e63c2f" maxLength={7} />
          </div>
          {editError && <p className="text-sm text-destructive">{editError}</p>}
        </div>
      </CrudSheet>

      {/* Delete confirmation */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div
            className="bg-card rounded-xl border p-6 max-w-sm mx-4 space-y-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-inst-title"
            aria-describedby="delete-inst-desc"
          >
            <h2 id="delete-inst-title" className="text-lg font-semibold">Delete institution?</h2>
            <p id="delete-inst-desc" className="text-sm text-muted-foreground">
              This cannot be undone. Unlink all accounts and credit lines before deleting.
            </p>
            {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => { setDeleteConfirmOpen(false); setDeleteError(null); }} disabled={deleteSubmitting}>Cancel</Button>
              <Button variant="destructive" onClick={handleDelete} disabled={deleteSubmitting}>
                {deleteSubmitting ? "Deleting…" : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {loadError && <p className="text-sm text-destructive">{loadError}</p>}
      {loading ? (
        <div className="space-y-3">{[1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : institutions.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-border p-12 text-center space-y-3">
          <Building2 className="h-12 w-12 mx-auto text-muted-foreground" />
          <p className="text-lg font-medium">No institutions yet</p>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Add your banks and wallets to organize your accounts
          </p>
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />Add Institution
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {TYPE_ORDER.filter((t) => grouped[t].length > 0).map((t) => (
            <div key={t} className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
                {TYPE_LABELS[t]}
              </p>
              <div className="rounded-xl border bg-card divide-y divide-border overflow-hidden">
                {grouped[t].map((inst) => (
                  <div key={inst.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {inst.color && (
                        <div
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ background: inst.color }}
                        />
                      )}
                      <span className="font-medium text-sm">{inst.name}</span>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground">
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(inst)}>
                          <Pencil className="h-4 w-4 mr-2" />Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => { setDeleteId(inst.id); setDeleteConfirmOpen(true); }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 3: Add Institutions to the nav in `layout.tsx`**

Read `frontend/src/app/(dashboard)/layout.tsx` fully, then find the nav items array. Add an entry for Institutions. Look for where "Accounts" is defined and add "Institutions" after it:

```tsx
{ href: "/institutions", label: "Institutions", icon: Building2 },
```

Also add the `Building2` import from `lucide-react` if not already imported.

**Step 4: Check for TypeScript errors**

```bash
cd frontend && bun run tsc --noEmit
```

Or use the Next.js MCP: call `get_errors` on the running dev server.

**Step 5: Commit**

```bash
git add frontend/src/app/(dashboard)/institutions/page.tsx \
        frontend/src/app/(dashboard)/layout.tsx
git commit -m "feat: institutions page — list, add, edit, delete"
```

---

## Task 11: Frontend — update `/accounts` page

**Files:**
- Modify: `frontend/src/app/(dashboard)/accounts/page.tsx`

**Step 1: Read the accounts page fully before editing**

Read `frontend/src/app/(dashboard)/accounts/page.tsx` completely.

**Step 2: Update the `Account` interface**

Add `institution_id` and `institution`:

```tsx
interface Institution {
  id: string;
  name: string;
  type: string;
  color: string | null;
}

interface Account {
  id: string;
  institution_id: string | null;
  institution: Institution | null;
  name: string;
  type: string;
  opening_balance: string;
  current_balance: string;
  currency: string;
  is_active: boolean;
}
```

**Step 3: Update account type options**

Replace the old type enum in the add/edit form selectors:

```tsx
const ACCOUNT_TYPES = [
  { value: "savings", label: "Savings" },
  { value: "checking", label: "Checking" },
  { value: "wallet", label: "Wallet" },
  { value: "credit_card", label: "Credit Card" },
  { value: "cash", label: "Cash" },
] as const;
```

**Step 4: Load institutions in the page**

Add institutions to the `loadData` call (parallel with accounts):

```tsx
const [accounts, institutions] = await Promise.all([
  api.get<Account[]>("/accounts"),
  api.get<Institution[]>("/institutions"),
]);
```

Add `const [institutions, setInstitutions] = useState<Institution[]>([]);` to state.

**Step 5: Add institution picker to the Add Account form**

After the type selector, add:

```tsx
{type !== "cash" && (
  <div className="space-y-2">
    <Label>Institution</Label>
    <Select value={institutionId} onValueChange={setInstitutionId}>
      <SelectTrigger><SelectValue placeholder="Select institution" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">None</SelectItem>
        {institutions.map((i) => (
          <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
)}
```

Add state: `const [institutionId, setInstitutionId] = useState("");`

In `handleAdd`, include `institution_id` in the POST body:
```tsx
institution_id: (institutionId && institutionId !== "__none__") ? institutionId : null,
```

**Step 6: Show institution badge on account cards**

In the card display, add an institution badge below the balance/name:

```tsx
{account.institution && (
  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
    {account.institution.color && (
      <span
        className="inline-block w-2 h-2 rounded-full"
        style={{ background: account.institution.color }}
      />
    )}
    {account.institution.name}
  </span>
)}
```

**Step 7: Check for TypeScript errors and test in browser**

```bash
cd frontend && bun run tsc --noEmit
```

**Step 8: Commit**

```bash
git add frontend/src/app/(dashboard)/accounts/page.tsx
git commit -m "feat: accounts page — institution picker and badge"
```

---

## Task 12: Frontend — update `/cards` page

**Files:**
- Modify: `frontend/src/app/(dashboard)/cards/page.tsx`

**Step 1: Read the cards page fully before editing**

Read `frontend/src/app/(dashboard)/cards/page.tsx` completely. This file is already known from the current session.

**Step 2: Load institutions alongside cards/accounts/credit-lines**

```tsx
const [c, a, cl, inst] = await Promise.all([
  api.get<CreditCard[]>("/credit-cards"),
  api.get<Account[]>("/accounts"),
  api.get<CreditLine[]>("/credit-lines"),
  api.get<Institution[]>("/institutions"),
]);
setInstitutions(inst);
```

Add `Institution` interface and `institutions` state.

**Step 3: Update `CreditLine` interface**

Add `institution_id: string | null` and `institution: Institution | null`.

**Step 4: Update `CreditCard` interface**

Remove `bank_name`. Add `institution: Institution | null`.

**Step 5: Update `CreditCardInLine` interface**

Remove `bank_name`. Cards are now identified by `card_name + last_four`.

**Step 6: Update card display in credit lines section**

Replace `{c.bank_name} ···{c.last_four}` with:

```tsx
<p className="font-semibold text-foreground text-sm">
  {c.card_name ?? `···${c.last_four}`}
</p>
<p className="text-xs text-muted-foreground">···{c.last_four}</p>
```

**Step 7: Update credit line header**

Add institution badge to the credit line header:

```tsx
<div>
  <p className="text-sm font-semibold text-foreground">{line.name}</p>
  {line.institution && (
    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
      {line.institution.color && (
        <span className="inline-block w-2 h-2 rounded-full" style={{ background: line.institution.color }} />
      )}
      {line.institution.name}
    </p>
  )}
  ...
```

**Step 8: Update Add Credit Line form**

Add institution picker after the Name field:

```tsx
<div className="space-y-2">
  <Label>Institution</Label>
  <Select value={lineInstitutionId} onValueChange={setLineInstitutionId}>
    <SelectTrigger><SelectValue placeholder="Select institution" /></SelectTrigger>
    <SelectContent>
      <SelectItem value="__none__">None</SelectItem>
      {institutions.map((i) => (
        <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>
```

Add to `handleAddLine`:
```tsx
institution_id: (lineInstitutionId && lineInstitutionId !== "__none__") ? lineInstitutionId : null,
```

**Step 9: Update Edit Credit Line form** — same institution picker pattern.

**Step 10: Update Add Card form** — remove the bank name input entirely. Cards get their institution from the credit line or account.

**Step 11: Update Edit Card form** — remove bank name field entirely (it was `editBankName`). Remove all related state.

**Step 12: Update standalone card display**

Replace `{c.bank_name} ···{c.last_four}` with:

```tsx
<p className="font-semibold text-foreground text-sm">
  {c.card_name ?? `···${c.last_four}`}
</p>
{c.institution && (
  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
    {c.institution.color && (
      <span className="inline-block w-2 h-2 rounded-full" style={{ background: c.institution.color }} />
    )}
    {c.institution.name} ···{c.last_four}
  </p>
)}
```

**Step 13: Check TypeScript errors**

```bash
cd frontend && bun run tsc --noEmit
```

Or check via Next.js MCP `get_errors`.

**Step 14: Commit**

```bash
git add frontend/src/app/(dashboard)/cards/page.tsx
git commit -m "feat: cards page — remove bank_name, add institution picker and badges"
```

---

## Task 13: Frontend — update `/statements` page and navigation

**Files:**
- Modify: `frontend/src/app/(dashboard)/statements/page.tsx`

**Step 1: Read the statements page fully**

Read `frontend/src/app/(dashboard)/statements/page.tsx`.

**Step 2: Update the `CreditCard` interface in statements page**

Remove `bank_name` if it was added, use `card_name` and institution for display. The current statements page `CreditCard` interface already has `card_name` from the previous session's fix. Update the interface to add `institution`:

```tsx
interface CreditCard {
  id: string;
  card_name: string | null;
  last_four: string;
  institution: { name: string; color: string | null } | null;
}
```

**Step 3: Update card selector label in Add Statement form**

Change `{c.bank_name} ••••{c.last_four}` to:

```tsx
{c.institution?.name ? `${c.institution.name} ` : ""}
{c.card_name ? `${c.card_name} ` : ""}
••••{c.last_four}
```

**Step 4: Update statement group header**

Already updated in previous session to show `card_name`. Ensure `institution.name` also shown:

```tsx
<h2 className="font-semibold text-foreground">
  {card ? `${card.institution?.name ? card.institution.name + " — " : ""}${card.card_name ?? ""}` : cardId}
</h2>
<p className="text-xs text-muted-foreground mt-0.5">••••{card?.last_four}</p>
```

**Step 5: Check TypeScript errors and run full tsc**

```bash
cd frontend && bun run tsc --noEmit
```

**Step 6: Commit**

```bash
git add frontend/src/app/(dashboard)/statements/page.tsx
git commit -m "feat: statements page — remove bank_name, use institution and card_name"
```

---

## Final verification

**Run full backend test suite:**

```bash
docker compose run --rm api pytest
```

Expected: All tests pass (≥171 tests).

**Check Next.js for build errors:**

Use the Next.js MCP `get_errors` tool on the running dev server.

**Manual smoke test (browser):**

1. Go to `/institutions` → add BPI (traditional, #e63c2f) and GCash (digital, #0abf53)
2. Go to `/accounts` → add "BPI Savings" with institution = BPI, type = savings
3. Go to `/cards` → add a credit line with institution = BPI
4. Add a card under that line — confirm no bank name field
5. Edit an existing standalone card — confirm no bank name field
6. Delete BPI institution → confirm 409 error (accounts reference it)

---
