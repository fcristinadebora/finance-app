import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'

export default function Signup() {
  const { signUp } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setPending(true)
    setError(null)
    const { error } = await signUp(email, password)
    if (error) {
      setError(error.message)
      setPending(false)
    } else {
      setDone(true)
    }
  }

  if (done) {
    return (
      <div className="max-w-sm mx-auto mt-24 p-6 border rounded-lg shadow-sm">
        <p className="text-sm">Check your email to confirm your account.</p>
      </div>
    )
  }

  return (
    <div className="max-w-sm mx-auto mt-24 p-6 border rounded-lg shadow-sm space-y-4">
      <h1 className="text-2xl font-semibold">Sign up</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="border rounded px-3 py-2 w-full"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="border rounded px-3 py-2 w-full"
          />
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="bg-slate-900 text-white px-4 py-2 rounded hover:bg-slate-800 disabled:opacity-50 w-full"
        >
          {pending ? 'Creating account…' : 'Sign up'}
        </button>
      </form>
      <p className="text-sm text-center">
        Already have an account?{' '}
        <Link to="/login" className="underline">Log in</Link>
      </p>
    </div>
  )
}
