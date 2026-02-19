"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PasteInput } from "@/components/app/PasteInput";
import { TransactionConfirm } from "@/components/app/TransactionConfirm";
import { BulkImportTable } from "@/components/app/BulkImportTable";
import { api } from "@/lib/api";
import { Camera, Upload, Copy, Check, FileText, CheckCircle2 } from "lucide-react";
import type { ParsedTransaction, BulkParseResponse, PasteResult } from "@/types/parse";

type DocType = "receipt" | "cc_statement" | "other";

interface DocumentResponse {
  id: string;
  filename: string;
  document_type: DocType;
  status: string;
}

interface Account {
  id: string;
  name: string;
  type: string;
}

interface Category {
  id: string;
  name: string;
  type: string;
}

export default function ScanPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<DocType>("receipt");
  const [docId, setDocId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copying, setCopying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");

  const [parsedSingle, setParsedSingle] = useState<ParsedTransaction | null>(null);
  const [parsedBulk, setParsedBulk] = useState<BulkParseResponse | null>(null);
  const [importedCount, setImportedCount] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<Account[]>("/accounts"),
      api.get<Category[]>("/categories"),
    ]).then(([accs, cats]) => {
      setAccounts(accs);
      setCategories(cats);
      if (accs.length > 0) setSelectedAccountId(accs[0].id);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const handleFile = useCallback((f: File) => {
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setDocId(null);
    setPrompt(null);
    setCopied(false);
    setParsedSingle(null);
    setParsedBulk(null);
    setImportedCount(null);
    setError(null);
  }, []);

  const handleSave = async () => {
    if (!file) return;
    setSaving(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("document_type", docType);
      const doc = await api.upload<DocumentResponse>("/documents/upload", form);
      setDocId(doc.id);
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleCopyPrompt = async () => {
    if (!docId) return;
    setCopying(true);
    try {
      const data = await api.post<{ prompt: string }>(`/documents/${docId}/prompt`, {});
      await navigator.clipboard.writeText(data.prompt);
      setPrompt(data.prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Failed to copy prompt.");
    } finally {
      setCopying(false);
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

  const handleReset = () => {
    setFile(null);
    setPreview(null);
    setDocId(null);
    setPrompt(null);
    setCopied(false);
    setParsedSingle(null);
    setParsedBulk(null);
    setImportedCount(null);
    setError(null);
  };

  const isBulk = docType === "cc_statement";

  // Success state
  if (importedCount !== null) {
    return (
      <div className="max-w-lg mx-auto p-6 space-y-6">
        <div className="text-center space-y-3 py-8">
          <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
          <p className="text-xl font-semibold">
            {importedCount === 1
              ? "1 transaction imported"
              : `${importedCount} transactions imported`}
          </p>
          <p className="text-muted-foreground text-sm">
            They&apos;ve been added to your transactions list.
          </p>
        </div>
        <Button className="w-full" onClick={handleReset}>
          Scan Another
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Scan Receipt or Statement</h1>

      {/* Step 1: Upload */}
      {!docId && (
        <>
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => cameraInputRef.current?.click()}
            >
              <Camera className="mr-2 h-4 w-4" /> Take Photo
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mr-2 h-4 w-4" /> Upload File
            </Button>
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </div>

          {file && preview && (
            <Card>
              <CardContent className="pt-4">
                {file.type === "application/pdf" ? (
                  <div className="flex items-center gap-3 p-4 bg-muted rounded-md">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                    <p className="text-sm font-medium">{file.name}</p>
                  </div>
                ) : (
                  <img
                    src={preview}
                    alt={file.name}
                    className="w-full rounded-md object-contain max-h-64"
                  />
                )}
              </CardContent>
            </Card>
          )}

          {file && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Document Type</CardTitle>
              </CardHeader>
              <CardContent className="flex gap-3">
                {(["receipt", "cc_statement", "other"] as DocType[]).map((t) => (
                  <Badge
                    key={t}
                    variant={docType === t ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => setDocType(t)}
                  >
                    {t === "cc_statement"
                      ? "CC Statement"
                      : t.charAt(0).toUpperCase() + t.slice(1)}
                  </Badge>
                ))}
              </CardContent>
            </Card>
          )}

          {accounts.length > 1 && file && (
            <div className="space-y-1.5">
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

          {error && <p className="text-sm text-destructive">{error}</p>}

          {file && (
            <Button className="w-full" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Document"}
            </Button>
          )}
        </>
      )}

      {/* Step 2: Copy prompt + paste AI response */}
      {docId && !parsedSingle && !parsedBulk && (
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-4 space-y-3">
              <p className="text-sm font-medium">Step 1 — Copy the AI prompt</p>
              <Button
                className="w-full"
                variant="secondary"
                onClick={handleCopyPrompt}
                disabled={copying}
              >
                {copied ? (
                  <><Check className="mr-2 h-4 w-4" /> Copied!</>
                ) : (
                  <><Copy className="mr-2 h-4 w-4" /> {copying ? "Copying..." : "Copy AI Prompt"}</>
                )}
              </Button>
              <p className="text-xs text-muted-foreground">
                Open Claude.ai or Gemini, attach your file, paste the prompt, and send.
              </p>
            </CardContent>
          </Card>

          {prompt && (
            <Card>
              <CardContent className="pt-4 space-y-3">
                <p className="text-sm font-medium">Step 2 — Paste the AI response</p>
                <PasteInput bulk={isBulk} onParsed={handleParsed} />
              </CardContent>
            </Card>
          )}

          {!prompt && (
            <p className="text-xs text-muted-foreground text-center">
              Copy the prompt first, then come back to paste the response.
            </p>
          )}
        </div>
      )}

      {/* Step 3: Review and import */}
      {docId && parsedSingle && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Review Transaction</CardTitle>
          </CardHeader>
          <CardContent>
            <TransactionConfirm
              parsed={parsedSingle}
              accountId={selectedAccountId}
              documentId={docId}
              categories={categories}
              onSuccess={() => setImportedCount(1)}
            />
          </CardContent>
        </Card>
      )}

      {docId && parsedBulk && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Review Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <BulkImportTable
              rows={parsedBulk.transactions}
              accountId={selectedAccountId}
              accounts={accounts}
              documentId={docId}
              onSuccess={(count) => setImportedCount(count)}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
