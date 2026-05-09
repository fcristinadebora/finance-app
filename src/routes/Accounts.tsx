import { useEffect, useRef, useState } from 'react'
import { listAccounts, createAccount, deleteAccount } from '../data'
import type { Account } from '../data'

const ACCOUNT_TYPES = ['checking', 'savings', 'credit_card', 'investment', 'cash', 'other'] as const

function formatBalance(amount: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount)
}

export default function Accounts() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const dialogRef = useRef<HTMLDialogElement>(null)

  const [name, setName] = useState('')
  const [type, setType] = useState<typeof ACCOUNT_TYPES[number]>('checking')
  const [currency, setCurrency] = useState('USD')
  const [startingBalance, setStartingBalance] = useState(0)
  const [pending, setPending] = useState(false)

  const load = () =>
    listAccounts()
      .then(setAccounts)
      .catch(err => alert(err.message))
      .finally(() => setLoading(false))

  useEffect(() => { load() }, [])

  const openDialog = () => {
    setName('')
    setType('checking')
    setCurrency('USD')
    setStartingBalance(0)
    dialogRef.current?.showModal()
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setPending(true)
    try {
      await createAccount({ name, type, currency, starting_balance: startingBalance })
      dialogRef.current?.close()
      await load()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setPending(false)
    }
  }

  const handleDelete = async (account: Account) => {
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
          onClick={openDialog}
          className="bg-slate-900 text-white px-4 py-2 rounded hover:bg-slate-800 text-sm"
        >
          Add account
        </button>
      </div>

      {loading ? (
        <p className="text-center text-slate-400 py-16">Loading…</p>
      ) : accounts.length === 0 ? (
        <p className="text-center text-slate-400 py-16">No accounts yet. Add one to get started.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-xs uppercase text-slate-500 pb-2 font-medium">Name</th>
              <th className="text-xs uppercase text-slate-500 pb-2 font-medium">Type</th>
              <th className="text-xs uppercase text-slate-500 pb-2 font-medium">Currency</th>
              <th className="text-xs uppercase text-slate-500 pb-2 font-medium">Starting balance</th>
              <th className="text-xs uppercase text-slate-500 pb-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {accounts.map(row => (
              <tr key={row.id} className="border-b last:border-0 hover:bg-slate-50">
                <td className="py-3 font-medium">{row.name}</td>
                <td className="py-3 text-slate-600 capitalize">{row.type.replace('_', ' ')}</td>
                <td className="py-3 text-slate-600">{row.currency}</td>
                <td className="py-3 text-slate-600">{formatBalance(row.starting_balance, row.currency)}</td>
                <td className="py-3 text-right">
                  <button
                    onClick={() => handleDelete(row)}
                    className="text-slate-400 hover:text-red-600 text-xs"
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
      )}

      <dialog
        ref={dialogRef}
        onClick={(e) => {
          if (e.target === dialogRef.current) dialogRef.current.close()
        }}
        className="rounded-lg shadow-lg p-6 w-full max-w-sm m-auto fixed inset-0 backdrop:bg-black/40"
      >
        <h2 className="text-lg font-semibold mb-4">Add account</h2>
        <form onSubmit={handleCreate} className="space-y-4">
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
            <select
              id="acc-type"
              value={type}
              onChange={e => setType(e.target.value as typeof ACCOUNT_TYPES[number])}
              className="border rounded px-3 py-2 w-full"
            >
              {ACCOUNT_TYPES.map(t => (
                <option key={t} value={t}>{t.replace('_', ' ')}</option>
              ))}
            </select>
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
              step="any"
              value={startingBalance}
              onChange={e => setStartingBalance(parseFloat(e.target.value) || 0)}
              className="border rounded px-3 py-2 w-full"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={pending}
              className="bg-slate-900 text-white px-4 py-2 rounded hover:bg-slate-800 disabled:opacity-50 flex-1"
            >
              {pending ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="border px-4 py-2 rounded hover:bg-slate-50 flex-1"
            >
              Cancel
            </button>
          </div>
        </form>
      </dialog>
    </div>
  )
}
