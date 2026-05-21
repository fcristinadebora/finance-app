import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { Chart, ArcElement, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend } from 'chart.js'
import { Doughnut, Bar } from 'react-chartjs-2'
import { listAccounts, listAccountBalances, listCategories, listTransactions, listPeriods, getPeriodBounds } from '../data'
import type { Account, Category, Transaction, Period } from '../data'

Chart.register(ArcElement, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend)

function firstOfMonthISO(date = new Date()) {
  const d = new Date(date)
  d.setDate(1)
  return d.toISOString().slice(0, 10)
}

function lastOfMonthISO(date = new Date()) {
  const d = new Date(date)
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10)
}

function monthsAgoStart(n: number) {
  const d = new Date()
  d.setMonth(d.getMonth() - n)
  d.setDate(1)
  return d.toISOString().slice(0, 10)
}

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount)
}

const CHART_COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']

interface MonthlyTotal {
  label: string
  income: number
  expense: number
}

function getMonthBounds(monthsAgo: number) {
  const d = new Date()
  d.setMonth(d.getMonth() - monthsAgo)
  return {
    start: firstOfMonthISO(d),
    end: lastOfMonthISO(d),
    label: format(d, 'MMM'),
  }
}

export default function Dashboard() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [balances, setBalances] = useState<Record<string, number>>({})
  const [categories, setCategories] = useState<Category[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [periods, setPeriods] = useState<Period[]>([])
  const [loading, setLoading] = useState(true)

  // Which period index is selected (0 = current / most-recent)
  const [selectedPeriodIdx, setSelectedPeriodIdx] = useState(0)

  useEffect(() => {
    Promise.all([
      listAccounts(),
      listAccountBalances(),
      listCategories(),
      listTransactions({ from: monthsAgoStart(5), includeTransfers: true }),
      listPeriods(),
    ])
      .then(([accs, bals, cats, txs, pers]) => {
        setAccounts(accs)
        setBalances(bals)
        setCategories(cats)
        setTransactions(txs)
        setPeriods(pers)
      })
      .catch(err => alert(err.message))
      .finally(() => setLoading(false))
  }, [])

  const currency = accounts[0]?.currency ?? 'USD'
  const fmt = (n: number) => formatCurrency(n, currency)

  const categoryById = Object.fromEntries(categories.map(c => [c.id, c]))

  // ── total balance ─────────────────────────────────────────────────────────
  const totalBalance = Object.values(balances).reduce((s, n) => s + n, 0)

  // ── period bounds ─────────────────────────────────────────────────────────
  const currentBounds = getPeriodBounds(periods, selectedPeriodIdx)
  const { start: periodStart, end: periodEnd, label: periodLabel, isCurrent } = currentBounds

  const hasPrev = selectedPeriodIdx < periods.length - 1
  const hasNext = selectedPeriodIdx > 0

  // ── period selector options ───────────────────────────────────────────────
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

  for (const t of periodTxs) {
    if (t.kind === 'transfer') continue
    if (t.amount > 0) {
      incomeThisPeriod += t.amount
    } else {
      expenseThisPeriod += Math.abs(t.amount)
      if (t.category_id) {
        spendByCategory[t.category_id] = (spendByCategory[t.category_id] ?? 0) + Math.abs(t.amount)
      }
    }
  }

  const netThisPeriod = incomeThisPeriod - expenseThisPeriod

  // ── charts (still calendar-month based for history) ───────────────────────
  const monthlyTotals: MonthlyTotal[] = []
  for (let i = 5; i >= 0; i--) {
    const { start, end, label } = getMonthBounds(i)
    let income = 0, expense = 0
    for (const t of transactions) {
      if (t.occurred_on < start || t.occurred_on > end) continue
      if (t.kind === 'transfer') continue
      if (t.amount > 0) income += t.amount
      else expense += Math.abs(t.amount)
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
      tooltip: {
        callbacks: {
          label: (ctx: any) => `${ctx.label}: ${fmt(Number(ctx.parsed))}`,
        },
      },
    },
  }

  const barData = {
    labels: monthlyTotals.map(m => m.label),
    datasets: [
      {
        label: 'Income',
        data: monthlyTotals.map(m => m.income),
        backgroundColor: '#10b981',
      },
      {
        label: 'Expense',
        data: monthlyTotals.map(m => m.expense),
        backgroundColor: '#ef4444',
      },
    ],
  }

  const barOptions = {
    maintainAspectRatio: false,
    plugins: {
      tooltip: {
        callbacks: {
          label: (ctx: any) => `${ctx.dataset.label}: ${fmt(Number(ctx.parsed.y))}`,
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value: any) => fmt(Number(value)),
        },
      },
    },
  }

  if (loading) {
    return <p className="text-center text-slate-400 py-16">Loading…</p>
  }

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
          <span className="text-xs bg-slate-100 text-slate-500 px-2.5 py-1 rounded-full">
            Closed period
          </span>
        )}

        {periods.length === 0 && (
          <span className="text-xs text-slate-400 italic">
            No salary periods yet — using current calendar month
          </span>
        )}
      </div>

      {/* ── Stats row ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="border rounded-lg p-4">
          <p className="text-xs uppercase text-slate-500">Total balance</p>
          <p className="text-2xl font-semibold mt-1">{fmt(totalBalance)}</p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-xs uppercase text-slate-500">Income · {periodLabel}</p>
          <p className="text-2xl font-semibold mt-1">{fmt(incomeThisPeriod)}</p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-xs uppercase text-slate-500">Expenses · {periodLabel}</p>
          <p className="text-2xl font-semibold mt-1">{fmt(expenseThisPeriod)}</p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-xs uppercase text-slate-500">Net · {periodLabel}</p>
          <p className={`text-2xl font-semibold mt-1 ${netThisPeriod >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {fmt(netThisPeriod)}
          </p>
        </div>
      </div>

      {/* ── Accounts ─────────────────────────────────────────────────────── */}
      {(() => {
        const maxAbsBalance = Math.max(0, ...accounts.map(a => Math.abs(balances[a.id] ?? 0)))
        return (
          <div className="border rounded-lg p-4">
            <p className="text-sm font-medium mb-3">Accounts</p>
            {accounts.length === 0 ? (
              <p className="text-slate-400 text-sm text-center">No accounts yet.</p>
            ) : (
              <div className="space-y-3">
                {accounts.map(a => {
                  const balance = balances[a.id] ?? 0
                  return (
                    <div key={a.id}>
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-sm">{a.name}</p>
                          <p className="text-xs text-slate-500 capitalize">{a.type.replace('_', ' ')}</p>
                        </div>
                        <p className={`tabular-nums text-sm font-medium ${balance > 0 ? 'text-emerald-600' : balance < 0 ? 'text-red-600' : ''}`}>
                          {new Intl.NumberFormat(undefined, { style: 'currency', currency: a.currency }).format(balance)}
                        </p>
                      </div>
                      <div className="bg-slate-200 rounded h-1 overflow-hidden mt-2">
                        <div
                          className={`h-full rounded transition-all duration-300 ${balance >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`}
                          style={{ width: maxAbsBalance > 0 ? `${(Math.abs(balance) / maxAbsBalance) * 100}%` : '0%' }}
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

      {/* ── Chart row ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="border rounded-lg p-4">
          <p className="text-sm font-medium mb-3">Spending by category · {periodLabel}</p>
          {Object.keys(spendByCategory).length === 0 ? (
            <div className="h-64 flex items-center justify-center">
              <p className="text-slate-400 text-sm">No spending for this period</p>
            </div>
          ) : (
            <div className="h-64">
              <Doughnut data={doughnutData} options={doughnutOptions} />
            </div>
          )}
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-sm font-medium mb-3">Income vs expense, last 6 months</p>
          <div className="h-64">
            <Bar data={barData} options={barOptions} />
          </div>
        </div>
      </div>
    </div>
  )
}
