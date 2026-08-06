import { NavLink, Outlet } from 'react-router-dom'
import { OfflineBanner } from '../components/OfflineBanner'
import { useAuth } from '../app/AuthContext'

const links = [
  ['/', 'Portfolio'],
  ['/orders', 'Orders'],
  ['/live', 'Live'],
  ['/accounts', 'Accounts'],
  ['/history', 'History'],
  ['/summary', 'Summary'],
  ['/settings', 'Settings'],
] as const

export function ShellLayout() {
  const auth = useAuth()
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          My<span>Exchanges</span>
        </div>
        <button className="btn" onClick={() => auth.lock()}>
          Lock
        </button>
      </header>
      <main className="content">
        <OfflineBanner />
        <Outlet />
      </main>
      <nav className="nav">
        {links.map(([to, label]) => (
          <NavLink key={to} to={to} end={to === '/'}>
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
