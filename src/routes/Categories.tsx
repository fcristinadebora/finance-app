import { useEffect, useRef, useState } from 'react'
import { listCategories, createCategory, deleteCategory } from '../data'
import type { Category } from '../data'

type KindFilter = 'all' | 'income' | 'expense'

export default function Categories() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<KindFilter>('all')
  const dialogRef = useRef<HTMLDialogElement>(null)

  const [name, setName] = useState('')
  const [kind, setKind] = useState<'income' | 'expense'>('expense')
  const [pending, setPending] = useState(false)

  const load = () =>
    listCategories()
      .then(setCategories)
      .catch(err => alert(err.message))
      .finally(() => setLoading(false))

  useEffect(() => { load() }, [])

  const openDialog = () => {
    setName('')
    setKind('expense')
    dialogRef.current?.showModal()
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setPending(true)
    try {
      await createCategory({ name, kind })
      dialogRef.current?.close()
      await load()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setPending(false)
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

  const visible = filter === 'all' ? categories : categories.filter(c => c.kind === filter)

  const filterBtn = (value: KindFilter, label: string) => (
    <button
      key={value}
      onClick={() => setFilter(value)}
      className={`px-3 py-1.5 rounded text-sm ${
        filter === value
          ? 'bg-slate-900 text-white'
          : 'border text-slate-700 hover:bg-slate-50'
      }`}
    >
      {label}
    </button>
  )

  const emptyMessage =
    filter === 'all'
      ? 'No categories yet. Add one to get started.'
      : `No ${filter} categories.`

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Categories</h1>
        <button
          onClick={openDialog}
          className="bg-slate-900 text-white px-4 py-2 rounded hover:bg-slate-800 text-sm"
        >
          Add category
        </button>
      </div>

      <div className="flex gap-2">
        {filterBtn('all', 'All')}
        {filterBtn('income', 'Income')}
        {filterBtn('expense', 'Expense')}
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
              <th className="text-xs uppercase text-slate-500 pb-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {visible.map(row => (
              <tr key={row.id} className="border-b last:border-0 hover:bg-slate-50">
                <td className="py-3 font-medium">{row.name}</td>
                <td className="py-3 text-slate-600 capitalize">{row.kind}</td>
                <td className="py-3 text-right">
                  <button
                    onClick={() => handleDelete(row)}
                    className="text-slate-400 hover:text-red-600"
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

      <dialog
        ref={dialogRef}
        onClick={e => { if (e.target === dialogRef.current) dialogRef.current.close() }}
        className="rounded-lg shadow-lg p-6 w-full max-w-sm m-auto fixed inset-0 backdrop:bg-black/40"
      >
        <h2 className="text-lg font-semibold mb-4">Add category</h2>
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
