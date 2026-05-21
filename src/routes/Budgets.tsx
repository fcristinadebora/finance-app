import { useEffect, useRef, useState } from 'react'
import { listBudgets, upsertBudget, deleteBudget, listCategories, listTransactions, listAccounts } from '../data'
import type { Budget, Category } from '../data'
import SearchableSelect from '../components/SearchableSelect'

function firstOfMonthISO() {
  const d = new Date()
  d.setDate(1)
  return d.toISOString().slice(0, 10)
}

function lastOfMonthISO() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10)
}

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount)
}

function barColor(spent: number, limit: number) {
  if (spent > limit) return 'bg-red-500'
  if (spent > limit * 0.8) return 'bg-amber-500'
  return 'bg-emerald-500'
}

export default function Budgets() {
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [spendByCategory, setSpendByCategory] = useState<Record<string, number>>({})
  const [currency, setCurrency] = useState('USD')
  const [loading, setLoading] = useState(true)

  const dialogRef = useRef<HTMLDialogElement>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingCategoryId, setEditingCategoryId] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [monthlyLimit, setMonthlyLimit] = useState('')
  const [pending, setPending] = useState(false)

  const load = async () => {
    try {
      const [buds, cats, txs, accs] = await Promise.all([
        listBudgets(),
        listCategories(),
        listTransactions({ from: firstOfMonthISO(), to: lastOfMonthISO() }),
        listAccounts(),
      ])
      setBudgets(buds)
      setCategories(cats)
      setCurrency(accs[0]?.currency ?? 'USD')

      const spend: Record<string, number> = {}
      for (const t of txs) {
        if (t.kind === 'transfer') continue
        if (t.amount < 0 && t.category_id) {
          spend[t.category_id] = (spend[t.category_id] ?? 0) + Math.abs(t.amount)
        }
      }
      setSpendByCategory(spend)
    } catch (err: any) {
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const categoryById = Object.fromEntries(categories.map(c => [c.id, c]))
  const expenseCategories = categories.filter(c => c.kind === 'expense')
  const budgetedCategoryIds = new Set(budgets.map(b => b.category_id))
  const availableForNew = expenseCategories.filter(c => !budgetedCategoryIds.has(c.id))

  const openAdd = () => {
    setEditingId(null)
    setEditingCategoryId('')
    setSelectedCategoryId(availableForNew[0]?.id ?? '')
    setMonthlyLimit('')
    dialogRef.current?.showModal()
  }

  const openEdit = (b: Budget) => {
    setEditingId(b.id)
    setEditingCategoryId(b.category_id)
    setSelectedCategoryId(b.category_id)
    setMonthlyLimit(String(b.monthly_limit))
    dialogRef.current?.showModal()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setPending(true)
    try {
      await upsertBudget(selectedCategoryId, Number(monthlyLimit))
      dialogRef.current?.close()
      setLoading(true)
      await load()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setPending(false)
    }
  }

  const handleDelete = async (b: Budget) => {
    if (!window.confirm('Remove this budget?')) return
    try {
      await deleteBudget(b.id)
      await load()
    } catch (err: any) {
      alert(err.message)
    }
  }

  const noExpenseCategories = expenseCategories.length === 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Budgets</h1>
        <div className="flex items-center gap-3">
          {noExpenseCategories && (
            <span className="text-sm text-slate-400">Add an expense category first</span>
          )}
          <button
            onClick={openAdd}
            disabled={noExpenseCategories || availableForNew.length === 0}
            className="bg-slate-900 text-white px-4 py-3 rounded hover:bg-slate-800 active:brightness-90 disabled:opacity-40 text-sm"
          >
            Set budget
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-center text-slate-400 py-16">Loading…</p>
      ) : budgets.length === 0 ? (
        <p className="text-center text-slate-400 py-16 max-w-sm mx-auto">
          No budgets yet. Set a monthly limit for an expense category to track your spending.
        </p>
      ) : (
        <div className="space-y-3">
          {budgets.map(b => {
            const cat = categoryById[b.category_id]
            const spent = spendByCategory[b.category_id] ?? 0
            const pct = Math.min(100, (spent / b.monthly_limit) * 100)
            return (
              <div key={b.id} className="border rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{cat?.name ?? '—'}</span>
                  <span className="text-slate-500 text-sm">{formatCurrency(b.monthly_limit, currency)}</span>
                </div>
                <div className="bg-slate-200 rounded h-2 overflow-hidden">
                  <div
                    className={`h-full rounded transition-all duration-300 ${barColor(spent, b.monthly_limit)}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    Spent {formatCurrency(spent, currency)} of {formatCurrency(b.monthly_limit, currency)} this month
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => openEdit(b)}
                      className="inline-flex items-center justify-center p-3 rounded-lg text-slate-400 hover:text-slate-700 active:bg-slate-100"
                      aria-label="Edit budget"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-1.414.586H9v-2a2 2 0 01.586-1.414z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(b)}
                      className="inline-flex items-center justify-center p-3 rounded-lg text-slate-400 hover:text-red-600 active:bg-slate-100"
                      aria-label="Delete budget"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6m2 0a1 1 0 00-1-1h-4a1 1 0 00-1 1H5" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <dialog
        ref={dialogRef}
        onClick={e => { if (e.target === dialogRef.current) dialogRef.current.close() }}
        className="rounded-lg shadow-lg p-6 w-full max-w-sm m-auto fixed inset-0 backdrop:bg-black/40"
      >
        <h2 className="text-lg font-semibold mb-4">
          {editingId ? 'Edit budget' : 'Set budget'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="bud-category">Category</label>
            {editingId ? (
              <p className="border rounded px-3 py-2 w-full text-slate-600 bg-slate-50 text-sm">
                {categoryById[editingCategoryId]?.name ?? '—'}
              </p>
            ) : (
              <SearchableSelect
                id="bud-category"
                value={selectedCategoryId}
                onChange={setSelectedCategoryId}
                options={availableForNew.map(c => ({ value: c.id, label: c.name }))}
                required
              />
            )}
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="bud-limit">Monthly limit</label>
            <input
              id="bud-limit"
              type="number"
              step="0.01"
              min="0.01"
              required
              value={monthlyLimit}
              onChange={e => setMonthlyLimit(e.target.value)}
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
              onClick={() => dialogRef.current?.close()}
              className="border px-4 py-3 rounded hover:bg-slate-50 active:bg-slate-100 flex-1"
            >
              Cancel
            </button>
          </div>
        </form>
      </dialog>
    </div>
  )
}
