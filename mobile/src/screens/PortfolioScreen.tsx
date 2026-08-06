import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AccountMeta, BalanceRow } from '../domain/types'
import { cacheGetBalances, cacheGetSyncMeta, getSettings, listAccounts } from '../storage/cache'
import { syncAll } from '../services/sync'
import { sumBtc, sumUsdt } from '../services/valuation'
import { useOnline } from '../app/OnlineContext'
import { Toast } from '../components/Toast'

export function PortfolioScreen() {
  const online = useOnline()
  const [accounts, setAccounts] = useState<AccountMeta[]>([])
  const [accountId, setAccountId] = useState<string>('all')
  const [rows, setRows] = useState<BalanceRow[]>([])
  const [q, setQ] = useState('')
  const [dust, setDust] = useState(3)
  const [lastSync, setLastSync] = useState<string>('Never')
  const [syncError, setSyncError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const accs = await listAccounts()
    setAccounts(accs)
    const settings = await getSettings()
    setDust(settings.dustUsdt)

    const ids = accountId === 'all' ? accs.map((a) => a.id) : [accountId]
    const all: BalanceRow[] = []
    let latest = 0
    const errors: string[] = []
    for (const id of ids) {
      all.push(...(await cacheGetBalances(id)))
      const meta = await cacheGetSyncMeta(id)
      if (meta?.lastSyncAt && meta.lastSyncAt > latest) latest = meta.lastSyncAt
      if (meta?.lastError) {
        const alias = accs.find((a) => a.id === id)?.alias ?? id
        errors.push(`${alias}: ${meta.lastError}`)
      }
    }
    const map = new Map<string, BalanceRow>()
    for (const b of all) {
      const prev = map.get(b.asset)
      if (!prev) map.set(b.asset, { ...b })
      else {
        map.set(b.asset, {
          ...prev,
          free: prev.free + b.free,
          locked: prev.locked + b.locked,
          total: prev.total + b.total,
          usdtValue: prev.usdtValue + b.usdtValue,
          btcValue: prev.btcValue + b.btcValue,
        })
      }
    }
    setRows([...map.values()].sort((a, b) => b.usdtValue - a.usdtValue))
    setLastSync(latest ? new Date(latest).toLocaleString() : 'Never')
    setSyncError(errors.length ? errors.join(' · ') : null)
  }, [accountId])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (r.total <= 0) return false
        if (q && !r.asset.toLowerCase().includes(q.toLowerCase())) return false
        if (r.usdtValue > 0 && r.usdtValue < dust) return false
        return true
      }),
    [rows, dust, q],
  )

  async function refresh() {
    if (!online) return
    setBusy(true)
    setSyncError(null)
    try {
      const errors = await syncAll()
      await load()
      if (errors.length) {
        setSyncError(errors.join(' · '))
        setToast(errors.join('; '))
      } else {
        setToast('Portfolio synced')
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Sync failed'
      setSyncError(msg)
      setToast(msg)
    } finally {
      setBusy(false)
    }
  }

  const total = sumUsdt(filtered)
  const btc = sumBtc(filtered)

  return (
    <div className="mobile-page">
      <section className="balance-hero">
        <div className="balance-hero-top">
          <div>
            <p className="eyebrow light">Total balance</p>
            <div className="hero-total light">${total.toFixed(2)}</div>
            <p className="hero-sub light">{btc.toFixed(6)} BTC</p>
          </div>
          <button type="button" className="fab-refresh" disabled={!online || busy} onClick={() => void refresh()}>
            {busy ? '…' : '↻'}
          </button>
        </div>
        <p className="hero-meta">Synced {lastSync}</p>
      </section>

      {syncError && <div className="banner danger">{syncError}</div>}

      <div className="section-head">
        <h3>Assets</h3>
      </div>

      <div className="chip-row">
        <select className="chip-select" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          <option value="all">All accounts</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.alias}
            </option>
          ))}
        </select>
        <input
          className="search-pill"
          placeholder="Search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="asset-list">
        {filtered.map((r) => (
          <div key={r.asset} className="asset-row">
            <div className="asset-avatar">{r.asset.slice(0, 1)}</div>
            <div className="asset-main">
              <strong>{r.asset}</strong>
              <span>
                {r.total} · free {r.free}
              </span>
            </div>
            <div className="asset-values">
              <strong>${r.usdtValue.toFixed(2)}</strong>
              <span className={r.usdtValue >= 0 ? 'up' : 'down'}>{r.btcValue.toFixed(6)} BTC</span>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="empty-card">
            {accounts.length === 0
              ? 'Add an account in Wallet, then pull to refresh.'
              : 'No balances yet. Tap refresh on the balance card.'}
          </div>
        )}
      </div>

      <Toast message={toast} onClose={() => setToast(null)} />
    </div>
  )
}
