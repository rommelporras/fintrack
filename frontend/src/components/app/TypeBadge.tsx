"use client";
import { cn } from "@/lib/utils";

export type TxnType = "income" | "expense" | "transfer";

const typeStyles: Record<TxnType, string> = {
  income:
    "bg-accent-green-dim text-accent-green border border-accent-green/20",
  expense:
    "bg-accent-red-dim text-accent-red border border-accent-red/20",
  transfer:
    "bg-accent-blue-dim text-accent-blue border border-accent-blue/20",
};

export function TypeBadge({ type }: { type: TxnType }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
        typeStyles[type],
      )}
    >
      {type}
    </span>
  );
}

const dotColors: Record<TxnType, string> = {
  income: "bg-accent-green",
  expense: "bg-accent-red",
  transfer: "bg-accent-blue",
};

export function CategoryChip({
  name,
  type,
}: {
  name: string;
  type?: TxnType;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
      {type && (
        <span
          className={cn("w-1.5 h-1.5 rounded-full shrink-0", dotColors[type])}
        />
      )}
      {name}
    </span>
  );
}
