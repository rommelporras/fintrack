"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Repeat,
  ScanLine,
  Wallet,
  CreditCard,
  Receipt,
  FileText,
  Bell,
  Settings,
  LogOut,
  PiggyBank,
  BarChart2,
  BookOpen,
  Sun,
  Moon,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useTheme } from "next-themes";

function getApiBaseUrl(): string {
  if (typeof window === "undefined") return process.env.API_URL || "http://api:8000";
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
}

const NAV_PRIMARY = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/recurring", label: "Recurring", icon: Repeat },
  { href: "/budgets", label: "Budgets", icon: PiggyBank },
  { href: "/analytics", label: "Analytics", icon: BarChart2 },
];

const NAV_FEATURES = [
  { href: "/scan", label: "Scan Receipt", icon: ScanLine },
  { href: "/accounts", label: "Accounts", icon: Wallet },
  { href: "/institutions", label: "Institutions", icon: Building2 },
  { href: "/cards", label: "Credit Cards", icon: CreditCard },
  { href: "/statements", label: "Statements", icon: Receipt },
  { href: "/documents", label: "Documents", icon: FileText },
];

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  onClick,
  badge,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  active: boolean;
  onClick?: () => void;
  badge?: string;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1">{label}</span>
      {badge && (
        <span className="ml-auto bg-destructive text-destructive-foreground h-5 min-w-5 rounded-full text-[10px] font-bold px-1.5 flex items-center justify-center">
          {badge}
        </span>
      )}
    </Link>
  );
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { logout } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Load initial unread count
  useEffect(() => {
    api
      .get<{ items: Array<{ is_read: boolean }>; total: number }>("/notifications")
      .then((data) => {
        setUnreadCount(data.items.filter((n) => !n.is_read).length);
      })
      .catch(() => {
        // Silently ignore errors (e.g. not authenticated yet)
      });
  }, []);

  // Reset unread count when user navigates to notifications page
  useEffect(() => {
    if (pathname === "/notifications") {
      setUnreadCount(0);
    }
  }, [pathname]);

  // SSE connection for real-time notifications
  useEffect(() => {
    let cancelled = false;

    async function connectSSE() {
      try {
        const response = await fetch(`${getApiBaseUrl()}/notifications/stream`, {
          credentials: "include",
        });

        if (!response.ok || !response.body) return;

        const reader = response.body.getReader();
        readerRef.current = reader;

        const decoder = new TextDecoder();
        let buffer = "";

        while (!cancelled) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (line.startsWith("data:")) {
              const raw = line.slice(5).trim();
              if (raw && raw !== "ping") {
                // Only increment if not currently on notifications page
                setUnreadCount((prev) => {
                  if (
                    typeof window !== "undefined" &&
                    window.location.pathname === "/notifications"
                  ) {
                    return prev;
                  }
                  return prev + 1;
                });
              }
            }
          }
        }
      } catch {
        // SSE connection failed — silently ignore (user may not be authenticated)
      }
    }

    connectSSE();

    return () => {
      cancelled = true;
      if (readerRef.current) {
        readerRef.current.cancel().catch(() => {});
        readerRef.current = null;
      }
    };
  }, []);

  return (
    <aside className="flex flex-col w-64 min-h-screen border-r bg-background px-4 py-6">
      {/* Logo — hidden on mobile (mobile header shows wordmark instead) */}
      <div className="mb-8 px-2 hidden lg:block">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <div className="w-2 h-6 bg-primary rounded-sm shrink-0" />
          FinTrack
        </h1>
        <p className="text-xs text-muted-foreground mt-1 ml-4">Personal Finance</p>
      </div>

      {/* Primary nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto">
        {NAV_PRIMARY.map(({ href, label, icon: Icon }) => (
          <NavLink
            key={href}
            href={href}
            label={label}
            icon={Icon}
            active={pathname === href}
            onClick={onNavigate}
          />
        ))}

        {/* Section divider */}
        <div className="my-3 px-3 pt-3 border-t border-border">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Features
          </span>
        </div>

        {NAV_FEATURES.map(({ href, label, icon: Icon }) => (
          <NavLink
            key={href}
            href={href}
            label={label}
            icon={Icon}
            active={pathname === href}
            onClick={onNavigate}
          />
        ))}
      </nav>

      {/* Bottom utilities */}
      <div className="mt-auto pt-4 border-t border-border flex flex-col gap-0.5">
        <NavLink
          href="/notifications"
          label="Notifications"
          icon={Bell}
          active={pathname === "/notifications"}
          onClick={onNavigate}
          badge={unreadCount > 0 ? (unreadCount > 99 ? "99+" : String(unreadCount)) : undefined}
        />
        <NavLink
          href="/settings"
          label="Settings"
          icon={Settings}
          active={pathname === "/settings"}
          onClick={onNavigate}
        />
        <NavLink
          href="/guide"
          label="User Guide"
          icon={BookOpen}
          active={pathname === "/guide"}
          onClick={onNavigate}
        />

        {/* Theme toggle — render after mount to avoid next-themes hydration mismatch */}
        <button
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors w-full text-left"
        >
          {mounted && (resolvedTheme === "dark" ? (
            <Sun className="h-4 w-4 shrink-0" />
          ) : (
            <Moon className="h-4 w-4 shrink-0" />
          ))}
          <span>{mounted ? (resolvedTheme === "dark" ? "Light Mode" : "Dark Mode") : "Toggle Theme"}</span>
        </button>

        <Button
          variant="ghost"
          className="justify-start gap-3 text-muted-foreground px-3"
          onClick={logout}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Sign out
        </Button>
      </div>
    </aside>
  );
}
