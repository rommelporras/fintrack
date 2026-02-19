# Phase 4: Analytics — Design Doc

**Date:** 2026-02-19
**Status:** Approved

---

## Overview

Phase 4 adds analytics to the app: a net worth snapshot on the dashboard and a dedicated `/analytics` page with two charts — spending by category and per-card statement history. No new database models or migrations needed; all data comes from SQL aggregations over existing tables.

---

## Approach: Hybrid

Dashboard gets one new card (net worth). A new `/analytics` page gets two charts. The existing dashboard summary cards (income/expense/net) are unchanged.

---

## Section 1 — Dashboard: Net Worth Card

**New endpoint:** `GET /dashboard/net-worth`

Returns the sum of all active accounts (`is_active = true`) broken down by account type.

```json
{
  "total": "142500.00",
  "by_type": [
    { "type": "bank", "total": "120000.00" },
    { "type": "digital_wallet", "total": "12500.00" },
    { "type": "cash", "total": "10000.00" }
  ]
}
```

**Frontend:** One new card below the existing 3-card row. Shows total net worth as a large ₱ number with sub-lines per type. Credit card accounts excluded (they represent debt, not assets — or optionally shown as negative).

---

## Section 2 — Analytics Page

**Route:** `/analytics`
**Sidebar:** "Analytics" nav item with `BarChart2` icon, placed after Budgets.

### Chart 1 — Spending by Category

**Endpoint:** `GET /analytics/spending-by-category?year=2026&month=2`

Returns expense totals grouped by category for the selected month. Transfers excluded.

```json
[
  { "category_id": "...", "category_name": "Groceries", "color": "#...", "total": "8500.00" },
  { "category_id": "...", "category_name": "Dining Out", "color": "#...", "total": "3200.00" }
]
```

**Frontend:**
- Month/year selector at the top of the page (defaults to current month)
- Recharts `PieChart` with labelled slices
- Legend below showing category name + ₱ total
- Empty state when no expenses for the month

### Chart 2 — Per-Card Statement History

**Endpoint:** `GET /analytics/statement-history`

Returns the last 6 statements per credit card, ordered by period.

```json
[
  {
    "card_label": "BDO •••• 1234",
    "statements": [
      { "period": "Jan 2026", "total": "15000.00" },
      { "period": "Feb 2026", "total": "22000.00" }
    ]
  }
]
```

**Frontend:**
- Recharts `BarChart` (grouped bars, one group per statement period)
- Each card gets its own color
- Empty state when no credit cards or no statements

---

## Section 3 — Tech

**Chart library:** Recharts (installed via `bun add recharts`)
**Shadcn chart component:** Added via `bunx shadcn add chart` — provides `ChartContainer`, `ChartTooltip`, `ChartTooltipContent` with CSS variable theming consistent with the rest of the UI.

---

## Section 4 — API Router

New file: `api/app/routers/analytics.py`
Registered in `api/app/main.py` with prefix `/analytics`.

Existing `api/app/routers/dashboard.py` gets one new endpoint: `GET /dashboard/net-worth`.

---

## Section 5 — Testing Strategy

All backend features use TDD. ~10 new API tests.

| Endpoint | Tests |
|---|---|
| `GET /dashboard/net-worth` | Empty accounts → ₱0; active/inactive mix → inactive excluded; multiple types grouped correctly |
| `GET /analytics/spending-by-category` | Empty month → []; expenses only (transfers excluded); multiple categories; cross-user isolation |
| `GET /analytics/statement-history` | No cards → []; single card with statements; multiple cards with last-6 limit |

No frontend unit tests for chart rendering. Manual smoke test with real data.
