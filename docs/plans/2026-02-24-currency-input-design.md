# CurrencyInput Component — Design

**Date:** 2026-02-24
**Status:** Approved

## Problem

All financial amount fields use `type="number"` plain `<Input>` elements. Numbers display as raw digits (`10500.50`) with no thousands separator, making large amounts hard to read at a glance.

## Goal

Amount fields display formatted values with comma separators (`10,500.50`) while the rest of the app (state, API payloads) continues to work with raw numeric strings. Currency symbol is shown as a non-editable prefix inside the input.

## Component

**File:** `frontend/src/components/app/CurrencyInput.tsx`

### Props

```tsx
interface CurrencyInputProps {
  value: string;           // raw numeric string, e.g. "10500.50"
  onChange: (raw: string) => void;  // emits raw numeric string, never formatted
  currency?: string;       // prefix symbol, defaults to "₱"
  placeholder?: string;    // defaults to "0.00"
  disabled?: boolean;
  className?: string;
}
```

### Visual

```
┌─────────────────────────┐
│ ₱ │ 10,500.50           │
└─────────────────────────┘
```

The currency symbol sits in a faintly separated left adornment. The editable area is to its right. Clicking anywhere focuses the text input.

### Behavior

- **Input type** — `type="text"` with `inputMode="decimal"`. Avoids browser interference with comma characters while showing a numeric keyboard on mobile.
- **Live formatting** — commas inserted after every keystroke. User always sees `10,500.50`, never `10500.50`.
- **Raw value emitted** — `onChange` fires with the stripped numeric string (`"10500.50"`). Parent state never contains commas.
- **Decimal enforcement** — max 2 decimal places. A third digit after the decimal is silently ignored.
- **Negative values** — leading `-` is allowed (needed for credit adjustments and negative balances).
- **Paste** — strips all non-numeric characters except `.` and leading `-` before formatting.
- **Currency prop** — defaults to `"₱"`. Pass `currency="$"` or any symbol for future multi-currency support.

### Internal logic (sketch)

```
onKeyPress / onChange:
  1. Strip all non-numeric except leading `-` and first `.`
  2. Split on `.`
  3. Format integer part with toLocaleString (or manual comma insertion)
  4. Rejoin with decimal part (capped at 2 digits)
  5. Set display value → formatted string
  6. Call props.onChange with raw (unformatted) string
```

## Fields Replaced

| Page | Field | State var |
|---|---|---|
| `transactions/new/page.tsx` | Amount | `amount` / `setAmount` |
| `transactions/new/page.tsx` | Fee amount | `feeAmount` / `setFeeAmount` |
| `accounts/page.tsx` | Opening balance | `openingBalance` / `setOpeningBalance` |
| `accounts/page.tsx` | Edit balance | `editBalance` / `setEditBalance` |
| `budgets/page.tsx` | Budget limit | (inline state) |
| `recurring/page.tsx` | Amount (create) | (inline state) |
| `recurring/page.tsx` | Amount (edit) | (inline state) |
| `cards/page.tsx` | Credit limit | (inline state) |

**Not changed:** day-of-month fields in `cards/page.tsx` (`statementDay`, `dueDay`) — these are integers, not currency.

## What Does Not Change

- Parent component state — still plain numeric strings.
- API payloads — raw numeric strings sent as-is.
- `formatPeso` in `utils.ts` — display-only formatter, unchanged.
- Database layer — unaffected.

## Testing

- Unit test `CurrencyInput` directly: typing `10500.50` produces display `10,500.50` and emits `"10500.50"`.
- Test paste of `"₱10,500.50"` strips to `"10500.50"`.
- Test 3rd decimal digit is rejected.
- Test negative value `-500` formats correctly.
