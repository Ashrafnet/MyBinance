import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import type { AccountMeta, ExchangeId, SyncMeta } from '../domain/types'
import {
  cacheGetBalances,
  cacheGetHistory,
  cacheGetSyncMeta,
  deleteAccountMeta,
  listAccounts,
  upsertAccount,
} from '../storage/cache'
import { deleteCredentials, saveCredentials } from '../storage/vault'
import { getExchange } from '../exchanges/registry'
import { useOnline } from '../app/OnlineContext'
import { Toast } from '../components/Toast'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { sumUsdt } from '../services/valuation'
import { Capacitor } from '@capacitor/core'
import { formatMoney } from '../services/valuation'
import { formatAbsoluteTime, formatHumanTime } from '../utils/time'

type AccountView = {
  meta: AccountMeta
  usdt: number
  assetCount: number
  spark: number[]
  sync: SyncMeta | undefined
}

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
  const navigate = useNavigate()
  const [cards, setCards] = useState<AccountView[]>([])
  const [alias, setAlias] = useState('')
  const [exchange, setExchange] = useState<ExchangeId>('binance')
  const [apiKey, setApiKey] = useState('')
  const [secretKey, setSecretKey] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<AccountView | null>(null)

  async function reload() {
    const accounts = await listAccounts()
    const next: AccountView[] = []
    for (const meta of accounts) {
      const balances = await cacheGetBalances(meta.id)
      const held = balances.filter((b) => b.total > 0)
      const history = (await cacheGetHistory(meta.id))
        .slice()
        .sort((a, b) => a.date.localeCompare(b.date))
      next.push({
        meta,
        usdt: sumUsdt(held),
        assetCount: held.length,
        spark: history.slice(-14).map((h) => h.usdtValue),
        sync: await cacheGetSyncMeta(meta.id),
      })
    }
    setCards(next)
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

  async function confirmDelete() {
    if (!pendingDelete) return
    await deleteCredentials(pendingDelete.meta.id)
    await deleteAccountMeta(pendingDelete.meta.id)
    setPendingDelete(null)
    await reload()
    setToast('Account removed from this device')
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
      <p className="muted tight">API keys stay encrypted on this device. Tap an account to open its portfolio.</p>

      <div className="asset-list">
        {cards.map((card) => {
          const { meta, usdt, assetCount, spark, sync } = card
          const sparkUp = spark.length >= 2 ? spark[spark.length - 1]! >= spark[0]! : true
          const syncLabel = sync?.lastSyncAt
            ? formatHumanTime(sync.lastSyncAt)
            : 'Never synced'
          const syncTitle = sync?.lastSyncAt ? formatAbsoluteTime(sync.lastSyncAt) : undefined
          const hasError = Boolean(sync?.lastError)
          return (
            <div key={meta.id} className={`account-card ${meta.exchange} ${hasError ? 'has-error' : ''}`}>
              <button
                type="button"
                className="account-link"
                onClick={() =>
                  navigate('/', {
                    state: { accountId: meta.id, tab: 'assets' },
                  })
                }
              >
                <ExchangeMark exchange={meta.exchange} />
                <div className="asset-main">
                  <div className="asset-title">
                    <strong>{meta.alias}</strong>
                    <span className={`pill exchange ${meta.exchange}`}>
                      {meta.exchange === 'binance' ? 'Binance' : 'OKX'}
                    </span>
                  </div>
                  <span>
                    {assetCount} asset{assetCount === 1 ? '' : 's'} · Spot
                  </span>
                  <span className={`account-sync ${hasError ? 'err' : ''}`} title={hasError ? undefined : syncTitle}>
                    {hasError ? sync!.lastError : `Synced ${syncLabel}`}
                  </span>
                </div>
                <div className="account-side">
                  <Sparkline values={spark} up={sparkUp} />
                  <strong className={sparkUp ? 'up' : 'down'}>{formatMoney(usdt)}</strong>
                </div>
              </button>
              <button
                type="button"
                className="btn danger btn-compact"
                onClick={() => setPendingDelete(card)}
              >
                Delete
              </button>
            </div>
          )
        })}
        {cards.length === 0 && !showForm && (
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
              className={`side-btn exchange-pick binance ${exchange === 'binance' ? 'active' : ''}`}
              onClick={() => setExchange('binance')}
            >
              <ExchangeMark exchange="binance" compact />
              Binance
            </button>
            <button
              type="button"
              className={`side-btn exchange-pick okx ${exchange === 'okx' ? 'active' : ''}`}
              onClick={() => setExchange('okx')}
            >
              <ExchangeMark exchange="okx" compact />
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

      <ConfirmDialog
        open={pendingDelete != null}
        title="Delete this account?"
        message="Removes encrypted keys and cached data for this account from the device. Exchange balances are unchanged."
        detail={pendingDelete ? `${pendingDelete.meta.alias} · ${pendingDelete.meta.exchange}` : undefined}
        confirmLabel="Delete"
        cancelLabel="Keep"
        danger
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />

      <Toast message={toast} onClose={() => setToast(null)} />
    </div>
  )
}

function ExchangeMark({ exchange, compact }: { exchange: ExchangeId; compact?: boolean }) {
  const size = compact ? 18 : 40
  if (exchange === 'binance') {
    return (
      <div className={`exchange-mark binance ${compact ? 'compact' : ''}`} aria-hidden="true">
        <svg viewBox="0 0 24 24" width={size * 0.55} height={size * 0.55}>
          <path
            fill="currentColor"
            d="M12 2.2 9.1 5.1l2.9 2.9 2.9-2.9L12 2.2Zm0 5.8L6.2 13.8 12 19.6l5.8-5.8L12 8Zm-7.2 1.4L2.2 12l2.6 2.6L7.4 12 4.8 9.4Zm14.4 0L16.6 12l2.6 2.6L21.8 12l-2.6-2.6ZM9.1 16.9 12 19.8l2.9-2.9-2.9-2.9-2.9 2.9Z"
          />
        </svg>
      </div>
    )
  }
  return (
    <div className={`exchange-mark okx ${compact ? 'compact' : ''}`} aria-hidden="true">
      <svg viewBox="0 0 24 24" width={size * 0.5} height={size * 0.5}>
        <rect x="3" y="3" width="7" height="7" rx="1.2" fill="currentColor" />
        <rect x="14" y="3" width="7" height="7" rx="1.2" fill="currentColor" />
        <rect x="3" y="14" width="7" height="7" rx="1.2" fill="currentColor" />
        <rect x="14" y="14" width="7" height="7" rx="1.2" fill="currentColor" opacity="0.35" />
      </svg>
    </div>
  )
}

function Sparkline({ values, up }: { values: number[]; up: boolean }) {
  if (values.length < 2) {
    return <div className="sparkline empty" aria-hidden="true" />
  }
  const min = Math.min(...values)
  const max = Math.max(...values)
  const w = 72
  const h = 28
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w
      const y = max === min ? h / 2 : h - ((v - min) / (max - min)) * (h - 6) - 3
      return `${x},${y}`
    })
    .join(' ')
  const fill = `${points} ${w},${h} 0,${h}`
  return (
    <svg className={`sparkline ${up ? 'up' : 'down'}`} viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-hidden="true">
      <polygon points={fill} className="spark-fill" />
      <polyline points={points} className="spark-line" fill="none" strokeWidth="2" />
    </svg>
  )
}
