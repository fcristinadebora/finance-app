import { Routes, Route } from 'react-router-dom'
import Login from './routes/Login'
import Signup from './routes/Signup'
import ProtectedRoute from './routes/ProtectedRoute'
import Layout from './routes/Layout'
import Accounts from './routes/Accounts'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route index element={<h1 className="text-2xl font-semibold">Dashboard</h1>} />
          <Route path="accounts" element={<Accounts />} />
        </Route>
      </Route>
    </Routes>
  )
}
