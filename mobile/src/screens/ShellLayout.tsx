import { NavLink, Outlet } from 'react-router-dom'
import { OfflineBanner } from '../components/OfflineBanner'
import { useAuth } from '../app/AuthContext'
import { useOnline } from '../app/OnlineContext'

const links = [
  ['/', 'Portfolio', 'Holdings'],
  ['/orders', 'Orders', 'Trade'],
  ['/live', 'Live', 'Markets'],
  ['/accounts', 'Accounts', 'Keys'],
  ['/history', 'History', 'History'],
  ['/summary', 'Summary', 'Summary'],
  ['/settings', 'Settings', 'Settings'],
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
          <div className="topbar-actions">
            <div className="blotter-rail desktop-inline" aria-label="Connection status">
              <span className={`blotter-dot ${online ? '' : 'off'}`} />
              <span>
                {online ? 'Connected' : 'Offline'} · <strong>Binance & OKX Spot</strong>
              </span>
            </div>
            <button type="button" className="btn btn-compact" onClick={() => auth.lock()}>
              Lock
            </button>
          </div>
        </div>
        <div className="blotter-rail mobile-only" aria-label="Connection status">
          <span className={`blotter-dot ${online ? '' : 'off'}`} />
          <span>
            {online ? 'Connected' : 'Offline'} · <strong>Binance & OKX Spot</strong>
          </span>
        </div>
      </header>

      <div className="shell-body">
        <nav className="nav nav-side" aria-label="Primary">
          {links.map(([to, label]) => (
            <NavLink key={to} to={to} end={to === '/'}>
              {label}
            </NavLink>
          ))}
        </nav>

        <main className="content">
          <OfflineBanner />
          <Outlet />
        </main>
      </div>

      <nav className="nav nav-bottom" aria-label="Primary mobile">
        {links.map(([to, , short]) => (
          <NavLink key={to} to={to} end={to === '/'}>
            <span className="nav-short">{short}</span>
            <span className="nav-full">{short}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
