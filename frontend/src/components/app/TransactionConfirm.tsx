"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";

interface ParsedTransaction {
  amount: string | null;
  date: string | null;
  description: string | null;
  type: string | null;
  confidence: "high" | "medium" | "low";
}

interface TransactionConfirmProps {
  parsed: ParsedTransaction;
  accountId: string;
  documentId?: string;
  onSuccess: () => void;
}

const confidenceVariant = {
  high: "default",
  medium: "secondary",
  low: "destructive",
} as const;

export function TransactionConfirm({
  parsed,
  accountId,
  documentId,
  onSuccess,
}: TransactionConfirmProps) {
  const [amount, setAmount] = useState(parsed.amount ?? "");
  const [date, setDate] = useState(parsed.date ?? "");
  const [description, setDescription] = useState(parsed.description ?? "");
  const [type, setType] = useState(parsed.type ?? "expense");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uncertain = parsed.confidence !== "high";

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.post("/transactions", {
        account_id: accountId,
        amount,
        date,
        description,
        type,
        source: "paste_ai",
        ...(documentId ? { document_id: documentId } : {}),
      });
      onSuccess();
    } catch {
      setError("Failed to save transaction. Check the fields and try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Confidence:</span>
        <Badge variant={confidenceVariant[parsed.confidence]}>
          {parsed.confidence}
        </Badge>
        {uncertain && (
          <span className="text-xs text-muted-foreground">
            Review highlighted fields
          </span>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <Label htmlFor="tc-amount">Amount</Label>
          <Input
            id="tc-amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={uncertain && !parsed.amount ? "border-amber-400 focus-visible:ring-amber-400" : ""}
          />
        </div>
        <div>
          <Label htmlFor="tc-date">Date</Label>
          <Input
            id="tc-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={uncertain && !parsed.date ? "border-amber-400 focus-visible:ring-amber-400" : ""}
          />
        </div>
        <div>
          <Label htmlFor="tc-desc">Description</Label>
          <Input
            id="tc-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="tc-type">Type</Label>
          <select
            id="tc-type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value="expense">Expense</option>
            <option value="income">Income</option>
            <option value="transfer">Transfer</option>
          </select>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button className="w-full" onClick={handleSubmit} disabled={saving}>
        {saving ? "Saving..." : "Add Transaction"}
      </Button>
    </div>
  );
}
