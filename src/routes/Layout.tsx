import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/auth'

const navLinks = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/accounts', label: 'Accounts' },
  { to: '/categories', label: 'Categories' },
  { to: '/transactions', label: 'Transactions' },
  { to: '/budgets', label: 'Budgets' },
]

const activeClass = 'text-slate-900 font-semibold border-b-2 border-slate-900'
const inactiveClass = 'text-slate-500 hover:text-slate-800'

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
      <nav className="border-b px-4 flex gap-6">
        {navLinks.map(({ to, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `py-3 text-sm ${isActive ? activeClass : inactiveClass}`
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
      <main className="max-w-5xl mx-auto p-4">
        <Outlet />
      </main>
    </>
  )
}
