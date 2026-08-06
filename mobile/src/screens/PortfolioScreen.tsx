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
  const [lastSync, setLastSync] = useState<string>('—')
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
    for (const id of ids) {
      all.push(...(await cacheGetBalances(id)))
      const meta = await cacheGetSyncMeta(id)
      if (meta?.lastSyncAt && meta.lastSyncAt > latest) latest = meta.lastSyncAt
    }
    // merge same assets when all
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
  }, [accountId])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) => r.usdtValue >= dust && (!q || r.asset.toLowerCase().includes(q.toLowerCase())),
      ),
    [rows, dust, q],
  )

  async function refresh() {
    if (!online) return
    setBusy(true)
    try {
      const errors = await syncAll()
      await load()
      setToast(errors.length ? errors.join('; ') : 'Synced')
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Sync failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2>Portfolio</h2>
        <button className="btn primary" disabled={!online || busy} onClick={() => void refresh()}>
          {busy ? 'Syncing…' : 'Refresh'}
        </button>
      </div>
      <p className="muted">
        Total ${sumUsdt(filtered).toFixed(2)} · {sumBtc(filtered).toFixed(6)} BTC · Last sync {lastSync}
      </p>
      <div className="row" style={{ marginBottom: 12 }}>
        <select value={accountId} onChange={(e) => setAccountId(e.target.value)} style={{ maxWidth: 220 }}>
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
          style={{ maxWidth: 240 }}
        />
      </div>
      <div className="panel" style={{ overflowX: 'auto' }}>
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
        {filtered.length === 0 && <p className="muted">No balances in cache. Add accounts and refresh online.</p>}
      </div>
      <Toast message={toast} onClose={() => setToast(null)} />
    </div>
  )
}
