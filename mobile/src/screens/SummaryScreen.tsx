import { useEffect, useState } from 'react'
import { cacheGetBalances, listAccounts } from '../storage/cache'
import { sumBtc, sumUsdt } from '../services/valuation'

export function SummaryScreen() {
  const [usdt, setUsdt] = useState(0)
  const [btc, setBtc] = useState(0)
  const [btcPrice, setBtcPrice] = useState(0)

  useEffect(() => {
    void (async () => {
      const accounts = await listAccounts()
      const rows = []
      for (const a of accounts) rows.push(...(await cacheGetBalances(a.id)))
      setUsdt(sumUsdt(rows))
      setBtc(sumBtc(rows))
      const btcRow = rows.find((r) => r.asset === 'BTC')
      if (btcRow && btcRow.total > 0) setBtcPrice(btcRow.usdtValue / btcRow.total)
    })()
  }, [])

  return (
    <div>
      <h2>Summary</h2>
      <div className="panel">
        <p className="muted">Quick totals (from last sync)</p>
        <h1 style={{ fontSize: '2.2rem', margin: '8px 0' }}>${usdt.toFixed(2)}</h1>
        <h3 style={{ color: 'var(--accent2)' }}>{btc.toFixed(6)} BTC</h3>
        {btcPrice > 0 && <p className="muted">BTC ≈ ${btcPrice.toFixed(2)}</p>}
      </div>
    </div>
  )
}
