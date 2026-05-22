import { Routes, Route } from 'react-router-dom'
import Login from './routes/Login'
import Signup from './routes/Signup'
import ProtectedRoute from './routes/ProtectedRoute'
import Layout from './routes/Layout'
import Accounts from './routes/Accounts'
import Categories from './routes/Categories'
import Transactions from './routes/Transactions'
import Budgets from './routes/Budgets'
import Dashboard from './routes/Dashboard'
import Periods from './routes/Periods'
import Shares from './routes/Shares'
import ShareView from './routes/ShareView'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      {/* Public share view — no auth required */}
      <Route path="/share/:token" element={<ShareView />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="accounts" element={<Accounts />} />
          <Route path="categories" element={<Categories />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="budgets" element={<Budgets />} />
          <Route path="periods" element={<Periods />} />
          <Route path="shares" element={<Shares />} />
        </Route>
      </Route>
    </Routes>
  )
}
