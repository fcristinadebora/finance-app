import { useEffect, useState } from 'react'
import {
  listAccounts, listAccountBalances, createAccount, updateAccount, deleteAccount,
  listPeriods, listPeriodAccountSnapshots,
} from '../data'
import type { Account, Period, PeriodAccountSnapshot } from '../data'
import SearchableSelect from '../components/SearchableSelect'
import MobileSheet from '../components/MobileSheet'

const ACCOUNT_TYPES = ['checking', 'savings', 'credit_card', 'investment', 'cash', 'other'] as const

function formatBalance(amount: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount)
}

export default function Accounts() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [balances, setBalances] = useState<Record<string, number>>({})
  const [periods, setPeriods] = useState<Period[]>([])
  const [snapshots, setSnapshots] = useState<PeriodAccountSnapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [type, setType] = useState<typeof ACCOUNT_TYPES[number]>('checking')
  const [currency, setCurrency] = useState('USD')
  const [startingBalance, setStartingBalance] = useState(0)
  const [description, setDescription] = useState('')
  const [pending, setPending] = useState(false)

  const load = () =>
    Promise.all([listAccounts(), listAccountBalances(), listPeriods(), listPeriodAccountSnapshots()])
      .then(([accs, bals, pers, snaps]) => {
        setAccounts(accs)
        setBalances(bals)
        setPeriods(pers)
        setSnapshots(snaps)
      })
      .catch(err => alert(err.message))
      .finally(() => setLoading(false))

  // Balance at end of the last closed period (periods[1] — index 0 is the current open one)
  const prevPeriodId = periods.length > 1 ? periods[1].id : null
  const prevBalances: Record<string, number> = {}
  for (const s of snapshots) {
    if (s.period_id === prevPeriodId) prevBalances[s.account_id] = s.balance
  }

  function periodDelta(accountId: string, currentBalance: number, currency: string) {
    const prev = prevBalances[accountId]
    if (prev == null) return null
    const abs = currentBalance - prev
    const pct = prev !== 0 ? (abs / Math.abs(prev)) * 100 : null
    return { abs, pct, currency }
  }

  function DeltaTag({ accountId, balance, currency }: { accountId: string; balance: number; currency: string }) {
    const d = periodDelta(accountId, balance, currency)
    if (!d) return <span className="text-slate-300 text-xs">—</span>
    const up = d.abs >= 0
    return (
      <span className={`text-xs tabular-nums ${up ? 'text-emerald-600' : 'text-red-500'}`}>
        {up ? '▲' : '▼'} {formatBalance(Math.abs(d.abs), d.currency)}
        {d.pct != null && <> · {Math.abs(d.pct).toFixed(1)}%</>}
      </span>
    )
  }

  useEffect(() => { load() }, [])

  const openAdd = () => {
    setEditingId(null)
    setName('')
    setType('checking')
    setCurrency('USD')
    setStartingBalance(0)
    setDescription('')
    setDialogOpen(true)
  }

  const openEdit = (a: Account) => {
    setEditingId(a.id)
    setName(a.name)
    setType(a.type as typeof ACCOUNT_TYPES[number])
    setCurrency(a.currency)
    setStartingBalance(a.starting_balance)
    setDescription(a.description ?? '')
    setDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setPending(true)
    const payload = { name, type, currency, starting_balance: startingBalance, description: description || null }
    try {
      if (editingId) {
        await updateAccount(editingId, payload)
      } else {
        await createAccount(payload)
      }
      setDialogOpen(false)
      await load()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setPending(false)
    }
  }

  const handleDelete = async (e: React.MouseEvent, account: Account) => {
    e.stopPropagation()
    if (!window.confirm('Delete this account? Its transactions will also be deleted.')) return
    try {
      await deleteAccount(account.id)
      await load()
    } catch (err: any) {
      alert(err.message)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Accounts</h1>
        <button
          onClick={openAdd}
          className="bg-slate-900 text-white px-4 py-3 rounded hover:bg-slate-800 active:brightness-90 text-sm"
        >
          Add account
        </button>
      </div>

      {loading ? (
        <p className="text-center text-slate-400 py-16">Loading…</p>
      ) : accounts.length === 0 ? (
        <p className="text-center text-slate-400 py-16">No accounts yet. Add one to get started.</p>
      ) : (
        <>
          {/* Desktop table */}
          <table className="hidden md:table w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-xs uppercase text-slate-500 pb-2 font-medium">Name</th>
                <th className="text-xs uppercase text-slate-500 pb-2 font-medium">Type</th>
                <th className="text-xs uppercase text-slate-500 pb-2 font-medium">Currency</th>
                <th className="text-xs uppercase text-slate-500 pb-2 font-medium">Starting balance</th>
                <th className="text-xs uppercase text-slate-500 pb-2 font-medium">Current balance</th>
                <th className="text-xs uppercase text-slate-500 pb-2 font-medium">vs prev period</th>
                <th className="text-xs uppercase text-slate-500 pb-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {accounts.map(row => (
                <tr
                  key={row.id}
                  onClick={() => openEdit(row)}
                  className="border-b last:border-0 hover:bg-slate-50 cursor-pointer"
                >
                  <td className="py-3 font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      {row.name}
                      {row.description && (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="w-3.5 h-3.5 text-slate-300 shrink-0"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <title>{row.description}</title>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                    </span>
                  </td>
                  <td className="py-3 text-slate-600 capitalize">{row.type.replace('_', ' ')}</td>
                  <td className="py-3 text-slate-600">{row.currency}</td>
                  <td className="py-3 text-slate-600">{formatBalance(row.starting_balance, row.currency)}</td>
                  <td className={`py-3 font-medium tabular-nums ${
                    (balances[row.id] ?? 0) > 0 ? 'text-emerald-600' :
                    (balances[row.id] ?? 0) < 0 ? 'text-red-600' : ''
                  }`}>
                    {formatBalance(balances[row.id] ?? 0, row.currency)}
                  </td>
                  <td className="py-3">
                    <DeltaTag accountId={row.id} balance={balances[row.id] ?? 0} currency={row.currency} />
                  </td>
                  <td className="py-3 text-right">
                    <button
                      onClick={e => handleDelete(e, row)}
                      className="inline-flex items-center justify-center p-3 rounded-lg text-slate-400 hover:text-red-600 active:bg-slate-100"
                      aria-label="Delete account"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="inline w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
            {accounts.map(row => {
              const balance = balances[row.id] ?? 0
              return (
                <li
                  key={row.id}
                  className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 active:bg-slate-50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 truncate">{row.name}</p>
                      <p className="text-slate-500 text-sm truncate">
                        {row.description ?? row.currency}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-xl font-bold tabular-nums ${
                        balance > 0 ? 'text-emerald-600' : balance < 0 ? 'text-rose-600' : 'text-slate-900'
                      }`}>
                        {formatBalance(balance, row.currency)}
                      </p>
                      <div className="mt-0.5">
                        <DeltaTag accountId={row.id} balance={balance} currency={row.currency} />
                      </div>
                      <span className="inline-block text-xs font-medium bg-slate-100 text-slate-600 rounded-full px-2.5 py-0.5 capitalize mt-1">
                        {row.type.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-end gap-1 mt-3">
                    <button
                      onClick={() => openEdit(row)}
                      className="flex items-center justify-center w-11 h-11 text-slate-400 hover:text-slate-700 active:bg-slate-100 rounded-lg"
                      aria-label="Edit account"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={e => handleDelete(e, row)}
                      className="flex items-center justify-center w-11 h-11 text-slate-400 hover:text-red-600 active:bg-slate-100 rounded-lg"
                      aria-label="Delete account"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6m2 0a1 1 0 00-1-1h-4a1 1 0 00-1 1H5" />
                      </svg>
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}

      <MobileSheet
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={editingId ? 'Edit account' : 'Add account'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="acc-name">Name</label>
            <input
              id="acc-name"
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              className="border rounded px-3 py-2 w-full"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="acc-type">Type</label>
            <SearchableSelect
              id="acc-type"
              value={type}
              onChange={v => setType(v as typeof ACCOUNT_TYPES[number])}
              options={ACCOUNT_TYPES.map(t => ({ value: t, label: t.replace('_', ' ') }))}
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="acc-currency">Currency</label>
            <input
              id="acc-currency"
              type="text"
              value={currency}
              onChange={e => setCurrency(e.target.value.toUpperCase())}
              className="border rounded px-3 py-2 w-full"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="acc-balance">Starting balance</label>
            <input
              id="acc-balance"
              type="number"
              inputMode="decimal"
              step="any"
              value={startingBalance}
              onChange={e => setStartingBalance(parseFloat(e.target.value) || 0)}
              className="border rounded px-3 py-2 w-full"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="acc-description">Description (optional)</label>
            <textarea
              id="acc-description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              className="border rounded px-3 py-2 w-full resize-none"
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
              onClick={() => setDialogOpen(false)}
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
