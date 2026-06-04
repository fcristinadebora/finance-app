import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import {
  listTransactions, createTransaction, updateTransaction, deleteTransaction,
  createTransfer, updateTransfer,
  listAccounts, listCategories, listAccountBalances,
  createPeriod,
} from '../data'
import type { Transaction, Account, Category } from '../data'
import { listShares } from '../data/shares'
import type { Share } from '../data/shares'
import SearchableSelect from '../components/SearchableSelect'
import MobileSheet from '../components/MobileSheet'

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
  const [shares, setShares] = useState<Share[]>([])
  const [balances, setBalances] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  // filters
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [filterAccount, setFilterAccount] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterDirection, setFilterDirection] = useState<'' | 'income' | 'expense'>('')
  const [filterAccountType, setFilterAccountType] = useState('')
  const [showTransfers, setShowTransfers] = useState(true)
  const [filtersOpen, setFiltersOpen] = useState(false)

  // dialog state — shared
  const [dialogOpen, setDialogOpen] = useState(false)
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
  const [shareId, setShareId] = useState('')

  // dialog state — transfer only
  const [fromAccountId, setFromAccountId] = useState('')
  const [toAccountId, setToAccountId] = useState('')
  const [editingTransferLegs, setEditingTransferLegs] = useState<[Transaction, Transaction] | null>(null)

  // new-period dialog
  const [periodDialogOpen, setPeriodDialogOpen] = useState(false)
  const [periodDate, setPeriodDate] = useState(today())
  const [periodLabel, setPeriodLabel] = useState('')
  const [periodPending, setPeriodPending] = useState(false)

  const handleStartPeriod = async (e: React.FormEvent) => {
    e.preventDefault()
    setPeriodPending(true)
    try {
      await createPeriod(periodDate, periodLabel || undefined)
      setPeriodDialogOpen(false)
      setPeriodLabel('')
      setPeriodDate(today())
    } catch (err: any) {
      alert(err.message)
    } finally {
      setPeriodPending(false)
    }
  }

  const load = async () => {
    try {
      const [txs, accs, cats, bals, shs] = await Promise.all([
        listTransactions(),
        listAccounts(),
        listCategories(),
        listAccountBalances(),
        listShares(),
      ])
      setTransactions(txs)
      setAccounts(accs)
      setCategories(cats)
      setBalances(bals)
      setShares(shs)
    } catch (err: any) {
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const accountById = buildMap(accounts)
  const categoryById = buildMap(categories)
  const shareById = buildMap(shares)
  const txById = buildMap(transactions)

  const excludedCatIds = new Set(
    categories.filter(c => c.exclude_from_totals).map(c => c.id)
  )

  const accountTypes = [...new Set(accounts.map(a => a.type))].sort()

  const hasFilters = !!(fromDate || toDate || filterAccount || filterCategory || filterDirection || filterAccountType)
  const activeFilterCount =
    [fromDate, toDate, filterAccount, filterCategory, filterDirection, filterAccountType].filter(Boolean).length +
    (!showTransfers ? 1 : 0)

  const visible = transactions.filter(t => {
    if (!showTransfers && t.kind === 'transfer') return false
    if (fromDate && t.occurred_on < fromDate) return false
    if (toDate && t.occurred_on > toDate) return false
    if (filterAccount && t.account_id !== filterAccount) return false
    if (filterAccountType && accountById[t.account_id]?.type !== filterAccountType) return false
    if (filterCategory && t.category_id !== filterCategory) return false
    if (filterDirection === 'income' && t.amount < 0) return false
    if (filterDirection === 'expense' && t.amount >= 0) return false
    return true
  })

  const openAdd = () => {
    setEditingId(null)
    setTxType('expense')
    setAmount('')
    setDate(today())
    setAccountId(accounts[0]?.id ?? '')
    setCategoryId('')
    setShareId('')
    setDescription('')
    setNotes('')
    setFromAccountId(accounts[0]?.id ?? '')
    setToAccountId(accounts[1]?.id ?? accounts[0]?.id ?? '')
    setEditingTransferLegs(null)
    setDialogOpen(true)
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
      setShareId('')
    } else {
      setTxType(t.amount >= 0 ? 'income' : 'expense')
      setAccountId(t.account_id)
      setCategoryId(t.category_id ?? '')
      setShareId((t as any).share_id ?? '')
      setEditingTransferLegs(null)
    }

    setDialogOpen(true)
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
          share_id: shareId || null,
          description,
          notes: notes || null,
        }
        if (editingId) {
          await updateTransaction(editingId, payload)
        } else {
          await createTransaction(payload)
        }
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
            onClick={() => { setPeriodDate(today()); setPeriodDialogOpen(true) }}
            className="border border-slate-300 text-slate-700 px-4 py-3 rounded hover:bg-slate-50 active:bg-slate-100 text-sm flex items-center gap-1.5"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New period
          </button>
          <button
            onClick={openAdd}
            disabled={noAccounts}
            className="bg-slate-900 text-white px-4 py-3 rounded hover:bg-slate-800 active:brightness-90 disabled:opacity-40 text-sm"
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

      {/* filter row — mobile: collapsible panel */}
      <div className="md:hidden">
        <button
          onClick={() => setFiltersOpen(o => !o)}
          className="flex items-center gap-2 px-3 min-h-[44px] border rounded text-sm text-slate-700 bg-slate-50 hover:bg-slate-100 active:bg-slate-200"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
          </svg>
          <span>Filters</span>
          {activeFilterCount > 0 && (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-900 text-white text-xs font-semibold">
              {activeFilterCount}
            </span>
          )}
        </button>

        <div className={`transition-all duration-200 overflow-hidden ${filtersOpen ? 'max-h-96' : 'max-h-0'}`}>
          <div className="flex flex-col gap-3 p-3 bg-slate-50 rounded mt-2">
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
              <label className="text-xs text-slate-500">Account type</label>
              <SearchableSelect
                value={filterAccountType}
                onChange={setFilterAccountType}
                options={[{ value: '', label: 'All types' }, ...accountTypes.map(t => ({ value: t, label: t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) }))]}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500">Account</label>
              <SearchableSelect
                value={filterAccount}
                onChange={setFilterAccount}
                options={[{ value: '', label: 'All accounts' }, ...accounts.filter(a => !filterAccountType || a.type === filterAccountType).map(a => ({ value: a.id, label: a.name }))]}
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
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500">Type</label>
              <div className="flex border rounded overflow-hidden text-sm">
                {(['', 'income', 'expense'] as const).map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setFilterDirection(d)}
                    className={`flex-1 min-h-[36px] capitalize ${filterDirection === d ? 'bg-slate-900 text-white' : 'bg-white text-slate-700'}`}
                  >
                    {d === '' ? 'All' : d}
                  </button>
                ))}
              </div>
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
            {activeFilterCount > 0 && (
              <button
                onClick={() => { setFromDate(''); setToDate(''); setFilterAccount(''); setFilterAccountType(''); setFilterCategory(''); setFilterDirection(''); setShowTransfers(true) }}
                className="w-full border rounded px-3 py-3 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 active:bg-slate-100"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* filter row — desktop: horizontal layout */}
      <div className="hidden md:flex flex-wrap gap-3 items-end p-3 bg-slate-50 rounded">
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
          <label className="text-xs text-slate-500">Account type</label>
          <SearchableSelect
            value={filterAccountType}
            onChange={setFilterAccountType}
            options={[{ value: '', label: 'All types' }, ...accountTypes.map(t => ({ value: t, label: t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) }))]}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Account</label>
          <SearchableSelect
            value={filterAccount}
            onChange={setFilterAccount}
            options={[{ value: '', label: 'All accounts' }, ...accounts.filter(a => !filterAccountType || a.type === filterAccountType).map(a => ({ value: a.id, label: a.name }))]}
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
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Type</label>
          <div className="flex border rounded overflow-hidden text-sm">
            {(['', 'income', 'expense'] as const).map(d => (
              <button
                key={d}
                type="button"
                onClick={() => setFilterDirection(d)}
                className={`px-3 min-h-[34px] capitalize ${filterDirection === d ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}
              >
                {d === '' ? 'All' : d}
              </button>
            ))}
          </div>
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
            onClick={() => { setFromDate(''); setToDate(''); setFilterAccount(''); setFilterAccountType(''); setFilterCategory(''); setFilterDirection('') }}
            className="border rounded px-2 min-h-[44px] text-sm text-slate-700 hover:bg-white active:bg-slate-100"
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
                        : <>{cat?.name ?? '—'}{cat && excludedCatIds.has(cat.id) && <span className="ml-1 text-[10px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded-full">excluído</span>}</>}
                      {!isTransfer && (t as any).share_id && (
                        <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-medium bg-violet-100 text-violet-600 rounded px-1.5 py-0.5">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          {shareById[(t as any).share_id]?.title ?? 'shared'}
                        </span>
                      )}
                    </td>
                    <td className={`py-3 text-right font-medium tabular-nums ${t.amount >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {acc ? formatAmount(t.amount, acc.currency) : t.amount}
                    </td>
                    <td className="py-3 text-right">
                      <button
                        onClick={e => handleDelete(e, t)}
                        className="inline-flex items-center justify-center p-3 rounded-lg text-slate-400 hover:text-red-600 active:bg-slate-100"
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
                        {cat && <> · {cat.name}{excludedCatIds.has(cat.id) && <span className="ml-1 text-[10px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded-full">excluído</span>}</>}
                        {!isTransfer && (t as any).share_id && (
                          <> · <span className="text-violet-500">{shareById[(t as any).share_id]?.title ?? 'shared'}</span></>
                        )}
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

      {/* new period dialog */}
      <MobileSheet open={periodDialogOpen} onClose={() => setPeriodDialogOpen(false)} title="Start new period">
        <form onSubmit={handleStartPeriod} className="space-y-4">
          <p className="text-sm text-slate-500">
            Mark today as the start of a new salary period. All period stats on the dashboard will reset from this date.
          </p>
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="period-date">Start date</label>
            <input
              id="period-date"
              type="date"
              required
              value={periodDate}
              onChange={e => setPeriodDate(e.target.value)}
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
              value={periodLabel}
              onChange={e => setPeriodLabel(e.target.value)}
              className="border rounded px-3 py-2 w-full"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={periodPending}
              className="bg-slate-900 text-white px-4 py-3 rounded hover:bg-slate-800 active:brightness-90 disabled:opacity-50 flex-1"
            >
              {periodPending ? 'Saving…' : 'Start period'}
            </button>
            <button
              type="button"
              onClick={() => setPeriodDialogOpen(false)}
              className="border px-4 py-3 rounded hover:bg-slate-50 active:bg-slate-100 flex-1"
            >
              Cancel
            </button>
          </div>
        </form>
      </MobileSheet>

      {/* add / edit dialog */}
      <MobileSheet open={dialogOpen} onClose={() => setDialogOpen(false)} title={dialogTitle}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* type toggle — locked while editing so kind can't be switched after the fact */}
          <div className="flex border rounded overflow-hidden w-fit">
            {(['expense', 'income', 'transfer'] as const).map(t => (
              <button
                key={t}
                type="button"
                disabled={isEditing}
                onClick={() => handleTypeToggle(t)}
                className={`px-4 min-h-[44px] text-sm capitalize disabled:opacity-60 ${
                  txType === t ? 'bg-slate-900 text-white active:brightness-90' : 'bg-white text-slate-700 active:bg-slate-100'
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
                inputMode="decimal"
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

          {shares.length > 0 && (
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="tx-share">
                Shared expense <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <SearchableSelect
                id="tx-share"
                value={shareId}
                onChange={setShareId}
                options={[
                  { value: '', label: 'None' },
                  ...shares.map(s => ({
                    value: s.id,
                    label: s.participants.length > 0
                      ? `${s.title} · ${s.participants.join(', ')}`
                      : s.title,
                  })),
                ]}
              />
            </div>
          )}

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
