import { useEffect, useMemo, useState } from 'react'
import type { AccountMeta, HistoryPoint } from '../domain/types'
import { cacheGetHistory, listAccounts } from '../storage/cache'
import { syncAccount, syncAll } from '../services/sync'
import { useOnline } from '../app/OnlineContext'

export function HistoryScreen() {
  const online = useOnline()
  const [accounts, setAccounts] = useState<AccountMeta[]>([])
  const [accountId, setAccountId] = useState('all')
  const [points, setPoints] = useState<Array<HistoryPoint & { id: string }>>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void (async () => {
      const accs = await listAccounts()
      setAccounts(accs)
      const ids = accountId === 'all' ? accs.map((a) => a.id) : [accountId]
      const all: Array<HistoryPoint & { id: string }> = []
      for (const id of ids) {
        if (id) all.push(...(await cacheGetHistory(id)))
      }
      setPoints(all)
    })()
  }, [accountId])

  async function refresh() {
    if (!online) return
    setBusy(true)
    try {
      if (accountId === 'all') await syncAll()
      else await syncAccount(accountId)
      const accs = await listAccounts()
      const ids = accountId === 'all' ? accs.map((a) => a.id) : [accountId]
      const all: Array<HistoryPoint & { id: string }> = []
      for (const id of ids) all.push(...(await cacheGetHistory(id)))
      setPoints(all)
    } finally {
      setBusy(false)
    }
  }

  const sorted = useMemo(() => {
    if (accountId !== 'all') {
      return points.slice().sort((a, b) => b.date.localeCompare(a.date))
    }
    const byDate = new Map<string, number>()
    for (const p of points) {
      byDate.set(p.date, (byDate.get(p.date) ?? 0) + p.usdtValue)
    }
    return [...byDate.entries()]
      .map(([date, usdtValue]) => ({ id: `all:${date}`, accountId: 'all', date, usdtValue }))
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [points, accountId])

  return (
    <div className="mobile-page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Snapshots</p>
          <h2>History</h2>
        </div>
        <button
          type="button"
          className="btn primary btn-compact"
          disabled={!online || busy}
          onClick={() => void refresh()}
        >
          {busy ? '…' : 'Refresh'}
        </button>
      </div>

      <select className="chip-select full-width" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
        <option value="all">All accounts</option>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.alias} ({a.exchange})
          </option>
        ))}
      </select>

      <div className="asset-list">
        {sorted.map((p) => (
          <div key={p.id} className="asset-row">
            <div className="asset-avatar">$</div>
            <div className="asset-main">
              <strong>{p.date}</strong>
              <span>Daily snapshot</span>
            </div>
            <div className="asset-values">
              <strong>${p.usdtValue.toFixed(2)}</strong>
            </div>
          </div>
        ))}
        {sorted.length === 0 && (
          <div className="empty-card">No history cached yet. Tap Refresh to sync daily snapshots.</div>
        )}
      </div>
    </div>
  )
}
