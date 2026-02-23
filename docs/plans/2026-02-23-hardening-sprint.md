# FinTrack Hardening Sprint — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Harden the FinTrack codebase across security, data integrity, DX, UX, and performance — no rewrite, just fixes.

**Architecture:** Backend is FastAPI + SQLAlchemy async + PostgreSQL at `api/`. Frontend is Next.js 16 + shadcn/ui at `frontend/`. Docker Compose for local dev. Celery + Redis for background tasks.

**Tech Stack:** Python 3.14, FastAPI, SQLAlchemy 2.x, Alembic, Pydantic v2, Next.js 16, TypeScript (strict), shadcn/ui, Tailwind CSS v4, Vitest, pytest-asyncio.

**Tracking:** Update checkboxes in this file as tasks complete. Subagents MUST check a task's box `- [x]` after it passes verification.

---

## Phase A: Security & Safety

_Priority: highest. These are security bugs or data-loss risks. No task depends on another — all can run in parallel._

---

### Task A1: Password validation on registration

- [x] **Complete**

**Files:**
- Modify: `api/app/schemas/auth.py:5-9` (RegisterRequest class)

**What:** `RegisterRequest.password` has no `min_length` or `max_length`. Users can register with a 1-character password. `ChangePasswordRequest` at line 30 correctly enforces `min_length=8`. Registration must match.

**Implementation:**

```python
# api/app/schemas/auth.py — RegisterRequest class
class RegisterRequest(BaseModel):
    email: EmailStr
    name: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=8, max_length=128)
```

**Verify:** `cd api && uv run pytest tests/test_auth.py -v` — existing tests pass. Then add a test:

```python
# In tests/test_auth.py — add after existing registration tests
async def test_register_short_password_rejected(client):
    resp = await client.post("/auth/register", json={
        "email": "short@test.com", "name": "Test", "password": "short"
    })
    assert resp.status_code == 422

async def test_register_empty_name_rejected(client):
    resp = await client.post("/auth/register", json={
        "email": "noname@test.com", "name": "", "password": "validpass123"
    })
    assert resp.status_code == 422
```

---

### Task A2: Escape ILIKE search wildcards

- [x] **Complete**

**Files:**
- Modify: `api/app/routers/transactions.py:41`

**What:** The `search` parameter is interpolated directly into ILIKE pattern. `%` and `_` are LIKE wildcards and are not escaped. Crafted patterns can cause PostgreSQL DoS.

**Implementation:**

```python
# api/app/routers/transactions.py — add helper at top of file (after imports)
import re

def _escape_like(s: str) -> str:
    return re.sub(r"([%_\\])", r"\\\1", s)

# Then at line 41, replace:
#   base = base.where(Transaction.description.ilike(f"%{search}%"))
# With:
    base = base.where(Transaction.description.ilike(f"%{_escape_like(search)}%"))
```

**Verify:** `cd api && uv run pytest tests/test_transactions.py -v` — existing tests pass. Add test:

```python
# In tests/test_transactions.py
async def test_search_escapes_wildcards(auth_client):
    """Search with % and _ should be treated as literals, not wildcards."""
    resp = await auth_client.get("/transactions", params={"search": "%_special"})
    assert resp.status_code == 200
```

---

### Task A3: Add ondelete to all foreign keys (migration)

- [x] **Complete**

**Files:**
- Modify: `api/app/models/transaction.py:70,73,76,80,83,102,107`
- Modify: `api/app/models/recurring_transaction.py:33,36`
- Create: `api/migrations/versions/xxxx_add_fk_ondelete.py` (via alembic)

**What:** 9 ForeignKey columns lack `ondelete`. Deleting an account/category with linked transactions throws unhandled IntegrityError → raw 500.

**Model changes:**

```python
# api/app/models/transaction.py
# Line 70: account_id FK
account_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("accounts.id", ondelete="RESTRICT"), nullable=False)

# Line 73: category_id FK
category_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("categories.id", ondelete="SET NULL"))

# Line 76: to_account_id FK
to_account_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("accounts.id", ondelete="SET NULL"))

# Line 80: document_id FK
document_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("documents.id", ondelete="SET NULL"))

# Line 83: recurring_id FK
recurring_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("recurring_transactions.id", ondelete="SET NULL"))

# Line 102: fee_category_id FK
fee_category_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("categories.id", ondelete="SET NULL"))

# Line 107: created_by FK
created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
```

```python
# api/app/models/recurring_transaction.py
# Line 33: account_id FK
account_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False)

# Line 36: category_id FK
category_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("categories.id", ondelete="SET NULL"))
```

**Generate migration:**

```bash
cd api && DATABASE_URL="postgresql+asyncpg://finance:changeme@127.0.0.1:5435/finance_db" uv run alembic revision --autogenerate -m "add FK ondelete policies"
```

**Review the generated migration** — it should contain `ALTER TABLE ... DROP CONSTRAINT ... ADD CONSTRAINT ... ON DELETE ...` for each FK. Verify there is a proper `downgrade()`.

**Verify:** `cd api && uv run pytest tests/ -v` — all 55+ tests pass.

---

### Task A4: Fix refreshPromise stale reference

- [x] **Complete**

**Files:**
- Modify: `frontend/src/lib/api.ts:13,69-81`

**What:** After `isRefreshing` is set to `false`, `refreshPromise` still holds the old resolved Promise. A subsequent 401 can await the stale result and incorrectly redirect to `/login`.

**Implementation:**

```typescript
// frontend/src/lib/api.ts — in the .finally() block (around line 72)
// Replace:
//   refreshPromise = tryRefresh().finally(() => {
//     isRefreshing = false;
//   });
// With:
    refreshPromise = tryRefresh().finally(() => {
      isRefreshing = false;
      refreshPromise = null;
    });
```

**Verify:** `cd frontend && bun test src/lib/api.test.ts` — existing tests pass.

---

### Task A5: Route api.upload through 401 refresh logic

- [ ] **Complete**

**Files:**
- Modify: `frontend/src/lib/api.ts:100-113`

**What:** The `upload` method is a raw `fetch` that bypasses the `request()` function's 401 refresh and offline queue logic.

**Implementation:**

```typescript
// frontend/src/lib/api.ts — replace the upload method (lines 100-113)
  upload: async <T>(path: string, form: FormData): Promise<T> => {
    const url = `${getBaseUrl()}${path}`;
    const doUpload = async (): Promise<Response> => {
      return fetch(url, {
        method: "POST",
        credentials: "include",
        body: form,
      });
    };

    let response = await doUpload();

    if (response.status === 401) {
      const refreshed = await tryRefresh();
      if (refreshed) {
        response = await doUpload();
      } else {
        window.location.href = "/login";
        return undefined as T;
      }
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Upload failed" }));
      const detail = error.detail;
      const message = Array.isArray(detail)
        ? detail.map((e: { msg: string }) => e.msg).join("; ")
        : (detail as string) || response.statusText;
      throw new Error(message);
    }
    return response.json();
  },
```

Note: `tryRefresh` is already defined at the module level (around line 15). If it's not exported/accessible, extract it from the `request` function first.

**Verify:** `cd frontend && bun test src/lib/api.test.ts` — existing tests pass.

---

### Task A6: Fix logout cookie clearing

- [ ] **Complete**

**Files:**
- Modify: `api/app/routers/auth.py:16-35,61-65`

**What:** `delete_cookie` must use the same `domain`, `path`, `secure`, `samesite` attributes as `set_cookie`. Extract cookie kwargs into a helper.

**Implementation:**

```python
# api/app/routers/auth.py — add helper after imports, before _set_auth_cookies
def _cookie_kwargs() -> dict:
    kwargs: dict = {"httponly": True, "secure": settings.cookie_secure, "samesite": "lax"}
    if settings.cookie_domain and settings.cookie_domain != "localhost":
        kwargs["domain"] = settings.cookie_domain
    return kwargs

# Refactor _set_auth_cookies to use it:
def _set_auth_cookies(response: Response, access: str, refresh: str) -> None:
    kw = _cookie_kwargs()
    response.set_cookie("access_token", access, max_age=settings.jwt_access_token_expire_minutes * 60, **kw)
    response.set_cookie("refresh_token", refresh, max_age=settings.jwt_refresh_token_expire_days * 86400, **kw)

# Refactor logout to use same kwargs:
@router.post("/logout")
async def logout(response: Response):
    kw = _cookie_kwargs()
    response.delete_cookie("access_token", **kw)
    response.delete_cookie("refresh_token", **kw)
    return {"message": "Logged out"}

# Refactor refresh endpoint cookie setting (lines 86-94) to use _set_auth_cookies
# instead of duplicating cookie logic inline.
```

**Verify:** `cd api && uv run pytest tests/test_auth.py -v`

---

### Task A7: File upload extension allowlist

- [ ] **Complete**

**Files:**
- Modify: `api/app/routers/documents.py:35-40`

**What:** Extension is extracted from user-supplied filename with no allowlist. Content-type check relies on client header.

**Implementation:**

```python
# api/app/routers/documents.py — add after imports
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".pdf", ".csv", ".txt"}

# Replace ext extraction at line 35:
    ext = Path(file.filename or "file").suffix.lower() or ".bin"
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"File type '{ext}' is not allowed")
    file_name = f"{uuid.uuid4()}{ext}"
```

**Verify:** `cd api && uv run pytest tests/test_documents.py -v`

---

### Task A8: Remove file_path from DocumentResponse

- [ ] **Complete**

**Files:**
- Modify: `api/app/schemas/document.py:11`

**What:** `file_path` leaks internal server filesystem structure to the client.

**Implementation:** Remove the `file_path` field from `DocumentResponse`. If the frontend references `file_path`, search for it and remove those references too.

```python
# api/app/schemas/document.py — remove file_path from DocumentResponse
# Keep: id, original_filename, content_type, file_size, extracted_data, user_id, account_id, category_id, created_at, updated_at
```

**Check frontend:** `grep -r "file_path" frontend/src/` — remove any references.

**Verify:** `cd api && uv run pytest tests/test_documents.py -v`

---

### Task A9: Remove inert API key inputs from settings

- [ ] **Complete**

**Files:**
- Modify: `frontend/src/app/(dashboard)/settings/page.tsx:153-175`

**What:** Two `<Input>` fields for Gemini/Claude API keys — no state, no onChange, no save. Users paste real secrets into a form that does nothing.

**Implementation:** Replace the API Keys card with a placeholder:

```tsx
{/* Replace lines 153-175 with: */}
<Card className="border-dashed">
  <CardHeader>
    <CardTitle>API Keys</CardTitle>
  </CardHeader>
  <CardContent>
    <p className="text-sm text-muted-foreground">
      API key configuration coming soon. Receipt scanning currently uses server-side keys.
    </p>
  </CardContent>
</Card>
```

**Verify:** `cd frontend && bun test` — all tests pass. Visual check: settings page no longer shows non-functional inputs.

---

## Phase B: Data Integrity & Database

_Priority: high. These prevent silent data corruption and query performance issues. Tasks B1-B3 can run in parallel. B4 depends on nothing._

---

### Task B1: Add missing database indexes (migration)

- [ ] **Complete**

**Files:**
- Modify: model files to add `index=True` to FK columns
- Create: migration via `alembic revision --autogenerate`

**What:** 12+ FK columns used in WHERE clauses lack indexes. Most critical: `transactions.user_id`, `accounts.user_id`.

**Model changes — add `index=True`:**

```python
# api/app/models/transaction.py
# Line 67: user_id — already has ondelete, add index
user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
# Line 70: account_id
account_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("accounts.id", ondelete="RESTRICT"), nullable=False, index=True)
# Line 73: category_id
category_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("categories.id", ondelete="SET NULL"), index=True)

# api/app/models/account.py — user_id column, add index=True
# api/app/models/budget.py — user_id column, add index=True
# api/app/models/notification.py — user_id column, add index=True
# api/app/models/document.py — user_id column, add index=True
# api/app/models/credit_card.py — user_id column, add index=True
# api/app/models/recurring_transaction.py — user_id column, add index=True
# api/app/models/statement.py — credit_card_id column, add index=True
```

Also add a composite index for the primary query pattern:

```python
# api/app/models/transaction.py — add to __table_args__
from sqlalchemy import Index

class Transaction(Base):
    __tablename__ = "transactions"
    __table_args__ = (
        Index("ix_transactions_user_date", "user_id", "date"),
    )
```

**Generate migration:**

```bash
cd api && DATABASE_URL="postgresql+asyncpg://finance:changeme@127.0.0.1:5435/finance_db" uv run alembic revision --autogenerate -m "add missing indexes"
```

**Verify:** `cd api && uv run pytest tests/ -v` — all tests pass.

---

### Task B2: Configure connection pool

- [ ] **Complete**

**Files:**
- Modify: `api/app/core/database.py:9`

**What:** Engine uses SQLAlchemy defaults with no `pool_pre_ping`. Stale connections after DB restart cause `InterfaceError`.

**Implementation:**

```python
# api/app/core/database.py — replace line 9
engine = create_async_engine(
    settings.database_url,
    echo=False,
    pool_size=10,
    max_overflow=5,
    pool_pre_ping=True,
    pool_recycle=3600,
    pool_timeout=30,
)
```

**Verify:** `cd api && uv run pytest tests/ -v` — all tests pass (tests use their own engine with NullPool, so this doesn't affect them).

---

### Task B3: Add CHECK constraints (migration)

- [ ] **Complete**

**Files:**
- Create: migration via alembic

**What:** No DB-level constraint prevents negative budgets, negative credit limits, or invalid day values.

**Implementation — create manual migration:**

```bash
cd api && DATABASE_URL="postgresql+asyncpg://finance:changeme@127.0.0.1:5435/finance_db" uv run alembic revision -m "add check constraints"
```

```python
# In the generated migration file:
def upgrade() -> None:
    op.create_check_constraint("ck_transactions_amount_positive", "transactions", "amount > 0")
    op.create_check_constraint("ck_budgets_amount_positive", "budgets", "amount > 0")
    op.create_check_constraint("ck_credit_cards_limit_positive", "credit_cards", "credit_limit >= 0")
    op.create_check_constraint("ck_credit_cards_statement_day", "credit_cards", "statement_day BETWEEN 1 AND 31")
    op.create_check_constraint("ck_credit_cards_due_day", "credit_cards", "due_day BETWEEN 1 AND 31")

def downgrade() -> None:
    op.drop_constraint("ck_credit_cards_due_day", "credit_cards")
    op.drop_constraint("ck_credit_cards_statement_day", "credit_cards")
    op.drop_constraint("ck_credit_cards_limit_positive", "credit_cards")
    op.drop_constraint("ck_budgets_amount_positive", "budgets")
    op.drop_constraint("ck_transactions_amount_positive", "transactions")
```

**Verify:** `cd api && uv run pytest tests/ -v` — all tests pass (existing test data already uses valid values).

---

### Task B4: Fix exclude_none → exclude_unset in update endpoints

- [ ] **Complete**

**Files:**
- Modify: `api/app/routers/transactions.py:87`
- Modify: `api/app/routers/accounts.py:80`
- Modify: `api/app/routers/credit_cards.py:70`
- Modify: `api/app/routers/budgets.py:91`
- Modify: `api/app/routers/statements.py:92`
- Modify: `api/app/routers/documents.py:102`

**What:** `exclude_none=True` prevents users from clearing optional fields (setting them to `null`). Should be `exclude_unset=True` — which the recurring transactions router already correctly uses.

**Implementation:** In each file above, replace `exclude_none=True` with `exclude_unset=True`:

```python
# Before:
for field, value in data.model_dump(exclude_none=True).items():
# After:
for field, value in data.model_dump(exclude_unset=True).items():
```

**Verify:** `cd api && uv run pytest tests/ -v` — all tests pass.

---

## Phase C: AI-Friendliness & DevOps

_Priority: medium. These make the codebase self-documenting for AI agents and fix broken tooling. C1-C5 can run in parallel._

---

### Task C1: Fix setup-dev-env.sh hook

- [ ] **Complete**

**Files:**
- Modify: `.claude/hooks/setup-dev-env.sh:9,14,30-36,52,89,115`

**What:** References old project path `/home/wsl/personal/expense-tracker`, checks for `pnpm` instead of `bun`, wrong Docker grep pattern.

**Implementation:** Update all references:
- Line 9: `"EXPENSE TRACKER DEV ENVIRONMENT"` → `"FINTRACK DEV ENVIRONMENT"`
- Line 14: `PROJECT_DIR="/home/wsl/personal/expense-tracker"` → `PROJECT_DIR="/home/wsl/personal/fintrack"`
- Lines 30-36: Replace `pnpm` check with `bun` check
- Line 52: Replace `expense.tracker.*postgres` with `fintrack.*postgres`
- Line 89: Replace `pnpm dev` with `bun dev`
- Line 115: Replace `pnpm install` with `bun install`

**Verify:** Run the script manually: `bash .claude/hooks/setup-dev-env.sh` — output should reference correct paths and tools.

---

### Task C2: Add bun.lock to protect-sensitive.sh

- [ ] **Complete**

**Files:**
- Modify: `.claude/hooks/protect-sensitive.sh:18-38`

**What:** `PROTECTED_PATTERNS` includes `pnpm-lock.yaml` but not `bun.lock`. AI agents could accidentally modify the lock file.

**Implementation:** Add `"bun.lock"` to the `PROTECTED_PATTERNS` array. Also replace `"pnpm-lock.yaml"` with `"bun.lock"` if pnpm-lock is not used.

**Verify:** Check the array includes `"bun.lock"`.

---

### Task C3: Consolidate formatPeso to shared utility

- [ ] **Complete**

**Files:**
- Modify: `frontend/src/lib/utils.ts` — add formatPeso
- Modify: 7 page files to import from utils instead of declaring inline

**What:** `formatPeso` is duplicated 7 times with inconsistent signatures.

**Implementation:**

```typescript
// frontend/src/lib/utils.ts — add at the end
export function formatPeso(amount: string | number | null): string {
  const n = typeof amount === "string" ? parseFloat(amount) : (amount ?? 0);
  return `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
```

Then in each of these files, remove the local `formatPeso` and add `import { formatPeso } from "@/lib/utils"`:

1. `frontend/src/app/(dashboard)/page.tsx:56`
2. `frontend/src/app/(dashboard)/transactions/page.tsx:69`
3. `frontend/src/app/(dashboard)/accounts/page.tsx:36`
4. `frontend/src/app/(dashboard)/budgets/page.tsx:70`
5. `frontend/src/app/(dashboard)/analytics/page.tsx:45`
6. `frontend/src/app/(dashboard)/recurring/page.tsx:75`
7. `frontend/src/app/(dashboard)/statements/page.tsx:55`

**Verify:** `cd frontend && bun test` — all tests pass. `bun run lint` — no errors.

---

### Task C4: Fix Pydantic validation error rendering

- [ ] **Complete**

**Files:**
- Modify: `frontend/src/lib/api.ts` — inside the `request` function error handling

**What:** Pydantic validation errors return `{"detail": [{...}]}` but `api.ts` does `error.detail || response.statusText`. When detail is an array, users see `[object Object]`.

**Implementation:** Find the error extraction in the `request` function (around line 83-86) and the `upload` method. Update both:

```typescript
// In the error handling section of request() and upload():
const detail = error.detail;
const message = Array.isArray(detail)
  ? detail.map((e: { msg: string }) => e.msg).join("; ")
  : (detail as string) || response.statusText;
throw new Error(message);
```

**Verify:** `cd frontend && bun test src/lib/api.test.ts`

---

### Task C5: Add Celery beat service to docker-compose

- [ ] **Complete**

**Files:**
- Modify: `docker-compose.yml`

**What:** Scheduled tasks (recurring transactions at 00:05, statement alerts at 9am) never fire because there's no beat scheduler service.

**Implementation:** Add after the `worker` service:

```yaml
  beat:
    build:
      context: ./api
      dockerfile: Dockerfile
    command: celery -A app.tasks.celery beat --loglevel=info
    environment:
      - DATABASE_URL=postgresql+asyncpg://finance:changeme@postgres:5432/finance_db
      - REDIS_URL=redis://redis:6379/0
      - APP_ENV=development
    depends_on:
      - redis
      - postgres
    restart: unless-stopped
```

**Verify:** `docker compose config` — no errors. (Do not start containers.)

---

### Task C6: Pin Docker image versions

- [ ] **Complete**

**Files:**
- Modify: `docker-compose.yml:3,19`
- Modify: `api/Dockerfile:1,5`
- Modify: `frontend/Dockerfile:1`

**What:** Major-version-only tags (`postgres:18`, `redis:8`, `python:3.14-slim`, `oven/bun:1-alpine`) are non-deterministic.

**Implementation:**
- `docker-compose.yml`: `postgres:18` → `postgres:18.2`, `redis:8` → `redis:8.0.2`
- `api/Dockerfile`: `python:3.14-slim` → `python:3.14.0-slim`
- `api/Dockerfile`: `RUN pip install uv` → `RUN pip install uv==0.7.2`
- `frontend/Dockerfile`: `oven/bun:1-alpine` → `oven/bun:1.2.4-alpine`

(Use the latest patch versions available at time of implementation. Check Docker Hub for exact tags.)

**Verify:** `docker compose config` — no errors.

---

### Task C7: Remove unused passlib dependency

- [ ] **Complete**

**Files:**
- Modify: `api/pyproject.toml:14`

**What:** `passlib` is declared as a dependency but never imported. The codebase uses `bcrypt` directly.

**Implementation:** Remove `"passlib>=1.7.4",` from the dependencies list.

**Verify:** `cd api && uv sync && uv run pytest tests/ -v` — all tests pass. `grep -r "passlib" api/` returns nothing in code files.

---

## Phase D: Frontend UX

_Priority: medium. These fix broken UX, missing feedback, and accessibility failures. D1-D3 address the most impactful issues._

---

### Task D1: MobileSidebar close on navigation

- [ ] **Complete**

**Files:**
- Modify: `frontend/src/components/app/MobileSidebar.tsx`
- Modify: `frontend/src/components/app/Sidebar.tsx:32-46`

**What:** Tapping a nav link on mobile navigates but the Sheet stays open, covering the screen.

**Implementation:**

```tsx
// frontend/src/components/app/Sidebar.tsx — add onNavigate prop
export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  // ... in the Link elements:
  <Link
    key={href}
    href={href}
    onClick={onNavigate}
    className={cn(/* existing classes */)}
  >
```

```tsx
// frontend/src/components/app/MobileSidebar.tsx — pass callback
<SheetContent side="left" className="p-0 w-64">
  <Sidebar onNavigate={() => setOpen(false)} />
</SheetContent>
```

**Verify:** `cd frontend && bun test src/components/app/Sidebar.test.tsx` — existing tests pass. Manual check: mobile sidebar closes on link click.

---

### Task D2: Keyboard accessibility for interactive list items

- [ ] **Complete**

**Files:**
- Modify: `frontend/src/app/(dashboard)/transactions/page.tsx:324`
- Modify: `frontend/src/app/(dashboard)/notifications/page.tsx:88-95`

**What:** `<li>` elements with `onClick` have no `role="button"`, `tabIndex`, or `onKeyDown`. WCAG Level A failure.

**Implementation — transactions page:**

```tsx
// Line 324 — replace the <li> props:
<li
  key={t.id}
  role="button"
  tabIndex={0}
  className="py-3 flex items-center justify-between cursor-pointer hover:bg-muted/50 -mx-2 px-2 rounded"
  onClick={() => openEditSheet(t)}
  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openEditSheet(t); } }}
>
```

**Implementation — notifications page:**

```tsx
// Line 88-95 — add role, tabIndex, onKeyDown to each <li>
<li
  key={n.id}
  role={!n.is_read ? "button" : undefined}
  tabIndex={!n.is_read ? 0 : undefined}
  className={cn(
    "px-4 py-3 transition-colors",
    !n.is_read && "bg-muted/40 cursor-pointer hover:bg-accent/50",
    n.is_read && "cursor-default"
  )}
  onClick={() => !n.is_read && markRead(n.id)}
  onKeyDown={(e) => { if (!n.is_read && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); markRead(n.id); } }}
>
```

**Verify:** `cd frontend && bun test && bun run lint`

---

### Task D3: Budget delete confirmation dialog

- [ ] **Complete**

**Files:**
- Modify: `frontend/src/app/(dashboard)/budgets/page.tsx:130-137,340`

**What:** Budget delete fires immediately with no confirmation. Inconsistent with Transactions and Recurring which use AlertDialog.

**Implementation:** Import AlertDialog components and wrap the delete button:

```tsx
// Add to imports:
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";

// Replace the Trash2 button at line ~340 with:
<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="ghost" size="icon" className="h-8 w-8 p-0">
      <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
    </Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Delete budget?</AlertDialogTitle>
      <AlertDialogDescription>
        This will permanently delete the &quot;{item.budget.name}&quot; budget. This action cannot be undone.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction onClick={() => handleDelete(item.budget.id)}>Delete</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

**Verify:** `cd frontend && bun test && bun run lint`

---

### Task D4: Transaction edit save feedback + error handling

- [ ] **Complete**

**Files:**
- Modify: `frontend/src/app/(dashboard)/transactions/page.tsx:169-178`

**What:** `handleSave` has no try/catch and no success/error feedback. Silent success pattern.

**Implementation:**

```tsx
// Add state near other state declarations:
const [saveError, setSaveError] = useState<string | null>(null);

// Replace handleSave:
async function handleSave() {
  if (!selectedTxn) return;
  setSaveError(null);
  try {
    await api.patch(`/transactions/${selectedTxn.id}`, {
      ...editForm,
      category_id: editForm.category_id || null,
    });
    setEditSheetOpen(false);
    setSelectedTxn(null);
    await load();
  } catch (e: unknown) {
    setSaveError(e instanceof Error ? e.message : "Failed to save.");
  }
}

// In the Sheet footer, before the Save button, add:
{saveError && <p className="text-sm text-destructive">{saveError}</p>}
```

Also reset `saveError` when opening the sheet:

```tsx
function openEditSheet(t: Transaction) {
  setSelectedTxn(t);
  setSaveError(null);
  // ... existing code
}
```

**Verify:** `cd frontend && bun test && bun run lint`

---

### Task D5: Add page numbers to pagination

- [ ] **Complete**

**Files:**
- Modify: `frontend/src/app/(dashboard)/transactions/page.tsx:361-381`

**What:** Pagination shows Previous/Next but no current page or total. Next button is enabled on exact-boundary edge case.

**Implementation:**

```tsx
// Replace the pagination section (lines 361-381):
{total > LIMIT && (
  <div className="flex items-center justify-between mt-4 pt-4 border-t">
    <Button
      variant="outline"
      size="sm"
      disabled={offset === 0}
      onClick={() => setOffset(Math.max(0, offset - LIMIT))}
    >
      Previous
    </Button>
    <span className="text-sm text-muted-foreground">
      Page {Math.floor(offset / LIMIT) + 1} of {Math.ceil(total / LIMIT)}
    </span>
    <Button
      variant="outline"
      size="sm"
      disabled={offset + LIMIT >= total}
      onClick={() => setOffset(offset + LIMIT)}
    >
      Next
    </Button>
  </div>
)}
```

**Verify:** `cd frontend && bun test && bun run lint`

---

### Task D6: Statements proper empty state

- [ ] **Complete**

**Files:**
- Modify: `frontend/src/app/(dashboard)/statements/page.tsx:250`

**What:** Empty state is a plain text `<p>` instead of the Card+icon+CTA pattern used everywhere else.

**Implementation:** Replace the `<p>` at line 250 with:

```tsx
<Card className="border-dashed">
  <CardContent className="py-12 text-center space-y-3">
    <Receipt className="h-12 w-12 mx-auto text-muted-foreground" />
    <p className="text-lg font-medium">No statements yet</p>
    <p className="text-sm text-muted-foreground max-w-sm mx-auto">
      Add a statement to track credit card payments and due dates
    </p>
    <Button size="sm" onClick={() => setSheetOpen(true)}>
      <Plus className="h-4 w-4 mr-1" />
      Add Statement
    </Button>
  </CardContent>
</Card>
```

Ensure `Receipt`, `Plus`, `Card`, `CardContent`, `Button` are imported (most should be already).

**Verify:** `cd frontend && bun run lint`

---

### Task D7: Documents page loading/error state + Link fix

- [ ] **Complete**

**Files:**
- Modify: `frontend/src/app/(dashboard)/documents/page.tsx:148,195`

**What:** No loading skeleton, no error state, and `window.location.href` instead of router navigation.

**Implementation:**

1. Add loading/error state:

```tsx
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

// Wrap loadData with try/catch/finally:
async function loadData() {
  setLoading(true);
  setError(null);
  try {
    const [d, a, c] = await Promise.all([/* existing fetches */]);
    // ... existing state setters
  } catch {
    setError("Failed to load documents.");
  } finally {
    setLoading(false);
  }
}
```

2. Render loading skeletons when `loading`:

```tsx
{loading ? (
  <div className="space-y-2">
    {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
  </div>
) : error ? (
  <p className="text-sm text-destructive">{error}</p>
) : /* existing render logic */}
```

3. Replace `window.location.href = "/scan"` with:

```tsx
import Link from "next/link";
// Replace the Button onClick at line 148:
<Button variant="outline" asChild>
  <Link href="/scan">+ Upload</Link>
</Button>
```

**Verify:** `cd frontend && bun test && bun run lint`

---

### Task D8: Add SheetDescription to all sheets

- [ ] **Complete**

**Files:**
- Modify: All pages with `<SheetHeader>` that lack `<SheetDescription>`

**What:** radix-ui expects `SheetDescription` for `aria-describedby`. Missing in all edit/create sheets.

**Implementation:** In each sheet, add `SheetDescription` after `SheetTitle`:

```tsx
import { SheetDescription } from "@/components/ui/sheet";

<SheetHeader>
  <SheetTitle>Edit Transaction</SheetTitle>
  <SheetDescription>Update the transaction details below.</SheetDescription>
</SheetHeader>
```

Apply to: transactions, budgets, statements, recurring, documents, cards pages.

**Verify:** `cd frontend && bun run lint`

---

## Phase E: Performance & Resilience

_Priority: medium-low. These fix architectural anti-patterns. E1 is the highest-impact change._

---

### Task E1: Move check_budget_alerts to Celery task

- [ ] **Complete**

**Files:**
- Modify: `api/app/routers/transactions.py:67,91`
- Modify: `api/app/services/budget_alerts.py`
- Modify: `api/app/tasks/__init__.py` (or wherever Celery tasks are defined)

**What:** `check_budget_alerts` runs synchronously in the request path — N queries + Discord HTTP + Web Push. Transaction create latency is unbounded.

**Implementation:**

1. Create a Celery task wrapper:

```python
# api/app/tasks/__init__.py — add task
@celery.task(name="check-budget-alerts")
def check_budget_alerts_task(user_id: str) -> None:
    import asyncio
    from app.services.budget_alerts import check_budget_alerts
    from app.core.database import AsyncSessionLocal

    async def _run():
        async with AsyncSessionLocal() as db:
            await check_budget_alerts(db, user_id)

    asyncio.run(_run())
```

2. Replace inline calls in transactions router:

```python
# api/app/routers/transactions.py
# Line 67 — replace:
#   await check_budget_alerts(db, current_user.id)
# With:
    from app.tasks import check_budget_alerts_task
    check_budget_alerts_task.delay(str(current_user.id))

# Line 91 — same replacement
```

**Verify:** `cd api && uv run pytest tests/ -v` — budget alert tests may need adjustment since they previously tested the inline path. If tests check for notification creation after transaction create, they may need to call the task synchronously in the test or mock the `.delay()`.

---

### Task E2: Fix N+1 budget status query

- [ ] **Complete**

**Files:**
- Modify: `api/app/routers/budgets.py:56-72`
- Modify: `api/app/services/budget_alerts.py` (optional — refactor get_month_spending)

**What:** Each budget triggers a separate `get_month_spending` query. 10 budgets = 10 round-trips.

**Implementation:** Replace the per-budget loop with a single aggregate query:

```python
# api/app/routers/budgets.py — replace lines 56-72
# Fetch all expense spending grouped by category and account in one query:
from sqlalchemy import func as sa_func

month_start = today.replace(day=1)
spending_result = await db.execute(
    select(
        Transaction.category_id,
        Transaction.account_id,
        sa_func.sum(Transaction.amount).label("spent"),
    )
    .where(
        Transaction.user_id == current_user.id,
        Transaction.type == TransactionType.expense,
        Transaction.date >= month_start,
    )
    .group_by(Transaction.category_id, Transaction.account_id)
)
spending_map = {}
for row in spending_result.all():
    spending_map[(str(row.category_id), str(row.account_id))] = float(row.spent)

# Then compute per-budget:
items = []
for budget in budgets:
    if budget.type == "category":
        spent = spending_map.get((str(budget.category_id), None), 0) or sum(
            v for (cat, _), v in spending_map.items() if cat == str(budget.category_id)
        )
    else:
        spent = sum(
            v for (_, acc), v in spending_map.items() if acc == str(budget.account_id)
        )
    pct = (spent / float(budget.amount) * 100) if budget.amount else 0
    status = "exceeded" if pct >= 100 else "warning" if pct >= 80 else "on_track"
    items.append({"budget": budget, "spent": round(spent, 2), "percentage": round(pct, 1), "status": status})
```

**Verify:** `cd api && uv run pytest tests/test_budgets.py -v` — budget status tests pass with same results.

---

### Task E3: Add SSE heartbeat

- [ ] **Complete**

**Files:**
- Modify: `api/app/routers/notifications.py:57-84`

**What:** SSE stream has no keepalive. Reverse proxies kill idle connections after 60s.

**Implementation:** Add an `asyncio.wait_for` with timeout in the SSE loop:

```python
# In the SSE generator, add a heartbeat every 30 seconds:
import asyncio

async def event_generator():
    # ... existing setup
    try:
        while True:
            try:
                message = await asyncio.wait_for(
                    pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0),
                    timeout=30.0,
                )
            except asyncio.TimeoutError:
                yield ": keepalive\n\n"
                continue

            if message and message["type"] == "message":
                yield f"data: {message['data'].decode()}\n\n"
    finally:
        await pubsub.unsubscribe(channel)
```

**Verify:** `cd api && uv run pytest tests/test_notifications.py -v`

---

### Task E4: Add global exception handler

- [ ] **Complete**

**Files:**
- Modify: `api/app/main.py`

**What:** Unhandled exceptions (e.g., IntegrityError from account delete) return raw 500 with stack trace.

**Implementation:**

```python
# api/app/main.py — add after app creation
from sqlalchemy.exc import IntegrityError
import structlog

logger = structlog.get_logger()

@app.exception_handler(IntegrityError)
async def integrity_error_handler(request, exc):
    logger.warning("integrity_error", detail=str(exc.orig))
    return JSONResponse(
        status_code=409,
        content={"detail": "Operation conflicts with existing data. Check related records."},
    )

@app.exception_handler(Exception)
async def generic_exception_handler(request, exc):
    logger.error("unhandled_exception", detail=str(exc), exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )
```

Add `from starlette.responses import JSONResponse` to imports if not already present.

**Verify:** `cd api && uv run pytest tests/ -v`

---

## Summary

| Phase | Tasks | Parallelizable | Estimated Effort |
|-------|-------|----------------|------------------|
| **A: Security** | A1-A9 | All 9 in parallel | ~2 hours |
| **B: Data Integrity** | B1-B4 | B1-B3 parallel, B4 independent | ~1 hour |
| **C: AI/DevOps** | C1-C7 | All 7 in parallel | ~1.5 hours |
| **D: Frontend UX** | D1-D8 | All 8 in parallel | ~2 hours |
| **E: Performance** | E1-E4 | E1-E3 parallel, E4 independent | ~1.5 hours |
| **Total** | **32 tasks** | | **~8 hours** |

**Execution order:** A → B → C + D (parallel) → E

**After each task:** The executing agent MUST update this file to check the box `- [x]` for the completed task.
