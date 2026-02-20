"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
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
import { Plus, Repeat, Trash2, Pencil } from "lucide-react";

interface RecurringTransaction {
  id: string;
  account_id: string;
  category_id: string | null;
  amount: string;
  description: string;
  type: "income" | "expense" | "transfer";
  sub_type: string | null;
  frequency: "daily" | "weekly" | "biweekly" | "monthly" | "yearly";
  start_date: string;
  end_date: string | null;
  next_due_date: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface Account {
  id: string;
  name: string;
}

interface CreateForm {
  account_id: string;
  amount: string;
  description: string;
  type: "income" | "expense" | "transfer";
  sub_type: string;
  frequency: "daily" | "weekly" | "biweekly" | "monthly" | "yearly";
  start_date: string;
  end_date: string;
}

interface EditForm extends CreateForm {
  is_active: boolean;
}

function formatPeso(amount: string | number) {
  return `₱${Number(amount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
}

const FREQUENCY_LABELS: Record<RecurringTransaction["frequency"], string> = {
  daily: "Daily",
  weekly: "Weekly",
  biweekly: "Biweekly",
  monthly: "Monthly",
  yearly: "Yearly",
};

const TYPE_COLORS: Record<RecurringTransaction["type"], string> = {
  income: "bg-green-100 text-green-800",
  expense: "bg-red-100 text-red-800",
  transfer: "bg-blue-100 text-blue-800",
};

const EMPTY_CREATE_FORM: CreateForm = {
  account_id: "",
  amount: "",
  description: "",
  type: "expense",
  sub_type: "",
  frequency: "monthly",
  start_date: "",
  end_date: "",
};

export default function RecurringPage() {
  const [items, setItems] = useState<RecurringTransaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>(EMPTY_CREATE_FORM);

  // Edit state
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<RecurringTransaction | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    ...EMPTY_CREATE_FORM,
    is_active: true,
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [recurring, accts] = await Promise.all([
        api.get<RecurringTransaction[]>("/recurring-transactions"),
        api.get<Account[]>("/accounts"),
      ]);
      setItems(recurring);
      setAccounts(accts);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/recurring-transactions", {
        account_id: createForm.account_id,
        amount: createForm.amount,
        description: createForm.description,
        type: createForm.type,
        sub_type: createForm.sub_type || null,
        frequency: createForm.frequency,
        start_date: createForm.start_date,
        end_date: createForm.end_date || null,
      });
      setCreateOpen(false);
      setCreateForm(EMPTY_CREATE_FORM);
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  function openEdit(item: RecurringTransaction) {
    setEditTarget(item);
    setEditForm({
      account_id: item.account_id,
      amount: item.amount,
      description: item.description,
      type: item.type,
      sub_type: item.sub_type ?? "",
      frequency: item.frequency,
      start_date: item.start_date,
      end_date: item.end_date ?? "",
      is_active: item.is_active,
    });
    setEditOpen(true);
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editTarget) return;
    setSubmitting(true);
    try {
      await api.patch(`/recurring-transactions/${editTarget.id}`, {
        account_id: editForm.account_id,
        amount: editForm.amount,
        description: editForm.description,
        type: editForm.type,
        sub_type: editForm.sub_type || null,
        frequency: editForm.frequency,
        start_date: editForm.start_date,
        end_date: editForm.end_date || null,
        is_active: editForm.is_active,
      });
      setEditOpen(false);
      setEditTarget(null);
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!editTarget) return;
    await api.delete(`/recurring-transactions/${editTarget.id}`);
    setDeleteDialogOpen(false);
    setEditOpen(false);
    setEditTarget(null);
    await load();
  }

  async function handleToggleActive(item: RecurringTransaction) {
    setItems((prev) =>
      prev.map((r) =>
        r.id === item.id ? { ...r, is_active: !r.is_active } : r
      )
    );
    try {
      await api.patch(`/recurring-transactions/${item.id}`, {
        is_active: !item.is_active,
      });
    } catch {
      await load();
    }
  }

  const accountMap = new Map(accounts.map((a) => [a.id, a.name]));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Recurring</h1>
        <Sheet open={createOpen} onOpenChange={setCreateOpen}>
          <SheetTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              New Recurring
            </Button>
          </SheetTrigger>
          <SheetContent className="overflow-y-auto">
            <SheetHeader>
              <SheetTitle>New Recurring Transaction</SheetTitle>
            </SheetHeader>
            <form onSubmit={handleCreate} className="space-y-4 mt-4">
              <div className="space-y-1">
                <Label>Account</Label>
                <Select
                  value={createForm.account_id}
                  onValueChange={(v) =>
                    setCreateForm((f) => ({ ...f, account_id: v }))
                  }
                  required
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
              <div className="space-y-1">
                <Label>Description</Label>
                <Input
                  value={createForm.description}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, description: e.target.value }))
                  }
                  placeholder="e.g. Netflix subscription"
                  required
                />
              </div>
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
                  required
                />
              </div>
              <div className="space-y-1">
                <Label>Type</Label>
                <Select
                  value={createForm.type}
                  onValueChange={(v) =>
                    setCreateForm((f) => ({
                      ...f,
                      type: v as "income" | "expense" | "transfer",
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="income">Income</SelectItem>
                    <SelectItem value="expense">Expense</SelectItem>
                    <SelectItem value="transfer">Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Sub-type (optional)</Label>
                <Input
                  value={createForm.sub_type}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, sub_type: e.target.value }))
                  }
                  placeholder="e.g. salary, rent"
                />
              </div>
              <div className="space-y-1">
                <Label>Frequency</Label>
                <Select
                  value={createForm.frequency}
                  onValueChange={(v) =>
                    setCreateForm((f) => ({
                      ...f,
                      frequency: v as RecurringTransaction["frequency"],
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="biweekly">Biweekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={createForm.start_date}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, start_date: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-1">
                <Label>End Date (optional)</Label>
                <Input
                  type="date"
                  value={createForm.end_date}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, end_date: e.target.value }))
                  }
                />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Saving…" : "Create"}
              </Button>
            </form>
          </SheetContent>
        </Sheet>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center space-y-3">
            <Repeat className="h-12 w-12 mx-auto text-muted-foreground" />
            <p className="text-lg font-medium">No recurring transactions</p>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Set up recurring transactions to automatically track regular income
              or expenses
            </p>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              New Recurring
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">
              {items.length} recurring transaction{items.length !== 1 ? "s" : ""}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-0 divide-y">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="py-3 flex items-center gap-3 -mx-2 px-2"
                >
                  {/* Active toggle */}
                  <Checkbox
                    checked={item.is_active}
                    onCheckedChange={() => handleToggleActive(item)}
                    aria-label={
                      item.is_active ? "Deactivate" : "Activate"
                    }
                  />

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm font-medium truncate ${
                        item.is_active ? "" : "text-muted-foreground line-through"
                      }`}
                    >
                      {item.description || item.sub_type || item.type}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {accountMap.get(item.account_id) ?? "—"} &middot; Next:{" "}
                      {item.next_due_date}
                    </p>
                  </div>

                  {/* Badges + amount */}
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className="hidden sm:inline-flex">
                      {FREQUENCY_LABELS[item.frequency]}
                    </Badge>
                    <Badge
                      variant="secondary"
                      className={TYPE_COLORS[item.type]}
                    >
                      {item.type}
                    </Badge>
                    <span
                      className={`text-sm font-semibold tabular-nums ${
                        item.type === "income"
                          ? "text-green-600"
                          : item.type === "expense"
                          ? "text-red-500"
                          : "text-muted-foreground"
                      }`}
                    >
                      {item.type === "expense" ? "-" : ""}
                      {formatPeso(item.amount)}
                    </span>

                    {/* Edit button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground"
                      onClick={() => openEdit(item)}
                      aria-label="Edit"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Edit Sheet */}
      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit Recurring Transaction</SheetTitle>
          </SheetHeader>
          <form onSubmit={handleEdit} className="space-y-4 mt-4">
            <div className="space-y-1">
              <Label>Account</Label>
              <Select
                value={editForm.account_id}
                onValueChange={(v) =>
                  setEditForm((f) => ({ ...f, account_id: v }))
                }
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
            <div className="space-y-1">
              <Label>Description</Label>
              <Input
                value={editForm.description}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, description: e.target.value }))
                }
                required
              />
            </div>
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
                required
              />
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <Select
                value={editForm.type}
                onValueChange={(v) =>
                  setEditForm((f) => ({
                    ...f,
                    type: v as "income" | "expense" | "transfer",
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="transfer">Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Sub-type (optional)</Label>
              <Input
                value={editForm.sub_type}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, sub_type: e.target.value }))
                }
                placeholder="e.g. salary, rent"
              />
            </div>
            <div className="space-y-1">
              <Label>Frequency</Label>
              <Select
                value={editForm.frequency}
                onValueChange={(v) =>
                  setEditForm((f) => ({
                    ...f,
                    frequency: v as RecurringTransaction["frequency"],
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="biweekly">Biweekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={editForm.start_date}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, start_date: e.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-1">
              <Label>End Date (optional)</Label>
              <Input
                type="date"
                value={editForm.end_date}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, end_date: e.target.value }))
                }
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="edit-active"
                checked={editForm.is_active}
                onCheckedChange={(v) =>
                  setEditForm((f) => ({ ...f, is_active: v === true }))
                }
              />
              <label htmlFor="edit-active" className="text-sm">
                Active
              </label>
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="submit" className="flex-1" disabled={submitting}>
                {submitting ? "Saving…" : "Save"}
              </Button>
              <AlertDialog
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
              >
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" type="button">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete recurring transaction?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete this recurring transaction.
                      This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete}>
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
