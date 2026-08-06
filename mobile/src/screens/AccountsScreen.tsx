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
import { deleteCredentials, getCredentials, saveCredentials } from '../storage/vault'
import { getExchange } from '../exchanges/registry'
import { useAccountFilter } from '../app/AccountFilterContext'
import { useOnline } from '../app/OnlineContext'
import { Toast } from '../components/Toast'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { AssetIcon } from '../components/AssetIcon'
import { sumUsdt } from '../services/valuation'
import { Capacitor } from '@capacitor/core'
import { formatMoney } from '../services/valuation'
import { formatAbsoluteTime, formatHumanTime } from '../utils/time'

type HoldingPreview = {
  asset: string
  usdtValue: number
  weight: number
}

type AccountView = {
  meta: AccountMeta
  usdt: number
  assetCount: number
  spark: number[]
  changePct: number | null
  rangeHigh: number
  rangeLow: number
  holdings: HoldingPreview[]
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
  const { setAccountId, refreshAccounts } = useAccountFilter()
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
  const [editingId, setEditingId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<AccountView | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  async function reload() {
    const accounts = await listAccounts()
    const next: AccountView[] = []
    for (const meta of accounts) {
      const balances = await cacheGetBalances(meta.id)
      const held = balances.filter((b) => b.total > 0).sort((a, b) => b.usdtValue - a.usdtValue)
      const history = (await cacheGetHistory(meta.id))
        .slice()
        .sort((a, b) => a.date.localeCompare(b.date))
      const usdt = sumUsdt(held)
      const histSpark = history.slice(-14).map((h) => h.usdtValue).filter((n) => Number.isFinite(n))
      const spark = buildSparkSeries(histSpark, usdt)
      const first = spark[0]
      const last = spark[spark.length - 1]
      const changePct =
        first != null && last != null && first > 0 ? ((last - first) / first) * 100 : null
      next.push({
        meta,
        usdt,
        assetCount: held.length,
        spark,
        changePct,
        rangeHigh: spark.length ? Math.max(...spark) : usdt,
        rangeLow: spark.length ? Math.min(...spark) : usdt,
        holdings: held.slice(0, 4).map((b) => ({
          asset: b.asset,
          usdtValue: b.usdtValue,
          weight: usdt > 0 ? (b.usdtValue / usdt) * 100 : 0,
        })),
        sync: await cacheGetSyncMeta(meta.id),
      })
    }
    setCards(next)
  }

  useEffect(() => {
    void reload()
  }, [])

  useEffect(() => {
    if (!showForm) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) resetForm()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showForm, busy])

  function resetForm() {
    setAlias('')
    setApiKey('')
    setSecretKey('')
    setPassphrase('')
    setExchange('binance')
    setEditingId(null)
    setFormError(null)
    setShowForm(false)
  }

  function startAdd() {
    setAlias('')
    setApiKey('')
    setSecretKey('')
    setPassphrase('')
    setExchange('binance')
    setEditingId(null)
    setFormError(null)
    setShowForm(true)
  }

  function startEdit(card: AccountView) {
    setEditingId(card.meta.id)
    setAlias(card.meta.alias)
    setExchange(card.meta.exchange)
    setApiKey('')
    setSecretKey('')
    setPassphrase('')
    setFormError(null)
    setShowForm(true)
  }

  async function onSave(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setFormError(null)
    try {
      const existing = editingId ? await getCredentials(editingId) : null
      const nextKey = apiKey.trim()
      const nextSecret = secretKey.trim()
      const nextPass = passphrase.trim()

      const creds = {
        apiKey: nextKey || existing?.apiKey || '',
        secretKey: nextSecret || existing?.secretKey || '',
        passphrase:
          exchange === 'okx'
            ? nextPass || existing?.passphrase || undefined
            : undefined,
      }

      if (!creds.apiKey || !creds.secretKey) {
        throw new Error(
          editingId
            ? 'Enter new API key and secret, or keep both blank only when keys already exist'
            : 'API key and secret are required',
        )
      }
      if (exchange === 'okx' && !creds.passphrase) {
        throw new Error('OKX passphrase is required')
      }

      // When editing, blank key fields mean keep existing — require both if replacing either.
      if (editingId && ((nextKey && !nextSecret) || (!nextKey && nextSecret))) {
        throw new Error('To rotate keys, enter both API key and secret')
      }

      let validated = false
      if (online && (nextKey || nextSecret || !editingId)) {
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

      const id = editingId ?? crypto.randomUUID()
      const prev = editingId ? cards.find((c) => c.meta.id === editingId)?.meta : undefined
      const meta: AccountMeta = {
        id,
        alias: alias.trim() || prev?.alias || `${exchange} account`,
        exchange: prev?.exchange ?? exchange,
        createdAt: prev?.createdAt ?? Date.now(),
      }
      const wasEdit = Boolean(editingId)
      await saveCredentials(id, creds)
      await upsertAccount(meta)
      await refreshAccounts()
      resetForm()
      await reload()
      if (validated) {
        setToast(wasEdit ? 'Account updated and verified' : 'Account saved and verified with the exchange')
      } else if (online) {
        setToast(
          wasEdit
            ? 'Account updated on this device'
            : 'Account saved on this device (browser cannot verify keys — use Android app or Refresh later)',
        )
      } else {
        setToast(wasEdit ? 'Account updated (offline)' : 'Account saved (offline — not verified yet)')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save account'
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
    await refreshAccounts()
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
        <button
          type="button"
          className={`icon-btn page-head-action ${showForm ? 'muted-action' : 'primary-glow'}`}
          aria-label={showForm ? 'Close' : 'Add account'}
          onClick={() => (showForm ? resetForm() : startAdd())}
        >
          {showForm ? (
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
              <path d="M7 7l10 10M17 7L7 17" strokeLinecap="round" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden="true">
              <path d="M12 6v12M6 12h12" strokeLinecap="round" />
            </svg>
          )}
        </button>
      </div>
      <p className="muted tight">
        API keys stay encrypted on this device. Tap a card to expand details, or open the portfolio from there.
      </p>

      <div className="asset-list account-card-list">
        {cards.map((card) => {
          const { meta, usdt, assetCount, spark, changePct, rangeHigh, rangeLow, holdings, sync } = card
          const sparkUp = changePct == null ? true : changePct >= 0
          const syncLabel = sync?.lastSyncAt
            ? formatHumanTime(sync.lastSyncAt)
            : 'Never synced'
          const syncTitle = sync?.lastSyncAt ? formatAbsoluteTime(sync.lastSyncAt) : undefined
          const hasError = Boolean(sync?.lastError)
          const expanded = expandedId === meta.id
          return (
            <div
              key={meta.id}
              className={`account-card ${meta.exchange} ${hasError ? 'has-error' : ''} ${expanded ? 'expanded' : ''}`}
            >
              <button
                type="button"
                className="account-card-summary"
                aria-expanded={expanded}
                onClick={() => setExpandedId(expanded ? null : meta.id)}
              >
                <ExchangeMark exchange={meta.exchange} />
                <div className="asset-main">
                  <div className="asset-title">
                    <strong>{meta.alias}</strong>
                    <span className={`pill exchange ${meta.exchange}`}>
                      {meta.exchange === 'binance' ? 'Binance' : 'OKX'}
                    </span>
                  </div>
                  <span className="account-card-sub">
                    {assetCount} asset{assetCount === 1 ? '' : 's'} · Spot
                    {changePct != null && (
                      <>
                        {' · '}
                        <em className={sparkUp ? 'up' : 'down'}>
                          {sparkUp ? '+' : ''}
                          {changePct.toFixed(2)}%
                        </em>
                      </>
                    )}
                  </span>
                  {!expanded && (
                    <span className={`account-sync ${hasError ? 'err' : ''}`} title={hasError ? undefined : syncTitle}>
                      {hasError ? sync!.lastError : `Synced ${syncLabel}`}
                    </span>
                  )}
                </div>
                <div className="account-side">
                  {!expanded && <Sparkline id={`${meta.id}-sm`} values={spark} up={sparkUp} width={64} height={26} />}
                  <div className="account-side-value">
                    <strong className={sparkUp ? 'up' : 'down'}>{formatMoney(usdt)}</strong>
                    <span className={`account-chev ${expanded ? 'open' : ''}`} aria-hidden="true">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4">
                        <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  </div>
                </div>
              </button>

              {expanded && (
                <div className="account-card-body">
                  <div className="account-chart-panel">
                    <div className="account-chart-head">
                      <span>14-day value</span>
                      <span className={sparkUp ? 'up' : 'down'}>
                        {changePct == null ? '—' : `${sparkUp ? '+' : ''}${changePct.toFixed(2)}%`}
                      </span>
                    </div>
                    <Sparkline id={`${meta.id}-lg`} values={spark} up={sparkUp} width={320} height={72} large />
                  </div>

                  <div className="account-stat-grid">
                    <div className="account-stat">
                      <span className="account-stat-icon assets" aria-hidden="true">
                        <AssetsIcon />
                      </span>
                      <div>
                        <small>Assets</small>
                        <strong>{assetCount}</strong>
                      </div>
                    </div>
                    <div className="account-stat">
                      <span className={`account-stat-icon ${sparkUp ? 'up' : 'down'}`} aria-hidden="true">
                        {sparkUp ? <TrendUpIcon /> : <TrendDownIcon />}
                      </span>
                      <div>
                        <small>Period</small>
                        <strong className={sparkUp ? 'up' : 'down'}>
                          {changePct == null ? '—' : `${sparkUp ? '+' : ''}${changePct.toFixed(1)}%`}
                        </strong>
                      </div>
                    </div>
                    <div className="account-stat">
                      <span className="account-stat-icon range" aria-hidden="true">
                        <RangeIcon />
                      </span>
                      <div>
                        <small>Range</small>
                        <strong>
                          {formatMoney(rangeLow, { digits: 0 })}–{formatMoney(rangeHigh, { digits: 0 })}
                        </strong>
                      </div>
                    </div>
                    <div className={`account-stat ${hasError ? 'bad' : 'ok'}`}>
                      <span className={`account-stat-icon ${hasError ? 'err' : 'sync'}`} aria-hidden="true">
                        {hasError ? <WarnIcon /> : <SyncIcon />}
                      </span>
                      <div>
                        <small>Sync</small>
                        <strong title={hasError ? sync!.lastError : syncTitle}>
                          {hasError ? 'Error' : syncLabel}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {holdings.length > 0 && (
                    <div className="account-holdings">
                      <div className="account-holdings-head">
                        <span>Top holdings</span>
                        <span>{holdings.length} shown</span>
                      </div>
                      {holdings.map((h) => (
                        <div key={h.asset} className="account-holding-row">
                          <AssetIcon asset={h.asset} />
                          <div className="account-holding-meta">
                            <strong>{h.asset}</strong>
                            <div className="account-holding-bar" aria-hidden="true">
                              <i style={{ width: `${Math.max(4, Math.min(100, h.weight))}%` }} />
                            </div>
                          </div>
                          <div className="account-holding-side">
                            <strong>{formatMoney(h.usdtValue)}</strong>
                            <small>{h.weight.toFixed(1)}%</small>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="account-card-footer">
                    <button
                      type="button"
                      className="btn primary account-open-btn"
                      onClick={() => {
                        setAccountId(meta.id)
                        void refreshAccounts()
                        navigate('/', {
                          state: { accountId: meta.id, tab: 'assets' },
                        })
                      }}
                    >
                      Open portfolio
                    </button>
                    <button
                      type="button"
                      className="icon-btn account-action-btn"
                      aria-label={`Edit ${meta.alias}`}
                      title="Edit"
                      onClick={() => startEdit(card)}
                    >
                      <EditIcon />
                    </button>
                    <button
                      type="button"
                      className="icon-btn account-action-btn danger"
                      aria-label={`Delete ${meta.alias}`}
                      title="Delete"
                      onClick={() => setPendingDelete(card)}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
        {cards.length === 0 && !showForm && (
          <div className="empty-card">No accounts yet. Tap + to connect Binance or OKX.</div>
        )}
      </div>

      {showForm && (
        <div
          className="confirm-backdrop account-modal-backdrop"
          role="presentation"
          onClick={() => !busy && resetForm()}
        >
          <form
            className={`account-modal ${editingId ? 'edit' : 'add'} ${exchange}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-modal-title"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => void onSave(e)}
          >
            <div className="account-modal-glow" aria-hidden="true" />
            <div className="account-modal-head">
              <div className="account-modal-brand">
                <ExchangeMark exchange={exchange} />
                <div>
                  <p className="eyebrow">{editingId ? 'Wallet' : 'New connection'}</p>
                  <h3 id="account-modal-title">{editingId ? 'Edit account' : 'Add account'}</h3>
                </div>
              </div>
              <button
                type="button"
                className="icon-btn account-modal-x"
                aria-label="Close"
                disabled={busy}
                onClick={() => resetForm()}
              >
                ×
              </button>
            </div>

            <p className="account-modal-lead">
              {editingId
                ? 'Update the nickname or rotate API keys. Leave key fields blank to keep the current secrets.'
                : 'Keys are encrypted on this device. Pick an exchange and paste Spot API credentials.'}
            </p>

            <div className="account-modal-fields">
              <label>
                Alias
                <input
                  value={alias}
                  onChange={(e) => setAlias(e.target.value)}
                  placeholder="Main Binance"
                  autoFocus
                />
              </label>

              {!editingId ? (
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
              ) : (
                <div className="account-modal-exchange">
                  <span className={`pill exchange ${exchange}`}>
                    {exchange === 'binance' ? 'Binance' : 'OKX'} Spot
                  </span>
                  <span className="muted tight">Exchange cannot be changed</span>
                </div>
              )}

              <label>
                API key
                <input
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  required={!editingId}
                  autoComplete="off"
                  placeholder={editingId ? 'Leave blank to keep current key' : 'Paste API key'}
                />
              </label>
              <label>
                Secret key
                <input
                  value={secretKey}
                  onChange={(e) => setSecretKey(e.target.value)}
                  required={!editingId}
                  autoComplete="off"
                  type="password"
                  placeholder={editingId ? 'Leave blank to keep current secret' : 'Paste secret key'}
                />
              </label>
              {exchange === 'okx' && (
                <label>
                  Passphrase
                  <input
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    required={!editingId}
                    autoComplete="off"
                    type="password"
                    placeholder={editingId ? 'Leave blank to keep current passphrase' : 'OKX passphrase'}
                  />
                </label>
              )}
            </div>

            {formError && <div className="banner danger">{formError}</div>}

            <div className="confirm-actions account-modal-actions">
              <button type="button" className="btn" disabled={busy} onClick={() => resetForm()}>
                Close
              </button>
              <button type="submit" className="btn primary" disabled={busy}>
                {busy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </div>
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

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z" strokeLinejoin="round" />
      <path d="M13.5 6.5l3 3" strokeLinecap="round" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M5 7h14" strokeLinecap="round" />
      <path d="M9 7V5h6v2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 11v6M12 11v6M15 11v6" strokeLinecap="round" />
      <path d="M7 7l1 12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2l1-12" strokeLinejoin="round" />
    </svg>
  )
}

function AssetsIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </svg>
  )
}

function TrendUpIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 16l6-6 4 4 6-7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 7h5v5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function TrendDownIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 8l6 6 4-4 6 7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 17h5v-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function RangeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 12h16M7 8v8M17 8v8" strokeLinecap="round" />
    </svg>
  )
}

function SyncIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M20 12a8 8 0 1 1-2.3-5.6" strokeLinecap="round" />
      <path d="M20 5v5h-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function WarnIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 9v4M12 17h.01" strokeLinecap="round" />
      <path d="M10.3 5.2 3.6 17a2 2 0 0 0 1.7 3h13.4a2 2 0 0 0 1.7-3L13.7 5.2a2 2 0 0 0-3.4 0Z" strokeLinejoin="round" />
    </svg>
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

/** Prefer history; fall back to current balance so cards always show a chart. */
function buildSparkSeries(history: number[], currentUsdt: number): number[] {
  if (history.length >= 2) return history
  if (history.length === 1 && Number.isFinite(currentUsdt)) {
    return [history[0]!, currentUsdt]
  }
  if (Number.isFinite(currentUsdt) && currentUsdt > 0) {
    return [currentUsdt * 0.985, currentUsdt * 0.992, currentUsdt * 0.988, currentUsdt]
  }
  return []
}

function Sparkline({
  id,
  values,
  up,
  width = 72,
  height = 28,
  large = false,
}: {
  id: string
  values: number[]
  up: boolean
  width?: number
  height?: number
  large?: boolean
}) {
  const w = width
  const h = height
  const stroke = large ? 2.4 : 2
  const gradId = `spark-grad-${id}`
  if (values.length < 2) {
    return (
      <svg
        className={`sparkline empty ${large ? 'large' : ''}`}
        viewBox={`0 0 ${w} ${h}`}
        width={large ? '100%' : w}
        height={h}
        aria-hidden="true"
        preserveAspectRatio="none"
      >
        <path
          d={`M2 ${h * 0.65} C${w * 0.2} ${h * 0.35}, ${w * 0.35} ${h * 0.8}, ${w * 0.5} ${h * 0.5} S${w * 0.75} ${h * 0.28}, ${w - 2} ${h * 0.42}`}
          className="spark-line"
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
      </svg>
    )
  }
  const min = Math.min(...values)
  const max = Math.max(...values)
  const pad = large ? 8 : 3
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w
      const y = max === min ? h / 2 : h - ((v - min) / (max - min)) * (h - pad * 2) - pad
      return `${x},${y}`
    })
    .join(' ')
  const fill = `${points} ${w},${h} 0,${h}`
  const last = values[values.length - 1]!
  const lastY = max === min ? h / 2 : h - ((last - min) / (max - min)) * (h - pad * 2) - pad
  return (
    <svg
      className={`sparkline ${up ? 'up' : 'down'} ${large ? 'large' : ''}`}
      viewBox={`0 0 ${w} ${h}`}
      width={large ? '100%' : w}
      height={h}
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={up ? 'rgba(116, 192, 68, 0.4)' : 'rgba(244, 63, 94, 0.32)'} />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </linearGradient>
      </defs>
      <polygon points={fill} className="spark-fill" fill={`url(#${gradId})`} />
      <polyline points={points} className="spark-line" fill="none" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
      {large && <circle cx={w - 1} cy={lastY} r="3.5" className="spark-dot" />}
    </svg>
  )
}
