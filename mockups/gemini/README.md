# FinTrack V2 — UI Mockups Handoff

This directory (`mockups/gemini/`) contains the finalized, modernized UI mockups for the FinTrack application. These static HTML files serve as the blueprint and reference for the frontend migration to Next.js.

## Overview of Changes & Why

The previous design was functional but visually flat and lacked responsive polish. The goal of this redesign was to elevate the UI to a modern, premium SaaS feel while ensuring usability across all device sizes.

**Key Improvements:**
- **Modernized Visual Hierarchy:** Replaced flat boxes with elevated cards (subtle glassmorphism, hover glows, and better shadows).
- **Consistent Layout System:** Standardized the `app-sidebar` and `mobile-header` across all 13 pages.
- **Improved Contrast & Theming:** Implemented a robust dark/light mode system using Tailwind's `dark:` variant and CSS variables. Removed hardcoded backgrounds to ensure semantic colors adaptation.
- **Enhanced Responsiveness:** Fully fluid layouts from mobile (375px) to desktop (1440p). E.g., The analytics table now uses horizontal scrolling on mobile to prevent layout breakage, and side sheets adapt width based on viewport.
- **Interactive Elements:** Added micro-interactions (hover states, custom checkboxes, animated sheets, and modals).

## Tech Stack & Styling Approach

These mockups were built using vanilla HTML/JS and **Tailwind CSS**. 

When applying this to the Next.js app, note the following:
- **Tailwind Config:** Review `tailwind-config.js` for the custom color palette (using `oklch` for rich colors), fonts (Inter font family), and semantic color mappings (e.g., `background`, `card`, `primary`, `destructive`).
- **Global CSS:** `index.css` contains essential custom CSS variables and utility classes that couldn't be purely handled by Tailwind utility classes (e.g., custom scrollbars, complex animations, card glow effects).

## Core UI Patterns for Implementation

When building the React components, look out for these established patterns in the HTML files:

1. **Layout Shell (`app-layout`)**
   - Combines a fixed sidebar (`app-sidebar`) on desktop and a sticky top header (`mobile-header`) on mobile.
   - The main content area (`app-main`) is constrained to `max-w-[1400px]` for ultrawide monitors.

2. **Overlays (Sheets & Modals)**
   - **Sheets (`side-sheet`):** Used for creating/editing items. They slide in from the right on desktop and cover the screen or slide up on mobile.
   - **Modals (`modal-dialog`):** Used strictly for destructive actions (e.g., deleting an account/transaction). Always preceded by a backdrop.

3. **Data Display**
   - **Cards:** Use the `.card` class for standard containers. Some cards (like in `accounts.html`) use a `--card-glow` CSS variable for a subtle radial gradient hover effect.
   - **Status Badges:** Semantic colors are used consistently (Green for income/success, Red for expenses/errors, Blue for transfers, Amber for warnings).
   - **Progress Bars:** Fully styling using Tailwind to represent budget utilization or category spending.
   - **Tables:** Wrapped in `.overflow-x-auto` to ensure horizontal scrolling on smaller screens without breaking the main layout.

4. **Responsive CRUD Interactions (Side Sheets)**
   For adding and editing items (transactions, accounts, budgets, etc.), we use a unified "Side Sheet" component pattern.
   - **Mobile (`< 768px`):** The sheet uses `w-full` taking up the entire screen width, acting as a full-screen mobile menu/form.
   - **Tablet & Desktop (`>= 768px`):** The sheet uses `md:w-[440px]` sliding in from the right edge, paired with a darkened blurred backdrop (`#modal-backdrop`), allowing users to retain context of the page underneath.
   - **Add vs Config State:** A single component handles both states. "Add" modes clear inputs and hide the delete button. "Edit" modes prefill data and display a destructive "Delete" action.

5. **Interactions & State**
   - **Dark Mode:** Toggled via the `.dark` class on the `<html>` element. All colors use semantic `var(--name)` or Tailwind's `dark:` variants.
   - **Custom Checkboxes:** See `.custom-checkbox` in the CSS for the custom SVG-based checkmark implementation used in tables.
