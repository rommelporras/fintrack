"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { cn, formatPeso } from "@/lib/utils";
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
import { Plus } from "lucide-react";
import { CrudSheet } from "@/components/app/CrudSheet";

interface Account {
  id: string;
  name: string;
  type: string;
  opening_balance: string;
  current_balance: string;
  currency: string;
  is_active: boolean;
}

const TYPE_BADGE: Record<string, { label: string; className: string }> = {
  bank: { label: "Bank", className: "bg-accent-blue-dim text-accent-blue" },
  credit_card: { label: "Credit Card", className: "bg-accent-red-dim text-accent-red" },
  digital_wallet: { label: "Digital Wallet", className: "bg-accent-blue-dim text-accent-blue" },
  cash: { label: "Cash", className: "bg-accent-amber-dim text-accent-amber" },
};

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [type, setType] = useState("bank");
  const [openingBalance, setOpeningBalance] = useState("0.00");

  const [loadError, setLoadError] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editAccount, setEditAccount] = useState<Account | null>(null);
  const [editName, setEditName] = useState("");
  const [editBalance, setEditBalance] = useState("0.00");
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  async function loadAccounts() {
    try {
      const data = await api.get<Account[]>("/accounts");
      setAccounts(data);
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : "Failed to load accounts");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAccounts(); }, []);

  async function handleCreate() {
    setSubmitting(true);
    setError(null);
    try {
      await api.post("/accounts", { name, type, opening_balance: openingBalance });
      setOpen(false);
      setName("");
      setType("bank");
      setOpeningBalance("0.00");
      await loadAccounts();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create account");
    } finally {
      setSubmitting(false);
    }
  }

  function openEditSheet(account: Account) {
    setEditAccount(account);
    setEditName(account.name);
    setEditBalance(account.opening_balance);
    setEditOpen(true);
    setEditError(null);
  }

  function openAddSheet() {
    setName("");
    setType("bank");
    setOpeningBalance("0.00");
    setError(null);
    setOpen(true);
  }

  async function handleEdit() {
    if (!editAccount) return;
    setEditSubmitting(true);
    setEditError(null);
    try {
      await api.patch(`/accounts/${editAccount.id}`, {
        name: editName,
        opening_balance: editBalance,
      });
      setEditOpen(false);
      setEditAccount(null);
      await loadAccounts();
    } catch (e: unknown) {
      setEditError(e instanceof Error ? e.message : "Failed to update account");
    } finally {
      setEditSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Accounts</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your bank accounts and wallets</p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      ) : loadError !== null ? (
        <p className="text-sm text-destructive">{loadError}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {accounts.map((account) => {
            const badge = TYPE_BADGE[account.type] ?? { label: account.type, className: "bg-muted text-muted-foreground" };
            return (
              <button
                key={account.id}
                className="rounded-xl border bg-card p-5 card-interactive text-left w-full"
                onClick={() => openEditSheet(account)}
                aria-label={`Edit ${account.name}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <span className={cn(
                    "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
                    badge.className,
                  )}>
                    {badge.label}
                  </span>
                </div>
                <p className="text-2xl font-bold tracking-tight text-foreground mb-1">
                  {formatPeso(account.current_balance)}
                </p>
                <p className="text-sm text-muted-foreground">{account.name}</p>
              </button>
            );
          })}

          <button
            onClick={() => openAddSheet()}
            className="rounded-xl border-2 border-dashed border-border bg-transparent p-5 card-interactive flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground hover:border-border-hover min-h-[120px]"
          >
            <Plus className="h-6 w-6" />
            <span className="text-sm font-medium">Add Account</span>
          </button>
        </div>
      )}

      {/* Add Account sheet */}
      <CrudSheet
        open={open}
        onOpenChange={setOpen}
        title="New Account"
        description="Add a new bank account or wallet to track"
        onSave={handleCreate}
        saveLabel={submitting ? "Creating…" : "Create Account"}
        saveDisabled={submitting}
      >
        <div className="space-y-2">
          <Label htmlFor="account-name">Name</Label>
          <Input
            id="account-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="BDO Savings"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="account-type">Type</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger id="account-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bank">Bank</SelectItem>
              <SelectItem value="digital_wallet">Digital Wallet</SelectItem>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="credit_card">Credit Card</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="account-opening-balance">Opening Balance (₱)</Label>
          <Input
            id="account-opening-balance"
            type="number"
            step="0.01"
            value={openingBalance}
            onChange={(e) => setOpeningBalance(e.target.value)}
          />
        </div>
        {error !== null && <p className="text-sm text-destructive">{error}</p>}
      </CrudSheet>

      {/* Edit Account sheet */}
      <CrudSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        title="Edit Account"
        description={editAccount ? `Editing ${editAccount.name}` : "Edit account details"}
        onSave={handleEdit}
        saveLabel={editSubmitting ? "Saving…" : "Save Changes"}
        saveDisabled={editSubmitting}
      >
        <div className="space-y-2">
          <Label htmlFor="edit-account-name">Name</Label>
          <Input
            id="edit-account-name"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-account-balance">Opening Balance (₱)</Label>
          <Input
            id="edit-account-balance"
            type="number"
            step="0.01"
            value={editBalance}
            onChange={(e) => setEditBalance(e.target.value)}
          />
        </div>
        {editError !== null && <p className="text-sm text-destructive">{editError}</p>}
      </CrudSheet>
    </div>
  );
}
