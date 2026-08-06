import { useEffect, useState, type FormEvent } from 'react'
import type { AccountMeta, ExchangeId } from '../domain/types'
import { deleteAccountMeta, listAccounts, upsertAccount } from '../storage/cache'
import { deleteCredentials, saveCredentials } from '../storage/vault'
import { getExchange } from '../exchanges/registry'
import { useOnline } from '../app/OnlineContext'
import { Toast } from '../components/Toast'
import { Capacitor } from '@capacitor/core'

function isUnreachableFromBrowser(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase()
  return (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network error') ||
    msg.includes('cors') ||
    msg.includes('load failed') ||
    msg.includes('access control')
  )
}

export function AccountsScreen() {
  const online = useOnline()
  const [accounts, setAccounts] = useState<AccountMeta[]>([])
  const [alias, setAlias] = useState('')
  const [exchange, setExchange] = useState<ExchangeId>('binance')
  const [apiKey, setApiKey] = useState('')
  const [secretKey, setSecretKey] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [showForm, setShowForm] = useState(false)

  async function reload() {
    setAccounts(await listAccounts())
  }

  useEffect(() => {
    void reload()
  }, [])

  async function onAdd(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setFormError(null)
    try {
      const creds = {
        apiKey: apiKey.trim(),
        secretKey: secretKey.trim(),
        passphrase: exchange === 'okx' ? passphrase.trim() : undefined,
      }
      if (!creds.apiKey || !creds.secretKey) {
        throw new Error('API key and secret are required')
      }
      if (exchange === 'okx' && !creds.passphrase) {
        throw new Error('OKX passphrase is required')
      }

      let validated = false
      if (online) {
        try {
          await getExchange(exchange).validateCredentials(creds)
          validated = true
        } catch (err) {
          if (isUnreachableFromBrowser(err) || !Capacitor.isNativePlatform()) {
            validated = false
          } else {
            throw err
          }
        }
      }

      const id = crypto.randomUUID()
      const meta: AccountMeta = {
        id,
        alias: alias.trim() || `${exchange} account`,
        exchange,
        createdAt: Date.now(),
      }
      await saveCredentials(id, creds)
      await upsertAccount(meta)
      setAlias('')
      setApiKey('')
      setSecretKey('')
      setPassphrase('')
      setShowForm(false)
      await reload()
      if (validated) {
        setToast('Account saved and verified with the exchange')
      } else if (online) {
        setToast('Account saved on this device (browser cannot verify keys — use Android app or Refresh later)')
      } else {
        setToast('Account saved (offline — not verified yet)')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add account'
      setFormError(message)
      setToast(message)
    } finally {
      setBusy(false)
    }
  }

  async function onDelete(id: string) {
    if (!confirm('Delete this account from the device?')) return
    await deleteCredentials(id)
    await deleteAccountMeta(id)
    await reload()
  }

  return (
    <div className="mobile-page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Wallet</p>
          <h2>Accounts</h2>
        </div>
        <button type="button" className="btn primary btn-compact" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Close' : '+ Add'}
        </button>
      </div>
      <p className="muted tight">API keys stay encrypted on this device.</p>

      <div className="asset-list">
        {accounts.map((a) => (
          <div key={a.id} className="asset-row">
            <div className={`asset-avatar ${a.exchange}`}>{a.exchange === 'binance' ? 'B' : 'O'}</div>
            <div className="asset-main">
              <strong>{a.alias}</strong>
              <span>{a.exchange === 'binance' ? 'Binance Spot' : 'OKX Spot'}</span>
            </div>
            <button type="button" className="btn danger btn-compact" onClick={() => void onDelete(a.id)}>
              Delete
            </button>
          </div>
        ))}
        {accounts.length === 0 && !showForm && (
          <div className="empty-card">No accounts yet. Tap + Add to connect Binance or OKX.</div>
        )}
      </div>

      {showForm && (
        <form className="panel" onSubmit={(e) => void onAdd(e)}>
          <h3>Add account</h3>
          <label>
            Alias
            <input value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="Main Binance" />
          </label>
          <div className="side-toggle">
            <button
              type="button"
              className={`side-btn ${exchange === 'binance' ? 'active' : ''}`}
              onClick={() => setExchange('binance')}
            >
              Binance
            </button>
            <button
              type="button"
              className={`side-btn ${exchange === 'okx' ? 'active' : ''}`}
              onClick={() => setExchange('okx')}
            >
              OKX
            </button>
          </div>
          <label>
            API key
            <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} required autoComplete="off" />
          </label>
          <label>
            Secret key
            <input value={secretKey} onChange={(e) => setSecretKey(e.target.value)} required autoComplete="off" />
          </label>
          {exchange === 'okx' && (
            <label>
              Passphrase
              <input value={passphrase} onChange={(e) => setPassphrase(e.target.value)} required autoComplete="off" />
            </label>
          )}
          {formError && <div className="banner danger">{formError}</div>}
          <button type="submit" className="btn primary block" disabled={busy}>
            {busy ? 'Saving…' : 'Save account'}
          </button>
        </form>
      )}
      <Toast message={toast} onClose={() => setToast(null)} />
    </div>
  )
}
