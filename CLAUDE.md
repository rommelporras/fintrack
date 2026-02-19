# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Rules

- **NO AI attribution** in commits — do not include "Generated with Claude Code", "Co-Authored-By: Claude", or any AI-related attribution in commit messages, PR descriptions, or code comments.

- **NO automatic git commits or pushes** — never commit or push unless explicitly requested by the user or triggered via `/commit`. This applies to subagents too.

- **Dev Server Management** — the user runs dev servers in their own terminal. Do not run `docker compose up` or `uvicorn` in background tasks. Only inform the user what to run.

- **Conventional commits** — always use the `/commit` skill for commits. Types: `feat:`, `fix:`, `docs:`, `style:`, `refactor:`, `perf:`, `test:`, `chore:`, `infra:`.

- **Secrets gate (BLOCKING)** — before every commit, scan the diff for leaked credentials. Never commit `.env` files. Use placeholder values in examples.

---

## Project Overview

**fintrack** is a personal finance dashboard for tracking income, expenses, accounts, and credit card statements. Built as a monorepo with a FastAPI backend and Next.js frontend.

**Phase 1 (complete):** Core infrastructure — auth, all data models, CRUD API, dashboard frontend, K8s manifests.
**Phase 2 (next):** Smart Input — receipt scan via camera, PDF/image OCR, AI extraction, CC statement PDF parsing.

---

## Repository Structure

```
fintrack/
├── api/                    # FastAPI backend
│   ├── app/
│   │   ├── core/           # config, database, security, logging
│   │   ├── models/         # SQLAlchemy ORM models
│   │   ├── routers/        # FastAPI route handlers
│   │   ├── schemas/        # Pydantic request/response schemas
│   │   ├── services/       # Business logic (account balance, statement periods)
│   │   ├── tasks/          # Celery async tasks
│   │   └── main.py         # App entrypoint
│   ├── migrations/         # Alembic migrations
│   └── tests/              # pytest test suite
├── frontend/               # Next.js 16 App Router
│   └── src/
│       ├── app/            # Route groups: (auth)/, (dashboard)/
│       ├── components/     # Shared UI components (Sidebar, MobileSidebar)
│       ├── hooks/          # useAuth — login/register/logout
│       ├── lib/            # api.ts — dual-URL fetch client
│       └── middleware.ts   # Auth guard for protected routes
├── k8s/
│   ├── base/               # Kubernetes manifests (api, worker, frontend, postgres, redis)
│   └── overlays/           # Kustomize overlays: dev (hot-reload) and prod
├── scripts/                # One-time utility scripts (Notion CSV import)
└── docker-compose.yml      # Local dev environment
```

---

## Tech Stack

### Backend (api/)
- **Python 3.12** with FastAPI
- **SQLAlchemy 2.0** async ORM with asyncpg driver
- **PostgreSQL 16** (port 5435 in dev)
- **Redis 7** for Celery broker/backend
- **Alembic** for database migrations
- **JWT auth** — httpOnly cookies, no localStorage
- **Celery** with Asia/Manila timezone
- **structlog** for structured logging

### Frontend (frontend/)
- **Next.js 16** App Router, TypeScript, Tailwind v4
- **shadcn/ui** (Neutral theme) for components
- **TanStack Query** for server state
- **Lucide React** for icons
- **httpOnly cookies** — `credentials: "include"` on all fetch calls
- **pnpm** package manager

### Infrastructure
- **Docker Compose** for local dev
- **Kubernetes** with Kustomize (base + dev/prod overlays)

---

## Development

### Start local dev environment
```bash
docker compose up
```

### Backend
```bash
# Run tests
cd api && pytest

# Run a specific test file
cd api && pytest tests/test_transactions.py -v

# Create a migration
cd api && DATABASE_URL=postgresql+asyncpg://fintrack:fintrack@127.0.0.1:5435/fintrack \
  alembic revision --autogenerate -m "description"

# Apply migrations
cd api && DATABASE_URL=postgresql+asyncpg://fintrack:fintrack@127.0.0.1:5435/fintrack \
  alembic upgrade head
```

> **WSL2 note:** Use `127.0.0.1` not `localhost` for DATABASE_URL — asyncpg has intermittent DNS resolution failures with `localhost` in WSL2.

### Frontend
```bash
# Type check
cd frontend && pnpm tsc --noEmit

# Build
cd frontend && pnpm build
```

---

## Key Architecture Decisions

- **Computed balance** — account `current_balance` is calculated at query time from transactions, not stored. Prevents drift.
- **ATM fee tracking** — `fee_amount` + `fee_category_id` on Transaction. A ₱5,000 ATM withdrawal with ₱18 fee creates a ₱5,018 total deduction tracked separately.
- **httpOnly cookie auth** — access and refresh tokens stored in httpOnly cookies only. No JWT in localStorage.
- **Dual-URL API client** — SSR uses `API_URL` (internal `http://api:8000`), browser uses `NEXT_PUBLIC_API_URL` (public HTTPS).
- **Celery placeholder** — `process_document` task exists but is a no-op stub until Phase 2 OCR is implemented.

---

## Data Models

| Model | Key Fields |
|-------|-----------|
| User | email, password_hash, full_name |
| Account | name, type, currency, balance computed from transactions |
| CreditCard | bank_name, last_four, account_id (linked account), credit_limit, billing cycle |
| Category | name, group (income/expense/transfer), icon, is_system |
| Document | filename, file_path, mime_type, status (pending/processing/done/failed) |
| Statement | credit_card_id, document_id, period_start/end, due_date, total_amount |
| Transaction | amount, type (income/expense/transfer), sub_type, source, fee_amount, fee_category_id |

---

## Environment Variables

See `api/.env.example` for all required variables. Key ones:

```
DATABASE_URL=postgresql+asyncpg://fintrack:fintrack@postgres:5432/fintrack
REDIS_URL=redis://redis:6379/0
JWT_SECRET_KEY=<generate with: openssl rand -hex 32>
COOKIE_SECURE=true   # false in dev
APP_ENV=production   # or development
```
