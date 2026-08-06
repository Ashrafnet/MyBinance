import { NavLink, Outlet } from 'react-router-dom'
import { OfflineBanner } from '../components/OfflineBanner'
import { useAuth } from '../app/AuthContext'
import { useOnline } from '../app/OnlineContext'

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
  const online = useOnline()

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-main">
          <div className="brand">
            My<span>Exchanges</span>
          </div>
          <button className="btn" onClick={() => auth.lock()}>
            Lock
          </button>
        </div>
        <div className="blotter-rail" aria-label="Connection status">
          <span className={`blotter-dot ${online ? '' : 'off'}`} />
          <span>
            {online ? 'Connected' : 'Offline'} · <strong>Binance & OKX Spot</strong>
          </span>
        </div>
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
