"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatPeso } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { CrudSheet } from "@/components/app/CrudSheet";
import { CurrencyInput } from "@/components/app/CurrencyInput";

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

const FREQUENCY_LABELS: Record<RecurringTransaction["frequency"], string> = {
  daily: "Daily",
  weekly: "Weekly",
  biweekly: "Biweekly",
  monthly: "Monthly",
  yearly: "Yearly",
};

const TYPE_COLORS: Record<RecurringTransaction["type"], string> = {
  income: "bg-accent-green-dim text-accent-green",
  expense: "bg-accent-red-dim text-accent-red",
  transfer: "bg-accent-blue-dim text-accent-blue",
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

  function submitCreate() {
    setSubmitting(true);
    api
      .post("/recurring-transactions", {
        account_id: createForm.account_id,
        amount: createForm.amount,
        description: createForm.description,
        type: createForm.type,
        sub_type: createForm.sub_type || null,
        frequency: createForm.frequency,
        start_date: createForm.start_date,
        end_date: createForm.end_date || null,
      })
      .then(() => {
        setCreateOpen(false);
        setCreateForm(EMPTY_CREATE_FORM);
        load();
      })
      .catch(() => { /* submission failed — sheet stays open */ })
      .finally(() => setSubmitting(false));
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

  function submitEdit() {
    if (!editTarget) return;
    setSubmitting(true);
    api
      .patch(`/recurring-transactions/${editTarget.id}`, {
        account_id: editForm.account_id,
        amount: editForm.amount,
        description: editForm.description,
        type: editForm.type,
        sub_type: editForm.sub_type || null,
        frequency: editForm.frequency,
        start_date: editForm.start_date,
        end_date: editForm.end_date || null,
        is_active: editForm.is_active,
      })
      .then(() => {
        setEditOpen(false);
        setEditTarget(null);
        load();
      })
      .catch(() => { /* submission failed — sheet stays open */ })
      .finally(() => setSubmitting(false));
  }

  async function handleDelete() {
    if (!editTarget) return;
    try {
      await api.delete(`/recurring-transactions/${editTarget.id}`);
      setDeleteDialogOpen(false);
      setEditOpen(false);
      setEditTarget(null);
      await load();
    } catch {
      setDeleteDialogOpen(false);
    }
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
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Recurring</h1>
          <p className="text-sm text-muted-foreground mt-1">Automate your regular transactions</p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          New Recurring
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-border p-12 text-center space-y-3">
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
        </div>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <p className="text-sm text-muted-foreground">
              {items.length} recurring transaction{items.length !== 1 ? "s" : ""}
            </p>
          </div>
          <ul className="divide-y divide-border">
            {items.map((item) => (
              <li
                key={item.id}
                className="py-3 flex items-center gap-3 px-5"
              >
                {/* Active toggle */}
                <Switch
                  checked={item.is_active}
                  onCheckedChange={() => handleToggleActive(item)}
                  aria-label={item.is_active ? "Deactivate" : "Activate"}
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
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-xs text-muted-foreground">
                      {accountMap.get(item.account_id) ?? "—"}
                    </p>
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                      Due {item.next_due_date}
                    </span>
                  </div>
                </div>

                {/* Badges + amount */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground hidden sm:inline">
                    {FREQUENCY_LABELS[item.frequency]}
                  </span>
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TYPE_COLORS[item.type]}`}
                  >
                    {item.type}
                  </span>
                  <span
                    className={`text-sm font-semibold tabular-nums ${
                      item.type === "income"
                        ? "text-accent-green"
                        : item.type === "expense"
                        ? "text-foreground"
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
        </div>
      )}

      {/* Create Sheet */}
      <CrudSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="New Recurring Transaction"
        description="Set up a new recurring transaction."
        onSave={submitCreate}
        saveLabel={submitting ? "Saving…" : "Create"}
        saveDisabled={submitting}
      >
        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Account</Label>
            <Select
              value={createForm.account_id}
              onValueChange={(v) =>
                setCreateForm((f) => ({ ...f, account_id: v }))
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
              value={createForm.description}
              onChange={(e) =>
                setCreateForm((f) => ({ ...f, description: e.target.value }))
              }
              placeholder="e.g. Netflix subscription"
            />
          </div>
          <div className="space-y-1">
            <Label>Amount</Label>
            <CurrencyInput
              value={createForm.amount}
              onChange={(raw) => setCreateForm((f) => ({ ...f, amount: raw }))}
              placeholder="0.00"
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
        </div>
      </CrudSheet>

      {/* Edit Sheet */}
      <CrudSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        title="Edit Recurring Transaction"
        description="Update the recurring transaction details below."
        onSave={submitEdit}
        saveLabel={submitting ? "Saving…" : "Save"}
        saveDisabled={submitting}
        footer={
          <div className="flex items-center justify-between w-full">
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
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button onClick={submitEdit} disabled={submitting}>
                {submitting ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
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
            />
          </div>
          <div className="space-y-1">
            <Label>Amount</Label>
            <CurrencyInput
              value={editForm.amount}
              onChange={(raw) => setEditForm((f) => ({ ...f, amount: raw }))}
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
            <Switch
              id="edit-active"
              checked={editForm.is_active}
              onCheckedChange={(v) =>
                setEditForm((f) => ({ ...f, is_active: v }))
              }
            />
            <Label htmlFor="edit-active">Active</Label>
          </div>
        </div>
      </CrudSheet>
    </div>
  );
}
