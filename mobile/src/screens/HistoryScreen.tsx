import { useEffect, useState } from 'react'
import type { AccountMeta, HistoryPoint } from '../domain/types'
import { cacheGetHistory, listAccounts } from '../storage/cache'
import { syncAccount } from '../services/sync'
import { useOnline } from '../app/OnlineContext'

export function HistoryScreen() {
  const online = useOnline()
  const [accounts, setAccounts] = useState<AccountMeta[]>([])
  const [accountId, setAccountId] = useState('')
  const [points, setPoints] = useState<Array<HistoryPoint & { id: string }>>([])

  useEffect(() => {
    void (async () => {
      const accs = await listAccounts()
      setAccounts(accs)
      const id = accountId || accs[0]?.id || ''
      if (!accountId && id) setAccountId(id)
      if (id) setPoints(await cacheGetHistory(id))
    })()
  }, [accountId])

  async function refresh() {
    if (!online || !accountId) return
    await syncAccount(accountId)
    setPoints(await cacheGetHistory(accountId))
  }

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2>Account history</h2>
        <button className="btn primary" disabled={!online} onClick={() => void refresh()}>
          Refresh
        </button>
      </div>
      <select value={accountId} onChange={(e) => setAccountId(e.target.value)} style={{ marginBottom: 12 }}>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.alias}
          </option>
        ))}
      </select>
      <div className="panel">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>USDT value</th>
            </tr>
          </thead>
          <tbody>
            {points
              .slice()
              .sort((a, b) => b.date.localeCompare(a.date))
              .map((p) => (
                <tr key={p.id}>
                  <td>{p.date}</td>
                  <td>${p.usdtValue.toFixed(2)}</td>
                </tr>
              ))}
          </tbody>
        </table>
        {points.length === 0 && (
          <p className="muted">No history cached yet. Binance daily snapshots sync when online.</p>
        )}
      </div>
    </div>
  )
}
