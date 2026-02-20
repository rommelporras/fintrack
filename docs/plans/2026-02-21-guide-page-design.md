# Guide Page — Design Doc

**Date:** 2026-02-21
**Status:** Approved

## Goal

Add a `/guide` route inside the dashboard that renders the FinTrack user guide as a properly integrated app page — using the app's existing dark theme, sidebar, and Tailwind classes.

## Approach

Single `page.tsx` with all content inline as JSX. No external files, no iframe, no MDX dependency.

## Layout

Three-column within the dashboard's main content area:

```
┌──────────────┐ ┌─────────────────────┐ ┌──────────────┐
│  App sidebar │ │                     │ │ On this page │
│              │ │   Guide content     │ │              │
│ • Dashboard  │ │                     │ │ 1. Setup     │
│ • ...        │ │  # First-Time Setup │ │ 2. Data Model│
│              │ │                     │ │ 3. Dashboard │
│ • Guide  ◀── │ │  Do this once...    │ │ ...          │
└──────────────┘ └─────────────────────┘ └──────────────┘
```

- **Center:** long-scrolling content, max-width ~680px
- **Right rail:** sticky `<aside>`, ~200px, hidden on mobile, `IntersectionObserver` highlights active TOC link as you scroll
- **Mobile:** right rail hidden, content is full width

## Files Changed

| File | Change |
|---|---|
| `frontend/src/app/(dashboard)/guide/page.tsx` | Create — all 13 guide sections as JSX |
| `frontend/src/components/app/Sidebar.tsx` | Add `{ href: "/guide", label: "User Guide", icon: BookOpen }` to `NAV_ITEMS` |

## Content Sections (13)

1. First-Time Setup
2. Understanding the Data Model
3. Dashboard
4. Daily Workflows
5. Recording Transactions
6. Recurring Transactions
7. AI-Assisted Import
8. Credit Cards & Statements
9. Budgets
10. Analytics
11. Notifications
12. Install as App (PWA)
13. Tips & Workarounds

## Styling

Uses existing Tailwind classes and shadcn primitives only — no new dependencies:
- Section headings: `text-2xl font-bold` with `border-b`
- Numbered steps: custom `<ol>` with counter-based green circle badges
- Tables: `<table>` inside `overflow-x-auto rounded-lg border`
- Callouts (tip/warning/info): `rounded-lg border p-4` with colored left-border variant
- Code blocks: `<pre className="bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto">`
- TOC active state: `text-primary font-medium` vs `text-muted-foreground`

## No New Dependencies

All styling via Tailwind + existing shadcn. `IntersectionObserver` is native browser API.
