import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../app/AuthContext'

export function UnlockScreen() {
  const auth = useAuth()
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!auth.ready) return <div className="unlock muted">Loading…</div>
  if (auth.unlocked) return <Navigate to="/" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (!auth.initialized) await auth.setupPin(pin)
      else await auth.unlockPin(pin)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unlock failed')
    } finally {
      setBusy(false)
    }
  }

  async function onBio() {
    setBusy(true)
    setError(null)
    const ok = await auth.unlockBiometric()
    if (!ok) setError('Fingerprint failed — use recovery PIN')
    setBusy(false)
  }

  return (
    <div className="unlock">
      <div className="panel unlock-card">
        <h1 className="brand">
          My<span>Exchanges</span>
        </h1>
        <p className="muted">
          {auth.initialized
            ? 'Unlock with fingerprint or recovery PIN. Data stays on this device.'
            : 'Create a recovery PIN (used if biometrics are unavailable), then unlock with fingerprint next time.'}
        </p>
        {auth.initialized && auth.biometricAvailable && (
          <button className="btn primary" style={{ width: '100%', marginBottom: 12 }} disabled={busy} onClick={() => void onBio()}>
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
