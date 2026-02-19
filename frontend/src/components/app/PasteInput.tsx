"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import type { ParsedTransaction, BulkParseResponse, PasteResult } from "@/types/parse";

interface PasteInputProps {
  onParsed: (result: PasteResult) => void;
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
      if (bulk) {
        const data = await api.post<BulkParseResponse>("/parse/bulk", { text });
        onParsed({ kind: "bulk", data });
      } else {
        const data = await api.post<ParsedTransaction>("/parse/paste", { text });
        onParsed({ kind: "single", data });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to parse. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <Label htmlFor="paste-input">AI Response</Label>
      <textarea
        id="paste-input"
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
