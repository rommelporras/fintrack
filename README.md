# FinTrack

A self-hosted personal finance tracker built for two users (owner + partner), running on a baremetal Kubernetes homelab. Tracks income, expenses, and transfers across Philippine bank accounts, credit cards, GCash, Maya, and cash.

> **Currency:** Philippine Peso (₱) · **Users:** 2 (private, invite-only) · **Platform:** Self-hosted

---

## Features

| Area | Capability |
|---|---|
| **Accounts** | Bank, digital wallet (GCash/Maya), cash, credit card — current balance computed from transaction history |
| **Transactions** | Manual entry with 22+ sub-types (salary, 13th month, bills, ATM withdrawal, transfers, etc.) |
| **Credit Cards** | Statement periods auto-calculated from billing/due day; statement due tracking |
| **Budgets** | Per-category and per-account monthly limits with 80%/100% alerts |
| **Smart Input** | Upload receipt or PDF → copy AI prompt → paste response → review and import |
| **Notifications** | In-app bell with unread badge; budget warnings and statement due reminders; Discord webhook |
| **Analytics** | Spending-by-category pie chart; per-card statement history bar chart; net worth snapshot |
| **Dashboard** | Monthly income/expense summary, net worth breakdown, 10 most recent transactions |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 · Tailwind CSS 4 · shadcn/ui · Recharts |
| Backend | FastAPI 0.129 · Python 3.14 |
| ORM | SQLAlchemy 2.0 async |
| Job Queue | Celery 5.6 · Redis 8 |
| Database | PostgreSQL 18 (uuidv7 for all PKs) |
| Package (Python) | uv |
| Package (Node) | bun |
| Infrastructure | Docker Compose (dev) · Kustomize/Kubernetes (prod) |

---

## Project Structure

```
fintrack/
├── api/                    # FastAPI backend + Celery worker
│   ├── app/
│   │   ├── core/           # config, database, security, JWT
│   │   ├── models/         # SQLAlchemy ORM models
│   │   ├── schemas/        # Pydantic v2 request/response schemas
│   │   ├── routers/        # Route handlers (one file per domain)
│   │   ├── services/       # Business logic (balance, budget alerts, Discord)
│   │   └── tasks/          # Celery tasks + beat schedule
│   ├── migrations/         # Alembic versions + seed data
│   └── tests/              # 113 async API tests
├── frontend/               # Next.js 16 app (App Router)
│   └── src/
│       ├── app/
│       │   ├── (auth)/     # /login, /register
│       │   └── (dashboard)/ # all authenticated pages
│       ├── components/     # shared UI components
│       ├── hooks/          # useAuth
│       ├── lib/            # api client, utils
│       └── types/          # TypeScript interfaces
├── k8s/                    # Kustomize manifests (base + dev/prod overlays)
├── scripts/                # One-time utilities (Notion CSV import)
├── docs/
│   ├── plans/              # Design docs and implementation plans
│   ├── USER_GUIDE.md       # How to use the app
│   └── KNOWN_ISSUES.md     # Active bugs and UX debt
├── docker-compose.yml      # Local development
└── .env.example
```

---

## Getting Started (Local Development)

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) + Docker Compose v2
- [uv](https://docs.astral.sh/uv/) — Python package manager
- [bun](https://bun.sh/) — Node package manager

### Setup

```bash
# 1. Clone and configure environment
git clone <repo-url>
cd fintrack
cp .env.example .env
# Edit .env — set JWT_SECRET_KEY (see below)

# 2. Generate a secret key
openssl rand -hex 32
# Paste the output into JWT_SECRET_KEY in .env

# 3. Start all services
docker compose up --build

# 4. Run database migrations (first time only)
cd api
DATABASE_URL="postgresql+asyncpg://finance:changeme@127.0.0.1:5435/finance_db" \
  uv run alembic upgrade head
```

### Service URLs

| Service | URL | Notes |
|---|---|---|
| Frontend | http://localhost:3000 | Main app |
| API | http://localhost:8000 | REST API |
| API Docs | http://localhost:8000/docs | Swagger UI |
| PostgreSQL | 127.0.0.1:5435 | External port 5435 → internal 5432 |
| Redis | 127.0.0.1:6379 | Celery broker |

> **WSL2 note:** Use `127.0.0.1` instead of `localhost` in `DATABASE_URL` when running alembic or pytest — asyncpg has intermittent DNS failures with `localhost` on WSL2.

### First-time Setup in the App

1. Register your account at http://localhost:3000/register
2. Go to **Accounts** → create your bank accounts, GCash/Maya wallets, and cash envelope
3. Go to **Cards** → add your credit cards (each card requires a linked account)
4. Go to **Budgets** → set monthly spending limits per category
5. Start recording transactions manually or via the AI import flow

See [docs/USER_GUIDE.md](docs/USER_GUIDE.md) for the full walkthrough.

---

## Running Tests

```bash
cd api
DATABASE_URL="postgresql+asyncpg://finance:changeme@127.0.0.1:5435/finance_db" \
TEST_DATABASE_URL="postgresql+asyncpg://finance:changeme@127.0.0.1:5435/finance_test" \
  uv run pytest -v
```

**113 tests, all passing.** Tests use an isolated `finance_test` database that is created and torn down per session.

---

## Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL asyncpg connection string |
| `JWT_SECRET_KEY` | Yes | Generate: `openssl rand -hex 32` |
| `JWT_ALGORITHM` | No | Default: `HS256` |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | No | Default: `30` |
| `JWT_REFRESH_TOKEN_EXPIRE_DAYS` | No | Default: `7` |
| `REDIS_URL` | Yes | Celery broker — default: `redis://redis:6379/0` |
| `CORS_ORIGINS` | No | Comma-separated allowed origins |
| `COOKIE_DOMAIN` | No | Cookie domain (leave blank for localhost) |
| `DISCORD_WEBHOOK_URL` | No | Budget/bill reminders sent here |
| `GEMINI_API_KEY` | No | Reserved for Phase 5 auto-OCR |
| `CLAUDE_API_KEY` | No | Reserved for Phase 5 auto-OCR fallback |

---

## Roadmap

| Phase | Status | What was built |
|---|---|---|
| Phase 1 — Core | ✅ Done | Auth, accounts, credit cards, manual transactions, categories, budgets, dashboard |
| Phase 2 — Smart Input | ✅ Done | Receipt/PDF upload, AI prompt generation, manual paste + review workflow, document history |
| Phase 3 — Notifications | ✅ Done | In-app bell, SSE badge, budget 80%/100% alerts, statement due reminders, Discord webhook |
| Phase 4 — Analytics | ✅ Done | Spending-by-category pie chart, per-card statement history bar chart, net worth card |
| Phase 5 — Auto OCR | ⏳ Planned | Gemini Flash + Claude API automatic extraction (no manual paste) |
| Phase 6 — Ollama | ⏳ Future | Fully local LLM processing, no external API dependency |

See [docs/KNOWN_ISSUES.md](docs/KNOWN_ISSUES.md) for current bugs and UX improvements planned before Phase 5.

---

## Key Design Decisions

**Credit card payment is a Transfer, not an Expense.**
The expense was recorded when you swiped. Logging the payment as an expense would double-count it. `Transfer → own_account` moves money from your bank account to your credit card account without affecting your expense total.

**Manual paste is the primary smart input (Phase 2).**
Uses your existing Gemini Pro or Claude Max subscription at zero marginal cost. You take a photo, copy a prompt, paste the AI's JSON response. Phase 5 will automate this with the Gemini/Claude API.

**Single Docker image for API + worker.**
The `api` and `worker` services use the same image but different `command` overrides (`uvicorn` vs `celery`). One build, two process types.

**`uuidv7()` for all primary keys.**
PostgreSQL 18 native. Time-ordered — better B-tree index locality than UUIDv4, no hotspot on insert.

**PDF password never stored.**
Passed in-memory to PyMuPDF for decryption, discarded immediately. Never written to disk or database.

**No soft delete (by design).**
This is a private two-user app. Hard deletes are acceptable. Complexity of soft-delete (filtering `deleted_at IS NULL` everywhere, ghost records in analytics) is not worth it at this scale.

---

## Kubernetes (Homelab)

Kustomize manifests in `k8s/`. Namespace: `expense-tracker`.

```bash
# Deploy to dev
kubectl apply -k k8s/overlays/dev

# Deploy to prod
kubectl apply -k k8s/overlays/prod
```

PostgreSQL runs as a StatefulSet with a PersistentVolumeClaim. The API and worker share a single Deployment image with different command arguments.

---

## Known Limitations

This is a work-in-progress personal project, not production software. Current known issues:

- Session expiry redirects are not implemented — expired tokens cause silent empty states
- The Settings page profile save is non-functional (missing `PATCH /auth/me` endpoint)
- SSE notifications are one-shot (not a live push stream)
- No transaction text search
- No account edit/delete in the UI
- Mobile layout is incomplete

Full list with priorities: [docs/KNOWN_ISSUES.md](docs/KNOWN_ISSUES.md)

---

## License

Private. Not open source.
