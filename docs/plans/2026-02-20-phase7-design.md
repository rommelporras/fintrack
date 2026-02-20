# Phase 7: Recurring Transactions, Sessions, UI Overhaul, PWA

**Date:** 2026-02-20
**Status:** Approved

---

## Overview

Phase 7 adds four feature areas: recurring transaction automation, persistent session handling, a dark finance UI redesign, and full PWA support with offline read/write and push notifications. This is the largest phase yet, touching every layer of the stack.

---

## Section 1 — Recurring Transactions

### Model: `RecurringTransaction`

A template that generates actual `Transaction` records on schedule.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID (uuidv7) | PK |
| user_id | UUID FK | |
| account_id | UUID FK | |
| category_id | UUID FK nullable | |
| amount | Decimal(15,2) | |
| description | Text | |
| type | Enum | income / expense / transfer |
| sub_type | Enum nullable | salary, subscription, etc. |
| frequency | Enum | daily, weekly, biweekly, monthly, yearly |
| start_date | Date | First occurrence |
| end_date | Date nullable | null = no end |
| next_due_date | Date | Computed, indexed |
| is_active | Boolean | default True |
| created_at | DateTime | |
| updated_at | DateTime | |

New FK on `Transaction`: `recurring_id` (nullable UUID FK to `recurring_transactions`). New `source` enum value: `"recurring"`.

### Engine

A Celery Beat task (`generate_recurring_transactions`) runs daily at 00:05 UTC. Logic:

1. Query all active `RecurringTransaction` where `next_due_date <= today`.
2. For each match, create a `Transaction` with `source="recurring"` and `recurring_id` set.
3. Advance `next_due_date` by frequency.
4. If `next_due_date > end_date`, set `is_active = False`.
5. Create a `Notification` of type `recurring_created` for each generated transaction.

### API

| Method | Path | Purpose |
|--------|------|---------|
| GET | /recurring-transactions | List user's recurring entries |
| POST | /recurring-transactions | Create new recurring entry |
| PATCH | /recurring-transactions/{id} | Update (amount, description, frequency, end_date, is_active) |
| DELETE | /recurring-transactions/{id} | Delete |

### Frontend

- New `/recurring` sidebar item between "Transactions" and "Budgets".
- List view: table with description, amount, frequency badge, next due date, active toggle.
- Create/edit dialog with all fields.
- Dashboard: "Upcoming This Week" card showing next 5 due recurring entries.

---

## Section 2 — Session Improvements

### Backend

**New endpoint: `POST /auth/refresh`**
- Reads `refresh_token` cookie, validates type and expiry.
- Issues a new `access_token` cookie (30-min expiry).
- Returns 401 if refresh token is expired or invalid.

**Login changes:**
- `LoginRequest` schema gets `remember_me: bool = False`.
- When `remember_me=False`: refresh token cookie `max_age` is omitted (session cookie — cleared on browser close).
- When `remember_me=True`: refresh token cookie `max_age=30 days` (persists across restarts).
- Access token `max_age` stays 30 minutes in both cases.

### Frontend

- "Remember me" checkbox on login page.
- `api.ts` 401 handler upgraded:
  1. On 401, attempt `POST /auth/refresh` first.
  2. If refresh succeeds, retry the original request.
  3. If refresh also 401s, redirect to `/login`.
  4. Use a mutex to prevent multiple concurrent refresh attempts.
- `useAuth.login()` passes `remember_me` to the API.

---

## Section 3 — UI Overhaul: Dark Finance Theme

### Color Palette

Dark-only mode. Emerald green accent (money theme).

| Variable | Value | Description |
|----------|-------|-------------|
| --background | oklch(0.14 0.005 260) | Deep charcoal |
| --foreground | oklch(0.93 0 0) | Off-white text |
| --card | oklch(0.18 0.005 260) | Card surfaces |
| --card-foreground | oklch(0.93 0 0) | |
| --primary | oklch(0.72 0.17 162) | Emerald green |
| --primary-foreground | oklch(0.14 0.005 260) | Dark on green |
| --secondary | oklch(0.22 0.005 260) | Slightly lighter surface |
| --secondary-foreground | oklch(0.85 0 0) | |
| --muted | oklch(0.22 0.005 260) | |
| --muted-foreground | oklch(0.55 0 0) | Dimmed text |
| --accent | oklch(0.65 0.12 195) | Teal for links/info |
| --accent-foreground | oklch(0.14 0.005 260) | |
| --destructive | oklch(0.65 0.2 25) | Warm red |
| --border | oklch(0.25 0.005 260) | Subtle borders |
| --input | oklch(0.25 0.005 260) | Input borders |
| --ring | oklch(0.72 0.17 162) | Focus rings = primary |
| --sidebar-background | oklch(0.12 0.005 260) | Darker sidebar |
| --sidebar-primary | oklch(0.72 0.17 162) | Active item = emerald |

### Typography

Keep Geist Sans + Geist Mono. Adjust:
- Page titles: `text-2xl font-semibold tracking-tight`
- Section headers: `text-lg font-medium`
- Better hierarchy with consistent spacing scale

### Layout Upgrades

- Cards: subtle border, optional glassmorphism (`bg-card/80 backdrop-blur-sm`)
- Dashboard summary cards: colored left accent bar (green=income, red=expense, teal=net)
- Sidebar: darker bg, emerald active indicator, hover state
- Auth pages: centered card on dark gradient background
- Better empty states with illustrations or icons
- Consistent `space-y-6` page padding

### Scope

Files touched: `globals.css` (theme vars), sidebar, dashboard, auth pages, layout. shadcn components inherit theme vars automatically.

---

## Section 4 — PWA with Full Offline Support

### Setup

1. Configure `@ducanh2912/next-pwa` in `next.config.ts`:
   ```ts
   import withPWA from "@ducanh2912/next-pwa";
   export default withPWA({ dest: "public", disable: process.env.NODE_ENV === "development" })({ ... });
   ```
2. Create `public/manifest.webmanifest`:
   - name: "FinTrack", short_name: "FinTrack"
   - theme_color: "#2dd4bf" (emerald-ish)
   - background_color: "#1a1a2e" (dark bg)
   - display: "standalone"
   - icons: 192x192 and 512x512 PNG
3. Add `<link rel="manifest">` and `<meta name="theme-color">` to `layout.tsx`.
4. Generate icons: "F" monogram, emerald on dark background.

### Offline Reading — Cache Strategy

- **App shell** (HTML/CSS/JS/fonts): precache at install (cache-first).
- **API reads** (GET endpoints): network-first with stale fallback.
  - On successful network fetch, cache the response in a runtime cache.
  - When offline, serve the cached version.
  - Show a subtle top banner: "Offline — showing cached data".
- **Images/uploads**: cache-first with network fallback.

Custom service worker additions via `next-pwa`'s `customWorkerSrc` or `runtimeCaching` config.

### Offline Writes — Background Sync Queue

When offline and user performs a write (POST/PATCH/DELETE):
1. Intercept in `api.ts` — detect `navigator.onLine === false` (or fetch failure).
2. Store the request (method, path, body, timestamp) in IndexedDB via a `SyncQueue` helper.
3. Show toast: "Saved offline — will sync when connected".
4. On reconnect (`online` event + Background Sync API as enhancement):
   - Replay queued requests in order (FIFO).
   - On success, remove from queue.
   - On conflict/failure, show notification with details.
5. Conflict resolution: last-write-wins. User is sole writer, so no merge needed.

### Push Notifications

**New model: `PushSubscription`**

| Field | Type |
|-------|------|
| id | UUID |
| user_id | UUID FK |
| endpoint | Text |
| p256dh_key | Text |
| auth_key | Text |
| created_at | DateTime |

**New API:**
- `POST /notifications/push-subscribe` — stores subscription from browser's Push API.
- `DELETE /notifications/push-unsubscribe` — removes subscription.

**Backend integration:**
- When any `Notification` is created (budget alert, recurring created, statement due), also send Web Push via `pywebpush`.
- Generate VAPID keys (stored in env vars: `VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY`).

**Frontend:**
- After first successful login, prompt for push permission (not on page load).
- If granted, call `navigator.serviceWorker.ready`, then `registration.pushManager.subscribe()`.
- POST the subscription to `/notifications/push-subscribe`.
- Service worker handles `push` event: show native notification with title, body, icon.
- Clicking the notification opens the app to `/notifications`.

---

## Section 5 — Production Deployment (Deferred)

See `docs/plans/2026-02-20-production-deployment.md` for the separate deployment document. This is not part of Phase 7 implementation — it will be handled by the homelab agent.

---

## Execution Order

```
7a (Sessions)  ──────────┐
7b (Recurring)  ─────────┼──→ 7e (Push notifications)
7c (UI overhaul) ────────┤
7d (PWA setup + offline) ┘
```

Sessions first (small, unblocks better UX for everything else). Recurring and UI overhaul can run in parallel. PWA setup after UI overhaul (so the manifest/icons match the new theme). Push notifications last (depends on PWA service worker + notification system).
