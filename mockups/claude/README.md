# FinTrack — UI/UX Reference for Gemini

This folder contains static HTML mockups of the FinTrack personal finance web app.
Use these pages as a **visual and structural reference** before generating any new UI.
Do not guess — read this file first.

---

## What is FinTrack?

FinTrack is a **personal finance tracker** built for a single household (1–2 users).
It is deployed as a self-hosted web app. The primary currency is **PHP (Philippine Peso ₱)**.

### Core features
- Record income, expense, and transfer transactions
- Track account balances (savings, checking, cash)
- Budget management with alert thresholds (80% warning, 100% exceeded)
- Credit card tracking with statement periods and due dates
- Recurring transactions (auto-generated monthly)
- AI-assisted receipt scanning (upload image → copy prompt → paste AI response → confirm)
- Real-time budget alerts and statement due date notifications via SSE + push
- PWA support (installable, offline queue)

---

## Tech Stack (Real App)

| Layer | Technology |
|-------|-----------|
| Backend API | FastAPI (Python 3.14), SQLAlchemy async, PostgreSQL |
| Background tasks | Celery + Redis |
| Frontend | Next.js 16 App Router, TypeScript (strict) |
| UI components | shadcn/ui (Radix UI primitives) |
| Styling | Tailwind CSS v4 |
| Icons | Lucide React |
| Font | Geist Sans + Geist Mono |

---

## Design System

### Color Palette (Dark Theme — always dark, no light mode)

| Token | oklch value | Purpose |
|-------|------------|---------|
| `--background` | `oklch(0.14 0.005 260)` | Page background (very dark blue-gray) |
| `--card` | `oklch(0.18 0.005 260)` | Card surface |
| `--sidebar` | `oklch(0.12 0.005 260)` | Sidebar background (darkest) |
| `--primary` | `oklch(0.72 0.17 162)` | Primary accent (teal-green) |
| `--primary-foreground` | `oklch(0.14 0.005 260)` | Text on primary bg |
| `--foreground` | `oklch(0.95 0.005 260)` | Primary text (near white) |
| `--muted-foreground` | `oklch(0.65 0.01 260)` | Secondary/dim text |
| `--border` | `oklch(0.25 0.005 260)` | Borders and dividers |
| `--muted` | `oklch(0.22 0.005 260)` | Muted backgrounds |
| `--destructive` | `oklch(0.65 0.2 25)` | Errors, delete actions (red-orange) |
| `--accent` | `oklch(0.65 0.12 195)` | Hover/accent (teal-cyan) |

**Status colors (semantic):**
- Income / success / on-track budgets: green (`text-green-400` / `bg-green-900`)
- Expense / warning budgets (80–99%): amber (`text-amber-400` / `bg-amber-900`)
- Exceeded budgets / alerts / errors: red-orange (destructive)
- Transfers: blue-gray (`text-blue-400`)

### Typography
- Font: system-ui in mockups (Geist Sans in real app)
- Page headings: `text-2xl font-bold`
- Card titles: `text-lg font-semibold`
- Body: `text-sm`
- Muted/meta: `text-xs text-muted-foreground`

### Border radius
- Cards, inputs, badges: `0.625rem`
- Buttons: `0.5rem`

### Spacing
- Page padding: `p-4 md:p-6`
- Card padding: `p-6`
- Gap between cards: `gap-4` or `gap-6`

---

## Layout

Every dashboard page uses a **two-column layout**:
```
┌─────────────────────────────────────────────────────┐
│ Sidebar (256px fixed)  │  Main content (flex-1)     │
│                        │  p-4 md:p-6                │
│  FinTrack              │  <PageHeader>               │
│  Personal Finance      │  <Content>                  │
│                        │                            │
│  [Nav items × 13]      │                            │
│                        │                            │
│  Sign out              │                            │
└─────────────────────────────────────────────────────┘
```

On mobile: sidebar is hidden, replaced by a hamburger button that opens a Sheet (slide-in drawer).

---

## Navigation Structure

The sidebar has 13 items in this exact order:

| # | Label | Icon | Route |
|---|-------|------|-------|
| 1 | Dashboard | LayoutDashboard | `/` |
| 2 | Transactions | ArrowLeftRight | `/transactions` |
| 3 | Recurring | Repeat | `/recurring` |
| 4 | Budgets | PiggyBank | `/budgets` |
| 5 | Analytics | BarChart2 | `/analytics` |
| 6 | Scan Receipt | ScanLine | `/scan` |
| 7 | Accounts | Wallet | `/accounts` |
| 8 | Credit Cards | CreditCard | `/cards` |
| 9 | Statements | Receipt | `/statements` |
| 10 | Documents | FileText | `/documents` |
| 11 | Notifications | Bell | `/notifications` |
| 12 | Settings | Settings | `/settings` |
| 13 | User Guide | BookOpen | `/guide` |

Active item style: `background: var(--primary); color: var(--primary-foreground); border-radius: 0.5rem`
Inactive item style: `color: var(--muted-foreground)` with hover: `background: var(--muted)`

Notifications item shows a red badge with unread count when > 0.

---

## Page-by-Page Reference

### Dashboard (`/`)
- 4 stat cards in a row: Monthly Income, Monthly Expenses, Net (Income−Expenses), Net Worth
- Net / Net Worth show positive/negative with green or red color
- Onboarding checklist (collapses when all done)
- Recent Transactions list (last 5, no pagination)
- Active Recurring Transactions (last 5)

### Transactions (`/transactions`)
- Full-width filter bar: search text, type select, account select, category select, date range
- Count: "Showing X of Y transactions"
- List rows: type badge | description | category | account | date | amount
- Clicking a row opens an **edit Sheet** (slides in from right, `max-w-lg`)
- Pagination: Previous | Page X of Y | Next (only shown when total > 50)
- "New Transaction" button → `/transactions/new` (separate full page with a form)

**Transaction types:**
- `income` — green badge
- `expense` — red badge
- `transfer` — gray/blue badge

**Transaction sub-types (examples):** salary, freelance, bonus, groceries, dining, transport, utilities, entertainment, shopping, transfer_out, transfer_in

### Accounts (`/accounts`)
- Grid of account cards (2 columns on desktop)
- Each card: account name, type badge, current balance (large text), pencil edit button
- Types: savings, checking, cash, investment
- "New Account" button → opens a Sheet form

### Budgets (`/budgets`)
- Shows current month (e.g. "February 2026")
- Budget cards with:
  - Name + category/account label
  - Spent / Limit (e.g. ₱8,500 / ₱10,000)
  - Percentage (e.g. 85%)
  - Progress bar (green ≤79%, amber 80–99%, red ≥100%)
  - Status badge: "On Track" (green) | "Warning" (amber) | "Exceeded" (red)
  - Trash icon → **AlertDialog** confirmation before delete (do NOT delete immediately)
- "New Budget" button → Sheet form
- Budget types: `category` (tracks spending in a category) or `account` (tracks total account outflow)
- Budget periods: `monthly`, `weekly`, `yearly`

### Analytics (`/analytics`)
- Year selector (number input, 2000–2099)
- Monthly Income vs Expenses bar chart (12 months)
- Spending by Category (donut chart or list with percentages)
- Monthly trend table

### Recurring (`/recurring`)
- Toggle: Active only / All
- Cards with: description, frequency badge, amount, next due date, type badge, edit/pause/delete icons
- Frequencies: `monthly`, `weekly`, `yearly`, `biweekly`
- Paused items show a "Paused" badge

### Scan Receipt (`/scan`)
- Two tabs: Single Receipt | Bulk Import
- Upload area (dashed border, drag-and-drop)
- After upload: Step 1 (copy prompt) → Step 2 (paste AI response, disabled until Step 1 done)
- Step 2 becomes active (no longer grayed) once user copies the prompt
- After paste: parsed transactions shown in `TransactionConfirm` or `BulkImportTable`

### Credit Cards (`/cards`)
- Cards styled as dark-gradient "bank card" visuals
- Fields: card name, last 4 digits, credit limit, current balance, statement day (1–31), due day (1–31)
- Edit + delete per card

### Statements (`/statements`)
- Filter: All | Unpaid
- Grouped by credit card
- Each statement: period label (e.g. "Feb 2026"), due date, total amount, Paid/Unpaid badge
- Unpaid → red badge with a "Mark Paid" action
- Empty state: Card with Receipt icon + "Add Statement" CTA button

### Documents (`/documents`)
- List of uploaded files with: icon, filename, MIME type, size, upload date, linked transaction badge
- Loading state uses Skeleton placeholders (3 rows)
- Error state shows an alert
- "Upload" button → navigates to `/scan`
- Empty state: Card with FileText icon + "Upload your first document" CTA

### Notifications (`/notifications`)
- Tabs: All | Unread
- "Mark all read" button (top right)
- Each notification: icon (bell/alert), title, message, time ago
- Unread notifications have a slightly highlighted background (`bg-muted/40`)
- Notification types: `budget_alert` (amber), `budget_exceeded` (red), `statement_due` (blue)
- Clicking an unread notification marks it read (no navigation)

### Settings (`/settings`)
- Profile card: avatar (initials), name, email, edit profile form
- Change Password card: 3 fields + button
- Preferences card: currency + timezone + save
- Notifications card: toggle switches for push/budget/statement alerts
- Danger Zone card: Delete Account (red destructive button)

### User Guide (`/guide`)
- Two-column layout: TOC (sticky right sidebar) + content (left, scrollable)
- Sections with anchors, callout boxes for tips/warnings
- No interactive elements beyond anchor navigation

---

## Component Patterns

### Cards
```html
<div style="background: var(--card); border: 1px solid var(--border); border-radius: 0.625rem; padding: 1.5rem;">
  <h2 style="font-size: 1.125rem; font-weight: 600; margin-bottom: 1rem;">Card Title</h2>
  <!-- content -->
</div>
```

### Buttons
- Primary: `background: var(--primary); color: var(--primary-foreground)` + hover darker
- Secondary/outline: `border: 1px solid var(--border); background: transparent`
- Ghost: transparent background, hover shows muted bg
- Destructive: `background: var(--destructive); color: white`

### Badges
- Green (income/success): `background: rgb(21 128 61 / 0.3); color: #4ade80; border: 1px solid rgb(21 128 61 / 0.4)`
- Red (expense/exceeded): `background: rgb(153 27 27 / 0.3); color: #f87171`
- Amber (warning): `background: rgb(146 64 14 / 0.3); color: #fbbf24`
- Blue-gray (transfer): `background: rgb(30 58 138 / 0.3); color: #93c5fd`

### Sheets (slide-in panels)
Used for create/edit forms. Slides in from the right. `max-width: 28rem`. Has:
- SheetHeader with title + description (muted text)
- Form fields in a scrollable body
- Footer with Cancel + Save buttons

### AlertDialog (confirmation)
Used for all destructive actions (delete). Has:
- Title: "Delete [item]?"
- Description: "This will permanently delete... This cannot be undone."
- Cancel button + red "Delete" button

### Progress Bars
```html
<div style="background: var(--muted); border-radius: 9999px; height: 0.5rem; overflow: hidden;">
  <div style="width: 85%; height: 100%; background: #fbbf24; border-radius: 9999px;"></div>
</div>
```

### Empty States
All entity pages use the same empty state pattern:
```html
<div style="border: 1px dashed var(--border); border-radius: 0.625rem; padding: 3rem; text-align: center;">
  <!-- Large icon (48×48) in muted color -->
  <p style="font-size: 1.125rem; font-weight: 500;">No [items] yet</p>
  <p style="color: var(--muted-foreground); font-size: 0.875rem;">Description text</p>
  <!-- Primary CTA button -->
</div>
```

### Loading States
Use Skeleton placeholders (animated gray bars) matching the shape of real content.

---

## Data Model Summary

### Transaction
```
id, user_id, account_id, category_id (optional), to_account_id (optional),
description, amount (Decimal, always positive),
type: "income" | "expense" | "transfer",
sub_type: (e.g. "salary", "groceries", "transfer_out"),
date, notes, fee_amount (optional), fee_category_id (optional),
source: "manual" | "import" | "recurring", created_at
```

### Account
```
id, user_id, name, type: "savings"|"checking"|"cash"|"investment",
opening_balance, current_balance (computed), currency, is_active
```

### Budget
```
id, user_id, name, amount, type: "category"|"account",
period: "monthly"|"weekly"|"yearly",
category_id (if type=category), account_id (if type=account),
start_date, end_date (optional)
```

### CreditCard
```
id, user_id, name, last_four, credit_limit,
statement_day (1–31), due_day (1–31), linked_account_id
```

### RecurringTransaction
```
id, user_id, account_id, category_id, description, amount,
type, frequency: "monthly"|"weekly"|"yearly"|"biweekly",
start_date, next_due_date, is_active
```

---

## What Gemini Should NOT Change (Preserve These)

1. **Dark-only theme** — the app is dark mode only. Do not introduce a light mode unless explicitly asked.
2. **Philippine Peso (₱)** — all monetary values use ₱, not $ or €.
3. **Navigation order** — the 13 nav items are in a specific order that should be preserved.
4. **AlertDialog for delete** — every delete action requires a confirmation dialog.
5. **Sheet pattern for forms** — create/edit forms slide in as sheets, not modal dialogs or new pages (except New Transaction which is `/transactions/new`).
6. **Budget color semantics** — green/amber/red thresholds at <80% / 80–99% / ≥100%.
7. **Transaction amount is always positive** — the sign is determined by `type`, not the amount field.
8. **Pagination shows "Page X of Y"** — not just previous/next arrows.
