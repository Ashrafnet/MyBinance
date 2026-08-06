import { useEffect, useState } from 'react'
import { cacheGetBalances, listAccounts } from '../storage/cache'
import { sumBtc, sumUsdt } from '../services/valuation'

export function SummaryScreen() {
  const [usdt, setUsdt] = useState(0)
  const [btc, setBtc] = useState(0)
  const [btcPrice, setBtcPrice] = useState(0)
  const [accountCount, setAccountCount] = useState(0)

  useEffect(() => {
    void (async () => {
      const accounts = await listAccounts()
      setAccountCount(accounts.length)
      const rows = []
      for (const a of accounts) rows.push(...(await cacheGetBalances(a.id)))
      setUsdt(sumUsdt(rows))
      setBtc(sumBtc(rows))
      const btcRow = rows.find((r) => r.asset === 'BTC')
      if (btcRow && btcRow.total > 0) setBtcPrice(btcRow.usdtValue / btcRow.total)
    })()
  }, [])

  return (
    <div className="mobile-page">
      <p className="eyebrow">Overview</p>
      <h2>Summary</h2>

      <section className="balance-hero">
        <p className="eyebrow light">Total Spot value</p>
        <div className="hero-total light">${usdt.toFixed(2)}</div>
        <p className="hero-sub light">{btc.toFixed(6)} BTC</p>
      </section>

      <div className="stat-grid">
        <div className="stat-card">
          <span>Accounts</span>
          <strong>{accountCount}</strong>
        </div>
        <div className="stat-card">
          <span>BTC mark</span>
          <strong>{btcPrice > 0 ? `$${btcPrice.toFixed(0)}` : '—'}</strong>
        </div>
      </div>
    </div>
  )
}
