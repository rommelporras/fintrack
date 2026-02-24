"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface CurrencyInputProps {
  value: string;
  onChange: (raw: string) => void;
  currency?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  name?: string;
  "aria-label"?: string;
}

/** Strip everything except digits, a single decimal point, and a leading minus. */
function toRaw(input: string): string {
  const negative = input.trimStart().startsWith("-");
  const stripped = input.replace(/[^\d.]/g, "");
  const parts = stripped.split(".");
  const intPart = parts[0] ?? "";
  const decPart = parts.length > 1 ? parts.slice(1).join("").slice(0, 2) : undefined;
  const raw = decPart !== undefined ? `${intPart}.${decPart}` : intPart;
  // Preserve a lone minus as an intermediate state while the user types digits.
  if (negative && !raw) return "-";
  return negative && raw ? `-${raw}` : raw;
}

/** Format a raw numeric string for display: add thousands commas, keep decimals. */
function toDisplay(raw: string): string {
  if (!raw) return "";
  // Lone minus: still being typed, show as-is.
  if (raw === "-") return "-";
  const negative = raw.startsWith("-");
  const abs = raw.replace(/^-/, "");
  const [intPart, decPart] = abs.split(".");
  const formattedInt = intPart
    ? Number(intPart).toLocaleString("en-PH")
    : "";
  const result =
    decPart !== undefined ? `${formattedInt}.${decPart}` : formattedInt;
  return negative ? `-${result}` : result;
}

export function CurrencyInput({
  value,
  onChange,
  currency = "₱",
  placeholder = "0.00",
  disabled,
  className,
  id,
  name,
  "aria-label": ariaLabel,
}: CurrencyInputProps) {
  const [display, setDisplay] = useState(() => toDisplay(value));

  // Sync when parent sets value externally (e.g. form reset or AI pre-fill).
  useEffect(() => {
    setDisplay(toDisplay(value));
  }, [value]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = toRaw(e.target.value);
    setDisplay(toDisplay(raw));
    onChange(raw);
  }

  return (
    <div
      className={cn(
        "flex items-center rounded-md border border-input bg-background",
        "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      <span className="px-3 text-sm text-muted-foreground border-r border-input select-none shrink-0">
        {currency}
      </span>
      <Input
        id={id}
        name={name}
        aria-label={ariaLabel}
        type="text"
        inputMode="decimal"
        value={display}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        className="border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent"
      />
    </div>
  );
}
