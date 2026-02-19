export interface ParsedTransaction {
  amount: string | null;
  date: string | null;
  description: string | null;
  type: string | null;
  category_hint: string | null;
  confidence: "high" | "medium" | "low";
}

export interface BulkParseResponse {
  transactions: ParsedTransaction[];
  count: number;
}

export type PasteResult =
  | { kind: "single"; data: ParsedTransaction }
  | { kind: "bulk"; data: BulkParseResponse };
