# FinTrack UI Polish

Apply the frontend-design skill's philosophy within FinTrack's constraints.
Use when asked to improve the visual quality of an existing page or component.

## What's Fixed (Don't Change These)

- **Framework:** Next.js 16 App Router, TypeScript, `'use client'` on all pages
- **Components:** shadcn/ui — use it, don't replace it
- **Fonts:** Geist + Geist Mono via `next/font` in `layout.tsx`. To add a
  display font, import it there with `next/font/google`, not via CSS @import
- **Styling:** Tailwind CSS v4 utilities + CSS variables in `globals.css`
- **Colors:** Override shadcn/ui variables in `globals.css`:
  ```css
  :root {
    --primary: <hsl value>;
    --accent: <hsl value>;
    --radius: 0.5rem;
  }
  ```
  Do not invent a parallel color system outside these variables.

## What's Yours to Shape

**Typography scale** — shadcn/ui doesn't lock font size or weight. Use Tailwind's
type utilities aggressively. Large numbers on the dashboard. Tight tracking on
labels. Weight contrast (font-light vs font-bold) creates hierarchy without
changing fonts.

**Motion** — CSS transitions via Tailwind's `transition-*` and `animate-*`
utilities. One well-orchestrated entrance beats scattered micro-interactions:
```tsx
// Stagger card reveals on mount
<div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
```
No Framer Motion unless explicitly installed with `bun add motion`.

**Spatial composition** — shadcn/ui gives you the components but not the layout.
Break the default equal-column grids. Try asymmetric splits (2/3 + 1/3).
Generous padding on data-dense pages makes numbers breathe.

**Backgrounds** — `globals.css` is where atmosphere lives:
```css
.dashboard-bg {
  background: linear-gradient(135deg, hsl(var(--background)) 0%, hsl(var(--muted)) 100%);
}
```

**Shadows and depth** — Tailwind's `shadow-*` utilities, or custom via CSS
variables. Cards that feel elevated vs flat changes perceived quality more than
color changes.

## Design Direction for FinTrack

The app tracks money — it should feel precise, trustworthy, and calm.
Not clinical. Not playful. Think: a well-designed banking interface that
doesn't feel corporate.

- Numbers are the content — make them prominent
- Color signals meaning: green = positive/income, red = expense/warning,
  neutral = transfer. Don't use color decoratively if it conflicts with this
- Dense information should be organized, not compressed — whitespace earns trust
- Dark mode should feel deliberate, not just inverted

## Finishing

After any visual change:
```bash
docker compose exec frontend bun run tsc --noEmit
```
Verify in the browser at localhost:3000 — Tailwind purges unused classes
so always check visually, not just in code.
