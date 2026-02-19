"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import type { ParsedTransaction } from "@/types/parse";

interface Account {
  id: string;
  name: string;
  type: string;
}

interface BulkImportTableProps {
  rows: ParsedTransaction[];
  accountId: string;
  accounts?: Account[];
  documentId?: string;
  onSuccess: (count: number) => void;
}

export function BulkImportTable({
  rows,
  accountId,
  accounts,
  documentId,
  onSuccess,
}: BulkImportTableProps) {
  const [selected, setSelected] = useState<Set<number>>(
    new Set(rows.map((_, i) => i))
  );
  const [selectedAccountId, setSelectedAccountId] = useState(accountId);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (i: number) => {
    const next = new Set(selected);
    next.has(i) ? next.delete(i) : next.add(i);
    setSelected(next);
  };

  const handleImport = async () => {
    setImporting(true);
    setError(null);
    try {
      const toImport = rows.filter((_, i) => selected.has(i));
      const results = await Promise.allSettled(
        toImport.map((row) =>
          api.post("/transactions", {
            account_id: selectedAccountId,
            amount: row.amount,
            date: row.date,
            description: row.description ?? "",
            type: row.type ?? "expense",
            source: "paste_ai",
            ...(documentId ? { document_id: documentId } : {}),
          })
        )
      );
      const succeeded = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed > 0) {
        setError(
          `${succeeded} imported, ${failed} failed. Check failed rows and try again.`
        );
      }
      if (succeeded > 0) {
        onSuccess(succeeded);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed. Try again.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      {accounts && accounts.length > 1 && (
        <div className="space-y-1">
          <Label>Import to account</Label>
          <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="rounded-md border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="p-2 text-left w-8"></th>
              <th className="p-2 text-left">Date</th>
              <th className="p-2 text-left">Description</th>
              <th className="p-2 text-right">Amount</th>
              <th className="p-2 text-left">Type</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                <td className="p-2">
                  <input
                    type="checkbox"
                    checked={selected.has(i)}
                    onChange={() => toggle(i)}
                    aria-label={`Select row ${i + 1}`}
                  />
                </td>
                <td className="p-2">
                  {row.date ?? (
                    <span className="text-amber-500">?</span>
                  )}
                </td>
                <td className="p-2">{row.description ?? "—"}</td>
                <td className="p-2 text-right">
                  {row.amount != null ? (
                    `₱${row.amount}`
                  ) : (
                    <span className="text-amber-500">?</span>
                  )}
                </td>
                <td className="p-2">
                  <Badge variant="outline">{row.type ?? "?"}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button
        className="w-full"
        onClick={handleImport}
        disabled={importing || selected.size === 0}
      >
        {importing
          ? "Importing..."
          : `Import ${selected.size} transaction${selected.size !== 1 ? "s" : ""}`}
      </Button>
    </div>
  );
}
