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
      <p className="eyebrow">Desk summary</p>
      <h2>Summary</h2>
      <div className="panel">
        <p className="eyebrow">Total Spot value</p>
        <div className="hero-total">${usdt.toFixed(2)}</div>
        <div className="hero-sub">{btc.toFixed(6)} BTC</div>
        {btcPrice > 0 && <p className="muted" style={{ marginTop: 10 }}>BTC mark ${btcPrice.toFixed(2)}</p>}
      </div>
    </div>
  )
}
