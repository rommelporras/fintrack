"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatPeso } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Circle, ChevronRight, X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface Summary {
  month: string;
  total_income: string;
  total_expenses: string;
  net: string;
}

interface Transaction {
  id: string;
  description: string;
  amount: string;
  type: string;
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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">
        {summary ? summary.month : "Dashboard"}
      </h1>

      {/* Monthly Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Income
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              {summary ? formatPeso(summary.total_income) : "—"}
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Expenses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-500">
              {summary ? formatPeso(summary.total_expenses) : "—"}
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-teal-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Net
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={`text-2xl font-bold ${
                summary && Number(summary.net) >= 0
                  ? "text-green-600"
                  : "text-red-500"
              }`}
            >
              {summary ? formatPeso(summary.net) : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Net Worth */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Net Worth
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">
            {netWorth ? formatPeso(netWorth.total) : "—"}
          </p>
          {netWorth && netWorth.by_type.length > 0 && (
            <div className="mt-2 space-y-1">
              {netWorth.by_type.map((item) => (
                <div
                  key={item.type}
                  className="flex justify-between text-sm text-muted-foreground"
                >
                  <span className="capitalize">{item.type.replaceAll("_", " ")}</span>
                  <span>{formatPeso(item.total)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upcoming Recurring */}
      {upcoming.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Upcoming Recurring</CardTitle>
            <Link
              href="/recurring"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              View all
            </Link>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {upcoming.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between py-1.5 border-b last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {r.description || r.frequency}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Due {r.next_due_date}
                    </p>
                  </div>
                  <span
                    className={`text-sm font-semibold ${r.type === "income" ? "text-green-600" : "text-red-500"}`}
                  >
                    {formatPeso(r.amount)}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Onboarding checklist */}
      {showOnboarding && (
        <Card className="border-dashed">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Get Started</CardTitle>
              <button
                onClick={() => {
                  localStorage.setItem("fintrack_onboarding_dismissed", "true");
                  setOnboardingDismissed(true);
                }}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Dismiss onboarding"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            {onboardingSteps.map((step) => (
              <Link
                key={step.href}
                href={step.href}
                className="flex items-center gap-3 rounded-md px-2 py-2.5 hover:bg-muted transition-colors"
              >
                {step.done ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
                )}
                <span className={step.done ? "text-sm text-muted-foreground line-through" : "text-sm"}>
                  {step.label}
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto shrink-0" />
              </Link>
            ))}
            <p className="text-xs text-muted-foreground pt-2">
              {completedCount} of {onboardingSteps.length} complete
            </p>
          </CardContent>
        </Card>
      )}

      {/* Recent Transactions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Transactions</CardTitle>
          <Link
            href="/transactions"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            View all
          </Link>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No transactions yet.</p>
          ) : (
            <ul className="space-y-2">
              {transactions.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between py-1.5 border-b last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {t.description || t.type}
                    </p>
                    <p className="text-xs text-muted-foreground">{t.date}</p>
                  </div>
                  <span
                    className={`text-sm font-semibold ${
                      t.type === "income"
                        ? "text-green-600"
                        : t.type === "expense"
                        ? "text-red-500"
                        : "text-muted-foreground"
                    }`}
                  >
                    {t.type === "income" ? "+" : t.type === "expense" ? "-" : ""}
                    {formatPeso(t.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
