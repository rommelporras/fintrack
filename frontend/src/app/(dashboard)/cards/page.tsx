"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, CreditCard as CreditCardIcon } from "lucide-react";
import { CrudSheet } from "@/components/app/CrudSheet";
import { CurrencyInput } from "@/components/app/CurrencyInput";

interface Account {
  id: string;
  name: string;
  type: string;
}

interface BillingPeriod {
  period_start: string;
  period_end: string;
}

interface CreditCard {
  id: string;
  bank_name: string;
  last_four: string;
  statement_day: number;
  due_day: number;
  credit_limit: string | null;
  closed_period: BillingPeriod | null;
  open_period: BillingPeriod | null;
  due_date: string | null;
  days_until_due: number | null;
}

export default function CardsPage() {
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [accountId, setAccountId] = useState("");
  const [bankName, setBankName] = useState("");
  const [lastFour, setLastFour] = useState("");
  const [statementDay, setStatementDay] = useState("15");
  const [dueDay, setDueDay] = useState("3");
  const [newAccountName, setNewAccountName] = useState("");
  const [creditLimit, setCreditLimit] = useState("");

  const [loadError, setLoadError] = useState<string | null>(null);

  async function loadData() {
    try {
      const [c, a] = await Promise.all([
        api.get<CreditCard[]>("/credit-cards"),
        api.get<Account[]>("/accounts"),
      ]);
      setCards(c);
      setAccounts(a);
    } catch {
      setLoadError("Failed to load cards. Please refresh.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (accountId === "__new__") {
      setNewAccountName(bankName ? `${bankName} Credit Card` : "");
    }
  }, [bankName, accountId]);

  async function handleAdd() {
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Credit Cards</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your cards and billing cycles</p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />Add Card
        </Button>
      </div>

      <CrudSheet
        open={open}
        onOpenChange={setOpen}
        title="New Credit Card"
        description="Add a credit card to track billing cycles"
        onSave={handleAdd}
        saveLabel={submitting ? "Creating…" : "Create Card"}
        saveDisabled={submitting}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Linked Account</Label>
            <Select value={accountId} onValueChange={setAccountId}>
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
              />
            </div>
          )}
          <div className="space-y-2">
            <Label>Bank</Label>
            <Input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="BPI" />
          </div>
          <div className="space-y-2">
            <Label>Last 4 Digits</Label>
            <Input value={lastFour} onChange={(e) => setLastFour(e.target.value)} placeholder="1234" maxLength={4} />
          </div>
          <div className="space-y-2">
            <Label>Credit Limit</Label>
            <CurrencyInput
              value={creditLimit}
              onChange={setCreditLimit}
              placeholder="0.00"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Statement Day</Label>
              <Input type="number" min="1" max="28" value={statementDay} onChange={(e) => setStatementDay(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Due Day</Label>
              <Input type="number" min="1" max="28" value={dueDay} onChange={(e) => setDueDay(e.target.value)} />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      </CrudSheet>

      {loadError && <p className="text-sm text-destructive">{loadError}</p>}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2].map((i) => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}
        </div>
      ) : cards.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-border p-12 text-center space-y-3">
          <CreditCardIcon className="h-12 w-12 mx-auto text-muted-foreground" />
          <p className="text-lg font-medium">No credit cards yet</p>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Add a card to track statements and due dates
          </p>
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />Add Card
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {cards.map((c) => (
            <div key={c.id} className="rounded-xl border bg-card p-5 card-interactive">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-accent-blue-dim flex items-center justify-center shrink-0">
                  <CreditCardIcon className="h-4 w-4 text-accent-blue" />
                </div>
                <span className="font-semibold text-foreground">{c.bank_name} ···{c.last_four}</span>
              </div>
              <div className="space-y-3">
                {c.closed_period && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Current Statement</p>
                    <p className="text-sm">{c.closed_period.period_start} → {c.closed_period.period_end}</p>
                    {c.due_date && (
                      <p className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                        Due: {c.due_date}
                        {c.days_until_due !== null && (
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            c.days_until_due < 0
                              ? "bg-accent-red-dim text-accent-red"
                              : c.days_until_due <= 5
                              ? "bg-accent-amber-dim text-accent-amber"
                              : "bg-muted text-muted-foreground"
                          }`}>
                            {c.days_until_due < 0 ? "Overdue" : `${c.days_until_due}d left`}
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                )}
                {c.open_period && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Open Billing Period</p>
                    <p className="text-sm">{c.open_period.period_start} → {c.open_period.period_end}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
