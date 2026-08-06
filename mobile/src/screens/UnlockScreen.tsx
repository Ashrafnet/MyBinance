import { useEffect, useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../app/AuthContext'
import { getStoredTheme, subscribeTheme, toggleTheme, type Theme } from '../app/theme'

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" strokeLinecap="round" />
    </svg>
  )
}

function FingerprintIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 11a3 3 0 0 1 3 3v5" strokeLinecap="round" />
      <path d="M9 14v2.5" strokeLinecap="round" />
      <path d="M15 11.2A5 5 0 0 0 7.5 14" strokeLinecap="round" />
      <path d="M17.5 10.5A7.5 7.5 0 0 0 6 14.2" strokeLinecap="round" />
      <path d="M12 3a8 8 0 0 1 8 8v2" strokeLinecap="round" />
      <path d="M4.5 13.5V11A7.5 7.5 0 0 1 12 3.5" strokeLinecap="round" />
    </svg>
  )
}

function ArrowRightIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function UnlockScreen() {
  const auth = useAuth()
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [theme, setTheme] = useState<Theme>(() => getStoredTheme())

  useEffect(() => subscribeTheme(setTheme), [])

  if (!auth.ready) return <div className="unlock muted">Opening app…</div>
  if (auth.unlocked) return <Navigate to="/" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (!auth.initialized) await auth.setupPin(pin)
      else await auth.unlockPin(pin)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not unlock')
    } finally {
      setBusy(false)
    }
  }

  async function onBio() {
    setBusy(true)
    setError(null)
    const ok = await auth.unlockBiometric()
    if (!ok) setError('Fingerprint did not match. Try your recovery PIN.')
    setBusy(false)
  }

  return (
    <div className="phone-stage">
      <div className="phone-shell unlock unlock-fullscreen">
        <div className="unlock-card">
          <div className="unlock-top">
            <p className="eyebrow">Spot trading</p>
            <button
              type="button"
              className="icon-btn"
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              onClick={() => toggleTheme()}
            >
              {theme === 'dark' ? '☀' : '☾'}
            </button>
          </div>
          <div className="unlock-body">
            <h1 className="brand">
              My<span>Exchanges</span>
            </h1>
            <p className="unlock-lead">
              {auth.initialized
                ? 'Your Binance & OKX portfolio, orders, and markets — secured on this phone.'
                : 'Set a recovery PIN to protect API keys. Next unlock can use fingerprint.'}
            </p>
            <div className="unlock-meta">
              <span className="stamp">Binance</span>
              <span className="stamp">OKX</span>
              <span className="stamp hot">Offline ready</span>
            </div>
          </div>
          <div className="unlock-actions">
            {auth.initialized && auth.biometricAvailable && (
              <button
                type="button"
                className="btn primary block btn-with-icon"
                disabled={busy}
                onClick={() => void onBio()}
              >
                <FingerprintIcon />
                <span>Unlock with fingerprint</span>
              </button>
            )}
            <form onSubmit={(e) => void onSubmit(e)}>
              <label>
                {auth.initialized ? 'Recovery PIN' : 'Create recovery PIN'}
                <input
                  type="password"
                  inputMode="numeric"
                  autoComplete="current-password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  minLength={4}
                  required
                  placeholder="••••"
                />
              </label>
              {error && <div className="banner danger">{error}</div>}
              <button type="submit" className="btn primary block btn-with-icon" disabled={busy || pin.length < 4}>
                {auth.initialized ? <LockIcon /> : <ArrowRightIcon />}
                <span>{auth.initialized ? 'Unlock' : 'Get started'}</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
