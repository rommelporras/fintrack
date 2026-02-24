"use client";
import { cn } from "@/lib/utils";

export type AccentColor = "green" | "red" | "blue" | "amber";

const accentStyles: Record<
  AccentColor,
  { bar: string; icon: string; text: string }
> = {
  green: {
    bar: "bg-accent-green",
    icon: "bg-accent-green-dim text-accent-green",
    text: "text-accent-green",
  },
  red: {
    bar: "bg-accent-red",
    icon: "bg-accent-red-dim text-accent-red",
    text: "text-accent-red",
  },
  blue: {
    bar: "bg-accent-blue",
    icon: "bg-accent-blue-dim text-accent-blue",
    text: "text-accent-blue",
  },
  amber: {
    bar: "bg-accent-amber",
    icon: "bg-accent-amber-dim text-accent-amber",
    text: "text-accent-amber",
  },
};

interface StatCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent: AccentColor;
  trend?: string;
  trendUp?: boolean;
  featured?: boolean;
}

export function StatCard({
  label,
  value,
  icon,
  accent,
  trend,
  trendUp,
  featured,
}: StatCardProps) {
  const styles = accentStyles[accent];

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border bg-card p-5 card-interactive",
        featured && "ring-1 ring-border shadow-lg",
      )}
    >
      {/* Colored left accent bar */}
      <div
        className={cn("absolute top-0 left-0 w-1 h-full rounded-l-xl", styles.bar)}
      />

      {/* Gradient overlay for featured card */}
      {featured && (
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-50 pointer-events-none" />
      )}

      <div className="relative z-10 pl-2">
        <div className="flex justify-between items-start mb-3">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <div className={cn("p-2 rounded-lg shrink-0", styles.icon)}>
            {icon}
          </div>
        </div>
        <p className="text-2xl font-bold tracking-tight text-foreground">
          {value}
        </p>
        {trend && (
          <p
            className={cn(
              "text-xs font-medium mt-1.5",
              trendUp ? styles.text : "text-muted-foreground",
            )}
          >
            {trend}
          </p>
        )}
      </div>
    </div>
  );
}
