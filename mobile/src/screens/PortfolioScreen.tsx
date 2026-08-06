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
        // Keep unpriced balances visible; only hide known dust.
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

  return (
    <div>
      <div className="page-head">
        <div>
          <p className="eyebrow">Balances</p>
          <h2>Portfolio</h2>
        </div>
        <button type="button" className="btn primary" disabled={!online || busy} onClick={() => void refresh()}>
          {busy ? 'Syncing…' : 'Refresh'}
        </button>
      </div>
      <div className="hero-total">${sumUsdt(filtered).toFixed(2)}</div>
      <p className="hero-sub" style={{ marginBottom: 14 }}>
        {sumBtc(filtered).toFixed(6)} BTC · synced {lastSync}
      </p>
      {syncError && <div className="banner danger">{syncError}</div>}
      <div className="row filters">
        <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          <option value="all">All accounts</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.alias} ({a.exchange})
            </option>
          ))}
        </select>
        <input
          className="grow"
          placeholder="Search asset"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <div className="panel balance-shell">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Asset</th>
                <th>Total</th>
                <th>Free</th>
                <th>USDT</th>
                <th>BTC</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.asset}>
                  <td>{r.asset}</td>
                  <td>{r.total}</td>
                  <td>{r.free}</td>
                  <td>${r.usdtValue.toFixed(2)}</td>
                  <td>{r.btcValue.toFixed(6)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="muted" style={{ padding: '8px 10px 16px' }}>
              {accounts.length === 0
                ? 'No balances yet. Add an account under Keys, then tap Refresh while online.'
                : 'No balances loaded. Tap Refresh while online to pull from the exchange.'}
            </p>
          )}
        </div>
      </div>
      <Toast message={toast} onClose={() => setToast(null)} />
    </div>
  )
}
