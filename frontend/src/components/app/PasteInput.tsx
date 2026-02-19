"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

interface ParsedTransaction {
  amount: string | null;
  date: string | null;
  description: string | null;
  type: string | null;
  category_hint: string | null;
  confidence: "high" | "medium" | "low";
}

interface BulkParseResponse {
  transactions: ParsedTransaction[];
  count: number;
}

interface PasteInputProps {
  onParsed: (result: ParsedTransaction | BulkParseResponse) => void;
  bulk?: boolean;
}

export function PasteInput({ onParsed, bulk = false }: PasteInputProps) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleParse = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const endpoint = bulk ? "/parse/bulk" : "/parse/paste";
      const result = bulk
        ? await api.post<BulkParseResponse>(endpoint, { text })
        : await api.post<ParsedTransaction>(endpoint, { text });
      onParsed(result);
    } catch {
      setError("Failed to parse. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <textarea
        placeholder="Paste the AI response here (JSON or plain text)..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button
        onClick={handleParse}
        disabled={!text.trim() || loading}
        className="w-full"
      >
        {loading ? "Parsing..." : "Parse"}
      </Button>
    </div>
  );
}
