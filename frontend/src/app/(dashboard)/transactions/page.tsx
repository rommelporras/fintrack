"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { formatPeso } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  SheetDescription,
  SheetHeader,
  SheetTitle,
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
import { Plus, Filter, ChevronDown, ChevronUp } from "lucide-react";

interface Transaction {
  id: string;
  description: string;
  amount: string;
  type: "income" | "expense" | "transfer";
  sub_type: string | null;
  date: string;
  account_id: string;
  category_id: string | null;
}

interface Account {
  id: string;
  name: string;
  type: string;
}

interface Category {
  id: string;
  name: string;
  type: string;
}

interface TransactionEditForm {
  account_id: string;
  category_id: string;
  amount: string;
  type: "income" | "expense" | "transfer";
  date: string;
  description: string;
}

const TYPE_COLORS: Record<string, string> = {
  income: "bg-green-100 text-green-800",
  expense: "bg-red-100 text-red-800",
  transfer: "bg-blue-100 text-blue-800",
};

interface TransactionListResponse {
  items: Transaction[];
  total: number;
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const LIMIT = 50;

  // Edit sheet state
  const [selectedTxn, setSelectedTxn] = useState<Transaction | null>(null);
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [editForm, setEditForm] = useState<TransactionEditForm>({
    account_id: "",
    category_id: "",
    amount: "",
    type: "expense",
    date: "",
    description: "",
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Filter state
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterAccountId, setFilterAccountId] = useState("all");
  const [filterCategoryId, setFilterCategoryId] = useState("all");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(LIMIT),
        offset: String(offset),
      });
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (filterDateFrom) params.set("date_from", filterDateFrom);
      if (filterDateTo) params.set("date_to", filterDateTo);
      if (filterAccountId !== "all") params.set("account_id", filterAccountId);
      if (filterCategoryId !== "all") params.set("category_id", filterCategoryId);
      if (debouncedSearch) params.set("search", debouncedSearch);
      const data = await api.get<TransactionListResponse>(`/transactions?${params}`);
      setTransactions(data.items);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }, [offset, typeFilter, filterDateFrom, filterDateTo, filterAccountId, filterCategoryId, debouncedSearch]);

  useEffect(() => {
    Promise.all([
      api.get<Account[]>("/accounts"),
      api.get<Category[]>("/categories"),
    ]).then(([accts, cats]) => {
      setAccounts(accts);
      setCategories(cats);
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openEditSheet(t: Transaction) {
    setSelectedTxn(t);
    setSaveError(null);
    setEditForm({
      account_id: t.account_id,
      category_id: t.category_id ?? "",
      amount: t.amount,
      type: t.type as "income" | "expense" | "transfer",
      date: t.date,
      description: t.description,
    });
    setEditSheetOpen(true);
  }

  async function handleSave() {
    if (!selectedTxn) return;
    setSaveError(null);
    try {
      await api.patch(`/transactions/${selectedTxn.id}`, {
        ...editForm,
        category_id: editForm.category_id || null,
      });
      setEditSheetOpen(false);
      setSelectedTxn(null);
      await load();
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : "Failed to save.");
    }
  }

  async function handleDelete() {
    if (!selectedTxn) return;
    await api.delete(`/transactions/${selectedTxn.id}`);
    setDeleteDialogOpen(false);
    setEditSheetOpen(false);
    setSelectedTxn(null);
    await load();
  }

  function clearFilters() {
    setFilterDateFrom("");
    setFilterDateTo("");
    setFilterAccountId("all");
    setFilterCategoryId("all");
    setTypeFilter("all");
    setSearch("");
    setOffset(0);
  }

  const accountMap = new Map(accounts.map((a) => [a.id, a.name]));
  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Transactions</h1>
        <Button asChild size="sm">
          <Link href="/transactions/new">
            <Plus className="h-4 w-4 mr-1" />
            New
          </Link>
        </Button>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="Search transactions…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setOffset(0); }}
          className="max-w-xs"
        />
      </div>

      <div className="flex gap-2">
        <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setOffset(0); }}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="income">Income</SelectItem>
            <SelectItem value="expense">Expense</SelectItem>
            <SelectItem value="transfer">Transfer</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2 mb-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setFiltersOpen((o) => !o)}
        >
          <Filter className="h-4 w-4 mr-1" />
          Filters
          {filtersOpen ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
        </Button>
        {(filterDateFrom || filterDateTo || filterAccountId !== "all" || filterCategoryId !== "all") && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear
          </Button>
        )}
      </div>

      {filtersOpen && (
        <div className="grid grid-cols-2 gap-3 p-3 border rounded-md mb-4">
          <div className="space-y-1">
            <Label className="text-xs">Date From</Label>
            <Input type="date" value={filterDateFrom}
              onChange={(e) => { setFilterDateFrom(e.target.value); setOffset(0); }} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Date To</Label>
            <Input type="date" value={filterDateTo}
              onChange={(e) => { setFilterDateTo(e.target.value); setOffset(0); }} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Account</Label>
            <Select value={filterAccountId} onValueChange={(v) => { setFilterAccountId(v); setOffset(0); }}>
              <SelectTrigger className="h-8"><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All accounts</SelectItem>
                {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Category</Label>
            <Select value={filterCategoryId} onValueChange={(v) => { setFilterCategoryId(v); setOffset(0); }}>
              <SelectTrigger className="h-8"><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-muted-foreground">
            {loading ? "Loading…" : (
              <span className="text-sm text-muted-foreground">
                {total > 0 ? `Showing ${transactions.length} of ${total}` : ""}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <p className="text-muted-foreground">No transactions found.</p>
              {typeFilter === "all" && filterAccountId === "all" && filterCategoryId === "all" && !debouncedSearch && (
                <a href="/transactions/new">
                  <Button variant="outline" size="sm">Record your first transaction</Button>
                </a>
              )}
              {(typeFilter !== "all" || filterAccountId !== "all" || filterCategoryId !== "all" || !!debouncedSearch) && (
                <p className="text-xs text-muted-foreground">Try adjusting your filters or search.</p>
              )}
            </div>
          ) : (
            <ul className="space-y-0 divide-y">
              {transactions.map((t) => (
                <li
                  key={t.id}
                  role="button"
                  tabIndex={0}
                  className="py-3 flex items-center justify-between cursor-pointer hover:bg-muted/50 -mx-2 px-2 rounded"
                  onClick={() => openEditSheet(t)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openEditSheet(t); } }}
                >
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">
                      {t.description || t.sub_type || t.type}
                    </p>
                    <p className="text-xs text-muted-foreground">{t.date}</p>
                    <p className="text-xs text-muted-foreground">
                      {accountMap.get(t.account_id) ?? "—"}
                      {t.category_id ? ` · ${categoryMap.get(t.category_id) ?? "—"}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      variant="secondary"
                      className={TYPE_COLORS[t.type]}
                    >
                      {t.type}
                    </Badge>
                    <span
                      className={`text-sm font-semibold tabular-nums ${
                        t.type === "income"
                          ? "text-green-600"
                          : t.type === "expense"
                          ? "text-red-500"
                          : "text-muted-foreground"
                      }`}
                    >
                      {t.type === "expense" ? "-" : ""}
                      {formatPeso(t.amount)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* Pagination */}
          {!loading && total > LIMIT && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - LIMIT))}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {Math.floor(offset / LIMIT) + 1} of {Math.ceil(total / LIMIT)}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={offset + LIMIT >= total}
                onClick={() => setOffset(offset + LIMIT)}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Transaction Sheet */}
      <Sheet open={editSheetOpen} onOpenChange={setEditSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Edit Transaction</SheetTitle>
            <SheetDescription>Update the transaction details below.</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 mt-4">
            {/* Account select */}
            <div className="space-y-1">
              <Label>Account</Label>
              <Select value={editForm.account_id} onValueChange={(v) => setEditForm((f) => ({ ...f, account_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Account" /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {/* Type select */}
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={editForm.type} onValueChange={(v) => setEditForm((f) => ({ ...f, type: v as "income" | "expense" | "transfer" }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="transfer">Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Category select */}
            <div className="space-y-1">
              <Label>Category</Label>
              <Select value={editForm.category_id} onValueChange={(v) => setEditForm((f) => ({ ...f, category_id: v }))}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {/* Amount */}
            <div className="space-y-1">
              <Label>Amount</Label>
              <Input type="number" step="0.01" min="0" value={editForm.amount}
                onChange={(e) => setEditForm((f) => ({ ...f, amount: e.target.value }))} />
            </div>
            {/* Date */}
            <div className="space-y-1">
              <Label>Date</Label>
              <Input type="date" value={editForm.date}
                onChange={(e) => setEditForm((f) => ({ ...f, date: e.target.value }))} />
            </div>
            {/* Description */}
            <div className="space-y-1">
              <Label>Description</Label>
              <Input value={editForm.description}
                onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            {/* Actions */}
            {saveError && <p className="text-sm text-destructive">{saveError}</p>}
            <div className="flex gap-2 pt-2">
              <Button className="flex-1" onClick={handleSave}>Save</Button>
              <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">Delete</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete transaction?</AlertDialogTitle>
                    <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
