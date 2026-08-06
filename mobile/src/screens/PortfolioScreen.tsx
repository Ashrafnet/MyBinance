import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { BalanceRow, TickerRow } from '../domain/types'
import { cacheGetBalances, cacheGetSyncMeta, cacheGetTickers, getSettings, listAccounts } from '../storage/cache'
import { getFavorites, setFavorites, toggleFavorite } from '../storage/favorites'
import { explainSyncError, formatExchangeSyncError, type SyncErrorInfo } from '../exchanges/formatSyncError'
import { ACCOUNT_LIVE_EVENT } from '../services/accountLive'
import { syncAll } from '../services/sync'
import { formatMoney, formatUnitPrice, sumBtc, sumUsdt, unitPriceUsdt } from '../services/valuation'
import { useAccountFilter } from '../app/AccountFilterContext'
import { useOnline } from '../app/OnlineContext'
import { SyncErrorBanner } from '../components/SyncErrorBanner'
import { Toast } from '../components/Toast'
import { AppSelect } from '../components/AppSelect'
import { AssetIcon, baseAsset } from '../components/AssetIcon'
import { rankTickers } from '../utils/marketRank'
import { formatAbsoluteTime, formatHumanTime } from '../utils/time'

type PortfolioTab = 'favorites' | 'assets'
type AssetSort = 'value-desc' | 'value-asc' | 'name-asc' | 'name-desc' | 'amount-desc' | 'amount-asc'

function isAssetFavorite(asset: string, favorites: string[]) {
  return favorites.some((s) => s === asset || baseAsset(s) === asset)
}

function sortAssetRows(rows: BalanceRow[], sort: AssetSort): BalanceRow[] {
  const list = rows.slice()
  switch (sort) {
    case 'value-asc':
      return list.sort((a, b) => a.usdtValue - b.usdtValue)
    case 'name-asc':
      return list.sort((a, b) => a.asset.localeCompare(b.asset))
    case 'name-desc':
      return list.sort((a, b) => b.asset.localeCompare(a.asset))
    case 'amount-desc':
      return list.sort((a, b) => b.total - a.total)
    case 'amount-asc':
      return list.sort((a, b) => a.total - b.total)
    case 'value-desc':
    default:
      return list.sort((a, b) => b.usdtValue - a.usdtValue)
  }
}

function formatQty(n: number) {
  if (!Number.isFinite(n)) return '—'
  if (Math.abs(n) >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 })
  if (Math.abs(n) >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 4 })
  return Number(n.toPrecision(6)).toString()
}

export function PortfolioScreen() {
  const online = useOnline()
  const location = useLocation()
  const navigate = useNavigate()
  const { accountId, setAccountId, accounts, refreshAccounts } = useAccountFilter()
  const [rows, setRows] = useState<BalanceRow[]>([])
  const [tickers, setTickers] = useState<Map<string, TickerRow>>(() => new Map())
  const [favorites, setFavs] = useState<string[]>([])
  const [tab, setTab] = useState<PortfolioTab>('favorites')
  const [q, setQ] = useState('')
  const [dust, setDust] = useState(3)
  const [hideSmall, setHideSmall] = useState(true)
  const [sort, setSort] = useState<AssetSort>('value-desc')
  const [expandedAsset, setExpandedAsset] = useState<string | null>(null)
  const [lastSync, setLastSync] = useState<string>('Never')
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null)
  const [syncError, setSyncError] = useState<SyncErrorInfo | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void getFavorites().then(setFavs)
  }, [location.pathname, location.key])

  useEffect(() => {
    const state = location.state as { accountId?: string; tab?: PortfolioTab } | null
    if (!state) return
    if (state.accountId) setAccountId(state.accountId)
    if (state.tab) setTab(state.tab)
  }, [location.state, location.key])

  useEffect(() => {
    setExpandedAsset(null)
  }, [tab, accountId, sort, hideSmall, q])

  const load = useCallback(async () => {
    await refreshAccounts()
    const accs = await listAccounts()
    const settings = await getSettings()
    setDust(settings.dustUsdt)
    setFavs(await getFavorites())

    const cachedTickers = await cacheGetTickers()
    setTickers(new Map(cachedTickers.map((t) => [t.symbol, t])))

    const ids = accountId === 'all' ? accs.map((a) => a.id) : [accountId]
    const all: BalanceRow[] = []
    let latest = 0
    let firstError: SyncErrorInfo | null = null
    for (const id of ids) {
      all.push(...(await cacheGetBalances(id)))
      const meta = await cacheGetSyncMeta(id)
      if (meta?.lastSyncAt && meta.lastSyncAt > latest) latest = meta.lastSyncAt
      if (meta?.lastError && !firstError) {
        const alias = accs.find((a) => a.id === id)?.alias ?? id
        firstError = explainSyncError(meta.lastError, alias)
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
    setLastSyncAt(latest || null)
    setLastSync(latest ? formatHumanTime(latest) : 'Never')
    setSyncError(firstError)
  }, [accountId, refreshAccounts])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const onLive = () => {
      void load()
    }
    window.addEventListener(ACCOUNT_LIVE_EVENT, onLive)
    return () => window.removeEventListener(ACCOUNT_LIVE_EVENT, onLive)
  }, [load])

  const prices = useMemo(() => new Map([...tickers.entries()].map(([s, t]) => [s, t.last])), [tickers])

  const assetRows = useMemo(() => {
    const filtered = rows.filter((r) => {
      if (r.total <= 0) return false
      if (q && !r.asset.toLowerCase().includes(q.toLowerCase())) return false
      if (hideSmall && r.usdtValue > 0 && r.usdtValue < dust) return false
      return true
    })
    return sortAssetRows(filtered, sort)
  }, [rows, dust, q, hideSmall, sort])

  const favoriteItems = useMemo(() => {
    const byAsset = new Map(rows.map((r) => [r.asset, r]))
    const qLower = q.trim().toLowerCase()
    return favorites
      .filter((symbol) => {
        if (!qLower) return true
        const asset = baseAsset(symbol)
        return symbol.toLowerCase().includes(qLower) || asset.toLowerCase().includes(qLower)
      })
      .map((symbol) => {
        const asset = baseAsset(symbol)
        const balance = byAsset.get(asset)
        const ticker = tickers.get(symbol)
        const last =
          ticker?.last ??
          (balance ? unitPriceUsdt(asset, balance.total, balance.usdtValue, prices) : null)
        return { symbol, asset, balance, ticker, last }
      })
  }, [favorites, rows, tickers, prices, q])

  async function onToggleFavAsset(asset: string) {
    if (isAssetFavorite(asset, favorites)) {
      const next = favorites.filter((s) => s !== asset && baseAsset(s) !== asset)
      await setFavorites(next)
      setFavs(next)
    } else {
      setFavs(await toggleFavorite(`${asset}USDT`))
    }
  }

  async function onToggleFavSymbol(symbol: string) {
    setFavs(await toggleFavorite(symbol))
  }

  async function refresh() {
    if (!online) return
    setBusy(true)
    setSyncError(null)
    try {
      const errors = await syncAll()
      await load()
      if (errors.length) {
        const info = explainSyncError(errors[0]!)
        setSyncError(info)
        setToast(formatExchangeSyncError(errors[0]!))
      } else {
        setToast('Portfolio synced')
      }
    } catch (e) {
      const raw = e instanceof Error ? e.message : 'Sync failed'
      const info = explainSyncError(raw)
      setSyncError(info)
      setToast(formatExchangeSyncError(raw))
    } finally {
      setBusy(false)
    }
  }

  const total = sumUsdt(assetRows)
  const btc = sumBtc(assetRows)
  const topGainers = useMemo(
    () => rankTickers([...tickers.values()], 'gainers', 8),
    [tickers],
  )

  function renderHoldingCard(r: BalanceRow) {
    const px = unitPriceUsdt(r.asset, r.total, r.usdtValue, prices)
    const fav = isAssetFavorite(r.asset, favorites)
    const expanded = expandedAsset === r.asset
    const locked = Math.max(0, r.total - r.free)
    const share = total > 0 ? (r.usdtValue / total) * 100 : 0
    const ticker = tickers.get(`${r.asset}USDT`)
    const change = ticker?.changePct24h
    const up = (change ?? 0) >= 0
    return (
      <div key={r.asset} className={`holding-card ${fav ? 'fav' : ''} ${expanded ? 'open' : ''}`}>
        <button
          type="button"
          className="holding-summary"
          aria-expanded={expanded}
          onClick={() => setExpandedAsset(expanded ? null : r.asset)}
        >
          <AssetIcon asset={r.asset} />
          <div className="asset-main">
            <div className="asset-title">
              <strong>{r.asset}</strong>
              {px != null && <span className="asset-price">${formatUnitPrice(px)}</span>}
            </div>
            <div className="holding-meta">
              <span>
                <em>Total</em> {formatQty(r.total)}
              </span>
              <span>
                <em>Free</em> {formatQty(r.free)}
              </span>
            </div>
          </div>
          <div className="holding-side">
            <strong>{formatMoney(r.usdtValue)}</strong>
            <span>{share.toFixed(1)}% of bag</span>
            <span className="order-chevron">{expanded ? '▴' : '▾'}</span>
          </div>
        </button>

        {expanded && (
          <div className="holding-details">
            <div className="order-detail-grid">
              <div>
                <em>USD value</em>
                <strong>{formatMoney(r.usdtValue)}</strong>
              </div>
              <div>
                <em>BTC value</em>
                <strong>{r.btcValue.toFixed(6)}</strong>
              </div>
              <div>
                <em>Unit price</em>
                <strong>{px != null ? `$${formatUnitPrice(px)}` : '—'}</strong>
              </div>
              <div>
                <em>24h change</em>
                <strong className={change == null ? '' : up ? 'up' : 'down'}>
                  {change == null ? '—' : `${up ? '+' : ''}${change.toFixed(2)}%`}
                </strong>
              </div>
              <div>
                <em>Total</em>
                <strong>{formatQty(r.total)}</strong>
              </div>
              <div>
                <em>Free</em>
                <strong>{formatQty(r.free)}</strong>
              </div>
              <div>
                <em>Locked</em>
                <strong>{formatQty(locked)}</strong>
              </div>
              <div>
                <em>Portfolio share</em>
                <strong>{share.toFixed(2)}%</strong>
              </div>
            </div>
            <div className="holding-share-track" aria-hidden="true">
              <div className="holding-share-bar" style={{ width: `${Math.min(100, share)}%` }} />
            </div>
            <div className="order-detail-actions">
              <button
                type="button"
                className="btn primary btn-compact"
                onClick={() =>
                  navigate('/live', {
                    state: { symbol: `${r.asset}USDT`, view: 'chart' },
                  })
                }
              >
                Open chart
              </button>
              <button
                type="button"
                className={`btn btn-compact ${fav ? 'primary' : ''}`}
                onClick={() => void onToggleFavAsset(r.asset)}
              >
                {fav ? '★ Favorited' : '☆ Favorite'}
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="mobile-page">
      <section className="balance-hero glass-hero">
        <div className="balance-hero-top">
          <div>
            <p className="eyebrow light">Total Balance</p>
            <div className="hero-total light">{formatMoney(total)}</div>
            <p className="hero-sub light">
              ≈ {btc.toFixed(6)} BTC · {accountId === 'all' ? 'All accounts' : 'Selected account'}
            </p>
          </div>
        </div>
        <p className="hero-meta" title={lastSyncAt ? formatAbsoluteTime(lastSyncAt) : undefined}>
          Synced {lastSync}
        </p>
      </section>

      <div className="quick-actions">
        <button type="button" className="quick-action" onClick={() => navigate('/orders')}>
          <span className="quick-action-btn" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M4 7h11M15 7l-3-3M15 7l-3 3M20 17H9M9 17l3-3M9 17l3 3" strokeLinecap="round" />
            </svg>
          </span>
          <span>Trade</span>
        </button>
        <button type="button" className="quick-action" onClick={() => navigate('/live')}>
          <span className="quick-action-btn" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M4 19V5M4 19h16" strokeLinecap="round" />
              <path d="M8 15v-4M12 15V8M16 15v-6" strokeLinecap="round" />
            </svg>
          </span>
          <span>Markets</span>
        </button>
        <button
          type="button"
          className="quick-action"
          disabled={!online || busy}
          onClick={() => void refresh()}
        >
          <span className="quick-action-btn" aria-hidden="true">
            {busy ? '…' : (
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M4 12a8 8 0 0 1 13.5-5.8M20 12a8 8 0 0 1-13.5 5.8" strokeLinecap="round" />
                <path d="M17 3v4h4M7 21v-4H3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </span>
          <span>Sync</span>
        </button>
        <button type="button" className="quick-action" onClick={() => navigate('/more')}>
          <span className="quick-action-btn" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <circle cx="6" cy="12" r="1.6" />
              <circle cx="12" cy="12" r="1.6" />
              <circle cx="18" cy="12" r="1.6" />
            </svg>
          </span>
          <span>More</span>
        </button>
      </div>

      {syncError && <SyncErrorBanner error={syncError} onDismiss={() => setSyncError(null)} />}

      <div className="section-head">
        <h3>Top Gainers</h3>
        <button type="button" className="linkish" onClick={() => navigate('/live', { state: { view: 'cards' } })}>
          See all
        </button>
      </div>
      <div className="gainer-strip">
        {topGainers.map((t) => {
          const asset = baseAsset(t.symbol)
          const up = t.changePct24h >= 0
          return (
            <button
              key={t.symbol}
              type="button"
              className="gainer-card"
              onClick={() => navigate('/live', { state: { symbol: t.symbol, view: 'chart' } })}
            >
              <div className="gainer-card-top">
                <AssetIcon asset={asset} />
                <span>{asset}</span>
              </div>
              <strong>${formatUnitPrice(t.last)}</strong>
              <span className={`pct ${up ? 'up' : 'down'}`}>
                {up ? '+' : ''}
                {t.changePct24h.toFixed(2)}%
              </span>
            </button>
          )
        })}
        {topGainers.length === 0 && <div className="empty-card">Sync markets to see gainers.</div>}
      </div>

      <div className="section-head">
        <h3>Watchlist</h3>
        <button type="button" className="linkish" onClick={() => setTab('favorites')}>
          Edit
        </button>
      </div>
      <div className="watch-list">
        {favoriteItems.slice(0, 6).map((item) => {
          const change = item.ticker?.changePct24h
          const up = (change ?? 0) >= 0
          return (
            <button
              key={item.symbol}
              type="button"
              className="watch-row"
              onClick={() => navigate('/live', { state: { symbol: item.symbol, view: 'chart' } })}
            >
              <AssetIcon asset={item.asset} />
              <div className="watch-meta">
                <strong>{item.asset}</strong>
                <small>{item.symbol}</small>
              </div>
              <div className="watch-right">
                <strong>{item.last != null ? `$${formatUnitPrice(item.last)}` : '—'}</strong>
                <small className={up ? 'up' : 'down'}>
                  {change != null ? `${up ? '+' : ''}${change.toFixed(2)}%` : '—'}
                </small>
              </div>
            </button>
          )
        })}
        {favoriteItems.length === 0 && (
          <div className="empty-card">No favorites yet. Star coins in Markets to see them here.</div>
        )}
      </div>

      <div className="assets-section">
        <div className="tabs tabs-stretch portfolio-tabs">
          <button
            type="button"
            className={`btn ${tab === 'favorites' ? 'active' : ''}`}
            onClick={() => setTab('favorites')}
          >
            My favorites
          </button>
          <button type="button" className={`btn ${tab === 'assets' ? 'active' : ''}`} onClick={() => setTab('assets')}>
            My assets
          </button>
        </div>

        <div className="chip-row">
          <input
            className="search-pill"
            placeholder="Search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        {tab === 'assets' && (
          <div className="chip-row asset-tools">
            <AppSelect
              icon="sort"
              prefix="Sort by"
              value={sort}
              onChange={(v) => setSort(v as AssetSort)}
              options={[
                { value: 'value-desc', label: 'Value ↓', hint: 'Highest first' },
                { value: 'value-asc', label: 'Value ↑', hint: 'Lowest first' },
                { value: 'name-asc', label: 'Name A–Z', hint: 'Alphabetical' },
                { value: 'name-desc', label: 'Name Z–A', hint: 'Reverse alpha' },
                { value: 'amount-desc', label: 'Amount ↓', hint: 'Largest balance' },
                { value: 'amount-asc', label: 'Amount ↑', hint: 'Smallest balance' },
              ]}
            />
            <button
              type="button"
              className={`chip-toggle ${hideSmall ? 'on' : ''}`}
              aria-pressed={hideSmall}
              onClick={() => setHideSmall((v) => !v)}
            >
              Hide &lt; ${dust}
            </button>
          </div>
        )}

        <div className="asset-list">
          {tab === 'favorites' &&
            favoriteItems.map((item) => {
              const held = item.balance && item.balance.total > 0
              const change = item.ticker?.changePct24h
              const up = (change ?? 0) >= 0
              return (
                <div key={item.symbol} className="asset-row ticker-row fav">
                  <button
                    type="button"
                    className="ticker-main"
                    onClick={() =>
                      navigate('/live', {
                        state: { symbol: item.symbol, view: 'chart' },
                      })
                    }
                  >
                    <AssetIcon asset={item.asset} />
                    <div className="asset-main">
                      <div className="asset-title">
                        <strong>{item.asset}</strong>
                        {item.last != null && <span className="asset-price">${formatUnitPrice(item.last)}</span>}
                      </div>
                      <span>
                        {held
                          ? `${item.balance!.total} · free ${item.balance!.free}`
                          : `${item.symbol} · tap for chart`}
                      </span>
                    </div>
                    <div className="asset-values">
                      {held ? (
                        <>
                          <strong>{formatMoney(item.balance!.usdtValue)}</strong>
                          <span className={item.balance!.usdtValue >= 0 ? 'up' : 'down'}>
                            {item.balance!.btcValue.toFixed(6)} BTC
                          </span>
                        </>
                      ) : (
                        <>
                          <strong className={up ? 'up' : 'down'}>
                            {change != null ? `${up ? '+' : ''}${change.toFixed(2)}%` : '—'}
                          </strong>
                          <span>Not held</span>
                        </>
                      )}
                    </div>
                  </button>
                  <button
                    type="button"
                    className="fav-btn on"
                    aria-label="Remove favorite"
                    onClick={(e) => {
                      e.stopPropagation()
                      void onToggleFavSymbol(item.symbol)
                    }}
                  >
                    ★
                  </button>
                </div>
              )
            })}

          {tab === 'assets' && assetRows.map((r) => renderHoldingCard(r))}

          {tab === 'favorites' && favoriteItems.length === 0 && (
            <div className="empty-card">No favorites yet. Star coins in Markets to see them here.</div>
          )}
          {tab === 'assets' && assetRows.length === 0 && (
            <div className="empty-card">
              {accounts.length === 0
                ? 'Add an account in Wallet, then pull to refresh.'
                : 'No balances yet. Tap Sync above.'}
            </div>
          )}
        </div>
      </div>

      <Toast message={toast} onClose={() => setToast(null)} />
    </div>
  )
}
