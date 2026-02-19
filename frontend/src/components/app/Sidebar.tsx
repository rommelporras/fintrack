"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ArrowLeftRight,
  ScanLine,
  Wallet,
  CreditCard,
  FileText,
  Bell,
  Settings,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/scan", label: "Scan Receipt", icon: ScanLine },
  { href: "/accounts", label: "Accounts", icon: Wallet },
  { href: "/cards", label: "Credit Cards", icon: CreditCard },
  { href: "/documents", label: "Documents", icon: FileText },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { logout } = useAuth();

  return (
    <aside className="flex flex-col w-64 min-h-screen border-r bg-background px-3 py-4">
      <div className="mb-6 px-3">
        <h1 className="text-xl font-bold tracking-tight">FinTrack</h1>
        <p className="text-xs text-muted-foreground">Personal Finance</p>
      </div>
      <nav className="flex-1 space-y-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              pathname === href
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
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
