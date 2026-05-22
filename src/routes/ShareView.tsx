import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { format } from 'date-fns'
import { getShareMeta, getShareByToken } from '../data/shares'
import type { ShareMeta, SharePublicData, SharePublicPayment } from '../data/shares'

// ── Helpers ─────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}

function fmtAbs(n: number) { return fmt(Math.abs(n)) }

interface ParticipantStat {
  name: string
  split: number
  paid: number
  remaining: number
}

function calcStats(share: SharePublicData): ParticipantStat[] {
  const n = share.participants.length
  if (n === 0) return []

  const totalExpenses = share.transactions
    .filter(t => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0)

  const splitPerPerson = totalExpenses / n

  return share.participants.map(name => {
    const paid = share.payments.reduce((sum, p) => {
      if (p.payers.includes(name)) return sum + p.amount / p.payers.length
      return sum
    }, 0)
    return { name, split: splitPerPerson, paid, remaining: splitPerPerson - paid }
  })
}

// ── Skeleton ─────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-slate-200 rounded ${className}`} />
}

// ── Password gate ─────────────────────────────────────────────────

function PasswordGate({ title, onUnlock, wrongPassword }: {
  title: string
  onUnlock: (pw: string) => void
  wrongPassword: boolean
}) {
  const [pw, setPw] = useState('')
  const [show, setShow] = useState(false)
  const [pending, setPending] = useState(false)

  // reset spinner when wrong answer comes back
  useEffect(() => { if (wrongPassword) setPending(false) }, [wrongPassword])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!pw) return
    setPending(true)
    onUnlock(pw)
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-100 mb-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
          <p className="text-sm text-slate-500">This share is password-protected.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <input
              type={show ? 'text' : 'password'}
              placeholder="Enter password"
              value={pw}
              onChange={e => { setPw(e.target.value) }}
              autoFocus
              className={`border rounded-lg px-4 py-3 w-full pr-11 text-sm ${wrongPassword ? 'border-red-400 bg-red-50' : ''}`}
            />
            <button type="button" onClick={() => setShow(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" tabIndex={-1}>
              {show
                ? <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                : <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
              }
            </button>
          </div>
          {wrongPassword && <p className="text-sm text-red-500 text-center">Incorrect password. Try again.</p>}
          <button type="submit" disabled={!pw || pending}
            className="w-full bg-slate-900 text-white py-3 rounded-lg hover:bg-slate-800 active:brightness-90 disabled:opacity-40 text-sm font-medium">
            {pending ? 'Checking…' : 'Unlock'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Expandable detail row ─────────────────────────────────────────

function ParticipantDetail({
  name,
  share,
  splitAmount: _splitAmount,
}: {
  name: string
  share: SharePublicData
  splitAmount: number
}) {
  const n = share.participants.length
  const expenses = share.transactions.filter(t => t.amount < 0)
  const myPayments: Array<{ payment: SharePublicPayment; credit: number }> = share.payments
    .filter(p => p.payers.includes(name))
    .map(p => ({ payment: p, credit: p.amount / p.payers.length }))

  return (
    <div className="px-4 pb-4 space-y-3">
      {/* Expense lines */}
      {expenses.length > 0 && (
        <div>
          <p className="text-[11px] uppercase text-slate-400 font-medium mb-1.5">Expenses</p>
          <div className="space-y-1">
            {expenses.map(t => (
              <div key={t.id} className="flex items-center justify-between text-xs">
                <span className="text-slate-600 truncate mr-4">{t.description}
                  <span className="text-slate-400 ml-1.5">{format(new Date(t.occurred_on + 'T00:00:00'), 'MMM d')}</span>
                </span>
                <span className="tabular-nums text-slate-700 shrink-0">{fmt(Math.abs(t.amount) / n)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payment lines */}
      {myPayments.length > 0 && (
        <div>
          <p className="text-[11px] uppercase text-slate-400 font-medium mb-1.5">Payments</p>
          <div className="space-y-1">
            {myPayments.map(({ payment, credit }) => (
              <div key={payment.id} className="flex items-center justify-between text-xs">
                <span className="text-slate-600">
                  {format(new Date(payment.paid_on + 'T00:00:00'), 'MMM d, yyyy')}
                  {payment.payers.length > 1 && (
                    <span className="text-slate-400 ml-1.5">with {payment.payers.filter(p => p !== name).join(', ')}</span>
                  )}
                  {payment.notes && <span className="text-slate-400 ml-1.5 italic">· {payment.notes}</span>}
                </span>
                <span className="tabular-nums text-emerald-600 font-medium shrink-0">+{fmt(credit)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {expenses.length === 0 && myPayments.length === 0 && (
        <p className="text-xs text-slate-400">No activity yet.</p>
      )}
    </div>
  )
}

// ── Main share view ───────────────────────────────────────────────

export default function ShareView() {
  const { token } = useParams<{ token: string }>()

  const [meta, setMeta] = useState<ShareMeta | null>(null)
  const [share, setShare] = useState<SharePublicData | null>(null)
  const [loadingMeta, setLoadingMeta] = useState(true)
  const [loadingShare, setLoadingShare] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [wrongPassword, setWrongPassword] = useState(false)
  const [expandedParticipant, setExpandedParticipant] = useState<string | null>(null)

  const sessionKey = token ? `share-pw-${token}` : null

  useEffect(() => {
    if (!token) { setNotFound(true); setLoadingMeta(false); return }
    getShareMeta(token)
      .then(data => {
        if (!data) { setNotFound(true); return }
        setMeta(data)
        if (!data.requires_password) {
          fetchShare()
        } else {
          const saved = sessionStorage.getItem(`share-pw-${token}`)
          if (saved) fetchShare(saved)
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoadingMeta(false))
  }, [token])

  const fetchShare = async (password?: string) => {
    if (!token) return
    setLoadingShare(true)
    setWrongPassword(false)
    try {
      const data = await getShareByToken(token, password)
      if (!data) {
        // Saved password is no longer valid — clear it so the gate re-appears
        if (sessionKey) sessionStorage.removeItem(sessionKey)
        setWrongPassword(true)
      } else {
        if (password && sessionKey) sessionStorage.setItem(sessionKey, password)
        setShare(data)
      }
    } catch { setNotFound(true) }
    finally { setLoadingShare(false) }
  }

  if (!loadingMeta && notFound) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-center px-4">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-xl font-semibold text-slate-700">Share not found</p>
        <p className="text-slate-400 text-sm">This link may have expired or been removed.</p>
      </div>
    )
  }

  if (loadingMeta) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400 text-sm">Loading…</div>
  }

  if (meta?.requires_password && !share) {
    return <PasswordGate title={meta.title} onUnlock={pw => fetchShare(pw)} wrongPassword={wrongPassword} />
  }

  if (loadingShare || (!share && !wrongPassword)) {
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="bg-white border-b px-4 py-4"><Skeleton className="h-5 w-48" /></header>
        <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-56 w-full" />
        </main>
      </div>
    )
  }

  // ── Derived data ──
  const stats = calcStats(share!)
  const totalExpenses = share!.transactions
    .filter(t => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0)
  const n = share!.participants.length

  return (
    <div className="min-h-screen bg-slate-50">
      {/* header */}
      <header className="bg-white border-b px-4 py-4 flex items-center gap-3">
        <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <div>
          <p className="font-semibold text-slate-900 leading-tight">{share!.title}</p>
          <p className="text-xs text-slate-400">Shared expenses</p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">

        {/* extra info */}
        {share!.extra_info && (
          <div className="bg-white rounded-xl border px-5 py-4">
            <p className="text-xs uppercase text-slate-400 font-medium mb-1">Info</p>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{share!.extra_info}</p>
          </div>
        )}

        {/* totals strip */}
        <div className={`bg-white rounded-xl border px-5 py-4 grid gap-4 ${n > 0 ? 'grid-cols-2' : 'grid-cols-1'}`}>
          <div>
            <p className="text-xs uppercase text-slate-400 font-medium mb-1">Total expenses</p>
            <p className="text-2xl font-bold text-slate-900 tabular-nums">{fmtAbs(totalExpenses)}</p>
          </div>
          {n > 0 && (
            <div className="text-right">
              <p className="text-xs uppercase text-slate-400 font-medium mb-1">Per person</p>
              <p className="text-2xl font-bold text-slate-900 tabular-nums">{fmt(totalExpenses / n)}</p>
              <p className="text-xs text-slate-400 mt-0.5">÷ {n} {n === 1 ? 'person' : 'people'}</p>
            </div>
          )}
        </div>

        {/* per-participant split / paid / remaining */}
        {stats.length > 0 && (
          <div>
            <p className="text-xs uppercase text-slate-400 font-medium mb-3">Split</p>
            <div className="bg-white rounded-xl border overflow-hidden divide-y">

              {/* column headers */}
              <div className="grid grid-cols-[1fr_repeat(3,72px)_28px] gap-2 px-4 py-2 bg-slate-50">
                <span className="text-[11px] uppercase text-slate-400 font-medium">Person</span>
                <span className="text-[11px] uppercase text-slate-400 font-medium text-right">Split</span>
                <span className="text-[11px] uppercase text-slate-400 font-medium text-right">Paid</span>
                <span className="text-[11px] uppercase text-slate-400 font-medium text-right">Remaining</span>
                <span />
              </div>

              {stats.map(({ name, split, paid, remaining }) => {
                const settled = Math.abs(remaining) <= 0.005
                const credit = remaining < -0.005
                const expanded = expandedParticipant === name
                return (
                  <div key={name}>
                    {/* summary row — always visible */}
                    <button
                      type="button"
                      onClick={() => setExpandedParticipant(expanded ? null : name)}
                      className="w-full grid grid-cols-[1fr_repeat(3,72px)_28px] gap-2 items-center px-4 py-3.5 hover:bg-slate-50 active:bg-slate-100 text-left"
                    >
                      <span className="font-medium text-slate-900 text-sm truncate">{name}</span>
                      <span className="text-sm tabular-nums text-slate-700 text-right">{fmt(split)}</span>
                      <span className={`text-sm tabular-nums text-right font-medium ${paid > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {paid > 0 ? fmt(paid) : '—'}
                      </span>
                      <span className={`text-sm tabular-nums text-right font-semibold ${settled ? 'text-emerald-500' : credit ? 'text-blue-500' : 'text-rose-600'}`}>
                        {settled ? '✓' : credit ? `+${fmt(Math.abs(remaining))}` : fmt(remaining)}
                      </span>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className={`w-3.5 h-3.5 text-slate-400 transition-transform ml-auto ${expanded ? 'rotate-180' : ''}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* expandable detail */}
                    {expanded && (
                      <div className="border-t border-slate-100 bg-slate-50">
                        <ParticipantDetail name={name} share={share!} splitAmount={split} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* transactions list */}
        <div>
          <p className="text-xs uppercase text-slate-400 font-medium mb-3">
            Transactions ({share!.transactions.length})
          </p>
          {share!.transactions.length === 0 ? (
            <div className="bg-white rounded-xl border px-5 py-10 text-center text-slate-400 text-sm">
              No transactions linked to this share yet.
            </div>
          ) : (
            <div className="bg-white rounded-xl border divide-y">
              {share!.transactions.map(t => {
                const txPerPerson = n > 0 && t.amount < 0 ? Math.abs(t.amount) / n : null
                return (
                  <div key={t.id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900 text-sm">{t.description}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {format(new Date(t.occurred_on + 'T00:00:00'), 'MMM d, yyyy')}
                        </p>
                        {t.notes && <p className="text-xs text-slate-500 mt-1 italic">{t.notes}</p>}
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`font-semibold tabular-nums text-sm ${t.amount >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {t.amount >= 0 ? '+' : '−'}{fmtAbs(t.amount)}
                        </p>
                        {txPerPerson !== null && (
                          <p className="text-xs text-slate-400 tabular-nums mt-0.5">
                            {fmt(txPerPerson)} / person
                          </p>
                        )}
                      </div>
                    </div>
                    {txPerPerson !== null && n > 0 && (
                      <div className="mt-2 pt-2 border-t border-slate-100 flex flex-wrap gap-x-4 gap-y-1">
                        {share!.participants.map(name => (
                          <span key={name} className="text-xs text-slate-500 tabular-nums">
                            <span className="text-slate-400">{name}</span>{' '}{fmt(txPerPerson)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <p className="text-center text-xs text-slate-300 pb-4">Generated with Finance App</p>
      </main>
    </div>
  )
}
