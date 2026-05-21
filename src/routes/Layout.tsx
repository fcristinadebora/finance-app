import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/auth'

type IconProps = { className?: string }

const DashboardIcon = ({ className }: IconProps) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3v-6h6v6h3a1 1 0 001-1V10" />
  </svg>
)

const AccountsIcon = ({ className }: IconProps) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M16 12h3M3 10h18" />
  </svg>
)

const CategoriesIcon = ({ className }: IconProps) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M3 12V5a2 2 0 012-2h7l9 9-9 9-9-9z" />
  </svg>
)

const TransactionsIcon = ({ className }: IconProps) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
  </svg>
)

const BudgetsIcon = ({ className }: IconProps) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M11 3.05A9 9 0 1020.95 13H11V3.05z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 3a9 9 0 018 8h-8V3z" />
  </svg>
)

const LogoutIcon = ({ className }: IconProps) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H9m4 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h6a2 2 0 012 2v1" />
  </svg>
)

const navLinks = [
  { to: '/', label: 'Dashboard', end: true, Icon: DashboardIcon },
  { to: '/accounts', label: 'Accounts', Icon: AccountsIcon },
  { to: '/categories', label: 'Categories', Icon: CategoriesIcon },
  { to: '/transactions', label: 'Transactions', Icon: TransactionsIcon },
  { to: '/budgets', label: 'Budgets', Icon: BudgetsIcon },
]

const topActiveClass = 'text-slate-900 font-semibold border-b-2 border-slate-900'
const topInactiveClass = 'text-slate-500 hover:text-slate-800'

export default function Layout() {
  const { user, signOut } = useAuth()

  return (
    <>
      <header className="border-b px-4 py-3 flex items-center justify-between gap-3">
        <span className="font-semibold">Finance</span>
        <div className="flex items-center gap-3 min-w-0">
          <span className="hidden md:inline text-sm text-slate-600 truncate max-w-[200px]">
            {user?.email}
          </span>
          {/* desktop: text button */}
          <button
            onClick={() => signOut()}
            className="hidden md:inline-flex bg-slate-900 text-white px-4 py-2 rounded hover:bg-slate-800 text-sm"
          >
            Log out
          </button>
          {/* mobile: icon button */}
          <button
            onClick={() => signOut()}
            aria-label="Log out"
            className="md:hidden text-slate-500 hover:text-slate-900 p-2 -mr-2"
          >
            <LogoutIcon className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* desktop: top tabs */}
      <nav className="hidden md:flex border-b px-4 gap-6">
        {navLinks.map(({ to, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `py-3 text-sm ${isActive ? topActiveClass : topInactiveClass}`
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>

      <main className="max-w-5xl mx-auto p-4 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-4">
        <Outlet />
      </main>

      {/* mobile: fixed bottom tab bar */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t flex pb-[env(safe-area-inset-bottom)]"
        aria-label="Primary"
      >
        {navLinks.map(({ to, label, end, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center gap-1 py-2 text-[11px] leading-none ${
                isActive ? 'text-slate-900' : 'text-slate-500'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2]' : ''}`} />
                <span className={isActive ? 'font-semibold' : ''}>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </>
  )
}
