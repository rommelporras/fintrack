# UI Modernization — Gemini Mockup Migration

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate all 13 frontend pages from the current flat, dark-only design to the modernized design system established in `mockups/gemini/`, including elevated cards, semantic color accents, light/dark theme toggle, redesigned shell, and responsive side-sheet CRUD pattern.

**Architecture:** Design tokens live exclusively in `globals.css` using Tailwind v4's `@theme inline {}` and CSS variable `:root`/`.dark` blocks. Components use shadcn/ui primitives restyled with Tailwind utilities — no parallel CSS class systems are introduced. Light/dark mode is managed by `next-themes` with the `.dark` class strategy already wired in `globals.css`.

**Tech Stack:** Next.js 16 App Router, TypeScript strict, Tailwind CSS v4, shadcn/ui, `next-themes` (to install), `motion` / Framer Motion v11 (to install, gesture phase only)

**Mockup reference:** `mockups/gemini/` — `index.css` for tokens, `dashboard.html` for shell + layout, `transactions.html` for sheet/modal/table patterns.

**Key constraints:**
- Font stays **Geist** (not Inter from mockup). The `--font-sans` override in `@theme` is skipped.
- All API data-fetching logic in pages is **preserved unchanged**. Visual layer only.
- shadcn/ui components are **kept and restyled**, never replaced.
- TypeScript strict — no `any`, no `// @ts-ignore`.
- Run `docker compose exec frontend bun run tsc --noEmit` after every task.

---

## Phase 0 — Design System Foundation

### Task 1: Extend `globals.css` — accent variables + light theme + card utilities

**Files:**
- Modify: `frontend/src/app/globals.css`

**Context:** Currently `:root` holds dark values only and `<html>` has `className="dark"` hardcoded. We need to:
1. Add a proper light `:root` (from mockup's light theme)
2. Move dark values to `.dark {}`
3. Add `--accent-green/red/amber/blue` + `-dim` variants to both themes
4. Add `.card-interactive` hover utility

**Step 1: Add the light `:root`, dark `.dark`, and accent variables**

Replace the entire `:root {}` block and add a `.dark {}` block and utility classes. The `@theme inline {}` block and `@layer base {}` stay unchanged.

New `:root {}` (light theme — default):
```css
:root {
  --radius: 0.75rem;

  /* shadcn semantic tokens — light */
  --background: oklch(0.97 0.002 260);
  --foreground: oklch(0.15 0.01 260);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.15 0.01 260);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.15 0.01 260);
  --primary: oklch(0.55 0.14 165);
  --primary-foreground: oklch(1 0 0);
  --secondary: oklch(0.95 0.002 260);
  --secondary-foreground: oklch(0.15 0.01 260);
  --muted: oklch(0.95 0.002 260);
  --muted-foreground: oklch(0.55 0.01 260);
  --accent: oklch(0.95 0.002 260);
  --accent-foreground: oklch(0.15 0.01 260);
  --destructive: oklch(0.62 0.22 25);
  --border: oklch(0.92 0.005 260);
  --input: oklch(0.92 0.005 260);
  --ring: oklch(0.55 0.14 165);

  /* chart tokens */
  --chart-1: oklch(0.55 0.14 165);
  --chart-2: oklch(0.55 0.16 260);
  --chart-3: oklch(0.55 0.16 70);
  --chart-4: oklch(0.62 0.22 25);
  --chart-5: oklch(0.6 0.18 280);

  /* sidebar tokens */
  --sidebar: oklch(0.97 0.002 260);
  --sidebar-foreground: oklch(0.15 0.01 260);
  --sidebar-primary: oklch(0.55 0.14 165);
  --sidebar-primary-foreground: oklch(1 0 0);
  --sidebar-accent: oklch(0.92 0.005 260);
  --sidebar-accent-foreground: oklch(0.15 0.01 260);
  --sidebar-border: oklch(0.92 0.005 260);
  --sidebar-ring: oklch(0.55 0.14 165);

  /* semantic accents (used across all pages for income/expense/transfer/warning) */
  --accent-green: oklch(0.55 0.14 165);
  --accent-green-dim: oklch(0.69 0.14 165 / 0.15);
  --accent-red: oklch(0.62 0.22 25);
  --accent-red-dim: oklch(0.65 0.22 25 / 0.15);
  --accent-amber: oklch(0.55 0.16 70);
  --accent-amber-dim: oklch(0.72 0.16 70 / 0.15);
  --accent-blue: oklch(0.55 0.16 260);
  --accent-blue-dim: oklch(0.60 0.16 260 / 0.15);

  /* card hover border */
  --border-hover: oklch(0.85 0.005 260);
}
```

New `.dark {}` block (add after `:root {}`):
```css
.dark {
  --background: oklch(0.13 0.028 261);
  --foreground: oklch(1 0 0);
  --card: oklch(0.18 0.028 261);
  --card-foreground: oklch(1 0 0);
  --popover: oklch(0.18 0.028 261);
  --popover-foreground: oklch(1 0 0);
  --primary: oklch(0.69 0.14 165);
  --primary-foreground: oklch(0.13 0.028 261);
  --secondary: oklch(0.24 0.028 261);
  --secondary-foreground: oklch(1 0 0);
  --muted: oklch(0.24 0.028 261);
  --muted-foreground: oklch(0.71 0.01 261);
  --accent: oklch(0.24 0.028 261);
  --accent-foreground: oklch(1 0 0);
  --destructive: oklch(0.65 0.22 25);
  --border: oklch(0.24 0.028 261);
  --input: oklch(0.24 0.028 261);
  --ring: oklch(0.69 0.14 165);

  --chart-1: oklch(0.69 0.14 165);
  --chart-2: oklch(0.65 0.16 260);
  --chart-3: oklch(0.72 0.16 70);
  --chart-4: oklch(0.65 0.22 25);
  --chart-5: oklch(0.6 0.18 280);

  --sidebar: oklch(0.12 0.028 261);
  --sidebar-foreground: oklch(1 0 0);
  --sidebar-primary: oklch(0.69 0.14 165);
  --sidebar-primary-foreground: oklch(0.13 0.028 261);
  --sidebar-accent: oklch(0.20 0.028 261);
  --sidebar-accent-foreground: oklch(1 0 0);
  --sidebar-border: oklch(0.24 0.028 261);
  --sidebar-ring: oklch(0.69 0.14 165);

  --accent-green: oklch(0.69 0.14 165);
  --accent-green-dim: oklch(0.69 0.14 165 / 0.15);
  --accent-red: oklch(0.65 0.22 25);
  --accent-red-dim: oklch(0.60 0.22 25 / 0.15);
  --accent-amber: oklch(0.72 0.16 70);
  --accent-amber-dim: oklch(0.72 0.16 70 / 0.15);
  --accent-blue: oklch(0.65 0.16 260);
  --accent-blue-dim: oklch(0.60 0.16 260 / 0.15);

  --border-hover: oklch(0.35 0.028 261);
}
```

Add to `@layer base {}` (after the existing rules):
```css
  /* Card hover lift — applied to any card that should respond to hover */
  .card-interactive {
    transition: border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
  }
  .card-interactive:hover {
    border-color: var(--border-hover);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgb(0 0 0 / 0.08);
  }
  .dark .card-interactive:hover {
    box-shadow: 0 4px 12px rgb(0 0 0 / 0.25);
  }
```

**Step 2: Verify TypeScript still passes**

```bash
docker compose exec frontend bun run tsc --noEmit
```
Expected: 0 errors (CSS changes don't affect TS).

**Step 3: Check in browser**

Open `http://localhost:3000`. The page should now display in **light mode** (white background) since `:root` is now the light theme and `<html class="dark">` is still hardcoded. We'll fix the `dark` class in Task 3. For now, verify the CSS parsed without errors (no blank white page with console CSS parse errors).

---

### Task 2: Install `next-themes` and wire `ThemeProvider`

**Files:**
- Modify: `frontend/src/app/layout.tsx`
- Create: `frontend/src/components/app/ThemeProvider.tsx`

**Context:** `<html lang="en" className="dark">` is hardcoded. We need `next-themes` to manage the `.dark` class dynamically. The `ThemeProvider` must be a client component (uses context), but `layout.tsx` can stay a Server Component by keeping the provider in a wrapper.

**Step 1: Install next-themes**

```bash
# Run this yourself in the frontend directory:
cd frontend && bun add next-themes
```

**Step 2: Create `ThemeProvider.tsx`**

```tsx
// frontend/src/components/app/ThemeProvider.tsx
"use client";
import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
```

**Step 3: Update `layout.tsx`**

Remove `className="dark"` from `<html>` (next-themes adds it). Import and wrap with `ThemeProvider`:

```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/app/ThemeProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FinTrack",
  description: "Personal finance tracker — income, expenses, and transfers across bank accounts, cards, and wallets.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#34d399" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
```

Note: `suppressHydrationWarning` on `<html>` is required by `next-themes` to suppress the expected mismatch between SSR (no class) and client (`.dark` added by JS).

**Step 4: Verify**

```bash
docker compose exec frontend bun run tsc --noEmit
```

Open browser — app should load in dark mode by default (next-themes adds `.dark` from localStorage or default). No flash of unstyled content.

---

## Phase 1 — Shell Redesign

### Task 3: Redesign `Sidebar.tsx`

**Files:**
- Modify: `frontend/src/components/app/Sidebar.tsx`

**Context:** Current sidebar uses `bg-sidebar` (darkest surface) with a filled `bg-primary` active state. Target: same-as-page background (`bg-background`), tinted active state (`bg-primary/10 text-primary`), logo with green accent bar, section divider between main nav and "Features", dark mode toggle button at the bottom.

**Current nav sections:**
- Main: Dashboard, Transactions, Recurring, Budgets, Analytics
- Features: Scan Receipt, Accounts, Credit Cards, Statements, Documents
- Bottom: Notifications (with badge), Settings, Guide, Sign out

**Step 1: Add `useTheme` import and restructure NAV_ITEMS**

Split NAV_ITEMS into two groups:

```tsx
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
  { href: "/cards", label: "Credit Cards", icon: CreditCard },
  { href: "/statements", label: "Statements", icon: Receipt },
  { href: "/documents", label: "Documents", icon: FileText },
];
```

**Step 2: Add `useTheme` hook**

```tsx
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react"; // add to existing lucide imports
// inside component:
const { theme, setTheme } = useTheme();
```

**Step 3: Rewrite the JSX**

```tsx
return (
  <aside className="flex flex-col w-64 min-h-screen border-r bg-background px-4 py-6">
    {/* Logo */}
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
        <NavLink key={href} href={href} label={label} icon={Icon}
          active={pathname === href} onClick={onNavigate} />
      ))}

      {/* Section divider */}
      <div className="my-3 px-3 pt-3 border-t border-border">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Features
        </span>
      </div>

      {NAV_FEATURES.map(({ href, label, icon: Icon }) => (
        <NavLink key={href} href={label === "Scan Receipt" ? "/scan" : href}
          href={href} label={label} icon={Icon}
          active={pathname === href} onClick={onNavigate} />
      ))}
    </nav>

    {/* Bottom utilities */}
    <div className="mt-auto pt-4 border-t border-border flex flex-col gap-0.5">
      <NavLink href="/notifications" label="Notifications" icon={Bell}
        active={pathname === "/notifications"} onClick={onNavigate}
        badge={unreadCount > 0 ? (unreadCount > 99 ? "99+" : String(unreadCount)) : undefined} />
      <NavLink href="/settings" label="Settings" icon={Settings}
        active={pathname === "/settings"} onClick={onNavigate} />
      <NavLink href="/guide" label="User Guide" icon={BookOpen}
        active={pathname === "/guide"} onClick={onNavigate} />

      {/* Dark mode toggle */}
      <button
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors w-full text-left"
      >
        {theme === "dark" ? (
          <Sun className="h-4 w-4 shrink-0" />
        ) : (
          <Moon className="h-4 w-4 shrink-0" />
        )}
        <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
      </button>

      <Button variant="ghost" className="justify-start gap-3 text-muted-foreground px-3"
        onClick={logout}>
        <LogOut className="h-4 w-4 shrink-0" />
        Sign out
      </Button>
    </div>
  </aside>
);
```

Create the `NavLink` helper inside the same file (not exported):

```tsx
function NavLink({
  href, label, icon: Icon, active, onClick, badge,
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
```

**Step 4: Fix the duplicate `href` prop typo** in the NavLink call for NAV_FEATURES (that's a copy-paste artifact in the plan — write it cleanly in the actual file).

**Step 5: TypeScript check**

```bash
docker compose exec frontend bun run tsc --noEmit
```

---

### Task 4: Update Dashboard layout and `MobileSidebar`

**Files:**
- Modify: `frontend/src/app/(dashboard)/layout.tsx`
- Modify: `frontend/src/components/app/MobileSidebar.tsx`

**Context:** Layout uses `md:` (768px) breakpoint, but the mockup uses `lg:` (1024px). Tablets should get the mobile header. Mobile header needs a fixed 60px height, app title, and avatar placeholder (future: real user avatar).

**Step 1: Update `layout.tsx`**

```tsx
import { Sidebar } from "@/components/app/Sidebar";
import { MobileSidebar } from "@/components/app/MobileSidebar";
import { OfflineBanner } from "@/components/app/OfflineBanner";
import { PushPrompt } from "@/components/app/PushPrompt";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar — hidden below lg (1024px) */}
      <div className="hidden lg:flex">
        <Sidebar />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <OfflineBanner />
        <PushPrompt />

        {/* Mobile header — shown below lg */}
        <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between h-[60px] border-b bg-background px-4 shrink-0">
          <div className="flex items-center gap-3">
            <MobileSidebar />
            <span className="font-bold text-lg tracking-tight">FinTrack</span>
          </div>
          {/* Avatar placeholder */}
          <div className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8">
          <div className="max-w-[1400px] mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
```

**Step 2: Update `MobileSidebar.tsx`**

The trigger button needs to match the mobile header's hamburger style. Update only the trigger — the Sheet and Sidebar inside it are unchanged.

```tsx
"use client";
import { useState } from "react";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Sidebar } from "./Sidebar";

export function MobileSidebar() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <button
        onClick={() => setOpen(true)}
        className="p-2 -ml-2 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </button>
      <SheetContent side="left" className="p-0 w-64 bg-background">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <Sidebar onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
```

Note: `SheetTitle` with `sr-only` is required by shadcn/ui's accessibility rules — omitting it triggers a console warning.

**Step 3: TypeScript check**

```bash
docker compose exec frontend bun run tsc --noEmit
```

---

## Phase 2 — Shared UI Primitives

### Task 5: Create `StatCard` component

**Files:**
- Create: `frontend/src/components/app/StatCard.tsx`

**Context:** Used on the Dashboard for the 4-metric grid. Each card has: a colored left border accent, an icon badge in the same color, a large number, and a trend line. The Net Worth card is special — it gets a gradient overlay and glow on the accent bar.

```tsx
// frontend/src/components/app/StatCard.tsx
"use client";
import { cn } from "@/lib/utils";

type AccentColor = "green" | "red" | "blue" | "amber";

const accentStyles: Record<AccentColor, { bar: string; icon: string; text: string }> = {
  green: {
    bar: "bg-[var(--accent-green)]",
    icon: "bg-[var(--accent-green-dim)] text-[var(--accent-green)]",
    text: "text-[var(--accent-green)]",
  },
  red: {
    bar: "bg-[var(--accent-red)]",
    icon: "bg-[var(--accent-red-dim)] text-[var(--accent-red)]",
    text: "text-[var(--accent-red)]",
  },
  blue: {
    bar: "bg-[var(--accent-blue)]",
    icon: "bg-[var(--accent-blue-dim)] text-[var(--accent-blue)]",
    text: "text-[var(--accent-blue)]",
  },
  amber: {
    bar: "bg-[var(--accent-amber)]",
    icon: "bg-[var(--accent-amber-dim)] text-[var(--accent-amber)]",
    text: "text-[var(--accent-amber)]",
  },
};

interface StatCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent: AccentColor;
  trend?: string;        // e.g. "+12% from last month"
  trendUp?: boolean;     // controls trend text color
  featured?: boolean;    // true for Net Worth card (gradient overlay)
}

export function StatCard({ label, value, icon, accent, trend, trendUp, featured }: StatCardProps) {
  const styles = accentStyles[accent];

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border bg-card p-5 card-interactive",
        featured && "ring-1 ring-border shadow-lg",
      )}
    >
      {/* Colored left accent bar */}
      <div className={cn("absolute top-0 left-0 w-1 h-full rounded-l-xl", styles.bar)} />

      {/* Gradient overlay for featured card */}
      {featured && (
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-50 pointer-events-none" />
      )}

      <div className="relative z-10 pl-2">
        <div className="flex justify-between items-start mb-3">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <div className={cn("p-2 rounded-lg", styles.icon)}>
            {icon}
          </div>
        </div>
        <p className="text-2xl font-bold tracking-tight text-foreground">{value}</p>
        {trend && (
          <p className={cn("text-xs font-medium mt-1.5", trendUp ? styles.text : "text-muted-foreground")}>
            {trend}
          </p>
        )}
      </div>
    </div>
  );
}
```

**TypeScript check:**
```bash
docker compose exec frontend bun run tsc --noEmit
```

---

### Task 6: Create `TypeBadge` and `CategoryChip` components

**Files:**
- Create: `frontend/src/components/app/TypeBadge.tsx`

**Context:** Used in transaction tables and lists. `TypeBadge` is the `income`/`expense`/`transfer` pill. `CategoryChip` is the category dot + label pill.

```tsx
// frontend/src/components/app/TypeBadge.tsx
"use client";
import { cn } from "@/lib/utils";

type TxnType = "income" | "expense" | "transfer";

const typeStyles: Record<TxnType, string> = {
  income: "bg-[var(--accent-green-dim)] text-[var(--accent-green)] border border-[var(--accent-green)]/20",
  expense: "bg-[var(--accent-red-dim)] text-[var(--accent-red)] border border-[var(--accent-red)]/20",
  transfer: "bg-[var(--accent-blue-dim)] text-[var(--accent-blue)] border border-[var(--accent-blue)]/20",
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
  income: "bg-[var(--accent-green)]",
  expense: "bg-[var(--accent-red)]",
  transfer: "bg-[var(--accent-blue)]",
};

export function CategoryChip({ name, type }: { name: string; type?: TxnType }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
      {type && (
        <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", dotColors[type])} />
      )}
      {name}
    </span>
  );
}
```

**TypeScript check:**
```bash
docker compose exec frontend bun run tsc --noEmit
```

---

### Task 7: Create `CrudSheet` wrapper component

**Files:**
- Create: `frontend/src/components/app/CrudSheet.tsx`

**Context:** Every CRUD side sheet in the mockup has the same structure: fixed `w-full lg:w-[440px]` width, a header region (title + subtitle + close ×), a scrollable body, and a sticky footer (Cancel + Save). The shadcn `Sheet` + `SheetContent` doesn't enforce this layout by default. We wrap it into a `CrudSheet` that standardizes it.

```tsx
// frontend/src/components/app/CrudSheet.tsx
"use client";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface CrudSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  onSave: () => void;
  onCancel?: () => void;
  saveLabel?: string;
  saveDisabled?: boolean;
  footer?: React.ReactNode;   // override default Cancel/Save buttons
  children: React.ReactNode;
  className?: string;
}

export function CrudSheet({
  open,
  onOpenChange,
  title,
  description,
  onSave,
  onCancel,
  saveLabel = "Save",
  saveDisabled = false,
  footer,
  children,
  className,
}: CrudSheetProps) {
  function handleCancel() {
    if (onCancel) onCancel();
    else onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          "p-0 flex flex-col w-full sm:w-full md:w-[440px] max-w-full",
          className,
        )}
        // Remove default SheetContent close button — we render our own in the header
        hideCloseButton
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-border shrink-0">
          <div>
            <SheetTitle className="text-lg font-bold tracking-tight">{title}</SheetTitle>
            {description && (
              <SheetDescription className="text-sm text-muted-foreground mt-0.5">
                {description}
              </SheetDescription>
            )}
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="p-2 -mr-2 rounded-full hover:bg-muted text-muted-foreground transition-colors ml-4 shrink-0"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {children}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-card/50 flex justify-end gap-3 shrink-0">
          {footer ?? (
            <>
              <Button variant="outline" onClick={handleCancel}>Cancel</Button>
              <Button onClick={onSave} disabled={saveDisabled}>{saveLabel}</Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

Note: `hideCloseButton` may not be a prop on all versions of shadcn Sheet. Check `frontend/src/components/ui/sheet.tsx` — if it doesn't accept `hideCloseButton`, add a CSS override:
```tsx
// Alternative: add to SheetContent className:
"[&>button.absolute]:hidden"
```

**TypeScript check:**
```bash
docker compose exec frontend bun run tsc --noEmit
```
If TS complains about `hideCloseButton`, use the CSS override approach instead.

---

## Phase 3 — Page Migrations

> **Pattern for every page:**
> 1. Preserve all state, API calls, and handlers exactly — never touch logic.
> 2. Replace JSX structure/classNames only.
> 3. TypeScript check after each page.
> 4. Visual check at `localhost:3000/<page>` on both light and dark mode.

### Task 8: Redesign Dashboard page

**Files:**
- Modify: `frontend/src/app/(dashboard)/page.tsx`

**Mockup reference:** `mockups/gemini/dashboard.html` — 4-col metric grid, 2/3+1/3 split, Recent Transactions list, Get Started checklist widget, Upcoming Bills widget.

**Changes:**
1. Add 4th stat card (Net Worth) — currently displayed in a separate `<Card>`. Move it into the 4-col grid as the `featured` card.
2. Stat grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4` using `<StatCard>`.
3. Main section: 2-column `grid-cols-1 lg:grid-cols-3 gap-6` — Recent Transactions on left (`lg:col-span-2`), widgets on right (`lg:col-span-1`).
4. Recent Transactions: replace `<ul>` with a `divide-y` list inside a card. Each row uses `TypeBadge` for type and shows account name.
5. Upcoming Bills widget: rename from "Upcoming Recurring" — same data, new visual.
6. Get Started checklist: wrap in right-column widget card.
7. Page header: `text-3xl font-bold tracking-tight` + subtitle with current month.

**Preserve:**
- All `useState`, `useEffect`, and API calls
- `onboardingSteps`, `showOnboarding`, and dismiss logic
- Error/loading states

**TypeScript check:**
```bash
docker compose exec frontend bun run tsc --noEmit
```

---

### Task 9: Redesign Transactions page

**Files:**
- Modify: `frontend/src/app/(dashboard)/transactions/page.tsx`

**Mockup reference:** `mockups/gemini/transactions.html`

**Changes:**
1. Replace the `<Link href="/transactions/new">` New button approach with an `openAddSheet()` button that opens the edit sheet in "add" mode. The existing `/transactions/new` page can remain for direct access.
   - **Wait:** Check if `transactions/new` is used elsewhere. It's a separate page that handles bulk import. Keep the Link button pointing to `/transactions/new` — the mockup's inline Add is a UX enhancement we can add later. For now, just change the button styling.
2. Table structure: replace `<ul>` with `<table>` wrapped in `overflow-x-auto`. Columns: Date | Description | Category | Account | Amount | Actions(kebab).
3. Each row: use `TypeBadge` for income/transfer rows inline in description cell, `CategoryChip` for the category cell.
4. Amount column: income = `text-[var(--accent-green)]`, expense = `text-foreground`, transfer = `text-muted-foreground`.
5. Hover: show kebab `⋯` button via `opacity-0 group-hover:opacity-100`.
6. Replace `Sheet` + `SheetContent` with `CrudSheet`. Keep all form fields and handlers.
7. Filter toolbar: merge the search input + type Select + Filters button into a single `flex` row. Keep all filter state logic.
8. Pagination: use the card footer pagination pattern (Previous / page numbers / Next).

**Preserve:**
- All state management, API calls, filter logic, edit/delete handlers

**TypeScript check:**
```bash
docker compose exec frontend bun run tsc --noEmit
```

---

### Task 10: Redesign Accounts page

**Files:**
- Modify: `frontend/src/app/(dashboard)/accounts/page.tsx`

**Mockup reference:** `mockups/gemini/accounts.html`

**Key patterns from mockup:**
- Account cards in a responsive grid (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`)
- Each card: account type badge (checking/savings/etc.), balance as large number, account name as subtitle
- Card has a `--card-glow` radial gradient on hover. In Tailwind v4, approximate with:
  ```
  hover:[background:radial-gradient(ellipse_at_top_right,var(--accent-green-dim),transparent_70%),var(--card)]
  ```
  This is a progressive enhancement — if it's complex, skip glow and just use `card-interactive`.
- Add/Edit sheet uses `CrudSheet`.

**TypeScript check:**
```bash
docker compose exec frontend bun run tsc --noEmit
```

---

### Task 11: Redesign Budgets page

**Files:**
- Modify: `frontend/src/app/(dashboard)/budgets/page.tsx`

**Mockup reference:** `mockups/gemini/budgets.html`

**Key patterns:**
- Budget cards with a progress bar showing utilization.
- Progress bar color: green if < 80%, amber if 80–99%, red if ≥ 100%.
- Progress bar: `<div>` with `h-1.5 rounded-full bg-muted` wrapper, inner `<div>` with dynamic width % and color class.
- Budget amount + spent + remaining displayed in card footer.
- Add/Edit sheet uses `CrudSheet`.

**TypeScript check:**
```bash
docker compose exec frontend bun run tsc --noEmit
```

---

### Task 12: Redesign Analytics page

**Files:**
- Modify: `frontend/src/app/(dashboard)/analytics/page.tsx`

**Mockup reference:** `mockups/gemini/analytics.html`

**Key patterns:**
- Page has chart area at top, data table below.
- Table is wrapped in `overflow-x-auto` for mobile horizontal scroll — **critical, prevents layout break on small screens**.
- Category rows use `CategoryChip` and a mini progress bar.
- Chart component (recharts via shadcn `chart.tsx`) stays unchanged — just update surrounding layout.

**TypeScript check:**
```bash
docker compose exec frontend bun run tsc --noEmit
```

---

### Task 13: Redesign Recurring Transactions page

**Files:**
- Modify: `frontend/src/app/(dashboard)/recurring/page.tsx`

**Mockup reference:** `mockups/gemini/recurring.html`

**Key patterns:**
- List of recurring transactions with frequency badge (Monthly, Weekly, etc.).
- Next due date chip.
- Toggle switch for active/inactive — use shadcn `Switch` component.
- Add/Edit sheet uses `CrudSheet`.

**TypeScript check:**
```bash
docker compose exec frontend bun run tsc --noEmit
```

---

### Task 14: Redesign Scan page

**Files:**
- Modify: `frontend/src/app/(dashboard)/scan/page.tsx`

**Mockup reference:** `mockups/gemini/scan.html`

**Context:** Page already has `PasteInput`, `TransactionConfirm`, and `BulkImportTable` components. These components have tests — **do not modify component logic or props**. Only update the page layout and any wrapper styling.

**Key patterns:**
- Upload area with dashed border, centered icon + text.
- `PasteInput` card gets standard `card` border + padding.
- Confirm/import flow stays unchanged.

**TypeScript check:**
```bash
docker compose exec frontend bun run tsc --noEmit
```

---

### Task 15: Redesign Documents page

**Files:**
- Modify: `frontend/src/app/(dashboard)/documents/page.tsx`

**Mockup reference:** `mockups/gemini/documents.html`

**Key patterns:**
- Document cards in a grid. Each card: file type icon, filename, upload date, size, download link.
- Empty state illustration with upload CTA.
- Upload area: dashed border card that accepts drag-drop.

**TypeScript check:**
```bash
docker compose exec frontend bun run tsc --noEmit
```

---

### Task 16: Redesign Statements page

**Files:**
- Modify: `frontend/src/app/(dashboard)/statements/page.tsx`

**Mockup reference:** `mockups/gemini/statements.html`

**Key patterns:**
- Statement list grouped by month.
- Each row: bank name, statement period, download button.
- Import statement button opens `CrudSheet`.

**TypeScript check:**
```bash
docker compose exec frontend bun run tsc --noEmit
```

---

### Task 17: Redesign Credit Cards page

**Files:**
- Modify: `frontend/src/app/(dashboard)/cards/page.tsx`

**Mockup reference:** `mockups/gemini/credit-cards.html`

**Key patterns:**
- Card visual (the stylized credit card rectangle) with bank name, last 4 digits, limit.
- Utilization progress bar (same color logic as budgets: green/amber/red).
- Statement due date.
- Add/Edit uses `CrudSheet`.

**TypeScript check:**
```bash
docker compose exec frontend bun run tsc --noEmit
```

---

### Task 18: Redesign Notifications page

**Files:**
- Modify: `frontend/src/app/(dashboard)/notifications/page.tsx`

**Mockup reference:** `mockups/gemini/notifications.html`

**Key patterns:**
- Notification list with unread indicator (dot or left border accent).
- Mark all as read button.
- Empty state.
- Timestamp relative formatting (e.g. "2 hours ago").

**TypeScript check:**
```bash
docker compose exec frontend bun run tsc --noEmit
```

---

### Task 19: Redesign Settings page

**Files:**
- Modify: `frontend/src/app/(dashboard)/settings/page.tsx`

**Mockup reference:** `mockups/gemini/settings.html`

**Key patterns:**
- Settings grouped into sections (Account, Preferences, Notifications, Danger Zone).
- Each section in its own card.
- Toggle switches use shadcn `Switch`.
- Danger Zone section has red border and delete account button.

**TypeScript check:**
```bash
docker compose exec frontend bun run tsc --noEmit
```

---

### Task 20: Redesign Guide page

**Files:**
- Modify: `frontend/src/app/(dashboard)/guide/page.tsx`

**Mockup reference:** `mockups/gemini/guide.html`

**Context:** Page already has `GuideToc` component with tests — **do not modify it**. Only update the page layout wrapping it.

**Key patterns:**
- Two-column layout on desktop: TOC on left (sticky), content on right.
- Section headings use large type with accent underline.

**TypeScript check:**
```bash
docker compose exec frontend bun run tsc --noEmit
```

---

## Phase 4 — Gesture Layer (Enhancement — Non-Blocking)

> This phase can be done last or skipped for initial release. No pages depend on it.

### Task 21: Install Framer Motion and swipe-to-close sidebar

**Files:**
- Modify: `frontend/src/components/app/MobileSidebar.tsx`

**Step 1: Install Framer Motion**

```bash
# Run yourself:
cd frontend && bun add motion
```

**Step 2: Wrap sidebar sheet content with motion drag**

Replace the `SheetContent` contents with a `motion.div` that has `drag="x"` constrained to the left:

```tsx
import { motion, useMotionValue, useTransform } from "motion/react";

// inside MobileSidebar:
const x = useMotionValue(0);
const opacity = useTransform(x, [-264, 0], [0, 1]);

// In JSX, wrap <Sidebar> with:
<motion.div
  drag="x"
  dragConstraints={{ left: -264, right: 0 }}
  dragElastic={0.05}
  style={{ x }}
  onDragEnd={(_, info) => {
    if (info.velocity.x < -200 || info.offset.x < -80) setOpen(false);
  }}
  className="h-full"
>
  <Sidebar onNavigate={() => setOpen(false)} />
</motion.div>
```

**TypeScript check:**
```bash
docker compose exec frontend bun run tsc --noEmit
```

---

### Task 22: Swipe-to-close CRUD sheets

**Files:**
- Modify: `frontend/src/components/app/CrudSheet.tsx`

**Step: Add drag gesture to `SheetContent`**

```tsx
import { motion, useMotionValue, useTransform } from "motion/react";

// Wrap the SheetContent inner div with motion.div drag="x" dragConstraints={{ left: 0, right: 440 }}
// onDragEnd: if info.offset.x > 100 || info.velocity.x > 200, call onOpenChange(false)
```

**TypeScript check:**
```bash
docker compose exec frontend bun run tsc --noEmit
```

---

## Phase 5 — QA Gate

### Task 23: Full TypeScript + visual verification

**Step 1: TypeScript clean check across all source**

```bash
docker compose exec frontend bun run tsc --noEmit
```
Expected: 0 errors.

**Step 2: Visual checklist — open each page in browser**

Check on both light mode and dark mode:

| Page | URL | Check |
|---|---|---|
| Dashboard | `/` | 4 stat cards, 2/3+1/3 layout |
| Transactions | `/transactions` | Table, type badges, category chips, sheet |
| Accounts | `/accounts` | Grid cards, balance figures |
| Budgets | `/budgets` | Progress bars, utilization colors |
| Analytics | `/analytics` | Table horizontal scroll on mobile |
| Recurring | `/recurring` | Frequency badges, toggle switches |
| Scan | `/scan` | Upload area, paste input |
| Documents | `/documents` | Document cards or empty state |
| Statements | `/statements` | Statement list |
| Credit Cards | `/cards` | Card visual, utilization bar |
| Notifications | `/notifications` | Unread indicators |
| Settings | `/settings` | Grouped sections |
| Guide | `/guide` | Two-column layout |

**Step 3: Mobile viewport check**

Use browser dev tools — set viewport to 375px wide. Verify:
- Mobile header visible (hamburger + wordmark + avatar)
- Desktop sidebar hidden
- Transaction table has horizontal scroll (doesn't break layout)
- Sheets open full-screen

**Step 4: Theme toggle check**

Click the dark/light mode toggle in the sidebar. Verify all pages switch themes cleanly with no flash of unstyled content.

---

## Quick Reference: File Map

| Component | File |
|---|---|
| Design tokens | `frontend/src/app/globals.css` |
| Theme provider | `frontend/src/components/app/ThemeProvider.tsx` |
| Root layout | `frontend/src/app/layout.tsx` |
| Dashboard layout | `frontend/src/app/(dashboard)/layout.tsx` |
| Sidebar | `frontend/src/components/app/Sidebar.tsx` |
| Mobile sidebar | `frontend/src/components/app/MobileSidebar.tsx` |
| Stat card | `frontend/src/components/app/StatCard.tsx` |
| Type badge + category chip | `frontend/src/components/app/TypeBadge.tsx` |
| CRUD sheet wrapper | `frontend/src/components/app/CrudSheet.tsx` |
| Dashboard page | `frontend/src/app/(dashboard)/page.tsx` |
| Transactions page | `frontend/src/app/(dashboard)/transactions/page.tsx` |
| Accounts page | `frontend/src/app/(dashboard)/accounts/page.tsx` |
| Budgets page | `frontend/src/app/(dashboard)/budgets/page.tsx` |
| Analytics page | `frontend/src/app/(dashboard)/analytics/page.tsx` |
| Recurring page | `frontend/src/app/(dashboard)/recurring/page.tsx` |
| Scan page | `frontend/src/app/(dashboard)/scan/page.tsx` |
| Documents page | `frontend/src/app/(dashboard)/documents/page.tsx` |
| Statements page | `frontend/src/app/(dashboard)/statements/page.tsx` |
| Credit Cards page | `frontend/src/app/(dashboard)/cards/page.tsx` |
| Notifications page | `frontend/src/app/(dashboard)/notifications/page.tsx` |
| Settings page | `frontend/src/app/(dashboard)/settings/page.tsx` |
| Guide page | `frontend/src/app/(dashboard)/guide/page.tsx` |
