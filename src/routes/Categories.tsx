import { useEffect, useState } from 'react'
import { listCategories, createCategory, updateCategory, deleteCategory } from '../data'
import type { Category } from '../data'
import MobileSheet from '../components/MobileSheet'

type KindFilter = 'all' | 'income' | 'expense' | 'excluded'

export default function Categories() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<KindFilter>('all')
  const [dialogOpen, setDialogOpen] = useState(false)

  const [name, setName] = useState('')
  const [kind, setKind] = useState<'income' | 'expense'>('expense')
  const [excludeFromTotals, setExcludeFromTotals] = useState(false)
  const [isSavings, setIsSavings] = useState(false)
  const [pending, setPending] = useState(false)
  const [toggling, setToggling] = useState<Map<string, boolean>>(new Map())

  const load = () =>
    listCategories()
      .then(setCategories)
      .catch(err => alert(err.message))
      .finally(() => setLoading(false))

  useEffect(() => { load() }, [])

  const openDialog = () => {
    setName('')
    setKind('expense')
    setExcludeFromTotals(false)
    setIsSavings(false)
    setDialogOpen(true)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setPending(true)
    try {
      await createCategory({ name, kind, exclude_from_totals: excludeFromTotals, is_savings: isSavings })
      setDialogOpen(false)
      await load()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setPending(false)
    }
  }

  const handleToggleExclude = async (cat: Category) => {
    setToggling(prev => new Map(prev).set(cat.id + '_excl', true))
    try {
      await updateCategory(cat.id, { exclude_from_totals: !cat.exclude_from_totals })
      await load()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setToggling(prev => { const next = new Map(prev); next.delete(cat.id + '_excl'); return next })
    }
  }

  const handleToggleSavings = async (cat: Category) => {
    setToggling(prev => new Map(prev).set(cat.id + '_sav', true))
    try {
      await updateCategory(cat.id, { is_savings: !cat.is_savings })
      await load()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setToggling(prev => { const next = new Map(prev); next.delete(cat.id + '_sav'); return next })
    }
  }

  const handleDelete = async (cat: Category) => {
    if (!window.confirm('Delete this category? Existing transactions will keep their data but lose this category label.')) return
    try {
      await deleteCategory(cat.id)
      await load()
    } catch (err: any) {
      alert(err.message)
    }
  }

  const visible = filter === 'all'
    ? categories
    : filter === 'excluded'
    ? categories.filter(c => c.exclude_from_totals)
    : categories.filter(c => c.kind === filter)

  const filterBtn = (value: KindFilter, label: string) => (
    <button
      key={value}
      onClick={() => setFilter(value)}
      className={`px-3 min-h-[44px] rounded text-sm ${
        filter === value
          ? 'bg-slate-900 text-white active:brightness-90'
          : 'border text-slate-700 hover:bg-slate-50 active:bg-slate-100'
      }`}
    >
      {label}
    </button>
  )

  const emptyMessage =
    filter === 'all'
      ? 'No categories yet. Add one to get started.'
      : filter === 'excluded'
      ? 'Nenhuma categoria excluída dos totais.'
      : `No ${filter} categories.`

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Categories</h1>
        <button
          onClick={openDialog}
          className="bg-slate-900 text-white px-4 py-3 rounded hover:bg-slate-800 active:brightness-90 text-sm"
        >
          Add category
        </button>
      </div>

      <div className="flex gap-2">
        {filterBtn('all', 'All')}
        {filterBtn('income', 'Income')}
        {filterBtn('expense', 'Expense')}
        {filterBtn('excluded', 'Excluídos')}
      </div>

      {loading ? (
        <p className="text-center text-slate-400 py-16">Loading…</p>
      ) : visible.length === 0 ? (
        <p className="text-center text-slate-400 py-16">{emptyMessage}</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-xs uppercase text-slate-500 pb-2 font-medium">Name</th>
              <th className="text-xs uppercase text-slate-500 pb-2 font-medium">Kind</th>
              <th className="text-xs uppercase text-slate-500 pb-2 font-medium">Reporting</th>
              <th className="text-xs uppercase text-slate-500 pb-2 font-medium">Savings</th>
              <th className="text-xs uppercase text-slate-500 pb-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {visible.map(row => (
              <tr key={row.id} className="border-b last:border-0 hover:bg-slate-50">
                <td className="py-3 font-medium">
                  {row.exclude_from_totals && (
                    <span className="text-slate-400 mr-1 text-xs">⊘</span>
                  )}
                  {row.is_savings && (
                    <span className="text-blue-400 mr-1 text-xs">🏦</span>
                  )}
                  {row.name}
                </td>
                <td className="py-3 text-slate-600 capitalize">{row.kind}</td>

                {/* exclude from totals toggle */}
                <td className="py-3">
                  {(() => {
                    const busy = toggling.get(row.id + '_excl') ?? false
                    return (
                      <button
                        onClick={() => handleToggleExclude(row)}
                        disabled={busy}
                        className={`text-xs font-medium px-2.5 py-1 rounded-full cursor-pointer active:opacity-70 transition-colors min-w-[72px] text-center ${
                          busy
                            ? 'bg-slate-100 text-slate-400 border border-slate-200'
                            : row.exclude_from_totals
                            ? 'bg-slate-100 text-slate-500 border border-slate-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        {busy ? '...' : row.exclude_from_totals ? 'Excluído' : 'Included'}
                      </button>
                    )
                  })()}
                </td>

                {/* is_savings toggle */}
                <td className="py-3">
                  {(() => {
                    const busy = toggling.get(row.id + '_sav') ?? false
                    return (
                      <button
                        onClick={() => handleToggleSavings(row)}
                        disabled={busy}
                        className={`text-xs font-medium px-2.5 py-1 rounded-full cursor-pointer active:opacity-70 transition-colors min-w-[60px] text-center ${
                          busy
                            ? 'bg-slate-100 text-slate-400 border border-slate-200'
                            : row.is_savings
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-slate-50 text-slate-400 border border-slate-200'
                        }`}
                      >
                        {busy ? '...' : row.is_savings ? 'Savings' : 'No'}
                      </button>
                    )
                  })()}
                </td>

                <td className="py-3 text-right">
                  <button
                    onClick={() => handleDelete(row)}
                    className="inline-flex items-center justify-center p-3 rounded-lg text-slate-400 hover:text-red-600 active:bg-slate-100"
                    aria-label="Delete category"
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

      <MobileSheet open={dialogOpen} onClose={() => setDialogOpen(false)} title="Add category">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="cat-name">Name</label>
            <input
              id="cat-name"
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              className="border rounded px-3 py-2 w-full"
            />
          </div>
          <fieldset className="space-y-1">
            <legend className="text-sm font-medium">Kind</legend>
            <div className="flex gap-6 mt-1">
              {(['expense', 'income'] as const).map(k => (
                <label key={k} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="kind"
                    value={k}
                    checked={kind === k}
                    onChange={() => setKind(k)}
                  />
                  <span className="capitalize">{k}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={excludeFromTotals}
              onChange={e => setExcludeFromTotals(e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <div>
              <span className="text-sm font-medium">Excluir dos totais</span>
              <p className="text-xs text-slate-500 mt-0.5">
                Poupanças, investimentos e outros movimentos financeiros que
                não devem contar como despesa ou receita.
              </p>
            </div>
          </label>
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isSavings}
              onChange={e => setIsSavings(e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <div>
              <span className="text-sm font-medium">Savings</span>
              <p className="text-xs text-slate-500 mt-0.5">
                Transactions in this category count towards the savings column in period history.
              </p>
            </div>
          </label>
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
