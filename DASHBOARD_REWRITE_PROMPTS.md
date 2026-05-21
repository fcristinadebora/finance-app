# Dashboard Rewrite — Claude Code Prompts & Commit Messages

> Run these two prompts **in order** in a Claude Code session inside the project root.  
> Commit after each one so you can roll back cleanly.

---

## Prompt 1 — Compute all the data

**What it does:** Replaces the data-fetching and computation logic in `Dashboard.tsx` with the new
metrics (budget pacing, balance trend, savings rate, balance history). No UI changes yet — this lets
you verify the numbers are correct before touching the layout.

```
You are rewriting the data layer of src/routes/Dashboard.tsx in a React + TypeScript + Tailwind
finance app that uses Supabase.

CONTEXT — existing data APIs (do not change these files):
  • listAccounts()          → Promise<Account[]>
      Account: { id, name, currency, type, starting_balance }
  • listAccountBalances()   → Promise<Record<string, number>>   // account_id → current balance
  • listCategories()        → Promise<Category[]>
      Category: { id, name, color? }
  • listTransactions(opts)  → Promise<Transaction[]>
      Transaction: { id, account_id, category_id, amount, kind, occurred_on, description }
      kind values: 'income' | 'expense' | 'transfer'
      amount: positive = money in, negative = money out
      IMPORTANT: kind === 'transfer' must ALWAYS be excluded from income/expense calculations
  • listBudgets()           → Promise<Budget[]>
      Budget: { id, category_id, monthly_limit }

All imports are already available from '../data'.

TASK: Replace the useEffect + state in Dashboard.tsx with a new version that computes
the following derived values. Keep the JSX untouched for now — just update the state
variables and computations so the new values are available as local consts.

─── REQUIRED DERIVED VALUES ───────────────────────────────────────────────────

1. totalBalance: number
   Sum of all values in the balances record.

2. balanceLastMonth: number
   Approximate last month's closing balance by subtracting this month's net
   real transactions (kind !== 'transfer') from totalBalance.
   Formula: totalBalance - (incomeThisMonth - expenseThisMonth)

3. balanceTrend: number
   totalBalance - balanceLastMonth  (positive = grew, negative = shrank)

4. incomeThisMonth: number
   Sum of amounts > 0 for transactions where kind !== 'transfer' and
   occurred_on is within the current calendar month.

5. expenseThisMonth: number
   Sum of abs(amount) for transactions where amount < 0 and kind !== 'transfer'
   and occurred_on is within the current calendar month.

6. netThisMonth: number
   incomeThisMonth - expenseThisMonth

7. savingsRate: number   (0–100, rounded to 1 decimal place)
   incomeThisMonth === 0 ? 0 : (netThisMonth / incomeThisMonth) * 100
   Clamp to minimum 0 (don't show negative savings rate — just 0%).

8. daysInMonth: number      — total days in the current calendar month
   daysElapsed: number      — days elapsed so far (inclusive of today)
   pctMonthElapsed: number  — (daysElapsed / daysInMonth) * 100, rounded to 1 dp

9. totalBudget: number
   Sum of monthly_limit across all budgets.

10. totalSpentOnBudgetedCategories: number
    Sum of expenseThisMonth only for transactions whose category_id appears
    in at least one Budget record. Ignore uncategorised or unbudgeted spend.

11. pctBudgetUsed: number
    totalBudget === 0 ? 0 : (totalSpentOnBudgetedCategories / totalBudget) * 100
    Rounded to 1 decimal place.

12. budgetRows: Array<{
      categoryId: string
      categoryName: string
      limit: number
      spent: number
      pct: number          // spent / limit * 100, clamped to max 200
      status: 'ok' | 'warning' | 'over'
        // 'warning' when pct >= 80 && pct < 100
        // 'over'    when pct >= 100
    }>
    One entry per Budget, sorted by pct descending (most at-risk first).

13. alertRows: budgetRows filtered to status === 'over' or status === 'warning',
    sorted by pct descending.

14. balanceHistory: Array<{ label: string; balance: number }>
    6 entries, one per calendar month, oldest first (index 0 = 5 months ago).
    For each month M:
      - Compute netM = sum of amounts (including transfers, since transfers net
        to zero across accounts) for all transactions in month M.
      - Build history by starting from totalBalance and walking backwards:
          history[5] = totalBalance  (current month end ≈ current balance)
          history[4] = history[5] - net(current month)
          history[3] = history[4] - net(1 month ago)
          ... and so on
      - label: 3-letter month abbreviation using date-fns format(date, 'MMM')

─── DATA FETCHING ──────────────────────────────────────────────────────────────

Fetch exactly these four calls in one Promise.all:
  listAccounts(), listAccountBalances(), listCategories(),
  listTransactions({ from: monthsAgoStart(5), includeTransfers: true })

Keep the existing monthsAgoStart helper.  Add listBudgets to the import from '../data'.
Fetch budgets in the same Promise.all as the 5th item.

─── RULES ──────────────────────────────────────────────────────────────────────

- Do not change any JSX yet.
- Do not change the loading / error handling pattern.
- Export all derived values as const inside the component body so the JSX can
  reference them in the next step.
- Remove unused imports (Doughnut, ArcElement if no longer used).
- The existing helpers firstOfMonthISO, lastOfMonthISO, monthsAgoStart, formatCurrency
  must be kept — they will be used in Prompt 2.
- Add Chart.js LineElement and PointElement to the Chart.register() call
  (needed for the line chart in Prompt 2), keep existing registrations.

After making changes, list every new derived value with its computed type.
```

---

### Commit 1

```
feat(dashboard): compute budget pacing, balance trend and savings metrics

- Fetch budgets alongside accounts, categories and transactions
- Derive: totalBudget, totalSpentOnBudgetedCategories, pctBudgetUsed
- Derive: budgetRows (per-category spent/limit/status) sorted by risk
- Derive: alertRows (over/warning budget categories)
- Derive: balanceLastMonth, balanceTrend, savingsRate
- Derive: daysInMonth, daysElapsed, pctMonthElapsed
- Derive: balanceHistory (6-month rolling balance array)
- Register LineElement + PointElement for upcoming line chart
- Transfers (kind='transfer') excluded from all income/expense figures
```

---

## Prompt 2 — Redesign the UI

**What it does:** Replaces the entire JSX of `Dashboard.tsx` with the new layout using the
derived values from Prompt 1. Run this immediately after committing Prompt 1.

```
You are redesigning the JSX layout of src/routes/Dashboard.tsx in a React + TypeScript
+ Tailwind CSS 4 finance app.

All derived values listed below are already computed as consts in the component body.
Do NOT change any data-fetching, state, or computation logic. Only replace the returned JSX.

AVAILABLE CONSTS (already in scope):
  fmt(n)                  — formats n as currency string
  totalBalance            — number
  balanceTrend            — number (positive = grew vs last month)
  incomeThisMonth         — number
  expenseThisMonth        — number
  netThisMonth            — number
  savingsRate             — number (0–100)
  daysInMonth             — number
  daysElapsed             — number
  pctMonthElapsed         — number (0–100)
  totalBudget             — number
  totalSpentOnBudgetedCategories — number
  pctBudgetUsed           — number (0–100)
  budgetRows              — Array<{ categoryId, categoryName, limit, spent, pct, status }>
  alertRows               — same shape, only 'over' and 'warning' entries
  balanceHistory          — Array<{ label: string; balance: number }>  (6 items, oldest first)
  currency                — string (e.g. 'USD')

─── LAYOUT SPEC ────────────────────────────────────────────────────────────────

The new dashboard has four visual sections rendered as a single-column stack on mobile
and a two-column grid on lg+ for sections 2 and 3. Wrap everything in:
  <div className="space-y-5 pb-4">

──────────────────────────────────────────────────────────────────────────────
SECTION A — Budget Pulse  (full width, always)
──────────────────────────────────────────────────────────────────────────────
A card with bg-white rounded-2xl shadow-sm border border-slate-100 p-5.

A1. Header row (flex justify-between items-start):
  Left: label "This month's budget" in text-xs font-medium text-slate-500 uppercase tracking-wide
  Right: a MonthPace chip (see below)

A2. Big number row (mt-2):
  <span className="text-4xl font-bold tabular-nums">
    {fmt(totalSpentOnBudgetedCategories)}
  </span>
  <span className="text-slate-400 text-lg ml-2">/ {fmt(totalBudget)}</span>
  Below that, in text-sm text-slate-500:
    "{fmt(totalBudget - totalSpentOnBudgetedCategories)} remaining"
    — if totalSpentOnBudgetedCategories > totalBudget, show
    "{fmt(totalSpentOnBudgetedCategories - totalBudget)} over budget" in text-rose-600

A3. Overall budget progress bar (mt-3):
  A thin (h-2.5) rounded-full bg-slate-100 bar.
  Fill: use pctBudgetUsed clamped to 100 for the visual width.
  Fill colour:
    pctBudgetUsed >= 100 → bg-rose-500
    pctBudgetUsed >= 80  → bg-amber-400
    otherwise            → bg-emerald-500
  Animate with transition-all duration-500.

A4. MonthPace chip (used in A1 right side):
  Show: "{pctMonthElapsed}% of month · {daysInMonth - daysElapsed}d left"
  Then a second line (text-xs):
    delta = pctBudgetUsed - pctMonthElapsed
    if delta <= -5:  "🟢 {Math.abs(delta).toFixed(0)}% under pace" in text-emerald-600
    if delta >=  5:  "🔴 {delta.toFixed(0)}% over pace"            in text-rose-600
    otherwise:       "🟡 On track"                                  in text-amber-600
  Wrap in a pill: rounded-full bg-slate-50 border border-slate-200 px-3 py-1 text-xs text-right

A5. Per-category budget rows (mt-4, space-y-3):
  Only render if budgetRows.length > 0; otherwise show a muted "No budgets set yet" message.
  For each row in budgetRows:
    - Row header: flex justify-between
        Left:  categoryName in text-sm font-medium
        Right: "{fmt(row.spent)} / {fmt(row.limit)}" in text-xs text-slate-500
    - Progress bar: h-1.5 rounded-full bg-slate-100 overflow-hidden mt-1
        Fill width: Math.min(row.pct, 100)%
        Fill colour:
          status 'over'    → bg-rose-500
          status 'warning' → bg-amber-400
          status 'ok'      → bg-emerald-500
    - If status is 'over':    show a tiny badge "Over" in rose pill after the category name
      If status is 'warning': show a tiny badge "Near limit" in amber pill after the category name
      Badge style: ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-full

──────────────────────────────────────────────────────────────────────────────
SECTION B — Alerts  (full width, only render if alertRows.length > 0)
──────────────────────────────────────────────────────────────────────────────
A card with bg-rose-50 border border-rose-200 rounded-2xl p-4.

Header: "⚠️ Budget alerts" in text-sm font-semibold text-rose-700.
Body: a list (space-y-1 mt-2) of alert rows:
  Each row: flex justify-between text-sm
    Left:  categoryName  (font-medium text-rose-800 if over, text-amber-800 if warning)
    Right: status 'over' → "{fmt(row.spent - row.limit)} over"  in text-rose-600 font-medium
           status 'warning' → "{row.pct.toFixed(0)}% used"       in text-amber-600 font-medium

──────────────────────────────────────────────────────────────────────────────
SECTIONS C & D — on lg+ render side-by-side: <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
──────────────────────────────────────────────────────────────────────────────

SECTION C — Balance & Growth  (left column on lg+)
Card: bg-white rounded-2xl shadow-sm border border-slate-100 p-5

C1. Label: "Balance" text-xs font-medium text-slate-500 uppercase tracking-wide
C2. Big balance: text-3xl font-bold tabular-nums  → {fmt(totalBalance)}
C3. Trend chip (inline, ml-3):
    balanceTrend > 0 → "↑ {fmt(balanceTrend)} vs last month"  bg-emerald-50 text-emerald-700
    balanceTrend < 0 → "↓ {fmt(Math.abs(balanceTrend))} vs last month"  bg-rose-50 text-rose-700
    balanceTrend = 0 → "No change"  bg-slate-50 text-slate-500
    Style: text-xs font-medium rounded-full px-2.5 py-1

C4. Two sub-stats row (mt-4 grid grid-cols-2 gap-3):
    Left card  (bg-slate-50 rounded-xl p-3):
      label "Net savings"  text-[11px] text-slate-500 uppercase
      value fmt(netThisMonth) coloured emerald-600 if >= 0 else rose-600  text-xl font-semibold
    Right card (bg-slate-50 rounded-xl p-3):
      label "Savings rate"  text-[11px] text-slate-500 uppercase
      value "{savingsRate.toFixed(1)}%"  coloured emerald-600 if >= 10 else amber-600 if >= 0 else rose-600
      text-xl font-semibold
      — if savingsRate < 0, show "0%" and a note "spending > income" in text-[10px] text-rose-400

C5. Balance history line chart (mt-4):
    Use react-chartjs-2 <Line> with balanceHistory data.
    chartData:
      labels: balanceHistory.map(h => h.label)
      datasets: [{
        label: 'Balance',
        data: balanceHistory.map(h => h.balance),
        borderColor: '#0ea5e9',
        backgroundColor: 'rgba(14,165,233,0.08)',
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        pointBackgroundColor: '#0ea5e9',
      }]
    chartOptions:
      responsive: true, maintainAspectRatio: true (let the wrapper drive height)
      plugins.legend.display: false
      plugins.tooltip.callbacks.label: ctx => fmt(ctx.parsed.y)
      scales.x: { grid: { display: false }, ticks: { font: { size: 11 } } }
      scales.y: {
        grid: { color: 'rgba(0,0,0,0.04)' },
        ticks: { font: { size: 10 }, callback: v => fmt(Number(v)) },
        beginAtZero: false
      }
    Wrapper: <div className="w-full aspect-[2/1]">
    Import Line from 'react-chartjs-2'; import LineElement, PointElement from 'chart.js'
    (already registered in Prompt 1).

──────────────────────────────────────────────────────────────────────────────
SECTION D — Spending Breakdown  (right column on lg+)
Card: bg-white rounded-2xl shadow-sm border border-slate-100 p-5
──────────────────────────────────────────────────────────────────────────────

D1. Header: "Spending this month" text-xs font-medium text-slate-500 uppercase tracking-wide
D2. Two inline stats (mt-1 flex gap-4 items-baseline):
    <span className="text-2xl font-bold tabular-nums">{fmt(expenseThisMonth)}</span>
    <span className="text-sm text-slate-400">income {fmt(incomeThisMonth)}</span>

D3. Category spend list (mt-4 space-y-2):
    Show budgetRows (all, not just alerts) with their spent amount and a mini bar.
    Also show ANY categories that have spending but NO budget (pull from spendByCategory
    — you'll need to derive spendByCategory the same way the original Dashboard did,
    using only non-transfer transactions this month).
    For unbudgeted categories, show a grey bar with no limit label.

    Each row:
      flex justify-between items-center gap-2
      Left:  category colour dot (w-2.5 h-2.5 rounded-full bg-[{cat.color ?? '#94a3b8'}])
             + category name text-sm truncate max-w-[120px] md:max-w-none
      Right: fmt(spent) text-sm font-medium tabular-nums
      Below: a very thin h-1 bg-slate-100 rounded bar, fill based on proportion of
             expenseThisMonth (i.e. spent/expenseThisMonth * 100%), fill colour:
               has budget + status over    → bg-rose-400
               has budget + status warning → bg-amber-400
               has budget + ok             → bg-sky-400
               no budget                   → bg-slate-300

D4. If no spending at all: centred muted text "No expenses recorded this month"

──────────────────────────────────────────────────────────────────────────────
LOADING STATE
──────────────────────────────────────────────────────────────────────────────
Replace the plain "Loading…" text with animated skeleton placeholders:
  Section A skeleton: a card with three SkeletonLine elements (h-8 w-1/2, h-2.5 w-full, h-2.5 w-3/4)
    + four shorter lines below (h-1.5 w-full × 4) spaced with space-y-3.
  Sections C/D skeleton: two cards side by side (lg:grid-cols-2), each with
    a h-6 w-1/3, h-4 w-full, h-32 w-full SkeletonLine stack.

Use inline `animate-pulse bg-slate-200 rounded` for skeleton lines — no extra component needed.

──────────────────────────────────────────────────────────────────────────────
GENERAL RULES
──────────────────────────────────────────────────────────────────────────────
- Use only Tailwind utility classes. No inline style except for dynamic widths on
  progress bars (style={{ width: `${pct}%` }}).
- All monetary values must use the fmt() helper.
- Transfers (kind === 'transfer') must not appear in any income/expense/spend figure.
- Remove all references to the old Doughnut chart and Bar chart — those are gone.
- Keep all existing import statements that are still needed; remove those that are not.
- The component must still be the default export named Dashboard.
- Do not add any new files — everything goes in Dashboard.tsx.

After making changes, confirm which sections A–D were implemented and flag any
derived value you could not find in scope.
```

---

### Commit 2

```
feat(dashboard): redesign with budget pacing, balance growth and spending breakdown

BREAKING CHANGE: removes old doughnut + bar charts

New layout:
- Section A: budget pulse — total spent vs budget, overall progress bar,
  month-pace chip (% of month vs % of budget used), per-category bars
  with 'Near limit' / 'Over' badges
- Section B: alert strip — highlights over/warning categories in rose card
  (only rendered when alerts exist)
- Section C: balance & growth — current balance with trend vs last month,
  net savings, savings rate, 6-month balance history line chart
- Section D: spending breakdown — expense total, per-category proportional
  bars (budgeted and unbudgeted), colour-coded by budget status

Transfers excluded from all income/expense/savings calculations
Mobile-first single column layout, 2-column grid on lg+
Animated skeleton placeholders replace plain loading text
```

---

## Tips

- After **Prompt 1**, open the browser console to verify the computed numbers make sense before running Prompt 2.
- The `pctBudgetUsed` and `pctMonthElapsed` are the key numbers — log them to confirm the pacing logic works.
- If you have no budgets yet, Section A will show a "No budgets set yet" message — create a couple in the Budgets page first to see the full dashboard.
- Test on Chrome DevTools → iPhone 14 Pro (393 × 852) and a desktop viewport to verify both layouts.
