"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import type { ParsedTransaction } from "@/types/parse";

interface Category {
  id: string;
  name: string;
  type: string;
}

interface TransactionConfirmProps {
  parsed: ParsedTransaction;
  accountId: string;
  documentId?: string;
  categories?: Category[];
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
  categories = [],
  onSuccess,
}: TransactionConfirmProps) {
  const [amount, setAmount] = useState(parsed.amount ?? "");
  const [date, setDate] = useState(parsed.date ?? "");
  const [description, setDescription] = useState(parsed.description ?? "");
  const [type, setType] = useState(parsed.type ?? "expense");
  const [categoryId, setCategoryId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uncertain = parsed.confidence !== "high";

  const handleSubmit = async () => {
    // Validate required fields before posting
    const numericAmount = Number(amount);
    if (!amount || isNaN(numericAmount) || numericAmount <= 0) {
      setError("A valid amount is required.");
      return;
    }
    if (!date) {
      setError("A date is required.");
      return;
    }

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
        ...(categoryId ? { category_id: categoryId } : {}),
        ...(documentId ? { document_id: documentId } : {}),
      });
      onSuccess();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to save transaction. Try again."
      );
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
            className={
              uncertain && !parsed.amount
                ? "border-amber-400 focus-visible:ring-amber-400"
                : ""
            }
          />
        </div>
        <div>
          <Label htmlFor="tc-date">Date</Label>
          <Input
            id="tc-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={
              uncertain && !parsed.date
                ? "border-amber-400 focus-visible:ring-amber-400"
                : ""
            }
          />
        </div>
        <div>
          <Label htmlFor="tc-desc">Description</Label>
          <Input
            id="tc-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={
              uncertain && !parsed.description
                ? "border-amber-400 focus-visible:ring-amber-400"
                : ""
            }
          />
        </div>
        <div>
          <Label htmlFor="tc-type">Type</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger
              id="tc-type"
              className={
                uncertain && !parsed.type
                  ? "border-amber-400 focus:ring-amber-400"
                  : ""
              }
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="expense">Expense</SelectItem>
              <SelectItem value="income">Income</SelectItem>
              <SelectItem value="transfer">Transfer</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {categories.length > 0 && (
          <div>
            <Label htmlFor="tc-category">Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger id="tc-category">
                <SelectValue placeholder="Select category (optional)" />
              </SelectTrigger>
              <SelectContent>
                {categories
                  .filter((c) => c.type === type || c.type === "transfer")
                  .map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button className="w-full" onClick={handleSubmit} disabled={saving}>
        {saving ? "Saving..." : "Add Transaction"}
      </Button>
    </div>
  );
}
