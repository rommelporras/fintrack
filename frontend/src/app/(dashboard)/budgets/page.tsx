"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { cn, formatPeso } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/app/CurrencyInput";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, PiggyBank } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { CrudSheet } from "@/components/app/CrudSheet";

interface BudgetResponse {
  id: string;
  user_id: string;
  type: "category" | "account";
  category_id: string | null;
  account_id: string | null;
  amount: string;
  period: string;
  alert_at_80: boolean;
  alert_at_100: boolean;
  created_at: string;
}

interface BudgetStatusItem {
  budget: BudgetResponse;
  spent: string;
  percent: number;
  status: "ok" | "warning" | "exceeded";
}

interface Category {
  id: string;
  name: string;
  type: string;
}

interface Account {
  id: string;
  name: string;
  type: string;
}

interface NewBudgetForm {
  type: "category" | "account";
  category_id: string;
  account_id: string;
  amount: string;
  period: "monthly" | "weekly";
  alert_at_80: boolean;
  alert_at_100: boolean;
}

function progressColor(status: "ok" | "warning" | "exceeded"): string {
  if (status === "exceeded") return "bg-accent-red";
  if (status === "warning") return "bg-accent-amber";
  return "bg-accent-green";
}

function budgetLabel(item: BudgetStatusItem, cats: Category[], accounts: Account[]): string {
  if (item.budget.type === "category") {
    const cat = cats.find((c) => c.id === item.budget.category_id);
    return cat ? cat.name : "Unknown Category";
  }
  const acc = accounts.find((a) => a.id === item.budget.account_id);
  return acc ? acc.name : "Unknown Account";
}

function statusBadgeClass(status: "ok" | "warning" | "exceeded"): string {
  if (status === "exceeded") return "bg-accent-red-dim text-accent-red";
  if (status === "warning") return "bg-accent-amber-dim text-accent-amber";
  return "bg-accent-green-dim text-accent-green";
}

export default function BudgetsPage() {
  const [budgetItems, setBudgetItems] = useState<BudgetStatusItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<NewBudgetForm>({
    type: "category",
    category_id: "",
    account_id: "",
    amount: "",
    period: "monthly",
    alert_at_80: true,
    alert_at_100: true,
  });

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      const [items, cats, accs] = await Promise.all([
        api.get<BudgetStatusItem[]>("/budgets/status"),
        api.get<Category[]>("/categories"),
        api.get<Account[]>("/accounts"),
      ]);
      setBudgetItems(items);
      setCategories(cats);
      setAccounts(accs);
    } catch {
      setLoadError("Failed to load budgets. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(id: string) {
    setBudgetItems((prev) => prev.filter((item) => item.budget.id !== id));
    try {
      await api.delete(`/budgets/${id}`);
    } catch {
      await load();
    }
  }

  async function handleCreate() {
    setSubmitting(true);
    try {
      await api.post("/budgets", {
        type: form.type,
        category_id: form.type === "category" ? form.category_id || null : null,
        account_id: form.type === "account" ? form.account_id || null : null,
        amount: form.amount,
        period: form.period,
        alert_at_80: form.alert_at_80,
        alert_at_100: form.alert_at_100,
      });
      setSheetOpen(false);
      setForm({ type: "category", category_id: "", account_id: "", amount: "", period: "monthly", alert_at_80: true, alert_at_100: true });
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Budgets</h1>
          <p className="text-sm text-muted-foreground mt-1">Track your spending against limits</p>
        </div>
        <Button size="sm" onClick={() => setSheetOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Add Budget
        </Button>
      </div>

      <CrudSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title="New Budget"
        description="Set a spending limit"
        onSave={handleCreate}
        saveLabel={submitting ? "Saving…" : "Add Budget"}
        saveDisabled={submitting}
      >
        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Budget Type</Label>
            <Select
              value={form.type}
              onValueChange={(v) =>
                setForm((f) => ({
                  ...f,
                  type: v as "category" | "account",
                  category_id: "",
                  account_id: "",
                }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="category">Category</SelectItem>
                <SelectItem value="account">Account</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {form.type === "category" ? (
            <div className="space-y-1">
              <Label>Category</Label>
              <Select
                value={form.category_id}
                onValueChange={(v) => setForm((f) => ({ ...f, category_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-1">
              <Label>Account</Label>
              <Select
                value={form.account_id}
                onValueChange={(v) => setForm((f) => ({ ...f, account_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1">
            <Label>Limit</Label>
            <CurrencyInput
              value={form.amount}
              onChange={(raw) => setForm((f) => ({ ...f, amount: raw }))}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-1">
            <Label>Period</Label>
            <Select
              value={form.period}
              onValueChange={(v) =>
                setForm((f) => ({ ...f, period: v as "monthly" | "weekly" }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-3">
            <Label>Alert Thresholds</Label>
            <div className="flex items-center gap-2">
              <Checkbox
                id="alert80"
                checked={form.alert_at_80}
                onCheckedChange={(v) =>
                  setForm((f) => ({ ...f, alert_at_80: v === true }))
                }
              />
              <label htmlFor="alert80" className="text-sm">
                Alert at 80% usage
              </label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="alert100"
                checked={form.alert_at_100}
                onCheckedChange={(v) =>
                  setForm((f) => ({ ...f, alert_at_100: v === true }))
                }
              />
              <label htmlFor="alert100" className="text-sm">
                Alert when exceeded
              </label>
            </div>
          </div>
        </div>
      </CrudSheet>

      {loadError && (
        <p className="text-sm text-destructive">{loadError}</p>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : budgetItems.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-border p-12 text-center space-y-3">
          <PiggyBank className="h-12 w-12 mx-auto text-muted-foreground" />
          <p className="text-lg font-medium">No budgets yet</p>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Set a budget to track your spending against limits
          </p>
          <Button size="sm" onClick={() => setSheetOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Add Budget
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {budgetItems.map((item) => (
            <div key={item.budget.id} className="rounded-xl border bg-card p-5 card-interactive">
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  {budgetLabel(item, categories, accounts)}
                </span>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="secondary"
                    className={statusBadgeClass(item.status)}
                  >
                    {item.status === "exceeded"
                      ? "Exceeded"
                      : item.status === "warning"
                      ? "Warning"
                      : "On Track"}
                  </Badge>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 p-0">
                        <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete budget?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete the &quot;{budgetLabel(item, categories, accounts)}&quot; budget. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(item.budget.id)}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
              <div className="h-1.5 rounded-full bg-muted my-3">
                <div
                  className={cn("h-1.5 rounded-full", progressColor(item.status))}
                  style={{ width: `${Math.min(item.percent, 100)}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Spent: {formatPeso(item.spent)}
                </span>
                <span className="text-muted-foreground">
                  Limit: {formatPeso(item.budget.amount)}
                </span>
                <span className="text-muted-foreground">
                  {item.percent.toFixed(1)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
