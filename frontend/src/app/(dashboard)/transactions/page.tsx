"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { cn, formatPeso } from "@/lib/utils";
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
import {
  Plus,
  Filter,
  ChevronDown,
  ChevronUp,
  Search,
  MoreHorizontal,
} from "lucide-react";
import { CrudSheet } from "@/components/app/CrudSheet";
import { TypeBadge, CategoryChip, TxnType } from "@/components/app/TypeBadge";

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

interface TransactionListResponse {
  items: Transaction[];
  total: number;
}

const LIMIT = 50;

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
    }).catch(() => {
      // non-fatal — filters still work, dropdowns will be empty
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
    try {
      await api.delete(`/transactions/${selectedTxn.id}`);
      setDeleteDialogOpen(false);
      setEditSheetOpen(false);
      setSelectedTxn(null);
      await load();
    } catch (e: unknown) {
      setDeleteDialogOpen(false);
      setSaveError(e instanceof Error ? e.message : "Failed to delete transaction.");
    }
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

  const accountMap = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);
  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Transactions</h1>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-sm text-muted-foreground">This Month</p>
          </div>
        </div>
        <Button asChild className="w-full sm:w-auto gap-2">
          <Link href="/transactions/new">
            <Plus className="h-4 w-4" />
            New Transaction
          </Link>
        </Button>
      </div>

      {/* Filter toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search transactions…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setOffset(0); }}
            className="pl-9"
          />
        </div>
        {/* Type filter */}
        <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setOffset(0); }}>
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="income">Income</SelectItem>
            <SelectItem value="expense">Expense</SelectItem>
            <SelectItem value="transfer">Transfer</SelectItem>
          </SelectContent>
        </Select>
        {/* Filters toggle */}
        <Button
          variant="outline"
          onClick={() => setFiltersOpen((o) => !o)}
          className="gap-2 shrink-0"
        >
          <Filter className="h-4 w-4" />
          Filters
          {filtersOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
        {(filterDateFrom || filterDateTo || filterAccountId !== "all" || filterCategoryId !== "all") && (
          <Button variant="ghost" onClick={clearFilters} className="shrink-0">
            Clear
          </Button>
        )}
      </div>

      {/* Expanded filter panel */}
      {filtersOpen && (
        <div className="grid grid-cols-2 gap-3 p-4 border rounded-xl mb-4 bg-card">
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

      {/* Transaction table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground uppercase tracking-wider bg-muted/50 border-b border-border">
              <tr>
                <th className="px-5 py-3.5 text-left font-semibold">Date</th>
                <th className="px-5 py-3.5 text-left font-semibold">Description</th>
                <th className="px-5 py-3.5 text-left font-semibold hidden sm:table-cell">Category</th>
                <th className="px-5 py-3.5 text-left font-semibold hidden md:table-cell">Account</th>
                <th className="px-5 py-3.5 text-right font-semibold">Amount</th>
                <th className="px-4 py-3.5 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-muted-foreground text-sm">
                    <div className="space-y-3">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Skeleton key={i} className="h-8 w-full" />
                      ))}
                    </div>
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center text-muted-foreground text-sm">
                    No transactions found.
                  </td>
                </tr>
              ) : (
                transactions.map((t) => (
                  <tr
                    key={t.id}
                    className="hover:bg-muted/30 transition-colors group cursor-pointer"
                    onClick={() => openEditSheet(t)}
                  >
                    <td className="px-5 py-3.5 whitespace-nowrap font-medium text-foreground">
                      {t.date}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-foreground">
                          {t.description || t.sub_type || t.type}
                        </span>
                        {(t.type === "income" || t.type === "transfer") && (
                          <TypeBadge type={t.type} />
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 hidden sm:table-cell">
                      {t.category_id ? (
                        <CategoryChip
                          name={categoryMap.get(t.category_id) ?? "—"}
                          type={t.type as TxnType}
                        />
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground hidden md:table-cell">
                      {accountMap.get(t.account_id) ?? "—"}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className={cn(
                        "font-semibold tabular-nums",
                        t.type === "income"
                          ? "text-accent-green"
                          : t.type === "expense"
                          ? "text-foreground"
                          : "text-muted-foreground",
                      )}>
                        {t.type === "expense" ? "-" : ""}
                        {formatPeso(t.amount)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <button
                        className="p-1.5 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity rounded"
                        onClick={(e) => { e.stopPropagation(); openEditSheet(t); }}
                        aria-label="Edit"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        {!loading && total > LIMIT && (
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-border bg-card">
            <p className="text-sm text-muted-foreground hidden sm:block">
              Showing {Math.min(offset + 1, total)}–{Math.min(offset + LIMIT, total)} of {total}
            </p>
            <div className="flex items-center gap-2 ml-auto">
              <Button
                variant="outline"
                size="sm"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - LIMIT))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={offset + LIMIT >= total}
                onClick={() => setOffset(offset + LIMIT)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Edit Transaction Sheet */}
      <CrudSheet
        open={editSheetOpen}
        onOpenChange={setEditSheetOpen}
        title={selectedTxn ? "Edit Transaction" : "Add Transaction"}
        description="Update the transaction details below."
        onSave={handleSave}
        footer={
          <div className="flex items-center justify-between w-full">
            {selectedTxn && (
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
            )}
            <div className="flex gap-3 ml-auto">
              <Button variant="outline" onClick={() => setEditSheetOpen(false)}>Cancel</Button>
              <Button onClick={handleSave}>Save</Button>
            </div>
          </div>
        }
      >
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
        {saveError && <p className="text-sm text-destructive">{saveError}</p>}
      </CrudSheet>
    </div>
  );
}
