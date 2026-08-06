import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { OfflineBanner } from '../components/OfflineBanner'
import { AppSelect } from '../components/AppSelect'
import { useAccountFilter } from '../app/AccountFilterContext'
import { useAuth } from '../app/AuthContext'
import { useConnectionStatus } from '../app/ConnectionStatus'
import { useOnline } from '../app/OnlineContext'
import { getStoredTheme, subscribeTheme, toggleTheme, type Theme } from '../app/theme'
import { startAccountLiveStreams } from '../services/accountLive'

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
  const connection = useConnectionStatus()
  const { accountId, setAccountId, accounts, refreshAccounts } = useAccountFilter()
  const location = useLocation()
  const [theme, setTheme] = useState<Theme>(() => getStoredTheme())
  const moreActive = ['/history', '/summary', '/settings', '/more'].some((p) =>
    location.pathname.startsWith(p),
  )

  useEffect(() => {
    void refreshAccounts()
    const onVis = () => {
      if (document.visibilityState === 'visible') void refreshAccounts()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [refreshAccounts])

  useEffect(() => subscribeTheme(setTheme), [])

  // Private user-data WebSockets (Binance listenKey + OKX private) — balances/orders without REST spam.
  useEffect(() => {
    if (!online || !auth.unlocked) return
    let stop: (() => void) | undefined
    let alive = true
    void startAccountLiveStreams().then((s) => {
      if (!alive) s()
      else stop = s
    })
    return () => {
      alive = false
      stop?.()
    }
  }, [online, auth.unlocked, accounts.length])

  return (
    <div className="phone-stage">
      <div className="app-shell phone-shell">
        <header className="topbar">
          <div className="topbar-main">
            <div className="brand-lockup">
              <div className="brand">
                My<span>Exchanges</span>
              </div>
              <div className="brand-status" title={connection.title}>
                <span
                  className={`blotter-dot ${
                    connection.tone === 'offline' ? 'off' : connection.tone === 'limited' ? 'warn' : ''
                  }`}
                />
                {connection.label}
              </div>
            </div>
            <div className="topbar-actions">
              <button
                type="button"
                className="icon-btn"
                aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
                onClick={() => toggleTheme()}
              >
                {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
              </button>
              <button type="button" className="icon-btn" aria-label="Lock" onClick={() => auth.lock()}>
                <LockIcon />
              </button>
            </div>
          </div>
          <div className="topbar-account">
            <AppSelect
              fullWidth
              icon="wallet"
              className="topbar-account-select"
              value={accountId}
              onChange={setAccountId}
              onOpenChange={(open) => {
                if (open) void refreshAccounts()
              }}
              emptyHint="No wallets yet — add one under Wallet"
              options={[
                { value: 'all', label: 'All accounts', hint: 'Combined Spot' },
                ...accounts.map((a) => ({
                  value: a.id,
                  label: a.alias,
                  hint: a.exchange === 'binance' ? 'Binance Spot' : 'OKX Spot',
                })),
              ]}
            />
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

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" strokeLinecap="round" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M20 14.5A7.5 7.5 0 0 1 9.5 4 6.5 6.5 0 1 0 20 14.5Z" strokeLinejoin="round" />
    </svg>
  )
}

function MenuIconSummary() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 19V5M4 19h16" strokeLinecap="round" />
      <path d="M8 15v-3M12 15V9M16 15v-5" strokeLinecap="round" />
    </svg>
  )
}

function MenuIconHistory() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l2.5 1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function MenuIconSettings() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="3" />
      <path
        d="M12 4.5v1.2M12 18.3v1.2M4.5 12h1.2M18.3 12h1.2M6.4 6.4l.85.85M16.75 16.75l.85.85M6.4 17.6l.85-.85M16.75 7.25l.85-.85"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** Lightweight more menu screen used by tab */
export function MoreScreen() {
  const navigate = useNavigate()
  const items = [
    { to: '/summary', title: 'Summary', desc: 'Total portfolio snapshot', Icon: MenuIconSummary, tone: 'summary' },
    { to: '/history', title: 'History', desc: 'Account value over time', Icon: MenuIconHistory, tone: 'history' },
    { to: '/settings', title: 'Settings', desc: 'Refresh, dust, backups', Icon: MenuIconSettings, tone: 'settings' },
  ] as const
  return (
    <div className="mobile-page">
      <p className="eyebrow">Menu</p>
      <h2>More</h2>
      <div className="menu-list">
        {items.map((item) => (
          <button
            key={item.to}
            type="button"
            className={`menu-item tone-${item.tone}`}
            onClick={() => navigate(item.to)}
          >
            <span className="menu-item-icon" aria-hidden="true">
              <item.Icon />
            </span>
            <div className="menu-item-copy">
              <strong>{item.title}</strong>
              <p>{item.desc}</p>
            </div>
            <span className="chev" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4">
                <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
