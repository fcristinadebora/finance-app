import { useEffect, useState, useMemo } from 'react'
import { format } from 'date-fns'
import {
  Chart, ArcElement, CategoryScale, LinearScale,
  BarElement, LineElement, PointElement, Tooltip, Legend,
} from 'chart.js'
import { Doughnut, Bar, Line } from 'react-chartjs-2'
import {
  listAccounts, listAccountBalances, listCategories,
  listTransactions, listPeriods, getPeriodBounds, listPeriodAccountSnapshots,
} from '../data'
import type { Account, Category, Transaction, Period, PeriodAccountSnapshot } from '../data'

Chart.register(ArcElement, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend)

// ─── utilities ────────────────────────────────────────────────────────────────

function firstOfMonthISO(date = new Date()) {
  const d = new Date(date); d.setDate(1); return d.toISOString().slice(0, 10)
}
function lastOfMonthISO(date = new Date()) {
  const d = new Date(date)
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10)
}
function monthsAgoStart(n: number) {
  const d = new Date(); d.setMonth(d.getMonth() - n); d.setDate(1)
  return d.toISOString().slice(0, 10)
}
function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount)
}

const CHART_COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#64748b', '#a855f7']

interface MonthlyTotal { label: string; income: number; expense: number }
function getMonthBounds(monthsAgo: number) {
  const d = new Date(); d.setMonth(d.getMonth() - monthsAgo)
  return { start: firstOfMonthISO(d), end: lastOfMonthISO(d), label: format(d, 'MMM') }
}

// ─── Period range selector ────────────────────────────────────────────────────

function PeriodRangeSelector({
  periods, olderIdx, newerIdx, onOlder, onNewer,
}: {
  periods: Period[]
  olderIdx: number
  newerIdx: number
  onOlder: (i: number) => void
  onNewer: (i: number) => void
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-slate-500">From</span>
      <select
        value={olderIdx}
        onChange={e => onOlder(Number(e.target.value))}
        className="border border-slate-200 rounded px-2 py-1 text-xs bg-white"
      >
        {periods.map((p, i) => (
          <option key={p.id} value={i}>{getPeriodBounds(periods, i).label}</option>
        ))}
      </select>
      <span className="text-xs text-slate-500">to</span>
      <select
        value={newerIdx}
        onChange={e => onNewer(Number(e.target.value))}
        className="border border-slate-200 rounded px-2 py-1 text-xs bg-white"
      >
        {periods.map((p, i) => (
          <option key={p.id} value={i}>{i === 0 ? `Current · ${getPeriodBounds(periods, 0).label}` : getPeriodBounds(periods, i).label}</option>
        ))}
      </select>
    </div>
  )
}

// ─── Account balance history chart ───────────────────────────────────────────

function AccountBalanceHistoryChart({
  periods, periodSnapshots, accounts, currency,
}: {
  periods: Period[]
  periodSnapshots: PeriodAccountSnapshot[]
  accounts: Account[]
  currency: string
}) {
  const defaultOlder = Math.min(11, periods.length - 1)
  const [olderIdx, setOlderIdx] = useState(defaultOlder)
  const [newerIdx, setNewerIdx] = useState(0)
  const [hiddenAccounts, setHiddenAccounts] = useState<Set<string>>(new Set())
  const [showTotal, setShowTotal] = useState(true)

  useEffect(() => { setOlderIdx(Math.min(11, periods.length - 1)) }, [periods.length])

  const fmt = (n: number) => formatCurrency(n, currency)

  // older index must be >= newer index (older period = higher index)
  const from = Math.max(olderIdx, newerIdx)
  const to   = Math.min(olderIdx, newerIdx)

  const snapLookup = useMemo(() => {
    const m: Record<string, Record<string, number>> = {}
    for (const s of periodSnapshots) {
      if (!m[s.period_id]) m[s.period_id] = {}
      m[s.period_id][s.account_id] = s.balance
    }
    return m
  }, [periodSnapshots])

  const chartData = useMemo(() => {
    if (!periods.length) return null
    // slice from newerIdx to olderIdx (inclusive), then reverse → oldest→newest on x-axis
    const slice = periods.slice(to, from + 1).reverse()
    const labels = slice.map((p, _) => {
      const idx = periods.indexOf(p)
      return getPeriodBounds(periods, idx).label
    })

    const datasets: any[] = []

    if (showTotal) {
      datasets.push({
        label: 'Total',
        data: slice.map(p => p.total_balance ?? null),
        borderColor: '#1e293b',
        backgroundColor: 'transparent',
        borderWidth: 2.5,
        borderDash: [6, 3],
        tension: 0.3,
        spanGaps: true,
        pointRadius: 3,
        order: 0,
      })
    }

    accounts
      .filter(a => !hiddenAccounts.has(a.id))
      .forEach((a, i) => {
        const color = CHART_COLORS[i % CHART_COLORS.length]
        datasets.push({
          label: a.name,
          data: slice.map(p => snapLookup[p.id]?.[a.id] ?? null),
          borderColor: color,
          backgroundColor: color + '18',
          tension: 0.3,
          spanGaps: true,
          pointRadius: 3,
          fill: false,
          order: i + 1,
        })
      })

    return { labels, datasets }
  }, [periods, snapLookup, accounts, from, to, hiddenAccounts, showTotal])

  const options = useMemo(() => ({
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (ctx: any) => `${ctx.dataset.label}: ${fmt(ctx.parsed.y)}` } },
    },
    scales: { y: { ticks: { callback: (v: any) => fmt(Number(v)) } } },
  }), [currency])

  const toggle = (id: string) =>
    setHiddenAccounts(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  const hasData = chartData && chartData.datasets.some(d => d.data.some((v: any) => v != null))

  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-start justify-between flex-wrap gap-3 mb-3">
        <p className="text-sm font-medium">Balance history by account</p>
        {periods.length > 0 && (
          <PeriodRangeSelector
            periods={periods}
            olderIdx={olderIdx} newerIdx={newerIdx}
            onOlder={setOlderIdx} onNewer={setNewerIdx}
          />
        )}
      </div>

      {/* toggles */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        <button
          onClick={() => setShowTotal(v => !v)}
          className={`text-[11px] px-2.5 py-1 rounded-full border font-medium transition-colors ${
            showTotal ? 'bg-slate-800 text-white border-slate-800' : 'text-slate-400 border-slate-200'
          }`}
        >
          Total
        </button>
        {accounts.map((a, i) => {
          const hidden = hiddenAccounts.has(a.id)
          const color = CHART_COLORS[i % CHART_COLORS.length]
          return (
            <button
              key={a.id}
              onClick={() => toggle(a.id)}
              style={!hidden ? { backgroundColor: color + '20', borderColor: color, color } : undefined}
              className={`text-[11px] px-2.5 py-1 rounded-full border font-medium transition-colors ${
                hidden ? 'text-slate-400 border-slate-200' : ''
              }`}
            >
              {a.name}
            </button>
          )
        })}
      </div>

      <div className="h-72">
        {hasData ? (
          <Line data={chartData!} options={options as any} />
        ) : (
          <div className="h-full flex items-center justify-center">
            <p className="text-slate-400 text-sm">No snapshot data for this range — run the period backfill SQL to populate it</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Category history chart ───────────────────────────────────────────────────

function CategoryHistoryChart({
  periods, transactions, categories, currency,
}: {
  periods: Period[]
  transactions: Transaction[]
  categories: Category[]
  currency: string
}) {
  const defaultOlder = Math.min(11, periods.length - 1)
  const [olderIdx, setOlderIdx] = useState(defaultOlder)
  const [newerIdx, setNewerIdx] = useState(0)
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set())

  useEffect(() => { setOlderIdx(Math.min(11, periods.length - 1)) }, [periods.length])

  const fmt = (n: number) => formatCurrency(n, currency)

  const from = Math.max(olderIdx, newerIdx)
  const to   = Math.min(olderIdx, newerIdx)

  // Pre-compute: for each period, which transactions fall in it
  const txsByPeriod = useMemo(() => {
    const m: Record<string, Transaction[]> = {}
    if (!periods.length) return m
    const slice = periods.slice(to, from + 1)
    for (const p of slice) {
      const idx = periods.indexOf(p)
      const bounds = getPeriodBounds(periods, idx)
      m[p.id] = transactions.filter(
        t => t.occurred_on >= bounds.start &&
             t.occurred_on <= bounds.end &&
             t.kind !== 'transfer' &&
             t.category_id != null
      )
    }
    return m
  }, [periods, transactions, from, to])

  // Categories that have any data in this range
  const activeCategories = useMemo(() => {
    const ids = new Set<string>()
    for (const txs of Object.values(txsByPeriod)) {
      for (const t of txs) if (t.category_id) ids.add(t.category_id)
    }
    return categories.filter(c => ids.has(c.id))
  }, [categories, txsByPeriod])

  const chartData = useMemo(() => {
    if (!periods.length) return null
    const slice = periods.slice(to, from + 1).reverse()
    const labels = slice.map(p => {
      const idx = periods.indexOf(p)
      return getPeriodBounds(periods, idx).label
    })

    const visible = activeCategories.filter(c => !hiddenCategories.has(c.id))

    const datasets = visible.map((cat, i) => {
      const color = CHART_COLORS[i % CHART_COLORS.length]
      const data = slice.map(p => {
        const txs = txsByPeriod[p.id] ?? []
        const total = txs
          .filter(t => t.category_id === cat.id)
          .reduce((sum, t) => sum + Math.abs(t.amount), 0)
        return total > 0 ? total : null
      })
      return {
        label: cat.name,
        data,
        borderColor: color,
        backgroundColor: color + '18',
        tension: 0.3,
        spanGaps: true,
        pointRadius: 3,
        fill: false,
      }
    })

    return { labels, datasets }
  }, [periods, activeCategories, txsByPeriod, hiddenCategories, from, to])

  const options = useMemo(() => ({
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (ctx: any) => `${ctx.dataset.label}: ${fmt(ctx.parsed.y)}` } },
    },
    scales: { y: { beginAtZero: true, ticks: { callback: (v: any) => fmt(Number(v)) } } },
  }), [currency])

  const toggle = (id: string) =>
    setHiddenCategories(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  const hasData = chartData && chartData.datasets.some(d => d.data.some((v: any) => v != null))

  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-start justify-between flex-wrap gap-3 mb-3">
        <p className="text-sm font-medium">Spending history by category</p>
        {periods.length > 0 && (
          <PeriodRangeSelector
            periods={periods}
            olderIdx={olderIdx} newerIdx={newerIdx}
            onOlder={setOlderIdx} onNewer={setNewerIdx}
          />
        )}
      </div>

      {/* toggles */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {activeCategories.map((cat, i) => {
          const hidden = hiddenCategories.has(cat.id)
          const color = CHART_COLORS[i % CHART_COLORS.length]
          return (
            <button
              key={cat.id}
              onClick={() => toggle(cat.id)}
              style={!hidden ? { backgroundColor: color + '20', borderColor: color, color } : undefined}
              className={`text-[11px] px-2.5 py-1 rounded-full border font-medium transition-colors ${
                hidden ? 'text-slate-400 border-slate-200' : ''
              }`}
            >
              {cat.name}
            </button>
          )
        })}
      </div>

      <div className="h-72">
        {hasData ? (
          <Line data={chartData!} options={options as any} />
        ) : (
          <div className="h-full flex items-center justify-center">
            <p className="text-slate-400 text-sm">No transaction data for this range</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Account-type history chart ──────────────────────────────────────────────

function AccountTypeHistoryChart({
  periods, periodSnapshots, accounts, currency,
}: {
  periods: Period[]
  periodSnapshots: PeriodAccountSnapshot[]
  accounts: Account[]
  currency: string
}) {
  const defaultOlder = Math.min(11, periods.length - 1)
  const [olderIdx, setOlderIdx] = useState(defaultOlder)
  const [newerIdx, setNewerIdx] = useState(0)
  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set())

  useEffect(() => { setOlderIdx(Math.min(11, periods.length - 1)) }, [periods.length])

  const fmt = (n: number) => formatCurrency(n, currency)

  const from = Math.max(olderIdx, newerIdx)
  const to   = Math.min(olderIdx, newerIdx)

  // All distinct account types that appear in accounts
  const accountTypes = useMemo(() => {
    const seen = new Set<string>()
    for (const a of accounts) seen.add(a.type)
    return Array.from(seen).sort()
  }, [accounts])

  // account_id → account type
  const typeByAccountId = useMemo(() =>
    Object.fromEntries(accounts.map(a => [a.id, a.type])),
  [accounts])

  // snapshot lookup: period_id → account_id → balance
  const snapLookup = useMemo(() => {
    const m: Record<string, Record<string, number>> = {}
    for (const s of periodSnapshots) {
      if (!m[s.period_id]) m[s.period_id] = {}
      m[s.period_id][s.account_id] = s.balance
    }
    return m
  }, [periodSnapshots])

  const chartData = useMemo(() => {
    if (!periods.length) return null
    const slice = periods.slice(to, from + 1).reverse()
    const labels = slice.map(p => {
      const idx = periods.indexOf(p)
      return getPeriodBounds(periods, idx).label
    })

    const visible = accountTypes.filter(t => !hiddenTypes.has(t))

    const datasets = visible.map((type, i) => {
      const color = CHART_COLORS[i % CHART_COLORS.length]
      const data = slice.map(p => {
        const snaps = snapLookup[p.id] ?? {}
        let total: number | null = null
        for (const [accId, balance] of Object.entries(snaps)) {
          if (typeByAccountId[accId] === type) {
            total = (total ?? 0) + balance
          }
        }
        return total
      })
      return {
        label: type.replace('_', ' '),
        data,
        borderColor: color,
        backgroundColor: color + '18',
        tension: 0.3,
        spanGaps: true,
        pointRadius: 3,
        fill: false,
      }
    })

    return { labels, datasets }
  }, [periods, snapLookup, accountTypes, typeByAccountId, hiddenTypes, from, to])

  const options = useMemo(() => ({
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (ctx: any) => `${ctx.dataset.label}: ${fmt(ctx.parsed.y)}` } },
    },
    scales: { y: { ticks: { callback: (v: any) => fmt(Number(v)) } } },
  }), [currency])

  const toggle = (type: string) =>
    setHiddenTypes(prev => { const n = new Set(prev); n.has(type) ? n.delete(type) : n.add(type); return n })

  const hasData = chartData && chartData.datasets.some(d => d.data.some((v: any) => v != null))

  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-start justify-between flex-wrap gap-3 mb-3">
        <p className="text-sm font-medium">Balance history by account type</p>
        {periods.length > 0 && (
          <PeriodRangeSelector
            periods={periods}
            olderIdx={olderIdx} newerIdx={newerIdx}
            onOlder={setOlderIdx} onNewer={setNewerIdx}
          />
        )}
      </div>

      {/* type toggles */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {accountTypes.map((type, i) => {
          const hidden = hiddenTypes.has(type)
          const color = CHART_COLORS[i % CHART_COLORS.length]
          return (
            <button
              key={type}
              onClick={() => toggle(type)}
              style={!hidden ? { backgroundColor: color + '20', borderColor: color, color } : undefined}
              className={`text-[11px] px-2.5 py-1 rounded-full border font-medium capitalize transition-colors ${
                hidden ? 'text-slate-400 border-slate-200' : ''
              }`}
            >
              {type.replace('_', ' ')}
            </button>
          )
        })}
      </div>

      <div className="h-72">
        {hasData ? (
          <Line data={chartData!} options={options as any} />
        ) : (
          <div className="h-full flex items-center justify-center">
            <p className="text-slate-400 text-sm">No snapshot data for this range</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [balances, setBalances] = useState<Record<string, number>>({})
  const [categories, setCategories] = useState<Category[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [periods, setPeriods] = useState<Period[]>([])
  const [periodSnapshots, setPeriodSnapshots] = useState<PeriodAccountSnapshot[]>([])
  const [loading, setLoading] = useState(true)

  const [selectedPeriodIdx, setSelectedPeriodIdx] = useState(0)
  const [showIncomeBreakdown, setShowIncomeBreakdown] = useState(false)

  useEffect(() => {
    Promise.all([
      listAccounts(),
      listAccountBalances(),
      listCategories(),
      listTransactions({ from: monthsAgoStart(15), includeTransfers: false, limit: 5000 }),
      listPeriods(),
      listPeriodAccountSnapshots(),
    ])
      .then(([accs, bals, cats, txs, pers, snaps]) => {
        setAccounts(accs)
        setBalances(bals)
        setCategories(cats)
        setTransactions(txs)
        setPeriods(pers)
        setPeriodSnapshots(snaps)
      })
      .catch(err => alert(err.message))
      .finally(() => setLoading(false))
  }, [])

  const currency = accounts[0]?.currency ?? 'EUR'
  const fmt = (n: number) => formatCurrency(n, currency)

  const categoryById = Object.fromEntries(categories.map(c => [c.id, c]))
  const excludedCatIds = new Set(categories.filter(c => c.exclude_from_totals).map(c => c.id))

  // ── period bounds ──────────────────────────────────────────────────────────
  const currentBounds = getPeriodBounds(periods, selectedPeriodIdx)
  const { start: periodStart, end: periodEnd, label: periodLabel, isCurrent } = currentBounds

  const hasPrev = selectedPeriodIdx < periods.length - 1
  const hasNext = selectedPeriodIdx > 0

  const periodOptions = periods.length === 0
    ? [{ label: getPeriodBounds([], 0).label, index: 0 }]
    : periods.map((_, i) => ({ label: getPeriodBounds(periods, i).label, index: i }))

  // ── income / expense for selected period ──────────────────────────────────
  const periodTxs = transactions.filter(
    t => t.occurred_on >= periodStart && t.occurred_on <= periodEnd,
  )

  let incomeThisPeriod = 0
  let expenseThisPeriod = 0
  const spendByCategory: Record<string, number> = {}
  const incomeByCategory: Record<string, number> = {}
  const incomeByDescription: Record<string, number> = {}

  for (const t of periodTxs) {
    if (t.kind === 'transfer') continue
    if (t.category_id && excludedCatIds.has(t.category_id)) continue

    const cat = t.category_id ? categoryById[t.category_id] : null

    // Income: use category kind when available, otherwise fall back to sign
    if (cat?.kind === 'income') {
      incomeThisPeriod += t.amount
      incomeByCategory[cat.id] = (incomeByCategory[cat.id] ?? 0) + t.amount
    } else if (!cat && t.amount > 0) {
      incomeThisPeriod += t.amount
      incomeByDescription[t.description] = (incomeByDescription[t.description] ?? 0) + t.amount
    }

    // Expenses: always sign-based, category type ignored
    if (t.amount < 0) {
      expenseThisPeriod += Math.abs(t.amount)
      if (t.category_id) {
        spendByCategory[t.category_id] = (spendByCategory[t.category_id] ?? 0) + Math.abs(t.amount)
      }
    }
  }

  // Merge into a flat list sorted by amount desc
  const incomeBreakdown: { label: string; amount: number }[] = [
    ...Object.entries(incomeByCategory).map(([id, amount]) => ({
      label: categoryById[id]?.name ?? 'Uncategorised',
      amount,
    })),
    ...Object.entries(incomeByDescription).map(([label, amount]) => ({ label, amount })),
  ].sort((a, b) => b.amount - a.amount)

  const netThisPeriod = incomeThisPeriod - expenseThisPeriod

  // ── monthly bar chart ──────────────────────────────────────────────────────
  const monthlyTotals: MonthlyTotal[] = []
  for (let i = 5; i >= 0; i--) {
    const { start, end, label } = getMonthBounds(i)
    let income = 0, expense = 0
    for (const t of transactions) {
      if (t.occurred_on < start || t.occurred_on > end) continue
      if (t.kind === 'transfer') continue
      if (t.category_id && excludedCatIds.has(t.category_id)) continue
      const cat = t.category_id ? categoryById[t.category_id] : null
      if (cat?.kind === 'income') income += t.amount
      else if (!cat && t.amount > 0) income += t.amount
      if (t.amount < 0) expense += Math.abs(t.amount)
    }
    monthlyTotals.push({ label, income, expense })
  }

  const doughnutData = {
    labels: Object.keys(spendByCategory).map(id => categoryById[id]?.name ?? id),
    datasets: [{
      data: Object.values(spendByCategory),
      backgroundColor: Object.keys(spendByCategory).map((_, i) => CHART_COLORS[i % CHART_COLORS.length]),
      borderWidth: 1,
    }],
  }

  const doughnutOptions = {
    maintainAspectRatio: false,
    plugins: {
      tooltip: { callbacks: { label: (ctx: any) => `${ctx.label}: ${fmt(Number(ctx.parsed))}` } },
    },
  }

  const barData = {
    labels: monthlyTotals.map(m => m.label),
    datasets: [
      { label: 'Income',  data: monthlyTotals.map(m => m.income),  backgroundColor: '#10b981' },
      { label: 'Expense', data: monthlyTotals.map(m => m.expense), backgroundColor: '#ef4444' },
    ],
  }

  const barOptions = {
    maintainAspectRatio: false,
    plugins: {
      tooltip: { callbacks: { label: (ctx: any) => `${ctx.dataset.label}: ${fmt(Number(ctx.parsed.y))}` } },
    },
    scales: {
      y: { beginAtZero: true, ticks: { callback: (value: any) => fmt(Number(value)) } },
    },
  }

  if (loading) return <p className="text-center text-slate-400 py-16">Loading…</p>

  return (
    <div className="space-y-6">

      {/* ── Period selector ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setSelectedPeriodIdx(i => i + 1)}
          disabled={!hasPrev}
          className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 active:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Previous period"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <select
          value={selectedPeriodIdx}
          onChange={e => setSelectedPeriodIdx(Number(e.target.value))}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 cursor-pointer"
        >
          {periodOptions.map(opt => (
            <option key={opt.index} value={opt.index}>
              {opt.index === 0 ? `Current · ${opt.label}` : opt.label}
            </option>
          ))}
        </select>

        <button
          onClick={() => setSelectedPeriodIdx(i => i - 1)}
          disabled={!hasNext}
          className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 active:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Next period"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {!isCurrent && (
          <span className="text-xs bg-slate-100 text-slate-500 px-2.5 py-1 rounded-full">Closed period</span>
        )}
        {periods.length === 0 && (
          <span className="text-xs text-slate-400 italic">No salary periods yet — using current calendar month</span>
        )}
      </div>

      {/* ── Stats row ────────────────────────────────────────────────────── */}
      {(() => {
        // Reusable small tendency line
        function TendencyLine({ current, prev, invert = false }: { current: number | null; prev: number | null; invert?: boolean }) {
          if (current == null || prev == null) return null
          const abs = current - prev
          const pct = prev !== 0 ? (abs / Math.abs(prev)) * 100 : null
          const good = invert ? abs <= 0 : abs >= 0
          return (
            <p className={`text-[10px] tabular-nums mt-0.5 ${good ? 'text-emerald-500/70' : 'text-red-400/70'}`}>
              {abs >= 0 ? '▲' : '▼'} {fmt(Math.abs(abs))}{pct != null ? ` · ${Math.abs(pct).toFixed(1)}%` : ''}
            </p>
          )
        }

        const prevIdx = selectedPeriodIdx + 1
        const prevPeriod = periods[prevIdx] ?? null

        return (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">

            {/* checking — ActivoBank as primary, others as sub-rows, period-aware */}
            {(() => {
              const checkingAccounts = accounts.filter(a => a.type === 'checking')
              if (!checkingAccounts.length) return null

              const periodId = periods[selectedPeriodIdx]?.id
              const snapForPeriod = periodSnapshots.filter(s => s.period_id === periodId)
              const snapById = Object.fromEntries(snapForPeriod.map(s => [s.account_id, s.balance]))
              // for the current (open) period always use live balances, never stale snapshots
              const hasSnap = !isCurrent && snapForPeriod.length > 0

              const getBalance = (id: string) => hasSnap ? (snapById[id] ?? null) : (balances[id] ?? 0)

              const primary = checkingAccounts.find(a => a.name === 'ActivoBank') ?? checkingAccounts[0]
              const secondary = checkingAccounts.filter(a => a.id !== primary.id)
              const primaryBalance = getBalance(primary.id)

              return (
                <div className="border rounded-lg p-4">
                  <p className="text-xs uppercase text-slate-500">Checking · {periodLabel}</p>
                  {primaryBalance != null
                    ? <p className={`text-2xl font-semibold mt-1 ${primaryBalance > 0 ? 'text-emerald-600' : primaryBalance < 0 ? 'text-red-600' : ''}`}>{fmt(primaryBalance)}</p>
                    : <p className="text-2xl font-semibold mt-1 text-slate-300">—</p>}
                  <p className="text-[10px] text-slate-400 mt-0.5">{primary.name}</p>
                  {secondary.map(a => {
                    const bal = getBalance(a.id)
                    return (
                      <p key={a.id} className="text-xs text-slate-500 mt-1.5">
                        {a.name}
                        {bal != null
                          ? <span className={`ml-1.5 tabular-nums font-medium ${bal > 0 ? 'text-emerald-600' : bal < 0 ? 'text-red-600' : ''}`}>{fmt(bal)}</span>
                          : <span className="ml-1.5 text-slate-300">—</span>}
                      </p>
                    )
                  })}
                </div>
              )
            })()}

            {/* total balance */}
            {(() => {
              const periodBalance = periods[selectedPeriodIdx]?.total_balance ?? null
              const prevBalance   = prevPeriod?.total_balance ?? null
              return (
                <div className="border rounded-lg p-4">
                  <p className="text-xs uppercase text-slate-500">Total balance · {periodLabel}</p>
                  {periodBalance != null
                    ? <p className="text-2xl font-semibold mt-1">{fmt(periodBalance)}</p>
                    : <p className="text-2xl font-semibold mt-1 text-slate-300">—</p>}
                  <TendencyLine current={periodBalance} prev={prevBalance} />
                </div>
              )
            })()}

            {/* income */}
            <div
              className="border rounded-lg p-4 relative cursor-default"
              onMouseEnter={() => setShowIncomeBreakdown(true)}
              onMouseLeave={() => setShowIncomeBreakdown(false)}
            >
              <p className="text-xs uppercase text-slate-500">Income · {periodLabel}</p>
              <p className="text-2xl font-semibold mt-1">{fmt(incomeThisPeriod)}</p>
              <TendencyLine current={incomeThisPeriod} prev={prevPeriod?.incomes ?? null} />

              {showIncomeBreakdown && incomeBreakdown.length > 0 && (
                <div className="absolute left-0 top-full mt-1.5 z-20 w-56 bg-white border rounded-lg shadow-lg py-2 px-3 space-y-1.5">
                  <p className="text-[10px] uppercase text-slate-400 font-medium pb-1">Sources</p>
                  {incomeBreakdown.map(({ label, amount }) => (
                    <div key={label} className="flex items-center justify-between gap-3">
                      <span className="text-xs text-slate-600 truncate">{label}</span>
                      <span className="text-xs tabular-nums font-medium text-emerald-600 shrink-0">{fmt(amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* expenses */}
            <div className="border rounded-lg p-4">
              <p className="text-xs uppercase text-slate-500">Expenses · {periodLabel}</p>
              <p className="text-2xl font-semibold mt-1">{fmt(expenseThisPeriod)}</p>
              <TendencyLine current={expenseThisPeriod} prev={prevPeriod?.expenses ?? null} invert />
            </div>

            {/* net */}
            <div className="border rounded-lg p-4">
              <p className="text-xs uppercase text-slate-500">Net · {periodLabel}</p>
              <p className={`text-2xl font-semibold mt-1 ${netThisPeriod >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {fmt(netThisPeriod)}
              </p>
              {(() => {
                const prevNet = prevPeriod != null && prevPeriod.incomes != null && prevPeriod.expenses != null
                  ? prevPeriod.incomes - prevPeriod.expenses
                  : null
                return <TendencyLine current={netThisPeriod} prev={prevNet} />
              })()}
            </div>

          </div>
        )
      })()}

      {/* ── Accounts + By type ───────────────────────────────────────────── */}
      {(() => {
        // Snapshot balances for the selected period (fall back to live if no snap)
        const curPeriodId  = periods[selectedPeriodIdx]?.id
        const prevPeriodId = periods[selectedPeriodIdx + 1]?.id

        const curSnapById: Record<string, number>  = {}
        const prevSnapById: Record<string, number> = {}
        for (const s of periodSnapshots) {
          if (s.period_id === curPeriodId)  curSnapById[s.account_id]  = s.balance
          if (s.period_id === prevPeriodId) prevSnapById[s.account_id] = s.balance
        }
        // for the current (open) period always use live balances, never stale snapshots
        const hasCurSnap = !isCurrent && Object.keys(curSnapById).length > 0
        const getBalance = (id: string) => hasCurSnap ? (curSnapById[id] ?? null) : (balances[id] ?? 0)

        const HIDE_DELTA_TYPES = new Set(['checking', 'credit_card'])

        function DeltaLine({ current, prev, type }: { current: number | null; prev: number | null; type: string }) {
          if (current == null || prev == null || HIDE_DELTA_TYPES.has(type)) return null
          const abs = current - prev
          const pct = prev !== 0 ? (abs / Math.abs(prev)) * 100 : null
          const up = abs >= 0
          return (
            <span className={`text-[10px] tabular-nums ${up ? 'text-emerald-500/70' : 'text-red-400/70'}`}>
              {up ? '▲' : '▼'} {fmt(Math.abs(abs))}{pct != null ? ` · ${Math.abs(pct).toFixed(1)}%` : ''}
            </span>
          )
        }

        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* individual accounts */}
            {(() => {
              const allBalances = accounts.map(a => getBalance(a.id) ?? 0)
              const maxAbs = Math.max(0, ...allBalances.map(Math.abs))
              return (
                <div className="border rounded-lg p-4">
                  <p className="text-sm font-medium mb-3">Accounts · {periodLabel}</p>
                  {accounts.length === 0 ? (
                    <p className="text-slate-400 text-sm text-center">No accounts yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {accounts.map(a => {
                        const balance = getBalance(a.id)
                        const prevBal = prevSnapById[a.id] ?? null
                        return (
                          <div key={a.id}>
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="font-medium text-sm">{a.name}</p>
                                <p className="text-xs text-slate-500 capitalize">{a.type.replace('_', ' ')}</p>
                              </div>
                              <div className="text-right shrink-0">
                                {balance != null
                                  ? <p className={`tabular-nums text-sm font-medium ${balance > 0 ? 'text-emerald-600' : balance < 0 ? 'text-red-600' : ''}`}>
                                      {new Intl.NumberFormat(undefined, { style: 'currency', currency: a.currency }).format(balance)}
                                    </p>
                                  : <p className="tabular-nums text-sm font-medium text-slate-300">—</p>}
                                <DeltaLine current={balance} prev={prevBal} type={a.type} />
                              </div>
                            </div>
                            <div className="bg-slate-200 rounded h-1 overflow-hidden mt-2">
                              <div
                                className={`h-full rounded transition-all duration-300 ${(balance ?? 0) >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`}
                                style={{ width: maxAbs > 0 ? `${(Math.abs(balance ?? 0) / maxAbs) * 100}%` : '0%' }}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })()}

            {/* by account type */}
            {(() => {
              const typeMap = new Map<string, Account[]>()
              for (const a of accounts) {
                if (!typeMap.has(a.type)) typeMap.set(a.type, [])
                typeMap.get(a.type)!.push(a)
              }
              const typeEntries = Array.from(typeMap.entries()).map(([type, accs]) => {
                const total = accs.reduce((sum, a) => {
                  const b = getBalance(a.id); return sum + (b ?? 0)
                }, 0)
                const hasPrev = accs.some(a => prevSnapById[a.id] != null)
                const prevTotal = hasPrev
                  ? accs.reduce((sum, a) => sum + (prevSnapById[a.id] ?? getBalance(a.id) ?? 0), 0)
                  : null
                return { type, accs, total, prevTotal }
              })
              const maxAbs = Math.max(0, ...typeEntries.map(e => Math.abs(e.total)))

              return (
                <div className="border rounded-lg p-4">
                  <p className="text-sm font-medium mb-3">By account type · {periodLabel}</p>
                  {typeEntries.length === 0 ? (
                    <p className="text-slate-400 text-sm text-center">No accounts yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {typeEntries.map(({ type, accs, total, prevTotal }) => {
                        const balanceColor = total > 0 ? 'text-emerald-600' : total < 0 ? 'text-red-600' : ''
                        const barColor = total >= 0 ? 'bg-emerald-500' : 'bg-red-500'
                        return (
                          <div key={type}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-medium text-sm capitalize">{type.replace('_', ' ')}</p>
                                <p className="text-xs text-slate-400 truncate">
                                  {accs.map(a => a.name).join(', ')}
                                </p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className={`tabular-nums text-sm font-medium ${balanceColor}`}>{fmt(total)}</p>
                                <DeltaLine current={total} prev={prevTotal} type={type} />
                              </div>
                            </div>
                            <div className="bg-slate-200 rounded h-1 overflow-hidden mt-2">
                              <div
                                className={`h-full rounded transition-all duration-300 ${barColor}`}
                                style={{ width: maxAbs > 0 ? `${(Math.abs(total) / maxAbs) * 100}%` : '0%' }}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })()}

          </div>
        )
      })()}

      {/* ── Period chart row (doughnut + bar) ────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="border rounded-lg p-4">
          <p className="text-sm font-medium mb-3">Spending by category · {periodLabel}</p>
          {Object.keys(spendByCategory).length === 0 ? (
            <div className="h-64 flex items-center justify-center">
              <p className="text-slate-400 text-sm">No spending for this period</p>
            </div>
          ) : (
            <div className="h-64"><Doughnut data={doughnutData} options={doughnutOptions} /></div>
          )}
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-sm font-medium mb-3">Income vs expense, last 6 months</p>
          <div className="h-64"><Bar data={barData} options={barOptions} /></div>
        </div>
      </div>

      {/* ── Historical balance by account ────────────────────────────────── */}
      <AccountBalanceHistoryChart
        periods={periods}
        periodSnapshots={periodSnapshots}
        accounts={accounts}
        currency={currency}
      />

      {/* ── Historical balance by account type ───────────────────────────── */}
      <AccountTypeHistoryChart
        periods={periods}
        periodSnapshots={periodSnapshots}
        accounts={accounts}
        currency={currency}
      />

      {/* ── Historical spending by category ──────────────────────────────── */}
      <CategoryHistoryChart
        periods={periods}
        transactions={transactions}
        categories={categories}
        currency={currency}
      />

    </div>
  )
}
