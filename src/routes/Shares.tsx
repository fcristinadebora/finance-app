import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { listShares, createShare, updateShare, deleteShare } from '../data/shares'
import type { Share } from '../data/shares'
import { listSharePayments, createSharePayment, deleteSharePayment } from '../data/sharePayments'
import type { SharePayment } from '../data/sharePayments'
import MobileSheet from '../components/MobileSheet'

function getShareUrl(token: string): string {
  return `${window.location.origin}/#/share/${token}`
}

function ParticipantInput({
  participants,
  onChange,
}: {
  participants: string[]
  onChange: (p: string[]) => void
}) {
  const [input, setInput] = useState('')

  const add = () => {
    const trimmed = input.trim()
    if (trimmed && !participants.includes(trimmed)) {
      onChange([...participants, trimmed])
    }
    setInput('')
  }

  const remove = (name: string) => {
    onChange(participants.filter(p => p !== name))
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Add a name…"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          className="border rounded px-3 py-2 flex-1 text-sm"
        />
        <button
          type="button"
          onClick={add}
          disabled={!input.trim()}
          className="border rounded px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 active:bg-slate-100 disabled:opacity-40"
        >
          Add
        </button>
      </div>
      {participants.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {participants.map(name => (
            <span
              key={name}
              className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-700 text-sm rounded-full px-3 py-1"
            >
              {name}
              <button
                type="button"
                onClick={() => remove(name)}
                className="text-slate-400 hover:text-red-500"
                aria-label={`Remove ${name}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Shares() {
  const [shares, setShares] = useState<Share[]>([])
  const [loading, setLoading] = useState(true)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // dialog
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [extraInfo, setExtraInfo] = useState('')
  const [participants, setParticipants] = useState<string[]>([])
  const [password, setPassword] = useState('')
  const [removePassword, setRemovePassword] = useState(false)
  const [editingHasPassword, setEditingHasPassword] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [pending, setPending] = useState(false)

  // payments sheet
  const [paymentsShare, setPaymentsShare] = useState<Share | null>(null)
  const [payments, setPayments] = useState<SharePayment[]>([])
  const [loadingPayments, setLoadingPayments] = useState(false)
  const [paymentFormOpen, setPaymentFormOpen] = useState(false)
  const [pPayerSelection, setPPayerSelection] = useState<string[]>([])
  const [pAmount, setPAmount] = useState('')
  const [pDate, setPDate] = useState('')
  const [pNotes, setPNotes] = useState('')
  const [pPending, setPPending] = useState(false)

  const today = () => new Date().toISOString().slice(0, 10)

  const openPayments = async (e: React.MouseEvent, s: Share) => {
    e.stopPropagation()
    setPaymentsShare(s)
    setPaymentFormOpen(false)
    setPPayerSelection([])
    setPAmount('')
    setPDate(today())
    setPNotes('')
    setLoadingPayments(true)
    try {
      const data = await listSharePayments(s.id)
      setPayments(data)
    } catch (err: any) {
      alert(err.message)
    } finally {
      setLoadingPayments(false)
    }
  }

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!paymentsShare || pPayerSelection.length === 0) return
    setPPending(true)
    try {
      await createSharePayment({
        shareId: paymentsShare.id,
        payers: pPayerSelection,
        amount: Number(pAmount),
        paidOn: pDate,
        notes: pNotes || null,
      })
      const data = await listSharePayments(paymentsShare.id)
      setPayments(data)
      setPaymentFormOpen(false)
      setPPayerSelection([])
      setPAmount('')
      setPDate(today())
      setPNotes('')
    } catch (err: any) {
      alert(err.message)
    } finally {
      setPPending(false)
    }
  }

  const handleDeletePayment = async (id: string) => {
    if (!window.confirm('Delete this payment?')) return
    try {
      await deleteSharePayment(id)
      setPayments(ps => ps.filter(p => p.id !== id))
    } catch (err: any) {
      alert(err.message)
    }
  }

  // per-participant summary for the payments sheet
  const paymentStats = (s: Share) => {
    const n = s.participants.length
    if (n === 0) return []
    return s.participants.map(name => {
      const paid = payments
        .filter(p => p.payers.includes(name))
        .reduce((sum, p) => sum + p.amount / p.payers.length, 0)
      return { name, paid }
    })
  }

  const load = async () => {
    try {
      const data = await listShares()
      setShares(data)
    } catch (err: any) {
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const openAdd = () => {
    setEditingId(null)
    setTitle('')
    setExtraInfo('')
    setParticipants([])
    setPassword('')
    setRemovePassword(false)
    setEditingHasPassword(false)
    setShowPassword(false)
    setDialogOpen(true)
  }

  const openEdit = (s: Share) => {
    setEditingId(s.id)
    setTitle(s.title)
    setExtraInfo(s.extra_info ?? '')
    setParticipants(s.participants ?? [])
    setPassword('')
    setRemovePassword(false)
    setEditingHasPassword(s.password !== null)
    setShowPassword(false)
    setDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setPending(true)
    try {
      if (editingId) {
        const patch: Parameters<typeof updateShare>[1] = {
          title,
          extra_info: extraInfo || null,
          participants,
        }
        if (removePassword) {
          patch.password = null           // explicitly remove
        } else if (password) {
          patch.password = password       // set new password
        }
        // if neither → don't touch password field
        await updateShare(editingId, patch)
      } else {
        await createShare({
          title,
          extra_info: extraInfo || null,
          participants,
          password: password || null,
        })
      }
      setDialogOpen(false)
      setLoading(true)
      await load()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setPending(false)
    }
  }

  const handleDelete = async (e: React.MouseEvent, s: Share) => {
    e.stopPropagation()
    if (!window.confirm(`Delete "${s.title}"? This will unlink all associated transactions.`)) return
    try {
      await deleteShare(s.id)
      await load()
    } catch (err: any) {
      alert(err.message)
    }
  }

  const copyLink = async (e: React.MouseEvent, s: Share) => {
    e.stopPropagation()
    const url = getShareUrl(s.share_token)
    try {
      await navigator.clipboard.writeText(url)
      setCopiedId(s.id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      alert(url)
    }
  }

  const isEditing = editingId !== null
  const dialogTitle = isEditing ? 'Edit share' : 'New share'

  return (
    <div className="space-y-4">
      {/* header */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Shared Expenses</h1>
        <button
          onClick={openAdd}
          className="bg-slate-900 text-white px-4 py-3 rounded hover:bg-slate-800 active:brightness-90 text-sm"
        >
          New share
        </button>
      </div>

      <p className="text-sm text-slate-500">
        Create a share for a trip, dinner, or any group expense. Link transactions to it and send the share link to friends for full transparency.
      </p>

      {loading ? (
        <p className="text-center text-slate-400 py-16">Loading…</p>
      ) : shares.length === 0 ? (
        <p className="text-center text-slate-400 py-16">No shares yet. Create one above.</p>
      ) : (
        <>
          {/* Desktop table */}
          <table className="hidden md:table w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-xs uppercase text-slate-500 pb-2 font-medium">Title</th>
                <th className="text-xs uppercase text-slate-500 pb-2 font-medium">With</th>
                <th className="text-xs uppercase text-slate-500 pb-2 font-medium">Extra info</th>
                <th className="text-xs uppercase text-slate-500 pb-2 font-medium">Share link</th>
                <th className="text-xs uppercase text-slate-500 pb-2 font-medium">Payments</th>
                <th className="text-xs uppercase text-slate-500 pb-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {shares.map(s => (
                <tr
                  key={s.id}
                  onClick={() => openEdit(s)}
                  className="border-b last:border-0 hover:bg-slate-50 cursor-pointer"
                >
                  <td className="py-3">
                    <span className="font-medium">{s.title}</span>
                    {s.password && (
                      <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-medium bg-amber-100 text-amber-700 rounded px-1.5 py-0.5">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        password
                      </span>
                    )}
                  </td>
                  <td className="py-3 text-slate-600">
                    {s.participants.length === 0
                      ? <span className="text-slate-400">—</span>
                      : s.participants.join(', ')}
                  </td>
                  <td className="py-3 text-slate-500 max-w-[200px] truncate">
                    {s.extra_info || <span className="text-slate-300">—</span>}
                  </td>
                  <td className="py-3">
                    <button
                      onClick={e => copyLink(e, s)}
                      className="inline-flex items-center gap-1.5 text-xs text-slate-500 border rounded px-2.5 py-1.5 hover:bg-slate-50 active:bg-slate-100"
                    >
                      {copiedId === s.id ? (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          Copied!
                        </>
                      ) : (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          Copy link
                        </>
                      )}
                    </button>
                  </td>
                  <td className="py-3">
                    <button
                      onClick={e => openPayments(e, s)}
                      className="inline-flex items-center gap-1.5 text-xs text-slate-500 border rounded px-2.5 py-1.5 hover:bg-slate-50 active:bg-slate-100"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                      Manage
                    </button>
                  </td>
                  <td className="py-3 text-right">
                    <button
                      onClick={e => handleDelete(e, s)}
                      className="inline-flex items-center justify-center p-3 rounded-lg text-slate-400 hover:text-red-600 active:bg-slate-100"
                      aria-label="Delete share"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6m2 0a1 1 0 00-1-1h-4a1 1 0 00-1 1H5" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile card list */}
          <ul className="md:hidden space-y-3">
            {shares.map(s => (
              <li
                key={s.id}
                onClick={() => openEdit(s)}
                className="bg-white border rounded-xl p-4 cursor-pointer active:bg-slate-50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-900">{s.title}</p>
                      {s.password && (
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      )}
                    </div>
                    {s.participants.length > 0 && (
                      <p className="text-sm text-slate-500 mt-0.5">with {s.participants.join(', ')}</p>
                    )}
                    {s.extra_info && (
                      <p className="text-sm text-slate-400 mt-1 truncate">{s.extra_info}</p>
                    )}
                  </div>
                  <button
                    onClick={e => handleDelete(e, s)}
                    className="p-2 text-slate-400 hover:text-red-600 active:bg-slate-100 rounded-lg shrink-0"
                    aria-label="Delete share"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6m2 0a1 1 0 00-1-1h-4a1 1 0 00-1 1H5" />
                    </svg>
                  </button>
                </div>
                <button
                  onClick={e => openPayments(e, s)}
                  className="mt-3 w-full flex items-center justify-center gap-2 text-sm border rounded-lg px-3 py-2.5 text-slate-600 hover:bg-slate-50 active:bg-slate-100"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                  Manage payments
                </button>
                <button
                  onClick={e => copyLink(e, s)}
                  className="mt-2 w-full flex items-center justify-center gap-2 text-sm border rounded-lg px-3 py-2.5 text-slate-600 hover:bg-slate-50 active:bg-slate-100"
                >
                  {copiedId === s.id ? (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      Link copied!
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy share link
                    </>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* add / edit dialog */}
      <MobileSheet open={dialogOpen} onClose={() => setDialogOpen(false)} title={dialogTitle}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="share-title">Title</label>
            <input
              id="share-title"
              type="text"
              required
              placeholder="e.g. Lisbon trip, Team dinner…"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="border rounded px-3 py-2 w-full"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">
              Participants <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <p className="text-xs text-slate-400">Names of friends you're sharing with</p>
            <ParticipantInput participants={participants} onChange={setParticipants} />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="share-info">
              Extra info <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <textarea
              id="share-info"
              placeholder="e.g. dates, context, splitting rules…"
              value={extraInfo}
              onChange={e => setExtraInfo(e.target.value)}
              rows={3}
              className="border rounded px-3 py-2 w-full resize-none text-sm"
            />
          </div>

          {/* Password gate */}
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="share-password">
              Password <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            {isEditing && editingHasPassword && !removePassword ? (
              <div className="flex items-center justify-between border rounded px-3 py-2 bg-amber-50 text-sm text-amber-700">
                <span className="flex items-center gap-1.5">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Password is set
                </span>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => { setRemovePassword(false); setShowPassword(true) }}
                    className="underline text-amber-700 hover:text-amber-900 text-xs"
                  >
                    Change
                  </button>
                  <button
                    type="button"
                    onClick={() => setRemovePassword(true)}
                    className="underline text-red-500 hover:text-red-700 text-xs"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : isEditing && editingHasPassword && removePassword ? (
              <div className="flex items-center justify-between border rounded px-3 py-2 bg-red-50 text-sm text-red-600">
                <span>Password will be removed</span>
                <button
                  type="button"
                  onClick={() => setRemovePassword(false)}
                  className="underline text-sm"
                >
                  Undo
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  id="share-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={isEditing && editingHasPassword ? 'New password…' : 'Leave blank for no password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="border rounded px-3 py-2 w-full pr-10"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            )}
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
              onClick={() => setDialogOpen(false)}
              className="border px-4 py-3 rounded hover:bg-slate-50 active:bg-slate-100 flex-1"
            >
              Cancel
            </button>
          </div>
        </form>
      </MobileSheet>

      {/* Payments sheet */}
      <MobileSheet
        open={paymentsShare !== null}
        onClose={() => { setPaymentsShare(null); setPaymentFormOpen(false) }}
        title={`Payments · ${paymentsShare?.title ?? ''}`}
      >
        <div className="space-y-5">
          {/* No participants warning */}
          {paymentsShare && paymentsShare.participants.length === 0 && (
            <p className="text-sm text-slate-400 bg-slate-50 rounded-lg px-4 py-3">
              Add participants to the share first so you can log who paid.
            </p>
          )}

          {/* Per-participant paid summary */}
          {paymentsShare && paymentsShare.participants.length > 0 && (
            <div>
              <p className="text-xs uppercase text-slate-400 font-medium mb-2">Paid so far</p>
              <div className="space-y-1.5">
                {paymentStats(paymentsShare).map(({ name, paid }) => (
                  <div key={name} className="flex items-center justify-between text-sm">
                    <span className="text-slate-700">{name}</span>
                    <span className={`font-semibold tabular-nums ${paid > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {paid > 0
                        ? new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(paid)
                        : '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Payment list */}
          {loadingPayments ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : payments.length > 0 ? (
            <div>
              <p className="text-xs uppercase text-slate-400 font-medium mb-2">History</p>
              <div className="space-y-2">
                {payments.map(p => (
                  <div key={p.id} className="flex items-start justify-between gap-3 bg-slate-50 rounded-lg px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800">
                        {p.payers.join(' + ')}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {format(new Date(p.paid_on + 'T00:00:00'), 'MMM d, yyyy')}
                        {p.payers.length > 1 && (
                          <span className="ml-1.5 text-slate-400">
                            ({new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(p.amount / p.payers.length)} each)
                          </span>
                        )}
                      </p>
                      {p.notes && <p className="text-xs text-slate-400 mt-0.5 italic">{p.notes}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-semibold tabular-nums text-slate-900">
                        {new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(p.amount)}
                      </span>
                      <button
                        onClick={() => handleDeletePayment(p.id)}
                        className="p-1.5 text-slate-400 hover:text-red-500 active:bg-slate-100 rounded"
                        aria-label="Delete payment"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6m2 0a1 1 0 00-1-1h-4a1 1 0 00-1 1H5" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            !loadingPayments && paymentsShare && paymentsShare.participants.length > 0 && (
              <p className="text-sm text-slate-400">No payments logged yet.</p>
            )
          )}

          {/* Add payment */}
          {paymentsShare && paymentsShare.participants.length > 0 && (
            paymentFormOpen ? (
              <form onSubmit={handleAddPayment} className="space-y-3 border-t pt-4">
                <p className="text-xs uppercase text-slate-400 font-medium">Add payment</p>

                {/* Payer selection */}
                <div className="space-y-1">
                  <label className="text-sm font-medium">Who paid?</label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {paymentsShare.participants.map(name => {
                      const selected = pPayerSelection.includes(name)
                      return (
                        <button
                          key={name}
                          type="button"
                          onClick={() => setPPayerSelection(sel =>
                            sel.includes(name) ? sel.filter(n => n !== name) : [...sel, name]
                          )}
                          className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                            selected
                              ? 'bg-slate-900 text-white border-slate-900'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          {name}
                        </button>
                      )
                    })}
                  </div>
                  {pPayerSelection.length > 1 && (
                    <p className="text-xs text-slate-400 mt-1">
                      Amount will be split equally among selected payers.
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-sm font-medium" htmlFor="p-amount">Amount</label>
                    <input
                      id="p-amount"
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0.01"
                      required
                      value={pAmount}
                      onChange={e => setPAmount(e.target.value)}
                      className="border rounded px-3 py-2 w-full text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium" htmlFor="p-date">Date</label>
                    <input
                      id="p-date"
                      type="date"
                      required
                      value={pDate}
                      onChange={e => setPDate(e.target.value)}
                      className="border rounded px-3 py-2 w-full text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium" htmlFor="p-notes">
                    Notes <span className="text-slate-400 font-normal">(optional)</span>
                  </label>
                  <input
                    id="p-notes"
                    type="text"
                    value={pNotes}
                    onChange={e => setPNotes(e.target.value)}
                    className="border rounded px-3 py-2 w-full text-sm"
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={pPending || pPayerSelection.length === 0}
                    className="bg-slate-900 text-white px-4 py-2.5 rounded hover:bg-slate-800 active:brightness-90 disabled:opacity-50 flex-1 text-sm"
                  >
                    {pPending ? 'Saving…' : 'Save payment'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentFormOpen(false)}
                    className="border px-4 py-2.5 rounded hover:bg-slate-50 active:bg-slate-100 text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => { setPaymentFormOpen(true); setPDate(today()) }}
                className="w-full flex items-center justify-center gap-2 border rounded-lg px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 active:bg-slate-100"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Log payment
              </button>
            )
          )}
        </div>
      </MobileSheet>
    </div>
  )
}
