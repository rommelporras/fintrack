# Known Issues and UX Debt

This document is an honest catalogue of current bugs, missing features, and UX problems in FinTrack as of Phase 4. Items are grouped by severity and include suggested fixes.

---

## Critical — Broken Features

These are things that are visibly broken or silently wrong right now.

---

### [C1] Settings profile save does nothing

**What happens:** On `/settings`, clicking "Save" sends `PATCH /auth/me` which returns 404. The profile name is never updated. There is no error shown to the user — it fails silently.

**Root cause:** The `PATCH /auth/me` endpoint was never implemented in `api/app/routers/auth.py`. Only `GET /auth/me` exists.

**Fix:** Add `PATCH /auth/me` to the auth router accepting `{ name: str }` and updating the user record.

**Effort:** Small (30 min API + no frontend changes needed).

---

### [C2] Expired sessions show empty data instead of redirecting to login

**What happens:** Access tokens expire after 30 minutes. After expiry, every API call returns 401. The frontend middleware only checks whether the cookie *exists* (not whether it's valid), so the user stays on the page. All data sections silently show `—` or empty lists.

**Root cause:**
1. No `/auth/refresh` endpoint — the refresh token cookie is set but never consumed.
2. No global 401 interceptor in `api.ts` to redirect to `/login`.

**Fix (short term):** Add a 401 handler in `src/lib/api.ts` that calls `router.push("/login")` on any 401 response.

**Fix (proper):** Implement `POST /auth/refresh` that consumes the refresh token and issues a new access token. The API client should automatically retry after a successful refresh.

**Effort:** Medium (2–3 hours for the refresh flow).

---

### [C3] App browser tab still says "Create Next App"

**Status:** Fixed in the same pass as this document — `src/app/layout.tsx` has been updated to `title: "FinTrack"`.

---

## High — Significant UX Friction

These don't prevent use but make daily use annoying.

---

### [H1] AI import workflow requires 8+ steps and tab-switching

**What happens:** To import a single receipt: Scan → upload → copy prompt → switch to AI tab → attach image → paste prompt → get response → switch back → go to Documents → find document → click → paste response → review → save. This is the *primary* smart input feature.

**Fix:** Merge the Scan and Documents pages into a single unified upload-and-import flow. After uploading, show the paste textarea immediately on the same page without requiring navigation to Documents.

**Effort:** Large (UI redesign of Scan + Documents pages).

---

### [H2] No onboarding — blank dashboard gives no direction

**What happens:** New users register and land on a dashboard showing `—` everywhere. There is no empty state, no call to action, no "create your first account" prompt anywhere.

**Fix:** Add empty state components on the dashboard (and Accounts, Transactions pages) with a CTA button and brief instruction when there is no data.

**Effort:** Small per page (1–2 hours total).

---

### [H3] No search on transactions

**What happens:** There is no way to find a transaction by description. With months of data, finding a specific entry requires scrolling through pagination.

**Fix:** Add a `search` query parameter to `GET /transactions` (using `ILIKE %search%` on description). Add a search input above the transaction list.

**Effort:** Medium (1 day API + frontend).

---

### [H4] Transaction count shows page count, not total

**What happens:** The header says "X transactions" where X ≤ 50 (the page limit). On every page. Users never know their actual total count.

**Fix:** Add a `total_count` field to the `GET /transactions` response. Display it as "Showing 50 of 247 transactions".

**Effort:** Small (2–3 hours).

---

### [H5] No account edit or delete in the UI

**What happens:** If an account name has a typo, or an account should be deactivated, there is no way to do it from the UI. The API endpoints (`PATCH /accounts/{id}`, `DELETE /accounts/{id}`) exist but are not exposed.

**Fix:** Add an edit icon to each account card that opens a modal with name, opening_balance, and is_active fields. Add a delete button (with confirmation) for accounts with no transactions.

**Effort:** Medium (half day).

---

### [H6] BulkImportTable always assigns to first account

**What happens:** When importing a CC statement with the bulk import flow, all transactions are assigned to `accounts[0]` (the first account alphabetically). If your credit card account isn't first, every transaction ends up on the wrong account.

**Fix:** Add an account selector to the BulkImportTable component (and to the Documents page that calls it). Pre-select the account associated with the document's credit card if available.

**Effort:** Medium (half day).

---

### [H7] Credit card setup requires two separate pages

**What happens:** To add a credit card: you must first go to Accounts, create an account with type "Credit Card", note the ID, then go to Cards and create a card linked to that account. New users have no idea this relationship exists.

**Fix:** On the Card creation form, add an option "Create a new backing account automatically" that creates the account in the background using the card's bank name. Most users will always want this.

**Effort:** Medium (half day frontend, small API change).

---

## Medium — Missing Features

*All resolved — see Resolved table below.*

---

## Low — Polish and Consistency

*All resolved — see Resolved table below.*

---

## Resolved

| Issue | Resolution |
|---|---|
| [C1] Settings profile save does nothing | Fixed — `PATCH /auth/me` added to auth router with `UpdateProfileRequest` schema |
| [C2] Expired sessions show empty data | Fixed — 401 interceptor in `api.ts` redirects to `/login` on any 401 |
| [C3] App metadata "Create Next App" | Fixed — `layout.tsx` updated to `title: "FinTrack"` |
| [H1] AI import requires 8+ steps | Fixed — scan page rewritten as single inline flow (upload → paste → review → save) |
| [H3] No search on transactions | Fixed — `search` query param on `GET /transactions` + frontend debounced search input |
| [H4] Transaction count shows page count | Fixed — `total_count` in response, "Showing X of Y" display |
| [H5] No account edit in UI | Fixed — pencil icon + edit dialog on each account card |
| [H6] BulkImportTable always assigns to first account | Fixed — account selector shown when multiple accounts exist |
| [L1] Analytics uses native HTML form elements | Fixed — replaced with shadcn `Select`/`Input` |
| [M2] Income sub-types missing from New Transaction form | Fixed — all 21 sub-types added to the form |
| [M5] No filter for paid/unpaid on Statements page | Fixed — All/Unpaid/Paid toggle buttons added |
| [M6] TransactionConfirm has no category selector | Fixed — category selector added, filtered by transaction type |
| [H2] No onboarding — blank dashboard | Fixed — onboarding checklist on dashboard with 3-step guide, dismiss + auto-hide; consistent empty states on Accounts/Cards/Budgets |
| [H7] Credit card setup requires two pages | Fixed — "+ Create new account" option in card form auto-creates backing account |
| [M4] Credit limit not in card creation form | Fixed — optional credit limit field added to card creation dialog |
| [M1] No password change | Fixed — `POST /auth/change-password` endpoint + Change Password card on Settings page |
| [M3] Budget configuration not exposed | Fixed — period selector (monthly/weekly) and alert threshold checkboxes added to budget form |
| [M7] SSE notifications one-shot | Fixed — Redis pub/sub long-lived SSE stream replaces one-shot DB poll |
| [M8] Dashboard shows no error states | Fixed — error UI with Alert component and retry button on dashboard |
| [L2] Documents page uses react-query | Fixed — replaced with `useState` + `useEffect`; `@tanstack/react-query` removed |
| [L3] Document status never auto-updates | Fixed — 5-second polling when any document is pending/processing |
| [L4] Notifications capped at 50 | Fixed — `limit`/`offset` pagination with `{items, total}` response wrapper |
| [L5] No mobile navigation | Already implemented — `MobileSidebar` exists and is wired into layout |
| [L6] N+1 queries in accounts/net-worth | Fixed — `compute_balances_bulk()` uses 2 GROUP BY queries instead of 2*N |
| [L7] No "view all" link on dashboard | Fixed — "View all" link added to Recent Transactions card header |
| [L8] PATCH /transactions is a PUT | Fixed — `TransactionUpdate` schema with all Optional fields for proper partial updates |
