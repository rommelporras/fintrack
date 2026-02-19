"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

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

function formatPeso(amount: string | number) {
  return `₱${Number(amount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [s, t] = await Promise.all([
          api.get<Summary>("/dashboard/summary"),
          api.get<Transaction[]>("/transactions?limit=10"),
        ]);
        setSummary(s);
        setTransactions(t);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
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
        <Card>
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
        <Card>
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
        <Card>
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

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
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
