import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { UnlockScreen } from '../screens/UnlockScreen'
import { ShellLayout } from '../screens/ShellLayout'
import { PortfolioScreen } from '../screens/PortfolioScreen'
import { AccountsScreen } from '../screens/AccountsScreen'
import { OrdersScreen } from '../screens/OrdersScreen'
import { LiveScreen } from '../screens/LiveScreen'
import { HistoryScreen } from '../screens/HistoryScreen'
import { SummaryScreen } from '../screens/SummaryScreen'
import { SettingsScreen } from '../screens/SettingsScreen'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const auth = useAuth()
  if (!auth.ready) return <div className="unlock muted">Loading…</div>
  if (!auth.unlocked) return <Navigate to="/unlock" replace />
  return children
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/unlock" element={<UnlockScreen />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <ShellLayout />
          </RequireAuth>
        }
      >
        <Route index element={<PortfolioScreen />} />
        <Route path="accounts" element={<AccountsScreen />} />
        <Route path="orders" element={<OrdersScreen />} />
        <Route path="live" element={<LiveScreen />} />
        <Route path="history" element={<HistoryScreen />} />
        <Route path="summary" element={<SummaryScreen />} />
        <Route path="settings" element={<SettingsScreen />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
