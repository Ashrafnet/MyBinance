import { useEffect, useState, type FormEvent } from 'react'
import type { AccountMeta, ExchangeId } from '../domain/types'
import { deleteAccountMeta, listAccounts, upsertAccount } from '../storage/cache'
import { deleteCredentials, saveCredentials } from '../storage/vault'
import { getExchange } from '../exchanges/registry'
import { useOnline } from '../app/OnlineContext'
import { Toast } from '../components/Toast'

export function AccountsScreen() {
  const online = useOnline()
  const [accounts, setAccounts] = useState<AccountMeta[]>([])
  const [alias, setAlias] = useState('')
  const [exchange, setExchange] = useState<ExchangeId>('binance')
  const [apiKey, setApiKey] = useState('')
  const [secretKey, setSecretKey] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function reload() {
    setAccounts(await listAccounts())
  }

  useEffect(() => {
    void reload()
  }, [])

  async function onAdd(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      const creds = { apiKey, secretKey, passphrase: exchange === 'okx' ? passphrase : undefined }
      if (online) {
        await getExchange(exchange).validateCredentials(creds)
      }
      const id = crypto.randomUUID()
      const meta: AccountMeta = { id, alias: alias || `${exchange} account`, exchange, createdAt: Date.now() }
      await saveCredentials(id, creds)
      await upsertAccount(meta)
      setAlias('')
      setApiKey('')
      setSecretKey('')
      setPassphrase('')
      await reload()
      setToast(online ? 'Account saved and validated' : 'Account saved (not validated offline)')
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Failed to add account')
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
    <div>
      <h2>Accounts</h2>
      <p className="muted">Manage Binance and OKX Spot API keys. Secrets stay encrypted on this device.</p>

      <div className="panel">
        <h3>Your accounts</h3>
        {accounts.length === 0 && <p className="muted">No accounts yet.</p>}
        {accounts.map((a) => (
          <div key={a.id} className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
            <div>
              <strong>{a.alias}</strong>
              <div className="muted">{a.exchange}</div>
            </div>
            <button className="btn danger" onClick={() => void onDelete(a.id)}>
              Delete
            </button>
          </div>
        ))}
      </div>

      <form className="panel" onSubmit={(e) => void onAdd(e)}>
        <h3>Add account</h3>
        <label>
          Alias
          <input value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="Main Binance" />
        </label>
        <label>
          Exchange
          <select value={exchange} onChange={(e) => setExchange(e.target.value as ExchangeId)}>
            <option value="binance">Binance Spot</option>
            <option value="okx">OKX Spot</option>
          </select>
        </label>
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
        <button className="btn primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save account'}
        </button>
      </form>
      <Toast message={toast} onClose={() => setToast(null)} />
    </div>
  )
}
