import { useEffect, useRef, useState } from 'react'
import { format } from 'date-fns'
import {
  listTransactions, createTransaction, updateTransaction, deleteTransaction,
  createTransfer, updateTransfer,
  listAccounts, listCategories, listAccountBalances,
} from '../data'
import type { Transaction, Account, Category } from '../data'
import SearchableSelect from '../components/SearchableSelect'

type TxType = 'expense' | 'income' | 'transfer'

const today = () => new Date().toISOString().slice(0, 10)

function formatAmount(amount: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount)
}

function buildMap<T extends { id: string }>(items: T[]): Record<string, T> {
  return Object.fromEntries(items.map(i => [i.id, i]))
}

export default function Transactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [balances, setBalances] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  // filters
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [filterAccount, setFilterAccount] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [showTransfers, setShowTransfers] = useState(true)

  // dialog state — shared
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [txType, setTxType] = useState<TxType>('expense')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(today())
  const [description, setDescription] = useState('')
  const [notes, setNotes] = useState('')
  const [pending, setPending] = useState(false)

  // dialog state — income/expense only
  const [accountId, setAccountId] = useState('')
  const [categoryId, setCategoryId] = useState('')

  // dialog state — transfer only
  const [fromAccountId, setFromAccountId] = useState('')
  const [toAccountId, setToAccountId] = useState('')
  const [editingTransferLegs, setEditingTransferLegs] = useState<[Transaction, Transaction] | null>(null)

  const load = async () => {
    try {
      const [txs, accs, cats, bals] = await Promise.all([
        listTransactions(),
        listAccounts(),
        listCategories(),
        listAccountBalances(),
      ])
      setTransactions(txs)
      setAccounts(accs)
      setCategories(cats)
      setBalances(bals)
    } catch (err: any) {
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const accountById = buildMap(accounts)
  const categoryById = buildMap(categories)
  const txById = buildMap(transactions)

  const hasFilters = !!(fromDate || toDate || filterAccount || filterCategory)

  const visible = transactions.filter(t => {
    if (!showTransfers && t.kind === 'transfer') return false
    if (fromDate && t.occurred_on < fromDate) return false
    if (toDate && t.occurred_on > toDate) return false
    if (filterAccount && t.account_id !== filterAccount) return false
    if (filterCategory && t.category_id !== filterCategory) return false
    return true
  })

  const openAdd = () => {
    setEditingId(null)
    setTxType('expense')
    setAmount('')
    setDate(today())
    setAccountId(accounts[0]?.id ?? '')
    setCategoryId('')
    setDescription('')
    setNotes('')
    setFromAccountId(accounts[0]?.id ?? '')
    setToAccountId(accounts[1]?.id ?? accounts[0]?.id ?? '')
    setEditingTransferLegs(null)
    dialogRef.current?.showModal()
  }

  const openEdit = (t: Transaction) => {
    setEditingId(t.id)
    setAmount(String(Math.abs(t.amount)))
    setDate(t.occurred_on)
    setDescription(t.description)
    setNotes(t.notes ?? '')

    if (t.kind === 'transfer') {
      const pairLeg = t.transfer_pair_id ? txById[t.transfer_pair_id] : null
      const fromLeg = t.amount < 0 ? t : pairLeg
      const toLeg = t.amount >= 0 ? t : pairLeg
      setTxType('transfer')
      setFromAccountId(fromLeg?.account_id ?? '')
      setToAccountId(toLeg?.account_id ?? '')
      setEditingTransferLegs(
        fromLeg && toLeg ? [fromLeg, toLeg] : null,
      )
      setAccountId('')
      setCategoryId('')
    } else {
      setTxType(t.amount >= 0 ? 'income' : 'expense')
      setAccountId(t.account_id)
      setCategoryId(t.category_id ?? '')
      setEditingTransferLegs(null)
    }

    dialogRef.current?.showModal()
  }

  const handleTypeToggle = (next: TxType) => {
    setTxType(next)
    if (next === 'transfer') {
      setFromAccountId(accounts[0]?.id ?? '')
      setToAccountId(accounts[1]?.id ?? accounts[0]?.id ?? '')
    } else if (categoryId) {
      const cat = categoryById[categoryId]
      if (cat && cat.kind !== next) setCategoryId('')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setPending(true)
    try {
      if (txType === 'transfer') {
        if (editingId && editingTransferLegs) {
          const [fromLeg, toLeg] = editingTransferLegs
          const patch: Parameters<typeof updateTransfer>[1] = {
            occurredOn: date,
            description,
            notes: notes || null,
            amount: Math.abs(Number(amount)),
          }
          await updateTransfer(editingTransferLegs, patch)
          if (fromAccountId !== fromLeg.account_id) {
            await updateTransaction(fromLeg.id, { account_id: fromAccountId })
          }
          if (toAccountId !== toLeg.account_id) {
            await updateTransaction(toLeg.id, { account_id: toAccountId })
          }
        } else {
          await createTransfer({
            fromAccountId,
            toAccountId,
            amount: Math.abs(Number(amount)),
            occurredOn: date,
            description,
            notes: notes || null,
          })
        }
      } else {
        const signedAmount = txType === 'expense' ? -Math.abs(Number(amount)) : Math.abs(Number(amount))
        const payload = {
          kind: txType,
          amount: signedAmount,
          occurred_on: date,
          account_id: accountId,
          category_id: categoryId || null,
          description,
          notes: notes || null,
        }
        if (editingId) {
          await updateTransaction(editingId, payload)
        } else {
          await createTransaction(payload)
        }
      }
      dialogRef.current?.close()
      setLoading(true)
      await load()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setPending(false)
    }
  }

  const handleDelete = async (e: React.MouseEvent, t: Transaction) => {
    e.stopPropagation()
    const msg = t.kind === 'transfer'
      ? 'Delete this transfer? Both legs will be removed.'
      : 'Delete this transaction?'
    if (!window.confirm(msg)) return
    try {
      await deleteTransaction(t.id)
      await load()
    } catch (err: any) {
      alert(err.message)
    }
  }

  const noAccounts = accounts.length === 0
  const isEditing = editingId !== null
  const isTransferDialog = txType === 'transfer'
  const dialogTitle = isTransferDialog
    ? (isEditing ? 'Edit transfer' : 'Add transfer')
    : (isEditing ? 'Edit transaction' : 'Add transaction')

  return (
    <div className="space-y-4">
      {/* header */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Transactions</h1>
        <div className="flex items-center gap-3">
          {noAccounts && (
            <span className="text-sm text-slate-400">Add an account first</span>
          )}
          <button
            onClick={openAdd}
            disabled={noAccounts}
            className="bg-slate-900 text-white px-4 py-2 rounded hover:bg-slate-800 disabled:opacity-40 text-sm"
          >
            Add transaction
          </button>
        </div>
      </div>

      {/* balance strip */}
      {accounts.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
          {accounts.map(a => {
            const b = balances[a.id] ?? 0
            return (
              <span key={a.id}>
                {a.name}{' '}
                <span className={`font-medium tabular-nums ${b > 0 ? 'text-emerald-600' : b < 0 ? 'text-red-600' : 'text-slate-700'}`}>
                  {new Intl.NumberFormat(undefined, { style: 'currency', currency: a.currency }).format(b)}
                </span>
              </span>
            )
          })}
        </div>
      )}

      {/* filter row */}
      <div className="flex flex-wrap gap-3 items-end p-3 bg-slate-50 rounded">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">From</label>
          <input
            type="date"
            value={fromDate}
            onChange={e => setFromDate(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">To</label>
          <input
            type="date"
            value={toDate}
            onChange={e => setToDate(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Account</label>
          <SearchableSelect
            value={filterAccount}
            onChange={setFilterAccount}
            options={[{ value: '', label: 'All accounts' }, ...accounts.map(a => ({ value: a.id, label: a.name }))]}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Category</label>
          <SearchableSelect
            value={filterCategory}
            onChange={setFilterCategory}
            options={[{ value: '', label: 'All categories' }, ...categories.map(c => ({ value: c.id, label: c.name }))]}
          />
        </div>
        <label className="flex items-center gap-1.5 text-sm text-slate-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showTransfers}
            onChange={e => setShowTransfers(e.target.checked)}
            className="rounded"
          />
          Show transfers
        </label>
        {hasFilters && (
          <button
            onClick={() => { setFromDate(''); setToDate(''); setFilterAccount(''); setFilterCategory('') }}
            className="border rounded px-2 py-1 text-sm text-slate-700 hover:bg-white"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* table / cards */}
      {loading ? (
        <p className="text-center text-slate-400 py-16">Loading…</p>
      ) : visible.length === 0 ? (
        <p className="text-center text-slate-400 py-16">
          {hasFilters ? 'No transactions match your filters.' : 'No transactions yet. Add one above.'}
        </p>
      ) : (
        <>
          {/* Desktop table */}
          <table className="hidden md:table w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-xs uppercase text-slate-500 pb-2 font-medium">Date</th>
                <th className="text-xs uppercase text-slate-500 pb-2 font-medium">Description</th>
                <th className="text-xs uppercase text-slate-500 pb-2 font-medium">Account</th>
                <th className="text-xs uppercase text-slate-500 pb-2 font-medium">Category</th>
                <th className="text-xs uppercase text-slate-500 pb-2 font-medium text-right">Amount</th>
                <th className="text-xs uppercase text-slate-500 pb-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {visible.map(t => {
                const acc = accountById[t.account_id]
                const cat = categoryById[t.category_id ?? '']
                const isTransfer = t.kind === 'transfer'
                const pairLeg = isTransfer && t.transfer_pair_id ? txById[t.transfer_pair_id] : null
                const pairAcc = pairLeg ? accountById[pairLeg.account_id] : null
                const transferLabel = isTransfer
                  ? (t.amount < 0 ? `→ ${pairAcc?.name ?? '—'}` : `← ${pairAcc?.name ?? '—'}`)
                  : null
                return (
                  <tr
                    key={t.id}
                    onClick={() => openEdit(t)}
                    className={`border-b last:border-0 hover:bg-slate-50 cursor-pointer ${isTransfer ? 'bg-slate-50/60' : ''}`}
                  >
                    <td className="py-3 text-slate-600 whitespace-nowrap">
                      {format(new Date(t.occurred_on + 'T00:00:00'), 'MMM d, yyyy')}
                    </td>
                    <td className="py-3 font-medium">{t.description}</td>
                    <td className="py-3 text-slate-600">{acc?.name ?? '—'}</td>
                    <td className="py-3 text-slate-500">
                      {isTransfer
                        ? <span className="inline-flex items-center gap-1 text-xs font-medium bg-slate-200 text-slate-600 rounded px-1.5 py-0.5">{transferLabel}</span>
                        : (cat?.name ?? '—')}
                    </td>
                    <td className={`py-3 text-right font-medium tabular-nums ${t.amount >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {acc ? formatAmount(t.amount, acc.currency) : t.amount}
                    </td>
                    <td className="py-3 text-right">
                      <button
                        onClick={e => handleDelete(e, t)}
                        className="text-slate-400 hover:text-red-600"
                        aria-label="Delete transaction"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="inline w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6m2 0a1 1 0 00-1-1h-4a1 1 0 00-1 1H5" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* Mobile card list */}
          <ul className="md:hidden">
            {visible.map(t => {
              const acc = accountById[t.account_id]
              const cat = categoryById[t.category_id ?? '']
              const isTransfer = t.kind === 'transfer'
              const dotColor = isTransfer ? '#94a3b8' : (cat?.color ?? '#94a3b8')
              return (
                <li
                  key={t.id}
                  onClick={() => openEdit(t)}
                  className="flex items-center justify-between p-4 bg-white border-b border-slate-100 last:border-0 active:bg-slate-50 cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: dotColor }}
                    />
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 truncate">{t.description}</p>
                      <p className="text-slate-500 text-sm">
                        {format(new Date(t.occurred_on + 'T00:00:00'), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right ml-4 shrink-0">
                    <p className={`font-semibold tabular-nums ${t.amount >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {acc ? formatAmount(t.amount, acc.currency) : t.amount}
                    </p>
                    <p className="text-slate-500 text-sm">{acc?.name ?? '—'}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}

      {/* add / edit dialog */}
      <dialog
        ref={dialogRef}
        onClick={e => { if (e.target === dialogRef.current) dialogRef.current.close() }}
        className="rounded-lg shadow-lg p-6 w-full max-w-md m-auto fixed inset-0 backdrop:bg-black/40"
      >
        <h2 className="text-lg font-semibold mb-4">{dialogTitle}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* type toggle — locked while editing so kind can't be switched after the fact */}
          <div className="flex border rounded overflow-hidden w-fit">
            {(['expense', 'income', 'transfer'] as const).map(t => (
              <button
                key={t}
                type="button"
                disabled={isEditing}
                onClick={() => handleTypeToggle(t)}
                className={`px-4 py-1.5 text-sm capitalize disabled:opacity-60 ${
                  txType === t ? 'bg-slate-900 text-white' : 'bg-white text-slate-700'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="tx-amount">Amount</label>
              <input
                id="tx-amount"
                type="number"
                step="0.01"
                min="0.01"
                required
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="border rounded px-3 py-2 w-full"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="tx-date">Date</label>
              <input
                id="tx-date"
                type="date"
                required
                value={date}
                onChange={e => setDate(e.target.value)}
                className="border rounded px-3 py-2 w-full"
              />
            </div>
          </div>

          {isTransferDialog ? (
            <>
              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="tx-from">From account</label>
                <SearchableSelect
                  id="tx-from"
                  value={fromAccountId}
                  onChange={setFromAccountId}
                  options={accounts
                    .filter(a => a.id !== toAccountId)
                    .map(a => ({ value: a.id, label: a.name }))}
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="tx-to">To account</label>
                <SearchableSelect
                  id="tx-to"
                  value={toAccountId}
                  onChange={setToAccountId}
                  options={accounts
                    .filter(a => a.id !== fromAccountId)
                    .map(a => ({ value: a.id, label: a.name }))}
                  required
                />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="tx-account">Account</label>
                <SearchableSelect
                  id="tx-account"
                  value={accountId}
                  onChange={setAccountId}
                  options={accounts.map(a => ({ value: a.id, label: a.name }))}
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="tx-category">Category</label>
                <SearchableSelect
                  id="tx-category"
                  value={categoryId}
                  onChange={setCategoryId}
                  options={[{ value: '', label: 'None' }, ...categories.map(c => ({ value: c.id, label: c.name }))]}
                />
              </div>
            </>
          )}

          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="tx-desc">Description</label>
            <input
              id="tx-desc"
              type="text"
              required
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="border rounded px-3 py-2 w-full"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="tx-notes">Notes</label>
            <textarea
              id="tx-notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="border rounded px-3 py-2 w-full resize-none"
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
