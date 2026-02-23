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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";

function getApiBaseUrl(): string {
  if (typeof window === "undefined") return process.env.API_URL || "http://api:8000";
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
}

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/recurring", label: "Recurring", icon: Repeat },
  { href: "/budgets", label: "Budgets", icon: PiggyBank },
  { href: "/analytics", label: "Analytics", icon: BarChart2 },
  { href: "/scan", label: "Scan Receipt", icon: ScanLine },
  { href: "/accounts", label: "Accounts", icon: Wallet },
  { href: "/cards", label: "Credit Cards", icon: CreditCard },
  { href: "/statements", label: "Statements", icon: Receipt },
  { href: "/documents", label: "Documents", icon: FileText },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/guide", label: "User Guide", icon: BookOpen },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { logout } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);

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
    <aside className="flex flex-col w-64 min-h-screen border-r bg-sidebar px-3 py-4">
      <div className="mb-6 px-3">
        <h1 className="text-xl font-bold tracking-tight">FinTrack</h1>
        <p className="text-xs text-muted-foreground">Personal Finance</p>
      </div>
      <nav className="flex-1 space-y-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              pathname === href
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="flex-1">{label}</span>
            {href === "/notifications" && unreadCount > 0 && (
              <Badge
                variant="destructive"
                className="ml-auto h-5 min-w-5 px-1 text-xs flex items-center justify-center"
              >
                {unreadCount > 99 ? "99+" : unreadCount}
              </Badge>
            )}
          </Link>
        ))}
      </nav>
      <Button
        variant="ghost"
        className="justify-start gap-3 text-muted-foreground"
        onClick={logout}
      >
        <LogOut className="h-4 w-4" />
        Sign out
      </Button>
    </aside>
  );
}
