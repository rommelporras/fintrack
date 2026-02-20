"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface CategorySpending {
  category_id: string;
  category_name: string;
  color: string | null;
  total: string;
}

interface StatementPeriod {
  period: string;
  total: string;
}

interface CardHistory {
  card_label: string;
  statements: StatementPeriod[];
}

function formatPeso(amount: number) {
  return `₱${amount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
}

const FALLBACK_COLORS = [
  "#6366f1", "#f59e0b", "#10b981", "#ef4444",
  "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6",
];

const CARD_COLORS = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#3b82f6"];

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];



export default function AnalyticsPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [yearInput, setYearInput] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [spending, setSpending] = useState<CategorySpending[]>([]);
  const [cardHistory, setCardHistory] = useState<CardHistory[]>([]);
  const [loadingSpending, setLoadingSpending] = useState(true);
  const [loadingCards, setLoadingCards] = useState(true);
  const [spendingError, setSpendingError] = useState<string | null>(null);
  const [cardsError, setCardsError] = useState<string | null>(null);

  useEffect(() => {
    setLoadingSpending(true);
    setSpendingError(null);
    api
      .get<CategorySpending[]>(
        `/analytics/spending-by-category?year=${year}&month=${month}`
      )
      .then(setSpending)
      .catch((e: unknown) =>
        setSpendingError(e instanceof Error ? e.message : "Failed to load spending data")
      )
      .finally(() => setLoadingSpending(false));
  }, [year, month]);

  useEffect(() => {
    api
      .get<CardHistory[]>("/analytics/statement-history")
      .then(setCardHistory)
      .catch((e: unknown) =>
        setCardsError(e instanceof Error ? e.message : "Failed to load statement history")
      )
      .finally(() => setLoadingCards(false));
  }, []);

  const pieData = spending.map((item, index) => ({
    name: item.category_name,
    value: Number(item.total),
    fill: item.color ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length],
  }));

  const allPeriods = Array.from(
    new Set(cardHistory.flatMap((c) => c.statements.map((s) => s.period)))
  ).sort();
  const barData = allPeriods.map((period) => {
    const entry: Record<string, string | number> = { period };
    for (const card of cardHistory) {
      const stmt = card.statements.find((s) => s.period === period);
      entry[card.card_label] = stmt ? Number(stmt.total) : 0;
    }
    return entry;
  });

  const monthLabel = `${MONTH_NAMES[month - 1]} ${year}`;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Analytics</h1>

      {/* Month/Year selector */}
      <div className="flex items-center gap-3">
        <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MONTH_NAMES.map((name, i) => (
              <SelectItem key={i + 1} value={String(i + 1)}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          className="w-24"
          value={yearInput}
          onChange={(e) => setYearInput(e.target.value)}
          onBlur={() => {
            const n = Number(yearInput);
            if (!isNaN(n) && n >= 2000 && n <= 2099) {
              setYear(n);
            } else {
              setYearInput(String(year));
            }
          }}
        />
      </div>

      {/* Chart 1 — Spending by Category */}
      <Card>
        <CardHeader>
          <CardTitle>Spending by Category — {monthLabel}</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingSpending ? (
            <Skeleton className="h-64 w-full" />
          ) : spendingError ? (
            <p className="py-8 text-center text-sm text-red-500">{spendingError}</p>
          ) : pieData.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No expenses recorded for {monthLabel}.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={110}
                      label={({ name, percent }: { name?: string; percent?: number }) =>
                        `${name ?? ""} ${((percent ?? 0) * 100).toFixed(0)}%`
                      }
                    >
                      {pieData.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => {
                        const n = typeof value === "number" ? value : Number(value);
                        return formatPeso(n);
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1">
                {spending.map((item, index) => (
                  <div key={item.category_id} className="flex justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-3 w-3 rounded-full"
                        style={{
                          backgroundColor:
                            item.color ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length],
                        }}
                      />
                      <span>{item.category_name}</span>
                    </div>
                    <span className="font-medium">
                      {formatPeso(Number(item.total))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Chart 2 — Per-Card Statement History */}
      <Card>
        <CardHeader>
          <CardTitle>Statement History by Card</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingCards ? (
            <Skeleton className="h-64 w-full" />
          ) : cardsError ? (
            <p className="py-8 text-center text-sm text-red-500">{cardsError}</p>
          ) : cardHistory.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No credit cards or statements found.
            </p>
          ) : (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis
                    tickFormatter={(v: number) => `₱${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(value) => {
                      const n = typeof value === "number" ? value : Number(value);
                      return formatPeso(n);
                    }}
                  />
                  <Legend />
                  {cardHistory.map((card, index) => (
                    <Bar
                      key={card.card_label}
                      dataKey={card.card_label}
                      fill={CARD_COLORS[index % CARD_COLORS.length]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
