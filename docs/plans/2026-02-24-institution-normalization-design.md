# Institution Normalization Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to create the implementation plan from this design.

**Goal:** Normalize financial institutions as a first-class entity, removing `bank_name` from credit cards, linking accounts and credit lines to institutions, and laying the groundwork for a future loans feature.

**Architecture:** Introduce an `institutions` table that all financial entities (accounts, credit lines, loans) reference. Each institution has a type that reflects its real-world category. Loans get their own table linked to institutions. All existing `bank_name` fields on credit cards are removed — the bank is always derived through the institution hierarchy.

**Tech Stack:** PostgreSQL + SQLAlchemy async (API), Alembic (migrations), FastAPI + Pydantic v2, Next.js 16 + shadcn/ui + Tailwind v4.

---

## Data Hierarchy

```
User
└── Institutions  (BPI, GCash, PAGIBIG, Axeia)
    │   type: traditional | digital | government | in_house
    │
    ├── Accounts  (deposit/wallet balances)
    │   type: savings | checking | wallet | credit_card | cash
    │   └── Transactions
    │
    ├── Credit Lines  (shared credit facility)
    │   └── Credit Cards  (card products under the line)
    │       └── Account  (type=credit_card — the CC ledger)
    │           ├── Transactions
    │           └── Statements
    │
    └── Loans  (term loans — future feature, schema defined now)
        └── Account  (type=loan — the loan ledger)
            └── Transactions  (monthly payments)

Standalone Credit Card (no credit line):
  Institution → Credit Card → Account(credit_card)

Cash (no institution):
  User → Account(type=cash, institution_id=null)
```

**Real examples:**
```
BPI [traditional]
├── BPI Savings ···1234           account(type=savings)
├── BPI Savings Passbook ···5678  account(type=savings)
└── BPI Credit Line ₱378K
    ├── Rewards Blue ···6037      account(type=credit_card)
    └── Gold JCB ···0007          account(type=credit_card)

GCash [digital]
├── GCash Wallet                  account(type=wallet)
└── GCredit Line ₱10K
    └── GCredit ···3456           account(type=credit_card)

Maya [digital]
├── Maya Wallet                   account(type=wallet)
└── Maya Credit ···5678           standalone credit card → account(type=credit_card)

PAGIBIG [government]
└── Housing Loan                  loan(type=housing) → account(type=loan)

Axeia Housing Development [in_house]
└── DP Installment Loan           loan(type=housing) → account(type=loan)
    status: transferred (after 24 months → PAGIBIG takes over)

Cash [no institution]
└── Cash Wallet                   account(type=cash)
```

---

## Table Structures

### New: `institutions`
```sql
id              UUID  PK  (uuidv7)
user_id         UUID  FK → users  ON DELETE CASCADE
name            VARCHAR(255)  NOT NULL    -- "BPI", "GCash", "PAGIBIG"
type            ENUM(traditional, digital, government, in_house)  NOT NULL
color           VARCHAR(7)  NULL          -- "#e63c2f" — optional UI hex color
created_at      TIMESTAMPTZ
updated_at      TIMESTAMPTZ
```

### Updated: `accounts`
```sql
-- ADD
institution_id  UUID  FK → institutions  ON DELETE SET NULL  NULLABLE

-- UPDATE type enum
type  ENUM(savings, checking, wallet, credit_card, loan, cash)
      -- replaces: bank, credit_card, digital_wallet, cash
```

Mapping from old → new enum values:
| Old | New |
|-----|-----|
| `bank` | `savings` (default; existing records assumed savings) |
| `digital_wallet` | `wallet` |
| `credit_card` | `credit_card` (unchanged) |
| `cash` | `cash` (unchanged) |

> `checking` and `loan` are new values with no existing data to migrate.

### Updated: `credit_lines`
```sql
-- ADD
institution_id  UUID  FK → institutions  ON DELETE SET NULL  NULLABLE
```

### Updated: `credit_cards`
```sql
-- REMOVE
bank_name  VARCHAR(255)   -- DROPPED entirely

-- card_name migration for existing in-line cards:
-- WHERE credit_line_id IS NOT NULL AND card_name IS NULL:
--   SET card_name = bank_name  (product name was stored in bank_name by mistake)
```

### New: `loans` *(schema defined now, UI is a future sprint)*
```sql
id                  UUID  PK  (uuidv7)
user_id             UUID  FK → users  ON DELETE CASCADE
institution_id      UUID  FK → institutions  ON DELETE SET NULL  NULLABLE
account_id          UUID  FK → accounts  ON DELETE CASCADE
name                VARCHAR(255)  NOT NULL    -- "PAGIBIG Housing Loan"
type                ENUM(auto, housing, personal, education, other)  NOT NULL
original_principal  DECIMAL(15,2)  NOT NULL
interest_rate       DECIMAL(7,4)  NULL        -- 0.0650 = 6.5% annual
term_months         INTEGER  NULL
monthly_amortization DECIMAL(15,2)  NULL
start_date          DATE  NOT NULL
end_date            DATE  NULL                -- computed or set on payoff/transfer
status              ENUM(active, paid_off, transferred)  NOT NULL  DEFAULT 'active'
created_at          TIMESTAMPTZ
updated_at          TIMESTAMPTZ
```

---

## Transaction Fee Model

Fees (e.g. bank counter transfer fee) are **always a separate expense transaction**:

```
Main payment:    BPI Savings → Axeia loan account   (₱X loan payment)
Fee (if any):    Cash Wallet → expense (Bank Fees)  (₱Y counter fee — separate tx)
```

The payment channel (e.g. "walked into Security Bank to deposit") is recorded as a note/description on the transaction. It is not a data field.

---

## API Changes

### New endpoints
```
GET    /institutions          list all institutions for user
POST   /institutions          create institution
PATCH  /institutions/:id      update name, type, color
DELETE /institutions/:id      delete (blocked if any account/credit_line/loan references it)

GET    /loans                 list loans (future sprint — schema only now)
POST   /loans                 (future)
PATCH  /loans/:id             (future)
```

### Updated endpoints
```
GET/POST/PATCH  /accounts         add institution_id to request/response
GET/POST/PATCH  /credit-lines     add institution_id to request/response
GET/POST/PATCH  /credit-cards     remove bank_name from all request/response schemas
```

### New computed field on responses
`institution` (nested object: `{id, name, type, color}`) on:
- `AccountResponse`
- `CreditLineResponse`
- `CreditCardResponse` (derived: from credit_line.institution or account.institution)

---

## UI — Page by Page

### New page: `/institutions`
- List all institutions, badged by type
- Add institution: name + type + optional color
- Edit: same fields
- Delete: blocked with error message if referenced by any account/credit line/loan

### Updated: `/accounts`
- Each account card shows institution badge (name, color dot)
- Accounts list sorted/grouped by institution
- "Add Account" sheet: institution picker appears first (skipped for `cash` type)
- `accounts.type` selector updated to new enum values: Savings, Checking, Wallet, Credit Card, Cash
- Credit card accounts show linked card info: "Rewards Blue ···6037"

### Updated: `/cards`
- "Add Credit Line" sheet: institution picker replaces free-text bank name
- Credit line header badge shows institution name (from `institution_id`)
- "Add Card" under a line: no bank field — institution inherited from line
- "Edit Card" (in-line): no bank field
- Standalone card institution: derived from `card.account.institution_id` — shown read-only

### Updated: `/statements`
- Card selector in "Add Statement": shows institution name + card name
- Statement group header: shows institution badge alongside card identity

### Updated: `/transactions` (new account picker)
- Account picker shows institution name as prefix: "BPI — Savings ···1234"
- Institution filter option in transaction list

### New page: `/loans` *(future sprint)*
- List active/completed loans with institution badge, remaining balance, monthly payment
- Add loan: institution + type + principal/rate/term
- Mark payment → creates transaction against loan account
- Loan transfer: mark as `transferred`, create successor loan at new institution

---

## Migration Plan

1. Create `institutions` table
2. Add `institution_id` (nullable) to `accounts` and `credit_lines`
3. Rename `accounts.type` enum values (`bank`→`savings`, `digital_wallet`→`wallet`)
4. For in-line credit cards where `card_name IS NULL`: `SET card_name = bank_name`
5. Drop `credit_cards.bank_name` column
6. Create `loans` table (schema only — no data migration needed)

> Existing `institution_id` fields default to NULL after migration. Users populate institutions through the new `/institutions` page and then assign them to existing accounts/credit lines via edit forms.

---

## Out of Scope (future sprints)

- Loans UI (`/loans` page — schema is defined but no routes or frontend)
- Interest/amortization schedule computation
- Bank logos / official color presets
- Multi-currency per institution
