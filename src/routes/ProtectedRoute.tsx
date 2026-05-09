import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/auth'

export default function ProtectedRoute() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="animate-pulse text-slate-500">Loading…</p>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  return <Outlet />
}
