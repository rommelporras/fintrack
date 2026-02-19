# Phase 3: Polish & Notifications — Design Doc

**Date:** 2026-02-19
**Status:** Approved

---

## Overview

Phase 3 completes the app's core usability: transaction edit/delete/filtering, statement management, budget tracking, and a real-time notification system (in-app SSE + Discord webhook).

---

## Section 1 — Transaction UI Improvements

Frontend-only. API already has PATCH, DELETE, and all filter params.

- **Edit** — Sheet slide-over on row click: pre-filled form, submits `PATCH /transactions/{id}`
- **Delete** — confirmation dialog within the slide-over, calls `DELETE /transactions/{id}`
- **Filters** — collapsible filter bar: date range, account dropdown, category dropdown (type already exists)
- **Display** — show account name and category name in each row (resolve from fetched lists)

---

## Section 2 — Statements

Model exists. Needs router + frontend page.

**API** (`api/app/routers/statements.py`):
- `GET /statements` — list, filter by `credit_card_id`, `is_paid`
- `POST /statements` — create
- `GET /statements/{id}` — fetch single
- `PATCH /statements/{id}` — update / mark paid

**Frontend** (`/statements` page):
- List grouped by credit card, period, due date, amount, paid/unpaid badge
- "Mark Paid" button per row
- "Add Statement" form
- Sidebar: "Statements" nav item between Credit Cards and Documents

---

## Section 3 — Budgets

New model + migration + API + frontend.

**Model:**
```
id, user_id, type (category|account), category_id (nullable FK),
account_id (nullable FK), amount (Decimal), created_at
```

**API** (`api/app/routers/budgets.py`):
- `GET /budgets` — list
- `POST /budgets` — create
- `PATCH /budgets/{id}` — update amount
- `DELETE /budgets/{id}` — remove
- `GET /budgets/status` — current month spent vs limit, returns status: ok|warning|exceeded

**Frontend** (`/budgets` page):
- Budget list with progress bars (green → amber at 80% → red at 100%)
- "Add Budget" form: type, category/account picker, amount
- Sidebar: "Budgets" nav item

---

## Section 4 — Notifications

New model + API (SSE) + Celery tasks + Discord webhook + frontend.

**Model:**
```
id, user_id, type (statement_due|budget_warning|budget_exceeded),
title, message, is_read (bool), metadata (JSONB), created_at
```

**API:**
- `GET /notifications` — list (unread first, limit 50)
- `PATCH /notifications/{id}/read` — mark single read
- `PATCH /notifications/read-all` — mark all read
- `GET /notifications/stream` — SSE stream

**Celery triggers:**
- Daily beat task: statements due in 7 or 1 day → notification + Discord
- Post-transaction hook: budget crosses 80% or 100% for first time this month → notification + Discord

**Discord:** uses `settings.discord_webhook_url`, silently skipped if unset.

**Frontend:**
- Bell icon in sidebar with unread count badge
- `/notifications` page: list with read/unread, "Mark all read"
- SSE connection streams new notifications live

---

## Testing Strategy

All backend features use TDD (failing test → implement → pass). Sample data:
- 1 test user with 2 accounts, 1 credit card, seeded categories
- Statement with due_date 6 days out (triggers 7-day alert)
- Budget at 79%, 81%, 101% spending (tests each threshold crossing)
- Discord webhook mocked via httpx mock / monkeypatch

Target: ~30 new API tests on top of 55 existing.
