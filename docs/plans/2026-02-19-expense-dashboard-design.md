# Personal Finance Dashboard — Design Document

**Date:** 2026-02-19
**Status:** Approved

---

## Overview

A self-hosted personal finance tracker for two users (owner + partner), deployed on a baremetal Kubernetes homelab. Tracks income, expenses, and transfers across bank accounts, credit cards, and digital wallets (GCash, Maya, etc.). Smart input via receipt photo capture, credit card PDF statement upload, and AI-assisted extraction using a prompt-first approach.

Currency: Philippine Peso (₱). Not multi-currency for now.

---

## Architecture

### Services

| Service | Technology | Purpose |
|---|---|---|
| `api` | FastAPI 0.129 (Python 3.14) | REST API, file handling, auth |
| `worker` | Celery 5.6.2 (same codebase as api) | Async jobs: PDF parsing, notifications, scheduled reminders |
| `frontend` | Next.js 16.1.6 (TypeScript) | PWA web app, mobile-friendly |
| `postgres` | PostgreSQL 18.2 | Primary database |
| `redis` | Redis 8.4.1 | Celery broker + result backend |

`api` and `worker` share one Python codebase and one Docker image. Entrypoint is overridden per deployment (`uvicorn` vs `celery worker`).

### Flow

```
Browser / Phone
    → frontend (Next.js PWA)
    → api (FastAPI) ──→ postgres
                   ──→ redis (enqueue job)
                            → worker (Celery)
                                → PyMuPDF (PDF decrypt + extract)
                                → Gemini API / Claude API / manual paste
                                → postgres (write results)
                                → Discord webhook / push notification
```

### File Storage

Receipts and PDFs stored in a shared volume mounted by both `api` (write on upload) and `worker` (read for processing). Local path: `/app/uploads/`.

### AI / LLM Strategy (Prompt-First)

The app owns the extraction prompt — optimized for Philippine receipts, credit card statements, and peso amounts. The model that processes it is user-configurable.

| Priority | Mode | Requires |
|---|---|---|
| 1 | Manual paste | Nothing — always available. App shows prompt + "Copy" button. User pastes response from Gemini Pro web or Claude Max web. |
| 2 | Gemini Flash API | Gemini API key in settings (free tier sufficient) |
| 3 | Claude API | Anthropic API key in settings (separate from Claude Max subscription) |
| 4 | Ollama | Deferred to Phase 6 — fully local, zero cloud |

`Document.source_model` records which model processed each document (`manual_paste`, `gemini`, `claude`, `ollama`).

### Local Development

Docker Compose runs all 5 services. Ollama pointed to `host.docker.internal:11434` (user's local Ollama instance). Hot reload enabled for `api` and `frontend`.

### Homelab Kubernetes (Production)

- Namespace: `expense-tracker`
- `api`, `worker`, `frontend` as Deployments
- `postgres` as StatefulSet with PersistentVolumeClaim
- `redis` as Deployment
- Kustomize: `k8s/base/` + `k8s/overlays/{dev,prod}/`
- Ingress (existing Nginx or Traefik) routes external traffic
- Secrets: DB credentials, Redis password, Discord webhook URL, Gemini API key, Claude API key

---

## Data Models

All primary keys use PostgreSQL 18's native `uuidv7()` — time-ordered, no index fragmentation.

### User
```
id, email, name, password_hash, avatar, created_at
```
Separate accounts per household member. Each transaction records `created_by` (which user logged it).

### Account
```
id, user_id, name, type, balance, currency, is_active, created_at
```
`type` enum: `bank | credit_card | digital_wallet | cash`

Digital wallets (GCash, Maya, ShopeePay, GrabPay) are accounts with `type = digital_wallet`. Balances updated manually — no bank API integration.

### CreditCard
```
id, user_id, account_id, bank_name, last_four, credit_limit,
statement_day, due_day, created_at
```
`statement_day` and `due_day` (day-of-month integers) are sufficient to compute the current statement period and next due date for any card. No `grace_period_days` — derived from these two values.

### Statement
```
id, credit_card_id, period_start, period_end, due_date,
total_amount, minimum_due, is_paid, paid_at, document_id
```
Created when a credit card PDF is uploaded. Links to the source document and groups all transactions from that billing cycle.

### Transaction
```
id, user_id, account_id, category_id, amount, description,
type, sub_type, date, source, document_id, to_account_id,
created_by, created_at
```

`type` enum: `income | expense | transfer`

`sub_type` enum:
- Income: `salary | 13th_month | bonus | overtime | freelance | business | consulting | rental | interest | dividends | capital_gains | sss_benefit | philhealth_reimbursement | pagibig_dividend | government_aid | remittance_received | gift_received | tax_refund | sale_of_items | refund_cashback | other_income`
- Expense: `regular | gift_given | bill_payment | subscription | other_expense`
- Transfer: `own_account | sent_to_person`

`source` enum: `manual | paste_ai | pdf | import`

`to_account_id`: nullable FK to Account — set only for `type = transfer, sub_type = own_account`. Null for external transfers (sent to another person).

`document_id`: nullable FK to Document — links a transaction to the receipt/statement that generated it.

### Document
```
id, user_id, filename, file_path, document_type,
status, celery_task_id, source_model, extracted_data (JSONB),
error_message, created_at
```
`document_type`: `receipt | cc_statement | other`
`status`: `pending | processing | done | failed`
`extracted_data`: raw LLM output before user confirmation — inspectable for debugging bad extractions.
`celery_task_id`: trace live job status from the frontend.

### Category
```
id, name, icon, color, is_system, created_at
```
System categories are seeded on first run (see category list below). Users can add custom categories.

### Notification
```
id, user_id, type, title, body, is_read, sent_at, created_at
```
`type` enum: `discord | push | in_app`

---

## Category Seed Data

### Income Categories
- Employment: Salary, 13th Month Pay, Bonus / Incentive, Overtime Pay
- Self-Employment: Freelance / Project, Business Revenue, Consulting / Professional Fees
- Passive: Rental Income, Interest Income, Dividends, Capital Gains
- Government: SSS Benefit, PhilHealth Reimbursement, Pag-IBIG Dividend, Government Aid / Ayuda
- Other: Remittance Received, Gift / Cash Gift, Tax Refund, Sale of Items, Refund / Cashback, Other Income

### Expense Categories
- Food: Groceries, Dining Out, Food Delivery, Coffee & Drinks, Snacks
- Housing & Utilities: Rent / Amortization, Electricity (Meralco), Water, Internet / Broadband, Mobile / Postpaid, Gas / LPG, Home Supplies, Home Maintenance, Condo / HOA Dues
- Transportation: Public Transit, Ride-Hailing (Grab), Fuel / Gas, Toll Fees, Vehicle Maintenance, Parking
- Healthcare: Medicine / Pharmacy, Doctor / Clinic, Hospital / Procedure, Health Insurance / HMO, Gym / Fitness, Wellness / Self-Care
- Financial Obligations: Credit Card Interest & Fees, Loan Interest, SSS Contribution, PhilHealth Contribution, Pag-IBIG Contribution, Tax Payment
- Insurance: Life Insurance Premium, Non-Life Insurance
- Education: Tuition / School Fees, School Supplies, Training / Online Course, Dependent Allowance
- Subscriptions & Digital: Streaming, Software / Cloud, Gaming
- Shopping & Lifestyle: Clothing & Apparel, Gadgets & Electronics, Online Shopping, Personal Care / Beauty
- Family & Social: Family Support / Allowance, Gift / Pasalubong, Celebrations, Charitable Giving
- Travel & Leisure: Accommodation, Airfare / Long-Distance, Tourist Activities
- Miscellaneous: Bank / Transaction Fees, Government Fees, Pet Care, Other / Miscellaneous

### Transfer Categories (excluded from spending reports)
- Own Accounts: Bank to Bank, Bank to E-Wallet, E-Wallet to Bank, To Savings / Investment
- Sending to Others: GCash / Maya Send, Bank Transfer to Person, Remittance Sent
- Settlements: Credit Card Payment, Loan Principal Payment

---

## Features by Phase

### Phase 1 — Core
- User auth: register, login, JWT access + refresh tokens
- Account management (bank, digital wallet, cash)
- Credit card setup (statement day, due day)
- Manual transaction entry (expense, income, transfer) with full type/sub_type/category
- Category management (system categories seeded, user can add custom)
- Dashboard: monthly income vs expense, net, recent transactions, upcoming due dates
- One-time Notion CSV import via `scripts/import_notion.py`

### Phase 2 — Smart Input
- Receipt photo capture (mobile camera API) + file upload fallback
- Manual paste mode: app generates extraction prompt → user copies → uploads to Gemini Pro / Claude Max web → pastes response → app parses into draft transaction → user reviews + confirms
- PDF upload for credit card statements
  - Password input UI for encrypted PDFs (PyMuPDF decrypts; password never stored)
  - Text extracted → prompt generated → manual paste or auto API → Statement + draft transactions created
  - Manual entry fallback if extraction fails
- Document history with live job status (via `celery_task_id`)
- Credit card cycle view: current statement period, days until due, outstanding amount

### Phase 3 — Notifications & Reminders
- In-app notification center (bell icon, unread count badge)
- Discord webhook: bill due reminders (configurable days-before)
- PWA Web Push notifications (self-hosted, no third-party push service)
- Celery beat scheduler: daily job checks upcoming dues and fires reminders

### Phase 4 — Analytics
- Spending by category (bar/pie chart)
- Monthly income vs expense trend (line chart)
- Per-card statement history
- Net worth snapshot (sum of all account balances)

### Phase 5 — Auto OCR
- Gemini Flash API: automatic receipt/PDF processing without manual paste
- Claude API: fallback if Gemini quota exceeded or fails
- Settings page: API key management

### Phase 6 — Ollama (Optional)
- Fully local LLM processing, zero cloud dependency
- Added to LLM chain as primary if configured

---

## Project Structure

```
expense-tracker/
├── api/
│   ├── app/
│   │   ├── core/               # config.py, database.py, security.py, logging.py
│   │   ├── models/             # SQLAlchemy ORM (Mapped[T] style)
│   │   ├── schemas/            # Pydantic v2 request/response schemas
│   │   ├── routers/            # FastAPI route handlers
│   │   │   ├── auth.py
│   │   │   ├── transactions.py
│   │   │   ├── accounts.py
│   │   │   ├── credit_cards.py
│   │   │   ├── documents.py    # upload, paste, job status polling
│   │   │   └── notifications.py
│   │   ├── services/           # Business logic (no HTTP concerns)
│   │   │   ├── ocr.py          # prompt generation + response parsing
│   │   │   ├── pdf.py          # PyMuPDF decrypt + text extract
│   │   │   ├── credit_card.py  # statement period + due date computation
│   │   │   └── notifications.py
│   │   ├── tasks/              # Celery tasks
│   │   │   ├── celery.py       # Celery app instance
│   │   │   ├── documents.py    # process_document task
│   │   │   ├── notifications.py
│   │   │   └── schedule.py     # Celery beat config
│   │   └── main.py
│   ├── migrations/             # Alembic versions
│   ├── tests/
│   ├── Dockerfile              # single image; CMD overridden per deployment
│   ├── pyproject.toml          # managed with uv
│   └── alembic.ini
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── (auth)/         # login, register — no sidebar layout
│   │   │   └── (dashboard)/    # full app layout with sidebar
│   │   │       ├── page.tsx    # dashboard home
│   │   │       ├── transactions/
│   │   │       ├── scan/       # receipt photo + paste from AI
│   │   │       ├── cards/      # credit card management + cycle view
│   │   │       ├── documents/  # upload history + processing status
│   │   │       ├── notifications/
│   │   │       └── settings/   # profile, API keys
│   │   ├── components/
│   │   │   ├── ui/             # shadcn/ui (CLI 3.x, owned source)
│   │   │   └── app/            # application-specific components
│   │   ├── lib/
│   │   │   ├── api.ts          # typed fetch wrapper
│   │   │   └── utils.ts
│   │   └── hooks/
│   ├── public/
│   │   └── sw.js               # PWA service worker
│   ├── Dockerfile
│   └── package.json            # managed with pnpm
│
├── k8s/
│   ├── base/                   # Kustomize base manifests
│   │   ├── api/
│   │   ├── worker/
│   │   ├── frontend/
│   │   ├── postgres/           # StatefulSet + PVC
│   │   └── redis/
│   └── overlays/
│       ├── dev/
│       └── prod/
│
├── scripts/
│   └── import_notion.py        # one-time Notion CSV importer
│
├── data/                       # existing Notion export
├── docs/
│   └── plans/                  # design and implementation docs
├── docker-compose.yml          # local dev
├── .env.example
└── CLAUDE.md
```

---

## Tech Stack (Pinned Versions)

| Layer | Technology | Version |
|---|---|---|
| Frontend | Next.js | 16.1.6 |
| UI | Tailwind CSS | 4.1.18 |
| Components | shadcn/ui | CLI 3.x |
| Backend | Python | 3.14.3 |
| API | FastAPI | 0.129.0 |
| ORM | SQLAlchemy | 2.0.46 |
| Validation | Pydantic | 2.12.5 |
| Job Queue | Celery | 5.6.2 |
| Broker / Cache | Redis | 8.4.1 |
| Database | PostgreSQL | 18.2 |
| PDF Parsing | PyMuPDF | latest |
| Package (Python) | uv | latest |
| Package (Node) | pnpm | latest |

---

## Observability & Debugging

- Structured JSON logs via `structlog` (Python) and `pino` (Next.js) — compatible with Grafana Loki on k8s
- Correlation IDs propagated across api → worker via Celery task headers
- `Document.celery_task_id` queryable from frontend for live job status
- `Document.extracted_data` (JSONB) stores raw LLM output — inspectable when extraction goes wrong
- `Document.error_message` captures failure reason for failed jobs
- `Document.source_model` records which model processed each document
- Health check endpoints on `api` and `worker`
- Redis 8 AGPL license: fine for self-hosted personal use

---

## Key Design Decisions

1. **Credit card payment is a Transfer, not an Expense** — the expense was logged when you swiped. Recording the payment as an expense would double-count it.
2. **Loan repayment splits** — principal portion is a Transfer (reduces liability), interest portion is an Expense (Financial Obligations category).
3. **Manual paste is the primary smart input method** — leverages existing Gemini Pro + Claude Max web subscriptions at no extra cost. API automation is Phase 5.
4. **PDF password never stored** — passed in-memory to PyMuPDF, discarded after decryption.
5. **`uuidv7()` for all PKs** — PostgreSQL 18 native, time-ordered, better index locality than UUIDv4.
6. **Single Docker image for api + worker** — one codebase, one build, two process types.
