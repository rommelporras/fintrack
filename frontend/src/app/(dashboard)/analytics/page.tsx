"use client";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { api } from "@/lib/api";
import { formatPeso } from "@/lib/utils";
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
import { CategoryChip } from "@/components/app/TypeBadge";

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

const CHART_VARS = ["--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5"];

// SSR-safe defaults (light mode values from globals.css)
const SSR_CHART_COLORS = [
  "oklch(0.55 0.14 165)",
  "oklch(0.55 0.16 260)",
  "oklch(0.55 0.16 70)",
  "oklch(0.62 0.22 25)",
  "oklch(0.6 0.18 280)",
];

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

  // Read chart colors from CSS variables so they update with the theme
  const { resolvedTheme } = useTheme();
  const [themeColors, setThemeColors] = useState({
    chart: SSR_CHART_COLORS,
    grid: "oklch(0.92 0.005 260)",
    axis: "oklch(0.46 0.01 260)",
    tooltipBg: "oklch(1 0 0)",
    tooltipBorder: "oklch(0.92 0.005 260)",
    tooltipText: "oklch(0.15 0.01 260)",
  });
  useEffect(() => {
    const s = getComputedStyle(document.documentElement);
    const get = (v: string) => s.getPropertyValue(v).trim();
    setThemeColors({
      chart: CHART_VARS.map(get),
      grid: get("--border"),
      axis: get("--muted-foreground"),
      tooltipBg: get("--card"),
      tooltipBorder: get("--border"),
      tooltipText: get("--card-foreground"),
    });
  }, [resolvedTheme]);

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
    fill: item.color ?? themeColors.chart[index % themeColors.chart.length],
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

  const totalSpending = spending.reduce((sum, s) => sum + Number(s.total), 0);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">Understand your spending patterns</p>
      </div>

      {/* Month/Year selector */}
      <div className="flex items-center gap-3 flex-wrap">
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
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">
            Spending by Category — {monthLabel}
          </h2>
        </div>
        <div className="p-5">
          {loadingSpending ? (
            <Skeleton className="h-64 w-full" />
          ) : spendingError ? (
            <p className="py-8 text-center text-sm text-destructive">{spendingError}</p>
          ) : pieData.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No expenses recorded for {monthLabel}.
            </p>
          ) : (
            <div className="space-y-6">
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
                      contentStyle={{
                        backgroundColor: themeColors.tooltipBg,
                        border: `1px solid ${themeColors.tooltipBorder}`,
                        color: themeColors.tooltipText,
                        borderRadius: "8px",
                      }}
                      formatter={(value) => {
                        const n = typeof value === "number" ? value : Number(value);
                        return formatPeso(n);
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Category spending table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground uppercase tracking-wider border-b border-border">
                    <tr>
                      <th className="pb-2.5 text-left font-semibold">Category</th>
                      <th className="pb-2.5 text-right font-semibold">Amount</th>
                      <th className="pb-2.5 text-right font-semibold w-24">% of Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {spending.map((item, index) => {
                      const amount = Number(item.total);
                      const pct = totalSpending > 0 ? (amount / totalSpending) * 100 : 0;
                      const dotColor =
                        item.color ?? themeColors.chart[index % themeColors.chart.length];
                      return (
                        <tr key={item.category_id} className="group">
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-2">
                              <span
                                className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: dotColor }}
                              />
                              <CategoryChip name={item.category_name} />
                            </div>
                          </td>
                          <td className="py-3 text-right font-semibold tabular-nums text-foreground">
                            {formatPeso(amount)}
                          </td>
                          <td className="py-3 pl-4">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-primary"
                                  style={{ width: `${Math.min(pct, 100)}%` }}
                                />
                              </div>
                              <span className="text-xs text-muted-foreground tabular-nums w-9 text-right">
                                {pct.toFixed(0)}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Chart 2 — Per-Card Statement History */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">Statement History by Card</h2>
        </div>
        <div className="p-5">
          {loadingCards ? (
            <Skeleton className="h-64 w-full" />
          ) : cardsError ? (
            <p className="py-8 text-center text-sm text-destructive">{cardsError}</p>
          ) : cardHistory.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No credit cards or statements found.
            </p>
          ) : (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={themeColors.grid} />
                  <XAxis
                    dataKey="period"
                    tick={{ fill: themeColors.axis }}
                    axisLine={{ stroke: themeColors.grid }}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(v: number) => `₱${(v / 1000).toFixed(0)}k`}
                    tick={{ fill: themeColors.axis }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: themeColors.tooltipBg,
                      border: `1px solid ${themeColors.tooltipBorder}`,
                      color: themeColors.tooltipText,
                      borderRadius: "8px",
                    }}
                    formatter={(value) => {
                      const n = typeof value === "number" ? value : Number(value);
                      return formatPeso(n);
                    }}
                  />
                  <Legend wrapperStyle={{ color: themeColors.axis }} />
                  {cardHistory.map((card, index) => (
                    <Bar
                      key={card.card_label}
                      dataKey={card.card_label}
                      fill={themeColors.chart[index % themeColors.chart.length]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
