# Credit Line Management — Design

**Date:** 2026-02-24
**Status:** Approved

## Problem

The current credit card model has three gaps:

1. **No shared credit limit concept.** Some cards (e.g. BPI Amore Cashback + BPI Rewards Blue) draw from a single credit facility. There is no way to model this — each card has its own independent `credit_limit`.
2. **No Available Credit visibility.** The UI shows a card's total credit limit but not how much is currently available. Available credit = total limit − current balance, and should be auto-computed from linked account balances.
3. **No edit or delete on the frontend.** The API already supports `PATCH` and `DELETE` on `/credit-cards` but the `/cards` page has no way to invoke them.

## Solution

Introduce a **Credit Line** entity. One credit line can back one or many credit cards. Cards without a credit line are standalone and keep their own individual limit.

---

## Data Model

### New table: `credit_lines`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID (uuidv7) | PK |
| `user_id` | UUID FK → users | cascade delete |
| `name` | VARCHAR(255) | e.g. "BPI Credit Line" |
| `total_limit` | NUMERIC(15,2) nullable | total credit pool |
| `available_override` | NUMERIC(15,2) nullable | manual override for available credit |
| `created_at` | TIMESTAMPTZ | server default |
| `updated_at` | TIMESTAMPTZ | server default, onupdate |

### Modified table: `credit_cards`

| Column | Change | Notes |
|---|---|---|
| `credit_line_id` | ADD nullable FK → credit_lines | null = standalone card |
| `card_name` | ADD VARCHAR(255) nullable | e.g. "Amore Cashback", "Gold" |
| `available_override` | ADD NUMERIC(15,2) nullable | manual override for standalone cards |
| `credit_limit` | unchanged | used only when `credit_line_id` is null |

### Available credit logic

- **Credit line card:** `line.total_limit − sum(|account.balance| for all cards in this line)` — overridden by `line.available_override` if set
- **Standalone card:** `card.credit_limit − |account.balance|` — overridden by `card.available_override` if set

### Your cards modelled

```
credit_lines:
  "BPI Credit Line"  total_limit=50000

credit_cards:
  BPI "Amore Cashback" ···xxxx  credit_line_id=BPI  credit_limit=null
  BPI "Rewards Blue"   ···xxxx  credit_line_id=BPI  credit_limit=null
  RCBC "Gold"          ···xxxx  credit_line_id=null  credit_limit=30000
```

---

## API

### New: `/credit-lines`

| Method | Path | Description |
|---|---|---|
| GET | `/credit-lines` | List user's credit lines with computed `available_credit` and nested `cards` |
| POST | `/credit-lines` | Create credit line |
| PATCH | `/credit-lines/{id}` | Update name, total_limit, available_override |
| DELETE | `/credit-lines/{id}` | Detach all linked cards (set credit_line_id=null), then delete line |

### `CreditLineResponse`

```python
class CreditLineResponse(BaseModel):
    id: UUID
    name: str
    total_limit: Decimal | None
    available_override: Decimal | None
    available_credit: Decimal | None   # computed
    cards: list[CreditCardSummary]     # cards belonging to this line
```

### Updated: `/credit-cards`

- `POST` and `PATCH` accept: `card_name`, `credit_line_id`, `available_override`
- When `credit_line_id` is set, `credit_limit` on the card is stored as null
- `DELETE /credit-cards/{id}` — already implemented in API, needs frontend wiring
- `CreditCardResponse` gains: `credit_line_id`, `card_name`, `available_credit`, `available_override`

---

## Frontend — `/cards` page

### Layout

Cards are grouped into two visual sections:

```
── BPI Credit Line ────────────────────────────────
  Total: ₱50,000   Available: ₱44,200   [⋯]
  ┌──────────────────┐  ┌──────────────────┐
  │ Amore Cashback   │  │ Rewards Blue     │
  │ BPI ···1234      │  │ BPI ···5678      │
  │ Due: Mar 3 · 5d  │  │ Due: Mar 3 · 5d  │
  │               [⋯]│  │               [⋯]│
  └──────────────────┘  └──────────────────┘

── Standalone ─────────────────────────────────────
  ┌────────────────────────────────────────┐
  │ RCBC Gold ···9012                      │
  │ Total: ₱30,000   Available: ₱27,500   │
  │ Due: Mar 5 · 7d                     [⋯]│
  └────────────────────────────────────────┘
```

### Add Card form changes

- **Card Name** — new optional text field ("Amore Cashback", "Gold", etc.)
- **Credit Line** — new dropdown: existing lines + "Create new credit line" + "None (standalone)"
- **Credit Limit** — hidden when a credit line is selected; shown for standalone cards

### Edit / Delete

- `⋯` (three-dot) dropdown menu on each card → **Edit** / **Delete**
- `⋯` on each credit line header → **Edit line** / **Delete line**
- Delete card: confirmation dialog — *"Remove this card? Your transactions are not affected."*
- Delete credit line: confirmation dialog — *"Delete this credit line? Cards will become standalone."*
- Edit card/line: same sheet form pre-filled with current values

### Available credit display

- Credit line cards: total and available shown on the **line header**, not per card (it's shared)
- Standalone cards: total and available shown on the card itself
- Manual override active: show a `manual` badge next to the available figure

---

## Migrations

1. Create `credit_lines` table (new migration)
2. Add `credit_line_id`, `card_name`, `available_override` to `credit_cards` (new migration)

Two separate migrations to keep rollback clean.

---

## What Does Not Change

- `accounts` table — unchanged
- Transaction recording — unchanged
- Statement/billing cycle logic — unchanged
- All other pages — unchanged
