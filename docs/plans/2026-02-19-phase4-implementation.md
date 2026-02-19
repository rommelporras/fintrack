# Phase 4: Analytics Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a net worth card to the dashboard and a new `/analytics` page with a spending-by-category pie chart and a per-card statement history bar chart using Recharts.

**Architecture:** Three new API endpoints (one added to the existing dashboard router, two in a new analytics router) using pure SQL aggregations — no new models or migrations. Frontend installs `recharts` via bun, adds the shadcn chart component, updates the dashboard page, and adds a new `/analytics` page with two charts.

**Tech Stack:** FastAPI, SQLAlchemy async, `compute_current_balance` service (existing), Recharts, shadcn/ui chart component, bun, TypeScript strict mode.

---

### Task 1: `GET /dashboard/net-worth` (TDD)

**Files:**
- Modify: `api/app/routers/dashboard.py`
- Create: `api/tests/test_dashboard.py`

**Context:**
- `Account` model is at `api/app/models/account.py`. Fields: `id`, `user_id`, `name`, `type` (AccountType enum), `opening_balance` (Numeric), `is_active` (bool). **There is no `balance` column** — current balance is computed from transactions.
- `AccountType` enum: `bank`, `credit_card`, `digital_wallet`, `cash`. Credit card accounts are excluded from net worth.
- `compute_current_balance(db, account_id, opening_balance) -> Decimal` is at `api/app/services/account.py`. Returns the accurate current balance.
- Account creation via `POST /accounts` uses the field name `opening_balance`, not `balance`.
- `currency` defaults to `"PHP"` in the model but pass it explicitly in tests.
- Auth: each test creates its own user via `POST /auth/register` then uses an `auth_client` fixture.
- `test_dashboard.py` does not exist yet — create it fresh.

**Step 1: Write the failing tests**

Create `api/tests/test_dashboard.py`:

```python
import pytest
from httpx import AsyncClient


@pytest.fixture
async def auth_client(client: AsyncClient):
    await client.post("/auth/register", json={
        "email": "dashboard@test.com", "name": "Dashboard User", "password": "password123"
    })
    return client


async def test_net_worth_no_accounts(auth_client: AsyncClient):
    r = await auth_client.get("/dashboard/net-worth")
    assert r.status_code == 200
    data = r.json()
    assert data["total"] == "0.00"
    assert data["by_type"] == []


async def test_net_worth_excludes_inactive(auth_client: AsyncClient):
    await auth_client.post("/accounts", json={
        "name": "Inactive Bank", "type": "bank",
        "opening_balance": "50000.00", "currency": "PHP", "is_active": False,
    })
    r = await auth_client.get("/dashboard/net-worth")
    assert r.json()["total"] == "0.00"


async def test_net_worth_excludes_credit_card_type(auth_client: AsyncClient):
    await auth_client.post("/accounts", json={
        "name": "CC Account", "type": "credit_card",
        "opening_balance": "15000.00", "currency": "PHP",
    })
    r = await auth_client.get("/dashboard/net-worth")
    assert r.json()["total"] == "0.00"


async def test_net_worth_groups_by_type(auth_client: AsyncClient):
    await auth_client.post("/accounts", json={
        "name": "BDO", "type": "bank",
        "opening_balance": "100000.00", "currency": "PHP",
    })
    await auth_client.post("/accounts", json={
        "name": "GCash", "type": "digital_wallet",
        "opening_balance": "5000.00", "currency": "PHP",
    })
    await auth_client.post("/accounts", json={
        "name": "Cash", "type": "cash",
        "opening_balance": "2000.00", "currency": "PHP",
    })
    r = await auth_client.get("/dashboard/net-worth")
    data = r.json()
    assert data["total"] == "107000.00"
    types = {item["type"]: item["total"] for item in data["by_type"]}
    assert types["bank"] == "100000.00"
    assert types["digital_wallet"] == "5000.00"
    assert types["cash"] == "2000.00"
```

**Step 2: Run tests to verify they fail**

```bash
cd /home/wsl/personal/fintrack/api
DATABASE_URL="postgresql+asyncpg://finance:changeme@127.0.0.1:5435/finance_db" \
TEST_DATABASE_URL="postgresql+asyncpg://finance:changeme@127.0.0.1:5435/finance_test" \
  uv run pytest tests/test_dashboard.py -v
```

Expected: 4 failures — `404 Not Found` on `/dashboard/net-worth`.

**Step 3: Implement `GET /dashboard/net-worth`**

Add to `api/app/routers/dashboard.py` after the existing imports:

```python
from decimal import Decimal
from app.models.account import Account, AccountType
from app.services.account import compute_current_balance
```

Add after the existing `/summary` route:

```python
@router.get("/net-worth")
async def net_worth(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Account).where(
            Account.user_id == current_user.id,
            Account.is_active == True,
            Account.type != AccountType.credit_card,
        )
    )
    accounts = result.scalars().all()

    by_type: dict[str, Decimal] = {}
    for account in accounts:
        balance = await compute_current_balance(db, account.id, account.opening_balance)
        acc_type = account.type.value
        by_type[acc_type] = by_type.get(acc_type, Decimal("0")) + balance

    grand_total = sum(by_type.values(), Decimal("0"))
    return {
        "total": str(grand_total.quantize(Decimal("0.01"))),
        "by_type": [
            {"type": t, "total": str(v.quantize(Decimal("0.01")))}
            for t, v in sorted(by_type.items())
        ],
    }
```

**Step 4: Run tests to verify they pass**

```bash
DATABASE_URL="postgresql+asyncpg://finance:changeme@127.0.0.1:5435/finance_db" \
TEST_DATABASE_URL="postgresql+asyncpg://finance:changeme@127.0.0.1:5435/finance_test" \
  uv run pytest tests/test_dashboard.py -v
```

Expected: 4 PASSED.

**Step 5: Commit**

```bash
git add api/app/routers/dashboard.py api/tests/test_dashboard.py
git commit -m "feat: add net-worth endpoint to dashboard router"
```

---

### Task 2: Analytics router + spending-by-category (TDD)

**Files:**
- Create: `api/app/routers/analytics.py`
- Create: `api/tests/test_analytics.py`
- Modify: `api/app/main.py`

**Context:**
- `Transaction` model fields relevant here: `user_id`, `account_id`, `category_id` (nullable FK), `type` (TransactionType enum: `income`, `expense`, `transfer`), `amount` (Numeric), `date` (Date).
- `Category` model: `id`, `name`, `color` (nullable string), `type` (`income`/`expense`/`transfer`), `icon`.
- Transaction creation body: `account_id`, `category_id` (optional), `amount`, `type`, `date`, `description`. The `sub_type` field is NOT required.
- Transfers do not need a `category_id`.
- Router is registered in `api/app/main.py` — see existing pattern: import as `analytics as analytics_router`, then `app.include_router(analytics_router.router)`.
- The endpoint query params `year` and `month` are integers.

**Step 1: Write the failing tests**

Create `api/tests/test_analytics.py`:

```python
import pytest
from httpx import AsyncClient


@pytest.fixture
async def auth_client(client: AsyncClient):
    await client.post("/auth/register", json={
        "email": "analytics@test.com", "name": "Analytics User", "password": "password123"
    })
    return client


@pytest.fixture
async def account_id(auth_client: AsyncClient) -> str:
    r = await auth_client.post("/accounts", json={
        "name": "BDO Checking", "type": "bank", "currency": "PHP"
    })
    assert r.status_code == 201
    return r.json()["id"]


async def test_spending_by_category_empty(auth_client: AsyncClient):
    r = await auth_client.get("/analytics/spending-by-category?year=2020&month=1")
    assert r.status_code == 200
    assert r.json() == []


async def test_spending_by_category_excludes_income_and_transfers(
    auth_client: AsyncClient, account_id: str
):
    cat = (await auth_client.post("/categories", json={
        "name": "TestCat", "type": "income", "icon": "tag", "color": "#FF0000",
    })).json()

    # Income — excluded
    await auth_client.post("/transactions", json={
        "account_id": account_id, "category_id": cat["id"],
        "amount": "5000.00", "type": "income", "date": "2026-02-01",
        "description": "Salary",
    })
    # Transfer — excluded (no category needed)
    await auth_client.post("/transactions", json={
        "account_id": account_id,
        "amount": "1000.00", "type": "transfer", "date": "2026-02-01",
        "description": "GCash top up",
    })

    r = await auth_client.get("/analytics/spending-by-category?year=2026&month=2")
    assert r.json() == []


async def test_spending_by_category_sums_correctly(
    auth_client: AsyncClient, account_id: str
):
    cat_a = (await auth_client.post("/categories", json={
        "name": "Groceries", "type": "expense", "icon": "🛒", "color": "#00FF00",
    })).json()
    cat_b = (await auth_client.post("/categories", json={
        "name": "Dining", "type": "expense", "icon": "🍜", "color": "#0000FF",
    })).json()

    for amount in ["3000.00", "1500.00"]:
        await auth_client.post("/transactions", json={
            "account_id": account_id, "category_id": cat_a["id"],
            "amount": amount, "type": "expense", "date": "2026-02-05",
            "description": "grocery run",
        })
    await auth_client.post("/transactions", json={
        "account_id": account_id, "category_id": cat_b["id"],
        "amount": "800.00", "type": "expense", "date": "2026-02-12",
        "description": "jollibee",
    })

    r = await auth_client.get("/analytics/spending-by-category?year=2026&month=2")
    data = r.json()
    totals = {item["category_name"]: item["total"] for item in data}
    assert totals["Groceries"] == "4500.00"
    assert totals["Dining"] == "800.00"
    assert len(data) == 2


async def test_spending_by_category_cross_user_isolation(
    auth_client: AsyncClient, account_id: str
):
    # Second user registers and creates an expense
    other = await auth_client.post("/auth/register", json={
        "email": "other_analytics@test.com", "name": "Other", "password": "password123"
    })
    # login as other user (sets cookie)
    await auth_client.post("/auth/login", json={
        "email": "other_analytics@test.com", "password": "password123"
    })
    other_acc = (await auth_client.post("/accounts", json={
        "name": "Other Bank", "type": "bank", "currency": "PHP"
    })).json()
    other_cat = (await auth_client.post("/categories", json={
        "name": "OtherCat", "type": "expense", "icon": "x", "color": "#123456",
    })).json()
    await auth_client.post("/transactions", json={
        "account_id": other_acc["id"], "category_id": other_cat["id"],
        "amount": "9999.00", "type": "expense", "date": "2026-02-01",
        "description": "other user spend",
    })

    # Switch back to main user
    await auth_client.post("/auth/login", json={
        "email": "analytics@test.com", "password": "password123"
    })
    r = await auth_client.get("/analytics/spending-by-category?year=2026&month=2")
    names = {item["category_name"] for item in r.json()}
    assert "OtherCat" not in names
```

**Step 2: Run tests to verify they fail**

```bash
cd /home/wsl/personal/fintrack/api
DATABASE_URL="postgresql+asyncpg://finance:changeme@127.0.0.1:5435/finance_db" \
TEST_DATABASE_URL="postgresql+asyncpg://finance:changeme@127.0.0.1:5435/finance_test" \
  uv run pytest tests/test_analytics.py -v
```

Expected: 4 failures — `404 Not Found`.

**Step 3: Create `api/app/routers/analytics.py`**

```python
from decimal import Decimal
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from app.core.database import get_db
from app.dependencies import get_current_user
from app.models.transaction import Transaction, TransactionType
from app.models.category import Category
from app.models.user import User

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/spending-by-category")
async def spending_by_category(
    year: int = Query(...),
    month: int = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(
            Category.id,
            Category.name,
            Category.color,
            func.coalesce(func.sum(Transaction.amount), 0).label("total"),
        )
        .join(Transaction, Transaction.category_id == Category.id)
        .where(
            Transaction.user_id == current_user.id,
            Transaction.type == TransactionType.expense,
            func.extract("year", Transaction.date) == year,
            func.extract("month", Transaction.date) == month,
        )
        .group_by(Category.id, Category.name, Category.color)
        .order_by(desc("total"))
    )
    rows = result.all()
    return [
        {
            "category_id": str(row.id),
            "category_name": row.name,
            "color": row.color,
            "total": str(Decimal(str(row.total)).quantize(Decimal("0.01"))),
        }
        for row in rows
    ]
```

Register in `api/app/main.py` — add after the last `from app.routers import ...` line:

```python
from app.routers import analytics as analytics_router
```

Add after the last `app.include_router(...)` call:

```python
app.include_router(analytics_router.router)
```

**Step 4: Run tests to verify they pass**

```bash
DATABASE_URL="postgresql+asyncpg://finance:changeme@127.0.0.1:5435/finance_db" \
TEST_DATABASE_URL="postgresql+asyncpg://finance:changeme@127.0.0.1:5435/finance_test" \
  uv run pytest tests/test_analytics.py -v
```

Expected: 4 PASSED.

**Step 5: Commit**

```bash
git add api/app/routers/analytics.py api/tests/test_analytics.py api/app/main.py
git commit -m "feat: add analytics router with spending-by-category endpoint"
```

---

### Task 3: `GET /analytics/statement-history` (TDD)

**Files:**
- Modify: `api/app/routers/analytics.py`
- Modify: `api/tests/test_analytics.py`

**Context:**
- `CreditCard` model: `id`, `user_id`, `account_id`, `bank_name` (str), `last_four` (str 4 chars), `statement_day` (int), `due_day` (int).
- `Statement` model: `id`, `credit_card_id`, `period_start`, `period_end` (Date), `total_amount` (Numeric, nullable), `minimum_due`, `due_date`, `is_paid`.
- `POST /credit-cards` body: `account_id`, `bank_name`, `last_four`, `statement_day`, `due_day`. (`credit_limit` is optional.)
- `POST /statements` body: `credit_card_id`, `period_start`, `period_end`, `due_date`, `total_amount`, `minimum_due`.
- The account used for the credit card can be any type (use `"bank"` as in existing tests).
- Return last 6 statements per card, ordered chronologically (oldest first).

**Step 1: Write the failing tests**

Append to `api/tests/test_analytics.py`:

```python
async def test_statement_history_no_cards(auth_client: AsyncClient):
    r = await auth_client.get("/analytics/statement-history")
    assert r.status_code == 200
    assert r.json() == []


async def test_statement_history_single_card(auth_client: AsyncClient):
    acc = (await auth_client.post("/accounts", json={
        "name": "BDO CC", "type": "bank", "currency": "PHP"
    })).json()
    card = (await auth_client.post("/credit-cards", json={
        "account_id": acc["id"], "bank_name": "BDO",
        "last_four": "1234", "statement_day": 1, "due_day": 25,
    })).json()

    await auth_client.post("/statements", json={
        "credit_card_id": card["id"],
        "period_start": "2026-01-01", "period_end": "2026-01-31",
        "due_date": "2026-02-25", "total_amount": "15000.00", "minimum_due": "500.00",
    })
    await auth_client.post("/statements", json={
        "credit_card_id": card["id"],
        "period_start": "2026-02-01", "period_end": "2026-02-28",
        "due_date": "2026-03-25", "total_amount": "22000.00", "minimum_due": "500.00",
    })

    r = await auth_client.get("/analytics/statement-history")
    data = r.json()
    assert len(data) == 1
    assert data[0]["card_label"] == "BDO •••• 1234"
    stmts = data[0]["statements"]
    assert len(stmts) == 2
    # Chronological (oldest first)
    assert stmts[0]["period"] == "Jan 2026"
    assert stmts[0]["total"] == "15000.00"
    assert stmts[1]["period"] == "Feb 2026"
    assert stmts[1]["total"] == "22000.00"


async def test_statement_history_limits_to_6(auth_client: AsyncClient):
    acc = (await auth_client.post("/accounts", json={
        "name": "BPI CC", "type": "bank", "currency": "PHP"
    })).json()
    card = (await auth_client.post("/credit-cards", json={
        "account_id": acc["id"], "bank_name": "BPI",
        "last_four": "5678", "statement_day": 5, "due_day": 28,
    })).json()

    for i in range(8):
        month = i + 1
        await auth_client.post("/statements", json={
            "credit_card_id": card["id"],
            "period_start": f"2025-{month:02d}-01",
            "period_end": f"2025-{month:02d}-28",
            "due_date": f"2025-{month:02d}-28",
            "total_amount": str(1000 * (i + 1)),
            "minimum_due": "300.00",
        })

    r = await auth_client.get("/analytics/statement-history")
    card_data = next(d for d in r.json() if "5678" in d["card_label"])
    # Only the 6 most recent statements returned
    assert len(card_data["statements"]) == 6
    # Chronological — first is month 3 (earliest of the 6 most recent)
    assert card_data["statements"][0]["total"] == "3000.00"
    assert card_data["statements"][-1]["total"] == "8000.00"
```

**Step 2: Run tests to verify they fail**

```bash
DATABASE_URL="postgresql+asyncpg://finance:changeme@127.0.0.1:5435/finance_db" \
TEST_DATABASE_URL="postgresql+asyncpg://finance:changeme@127.0.0.1:5435/finance_test" \
  uv run pytest tests/test_analytics.py::test_statement_history_no_cards \
    tests/test_analytics.py::test_statement_history_single_card \
    tests/test_analytics.py::test_statement_history_limits_to_6 -v
```

Expected: 3 failures — `404 Not Found`.

**Step 3: Implement `GET /analytics/statement-history`**

Add these imports at the top of `api/app/routers/analytics.py`:

```python
from app.models.credit_card import CreditCard
from app.models.statement import Statement
```

Add the new route (after the spending-by-category route):

```python
@router.get("/statement-history")
async def statement_history(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    cards_result = await db.execute(
        select(CreditCard).where(CreditCard.user_id == current_user.id)
    )
    cards = cards_result.scalars().all()

    data = []
    for card in cards:
        stmts_result = await db.execute(
            select(Statement)
            .where(Statement.credit_card_id == card.id)
            .order_by(Statement.period_end.desc())
            .limit(6)
        )
        stmts = list(reversed(stmts_result.scalars().all()))
        data.append({
            "card_label": f"{card.bank_name} \u2022\u2022\u2022\u2022 {card.last_four}",
            "statements": [
                {
                    "period": s.period_end.strftime("%b %Y"),
                    "total": str(
                        Decimal(str(s.total_amount or 0)).quantize(Decimal("0.01"))
                    ),
                }
                for s in stmts
            ],
        })
    return data
```

**Step 4: Run all tests to verify nothing broken**

```bash
DATABASE_URL="postgresql+asyncpg://finance:changeme@127.0.0.1:5435/finance_db" \
TEST_DATABASE_URL="postgresql+asyncpg://finance:changeme@127.0.0.1:5435/finance_test" \
  uv run pytest -v
```

Expected: all tests PASSED (102 existing + 4 dashboard + 7 analytics = 113 total).

**Step 5: Commit**

```bash
git add api/app/routers/analytics.py api/tests/test_analytics.py
git commit -m "feat: add statement-history endpoint to analytics router"
```

---

### Task 4: Install recharts and shadcn chart component

**Files:**
- Modify: `frontend/package.json` (recharts added by bun)
- Modify: `frontend/bun.lock`
- Create: `frontend/src/components/ui/chart.tsx` (added by shadcn CLI)

**Context:**
- Always use `bun`, never `npm` or `pnpm`.
- The shadcn CLI is already installed as a dev dependency (`shadcn@^3.8.5`). Run it with `bunx shadcn`.
- The chart component wraps Recharts with CSS variable theming consistent with the rest of the shadcn components. It provides `ChartContainer`, `ChartTooltip`, `ChartTooltipContent`, and `ChartLegend`.
- Run these commands from the `frontend/` directory.

**Step 1: Install recharts**

```bash
cd /home/wsl/personal/fintrack/frontend
bun add recharts
```

Expected: `recharts` added to `package.json` dependencies.

**Step 2: Add shadcn chart component**

```bash
bunx shadcn add chart
```

If prompted to confirm, press Enter. This creates `src/components/ui/chart.tsx`.

**Step 3: Verify**

```bash
ls src/components/ui/chart.tsx
```

Expected: file exists.

**Step 4: Verify TypeScript still compiles**

```bash
bunx tsc --noEmit
```

Expected: no errors.

**Step 5: Commit**

```bash
git add src/components/ui/chart.tsx package.json bun.lock
git commit -m "chore: install recharts and add shadcn chart component"
```

---

### Task 5: Frontend — Dashboard net worth card

**Files:**
- Modify: `frontend/src/app/(dashboard)/page.tsx`

**Context:**
- Read the current `page.tsx` before modifying — the full source is needed to understand the existing `load()` function and JSX structure.
- The `api` object imported from `@/lib/api` has a `get<T>(path)` method returning a Promise.
- The existing `load()` function calls `Promise.all([summary, transactions])`. Change it to fetch all 3 in parallel.
- `formatPeso` helper already exists in the file — reuse it.
- Add a `Skeleton` in the loading state for the net worth card.
- TypeScript strict mode: no `any`. Define interfaces for all response shapes.

**Step 1: Read the current file**

Read `frontend/src/app/(dashboard)/page.tsx` fully before making any changes.

**Step 2: Add interfaces after the existing `Transaction` interface**

```typescript
interface NetWorthTypeItem {
  type: string;
  total: string;
}

interface NetWorthData {
  total: string;
  by_type: NetWorthTypeItem[];
}
```

**Step 3: Add state and update the fetch**

Add state alongside the existing state declarations:

```typescript
const [netWorth, setNetWorth] = useState<NetWorthData | null>(null);
```

Update `Promise.all` in `load()` to fetch all 3 endpoints:

```typescript
const [s, t, nw] = await Promise.all([
  api.get<Summary>("/dashboard/summary"),
  api.get<Transaction[]>("/transactions?limit=10"),
  api.get<NetWorthData>("/dashboard/net-worth"),
]);
setSummary(s);
setTransactions(t);
setNetWorth(nw);
```

**Step 4: Add skeleton in loading state**

In the loading return, add a skeleton after the 3-card grid skeleton:

```tsx
<Skeleton className="h-24 w-full rounded-xl" />
```

**Step 5: Add the net worth card in the main return**

Add after the existing 3-card grid `<div>` and before the recent transactions section:

```tsx
{/* Net Worth */}
<Card>
  <CardHeader className="pb-2">
    <CardTitle className="text-sm font-medium text-muted-foreground">
      Net Worth
    </CardTitle>
  </CardHeader>
  <CardContent>
    <p className="text-2xl font-bold">
      {netWorth ? formatPeso(netWorth.total) : "—"}
    </p>
    {netWorth && netWorth.by_type.length > 0 && (
      <div className="mt-2 space-y-1">
        {netWorth.by_type.map((item) => (
          <div
            key={item.type}
            className="flex justify-between text-sm text-muted-foreground"
          >
            <span className="capitalize">{item.type.replace("_", " ")}</span>
            <span>{formatPeso(item.total)}</span>
          </div>
        ))}
      </div>
    )}
  </CardContent>
</Card>
```

**Step 6: Verify TypeScript compiles**

```bash
cd /home/wsl/personal/fintrack/frontend
bunx tsc --noEmit
```

Expected: no errors.

**Step 7: Commit**

```bash
git add src/app/\(dashboard\)/page.tsx
git commit -m "feat: add net worth card to dashboard"
```

---

### Task 6: Frontend — Analytics page + sidebar item

**Files:**
- Create: `frontend/src/app/(dashboard)/analytics/page.tsx`
- Modify: `frontend/src/components/app/Sidebar.tsx`

**Context:**
- Read `Sidebar.tsx` before modifying. Find the nav items array and the existing icon imports to understand the pattern.
- The analytics page uses Recharts directly (not the shadcn `ChartContainer` wrapper) for simplicity. Import from `"recharts"` directly.
- Month selector controls Chart 1 (spending by category) only. Chart 2 (statement history) always shows all-time data and fetches once on mount.
- TypeScript strict mode: no `any`. All component props and state must be typed.
- `FALLBACK_COLORS`: some categories may have `color: null` (user-created categories without a color). Use a fallback palette indexed by position.
- Bar chart data structure: one object per statement period, with one key per card label. Recharts `<Bar dataKey={card.card_label}>` maps these automatically.
- `ResponsiveContainer` requires a parent with a defined height — wrap it in a `div` with `h-[300px]`.

**Step 1: Read Sidebar.tsx**

Read `frontend/src/components/app/Sidebar.tsx` to understand the nav item pattern.

**Step 2: Add Analytics to sidebar**

Add `BarChart2` to the lucide-react import line. Add an Analytics nav item after Budgets in the nav items array:

```typescript
import { ..., BarChart2 } from "lucide-react";

// In the nav items array, after the Budgets entry:
{ href: "/analytics", icon: BarChart2, label: "Analytics" },
```

**Step 3: Create the analytics page**

Create `frontend/src/app/(dashboard)/analytics/page.tsx`:

```typescript
"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface CategorySpending {
  category_id: string;
  category_name: string;
  color: string | null;
  total: string;
}

interface StatementPeriod {
  period: string;
  total: string;
}

interface CardHistory {
  card_label: string;
  statements: StatementPeriod[];
}

function formatPeso(amount: number) {
  return `₱${amount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
}

const FALLBACK_COLORS = [
  "#6366f1", "#f59e0b", "#10b981", "#ef4444",
  "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6",
];

const CARD_COLORS = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#3b82f6"];

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function AnalyticsPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [spending, setSpending] = useState<CategorySpending[]>([]);
  const [cardHistory, setCardHistory] = useState<CardHistory[]>([]);
  const [loadingSpending, setLoadingSpending] = useState(true);
  const [loadingCards, setLoadingCards] = useState(true);

  useEffect(() => {
    setLoadingSpending(true);
    api
      .get<CategorySpending[]>(
        `/analytics/spending-by-category?year=${year}&month=${month}`
      )
      .then(setSpending)
      .finally(() => setLoadingSpending(false));
  }, [year, month]);

  useEffect(() => {
    api
      .get<CardHistory[]>("/analytics/statement-history")
      .then(setCardHistory)
      .finally(() => setLoadingCards(false));
  }, []);

  // Pie chart data
  const pieData = spending.map((item, index) => ({
    name: item.category_name,
    value: Number(item.total),
    fill: item.color ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length],
  }));

  // Bar chart: one row per period, one key per card
  const allPeriods = Array.from(
    new Set(cardHistory.flatMap((c) => c.statements.map((s) => s.period)))
  );
  const barData = allPeriods.map((period) => {
    const entry: Record<string, string | number> = { period };
    for (const card of cardHistory) {
      const stmt = card.statements.find((s) => s.period === period);
      entry[card.card_label] = stmt ? Number(stmt.total) : 0;
    }
    return entry;
  });

  const monthLabel = `${MONTH_NAMES[month - 1]} ${year}`;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Analytics</h1>

      {/* Month/Year selector */}
      <div className="flex items-center gap-3">
        <select
          className="rounded border px-2 py-1 text-sm"
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
        >
          {MONTH_NAMES.map((name, i) => (
            <option key={i + 1} value={i + 1}>
              {name}
            </option>
          ))}
        </select>
        <input
          type="number"
          className="w-24 rounded border px-2 py-1 text-sm"
          value={year}
          min={2020}
          max={2099}
          onChange={(e) => setYear(Number(e.target.value))}
        />
      </div>

      {/* Chart 1 — Spending by Category */}
      <Card>
        <CardHeader>
          <CardTitle>Spending by Category — {monthLabel}</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingSpending ? (
            <Skeleton className="h-64 w-full" />
          ) : pieData.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No expenses recorded for {monthLabel}.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={110}
                      label={({ name, percent }: { name: string; percent: number }) =>
                        `${name} ${(percent * 100).toFixed(0)}%`
                      }
                    >
                      {pieData.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatPeso(value)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {/* Legend */}
              <div className="space-y-1">
                {spending.map((item, index) => (
                  <div key={item.category_id} className="flex justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-3 w-3 rounded-full"
                        style={{
                          backgroundColor:
                            item.color ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length],
                        }}
                      />
                      <span>{item.category_name}</span>
                    </div>
                    <span className="font-medium">
                      {formatPeso(Number(item.total))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Chart 2 — Per-Card Statement History */}
      <Card>
        <CardHeader>
          <CardTitle>Statement History by Card</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingCards ? (
            <Skeleton className="h-64 w-full" />
          ) : cardHistory.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No credit cards or statements found.
            </p>
          ) : (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis
                    tickFormatter={(v: number) => `₱${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip formatter={(value: number) => formatPeso(value)} />
                  <Legend />
                  {cardHistory.map((card, index) => (
                    <Bar
                      key={card.card_label}
                      dataKey={card.card_label}
                      fill={CARD_COLORS[index % CARD_COLORS.length]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 4: Verify TypeScript compiles**

```bash
cd /home/wsl/personal/fintrack/frontend
bunx tsc --noEmit
```

Expected: no errors. If Recharts types cause issues, make sure `recharts` is installed (`bun add recharts` from Task 4).

**Step 5: Commit**

```bash
git add src/app/\(dashboard\)/analytics/page.tsx src/components/app/Sidebar.tsx
git commit -m "feat: add analytics page with spending pie and statement history bar charts"
```

---

## Final Verification

After all 6 tasks complete, run the full backend test suite one more time:

```bash
cd /home/wsl/personal/fintrack/api
DATABASE_URL="postgresql+asyncpg://finance:changeme@127.0.0.1:5435/finance_db" \
TEST_DATABASE_URL="postgresql+asyncpg://finance:changeme@127.0.0.1:5435/finance_test" \
  uv run pytest -v
```

Expected: 113 tests PASSED (102 baseline + 4 dashboard + 7 analytics).

And TypeScript:

```bash
cd /home/wsl/personal/fintrack/frontend
bunx tsc --noEmit
```

Expected: no errors.
