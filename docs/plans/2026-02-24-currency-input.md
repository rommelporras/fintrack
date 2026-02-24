# CurrencyInput Component Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a reusable `CurrencyInput` component that displays amounts with comma separators and a currency prefix (e.g. `₱ 10,500.50`) while emitting raw numeric strings to parent state and the API.

**Architecture:** A single controlled component wraps shadcn's `<Input>` with a left adornment for the currency symbol. It maintains its own `display` state (formatted string) while calling `onChange` with the raw numeric string. Parent components keep their existing state shape — no API or database changes needed.

**Tech Stack:** React, TypeScript (strict), shadcn/ui `<Input>`, Vitest + Testing Library

---

## Task 1: Create `CurrencyInput` component (TDD)

**Files:**
- Create: `frontend/src/components/app/CurrencyInput.tsx`
- Create: `frontend/src/components/app/__tests__/CurrencyInput.test.tsx`

---

**Step 1: Write the failing tests**

Create `frontend/src/components/app/__tests__/CurrencyInput.test.tsx`:

```tsx
import { renderWithProviders, screen } from "@/__tests__/utils";
import { CurrencyInput } from "@/components/app/CurrencyInput";

describe("CurrencyInput", () => {
  it("renders currency symbol and text input", () => {
    renderWithProviders(<CurrencyInput value="" onChange={vi.fn()} />);
    expect(screen.getByText("₱")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("displays formatted value with commas from prop", () => {
    renderWithProviders(<CurrencyInput value="10500.50" onChange={vi.fn()} />);
    expect(screen.getByRole("textbox")).toHaveValue("10,500.50");
  });

  it("emits raw numeric string without commas on change", async () => {
    const onChange = vi.fn();
    const { user } = renderWithProviders(
      <CurrencyInput value="" onChange={onChange} />
    );
    await user.type(screen.getByRole("textbox"), "1500");
    expect(onChange).toHaveBeenLastCalledWith("1500");
  });

  it("enforces max 2 decimal places", async () => {
    const onChange = vi.fn();
    const { user } = renderWithProviders(
      <CurrencyInput value="" onChange={onChange} />
    );
    await user.type(screen.getByRole("textbox"), "10.505");
    expect(onChange).toHaveBeenLastCalledWith("10.50");
  });

  it("allows a leading minus for negative values", async () => {
    const onChange = vi.fn();
    const { user } = renderWithProviders(
      <CurrencyInput value="" onChange={onChange} />
    );
    await user.type(screen.getByRole("textbox"), "-500");
    expect(onChange).toHaveBeenLastCalledWith("-500");
  });

  it("strips non-numeric chars on paste (e.g. ₱10,500.50 → 10500.50)", async () => {
    const onChange = vi.fn();
    const { user } = renderWithProviders(
      <CurrencyInput value="" onChange={onChange} />
    );
    await user.click(screen.getByRole("textbox"));
    await user.paste("₱10,500.50");
    expect(onChange).toHaveBeenLastCalledWith("10500.50");
  });

  it("renders a custom currency symbol", () => {
    renderWithProviders(
      <CurrencyInput value="" onChange={vi.fn()} currency="$" />
    );
    expect(screen.getByText("$")).toBeInTheDocument();
  });

  it("is disabled when disabled prop is set", () => {
    renderWithProviders(
      <CurrencyInput value="" onChange={vi.fn()} disabled />
    );
    expect(screen.getByRole("textbox")).toBeDisabled();
  });
});
```

**Step 2: Run tests to confirm they fail**

```bash
docker compose run --rm frontend bun vitest run src/components/app/__tests__/CurrencyInput.test.tsx
```

Expected: FAIL — `Cannot find module '@/components/app/CurrencyInput'`

---

**Step 3: Implement the component**

Create `frontend/src/components/app/CurrencyInput.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface CurrencyInputProps {
  value: string;
  onChange: (raw: string) => void;
  currency?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

/** Strip everything except digits, a single decimal point, and a leading minus. */
function toRaw(input: string): string {
  const negative = input.trimStart().startsWith("-");
  const stripped = input.replace(/[^\d.]/g, "");
  const parts = stripped.split(".");
  const intPart = parts[0] ?? "";
  const decPart = parts.length > 1 ? parts.slice(1).join("").slice(0, 2) : undefined;
  const raw = decPart !== undefined ? `${intPart}.${decPart}` : intPart;
  return negative && raw ? `-${raw}` : raw;
}

/** Format a raw numeric string for display: add thousands commas, keep decimals. */
function toDisplay(raw: string): string {
  if (!raw) return "";
  const negative = raw.startsWith("-");
  const abs = raw.replace(/^-/, "");
  const [intPart, decPart] = abs.split(".");
  const formattedInt = intPart
    ? Number(intPart).toLocaleString("en-PH")
    : "";
  const result =
    decPart !== undefined ? `${formattedInt}.${decPart}` : formattedInt;
  return negative ? `-${result}` : result;
}

export function CurrencyInput({
  value,
  onChange,
  currency = "₱",
  placeholder = "0.00",
  disabled,
  className,
}: CurrencyInputProps) {
  const [display, setDisplay] = useState(() => toDisplay(value));

  // Sync when parent sets value externally (e.g. form reset or AI pre-fill).
  useEffect(() => {
    setDisplay(toDisplay(value));
  }, [value]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = toRaw(e.target.value);
    setDisplay(toDisplay(raw));
    onChange(raw);
  }

  return (
    <div
      className={cn(
        "flex items-center rounded-md border border-input bg-background",
        "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      <span className="px-3 text-sm text-muted-foreground border-r border-input select-none shrink-0">
        {currency}
      </span>
      <Input
        type="text"
        inputMode="decimal"
        value={display}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        className="border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent"
      />
    </div>
  );
}
```

**Step 4: Run tests to confirm they pass**

```bash
docker compose run --rm frontend bun vitest run src/components/app/__tests__/CurrencyInput.test.tsx
```

Expected: All 8 tests PASS.

**Step 5: Commit**

```bash
git add frontend/src/components/app/CurrencyInput.tsx \
        frontend/src/components/app/__tests__/CurrencyInput.test.tsx
git commit -m "feat: add CurrencyInput component with comma formatting"
```

---

## Task 2: Replace amount inputs in `transactions/new/page.tsx`

**Files:**
- Modify: `frontend/src/app/(dashboard)/transactions/new/page.tsx`

Two fields: **Amount** and **ATM Fee**.

Also update the Labels — remove `(₱)` suffix since the symbol now lives inside the input.

**Step 1: Add import**

At the top of `page.tsx` with the other component imports, add:

```tsx
import { CurrencyInput } from "@/components/app/CurrencyInput";
```

**Step 2: Replace Amount field**

Find:
```tsx
<div className="space-y-2">
  <Label>Amount (₱)</Label>
  <Input
    type="number"
    step="0.01"
    min="0.01"
    placeholder="0.00"
    value={amount}
    onChange={(e) => setAmount(e.target.value)}
    required
  />
</div>
```

Replace with:
```tsx
<div className="space-y-2">
  <Label>Amount</Label>
  <CurrencyInput
    value={amount}
    onChange={setAmount}
    placeholder="0.00"
  />
</div>
```

**Step 3: Replace ATM Fee field**

Find:
```tsx
<div className="space-y-2">
  <Label>ATM Fee (₱)</Label>
  <Input
    type="number"
    step="0.01"
    min="0"
    placeholder="18.00"
    value={feeAmount}
    onChange={(e) => setFeeAmount(e.target.value)}
  />
```

Replace with:
```tsx
<div className="space-y-2">
  <Label>ATM Fee</Label>
  <CurrencyInput
    value={feeAmount}
    onChange={setFeeAmount}
    placeholder="18.00"
  />
```

Note: The total calculation on the next line — `(Number(amount) + Number(feeAmount)).toFixed(2)` — continues to work unchanged because parent state still holds raw numeric strings.

**Step 4: Verify in browser**

Navigate to `/transactions/new`, type `10500.50` in the Amount field. Confirm the display shows `10,500.50`. Confirm the ATM fee field also formats when Withdrawal is selected.

**Step 5: Commit**

```bash
git add 'frontend/src/app/(dashboard)/transactions/new/page.tsx'
git commit -m "feat: use CurrencyInput in new transaction form"
```

---

## Task 3: Replace amount inputs in `accounts/page.tsx`

**Files:**
- Modify: `frontend/src/app/(dashboard)/accounts/page.tsx`

Two fields: **Opening Balance** (create form) and **Balance** (edit form).

**Step 1: Add import**

```tsx
import { CurrencyInput } from "@/components/app/CurrencyInput";
```

**Step 2: Replace Opening Balance field**

Find:
```tsx
<Input
  id="account-balance"
  type="number"
  step="0.01"
  value={openingBalance}
  onChange={(e) => setOpeningBalance(e.target.value)}
/>
```

Replace with:
```tsx
<CurrencyInput
  value={openingBalance}
  onChange={setOpeningBalance}
/>
```

Also update the Label above it from `Opening Balance (₱)` to `Opening Balance` if it contains `(₱)`.

**Step 3: Replace Edit Balance field**

Find:
```tsx
<Input
  id="edit-account-balance"
  type="number"
  step="0.01"
  value={editBalance}
  onChange={(e) => setEditBalance(e.target.value)}
/>
```

Replace with:
```tsx
<CurrencyInput
  value={editBalance}
  onChange={setEditBalance}
/>
```

**Step 4: Verify in browser**

Open the Add Account sheet and the Edit Account sheet. Confirm both amount fields show `₱` prefix and format with commas.

**Step 5: Commit**

```bash
git add 'frontend/src/app/(dashboard)/accounts/page.tsx'
git commit -m "feat: use CurrencyInput in accounts page"
```

---

## Task 4: Replace amount input in `budgets/page.tsx`

**Files:**
- Modify: `frontend/src/app/(dashboard)/budgets/page.tsx`

One field: **Limit**.

**Step 1: Add import**

```tsx
import { CurrencyInput } from "@/components/app/CurrencyInput";
```

**Step 2: Replace Limit field**

Find:
```tsx
<div className="space-y-1">
  <Label>Limit (₱)</Label>
  <Input
    type="number"
    step="0.01"
    min="0"
    placeholder="0.00"
    value={form.amount}
    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
    required
  />
</div>
```

Replace with:
```tsx
<div className="space-y-1">
  <Label>Limit</Label>
  <CurrencyInput
    value={form.amount}
    onChange={(raw) => setForm((f) => ({ ...f, amount: raw }))}
    placeholder="0.00"
  />
</div>
```

**Step 3: Verify in browser**

Open the Add Budget sheet. Confirm the Limit field shows `₱` prefix and formats with commas.

**Step 4: Commit**

```bash
git add 'frontend/src/app/(dashboard)/budgets/page.tsx'
git commit -m "feat: use CurrencyInput in budgets page"
```

---

## Task 5: Replace amount inputs in `recurring/page.tsx`

**Files:**
- Modify: `frontend/src/app/(dashboard)/recurring/page.tsx`

Two fields: **Amount** (create form) and **Amount** (edit form).

**Step 1: Add import**

```tsx
import { CurrencyInput } from "@/components/app/CurrencyInput";
```

**Step 2: Replace create form Amount**

Find:
```tsx
<div className="space-y-1">
  <Label>Amount (₱)</Label>
  <Input
    type="number"
    step="0.01"
    min="0"
    placeholder="0.00"
    value={createForm.amount}
    onChange={(e) =>
      setCreateForm((f) => ({ ...f, amount: e.target.value }))
    }
  />
</div>
```

Replace with:
```tsx
<div className="space-y-1">
  <Label>Amount</Label>
  <CurrencyInput
    value={createForm.amount}
    onChange={(raw) => setCreateForm((f) => ({ ...f, amount: raw }))}
    placeholder="0.00"
  />
</div>
```

**Step 3: Replace edit form Amount**

Find:
```tsx
<div className="space-y-1">
  <Label>Amount (₱)</Label>
  <Input
    type="number"
    step="0.01"
    min="0"
    value={editForm.amount}
    onChange={(e) =>
      setEditForm((f) => ({ ...f, amount: e.target.value }))
    }
  />
</div>
```

Replace with:
```tsx
<div className="space-y-1">
  <Label>Amount</Label>
  <CurrencyInput
    value={editForm.amount}
    onChange={(raw) => setEditForm((f) => ({ ...f, amount: raw }))}
  />
</div>
```

**Step 4: Verify in browser**

Open the Add Recurring and Edit Recurring sheets. Confirm both amount fields show `₱` and comma-format correctly.

**Step 5: Commit**

```bash
git add 'frontend/src/app/(dashboard)/recurring/page.tsx'
git commit -m "feat: use CurrencyInput in recurring transactions page"
```

---

## Task 6: Replace credit limit input in `cards/page.tsx`

**Files:**
- Modify: `frontend/src/app/(dashboard)/cards/page.tsx`

One field: **Credit Limit**. Do NOT touch the Statement Day or Due Day fields — those are day-of-month integers, not currency.

**Step 1: Add import**

```tsx
import { CurrencyInput } from "@/components/app/CurrencyInput";
```

**Step 2: Replace Credit Limit field**

Find:
```tsx
<div className="space-y-2">
  <Label>Credit Limit (₱)</Label>
  <Input
    type="number"
    step="0.01"
    min="0"
    value={creditLimit}
    onChange={(e) => setCreditLimit(e.target.value)}
    placeholder="0.00"
  />
</div>
```

Replace with:
```tsx
<div className="space-y-2">
  <Label>Credit Limit</Label>
  <CurrencyInput
    value={creditLimit}
    onChange={setCreditLimit}
    placeholder="0.00"
  />
</div>
```

**Step 3: Verify in browser**

Open the Add Card sheet. Confirm Credit Limit shows `₱` and formats. Confirm Statement Day and Due Day are unchanged integer inputs.

**Step 4: Commit**

```bash
git add 'frontend/src/app/(dashboard)/cards/page.tsx'
git commit -m "feat: use CurrencyInput in cards page"
```

---

## Task 7: Run full test suite

**Step 1: Run all frontend tests**

```bash
docker compose run --rm frontend bun vitest run
```

Expected: All tests pass. No regressions.

**Step 2: If any test fails**

Read the failure output carefully. The most likely cause: a test for an existing page that was expecting `type="number"` on an input. Update those assertions to match `type="text"` or query by role/placeholder instead of by input type.

**Step 3: Final commit if any test fixes were needed**

```bash
git add -p
git commit -m "fix: update tests for CurrencyInput migration"
```
