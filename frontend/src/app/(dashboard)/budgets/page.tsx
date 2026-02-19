"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";

interface BudgetResponse {
  id: string;
  user_id: string;
  type: "category" | "account";
  category_id: string | null;
  account_id: string | null;
  amount: string;
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
}

function formatPeso(amount: string): string {
  return `₱${Number(amount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
}

function progressColor(status: "ok" | "warning" | "exceeded"): string {
  if (status === "exceeded") return "bg-red-500";
  if (status === "warning") return "bg-amber-500";
  return "bg-green-500";
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
  if (status === "exceeded") return "bg-red-100 text-red-800";
  if (status === "warning") return "bg-amber-100 text-amber-800";
  return "bg-green-100 text-green-800";
}

export default function BudgetsPage() {
  const [budgetItems, setBudgetItems] = useState<BudgetStatusItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<NewBudgetForm>({
    type: "category",
    category_id: "",
    account_id: "",
    amount: "",
  });

  async function load() {
    setLoading(true);
    try {
      const [items, cats, accs] = await Promise.all([
        api.get<BudgetStatusItem[]>("/budgets/status"),
        api.get<Category[]>("/categories"),
        api.get<Account[]>("/accounts"),
      ]);
      setBudgetItems(items);
      setCategories(cats);
      setAccounts(accs);
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/budgets", {
        type: form.type,
        category_id: form.type === "category" ? form.category_id || null : null,
        account_id: form.type === "account" ? form.account_id || null : null,
        amount: form.amount,
      });
      setSheetOpen(false);
      setForm({ type: "category", category_id: "", account_id: "", amount: "" });
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Budgets</h1>
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Add Budget
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>New Budget</SheetTitle>
            </SheetHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
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
                <Label>Monthly Limit (₱)</Label>
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
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Saving…" : "Add Budget"}
              </Button>
            </form>
          </SheetContent>
        </Sheet>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : budgetItems.length === 0 ? (
        <p className="text-sm text-muted-foreground">No budgets yet. Add one to start tracking.</p>
      ) : (
        <div className="space-y-3">
          {budgetItems.map((item) => (
            <Card key={item.budget.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    {budgetLabel(item, categories, accounts)}
                  </CardTitle>
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
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(item.budget.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Spent: {formatPeso(item.spent)}
                  </span>
                  <span className="font-medium">
                    Limit: {formatPeso(item.budget.amount)}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div
                    className={cn("h-2 rounded-full", progressColor(item.status))}
                    style={{ width: `${Math.min(item.percent, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground text-right">
                  {item.percent.toFixed(1)}% used
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
