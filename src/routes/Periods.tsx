import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import {
  listPeriods, createPeriod, updatePeriod, deletePeriod,
  getPeriodBounds, listPeriodAccountSnapshots, recalculatePeriodStats,
} from '../data'
import type { Period, PeriodAccountSnapshot } from '../data'
import MobileSheet from '../components/MobileSheet'

const today = () => new Date().toISOString().slice(0, 10)

function fmtDate(iso: string) {
  return format(new Date(iso + 'T00:00:00'), 'MMM d, yyyy')
}

function fmtEur(amount: number) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR' }).format(amount)
}

function fmtCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount)
}

// ─── delta helpers ────────────────────────────────────────────────────────────

interface DeltaValue { abs: number; pct: number | null }

function calcDelta(current: number | null, previous: number | null): DeltaValue | null {
  if (current == null || previous == null) return null
  const abs = current - previous
  const pct = previous !== 0 ? (abs / Math.abs(previous)) * 100 : null
  return { abs, pct }
}

/**
 * invert=true  → higher is worse (expenses: going up = red)
 * invert=false → higher is better (income, balance: going up = green)
 */
function DeltaTag({ delta, invert = false }: { delta: DeltaValue | null; invert?: boolean }) {
  if (!delta) return null
  const good = invert ? delta.abs <= 0 : delta.abs >= 0
  const arrow = delta.abs >= 0 ? '▲' : '▼'
  return (
    <span className={`block text-[11px] mt-0.5 tabular-nums ${good ? 'text-emerald-600' : 'text-red-500'}`}>
      {arrow} {fmtEur(Math.abs(delta.abs))}
      {delta.pct != null ? ` · ${Math.abs(delta.pct).toFixed(1)}%` : ''}
    </span>
  )
}

// ─── account balance sub-row ──────────────────────────────────────────────────

function AccountBalances({ snaps }: { snaps: PeriodAccountSnapshot[] }) {
  if (!snaps.length) {
    return (
      <p className="text-xs text-slate-400 italic py-1">No account snapshots recorded for this period.</p>
    )
  }
  return (
    <ul className="space-y-1">
      {snaps.map(s => (
        <li key={s.account_id} className="flex justify-between text-sm text-slate-600">
          <span>{s.accounts?.name ?? s.account_id}</span>
          <span className="tabular-nums font-medium">
            {fmtCurrency(s.balance, s.accounts?.currency ?? 'EUR')}
          </span>
        </li>
      ))}
    </ul>
  )
}

// ─── main component ───────────────────────────────────────────────────────────

export default function Periods() {
  const [periods, setPeriods] = useState<Period[]>([])
  const [snapshots, setSnapshots] = useState<PeriodAccountSnapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // recalculate
  const [recalcId, setRecalcId] = useState<string | null>(null)

  const handleRecalculate = async (e: React.MouseEvent, periodId: string) => {
    e.stopPropagation()
    setRecalcId(periodId)
    try {
      await recalculatePeriodStats(periodId, periods)
      await load()
    } catch (err: any) {
      alert(`Recalculation failed: ${err.message}`)
    } finally {
      setRecalcId(null)
    }
  }

  // edit / new sheet
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [startedOn, setStartedOn] = useState(today())
  const [label, setLabel] = useState('')
  const [pending, setPending] = useState(false)

  const load = async () => {
    try {
      const [ps, snaps] = await Promise.all([listPeriods(), listPeriodAccountSnapshots()])
      setPeriods(ps)
      setSnapshots(snaps)
    } catch (err: any) {
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // group snapshots by period_id
  const snapshotsByPeriod = snapshots.reduce<Record<string, PeriodAccountSnapshot[]>>((acc, s) => {
    if (!acc[s.period_id]) acc[s.period_id] = []
    acc[s.period_id].push(s)
    return acc
  }, {})

  const openNew = () => {
    setEditingId(null)
    setStartedOn(today())
    setLabel('')
    setSheetOpen(true)
  }

  const openEdit = (p: Period) => {
    setEditingId(p.id)
    setStartedOn(p.started_on)
    setLabel(p.label ?? '')
    setSheetOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setPending(true)
    try {
      if (editingId) {
        await updatePeriod(editingId, { started_on: startedOn, label: label.trim() || null })
      } else {
        await createPeriod(startedOn, label.trim() || undefined)
      }
      setSheetOpen(false)
      setLoading(true)
      await load()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setPending(false)
    }
  }

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (!window.confirm('Delete this period?')) return
    try {
      await deletePeriod(id)
      await load()
    } catch (err: any) {
      alert(err.message)
    }
  }

  const toggleExpand = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setExpandedId(prev => (prev === id ? null : id))
  }

  const sheetTitle = editingId ? 'Edit period' : 'New period'

  return (
    <div className="space-y-4">

      {/* header */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Periods</h1>
        <button
          onClick={openNew}
          className="bg-slate-900 text-white px-4 py-3 rounded hover:bg-slate-800 active:brightness-90 text-sm"
        >
          New period
        </button>
      </div>

      <p className="text-sm text-slate-500">
        Each period starts when you receive your salary. The dashboard shows stats grouped by period.
      </p>

      {/* list */}
      {loading ? (
        <p className="text-center text-slate-400 py-16">Loading…</p>
      ) : periods.length === 0 ? (
        <p className="text-center text-slate-400 py-16">
          No periods yet. Add one above or use the "New period" button on the Transactions page.
        </p>
      ) : (
        <>
          {/* ── desktop table ── */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-xs uppercase text-slate-500 pb-2 font-medium pr-4">Label</th>
                  <th className="text-xs uppercase text-slate-500 pb-2 font-medium pr-4">Dates</th>
                  <th className="text-xs uppercase text-slate-500 pb-2 font-medium pr-4">Income</th>
                  <th className="text-xs uppercase text-slate-500 pb-2 font-medium pr-4">Expenses</th>
                  <th className="text-xs uppercase text-slate-500 pb-2 font-medium pr-4">Savings</th>
                  <th className="text-xs uppercase text-slate-500 pb-2 font-medium pr-4">Balance</th>
                  <th className="text-xs uppercase text-slate-500 pb-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {periods.map((p, i) => {
                  const bounds = getPeriodBounds(periods, i)
                  const prev = periods[i + 1] // next in array = older period
                  const accountSnaps = snapshotsByPeriod[p.id] ?? []
                  const isExpanded = expandedId === p.id
                  const hasSnapshot = p.total_balance != null

                  return (
                    <>
                      <tr
                        key={p.id}
                        onClick={() => openEdit(p)}
                        className="border-b last:border-0 hover:bg-slate-50 cursor-pointer"
                      >
                        {/* label */}
                        <td className="py-3 pr-4 font-medium align-top">
                          {p.label ?? <span className="text-slate-400 italic">—</span>}
                          {bounds.isCurrent && (
                            <span className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                              Current
                            </span>
                          )}
                        </td>

                        {/* dates */}
                        <td className="py-3 pr-4 text-slate-600 align-top whitespace-nowrap">
                          <span>{fmtDate(bounds.start)}</span>
                          <span className="block text-[11px] text-slate-400 mt-0.5">
                            {bounds.isCurrent ? 'ongoing' : `→ ${fmtDate(bounds.end)}`}
                          </span>
                        </td>

                        {/* income */}
                        <td className="py-3 pr-4 align-top tabular-nums">
                          {hasSnapshot
                            ? <>
                                <span className="text-slate-800">{fmtEur(p.incomes!)}</span>
                                <DeltaTag delta={calcDelta(p.incomes, prev?.incomes ?? null)} />
                              </>
                            : <span className="text-slate-300">—</span>
                          }
                        </td>

                        {/* expenses */}
                        <td className="py-3 pr-4 align-top tabular-nums">
                          {hasSnapshot
                            ? <>
                                <span className="text-slate-800">{fmtEur(p.expenses!)}</span>
                                <DeltaTag delta={calcDelta(p.expenses, prev?.expenses ?? null)} invert />
                              </>
                            : <span className="text-slate-300">—</span>
                          }
                        </td>

                        {/* savings */}
                        <td className="py-3 pr-4 align-top tabular-nums">
                          {hasSnapshot
                            ? <>
                                <span className="text-slate-800">{fmtEur(p.savings!)}</span>
                                <DeltaTag delta={calcDelta(p.savings, prev?.savings ?? null)} />
                              </>
                            : <span className="text-slate-300">—</span>
                          }
                        </td>

                        {/* balance */}
                        <td className="py-3 pr-4 align-top tabular-nums">
                          {hasSnapshot
                            ? <>
                                <span className="font-semibold text-slate-900">{fmtEur(p.total_balance!)}</span>
                                <DeltaTag delta={calcDelta(p.total_balance, prev?.total_balance ?? null)} />
                              </>
                            : <span className="text-slate-300">—</span>
                          }
                        </td>

                        {/* actions */}
                        <td className="py-3 align-top text-right whitespace-nowrap">
                          <button
                            onClick={e => toggleExpand(e, p.id)}
                            title="Account balances"
                            className={`inline-flex items-center justify-center p-2 rounded-lg text-slate-400 hover:text-slate-700 active:bg-slate-100 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          {!bounds.isCurrent && (
                            <button
                              onClick={e => handleRecalculate(e, p.id)}
                              disabled={recalcId === p.id}
                              title="Recalculate stats"
                              className="inline-flex items-center justify-center p-2 rounded-lg text-slate-400 hover:text-sky-600 active:bg-slate-100 disabled:opacity-40"
                              aria-label="Recalculate stats"
                            >
                              {recalcId === p.id ? (
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                              ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                              )}
                            </button>
                          )}
                          <button
                            onClick={e => handleDelete(e, p.id)}
                            className="inline-flex items-center justify-center p-2 rounded-lg text-slate-400 hover:text-red-600 active:bg-slate-100"
                            aria-label="Delete period"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6m2 0a1 1 0 00-1-1h-4a1 1 0 00-1 1H5" />
                            </svg>
                          </button>
                        </td>
                      </tr>

                      {/* account balances sub-row */}
                      {isExpanded && (
                        <tr key={`${p.id}-accounts`} className="bg-slate-50">
                          <td colSpan={7} className="px-4 pb-4 pt-2">
                            <p className="text-xs font-medium text-slate-400 uppercase mb-2">Account balances at end of period</p>
                            <AccountBalances snaps={accountSnaps} />
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* ── mobile card list ── */}
          <ul className="md:hidden divide-y divide-slate-100">
            {periods.map((p, i) => {
              const bounds = getPeriodBounds(periods, i)
              const prev = periods[i + 1]
              const accountSnaps = snapshotsByPeriod[p.id] ?? []
              const isExpanded = expandedId === p.id
              const hasSnapshot = p.total_balance != null

              return (
                <li key={p.id} className="bg-white">
                  {/* main row */}
                  <div
                    onClick={() => openEdit(p)}
                    className="flex items-start justify-between p-4 active:bg-slate-50 cursor-pointer"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-slate-900">
                          {p.label ?? fmtDate(bounds.start)}
                        </p>
                        {bounds.isCurrent && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                            Current
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-500 mt-0.5">
                        {fmtDate(bounds.start)} – {bounds.isCurrent ? 'today' : fmtDate(bounds.end)}
                      </p>

                      {/* stats grid */}
                      {hasSnapshot && (
                        <div className="grid grid-cols-2 gap-x-6 gap-y-2 mt-3">
                          <div>
                            <p className="text-[10px] uppercase text-slate-400 font-medium">Income</p>
                            <p className="text-sm tabular-nums">{fmtEur(p.incomes!)}</p>
                            <DeltaTag delta={calcDelta(p.incomes, prev?.incomes ?? null)} />
                          </div>
                          <div>
                            <p className="text-[10px] uppercase text-slate-400 font-medium">Expenses</p>
                            <p className="text-sm tabular-nums">{fmtEur(p.expenses!)}</p>
                            <DeltaTag delta={calcDelta(p.expenses, prev?.expenses ?? null)} invert />
                          </div>
                          <div>
                            <p className="text-[10px] uppercase text-slate-400 font-medium">Savings</p>
                            <p className="text-sm tabular-nums">{fmtEur(p.savings!)}</p>
                            <DeltaTag delta={calcDelta(p.savings, prev?.savings ?? null)} />
                          </div>
                          <div>
                            <p className="text-[10px] uppercase text-slate-400 font-medium">Balance</p>
                            <p className="text-sm font-semibold tabular-nums">{fmtEur(p.total_balance!)}</p>
                            <DeltaTag delta={calcDelta(p.total_balance, prev?.total_balance ?? null)} />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="ml-3 flex flex-col items-center gap-1 shrink-0">
                      <button
                        onClick={e => toggleExpand(e, p.id)}
                        className={`p-2 rounded-lg text-slate-400 hover:text-slate-700 active:bg-slate-100 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        aria-label="Toggle account balances"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {!bounds.isCurrent && (
                        <button
                          onClick={e => handleRecalculate(e, p.id)}
                          disabled={recalcId === p.id}
                          className="p-2 rounded-lg text-slate-400 hover:text-sky-600 active:bg-slate-100 disabled:opacity-40"
                          aria-label="Recalculate stats"
                          title="Recalculate stats"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className={`w-4 h-4 ${recalcId === p.id ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        </button>
                      )}
                      <button
                        onClick={e => handleDelete(e, p.id)}
                        className="p-2 rounded-lg text-slate-400 hover:text-red-600 active:bg-slate-100"
                        aria-label="Delete period"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6m2 0a1 1 0 00-1-1h-4a1 1 0 00-1 1H5" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* account balances sub-section */}
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-slate-100">
                      <p className="text-[10px] uppercase text-slate-400 font-medium mt-3 mb-2">Account balances at end of period</p>
                      <AccountBalances snaps={accountSnaps} />
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}

      {/* edit / new sheet */}
      <MobileSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title={sheetTitle}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="period-start">Start date</label>
            <input
              id="period-start"
              type="date"
              required
              value={startedOn}
              onChange={e => setStartedOn(e.target.value)}
              className="border rounded px-3 py-2 w-full"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="period-label">
              Label <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <input
              id="period-label"
              type="text"
              placeholder="e.g. May 2026"
              value={label}
              onChange={e => setLabel(e.target.value)}
              className="border rounded px-3 py-2 w-full"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={pending}
              className="bg-slate-900 text-white px-4 py-3 rounded hover:bg-slate-800 active:brightness-90 disabled:opacity-50 flex-1"
            >
              {pending ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => setSheetOpen(false)}
              className="border px-4 py-3 rounded hover:bg-slate-50 active:bg-slate-100 flex-1"
            >
              Cancel
            </button>
          </div>
        </form>
      </MobileSheet>
    </div>
  )
}
