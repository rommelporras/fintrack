# FinTrack — Gemini Design Challenge

This folder is the output destination for Gemini Pro's redesign of the FinTrack UI.
The reference mockups live in `../claude/` (13 static HTML files).

---

## What Is FinTrack?

A **personal finance tracker** built for a single household (1–2 users).
Self-hosted web app. Primary currency: **Philippine Peso (₱)**.

### Features

| Feature | Description |
|---|---|
| Transactions | Record income, expense, and transfer entries |
| Accounts | Track balances across savings, checking, cash, investments |
| Budgets | Per-category or per-account spend limits with threshold alerts |
| Recurring | Auto-generated monthly/weekly/yearly/biweekly transactions |
| Credit Cards | Card limits, statement periods, due dates |
| Statements | Per-card statement history, mark paid |
| Analytics | Monthly bar chart, spending by category, yearly trends |
| Scan Receipt | Upload image → AI prompt → paste response → confirm transactions |
| Documents | Uploaded receipt files linked to transactions |
| Notifications | Budget alerts, statement dues via SSE + web push |
| PWA | Installable, offline queue |

---

## Current Design System (Claude Reference)

### Color Palette — Dark Only (no light mode)

| Token | Value | Purpose |
|---|---|---|
| `--background` | `oklch(0.14 0.005 260)` | Page background (near-black blue-gray) |
| `--card` | `oklch(0.18 0.005 260)` | Card surface |
| `--sidebar` | `oklch(0.12 0.005 260)` | Sidebar (darkest) |
| `--primary` | `oklch(0.72 0.17 162)` | Teal-green accent |
| `--foreground` | `oklch(0.95 0.005 260)` | Primary text |
| `--muted-foreground` | `oklch(0.65 0.01 260)` | Secondary/dim text |
| `--border` | `oklch(0.25 0.005 260)` | Borders, dividers |
| `--muted` | `oklch(0.22 0.005 260)` | Muted backgrounds |
| `--destructive` | `oklch(0.65 0.2 25)` | Red-orange for deletes/errors |
| `--accent` | `oklch(0.65 0.12 195)` | Teal-cyan hover/accent |

**Semantic colors:**
- Income / success / on-track: green
- Warning budgets (80–99% used): amber
- Exceeded / error: destructive red-orange
- Transfers: blue-gray

### Layout

Fixed sidebar (256px) + flex-1 main content. Two-column layout throughout.
Mobile: sidebar hidden, hamburger opens a slide-in drawer.

### Navigation — 13 items in order

Dashboard → Transactions → Recurring → Budgets → Analytics → Scan Receipt →
Accounts → Credit Cards → Statements → Documents → Notifications → Settings → User Guide

### Component Patterns

- **Sheets** — create/edit forms slide in from the right (max-width 28rem)
- **AlertDialog** — all destructive actions require a confirmation dialog with typed intent where appropriate
- **Badges** — semantic color coding for transaction types and budget states
- **Progress bars** — budget utilization (green/amber/red thresholds)
- **Empty states** — dashed border card, large icon, description, CTA button
- **Skeleton loaders** — animated placeholders matching real content shape

### Data Constraints (must not change)

1. Dark-only theme — no light mode
2. Philippine Peso (₱) throughout
3. Navigation order is fixed (13 items)
4. AlertDialog always required before destructive actions
5. Sheet pattern for forms (not modals or new pages, except `/transactions/new`)
6. Budget thresholds: green <80%, amber 80–99%, red ≥100%
7. Transaction amount is always a positive Decimal — sign determined by type field
8. Pagination label: "Page X of Y" (not just arrows)

---

## Pages to Redesign (13 total)

| Route | File | Primary Purpose |
|---|---|---|
| `/` | `dashboard.html` | Summary stat cards, recent activity |
| `/transactions` | `transactions.html` | Full transaction list with filters |
| `/recurring` | `recurring.html` | Recurring transaction management |
| `/budgets` | `budgets.html` | Budget cards with progress |
| `/analytics` | `analytics.html` | Charts and trends |
| `/scan` | `scan.html` | AI-assisted receipt scan |
| `/accounts` | `accounts.html` | Account balance cards |
| `/cards` | `credit-cards.html` | Credit card visual cards |
| `/statements` | `statements.html` | Statement list + mark paid |
| `/documents` | `documents.html` | Uploaded receipt documents |
| `/notifications` | `notifications.html` | Notification feed |
| `/settings` | `settings.html` | Profile, password, preferences |
| `/guide` | `guide.html` | User reference doc with TOC |

---

## Known Weaknesses in the Current Design

These are honest pain points in the Claude reference mockups — the redesign should address them:

1. **Monochromatic boredom** — the palette is almost entirely gray tones. The teal primary is used sparingly. The result is visually flat and uniform across every page.
2. **Sidebar density** — 13 nav items with no grouping. Long list with no visual separation between categories (money tracking vs. tools vs. admin).
3. **Stat cards lack visual hierarchy** — dashboard stats are four identical-looking cards. Net Worth and Net income have no visual "weight" compared to the supporting numbers.
4. **No micro-interactions** — zero animation beyond basic CSS transitions. Clicking, saving, and deleting feel static.
5. **Analytics chart is CSS fakeout** — the "bar chart" is pure CSS height divs, not a real chart. No tooltips, no hover data, no real proportions.
6. **Scan page is a wizard with no progress indicator** — two steps (copy prompt → paste response) with no visual stepper or flow clarity.
7. **Credit card visuals are generic** — the "bank card" look in the reference is a flat dark box. Real apps use gradients and card-like styling with depth.
8. **Budget page is repetitive** — budget cards are a long stack of similar-looking items. No summary (total spent vs. total budgeted at the top).
9. **Empty states are all identical** — same dashed box pattern across 8 pages. Opportunity for illustrated or more expressive empty states.
10. **Notifications page has no urgency hierarchy** — budget-exceeded alerts look the same as informational reminders.
11. **Settings sidebar subnavigation** — 5 sections navigated by a plain list with no active-state visual depth.
12. **No global search or command palette** — with 13 pages and lots of data, a Cmd+K palette would significantly help power users.
13. **Mobile layout is underdeveloped** — the reference assumes a wide desktop. Responsive breakpoints and mobile-native interactions (swipe, bottom nav) are not considered.

---

## Possible Tech Stack Directions

The redesign is still a static HTML mockup (no backend). Pick whichever makes the output most impressive and inspectable.

### Option A — Polished Vanilla (same as current)
- Tailwind CSS CDN
- Vanilla JS for interactions
- Chart.js CDN for real charts
- Best for: easy diffing against Claude mockups

### Option B — React + Vite (single-page app mockup)
- Vite + React 19
- Tailwind CSS v4
- shadcn/ui components (Radix primitives)
- Recharts or Victory for charts
- Lucide React icons
- Framer Motion for transitions
- Best for: production-closest representation

### Option C — Svelte (lightweight modern alternative)
- SvelteKit
- Tailwind CSS v4
- Chart.js or D3
- Motion One (Svelte animation)
- Best for: smaller bundle, fast prototyping

### Option D — Astro (static + islands)
- Astro with React islands
- Tailwind CSS v4
- shadcn/ui
- Best for: fast static delivery + selective hydration

### Recommended for mockup purposes
**Option A or B.** Option A keeps it portable (single HTML files per page, easy to open and share). Option B is closest to how the real app is built and gives the best component fidelity.

---

## What the Redesign Should Achieve

- **Modern SaaS feel** — think Linear, Raycast, Vercel dashboard, or Fey app in terms of visual quality
- **Stronger visual hierarchy** — the most important number on each page should be unmissable
- **Expressive data visualization** — real charts with hover states, sparklines on stat cards
- **Intentional use of color** — the primary color should feel like a brand accent, not just a button color
- **Sidebar grouping** — consider collapsing the 13 items into logical groups or an icon-rail + label-panel pattern
- **Richer interaction hints** — empty states, loading skeletons, toast confirmations, micro-animations
- **Mobile consideration** — at minimum, a responsive breakdown for tablet widths

---

## Responsive Requirements

All redesigned pages must work at four viewport sizes:

| Label | Dimensions | Represents |
|---|---|---|
| Mobile | 375 × 812 | iPhone SE / standard |
| Tablet | 768 × 1024 | iPad portrait |
| 1080p | 1920 × 1080 | Full HD desktop |
| 1440p | 2560 × 1440 | QHD desktop |

### Breakpoint behavior
- **375px** — hidden sidebar, sticky bottom nav (5 icons + "More" drawer), sheets slide up from bottom, filter bar collapses to a drawer trigger, tables become card lists
- **768px** — icon-only sidebar (64px), tooltip on hover, sheets from right
- **1080p+** — full sidebar (256px icon + label), multi-column grids
- **1440p** — max content width 1400px centered, sidebar stays 256px

---

## Output Instructions for Gemini

Place generated files in this folder (`mockups/gemini/`):
- One HTML file per page, named identically to the Claude mockups
- A `design-notes.md` documenting what was changed and why
- A `design-system.md` documenting the revised color tokens, type scale, spacing, and component spec

The goal is **not** to copy the Claude mockups — it is to use them as a functional reference and produce something that looks and feels like a well-funded, polished SaaS product.
