import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../app/AuthContext'

export function UnlockScreen() {
  const auth = useAuth()
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!auth.ready) return <div className="unlock muted">Preparing your desk…</div>
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
    <div className="unlock">
      <div className="unlock-card">
        <p className="eyebrow">Crypto trading desk</p>
        <h1 className="brand">
          My<span>Exchanges</span>
        </h1>
        <p className="unlock-lead">
          {auth.initialized
            ? 'Track Binance and OKX Spot balances, orders, and markets — encrypted on this device.'
            : 'Create a recovery PIN to protect your API keys. Next time, unlock with fingerprint.'}
        </p>
        <div className="unlock-meta">
          <span className="stamp hot">Binance</span>
          <span className="stamp hot">OKX</span>
          <span className="stamp">Works offline</span>
        </div>
        {auth.initialized && auth.biometricAvailable && (
          <button
            type="button"
            className="btn primary block"
            style={{ marginBottom: 12 }}
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
            {auth.initialized ? 'Unlock with PIN' : 'Create vault'}
          </button>
        </form>
      </div>
    </div>
  )
}
