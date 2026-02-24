"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { cn, formatPeso } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeftRight,
  CheckCircle2,
  Circle,
  Plus,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { StatCard } from "@/components/app/StatCard";
import { TypeBadge, TxnType } from "@/components/app/TypeBadge";

interface Summary {
  month: string;
  total_income: string;
  total_expenses: string;
  net: string;
}

interface Transaction {
  id: string;
  account_id: string;
  description: string;
  amount: string;
  type: "income" | "expense" | "transfer";
  date: string;
}

interface NetWorthTypeItem {
  type: string;
  total: string;
}

interface NetWorthData {
  total: string;
  by_type: NetWorthTypeItem[];
}

interface AccountItem {
  id: string;
  name: string;
}

interface CardItem {
  id: string;
  bank_name: string;
}

interface RecurringTransaction {
  id: string;
  amount: string;
  description: string;
  frequency: string;
  next_due_date: string;
  is_active: boolean;
  type: string;
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [netWorth, setNetWorth] = useState<NetWorthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [creditCards, setCreditCards] = useState<CardItem[]>([]);
  const [upcoming, setUpcoming] = useState<RecurringTransaction[]>([]);
  const [onboardingDismissed, setOnboardingDismissed] = useState(true); // default true to avoid flash

  useEffect(() => {
    async function load() {
      setError(null);
      try {
        const [s, txnData, nw, accs, cards, recurringData] = await Promise.all([
          api.get<Summary>("/dashboard/summary"),
          api.get<{ items: Transaction[]; total: number }>("/transactions?limit=10"),
          api.get<NetWorthData>("/dashboard/net-worth"),
          api.get<AccountItem[]>("/accounts"),
          api.get<CardItem[]>("/credit-cards"),
          api.get<RecurringTransaction[]>("/recurring-transactions?active=true&limit=5"),
        ]);
        setSummary(s);
        setTransactions(txnData.items);
        setNetWorth(nw);
        setAccounts(accs);
        setCreditCards(cards);
        setUpcoming(recurringData);
      } catch {
        setError("Failed to load dashboard data. Please check your connection.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    setOnboardingDismissed(localStorage.getItem("fintrack_onboarding_dismissed") === "true");
  }, []);

  const onboardingSteps = [
    { label: "Create your first account", href: "/accounts", done: accounts.length > 0 },
    { label: "Add a credit card", href: "/cards", done: creditCards.length > 0 },
    { label: "Record a transaction", href: "/transactions/new", done: transactions.length > 0 },
  ];
  const completedCount = onboardingSteps.filter((s) => s.done).length;
  const allComplete = completedCount === onboardingSteps.length;
  const showOnboarding = !loading && !onboardingDismissed && !allComplete;

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button onClick={() => { setLoading(true); setError(null); window.location.reload(); }}>
          Retry
        </Button>
      </div>
    );
  }

  const accountMap = new Map(accounts.map((a) => [a.id, a.name]));

  return (
    <div>
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {summary ? summary.month : "Overview"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitor your financial health
          </p>
        </div>
        <Link href="/transactions/new">
          <Button className="w-full sm:w-auto gap-2">
            <Plus className="h-4 w-4" />
            Add Transaction
          </Button>
        </Link>
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Monthly Income"
          value={summary ? formatPeso(summary.total_income) : "—"}
          icon={<TrendingUp className="h-4 w-4" />}
          accent="green"
          trend={summary ? "This month" : undefined}
          trendUp={true}
        />
        <StatCard
          label="Monthly Expenses"
          value={summary ? formatPeso(summary.total_expenses) : "—"}
          icon={<TrendingDown className="h-4 w-4" />}
          accent="red"
          trend={summary ? "This month" : undefined}
          trendUp={false}
        />
        <StatCard
          label="Net Cash Flow"
          value={summary ? formatPeso(summary.net) : "—"}
          icon={<ArrowLeftRight className="h-4 w-4" />}
          accent={summary && Number(summary.net) >= 0 ? "green" : "red"}
          trendUp={summary ? Number(summary.net) >= 0 : undefined}
        />
        <StatCard
          label="Net Worth"
          value={netWorth ? formatPeso(netWorth.total) : "—"}
          icon={<Wallet className="h-4 w-4" />}
          accent="green"
          featured={true}
        />
      </div>

      {/* Main 2-column section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Transactions — left, 2/3 width */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="font-semibold text-foreground">Recent Transactions</h2>
              <Link
                href="/transactions"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                View all →
              </Link>
            </div>
            {transactions.length === 0 ? (
              <p className="text-sm text-muted-foreground p-5">No transactions yet.</p>
            ) : (
              <div className="divide-y divide-border">
                {transactions.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between px-5 py-3.5 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={cn(
                          "w-9 h-9 rounded-full flex items-center justify-center shrink-0",
                          t.type === "income"
                            ? "bg-accent-green-dim text-accent-green"
                            : t.type === "expense"
                            ? "bg-accent-red-dim text-accent-red"
                            : "bg-accent-blue-dim text-accent-blue",
                        )}
                      >
                        <ArrowLeftRight className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {t.description || t.type}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t.date}
                          {accountMap.get(t.account_id) && (
                            <> · {accountMap.get(t.account_id)}</>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <p
                        className={cn(
                          "text-sm font-semibold tracking-tight",
                          t.type === "income"
                            ? "text-accent-green"
                            : t.type === "expense"
                            ? "text-accent-red"
                            : "text-muted-foreground",
                        )}
                      >
                        {t.type === "income" ? "+" : t.type === "expense" ? "-" : ""}
                        {formatPeso(t.amount)}
                      </p>
                      <TypeBadge type={t.type} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right sidebar widgets — 1/3 width */}
        <div className="space-y-6">
          {/* Get Started checklist — only when not dismissed and not all complete */}
          {showOnboarding && (
            <div className="rounded-xl border bg-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-foreground">Get Started</h2>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                    {completedCount}/{onboardingSteps.length}
                  </span>
                  <button
                    onClick={() => {
                      localStorage.setItem("fintrack_onboarding_dismissed", "true");
                      setOnboardingDismissed(true);
                    }}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Dismiss"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                {onboardingSteps.map((step) => (
                  <Link
                    key={step.href}
                    href={step.href}
                    className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted transition-colors"
                  >
                    {step.done ? (
                      <CheckCircle2 className="h-4 w-4 text-accent-green shrink-0" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                    <span
                      className={cn(
                        "text-sm flex-1",
                        step.done && "line-through text-muted-foreground",
                      )}
                    >
                      {step.label}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Upcoming Bills */}
          {upcoming.length > 0 && (
            <div className="rounded-xl border bg-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-foreground">Upcoming Bills</h2>
                <Link
                  href="/recurring"
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Manage
                </Link>
              </div>
              <div className="space-y-3">
                {upcoming.map((r) => (
                  <div key={r.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-accent-red-dim text-accent-red flex items-center justify-center font-bold text-xs shrink-0">
                        {(r.description || r.frequency).charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {r.description || r.frequency}
                        </p>
                        <p className="text-xs text-muted-foreground">Due {r.next_due_date}</p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold tracking-tight text-foreground">
                      {formatPeso(r.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
