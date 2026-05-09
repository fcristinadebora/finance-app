import { Routes, Route } from 'react-router-dom'
import Login from './routes/Login'
import Signup from './routes/Signup'
import ProtectedRoute from './routes/ProtectedRoute'
import Layout from './routes/Layout'
import Accounts from './routes/Accounts'
import Categories from './routes/Categories'
import Transactions from './routes/Transactions'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route index element={<h1 className="text-2xl font-semibold">Dashboard</h1>} />
          <Route path="accounts" element={<Accounts />} />
          <Route path="categories" element={<Categories />} />
          <Route path="transactions" element={<Transactions />} />
        </Route>
      </Route>
    </Routes>
  )
}
