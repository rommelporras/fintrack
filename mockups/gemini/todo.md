# FinTrack Mockup Redesign Todo

## Phase 1: Audit
- [x] Inspect all 13 existing mockup pages
- [x] Write design critiques for each page
- [x] Generate overall design critique summary and design system

## Phase 2: Redesign
- [x] Establish Global CSS and Design System (`index.css`)
- [x] Redesign App Shell & Navigation (Responsive)
- [x] Redesign `dashboard.html`
- [x] Redesign `budgets.html`
- [x] Redesign `analytics.html`
- [x] Redesign `accounts.html`
- [x] Redesign `transactions.html`
- [x] Redesign `recurring.html`
- [x] Redesign `statements.html`
- [x] Redesign `documents.html`
- [x] Redesign `notifications.html`
- [x] Redesign `scan.html`
- [x] Redesign `credit-cards.html`
- [x] Redesign `settings.html`
- [x] Redesign `guide.html`

## Phase 3: Verification
- [x] Verify Mobile responsiveness (390px)
- [x] Verify Tablet responsiveness (768px)
- [x] Verify 1080p Desktop responsiveness (1920px)
- [x] Verify 1440p Desktop responsiveness (2560px)
- [x] Cross-check against all user constraints (Dark theme, PHP currency, nav order, etc.)

## Phase 4: Final Pass
- [x] Compile final `design-notes.md`
- [x] Update `design-system.md` with any discovered changes
- [x] Final visual polish

## Phase 5: React Conversion Prep & Assets
- [x] Create `assets/` folder in `mockups/gemini/`.
- [x] Extract all inline SVGs into catch and meaningful `.svg` files inside `assets/`.
- [x] Analyze the SVG usage.
- [x] Create an advanced prompt file for AI (Nano Banana Pro) to convert the HTML to Next.js TSX components.

## Phase 6: Light/Dark Mode (Tailwind v4)
- [x] Research and implement OKLCH rules for Tailwind v4.
- [x] Expand `index.css` to correctly support `:root` (Light) and `.dark` (Dark).
- [x] Add dynamic theme toggle button to all HTML layout mockups.
- [x] Establish Global CSS and Design System (`index.css`) for light and dark mode.
- [x] Redesign App Shell & Navigation (Responsive)
- [x] Redesign `dashboard.html`
- [x] Redesign `budgets.html`
- [x] Redesign `analytics.html`
- [x] Redesign `accounts.html`
- [x] Redesign `transactions.html`
- [x] Redesign `recurring.html`
- [x] Redesign `statements.html`
- [x] Redesign `documents.html`
- [x] Redesign `notifications.html`
- [x] Redesign `scan.html`
- [x] Redesign `credit-cards.html`
- [x] Redesign `settings.html`
- [x] Redesign `guide.html`

## Phase 7: UI Consistency, Contrast & Visual Polish (2026 Best Practices)
- [x] Analyze all 13 pages in both Light Mode and Dark Mode for visual bugs and contrast issues.
- [x] Fix the Theme Toggle button (increase contrast of the middle circle).
- [x] Fix Toggle Switches (e.g., in Recurring page) to ensure adequate contrast in Light Mode.
- [x] Ensure WCAG compliant contrast ratios on texts, badges, and interactive elements.
- [x] Identify and group redundant utility classes into reusable CSS components in `index.css`.
- [x] Apply the new reusable components consistently across all 13 HTML files.
- [x] Create a `phase7-notes.md` file documenting the extracted components and identified issues.
- [x] Final visual verification using Playwright.
