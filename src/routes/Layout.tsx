import { Outlet } from 'react-router-dom'
import { useAuth } from '../lib/auth'

export default function Layout() {
  const { user, signOut } = useAuth()

  return (
    <>
      <header className="border-b px-4 py-3 flex items-center justify-between">
        <span className="font-semibold">Finance</span>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-600">{user?.email}</span>
          <button
            onClick={() => signOut()}
            className="bg-slate-900 text-white px-4 py-2 rounded hover:bg-slate-800 text-sm"
          >
            Log out
          </button>
        </div>
      </header>
      <main className="max-w-5xl mx-auto p-4">
        <Outlet />
      </main>
    </>
  )
}
