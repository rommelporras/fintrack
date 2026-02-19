# Polish Sprint Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all critical bugs and high-friction UX issues catalogued in `docs/KNOWN_ISSUES.md` before proceeding to Phase 5.

**Architecture:** 12 independent tasks. API tasks use TDD. Frontend tasks use direct implementation with visual verification. Tasks 9 and 10 must complete before Task 7 (scan page depends on the updated components).

**Tech Stack:** FastAPI (Python 3.14, uv), Next.js 16 (bun, TypeScript strict), SQLAlchemy async, pytest-asyncio, shadcn/ui.

**Run tests:** `cd /home/wsl/personal/fintrack/api && DATABASE_URL="postgresql+asyncpg://finance:changeme@127.0.0.1:5435/finance_db" TEST_DATABASE_URL="postgresql+asyncpg://finance:changeme@127.0.0.1:5435/finance_test" uv run pytest -v`

**TypeScript check:** `cd /home/wsl/personal/fintrack/frontend && bun run tsc --noEmit`

---

## Task 1: Add PATCH /auth/me endpoint

**Fixes:** [C1] Settings profile save is a silent 404.

**Files:**
- Modify: `api/app/schemas/auth.py`
- Modify: `api/app/routers/auth.py`
- Modify: `api/tests/test_auth.py`

---

**Step 1: Write the failing tests**

Add to the bottom of `api/tests/test_auth.py`:

```python
async def test_patch_me_updates_name(client):
    await client.post("/auth/register", json={
        "email": "patch@example.com", "name": "Original", "password": "password123"
    })
    r = await client.patch("/auth/me", json={"name": "Updated"})
    assert r.status_code == 200
    assert r.json()["name"] == "Updated"


async def test_patch_me_requires_auth(client):
    r = await client.patch("/auth/me", json={"name": "Updated"})
    assert r.status_code == 401
```

**Step 2: Run tests to verify they fail**

```bash
cd /home/wsl/personal/fintrack/api
DATABASE_URL="postgresql+asyncpg://finance:changeme@127.0.0.1:5435/finance_db" \
TEST_DATABASE_URL="postgresql+asyncpg://finance:changeme@127.0.0.1:5435/finance_test" \
  uv run pytest tests/test_auth.py::test_patch_me_updates_name tests/test_auth.py::test_patch_me_requires_auth -v
```

Expected: 2 failures (404 or route not found).

**Step 3: Add `UpdateProfileRequest` schema to `api/app/schemas/auth.py`**

Append after `UserResponse`:

```python
class UpdateProfileRequest(BaseModel):
    name: str
```

**Step 4: Add `PATCH /auth/me` to `api/app/routers/auth.py`**

Add import at top:
```python
from app.schemas.auth import RegisterRequest, LoginRequest, UserResponse, UpdateProfileRequest
```

Append after the `me` endpoint:

```python
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
```

**Step 5: Run tests to verify they pass**

```bash
DATABASE_URL="postgresql+asyncpg://finance:changeme@127.0.0.1:5435/finance_db" \
TEST_DATABASE_URL="postgresql+asyncpg://finance:changeme@127.0.0.1:5435/finance_test" \
  uv run pytest tests/test_auth.py -v
```

Expected: 7 tests pass (5 existing + 2 new).

**Step 6: Run full test suite to verify nothing is broken**

```bash
DATABASE_URL="postgresql+asyncpg://finance:changeme@127.0.0.1:5435/finance_db" \
TEST_DATABASE_URL="postgresql+asyncpg://finance:changeme@127.0.0.1:5435/finance_test" \
  uv run pytest -v
```

Expected: 115 tests pass.

**Step 7: Commit**

```bash
cd /home/wsl/personal/fintrack
git add api/app/schemas/auth.py api/app/routers/auth.py api/tests/test_auth.py
git commit -m "fix: add PATCH /auth/me to enable profile name updates"
```

---

## Task 2: 401 interceptor — redirect to /login on expired session

**Fixes:** [C2] Expired sessions show empty data with no feedback.

**Files:**
- Modify: `frontend/src/lib/api.ts`

No API changes. No new tests (no frontend test infrastructure).

---

**Step 1: Update the `request` function in `frontend/src/lib/api.ts`**

Replace the `if (!response.ok)` block:

```typescript
  if (!response.ok) {
    if (response.status === 401 && typeof window !== "undefined") {
      window.location.href = "/login";
      // Return a promise that never resolves — the redirect is happening
      return new Promise(() => {}) as Promise<T>;
    }
    const error = await response
      .json()
      .catch(() => ({ detail: "Request failed" }));
    throw new Error(error.detail || response.statusText);
  }
```

**Step 2: TypeScript check**

```bash
cd /home/wsl/personal/fintrack/frontend
bun run tsc --noEmit
```

Expected: 0 errors.

**Step 3: Commit**

```bash
cd /home/wsl/personal/fintrack
git add frontend/src/lib/api.ts
git commit -m "fix: redirect to /login on 401 instead of showing empty data"
```

---

## Task 3: Transaction search — API + frontend

**Fixes:** [H3] No way to find a transaction by description.

**Files:**
- Modify: `api/app/routers/transactions.py`
- Modify: `api/tests/test_transactions.py`
- Modify: `frontend/src/app/(dashboard)/transactions/page.tsx`

---

**Step 1: Write failing API tests**

Add to the bottom of `api/tests/test_transactions.py`:

```python
async def test_search_transactions_by_description(client, user_and_accounts):
    ids = user_and_accounts
    await client.post("/transactions", json={
        "account_id": ids["bank_id"], "amount": "500.00",
        "type": "expense", "date": "2026-02-01",
        "description": "Jollibee lunch",
    })
    await client.post("/transactions", json={
        "account_id": ids["bank_id"], "amount": "200.00",
        "type": "expense", "date": "2026-02-01",
        "description": "Mercury Drug",
    })
    r = await client.get("/transactions?search=jollibee")
    assert r.status_code == 200
    assert len(r.json()) == 1
    assert r.json()[0]["description"] == "Jollibee lunch"


async def test_search_transactions_case_insensitive(client, user_and_accounts):
    ids = user_and_accounts
    await client.post("/transactions", json={
        "account_id": ids["bank_id"], "amount": "500.00",
        "type": "expense", "date": "2026-02-01",
        "description": "Grab Food order",
    })
    r = await client.get("/transactions?search=grab food")
    assert r.status_code == 200
    assert len(r.json()) == 1


async def test_search_transactions_no_match(client, user_and_accounts):
    ids = user_and_accounts
    r = await client.get("/transactions?search=nonexistent")
    assert r.status_code == 200
    assert r.json() == []
```

**Step 2: Run tests to verify they fail**

```bash
cd /home/wsl/personal/fintrack/api
DATABASE_URL="postgresql+asyncpg://finance:changeme@127.0.0.1:5435/finance_db" \
TEST_DATABASE_URL="postgresql+asyncpg://finance:changeme@127.0.0.1:5435/finance_test" \
  uv run pytest tests/test_transactions.py::test_search_transactions_by_description -v
```

Expected: FAIL.

**Step 3: Add `search` param to `api/app/routers/transactions.py`**

In the `list_transactions` function signature, add after `offset`:

```python
    search: str | None = Query(None),
```

After the `if date_to:` block, add:

```python
    if search:
        q = q.where(Transaction.description.ilike(f"%{search}%"))
```

**Step 4: Run API tests to verify they pass**

```bash
DATABASE_URL="postgresql+asyncpg://finance:changeme@127.0.0.1:5435/finance_db" \
TEST_DATABASE_URL="postgresql+asyncpg://finance:changeme@127.0.0.1:5435/finance_test" \
  uv run pytest tests/test_transactions.py -v
```

Expected: all transaction tests pass (existing + 3 new).

**Step 5: Add search input to the transactions page**

In `frontend/src/app/(dashboard)/transactions/page.tsx`, find where `account` and `category` filter states are declared. Add a new state:

```typescript
const [search, setSearch] = useState("");
const [debouncedSearch, setDebouncedSearch] = useState("");
```

Add a debounce effect (after existing useEffects):

```typescript
useEffect(() => {
  const t = setTimeout(() => setDebouncedSearch(search), 400);
  return () => clearTimeout(t);
}, [search]);
```

Include `debouncedSearch` in the data-fetching useEffect dependency array, and add it to the API URL:

```typescript
const params = new URLSearchParams();
if (typeFilter) params.set("type", typeFilter);
if (accountFilter) params.set("account_id", accountFilter);
if (categoryFilter) params.set("category_id", categoryFilter);
if (dateFrom) params.set("date_from", dateFrom);
if (dateTo) params.set("date_to", dateTo);
if (debouncedSearch) params.set("search", debouncedSearch);
params.set("limit", "50");
params.set("offset", String(offset));
```

Add a search input above the type filter buttons (inside the page's top controls area):

```tsx
<Input
  placeholder="Search transactions…"
  value={search}
  onChange={(e) => { setSearch(e.target.value); setOffset(0); }}
  className="max-w-xs"
/>
```

Import `Input` from `@/components/ui/input` if not already imported.

**Step 6: TypeScript check**

```bash
cd /home/wsl/personal/fintrack/frontend
bun run tsc --noEmit
```

Expected: 0 errors.

**Step 7: Commit**

```bash
cd /home/wsl/personal/fintrack
git add api/app/routers/transactions.py api/tests/test_transactions.py \
  frontend/src/app/\(dashboard\)/transactions/page.tsx
git commit -m "feat: add description search to transactions"
```

---

## Task 4: Transaction total count

**Fixes:** [H4] Transaction count shows page count, not total.

**Files:**
- Modify: `api/app/schemas/transaction.py`
- Modify: `api/app/routers/transactions.py`
- Modify: `api/tests/test_transactions.py`
- Modify: `frontend/src/app/(dashboard)/transactions/page.tsx`

---

**Step 1: Write failing test**

Add to `api/tests/test_transactions.py`:

```python
async def test_list_transactions_returns_total(client, user_and_accounts):
    ids = user_and_accounts
    for i in range(3):
        await client.post("/transactions", json={
            "account_id": ids["bank_id"], "amount": "100.00",
            "type": "expense", "date": "2026-02-01",
            "description": f"Expense {i}",
        })
    r = await client.get("/transactions?limit=2&offset=0")
    assert r.status_code == 200
    data = r.json()
    assert "total" in data
    assert "items" in data
    assert data["total"] == 3
    assert len(data["items"]) == 2
```

**Step 2: Run to verify it fails**

```bash
DATABASE_URL="postgresql+asyncpg://finance:changeme@127.0.0.1:5435/finance_db" \
TEST_DATABASE_URL="postgresql+asyncpg://finance:changeme@127.0.0.1:5435/finance_test" \
  uv run pytest tests/test_transactions.py::test_list_transactions_returns_total -v
```

Expected: FAIL (response is a list, not an object with `total`).

**Step 3: Add `TransactionListResponse` to `api/app/schemas/transaction.py`**

Append to the end of the file:

```python
class TransactionListResponse(BaseModel):
    items: list[TransactionResponse]
    total: int
```

**Step 4: Update `list_transactions` in `api/app/routers/transactions.py`**

Add imports at top:
```python
from sqlalchemy import select, func
from app.schemas.transaction import TransactionCreate, TransactionResponse, TransactionListResponse
```

Change the endpoint signature and body:

```python
@router.get("", response_model=TransactionListResponse)
async def list_transactions(
    type: TransactionType | None = Query(None),
    account_id: uuid.UUID | None = Query(None),
    category_id: uuid.UUID | None = Query(None),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    search: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    base = select(Transaction).where(Transaction.user_id == current_user.id)
    if type:
        base = base.where(Transaction.type == type)
    if account_id:
        base = base.where(Transaction.account_id == account_id)
    if category_id:
        base = base.where(Transaction.category_id == category_id)
    if date_from:
        base = base.where(Transaction.date >= date_from)
    if date_to:
        base = base.where(Transaction.date <= date_to)
    if search:
        base = base.where(Transaction.description.ilike(f"%{search}%"))

    count_result = await db.execute(select(func.count()).select_from(base.subquery()))
    total = count_result.scalar_one()

    items_result = await db.execute(
        base.order_by(Transaction.date.desc(), Transaction.created_at.desc())
        .limit(limit).offset(offset)
    )
    return {"items": items_result.scalars().all(), "total": total}
```

Note: the `search` filter from Task 3 is now folded into this updated function. After this task, Task 3's separate search addition is replaced by this combined implementation.

**Step 5: Run API tests**

```bash
DATABASE_URL="postgresql+asyncpg://finance:changeme@127.0.0.1:5435/finance_db" \
TEST_DATABASE_URL="postgresql+asyncpg://finance:changeme@127.0.0.1:5435/finance_test" \
  uv run pytest tests/test_transactions.py -v
```

Expected: all transaction tests pass.

**Step 6: Update frontend to use new response format**

In `frontend/src/app/(dashboard)/transactions/page.tsx`, change the data type and parse:

Find where transactions are fetched. The fetch returns what was previously `TransactionResponse[]`, now it returns `{ items: TransactionResponse[], total: number }`.

1. Add a `total` state: `const [total, setTotal] = useState(0);`
2. Change the fetch to:
```typescript
interface TransactionListResponse {
  items: Transaction[];
  total: number;
}
const data = await api.get<TransactionListResponse>(`/transactions?${params}`);
setTransactions(data.items);
setTotal(data.total);
```
3. In the header area, replace the existing count display with:
```tsx
<span className="text-sm text-muted-foreground">
  Showing {transactions.length} of {total}
</span>
```

Also update the dashboard `page.tsx` which fetches `/transactions?limit=10` — it used to get `TransactionResponse[]` but now gets `{ items, total }`. Update:
```typescript
const data = await api.get<{ items: Transaction[]; total: number }>("/transactions?limit=10");
setRecentTransactions(data.items);
```

**Step 7: TypeScript check**

```bash
cd /home/wsl/personal/fintrack/frontend
bun run tsc --noEmit
```

Expected: 0 errors.

**Step 8: Run full test suite**

```bash
cd /home/wsl/personal/fintrack/api
DATABASE_URL="postgresql+asyncpg://finance:changeme@127.0.0.1:5435/finance_db" \
TEST_DATABASE_URL="postgresql+asyncpg://finance:changeme@127.0.0.1:5435/finance_test" \
  uv run pytest -v
```

Expected: all tests pass (note: existing tests that check `r.json()` as a list need to be updated to `r.json()["items"]` — fix any that fail).

**Step 9: Commit**

```bash
cd /home/wsl/personal/fintrack
git add api/app/schemas/transaction.py api/app/routers/transactions.py \
  api/tests/test_transactions.py \
  frontend/src/app/\(dashboard\)/transactions/page.tsx \
  frontend/src/app/\(dashboard\)/page.tsx
git commit -m "feat: add total_count to transaction list response"
```

---

## Task 5: Empty states with CTAs

**Fixes:** [H2] New users see dashes everywhere with no direction.

**Files:**
- Modify: `frontend/src/app/(dashboard)/page.tsx`
- Modify: `frontend/src/app/(dashboard)/transactions/page.tsx`

Note: Accounts page already has an empty state ("No accounts yet."). Budgets page already has empty states. This task focuses on the dashboard and transactions list.

---

**Step 1: Add a getting-started card to the dashboard**

In `frontend/src/app/(dashboard)/page.tsx`, after the existing state declarations, add:

```typescript
const hasData = summary && (
  Number(summary.total_income) > 0 ||
  Number(summary.total_expenses) > 0 ||
  recentTransactions.length > 0
);
```

After the net worth card section, add a conditional block:

```tsx
{!loading && !hasData && (
  <Card className="border-dashed">
    <CardContent className="py-10 text-center space-y-3">
      <p className="font-semibold text-lg">Welcome to FinTrack</p>
      <p className="text-muted-foreground text-sm max-w-sm mx-auto">
        Get started by adding your accounts, then record your first transaction.
      </p>
      <div className="flex justify-center gap-3 pt-2">
        <a href="/accounts">
          <Button variant="default" size="sm">Add Accounts</Button>
        </a>
        <a href="/transactions/new">
          <Button variant="outline" size="sm">Record Transaction</Button>
        </a>
      </div>
    </CardContent>
  </Card>
)}
```

**Step 2: Improve transactions list empty state**

In `frontend/src/app/(dashboard)/transactions/page.tsx`, find the empty state (likely just a `<p>` or empty condition). Replace with:

```tsx
{!loading && transactions.length === 0 && (
  <div className="text-center py-16 space-y-3">
    <p className="text-muted-foreground">No transactions found.</p>
    {!typeFilter && !accountFilter && !categoryFilter && !debouncedSearch && (
      <a href="/transactions/new">
        <Button variant="outline" size="sm">Record your first transaction</Button>
      </a>
    )}
    {(typeFilter || accountFilter || categoryFilter || debouncedSearch) && (
      <p className="text-xs text-muted-foreground">Try adjusting your filters.</p>
    )}
  </div>
)}
```

**Step 3: TypeScript check**

```bash
cd /home/wsl/personal/fintrack/frontend
bun run tsc --noEmit
```

**Step 4: Commit**

```bash
cd /home/wsl/personal/fintrack
git add frontend/src/app/\(dashboard\)/page.tsx \
  frontend/src/app/\(dashboard\)/transactions/page.tsx
git commit -m "feat: add empty states with CTAs on dashboard and transactions"
```

---

## Task 6: Account edit in the UI

**Fixes:** [H5] No way to rename an account or fix a typo.

**Files:**
- Modify: `frontend/src/app/(dashboard)/accounts/page.tsx`

---

**Step 1: Add edit state and dialog to `accounts/page.tsx`**

Add new state variables after the existing ones:

```typescript
const [editOpen, setEditOpen] = useState(false);
const [editAccount, setEditAccount] = useState<Account | null>(null);
const [editName, setEditName] = useState("");
const [editBalance, setEditBalance] = useState("0.00");
const [editSubmitting, setEditSubmitting] = useState(false);
const [editError, setEditError] = useState<string | null>(null);
```

Add the open-edit handler:

```typescript
function openEdit(account: Account) {
  setEditAccount(account);
  setEditName(account.name);
  setEditBalance(account.opening_balance);
  setEditOpen(true);
  setEditError(null);
}
```

Add the submit handler:

```typescript
async function handleEdit(e: React.FormEvent) {
  e.preventDefault();
  if (!editAccount) return;
  setEditSubmitting(true);
  setEditError(null);
  try {
    await api.patch(`/accounts/${editAccount.id}`, {
      name: editName,
      opening_balance: editBalance,
    });
    setEditOpen(false);
    setEditAccount(null);
    await loadAccounts();
  } catch (e: unknown) {
    setEditError(e instanceof Error ? e.message : "Failed to update account");
  } finally {
    setEditSubmitting(false);
  }
}
```

**Step 2: Add edit button to each account card**

Import `Pencil` from lucide-react.

In the card's `CardHeader`, add an edit button next to the badge:

```tsx
<CardHeader className="pb-2">
  <div className="flex items-center justify-between">
    <CardTitle className="text-base">{a.name}</CardTitle>
    <div className="flex items-center gap-2">
      <Badge variant="secondary">{TYPE_LABELS[a.type] ?? a.type}</Badge>
      <button
        onClick={(e) => { e.stopPropagation(); openEdit(a); }}
        className="text-muted-foreground hover:text-foreground transition-colors"
        aria-label={`Edit ${a.name}`}
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
    </div>
  </div>
</CardHeader>
```

**Step 3: Add the edit Dialog**

Below the existing create Dialog (before the closing `</div>` of the page), add:

```tsx
<Dialog open={editOpen} onOpenChange={setEditOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Edit Account</DialogTitle>
    </DialogHeader>
    <form onSubmit={handleEdit} className="space-y-4">
      <div className="space-y-2">
        <Label>Name</Label>
        <Input
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label>Opening Balance (₱)</Label>
        <Input
          type="number"
          step="0.01"
          value={editBalance}
          onChange={(e) => setEditBalance(e.target.value)}
        />
      </div>
      {editError && <p className="text-sm text-destructive">{editError}</p>}
      <Button type="submit" className="w-full" disabled={editSubmitting}>
        {editSubmitting ? "Saving…" : "Save Changes"}
      </Button>
    </form>
  </DialogContent>
</Dialog>
```

**Step 4: TypeScript check**

```bash
cd /home/wsl/personal/fintrack/frontend
bun run tsc --noEmit
```

**Step 5: Commit**

```bash
cd /home/wsl/personal/fintrack
git add frontend/src/app/\(dashboard\)/accounts/page.tsx
git commit -m "feat: add account edit dialog to accounts page"
```

---

## Task 7: Add category selector to TransactionConfirm

**Fixes:** [M6] AI-imported receipts always save with `category_id: null`.

**Must complete before Task 9 (Scan page).**

**Files:**
- Modify: `frontend/src/components/app/TransactionConfirm.tsx`
- Modify: `frontend/src/app/(dashboard)/documents/page.tsx`

---

**Step 1: Update `TransactionConfirm` to accept and use categories**

Add `Category` interface and update props in `TransactionConfirm.tsx`:

```typescript
interface Category {
  id: string;
  name: string;
  type: string;
}

interface TransactionConfirmProps {
  parsed: ParsedTransaction;
  accountId: string;
  documentId?: string;
  categories?: Category[];
  onSuccess: () => void;
}
```

Add `categories = []` to destructuring:

```typescript
export function TransactionConfirm({
  parsed,
  accountId,
  documentId,
  categories = [],
  onSuccess,
}: TransactionConfirmProps) {
```

Add `categoryId` state after `type`:

```typescript
const [categoryId, setCategoryId] = useState("");
```

Include `category_id` in the POST body when present:

```typescript
await api.post("/transactions", {
  account_id: accountId,
  amount,
  date,
  description,
  type,
  source: "paste_ai",
  ...(categoryId ? { category_id: categoryId } : {}),
  ...(documentId ? { document_id: documentId } : {}),
});
```

Add the category selector field after the Type field (only show if categories are provided):

```tsx
{categories.length > 0 && (
  <div>
    <Label htmlFor="tc-category">Category</Label>
    <Select value={categoryId} onValueChange={setCategoryId}>
      <SelectTrigger id="tc-category">
        <SelectValue placeholder="Select category (optional)" />
      </SelectTrigger>
      <SelectContent>
        {categories
          .filter((c) => c.type === type || c.type === "transfer")
          .map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  </div>
)}
```

**Step 2: Pass categories to TransactionConfirm in documents page**

In `frontend/src/app/(dashboard)/documents/page.tsx`, add a categories query alongside the accounts query:

```typescript
interface Category {
  id: string;
  name: string;
  type: string;
}

const { data: categories = [] } = useQuery({
  queryKey: ["categories"],
  queryFn: () => api.get<Category[]>("/categories"),
});
```

Update the `TransactionConfirm` usage to pass categories:

```tsx
<TransactionConfirm
  parsed={parsedSingle}
  accountId={defaultAccountId}
  documentId={selected.id}
  categories={categories}
  onSuccess={() => { handleClose(); void refetch(); }}
/>
```

**Step 3: TypeScript check**

```bash
cd /home/wsl/personal/fintrack/frontend
bun run tsc --noEmit
```

**Step 4: Commit**

```bash
cd /home/wsl/personal/fintrack
git add frontend/src/components/app/TransactionConfirm.tsx \
  frontend/src/app/\(dashboard\)/documents/page.tsx
git commit -m "feat: add category selector to AI import transaction review"
```

---

## Task 8: Account selector in BulkImportTable

**Fixes:** [H6] CC statement bulk import always assigns to first account.

**Must complete before Task 9 (Scan page).**

**Files:**
- Modify: `frontend/src/components/app/BulkImportTable.tsx`
- Modify: `frontend/src/app/(dashboard)/documents/page.tsx`

---

**Step 1: Update `BulkImportTable` to accept accounts and show a selector**

Add `Account` interface and update props:

```typescript
interface Account {
  id: string;
  name: string;
  type: string;
}

interface BulkImportTableProps {
  rows: ParsedTransaction[];
  accountId: string;
  accounts?: Account[];
  documentId?: string;
  onSuccess: (count: number) => void;
}
```

Add imports for Select components at the top:
```typescript
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
```

Add `selectedAccountId` state (initialized to the passed `accountId`):

```typescript
const [selectedAccountId, setSelectedAccountId] = useState(accountId);
```

Replace the hardcoded `account_id: accountId` in the POST body with `account_id: selectedAccountId`.

Add an account selector above the table (only shown when `accounts` has more than one entry):

```tsx
{accounts && accounts.length > 1 && (
  <div className="space-y-1">
    <Label>Import to account</Label>
    <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {accounts.map((a) => (
          <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
)}
```

**Step 2: Pass accounts to BulkImportTable in documents page**

In `frontend/src/app/(dashboard)/documents/page.tsx`, update `BulkImportTable` usage:

```tsx
<BulkImportTable
  rows={parsedBulk.transactions}
  accountId={defaultAccountId}
  accounts={accounts}
  documentId={selected.id}
  onSuccess={() => { handleClose(); void refetch(); }}
/>
```

**Step 3: TypeScript check**

```bash
cd /home/wsl/personal/fintrack/frontend
bun run tsc --noEmit
```

**Step 4: Commit**

```bash
cd /home/wsl/personal/fintrack
git add frontend/src/components/app/BulkImportTable.tsx \
  frontend/src/app/\(dashboard\)/documents/page.tsx
git commit -m "feat: add account selector to bulk import table"
```

---

## Task 9: Scan page — inline paste after upload

**Fixes:** [H1] AI import requires 8+ steps across two pages.

**Must run AFTER Tasks 7 and 8** (needs the updated components).

**Files:**
- Modify: `frontend/src/app/(dashboard)/scan/page.tsx`

---

**Step 1: Rewrite `scan/page.tsx` to include the full import flow**

Replace the entire file content with:

```tsx
"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PasteInput } from "@/components/app/PasteInput";
import { TransactionConfirm } from "@/components/app/TransactionConfirm";
import { BulkImportTable } from "@/components/app/BulkImportTable";
import { api } from "@/lib/api";
import { Camera, Upload, Copy, Check, FileText, CheckCircle2 } from "lucide-react";
import type { ParsedTransaction, BulkParseResponse, PasteResult } from "@/types/parse";

type DocType = "receipt" | "cc_statement" | "other";

interface DocumentResponse {
  id: string;
  filename: string;
  document_type: DocType;
  status: string;
}

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

export default function ScanPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<DocType>("receipt");
  const [docId, setDocId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copying, setCopying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");

  const [parsedSingle, setParsedSingle] = useState<ParsedTransaction | null>(null);
  const [parsedBulk, setParsedBulk] = useState<BulkParseResponse | null>(null);
  const [importedCount, setImportedCount] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<Account[]>("/accounts"),
      api.get<Category[]>("/categories"),
    ]).then(([accs, cats]) => {
      setAccounts(accs);
      setCategories(cats);
      if (accs.length > 0) setSelectedAccountId(accs[0].id);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const handleFile = useCallback((f: File) => {
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setDocId(null);
    setPrompt(null);
    setCopied(false);
    setParsedSingle(null);
    setParsedBulk(null);
    setImportedCount(null);
    setError(null);
  }, []);

  const handleSave = async () => {
    if (!file) return;
    setSaving(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("document_type", docType);
      const doc = await api.upload<DocumentResponse>("/documents/upload", form);
      setDocId(doc.id);
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleCopyPrompt = async () => {
    if (!docId) return;
    setCopying(true);
    try {
      const data = await api.post<{ prompt: string }>(`/documents/${docId}/prompt`, {});
      await navigator.clipboard.writeText(data.prompt);
      setPrompt(data.prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Failed to copy prompt.");
    } finally {
      setCopying(false);
    }
  };

  const handleParsed = (result: PasteResult) => {
    if (result.kind === "single") {
      setParsedSingle(result.data);
      setParsedBulk(null);
    } else {
      setParsedBulk(result.data);
      setParsedSingle(null);
    }
  };

  const handleReset = () => {
    setFile(null);
    setPreview(null);
    setDocId(null);
    setPrompt(null);
    setCopied(false);
    setParsedSingle(null);
    setParsedBulk(null);
    setImportedCount(null);
    setError(null);
  };

  const isBulk = docType === "cc_statement";

  // Success state
  if (importedCount !== null) {
    return (
      <div className="max-w-lg mx-auto p-6 space-y-6">
        <div className="text-center space-y-3 py-8">
          <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
          <p className="text-xl font-semibold">
            {importedCount === 1
              ? "1 transaction imported"
              : `${importedCount} transactions imported`}
          </p>
          <p className="text-muted-foreground text-sm">
            They&apos;ve been added to your transactions list.
          </p>
        </div>
        <Button className="w-full" onClick={handleReset}>
          Scan Another
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Scan Receipt or Statement</h1>

      {/* Step 1: Upload */}
      {!docId && (
        <>
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => cameraInputRef.current?.click()}
            >
              <Camera className="mr-2 h-4 w-4" /> Take Photo
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mr-2 h-4 w-4" /> Upload File
            </Button>
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </div>

          {file && preview && (
            <Card>
              <CardContent className="pt-4">
                {file.type === "application/pdf" ? (
                  <div className="flex items-center gap-3 p-4 bg-muted rounded-md">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                    <p className="text-sm font-medium">{file.name}</p>
                  </div>
                ) : (
                  <img
                    src={preview}
                    alt={file.name}
                    className="w-full rounded-md object-contain max-h-64"
                  />
                )}
              </CardContent>
            </Card>
          )}

          {file && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Document Type</CardTitle>
              </CardHeader>
              <CardContent className="flex gap-3">
                {(["receipt", "cc_statement", "other"] as DocType[]).map((t) => (
                  <Badge
                    key={t}
                    variant={docType === t ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => setDocType(t)}
                  >
                    {t === "cc_statement"
                      ? "CC Statement"
                      : t.charAt(0).toUpperCase() + t.slice(1)}
                  </Badge>
                ))}
              </CardContent>
            </Card>
          )}

          {accounts.length > 1 && file && (
            <div className="space-y-1.5">
              <Label>Import to account</Label>
              <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          {file && (
            <Button className="w-full" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Document"}
            </Button>
          )}
        </>
      )}

      {/* Step 2: Copy prompt + paste AI response */}
      {docId && !parsedSingle && !parsedBulk && (
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-4 space-y-3">
              <p className="text-sm font-medium">Step 1 — Copy the AI prompt</p>
              <Button
                className="w-full"
                variant="secondary"
                onClick={handleCopyPrompt}
                disabled={copying}
              >
                {copied ? (
                  <><Check className="mr-2 h-4 w-4" /> Copied!</>
                ) : (
                  <><Copy className="mr-2 h-4 w-4" /> {copying ? "Copying..." : "Copy AI Prompt"}</>
                )}
              </Button>
              <p className="text-xs text-muted-foreground">
                Open Claude.ai or Gemini, attach your file, paste the prompt, and send.
              </p>
            </CardContent>
          </Card>

          {prompt && (
            <Card>
              <CardContent className="pt-4 space-y-3">
                <p className="text-sm font-medium">Step 2 — Paste the AI response</p>
                <PasteInput bulk={isBulk} onParsed={handleParsed} />
              </CardContent>
            </Card>
          )}

          {!prompt && (
            <p className="text-xs text-muted-foreground text-center">
              Copy the prompt first, then come back to paste the response.
            </p>
          )}
        </div>
      )}

      {/* Step 3: Review and import */}
      {docId && parsedSingle && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Review Transaction</CardTitle>
          </CardHeader>
          <CardContent>
            <TransactionConfirm
              parsed={parsedSingle}
              accountId={selectedAccountId}
              documentId={docId}
              categories={categories}
              onSuccess={() => setImportedCount(1)}
            />
          </CardContent>
        </Card>
      )}

      {docId && parsedBulk && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Review Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <BulkImportTable
              rows={parsedBulk.transactions}
              accountId={selectedAccountId}
              accounts={accounts}
              documentId={docId}
              onSuccess={(count) => setImportedCount(count)}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

**Step 2: TypeScript check**

```bash
cd /home/wsl/personal/fintrack/frontend
bun run tsc --noEmit
```

Expected: 0 errors.

**Step 3: Commit**

```bash
cd /home/wsl/personal/fintrack
git add frontend/src/app/\(dashboard\)/scan/page.tsx
git commit -m "feat: merge paste/review workflow into scan page"
```

---

## Task 10: Complete TransactionSubType options in New Transaction form

**Fixes:** [M2] Philippine-specific income sub-types missing from form.

**Files:**
- Modify: `frontend/src/app/(dashboard)/transactions/new/page.tsx`

---

**Step 1: Read the current sub-type options**

Open `frontend/src/app/(dashboard)/transactions/new/page.tsx`. Find the arrays or select options for income, expense, and transfer sub-types.

**Step 2: Replace sub-type options with complete lists**

Find and replace the income sub-types list with:

```typescript
const INCOME_SUBTYPES = [
  { value: "salary", label: "Salary" },
  { value: "thirteenth_month", label: "13th Month Pay" },
  { value: "bonus", label: "Bonus" },
  { value: "overtime", label: "Overtime" },
  { value: "freelance", label: "Freelance" },
  { value: "business", label: "Business Income" },
  { value: "consulting", label: "Consulting" },
  { value: "rental", label: "Rental Income" },
  { value: "interest", label: "Interest" },
  { value: "dividends", label: "Dividends" },
  { value: "capital_gains", label: "Capital Gains" },
  { value: "sss_benefit", label: "SSS Benefit" },
  { value: "philhealth_reimbursement", label: "PhilHealth Reimbursement" },
  { value: "pagibig_dividend", label: "Pag-IBIG Dividend" },
  { value: "government_aid", label: "Government Aid" },
  { value: "remittance_received", label: "Remittance Received" },
  { value: "gift_received", label: "Gift Received" },
  { value: "tax_refund", label: "Tax Refund" },
  { value: "sale_of_items", label: "Sale of Items" },
  { value: "refund_cashback", label: "Refund / Cashback" },
  { value: "other_income", label: "Other Income" },
];

const EXPENSE_SUBTYPES = [
  { value: "regular", label: "Regular Expense" },
  { value: "bill_payment", label: "Bill Payment" },
  { value: "subscription", label: "Subscription" },
  { value: "gift_given", label: "Gift Given" },
  { value: "other_expense", label: "Other Expense" },
];

const TRANSFER_SUBTYPES = [
  { value: "own_account", label: "Own Account" },
  { value: "sent_to_person", label: "Sent to Person" },
  { value: "atm_withdrawal", label: "ATM Withdrawal" },
];
```

Then render the options dynamically. Find the sub-type select and replace the hardcoded `<SelectItem>` list with:

```tsx
{(type === "income" ? INCOME_SUBTYPES
  : type === "expense" ? EXPENSE_SUBTYPES
  : TRANSFER_SUBTYPES
).map((s) => (
  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
))}
```

**Step 3: TypeScript check**

```bash
cd /home/wsl/personal/fintrack/frontend
bun run tsc --noEmit
```

**Step 4: Commit**

```bash
cd /home/wsl/personal/fintrack
git add frontend/src/app/\(dashboard\)/transactions/new/page.tsx
git commit -m "feat: add all Philippine income sub-types to transaction form"
```

---

## Task 11: Fix analytics — replace native HTML elements with shadcn

**Fixes:** [L1] Analytics month/year selectors are visually inconsistent.

**Files:**
- Modify: `frontend/src/app/(dashboard)/analytics/page.tsx`

---

**Step 1: Replace native `<select>` for month with shadcn `<Select>`**

In `analytics/page.tsx`, find the native `<select>` element for the month. Replace it with:

```tsx
<Select value={String(month)} onValueChange={(v) => { setMonth(Number(v)); setOffset(0); }}>
  <SelectTrigger className="w-36">
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    {[
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ].map((name, i) => (
      <SelectItem key={i + 1} value={String(i + 1)}>{name}</SelectItem>
    ))}
  </SelectContent>
</Select>
```

Import `Select, SelectContent, SelectItem, SelectTrigger, SelectValue` from `@/components/ui/select` if not already imported.

**Step 2: Replace native `<input type="number">` for year with shadcn `<Input>`**

Find the native `<input type="number">` for the year. Replace with shadcn `<Input>`:

```tsx
<Input
  className="w-24"
  value={yearInput}
  onChange={(e) => setYearInput(e.target.value)}
  onBlur={() => {
    const n = Number(yearInput);
    if (!isNaN(n) && n >= 2000 && n <= 2099) {
      setYear(n);
    } else {
      setYearInput(String(year));
    }
  }}
/>
```

Import `Input` from `@/components/ui/input` if not already imported.

**Step 3: TypeScript check**

```bash
cd /home/wsl/personal/fintrack/frontend
bun run tsc --noEmit
```

**Step 4: Commit**

```bash
cd /home/wsl/personal/fintrack
git add frontend/src/app/\(dashboard\)/analytics/page.tsx
git commit -m "style: replace native HTML controls with shadcn in analytics"
```

---

## Task 12: Paid/unpaid filter on Statements page

**Fixes:** [M5] No way to view only unpaid statements.

**Files:**
- Modify: `frontend/src/app/(dashboard)/statements/page.tsx`

---

**Step 1: Read the current statements page**

Open `frontend/src/app/(dashboard)/statements/page.tsx` and understand the current filter and fetch logic.

**Step 2: Add paid filter state and toggle**

Add state:
```typescript
const [paidFilter, setPaidFilter] = useState<"all" | "unpaid" | "paid">("all");
```

Include it in the API request:
```typescript
const params = new URLSearchParams();
if (cardFilter) params.set("credit_card_id", cardFilter);
if (paidFilter === "unpaid") params.set("is_paid", "false");
if (paidFilter === "paid") params.set("is_paid", "true");
```

Add filter toggle buttons in the header area (consistent with the type filter style on the transactions page):

```tsx
<div className="flex gap-2">
  {(["all", "unpaid", "paid"] as const).map((f) => (
    <Button
      key={f}
      size="sm"
      variant={paidFilter === f ? "default" : "outline"}
      onClick={() => setPaidFilter(f)}
    >
      {f.charAt(0).toUpperCase() + f.slice(1)}
    </Button>
  ))}
</div>
```

**Step 3: TypeScript check**

```bash
cd /home/wsl/personal/fintrack/frontend
bun run tsc --noEmit
```

**Step 4: Run full test suite one final time**

```bash
cd /home/wsl/personal/fintrack/api
DATABASE_URL="postgresql+asyncpg://finance:changeme@127.0.0.1:5435/finance_db" \
TEST_DATABASE_URL="postgresql+asyncpg://finance:changeme@127.0.0.1:5435/finance_test" \
  uv run pytest -v
```

Expected: all tests pass.

**Step 5: Commit**

```bash
cd /home/wsl/personal/fintrack
git add frontend/src/app/\(dashboard\)/statements/page.tsx
git commit -m "feat: add paid/unpaid filter to statements page"
```

---

## Completion Checklist

- [ ] Task 1: PATCH /auth/me — Settings profile save works
- [ ] Task 2: 401 interceptor — Expired sessions redirect to /login
- [ ] Task 3: Transaction search — Description search works
- [ ] Task 4: Transaction total count — Shows "Showing X of Y"
- [ ] Task 5: Empty states — Dashboard and transactions have CTAs
- [ ] Task 6: Account edit — Pencil icon opens edit dialog
- [ ] Task 7: Category in TransactionConfirm — AI import can assign category
- [ ] Task 8: Account selector in BulkImportTable — CC import uses correct account
- [ ] Task 9: Scan page inline flow — Full import workflow on one page
- [ ] Task 10: Complete sub-types — All 21 income sub-types in form
- [ ] Task 11: Analytics shadcn — Native controls replaced
- [ ] Task 12: Statements filter — Paid/unpaid toggle works
