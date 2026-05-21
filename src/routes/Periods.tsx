import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { listPeriods, createPeriod, updatePeriod, deletePeriod, getPeriodBounds } from '../data'
import type { Period } from '../data'
import MobileSheet from '../components/MobileSheet'

const today = () => new Date().toISOString().slice(0, 10)

function fmtDate(iso: string) {
  return format(new Date(iso + 'T00:00:00'), 'MMM d, yyyy')
}

export default function Periods() {
  const [periods, setPeriods] = useState<Period[]>([])
  const [loading, setLoading] = useState(true)

  // edit / new sheet
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [startedOn, setStartedOn] = useState(today())
  const [label, setLabel] = useState('')
  const [pending, setPending] = useState(false)

  const load = async () => {
    try {
      setPeriods(await listPeriods())
    } catch (err: any) {
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

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
        await updatePeriod(editingId, {
          started_on: startedOn,
          label: label.trim() || null,
        })
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
          {/* desktop table */}
          <table className="hidden md:table w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-xs uppercase text-slate-500 pb-2 font-medium">Label</th>
                <th className="text-xs uppercase text-slate-500 pb-2 font-medium">Start</th>
                <th className="text-xs uppercase text-slate-500 pb-2 font-medium">End</th>
                <th className="text-xs uppercase text-slate-500 pb-2 font-medium">Duration</th>
                <th className="text-xs uppercase text-slate-500 pb-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {periods.map((p, i) => {
                const bounds = getPeriodBounds(periods, i)
                const startDate = new Date(bounds.start + 'T00:00:00')
                const endDate = new Date(bounds.end + 'T00:00:00')
                const days = Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1
                return (
                  <tr
                    key={p.id}
                    onClick={() => openEdit(p)}
                    className="border-b last:border-0 hover:bg-slate-50 cursor-pointer"
                  >
                    <td className="py-3 font-medium">
                      {p.label ?? <span className="text-slate-400 italic">—</span>}
                      {bounds.isCurrent && (
                        <span className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                          Current
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-slate-600">{fmtDate(bounds.start)}</td>
                    <td className="py-3 text-slate-600">
                      {bounds.isCurrent
                        ? <span className="text-slate-400">today</span>
                        : fmtDate(bounds.end)}
                    </td>
                    <td className="py-3 text-slate-500">{days}d</td>
                    <td className="py-3 text-right">
                      <button
                        onClick={e => handleDelete(e, p.id)}
                        className="inline-flex items-center justify-center p-3 rounded-lg text-slate-400 hover:text-red-600 active:bg-slate-100"
                        aria-label="Delete period"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6m2 0a1 1 0 00-1-1h-4a1 1 0 00-1 1H5" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* mobile card list */}
          <ul className="md:hidden divide-y divide-slate-100">
            {periods.map((p, i) => {
              const bounds = getPeriodBounds(periods, i)
              const startDate = new Date(bounds.start + 'T00:00:00')
              const endDate = new Date(bounds.end + 'T00:00:00')
              const days = Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1
              return (
                <li
                  key={p.id}
                  onClick={() => openEdit(p)}
                  className="flex items-center justify-between p-4 bg-white active:bg-slate-50 cursor-pointer"
                >
                  <div className="min-w-0">
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
                      {fmtDate(bounds.start)} –{' '}
                      {bounds.isCurrent ? 'today' : fmtDate(bounds.end)}
                      {' · '}{days}d
                    </p>
                  </div>
                  <button
                    onClick={e => handleDelete(e, p.id)}
                    className="ml-4 shrink-0 p-3 rounded-lg text-slate-400 hover:text-red-600 active:bg-slate-100"
                    aria-label="Delete period"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6m2 0a1 1 0 00-1-1h-4a1 1 0 00-1 1H5" />
                    </svg>
                  </button>
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
