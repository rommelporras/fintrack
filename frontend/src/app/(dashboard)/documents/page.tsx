"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { PasteInput } from "@/components/app/PasteInput";
import { TransactionConfirm } from "@/components/app/TransactionConfirm";
import { BulkImportTable } from "@/components/app/BulkImportTable";
import { api } from "@/lib/api";
import { FileText, Copy, Check } from "lucide-react";
import type { ParsedTransaction, BulkParseResponse, PasteResult } from "@/types/parse";

interface Document {
  id: string;
  filename: string;
  document_type: "receipt" | "cc_statement" | "other";
  status: "pending" | "processing" | "done" | "failed";
  created_at: string;
}

interface Account {
  id: string;
  name: string;
}

const statusVariant: Record<
  Document["status"],
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending: "secondary",
  processing: "default",
  done: "outline",
  failed: "destructive",
};

export default function DocumentsPage() {
  const [selected, setSelected] = useState<Document | null>(null);
  const [parsedSingle, setParsedSingle] = useState<ParsedTransaction | null>(null);
  const [parsedBulk, setParsedBulk] = useState<BulkParseResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  const { data: docs = [], refetch } = useQuery({
    queryKey: ["documents"],
    queryFn: () => api.get<Document[]>("/documents"),
  });

  const { data: accounts = [], isLoading: accountsLoading } = useQuery({
    queryKey: ["accounts"],
    queryFn: () => api.get<Account[]>("/accounts"),
  });

  const defaultAccountId = accounts[0]?.id ?? "";

  const handleCopyPrompt = async (doc: Document) => {
    setCopyError(null);
    try {
      const data = await api.post<{ prompt: string }>(
        `/documents/${doc.id}/prompt`,
        {}
      );
      await navigator.clipboard.writeText(data.prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      setCopyError(
        e instanceof Error ? e.message : "Failed to copy prompt."
      );
    }
  };

  const handleParsed = (result: PasteResult) => {
    if (result.kind === "single") {
      setParsedSingle(result.data);
      setParsedBulk(null);
    } else {
      setParsedBulk(result.data);
      setParsedSingle(null);
    }
  };

  const handleClose = () => {
    setSelected(null);
    setParsedSingle(null);
    setParsedBulk(null);
    setCopied(false);
    setCopyError(null);
  };

  const isBulk = selected?.document_type === "cc_statement";

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Documents</h1>
        <Button
          variant="outline"
          onClick={() => (window.location.href = "/scan")}
        >
          + Upload
        </Button>
      </div>

      {docs.length === 0 && (
        <p className="text-muted-foreground text-sm">
          No documents yet. Use the Scan page to upload receipts or statements.
        </p>
      )}

      <div className="space-y-2">
        {docs.map((doc) => (
          <div
            key={doc.id}
            className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30 cursor-pointer"
            onClick={() => {
              setSelected(doc);
              setParsedSingle(null);
              setParsedBulk(null);
              setCopied(false);
              setCopyError(null);
            }}
          >
            <div className="flex items-center gap-3">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{doc.filename}</p>
                <p className="text-xs text-muted-foreground">
                  {doc.document_type}
                </p>
              </div>
            </div>
            <Badge variant={statusVariant[doc.status]}>{doc.status}</Badge>
          </div>
        ))}
      </div>

      <Sheet open={!!selected} onOpenChange={(open) => { if (!open) handleClose(); }}>
        <SheetContent className="w-[420px] overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>{selected.filename}</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-4">
                {!defaultAccountId && !accountsLoading && (
                  <p className="text-sm text-destructive mb-2">
                    No account found. Please add an account before importing transactions.
                  </p>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full"
                  onClick={() => handleCopyPrompt(selected)}
                >
                  {copied ? (
                    <>
                      <Check className="mr-2 h-4 w-4" /> Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="mr-2 h-4 w-4" /> Copy AI Prompt
                    </>
                  )}
                </Button>
                {copyError && (
                  <p className="text-sm text-destructive">{copyError}</p>
                )}

                {!parsedSingle && !parsedBulk && (
                  <div>
                    <p className="text-sm font-medium mb-2">Paste AI Response</p>
                    {defaultAccountId ? (
                      <PasteInput bulk={isBulk} onParsed={handleParsed} />
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {accountsLoading ? "Loading accounts..." : "Add an account first to import transactions."}
                      </p>
                    )}
                  </div>
                )}

                {parsedSingle && (
                  <TransactionConfirm
                    parsed={parsedSingle}
                    accountId={defaultAccountId}
                    documentId={selected.id}
                    onSuccess={() => { handleClose(); void refetch(); }}
                  />
                )}

                {parsedBulk && (
                  <BulkImportTable
                    rows={parsedBulk.transactions}
                    accountId={defaultAccountId}
                    documentId={selected.id}
                    onSuccess={() => { handleClose(); void refetch(); }}
                  />
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
