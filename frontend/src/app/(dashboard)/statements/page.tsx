"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatPeso } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CrudSheet } from "@/components/app/CrudSheet";
import { Plus, CheckCircle2, Receipt } from "lucide-react";

interface Statement {
  id: string;
  credit_card_id: string;
  document_id: string | null;
  period_start: string;
  period_end: string;
  due_date: string;
  total_amount: string | null;
  minimum_due: string | null;
  is_paid: boolean;
  paid_at: string | null;
  created_at: string;
}

interface CreditCard {
  id: string;
  bank_name: string;
  last_four: string;
}

interface NewStatementForm {
  credit_card_id: string;
  period_start: string;
  period_end: string;
  due_date: string;
  total_amount: string;
  minimum_due: string;
}

export default function StatementsPage() {
  const [statements, setStatements] = useState<Statement[]>([]);
  const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [paidFilter, setPaidFilter] = useState<"all" | "unpaid" | "paid">("all");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<NewStatementForm>({
    credit_card_id: "",
    period_start: "",
    period_end: "",
    due_date: "",
    total_amount: "",
    minimum_due: "",
  });

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (paidFilter === "unpaid") params.set("is_paid", "false");
      if (paidFilter === "paid") params.set("is_paid", "true");
      const query = params.toString() ? `?${params.toString()}` : "";
      const [stmts, cards] = await Promise.all([
        api.get<Statement[]>(`/statements${query}`),
        api.get<CreditCard[]>("/credit-cards"),
      ]);
      setStatements(stmts);
      setCreditCards(cards);
    } catch {
      setLoadError("Failed to load statements. Please refresh.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [paidFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  async function markPaid(id: string) {
    setStatements((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, is_paid: true, paid_at: new Date().toISOString() } : s
      )
    );
    try {
      await api.patch(`/statements/${id}`, { is_paid: true });
    } catch {
      await load();
    }
  }

  async function handleCreate() {
    setSubmitting(true);
    setSaveError(null);
    try {
      await api.post("/statements", {
        credit_card_id: form.credit_card_id,
        period_start: form.period_start,
        period_end: form.period_end,
        due_date: form.due_date,
        total_amount: form.total_amount || null,
        minimum_due: form.minimum_due || null,
      });
      setSheetOpen(false);
      setForm({
        credit_card_id: "", period_start: "", period_end: "",
        due_date: "", total_amount: "", minimum_due: "",
      });
      await load();
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : "Failed to create statement");
    } finally {
      setSubmitting(false);
    }
  }

  const cardMap = new Map(creditCards.map((c) => [c.id, c]));
  const grouped = statements.reduce<Record<string, Statement[]>>((acc, s) => {
    const key = s.credit_card_id;
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Statements</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track credit card billing periods and payments
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 rounded-lg bg-muted p-1">
            {(["all", "unpaid", "paid"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setPaidFilter(f)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  paidFilter === f
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <Button size="sm" onClick={() => setSheetOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Add Statement
          </Button>
        </div>
      </div>

      <CrudSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title="New Statement"
        description="Add a credit card statement"
        onSave={handleCreate}
        saveLabel={submitting ? "Saving…" : "Add Statement"}
        saveDisabled={submitting}
      >
        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Credit Card</Label>
            <Select
              value={form.credit_card_id}
              onValueChange={(v) => setForm((f) => ({ ...f, credit_card_id: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select card" />
              </SelectTrigger>
              <SelectContent>
                {creditCards.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.bank_name} ••••{c.last_four}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Period Start</Label>
            <Input
              type="date"
              value={form.period_start}
              onChange={(e) => setForm((f) => ({ ...f, period_start: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label>Period End</Label>
            <Input
              type="date"
              value={form.period_end}
              onChange={(e) => setForm((f) => ({ ...f, period_end: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label>Due Date</Label>
            <Input
              type="date"
              value={form.due_date}
              onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label>Total Amount</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={form.total_amount}
              onChange={(e) => setForm((f) => ({ ...f, total_amount: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label>Minimum Due</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={form.minimum_due}
              onChange={(e) => setForm((f) => ({ ...f, minimum_due: e.target.value }))}
            />
          </div>
          {saveError && <p className="text-sm text-destructive">{saveError}</p>}
        </div>
      </CrudSheet>

      {loadError && <p className="text-sm text-destructive">{loadError}</p>}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-border p-12 text-center space-y-3">
          <Receipt className="h-12 w-12 mx-auto text-muted-foreground" />
          <p className="text-lg font-medium">No statements yet</p>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Add a statement to track credit card payments and due dates
          </p>
          <Button size="sm" onClick={() => setSheetOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Add Statement
          </Button>
        </div>
      ) : (
        Object.entries(grouped).map(([cardId, cardStatements]) => {
          const card = cardMap.get(cardId);
          return (
            <div key={cardId} className="rounded-xl border bg-card overflow-hidden">
              <div className="px-5 py-4 border-b border-border">
                <h2 className="font-semibold text-foreground">
                  {card ? `${card.bank_name} ••••${card.last_four}` : cardId}
                </h2>
              </div>
              <ul className="divide-y divide-border">
                {cardStatements.map((s) => (
                  <li key={s.id} className="px-5 py-3.5 flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium">
                        {s.period_start} — {s.period_end}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Due: {s.due_date}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Total: {s.total_amount != null ? formatPeso(s.total_amount) : "—"}
                        {s.minimum_due && ` · Min: ${formatPeso(s.minimum_due)}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {s.is_paid ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-accent-green-dim text-accent-green">
                          <CheckCircle2 className="h-3 w-3" />Paid
                        </span>
                      ) : (
                        <>
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-accent-amber-dim text-accent-amber">
                            Unpaid
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => markPaid(s.id)}
                          >
                            Mark Paid
                          </Button>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          );
        })
      )}
    </div>
  );
}
