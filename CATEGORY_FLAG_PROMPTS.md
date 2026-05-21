# Category "Exclude from totals" Flag — Claude Code Prompts

> **What this solves:** categories like "Savings", "Investimentos", "Previdência" that used to
> represent financial movements in your old app should not inflate expenses, deflate savings rate,
> or eat into budgets. Transactions under these categories stay visible everywhere but are silently
> excluded from every total, chart, and budget calculation.
>
> Run the **SQL first** (in Supabase dashboard), then the three prompts **in order**.
> Commit after each prompt.

---

## Step 0 — Run this SQL in your Supabase dashboard

Go to **Supabase → SQL Editor** and run:

```sql
-- Add the flag to the categories table
ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS exclude_from_totals boolean NOT NULL DEFAULT false;

-- Index so queries filtering on this column are fast
CREATE INDEX IF NOT EXISTS idx_categories_exclude_from_totals
  ON categories (exclude_from_totals)
  WHERE exclude_from_totals = true;
```

No data migration needed — all existing categories default to `false` (normal behaviour).

---

## Prompt 1 — Update TypeScript types

**What it does:** Adds the new column to the generated types file so the rest of the codebase
is type-safe. No logic changes yet.

```
You are updating the TypeScript database types for a React + Supabase finance app.

FILE TO EDIT: src/types/database.types.ts

TASK: The `categories` table has a new column `exclude_from_totals boolean NOT NULL DEFAULT false`.
Add it to the three places in the file where category fields are listed:

1. Under  categories → Row:
   Add:  exclude_from_totals: boolean

2. Under  categories → Insert:
   Add:  exclude_from_totals?: boolean | null

3. Under  categories → Update:
   Add:  exclude_from_totals?: boolean | null

Do not change anything else in the file.
After the edit, show the updated Row, Insert and Update blocks for the categories table.
```

---

### Commit 1

```
chore(types): add exclude_from_totals to Category DB types

Column added via SQL migration in Supabase.
Defaults to false — no behaviour change for existing categories.
```

---

## Prompt 2 — Categories page UI

**What it does:** Shows the flag as a toggle on each category row and exposes it in the
create form. Uses the existing `updateCategory` function — no new API needed.

```
You are updating the Categories page of a React + TypeScript + Tailwind CSS finance app.

FILES TO EDIT:
  src/routes/Categories.tsx
  src/data/categories.ts   (minor — add field to createCategory call)

CONTEXT:
  Category type now has:  exclude_from_totals: boolean
  updateCategory(id, patch) already exists in src/data/categories.ts — use it directly.
  The page uses a MobileSheet component for the create dialog.

─── CHANGES TO Categories.tsx ──────────────────────────────────────────────────

1. TABLE ROWS — add an "Exclude from totals" toggle column:

   Add a fourth <th> header: "Reporting" (text-xs uppercase text-slate-500)

   For each category row, add a <td> that renders a toggle button:
   - When exclude_from_totals is FALSE (normal): show a pill badge
       "Included"  →  bg-emerald-50 text-emerald-700 border border-emerald-200
   - When exclude_from_totals is TRUE (excluded): show a pill badge
       "Excluído"  →  bg-slate-100 text-slate-500 border border-slate-200
   - The entire badge is a <button> with onClick that calls updateCategory and
     refreshes the list.
   - While the toggle is saving, show "..." in the badge and disable the button.
   - Badge style base: text-xs font-medium px-2.5 py-1 rounded-full cursor-pointer
     active:opacity-70 transition-colors min-w-[72px] text-center
   - Use a local state Map<string, boolean> called `toggling` to track which
     category IDs are currently saving. Initialize as new Map().

2. CREATE FORM — add an "Exclude from totals" checkbox:

   Below the Kind radio group, add:
   ```
   <label className="flex items-center gap-3 cursor-pointer select-none">
     <input
       type="checkbox"
       checked={excludeFromTotals}
       onChange={e => setExcludeFromTotals(e.target.checked)}
       className="w-4 h-4 rounded"
     />
     <div>
       <span className="text-sm font-medium">Excluir dos totais</span>
       <p className="text-xs text-slate-500 mt-0.5">
         Poupanças, investimentos e outros movimentos financeiros que
         não devem contar como despesa ou receita.
       </p>
     </div>
   </label>
   ```
   Add useState:  const [excludeFromTotals, setExcludeFromTotals] = useState(false)
   Reset it to false in openDialog().
   Pass it to createCategory: { name, kind, exclude_from_totals: excludeFromTotals }

3. FILTER TABS — add a fourth filter option "Excluídos" that filters to
   categories where exclude_from_totals === true.
   Update the KindFilter type:
     type KindFilter = 'all' | 'income' | 'expense' | 'excluded'
   Update the visible filter logic accordingly.
   Update emptyMessage for the 'excluded' case:
     "Nenhuma categoria excluída dos totais."

4. CATEGORY NAME DISPLAY — when exclude_from_totals is true, show the name
   with a small "⊘" prefix in text-slate-400, e.g.:
     <span className="text-slate-400 mr-1 text-xs">⊘</span>{row.name}

─── CHANGES TO src/data/categories.ts ─────────────────────────────────────────

In createCategory, the input type is already
  Omit<CategoryInsert, 'user_id' | 'id' | 'created_at'>
CategoryInsert now includes exclude_from_totals?: boolean | null, so no function
signature change is needed — just confirm the insert passes the field through
(it already does via spread).

─── RULES ──────────────────────────────────────────────────────────────────────

- Do not change any other logic, routing, or styling.
- Keep all existing Tailwind classes on unchanged elements.
- The table must still be responsive (existing classes preserved).
- All user-facing strings in Portuguese to match the bilingual context of the app.

After changes, describe the toggle mechanism and how optimistic vs confirmed state
is handled.
```

---

### Commit 2

```
feat(categories): add exclude_from_totals toggle and filter

- Toggle badge on each row (Included / Excluído) calls updateCategory inline
- "Excluídos" filter tab to view all excluded categories at once
- ⊘ prefix on excluded category names for instant visual scan
- Create form checkbox with Portuguese description label
- Tracks saving state per-category to prevent double-taps
```

---

## Prompt 3 — Exclude from all calculations

**What it does:** The most important prompt. Makes every number in the app respect the flag:
the dashboard totals, budget tracking, and a visual indicator in the transaction list.

```
You are updating calculation logic across a React + TypeScript + Tailwind CSS finance app.
A category can now have exclude_from_totals: boolean. Transactions whose category has
this flag set to true must NOT be counted in any income, expense, savings, or budget figure.
They remain visible in lists but are visually marked as excluded.

CONTEXT:
  - categories are already fetched in all relevant pages via listCategories()
  - The Category type has: exclude_from_totals: boolean
  - Transfers (kind === 'transfer') are already excluded everywhere — do not change that logic

─── FILE 1: src/routes/Dashboard.tsx ───────────────────────────────────────────

Build an excluded category ID Set right after categories are loaded:

  const excludedCatIds = new Set(
    categories.filter(c => c.exclude_from_totals).map(c => c.id)
  )

Then apply this filter to EVERY place a transaction's amount is added to a total.
A transaction is "excluded" if:
  t.kind === 'transfer'  OR  (t.category_id !== null && excludedCatIds.has(t.category_id))

Specifically update:
  1. incomeThisMonth   — skip excluded transactions
  2. expenseThisMonth  — skip excluded transactions
  3. spendByCategory   — skip excluded transactions (they won't appear in spending breakdown)
  4. budgetRows / totalSpentOnBudgetedCategories — skip excluded transactions
  5. monthlyTotals loop (for balance history) — skip excluded transactions
     (transfers already net to zero, but excluded expense categories would distort history)

Note: balanceLastMonth derivation uses incomeThisMonth - expenseThisMonth, so it
automatically benefits from the fix above. No separate change needed.

Do NOT change: totalBalance (computed from account balances view, not transactions),
any Chart.js options, JSX layout, or loading state.

─── FILE 2: src/routes/Transactions.tsx ────────────────────────────────────────

Transactions with an excluded category should stay in the list but show a subtle
visual indicator so the user knows they don't count toward totals.

CHANGES:
1. The page already fetches categories (or add the fetch if it doesn't exist).
   Build the same excludedCatIds Set.

2. In the mobile card layout (block md:hidden):
   If a transaction's category is excluded, append a small pill after the
   category name:
     <span className="ml-1 text-[10px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded-full">
       excluído
     </span>

3. In the desktop table layout (hidden md:block):
   In the category column cell, if excluded, show the category name with the
   same "excluído" pill inline.

4. Do not change filters, sorting, pagination, or any CRUD logic.

─── FILE 3: src/routes/Budgets.tsx ─────────────────────────────────────────────

If the Budgets page shows a spent amount per budget category, apply the same
excludedCatIds filter to any transaction aggregation there.
If it only shows the budget limit (monthly_limit from the budgets table) and doesn't
aggregate transactions itself, no change is needed — just note that in your response.

─── RULES ──────────────────────────────────────────────────────────────────────

- The excludedCatIds Set pattern must be identical in all three files for consistency.
- Do not show excluded transactions differently in terms of amount colour or row opacity
  — only the small "excluído" pill is needed. Changing opacity would make them hard to read.
- Do not add new data fetches. All three pages already have categories in scope
  (or add a listCategories() call to any page that's missing it, inside the existing
  Promise.all if there is one).
- Do not change any TypeScript types.

After changes, list each file and the specific calculation or render lines updated.
```

---

### Commit 3

```
feat(reporting): exclude flagged categories from all totals and charts

Dashboard:
- incomeThisMonth, expenseThisMonth, spendByCategory, budgetRows,
  balanceHistory all skip transactions whose category has exclude_from_totals=true
- savingsRate and balanceTrend derive correctly as a result

Transactions:
- "excluído" pill shown inline on cards and table rows for excluded categories
- No change to filters, CRUD, or amount display

Budgets:
- Transaction aggregation (if any) updated to match same exclusion rule

Transfers remain excluded via their existing kind='transfer' check.
```

---

## Quick sanity check after all three prompts

Open the app and go to Categories. Find one of your old "savings" categories
(e.g. "Poupança", "Investimentos") and click its badge to mark it **Excluído**.

Then open the Dashboard. You should see:
- `expenseThisMonth` drop (those transactions no longer count as spending)
- `savingsRate` improve (same income, lower "expenses")
- The budget pulse section no longer penalises you for those entries
- The transactions themselves still show up in the Transactions page, just with the "excluído" pill
