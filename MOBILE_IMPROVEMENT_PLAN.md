# Mobile Experience Improvement Plan — Finance App

> **Stack:** React 19 + TypeScript + Tailwind CSS 4 + Vite + PWA  
> **Date:** May 2026  
> **Scope:** 6 targeted improvements, each with a ready-to-paste Claude Code prompt.

---

## Current State Summary

The app already has solid foundations: a bottom tab bar on mobile, safe-area inset handling, Tailwind responsive breakpoints, and PWA support. The main gaps are in **content layout on small screens** (tables instead of cards), **touch ergonomics** (small tap targets, no active states), **modal/form UX on mobile** (keyboard pushes content, no bottom-sheet pattern), and **visual feedback** (no skeleton loaders, no press animations).

---

## Improvement Roadmap

| # | Area | Priority | Effort |
|---|------|----------|--------|
| 1 | Mobile card layouts for Transactions & Accounts | 🔴 High | Medium |
| 2 | Collapsible filter drawer for Transactions | 🔴 High | Medium |
| 3 | Touch targets & active states | 🟡 Medium | Small |
| 4 | Mobile-optimised dialogs / bottom sheets | 🟡 Medium | Medium |
| 5 | Skeleton loading screens | 🟡 Medium | Small |
| 6 | Responsive charts & dashboard polish | 🟢 Low | Small |

---

## Improvement 1 — Mobile Card Layouts for Transactions & Accounts

### Problem
Both pages use full-width HTML tables with 4–6 columns. On a 375 px screen this forces horizontal scrolling or cramped text, making the data nearly unreadable.

### Solution
Render a **card list on mobile** (`< md`) and keep the table on desktop. Each card surfaces the most important fields and uses a disclosure chevron to expand secondary info.

### Claude Code Prompt

```
You are improving the mobile experience of a React + Tailwind CSS finance app.

TASK: Replace the HTML table layouts on Transactions.tsx and Accounts.tsx with a responsive
card layout on mobile, keeping the existing table intact for md+ screens.

FILES TO EDIT:
- src/routes/Transactions.tsx
- src/routes/Accounts.tsx

REQUIREMENTS:
1. Below the `md` breakpoint, hide the <table> (add class `hidden md:block` or equivalent)
   and render a new <ul> / <div> card list in its place (add class `block md:hidden`).
2. Each transaction card must show:
   - Left side: category colour dot + description (bold) + date (muted, smaller)
   - Right side: amount (green for income, red for expense) + account name (muted)
   - A subtle bottom border between cards
3. Each account card must show:
   - Account name (bold) + institution (muted below)
   - Balance right-aligned (large, prominent)
   - Account type badge (pill/chip style)
   - Edit and Delete icon buttons (trash / pencil icons, 44×44 px touch targets)
4. All interactive cards must have a visible :active press state (e.g. bg-slate-100 on tap).
5. Use only Tailwind utility classes — no new CSS files.
6. Do not change any data-fetching logic, state, or props.
7. Preserve all existing onClick handlers (edit, delete) by attaching them to the card
   or its action buttons.

STYLE GUIDE:
- Income amounts: text-emerald-600
- Expense amounts: text-rose-600
- Muted text: text-slate-500 text-sm
- Card background: bg-white, rounded-xl, shadow-sm, border border-slate-100
- Card padding: p-4
- Active state: active:bg-slate-50

After making changes, confirm which components were edited and describe the card structure used.
```

---

## Improvement 2 — Collapsible Filter Drawer for Transactions

### Problem
The Transactions filter row (date range + category + type selects) is a horizontal flex row that wraps awkwardly on mobile, occupying too much vertical space and making the filters hard to tap.

### Solution
Collapse filters behind a **"Filters" button** on mobile. Tapping it slides open a panel (simple CSS max-height transition — no new library needed) showing all filters stacked vertically.

### Claude Code Prompt

```
You are improving the mobile experience of a React + Tailwind CSS finance app.

TASK: Wrap the existing transaction filters (date range, category select, type select)
in a collapsible panel on mobile screens in src/routes/Transactions.tsx.

REQUIREMENTS:
1. On mobile (below md breakpoint):
   a. Replace the filter row with a single "Filters" button that shows a funnel icon
      and a badge with the count of active filters (e.g. "Filters (2)").
   b. Below the button, render the filters in a collapsible <div> that transitions
      smoothly open/closed using Tailwind's `transition-all duration-200` with
      `max-h-0 overflow-hidden` → `max-h-96` toggle.
   c. Inside the panel, stack every filter control vertically (flex-col gap-3).
   d. Add a prominent "Clear filters" button at the bottom of the panel when any
      filter is active.

2. On md+ screens keep the existing horizontal filter layout unchanged.

3. Manage open/closed state with a single `useState<boolean>` hook called
   `filtersOpen`.

4. The active-filter count badge must recompute whenever filter values change.
   Count a filter as active if its value differs from its default/empty state.

5. Use only Tailwind utility classes. Do not add new dependencies.

6. Do not change any filter logic or state variables — only wrap their JSX.

After the change, describe the toggle mechanism and how the active-filter count
is computed.
```

---

## Improvement 3 — Touch Targets & Active States

### Problem
Several interactive elements (icon buttons, nav links, table row actions) have padding smaller than the recommended 44 × 44 px minimum, making them frustrating to tap on a phone. There are also no `:active` press animations, so the UI feels unresponsive to touch.

### Solution
Audit every tappable element and ensure minimum 44 px touch target. Add `active:` Tailwind variants to all interactive elements for immediate visual feedback.

### Claude Code Prompt

```
You are improving the mobile touch experience of a React + Tailwind CSS finance app.

TASK: Audit and fix touch targets and add active press states across the app.

FILES TO EDIT (check all of them):
- src/routes/Layout.tsx
- src/routes/Dashboard.tsx
- src/routes/Transactions.tsx
- src/routes/Accounts.tsx
- src/routes/Categories.tsx
- src/routes/Budgets.tsx
- src/components/SearchableSelect.tsx

REQUIREMENTS:
1. Every <button>, <a>, and <NavLink> must have a minimum tap area of 44×44 px.
   - Achieve this with padding: use at least `p-3` (12px) on icon-only buttons,
     or `min-h-[44px] min-w-[44px]` if padding alone isn't enough.
   - Do NOT change the visual size of icons — only their tap area.

2. Add an `active:` press state to every interactive element:
   - Buttons with background: add `active:brightness-90`
   - Ghost/icon buttons: add `active:bg-slate-100`
   - List/card rows: add `active:bg-slate-50`

3. The bottom tab bar NavLinks in Layout.tsx must each be at least 44 px tall.
   Ensure `py-3` or equivalent.

4. Do not change any logic, routing, or visual design beyond padding and active states.

List every file you changed and the specific classes you added or modified.
```

---

## Improvement 4 — Mobile-Optimised Dialogs / Bottom Sheets

### Problem
All CRUD dialogs use a centred modal overlay (`fixed inset-0 flex items-center justify-center`). On mobile this works poorly: the soft keyboard pushes content offscreen, the modal is wider than the screen on very small phones, and it feels out of place compared to native mobile UX.

### Solution
On mobile, render modals as **bottom sheets** (slide up from the bottom) using a conditional Tailwind class based on viewport. No new library needed — CSS transform transition + Headless UI Dialog is sufficient.

### Claude Code Prompt

```
You are improving the mobile experience of a React + Tailwind CSS finance app.

TASK: Convert all modal dialogs to bottom sheets on mobile while keeping centred
modals on md+ screens.

STEP 1 — Create a reusable wrapper component at src/components/MobileSheet.tsx:

  Props: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }

  Implementation rules:
  - Use the existing Headless UI <Dialog> (already a dependency).
  - On mobile (use a window.matchMedia or a custom hook): render the dialog panel as
    a bottom sheet:
      • `fixed bottom-0 inset-x-0 rounded-t-2xl bg-white shadow-xl`
      • Animate in with `translate-y-full` → `translate-y-0` using
        Tailwind `transition-transform duration-300 ease-out`.
      • Include a drag handle bar at the top (a 40×4 px rounded grey bar, centred).
      • Max height: `max-h-[90vh] overflow-y-auto` to avoid covering the full screen.
  - On md+ screens render as the current centred modal:
      • `relative mx-auto my-8 max-w-lg w-full rounded-2xl bg-white shadow-xl p-6`
  - The title is rendered in a sticky header inside the sheet with a close (×) button.
  - Clicking the backdrop calls onClose.

STEP 2 — Replace existing inline dialog panels in these files:
  - src/routes/Transactions.tsx  (add/edit transaction dialog)
  - src/routes/Accounts.tsx      (add/edit account dialog)
  - src/routes/Categories.tsx    (add/edit category dialog)
  - src/routes/Budgets.tsx       (add/edit budget dialog)

  For each file: import MobileSheet, wrap the dialog content with it, passing the
  existing open state and onClose handler. Remove the old Dialog.Panel wrapper.

STEP 3 — Ensure form inputs inside the sheet don't get obscured by the soft keyboard:
  - Add `pb-[env(safe-area-inset-bottom)]` to the sheet's bottom padding.
  - Set `inputMode` appropriately on number fields (inputMode="decimal").

Do not change any form logic, validation, or submit handlers.
After the change, describe the responsive detection approach used.
```

---

## Improvement 5 — Skeleton Loading Screens

### Problem
While data is fetching, pages show a plain "Loading…" text string. On mobile (often slower networks) users see a blank screen, which looks broken and increases perceived load time.

### Solution
Replace the loading string with **skeleton placeholder cards/rows** that match the shape of the loaded content.

### Claude Code Prompt

```
You are improving the mobile experience of a React + Tailwind CSS finance app.

TASK: Replace plain "Loading…" text with animated skeleton placeholders on all
data-driven pages.

STEP 1 — Create a reusable skeleton component at src/components/Skeleton.tsx:

  Export two components:
  1. <SkeletonLine width?: string; height?: string /> — a single rounded animated bar.
     Default: w-full h-4. Uses Tailwind's `animate-pulse bg-slate-200 rounded`.
  2. <SkeletonCard /> — a card-shaped placeholder with:
     - A tall line (h-5, w-2/3) for the title
     - Two shorter lines (h-3, w-full and w-1/2) for body text
     - Right-aligned block (h-6, w-16) for an amount
     All wrapped in `bg-white rounded-xl p-4 border border-slate-100 space-y-3`.

STEP 2 — Update each page to use skeletons:

  src/routes/Dashboard.tsx
  - While loading: render 4 <SkeletonCard /> in a `grid grid-cols-2 gap-4` for
    the stats row, and 2 <SkeletonCard /> below for charts.

  src/routes/Transactions.tsx
  - While loading: render 6 <SkeletonCard /> in a `space-y-3` list on mobile,
    and a table skeleton (5 rows of <SkeletonLine />) on md+.

  src/routes/Accounts.tsx
  - While loading: render 3 <SkeletonCard /> in a `space-y-3` list.

  src/routes/Budgets.tsx
  - While loading: render 4 <SkeletonCard /> in a `space-y-3` list.

  src/routes/Categories.tsx
  - While loading: render 6 <SkeletonLine /> in a `space-y-2` list.

STEP 3:
  - Keep the existing loading state variable; just change what is rendered when it's true.
  - Do not add any new state or data-fetching logic.

After the change, show the JSX of SkeletonCard and confirm which pages were updated.
```

---

## Improvement 6 — Responsive Charts & Dashboard Polish

### Problem
Dashboard charts use a fixed `h-64` height and may render too small or overflow on narrow screens. The "Recent Transactions" section also uses a table that needs the card treatment on mobile.

### Solution
Make chart containers fluid (`aspect-video` instead of fixed height) and apply the card layout to the recent transactions list on the Dashboard as well.

### Claude Code Prompt

```
You are improving the mobile experience of a React + Tailwind CSS finance app.

TASK: Polish the Dashboard page (src/routes/Dashboard.tsx) for mobile screens.

REQUIREMENTS:

1. Charts — make them fluid:
   - Replace fixed `h-64` height on chart wrapper divs with `w-full aspect-[4/3]`
     so charts scale proportionally on any screen width.
   - Add `responsive: true` and `maintainAspectRatio: true` to each Chart.js
     options object (if not already present).
   - On mobile (below md), render charts in a single column; on md+ keep the
     existing 2-column grid.

2. Recent Transactions list — apply card layout:
   - If the Dashboard renders a table of recent transactions, apply the same card
     pattern as Improvement 1: hide the table on mobile, show a card list instead.
   - Each card: description (bold) + date (muted) on the left, amount (coloured)
     on the right.

3. Stat summary cards:
   - Ensure the 4-stat grid uses `grid-cols-2 md:grid-cols-4`.
   - Each stat card must have `min-h-[80px]` so they don't collapse on small screens.
   - Truncate long account/category names with `truncate` to prevent overflow.

4. General:
   - Wrap the whole page in a `space-y-6` container for consistent vertical rhythm.
   - Add `overflow-hidden` to any card that might bleed outside its bounds.

Do not change data fetching, state, or Chart.js dataset configuration.
After the change, describe what was modified in each of the 3 areas above.
```

---

## Suggested Implementation Order

Run these prompts in Claude Code **one at a time**, in this order — each builds on a stable baseline:

1. **Prompt 3** (Touch targets) — Pure additive, lowest risk, instant feel improvement.
2. **Prompt 5** (Skeletons) — Additive, no logic changes, improves perceived performance.
3. **Prompt 1** (Card layouts) — Core UX change, high impact on Transactions & Accounts.
4. **Prompt 2** (Filter drawer) — Depends on card layout being in place.
5. **Prompt 6** (Dashboard charts) — Polish once other pages are solid.
6. **Prompt 4** (Bottom sheets) — Biggest refactor; do last once everything else is stable.

---

## How to Use These Prompts with Claude Code

1. Open a terminal in your project root (`fcristinadebora/finance-app`).
2. Run `claude` to start a session.
3. Paste one prompt at a time.
4. After each prompt, **review the diff** (`git diff`) before moving on.
5. Run `npm run dev` and test on a real device or browser DevTools mobile emulation.

> Tip: commit after each improvement so you can roll back easily if something breaks.
