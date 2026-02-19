"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";

interface Transaction {
  id: string;
  description: string;
  amount: string;
  type: "income" | "expense" | "transfer";
  sub_type: string | null;
  date: string;
  category_id: string | null;
}

function formatPeso(amount: string | number) {
  return `₱${Number(amount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
}

const TYPE_COLORS: Record<string, string> = {
  income: "bg-green-100 text-green-800",
  expense: "bg-red-100 text-red-800",
  transfer: "bg-blue-100 text-blue-800",
};

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [offset, setOffset] = useState(0);
  const LIMIT = 50;

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          limit: String(LIMIT),
          offset: String(offset),
        });
        if (typeFilter !== "all") params.set("type", typeFilter);
        setTransactions(
          await api.get<Transaction[]>(`/transactions?${params}`)
        );
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [typeFilter, offset]);

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

      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-muted-foreground">
            {loading ? "Loading…" : `${transactions.length} transactions`}
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
            <p className="text-sm text-muted-foreground">No transactions found.</p>
          ) : (
            <ul className="space-y-0 divide-y">
              {transactions.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between py-3"
                >
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">
                      {t.description || t.sub_type || t.type}
                    </p>
                    <p className="text-xs text-muted-foreground">{t.date}</p>
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
          {!loading && (
            <div className="flex justify-between mt-4 pt-4 border-t">
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
                disabled={transactions.length < LIMIT}
                onClick={() => setOffset(offset + LIMIT)}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
