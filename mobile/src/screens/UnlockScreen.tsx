import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../app/AuthContext'

export function UnlockScreen() {
  const auth = useAuth()
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

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
      <div className="unlock" style={{ width: '100%', maxWidth: 430, minHeight: '100%' }}>
        <div className="unlock-card">
          <p className="eyebrow">Spot trading</p>
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
          {auth.initialized && auth.biometricAvailable && (
            <button
              type="button"
              className="btn primary block"
              style={{ marginBottom: 10 }}
              disabled={busy}
              onClick={() => void onBio()}
            >
              Unlock with fingerprint
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
            <button type="submit" className="btn primary block" disabled={busy || pin.length < 4}>
              {auth.initialized ? 'Unlock' : 'Get started'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
