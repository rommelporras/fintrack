# FinTrack

A self-hosted personal finance tracker for two users (owner + partner), deployed on a baremetal Kubernetes homelab. Tracks income, expenses, and transfers across bank accounts, credit cards, and digital wallets (GCash, Maya, etc.).

Smart input via receipt photo capture, credit card PDF statement upload, and AI-assisted extraction. Currency: Philippine Peso (₱).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 + Tailwind CSS 4 + shadcn/ui |
| Backend | FastAPI 0.129 (Python 3.14) |
| ORM | SQLAlchemy 2.0 async |
| Job Queue | Celery 5.6 + Redis 8 |
| Database | PostgreSQL 18 |
| Package (Python) | uv |
| Package (Node) | bun |

---

## Project Structure

```
fintrack/
├── api/                    # FastAPI backend + Celery worker
│   ├── app/
│   │   ├── core/           # config, database, security
│   │   ├── models/         # SQLAlchemy ORM models
│   │   ├── schemas/        # Pydantic v2 schemas
│   │   ├── routers/        # FastAPI route handlers
│   │   ├── services/       # Business logic
│   │   └── tasks/          # Celery tasks + beat schedule
│   ├── migrations/         # Alembic versions
│   └── tests/
├── frontend/               # Next.js 16 app
│   └── src/app/
│       ├── (auth)/         # login, register
│       └── (dashboard)/    # main app layout
│           ├── page.tsx    # dashboard home
│           ├── transactions/
│           ├── accounts/
│           ├── cards/
│           ├── statements/
│           ├── budgets/
│           ├── documents/
│           ├── notifications/
│           ├── scan/
│           └── settings/
├── k8s/                    # Kustomize manifests (base + dev/prod overlays)
├── scripts/                # One-time utilities (Notion CSV import)
├── docs/plans/             # Design docs and implementation plans
├── docker-compose.yml      # Local development
└── .env.example
```

---

## Local Development

### Prerequisites

- Docker + Docker Compose
- [uv](https://docs.astral.sh/uv/) (Python package manager)
- [bun](https://bun.sh/) (Node package manager)

### Setup

```bash
# 1. Clone and copy env
cp .env.example .env

# 2. Start all services
docker compose up --build

# 3. Run migrations (first time only)
cd api
DATABASE_URL="postgresql+asyncpg://finance:changeme@127.0.0.1:5435/finance_db" \
  uv run alembic upgrade head
```

Services:

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| API | http://localhost:8000 |
| API docs | http://localhost:8000/docs |
| PostgreSQL | 127.0.0.1:5435 |
| Redis | 127.0.0.1:6379 |

> **WSL2 note:** Use `127.0.0.1` instead of `localhost` in `DATABASE_URL` when running alembic commands — asyncpg has intermittent DNS failures with `localhost` on WSL2.

---

## Running Tests

```bash
cd api
DATABASE_URL="postgresql+asyncpg://finance:changeme@127.0.0.1:5435/finance_db" \
TEST_DATABASE_URL="postgresql+asyncpg://finance:changeme@127.0.0.1:5435/finance_test" \
  uv run pytest -v
```

102 tests, all passing.

---

## Environment Variables

See `.env.example` for the full list. Key variables:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection (asyncpg) |
| `JWT_SECRET_KEY` | Generate with `openssl rand -hex 32` |
| `DISCORD_WEBHOOK_URL` | Optional — bill due reminders sent here |
| `GEMINI_API_KEY` | Optional — Phase 5 auto OCR |
| `CLAUDE_API_KEY` | Optional — Phase 5 auto OCR fallback |

---

## Features by Phase

| Phase | Status | Description |
|---|---|---|
| Phase 1 — Core | ✅ Done | Auth, accounts, credit cards, manual transactions, dashboard, Notion CSV import |
| Phase 2 — Smart Input | ✅ Done | Receipt/PDF upload, manual paste AI extraction, document history, Celery processing |
| Phase 3 — Notifications | ✅ Done | In-app notifications, SSE bell badge, budget alerts, statement due reminders, Discord webhook |
| Phase 4 — Analytics | 🔄 Planned | Spending by category chart, per-card statement history, net worth card |
| Phase 5 — Auto OCR | ⏳ Future | Gemini Flash + Claude API automatic extraction (no manual paste) |
| Phase 6 — Ollama | ⏳ Future | Fully local LLM processing |

---

## Key Design Decisions

- **Credit card payment is a Transfer, not an Expense** — the expense was already logged when you swiped. Recording the payment as an expense would double-count it.
- **Manual paste is the primary smart input** — leverages existing Gemini Pro + Claude Max subscriptions at no extra cost. API automation is Phase 5.
- **Single Docker image for api + worker** — same codebase, two process types via different `command` overrides.
- **`uuidv7()` for all primary keys** — PostgreSQL 18 native, time-ordered, better index locality than UUIDv4.
- **PDF password never stored** — passed in-memory to PyMuPDF, discarded after decryption.

---

## Kubernetes (Homelab)

Kustomize manifests in `k8s/`:

```bash
# Deploy to dev
kubectl apply -k k8s/overlays/dev

# Deploy to prod
kubectl apply -k k8s/overlays/prod
```

Namespace: `expense-tracker`. Postgres runs as a StatefulSet with a PersistentVolumeClaim.
