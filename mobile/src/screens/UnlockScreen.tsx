import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../app/AuthContext'

export function UnlockScreen() {
  const auth = useAuth()
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!auth.ready) return <div className="unlock muted">Opening vault…</div>
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
    if (!ok) setError('Fingerprint did not match. Use your recovery PIN.')
    setBusy(false)
  }

  return (
    <div className="unlock">
      <div className="panel unlock-card">
        <p className="eyebrow">On-device Spot desk</p>
        <h1 className="brand">
          My<span>Exchanges</span>
        </h1>
        <p className="unlock-lead">
          {auth.initialized
            ? 'Open your Binance and OKX balances. Keys never leave this device.'
            : 'Set a recovery PIN, then use fingerprint next time. Nothing is stored in the cloud.'}
        </p>
        <div className="unlock-meta">
          <span className="stamp hot">Binance</span>
          <span className="stamp hot">OKX</span>
          <span className="stamp">Offline-first</span>
        </div>
        {auth.initialized && auth.biometricAvailable && (
          <button
            className="btn primary"
            style={{ width: '100%', marginBottom: 12 }}
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
            />
          </label>
          {error && <div className="banner danger">{error}</div>}
          <button className="btn primary" style={{ width: '100%' }} disabled={busy || pin.length < 4}>
            {auth.initialized ? 'Unlock with PIN' : 'Create vault'}
          </button>
        </form>
      </div>
    </div>
  )
}
