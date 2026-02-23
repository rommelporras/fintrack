# Phase 7 Notes: UI Consistency, Contrast & Visual Polish

This document records the visual bugs identified and the global fixes applied across the 13 FinTrack HTML mockups to ensure a premium, visually consistent experience in both Light and Dark modes.

## 1. Identified Visual Bugs

1. **Theme Toggle Button (Light Mode):** The SVG "sun" icon consisted of hollow strokes (`fill="none"`). Set against the white sidebar / header, this lacked sufficient color weight to signify "Light Mode" cleanly.
2. **Form Toggle Switches (Invisible in Light Mode):** The CSS driving the interactive switches (`recurring.html`, `settings.html`) relied on undefined/legacy CSS variables. The browser fell back to a transparent/white background, rendering the switches completely invisible on Light Mode cards.
3. **Contrast Ratios on Badges:** Backgrounds utilizing `var(--accent-*-dim)` were paired with the standard `var(--accent-*)` text color. In Light Mode, the original OKLCH `L=0.69` (Lightness 69%) provided stunning neon pop on dark backgrounds but lacked the required WCAG contrast ratio for small text against white/pastel backgrounds.
4. **CSS Bloat:** Identical inline `<style>` blocks for modals, sheets, and switches were repeated across at least 8 individual files, leading to high maintenance overhead.

## 2. Implemented Solutions

### Global Component Extraction
To adhere to 2026 best practices for maintainability, the following interactive component styles were stripped from individual HTML `<style>` blocks and consolidated into `index.css`:
- **`.switch`, `.slider`, `input:checked + .slider`**: The core form toggle UI.
- **`.backdrop` / `.backdrop.open`**: The blurred overlay behind modals.
- **`.side-sheet` / `.side-sheet.open`**: The slide-out panels (used for adding/editing transactions, accounts, rules, etc.).
- **`.modal-dialog` / `.modal-dialog.open`**: The standard centered pop-up behavior.

*Note: Component-specific anomalies, such as the `scan.html` stepper UI or `budgets.html` progress animations, were intentionally left inline to avoid global CSS namespace pollution.*

### Contrast Adjustments (OKLCH Modifiers)
The Tailwind v4 Theme Variables in `index.css` were updated to structurally enforce contrast accessibility without losing the original design's aesthetic:

1. **Light Mode (Base `var(--accent-*)`)**: Lowered the lightness from `0.69` -> `0.55` (e.g., Green: `oklch(0.55 0.14 165)`). This dramatically deepens the color of primary buttons and badge text, passing WCAG AA requirements on light backgrounds.
2. **Light Mode (Dim `var(--accent-*-dim)`)**: Maintained strictly at `L=0.69` to ensure pastel/soft backgrounds behind badges.
3. **Dark Mode Override**: Utilizing `.dark`, the primary `var(--accent-*)` reverts back to `L=0.69`, preserving the vibrant, glowing neon effect against the `oklch(0.18)` dark canvas.
4. **SVG Fixes**: Added `fill="currentColor"` to the inner `<circle>` of the Theme Toggle SVG across all 13 HTML files.

## 3. Results
- **`dashboard.html`**: Badges (Income, Expense, Transfer) and primary buttons text is much sharper and highly legible.
- **`recurring.html`**: The toggle switches render beautifully with a soft gray track in Light Mode and a deep slate track in Dark Mode.
- All 13 mocked-up pages are thoroughly cleaned of repetitive CSS, drastically improving developer handoff for upcoming React/Next.js component conversion (Phase 8/9).
