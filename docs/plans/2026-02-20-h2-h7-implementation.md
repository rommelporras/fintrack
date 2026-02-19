# H2 + H7 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a guided onboarding checklist to the dashboard, fix credit card setup to auto-create backing accounts, add credit limit field, and make empty states consistent.

**Architecture:** All frontend changes — no API modifications. Dashboard gets an inline `OnboardingChecklist` that checks live data. Card creation form gains a `"+ Create new account"` option with client-side orchestration of two API calls. Three pages get consistent dashed-border empty states.

**Tech Stack:** Next.js 16 (App Router, `'use client'`), shadcn/ui, lucide-react, Tailwind CSS v4

---

### Task 1: Empty state — Accounts page

**Files:**
- Modify: `frontend/src/app/(dashboard)/accounts/page.tsx:182-187`

**Step 1: Replace the plain empty state with dashed-border card + icon + CTA**

In `accounts/page.tsx`, replace lines 182-187 (the `accounts.length === 0` branch):

```tsx
// OLD (lines 182-187):
      ) : accounts.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No accounts yet. Add your first account to get started.
          </CardContent>
        </Card>
```

```tsx
// NEW:
      ) : accounts.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center space-y-3">
            <Wallet className="h-12 w-12 mx-auto text-muted-foreground" />
            <p className="text-lg font-medium">No accounts yet</p>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Add your first account to start tracking your finances
            </p>
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add Account
            </Button>
          </CardContent>
        </Card>
```

Also add `Wallet` to the lucide-react import (line 24):

```tsx
// OLD:
import { Plus, Pencil } from "lucide-react";
// NEW:
import { Plus, Pencil, Wallet } from "lucide-react";
```

**Step 2: Verify types compile**

Run: `cd /home/wsl/personal/fintrack/frontend && bun run tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add frontend/src/app/\(dashboard\)/accounts/page.tsx
git commit -m "feat: add empty state with CTA to accounts page (H2)"
```

---

### Task 2: Empty state — Cards page

**Files:**
- Modify: `frontend/src/app/(dashboard)/cards/page.tsx:160-165`

**Step 1: Replace the plain empty state with dashed-border card + icon + CTA**

In `cards/page.tsx`, replace lines 160-165 (the `cards.length === 0` branch):

```tsx
// OLD (lines 160-165):
      ) : cards.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No credit cards yet.
          </CardContent>
        </Card>
```

```tsx
// NEW:
      ) : cards.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center space-y-3">
            <CreditCardIcon className="h-12 w-12 mx-auto text-muted-foreground" />
            <p className="text-lg font-medium">No credit cards yet</p>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Add a card to track statements and due dates
            </p>
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add Card
            </Button>
          </CardContent>
        </Card>
```

No new imports needed — `CreditCardIcon`, `Plus`, and `Button` are already imported.

**Step 2: Verify types compile**

Run: `cd /home/wsl/personal/fintrack/frontend && bun run tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add frontend/src/app/\(dashboard\)/cards/page.tsx
git commit -m "feat: add empty state with CTA to cards page (H2)"
```

---

### Task 3: Empty state — Budgets page

**Files:**
- Modify: `frontend/src/app/(dashboard)/budgets/page.tsx:248-249`

**Step 1: Replace the bare `<p>` tag with dashed-border card + icon + CTA**

In `budgets/page.tsx`, replace lines 248-249 (the `budgetItems.length === 0` branch):

```tsx
// OLD (lines 248-249):
      ) : budgetItems.length === 0 ? (
        <p className="text-sm text-muted-foreground">No budgets yet. Add one to start tracking.</p>
```

```tsx
// NEW:
      ) : budgetItems.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center space-y-3">
            <PiggyBank className="h-12 w-12 mx-auto text-muted-foreground" />
            <p className="text-lg font-medium">No budgets yet</p>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Set a budget to track your spending against limits
            </p>
            <Button size="sm" onClick={() => setSheetOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add Budget
            </Button>
          </CardContent>
        </Card>
```

Also add `PiggyBank` to the lucide-react import (line 25):

```tsx
// OLD:
import { Plus, Trash2 } from "lucide-react";
// NEW:
import { Plus, Trash2, PiggyBank } from "lucide-react";
```

**Step 2: Verify types compile**

Run: `cd /home/wsl/personal/fintrack/frontend && bun run tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add frontend/src/app/\(dashboard\)/budgets/page.tsx
git commit -m "feat: add empty state with CTA to budgets page (H2)"
```

---

### Task 4: Dashboard onboarding checklist (H2)

**Files:**
- Modify: `frontend/src/app/(dashboard)/page.tsx`

**Step 1: Add interfaces and state for accounts and cards**

Add these interfaces after the existing `NetWorthData` interface (after line 31):

```tsx
interface AccountItem {
  id: string;
  name: string;
}

interface CardItem {
  id: string;
  bank_name: string;
}
```

Add state variables after the existing `loading` state (after line 41):

```tsx
const [accounts, setAccounts] = useState<AccountItem[]>([]);
const [creditCards, setCreditCards] = useState<CardItem[]>([]);
const [onboardingDismissed, setOnboardingDismissed] = useState(true); // default true to avoid flash
```

**Step 2: Expand the Promise.all to fetch accounts and credit cards**

Replace the `Promise.all` in the `load()` function (lines 46-49):

```tsx
// OLD:
        const [s, txnData, nw] = await Promise.all([
          api.get<Summary>("/dashboard/summary"),
          api.get<{ items: Transaction[]; total: number }>("/transactions?limit=10"),
          api.get<NetWorthData>("/dashboard/net-worth"),
        ]);
        setSummary(s);
        setTransactions(txnData.items);
        setNetWorth(nw);
```

```tsx
// NEW:
        const [s, txnData, nw, accs, cards] = await Promise.all([
          api.get<Summary>("/dashboard/summary"),
          api.get<{ items: Transaction[]; total: number }>("/transactions?limit=10"),
          api.get<NetWorthData>("/dashboard/net-worth"),
          api.get<AccountItem[]>("/accounts"),
          api.get<CardItem[]>("/credit-cards"),
        ]);
        setSummary(s);
        setTransactions(txnData.items);
        setNetWorth(nw);
        setAccounts(accs);
        setCreditCards(cards);
```

**Step 3: Add localStorage check in a useEffect**

After the existing `useEffect` (after line 59), add:

```tsx
useEffect(() => {
  setOnboardingDismissed(localStorage.getItem("fintrack_onboarding_dismissed") === "true");
}, []);
```

**Step 4: Add the onboarding checklist, replace old welcome card**

Add new imports at the top (update line 7):

```tsx
// OLD:
import { Button } from "@/components/ui/button";
// NEW:
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { CheckCircle2, Circle, ChevronRight, X } from "lucide-react";
```

Compute the checklist state after `hasData` (after line 65):

```tsx
const onboardingSteps = [
  { label: "Create your first account", href: "/accounts", done: accounts.length > 0 },
  { label: "Add a credit card", href: "/cards", done: creditCards.length > 0 },
  { label: "Record a transaction", href: "/transactions/new", done: transactions.length > 0 },
];
const completedCount = onboardingSteps.filter((s) => s.done).length;
const allComplete = completedCount === onboardingSteps.length;
const showOnboarding = !loading && !onboardingDismissed && !allComplete;
```

Replace the old welcome card block (lines 161-179) with:

```tsx
      {/* Onboarding checklist */}
      {showOnboarding && (
        <Card className="border-dashed">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Get Started</CardTitle>
              <button
                onClick={() => {
                  localStorage.setItem("fintrack_onboarding_dismissed", "true");
                  setOnboardingDismissed(true);
                }}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Dismiss onboarding"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            {onboardingSteps.map((step) => (
              <Link
                key={step.href}
                href={step.href}
                className="flex items-center gap-3 rounded-md px-2 py-2.5 hover:bg-muted transition-colors"
              >
                {step.done ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
                )}
                <span className={step.done ? "text-sm text-muted-foreground line-through" : "text-sm"}>
                  {step.label}
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto shrink-0" />
              </Link>
            ))}
            <p className="text-xs text-muted-foreground pt-2">
              {completedCount} of {onboardingSteps.length} complete
            </p>
          </CardContent>
        </Card>
      )}
```

**Step 5: Verify types compile**

Run: `cd /home/wsl/personal/fintrack/frontend && bun run tsc --noEmit`
Expected: No errors

**Step 6: Commit**

```bash
git add frontend/src/app/\(dashboard\)/page.tsx
git commit -m "feat: add onboarding checklist to dashboard (H2)"
```

---

### Task 5: Card form — auto-account creation + credit limit (H7 + M4)

**Files:**
- Modify: `frontend/src/app/(dashboard)/cards/page.tsx`

**Step 1: Add state for the new account flow and credit limit**

After the existing `dueDay` state (line 62), add:

```tsx
const [newAccountName, setNewAccountName] = useState("");
const [creditLimit, setCreditLimit] = useState("");
```

**Step 2: Add useEffect to reactively update newAccountName from bankName**

After the existing `useEffect` (line 74), add:

```tsx
useEffect(() => {
  if (accountId === "__new__") {
    setNewAccountName(bankName ? `${bankName} Credit Card` : "");
  }
}, [bankName, accountId]);
```

**Step 3: Modify handleCreate for two-step account creation**

Replace the `handleCreate` function (lines 76-98):

```tsx
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      let resolvedAccountId = accountId;

      if (accountId === "__new__") {
        const newAccount = await api.post<{ id: string }>("/accounts", {
          name: newAccountName,
          type: "credit_card",
          opening_balance: "0",
        });
        resolvedAccountId = newAccount.id;
      }

      await api.post("/credit-cards", {
        account_id: resolvedAccountId,
        bank_name: bankName,
        last_four: lastFour,
        credit_limit: creditLimit ? Number(creditLimit) : null,
        statement_day: Number(statementDay),
        due_day: Number(dueDay),
      });
      setOpen(false);
      setBankName("");
      setLastFour("");
      setAccountId("");
      setCreditLimit("");
      setNewAccountName("");
      await loadData();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create card");
    } finally {
      setSubmitting(false);
    }
  }
```

**Step 4: Update the form JSX — account select + inline name + credit limit**

Replace the account Select block (lines 116-128) with:

```tsx
              <div className="space-y-2">
                <Label>Linked Account</Label>
                <Select value={accountId} onValueChange={setAccountId} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__new__">+ Create new account</SelectItem>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {accountId === "__new__" && (
                <div className="space-y-2">
                  <Label>Account Name</Label>
                  <Input
                    value={newAccountName}
                    onChange={(e) => setNewAccountName(e.target.value)}
                    placeholder="e.g. BPI Credit Card"
                    required
                  />
                </div>
              )}
```

After the Last 4 Digits block (after line 136), add the credit limit field:

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

**Step 5: Verify types compile**

Run: `cd /home/wsl/personal/fintrack/frontend && bun run tsc --noEmit`
Expected: No errors

**Step 6: Commit**

```bash
git add frontend/src/app/\(dashboard\)/cards/page.tsx
git commit -m "feat: auto-create backing account in card form + credit limit (H7, M4)"
```

---

### Task 6: Update KNOWN_ISSUES.md

**Files:**
- Modify: `docs/KNOWN_ISSUES.md`

**Step 1: Move H2, H7, M4 to the Resolved table**

Add these rows to the Resolved table at the bottom of `docs/KNOWN_ISSUES.md`:

```markdown
| [H2] No onboarding — blank dashboard | Fixed — onboarding checklist on dashboard with 3-step guide, dismiss + auto-hide |
| [H7] Credit card setup requires two pages | Fixed — "+ Create new account" option in card form auto-creates backing account |
| [M4] Credit limit not in card creation form | Fixed — optional credit limit field added to card creation dialog |
```

Also note the empty state fixes under H2.

**Step 2: Commit**

```bash
git add docs/KNOWN_ISSUES.md
git commit -m "docs: mark H2, H7, M4 as resolved"
```

---

### Task 7: Final verification

**Step 1: Run full TypeScript check**

Run: `cd /home/wsl/personal/fintrack/frontend && bun run tsc --noEmit`
Expected: No errors

**Step 2: Verify all modified files are committed**

Run: `git status`
Expected: clean working tree
