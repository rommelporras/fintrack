"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, CreditCard as CreditCardIcon } from "lucide-react";

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

  async function loadData() {
    const [c, a] = await Promise.all([
      api.get<CreditCard[]>("/credit-cards"),
      api.get<Account[]>("/accounts"),
    ]);
    setCards(c);
    setAccounts(a);
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.post("/credit-cards", {
        account_id: accountId,
        bank_name: bankName,
        last_four: lastFour,
        statement_day: Number(statementDay),
        due_day: Number(dueDay),
      });
      setOpen(false);
      setBankName("");
      setLastFour("");
      setAccountId("");
      await loadData();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create card");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Credit Cards</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Add Card
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Credit Card</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label>Linked Account</Label>
                <Select value={accountId} onValueChange={setAccountId} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Bank</Label>
                <Input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="BPI" required />
              </div>
              <div className="space-y-2">
                <Label>Last 4 Digits</Label>
                <Input value={lastFour} onChange={(e) => setLastFour(e.target.value)} placeholder="1234" maxLength={4} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Statement Day</Label>
                  <Input type="number" min="1" max="28" value={statementDay} onChange={(e) => setStatementDay(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Due Day</Label>
                  <Input type="number" min="1" max="28" value={dueDay} onChange={(e) => setDueDay(e.target.value)} required />
                </div>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Creating…" : "Create Card"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2].map((i) => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}
        </div>
      ) : cards.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No credit cards yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {cards.map((c) => (
            <Card key={c.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <CreditCardIcon className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-base">
                    {c.bank_name} ···{c.last_four}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {c.closed_period && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Current Statement</p>
                    <p className="text-sm">{c.closed_period.period_start} → {c.closed_period.period_end}</p>
                    {c.due_date && (
                      <p className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                        Due: {c.due_date}
                        {c.days_until_due !== null && (
                          <Badge
                            variant="secondary"
                            className={c.days_until_due <= 5 ? "bg-red-100 text-red-700" : ""}
                          >
                            {c.days_until_due < 0 ? "Overdue" : `${c.days_until_due}d left`}
                          </Badge>
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
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
