"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { cn, formatPeso } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/app/CurrencyInput";
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

interface Institution {
  id: string;
  name: string;
  type: string;
  color: string | null;
}

interface Account {
  id: string;
  institution_id: string | null;
  institution: Institution | null;
  name: string;
  type: string;
  opening_balance: string;
  current_balance: string;
  currency: string;
  is_active: boolean;
}

const ACCOUNT_TYPES = [
  { value: "savings", label: "Savings" },
  { value: "checking", label: "Checking" },
  { value: "wallet", label: "Wallet" },
  { value: "credit_card", label: "Credit Card" },
  { value: "cash", label: "Cash" },
  { value: "loan", label: "Loan" },
] as const;

const TYPE_BADGE: Record<string, { label: string; className: string }> = {
  savings: { label: "Savings", className: "bg-accent-blue-dim text-accent-blue" },
  checking: { label: "Checking", className: "bg-accent-blue-dim text-accent-blue" },
  credit_card: { label: "Credit Card", className: "bg-accent-red-dim text-accent-red" },
  wallet: { label: "Wallet", className: "bg-accent-blue-dim text-accent-blue" },
  cash: { label: "Cash", className: "bg-accent-amber-dim text-accent-amber" },
  loan: { label: "Loan", className: "bg-muted text-muted-foreground" },
};

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [type, setType] = useState("savings");
  const [openingBalance, setOpeningBalance] = useState("0.00");
  const [institutionId, setInstitutionId] = useState("");

  const [loadError, setLoadError] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editAccount, setEditAccount] = useState<Account | null>(null);
  const [editName, setEditName] = useState("");
  const [editBalance, setEditBalance] = useState("0.00");
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  async function loadData() {
    try {
      const [accs, insts] = await Promise.all([
        api.get<Account[]>("/accounts"),
        api.get<Institution[]>("/institutions"),
      ]);
      setAccounts(accs);
      setInstitutions(insts);
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : "Failed to load accounts");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleCreate() {
    setSubmitting(true);
    setError(null);
    try {
      await api.post("/accounts", {
        name,
        type,
        opening_balance: openingBalance,
        institution_id: institutionId && institutionId !== "__none__" ? institutionId : null,
      });
      setOpen(false);
      setName("");
      setType("savings");
      setOpeningBalance("0.00");
      setInstitutionId("");
      await loadData();
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
    setType("savings");
    setOpeningBalance("0.00");
    setInstitutionId("");
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
      await loadData();
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
          <p className="text-sm text-muted-foreground mt-1">
            Manage your bank accounts and wallets
          </p>
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
            const badge = TYPE_BADGE[account.type] ?? {
              label: account.type,
              className: "bg-muted text-muted-foreground",
            };
            return (
              <button
                key={account.id}
                className="rounded-xl border bg-card p-5 card-interactive text-left w-full"
                onClick={() => openEditSheet(account)}
                aria-label={`Edit ${account.name}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
                      badge.className,
                    )}
                  >
                    {badge.label}
                  </span>
                </div>
                <p className="text-2xl font-bold tracking-tight text-foreground mb-1">
                  {formatPeso(account.current_balance)}
                </p>
                <p className="text-sm text-muted-foreground">{account.name}</p>
                {account.institution && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                    {account.institution.color && (
                      <span
                        className="inline-block w-2 h-2 rounded-full"
                        style={{ background: account.institution.color }}
                      />
                    )}
                    {account.institution.name}
                  </span>
                )}
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
              {ACCOUNT_TYPES.map(({ value, label }) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {type !== "cash" && (
          <div className="space-y-2">
            <Label>Institution</Label>
            <Select value={institutionId} onValueChange={setInstitutionId}>
              <SelectTrigger>
                <SelectValue placeholder="Select institution" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {institutions.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="account-opening-balance">Opening Balance</Label>
          <CurrencyInput
            id="account-opening-balance"
            value={openingBalance}
            onChange={setOpeningBalance}
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
          <Label htmlFor="edit-account-balance">Opening Balance</Label>
          <CurrencyInput
            id="edit-account-balance"
            value={editBalance}
            onChange={setEditBalance}
          />
        </div>
        {editError !== null && <p className="text-sm text-destructive">{editError}</p>}
      </CrudSheet>
    </div>
  );
}
