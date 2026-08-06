import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { OfflineBanner } from '../components/OfflineBanner'
import { useAuth } from '../app/AuthContext'
import { useOnline } from '../app/OnlineContext'

const primaryTabs = [
  { to: '/', label: 'Home', end: true, icon: HomeIcon },
  { to: '/orders', label: 'Trade', end: false, icon: TradeIcon },
  { to: '/live', label: 'Markets', end: false, icon: MarketIcon },
  { to: '/accounts', label: 'Wallet', end: false, icon: WalletIcon },
  { to: '/more', label: 'More', end: false, icon: MoreIcon },
] as const

export function ShellLayout() {
  const auth = useAuth()
  const online = useOnline()
  const location = useLocation()
  const moreActive = ['/history', '/summary', '/settings', '/more'].some((p) =>
    location.pathname.startsWith(p),
  )

  return (
    <div className="phone-stage">
      <div className="app-shell phone-shell">
        <header className="topbar">
          <div className="topbar-main">
            <div className="brand-lockup">
              <div className="brand">
                My<span>Exchanges</span>
              </div>
              <div className="brand-status">
                <span className={`blotter-dot ${online ? '' : 'off'}`} />
                {online ? 'Live' : 'Offline'}
              </div>
            </div>
            <button type="button" className="icon-btn" aria-label="Lock" onClick={() => auth.lock()}>
              <LockIcon />
            </button>
          </div>
        </header>

        <main className="content">
          <OfflineBanner />
          <Outlet />
        </main>

        <nav className="tabbar" aria-label="Primary">
          {primaryTabs.map((tab) => {
            const Icon = tab.icon
            const isMore = tab.to === '/more'
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  `tabbar-item ${(isMore ? moreActive : isActive) ? 'active' : ''}`
                }
              >
                <Icon />
                <span>{tab.label}</span>
              </NavLink>
            )
          })}
        </nav>
      </div>
    </div>
  )
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" strokeLinejoin="round" />
    </svg>
  )
}

function TradeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 7h11M15 7l-3-3M15 7l-3 3M20 17H9M9 17l3-3M9 17l3 3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function MarketIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 19V5M4 19h16" strokeLinecap="round" />
      <path d="M8 15v-4M12 15V8M16 15v-6" strokeLinecap="round" />
    </svg>
  )
}

function WalletIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="6" width="18" height="13" rx="2.5" />
      <path d="M3 10h18" />
      <circle cx="16.5" cy="14.5" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  )
}

function MoreIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
      <circle cx="6" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="18" cy="12" r="1.6" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" strokeLinecap="round" />
    </svg>
  )
}

/** Lightweight more menu screen used by tab */
export function MoreScreen() {
  const navigate = useNavigate()
  const items = [
    { to: '/summary', title: 'Summary', desc: 'Total portfolio snapshot' },
    { to: '/history', title: 'History', desc: 'Account value over time' },
    { to: '/settings', title: 'Settings', desc: 'Refresh, dust, backups' },
  ]
  return (
    <div className="mobile-page">
      <p className="eyebrow">Menu</p>
      <h2>More</h2>
      <div className="menu-list">
        {items.map((item) => (
          <button key={item.to} type="button" className="menu-item" onClick={() => navigate(item.to)}>
            <div>
              <strong>{item.title}</strong>
              <p>{item.desc}</p>
            </div>
            <span className="chev">›</span>
          </button>
        ))}
      </div>
    </div>
  )
}
