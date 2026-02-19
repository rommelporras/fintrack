"use client";

import { useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { Camera, Upload, Copy, Check } from "lucide-react";

type DocType = "receipt" | "cc_statement" | "other";

interface DocumentResponse {
  id: string;
  filename: string;
  document_type: DocType;
  status: string;
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback((f: File) => {
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setDocId(null);
    setPrompt(null);
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
    try {
      const data = await api.post<{ prompt: string }>(`/documents/${docId}/prompt`, {});
      await navigator.clipboard.writeText(data.prompt);
      setPrompt(data.prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Failed to copy prompt.");
    }
  };

  return (
    <div className="max-w-lg mx-auto space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Scan Receipt or Statement</h1>

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

      {preview && (
        <Card>
          <CardContent className="pt-4">
            <img
              src={preview}
              alt="Preview"
              className="w-full rounded-md object-contain max-h-64"
            />
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

      {error && <p className="text-sm text-destructive">{error}</p>}

      {file && !docId && (
        <Button className="w-full" onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Document"}
        </Button>
      )}

      {docId && (
        <Button className="w-full" variant="secondary" onClick={handleCopyPrompt}>
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
      )}

      {docId && (
        <p className="text-sm text-muted-foreground text-center">
          Document saved. Copy the prompt, paste it with your file into Claude.ai
          or Gemini, then come back to paste the response.
        </p>
      )}

      {prompt && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">AI Prompt</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs font-mono text-muted-foreground break-all">{prompt}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
