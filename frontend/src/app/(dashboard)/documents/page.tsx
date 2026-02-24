"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CrudSheet } from "@/components/app/CrudSheet";
import { PasteInput } from "@/components/app/PasteInput";
import { TransactionConfirm } from "@/components/app/TransactionConfirm";
import { BulkImportTable } from "@/components/app/BulkImportTable";
import { api } from "@/lib/api";
import { FileText, Copy, Check, Plus } from "lucide-react";
import type { ParsedTransaction, BulkParseResponse, PasteResult } from "@/types/parse";

interface Document {
  id: string;
  filename: string;
  document_type: "receipt" | "cc_statement" | "other";
  status: "pending" | "processing" | "done" | "failed";
  created_at: string;
}

interface Account { id: string; name: string; type: string; }
interface Category { id: string; name: string; type: string; }

function StatusBadge({ status }: { status: Document["status"] }) {
  const classes: Record<Document["status"], string> = {
    pending: "bg-muted text-muted-foreground",
    processing: "bg-accent-amber-dim text-accent-amber",
    done: "bg-accent-green-dim text-accent-green",
    failed: "bg-accent-red-dim text-accent-red",
  };
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${classes[status]}`}>
      {status}
    </span>
  );
}

export default function DocumentsPage() {
  const [selected, setSelected] = useState<Document | null>(null);
  const [parsedSingle, setParsedSingle] = useState<ParsedTransaction | null>(null);
  const [parsedBulk, setParsedBulk] = useState<BulkParseResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [docs, setDocs] = useState<Document[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [d, a, c] = await Promise.all([
        api.get<Document[]>("/documents"),
        api.get<Account[]>("/accounts"),
        api.get<Category[]>("/categories"),
      ]);
      setDocs(d);
      setAccounts(a);
      setCategories(c);
    } catch {
      setError("Failed to load documents.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadData(); }, []);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    const hasPending = docs.some((d) => d.status === "pending" || d.status === "processing");
    if (hasPending && !pollingRef.current) {
      pollingRef.current = setInterval(() => {
        api.get<Document[]>("/documents").then(setDocs).catch(() => {});
      }, 5000);
    } else if (!hasPending && pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    return () => {
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
    };
  }, [docs]);

  const defaultAccountId = accounts[0]?.id ?? "";

  const handleCopyPrompt = async (doc: Document) => {
    setCopyError(null);
    try {
      const data = await api.post<{ prompt: string }>(`/documents/${doc.id}/prompt`, {});
      await navigator.clipboard.writeText(data.prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      setCopyError(e instanceof Error ? e.message : "Failed to copy prompt.");
    }
  };

  const handleParsed = (result: PasteResult) => {
    if (result.kind === "single") { setParsedSingle(result.data); setParsedBulk(null); }
    else { setParsedBulk(result.data); setParsedSingle(null); }
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Documents</h1>
          <p className="text-sm text-muted-foreground mt-1">Your uploaded receipts and statements</p>
        </div>
        <Button asChild size="sm">
          <Link href="/scan"><Plus className="h-4 w-4 mr-1" />Upload</Link>
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
        </div>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : docs.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-border p-12 text-center space-y-3">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground" />
          <p className="text-lg font-medium">No documents yet</p>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Upload receipts or statements from the Scan page to get started
          </p>
          <Button size="sm" asChild><Link href="/scan">Go to Scan</Link></Button>
        </div>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="divide-y divide-border">
            {docs.map((doc) => (
              <button
                key={doc.id}
                className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted/50 transition-colors text-left"
                onClick={() => {
                  setSelected(doc);
                  setParsedSingle(null);
                  setParsedBulk(null);
                  setCopied(false);
                  setCopyError(null);
                }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{doc.filename}</p>
                    <p className="text-xs text-muted-foreground">{doc.document_type}</p>
                  </div>
                </div>
                <StatusBadge status={doc.status} />
              </button>
            ))}
          </div>
        </div>
      )}

      <CrudSheet
        open={!!selected}
        onOpenChange={(open) => { if (!open) handleClose(); }}
        title={selected?.filename ?? ""}
        description="Import transactions from this document"
        onSave={() => {}}
        footer={<></>}
      >
        {selected && (
          <div className="space-y-4">
            {!defaultAccountId && !loading && (
              <p className="text-sm text-destructive mb-2">
                No account found. Please add an account before importing transactions.
              </p>
            )}
            <Button variant="secondary" size="sm" className="w-full" onClick={() => handleCopyPrompt(selected)}>
              {copied ? <><Check className="mr-2 h-4 w-4" /> Copied!</> : <><Copy className="mr-2 h-4 w-4" /> Copy AI Prompt</>}
            </Button>
            {copyError && <p className="text-sm text-destructive">{copyError}</p>}
            {!parsedSingle && !parsedBulk && (
              <div>
                <p className="text-sm font-medium mb-2">Paste AI Response</p>
                {defaultAccountId ? (
                  <PasteInput bulk={isBulk} onParsed={handleParsed} />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {loading ? "Loading accounts..." : "Add an account first to import transactions."}
                  </p>
                )}
              </div>
            )}
            {parsedSingle && (
              <TransactionConfirm
                parsed={parsedSingle}
                accountId={defaultAccountId}
                documentId={selected.id}
                categories={categories}
                onSuccess={() => { handleClose(); void loadData(); }}
              />
            )}
            {parsedBulk && (
              <BulkImportTable
                rows={parsedBulk.transactions}
                accountId={defaultAccountId}
                accounts={accounts}
                documentId={selected.id}
                onSuccess={() => { handleClose(); void loadData(); }}
              />
            )}
          </div>
        )}
      </CrudSheet>
    </div>
  );
}
