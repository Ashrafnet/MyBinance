import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { AccountMeta, ExchangeId } from '../domain/types'
import { useAccountFilter } from '../app/AccountFilterContext'
import { cacheGetBalances, cacheGetTickers, listAccounts } from '../storage/cache'
import { formatMoney, formatUnitPrice, sumBtc, sumUsdt } from '../services/valuation'
import { AssetIcon } from '../components/AssetIcon'

export function SummaryScreen() {
  const navigate = useNavigate()
  const { accountId } = useAccountFilter()
  const [usdt, setUsdt] = useState(0)
  const [btc, setBtc] = useState(0)
  const [btcPrice, setBtcPrice] = useState(0)
  const [btcChange, setBtcChange] = useState<number | null>(null)
  const [accounts, setAccounts] = useState<AccountMeta[]>([])
  const [assetCount, setAssetCount] = useState(0)
  const [byExchange, setByExchange] = useState<Record<ExchangeId, number>>({ binance: 0, okx: 0 })

  useEffect(() => {
    void (async () => {
      const accs = await listAccounts()
      setAccounts(accs)
      setByExchange({
        binance: accs.filter((a) => a.exchange === 'binance').length,
        okx: accs.filter((a) => a.exchange === 'okx').length,
      })

      const scoped = accountId === 'all' ? accs : accs.filter((a) => a.id === accountId)
      const rows = []
      const assets = new Set<string>()
      for (const a of scoped) {
        const bal = await cacheGetBalances(a.id)
        rows.push(...bal)
        for (const b of bal) if (b.total > 0) assets.add(b.asset)
      }
      setUsdt(sumUsdt(rows))
      setBtc(sumBtc(rows))
      setAssetCount(assets.size)

      const tickers = await cacheGetTickers()
      const btcUsdt = tickers.find((t) => t.symbol === 'BTCUSDT')
      if (btcUsdt?.last) {
        setBtcPrice(btcUsdt.last)
        setBtcChange(btcUsdt.changePct24h)
        return
      }

      const btcRow = rows.find((r) => r.asset === 'BTC')
      if (btcRow && btcRow.total > 0 && btcRow.usdtValue > 0) {
        setBtcPrice(btcRow.usdtValue / btcRow.total)
        setBtcChange(null)
      }
    })()
  }, [accountId])

  const up = (btcChange ?? 0) >= 0
  const accountCount = accounts.length

  return (
    <div className="mobile-page">
      <p className="eyebrow">Overview</p>
      <h2>Summary</h2>

      <section className="balance-hero">
        <p className="eyebrow light">Total Spot value</p>
        <div className="hero-total light">{formatMoney(usdt)}</div>
        <p className="hero-sub light">{btc.toFixed(6)} BTC</p>
      </section>

      <div className="stat-grid">
        <button type="button" className="stat-card tone-accounts interactive" onClick={() => navigate('/accounts')}>
          <div className="stat-card-head">
            <span className="stat-icon accounts" aria-hidden="true">
              <AccountsIcon />
            </span>
            <span>Accounts</span>
          </div>
          <strong>{accountCount}</strong>
          <div className="stat-meta-row">
            <span className={`pill exchange binance ${byExchange.binance ? '' : 'dim'}`}>
              B {byExchange.binance}
            </span>
            <span className={`pill exchange okx ${byExchange.okx ? '' : 'dim'}`}>O {byExchange.okx}</span>
          </div>
          <span className="stat-footnote">
            {assetCount} held asset{assetCount === 1 ? '' : 's'} · tap to manage
          </span>
        </button>

        <div className={`stat-card ${btcPrice > 0 ? (up ? 'tone-up' : 'tone-down') : ''}`}>
          <div className="stat-card-head">
            <AssetIcon asset="BTC" />
            <span>BTC mark</span>
          </div>
          <strong>{btcPrice > 0 ? `$${formatUnitPrice(btcPrice)}` : '—'}</strong>
          {btcChange != null && (
            <span className={`stat-change ${up ? 'up' : 'down'}`}>
              {up ? '+' : ''}
              {btcChange.toFixed(2)}% 24h
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function AccountsIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      <path d="M16.5 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
      <path d="M3.5 19c.6-2.4 2.6-4 4.5-4s3.9 1.6 4.5 4" strokeLinecap="round" />
      <path d="M13 19c.4-1.8 1.8-3 3.5-3s3.1 1.2 3.5 3" strokeLinecap="round" />
    </svg>
  )
}
