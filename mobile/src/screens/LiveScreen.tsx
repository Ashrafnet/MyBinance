import { useEffect, useMemo, useState } from 'react'
import type { Candle, ExchangeId, TickerRow } from '../domain/types'
import { cacheGetCandles, cacheGetTickers, cacheUpsertCandles } from '../storage/cache'
import { getFavorites, toggleFavorite } from '../storage/favorites'
import { getExchange } from '../exchanges/registry'
import { startLiveCandles, startLiveTickers } from '../services/pricesLive'
import { useOnline } from '../app/OnlineContext'
import { CandleChart } from '../components/CandleChart'

const INTERVALS = ['1m', '5m', '1h', '4h', '1d'] as const

export function LiveScreen() {
  const online = useOnline()
  const [exchange, setExchange] = useState<ExchangeId>('binance')
  const [tickers, setTickers] = useState<TickerRow[]>([])
  const [favorites, setFavorites] = useState<string[]>([])
  const [selected, setSelected] = useState('BTCUSDT')
  const [interval, setInterval] = useState<(typeof INTERVALS)[number]>('1h')
  const [candles, setCandles] = useState<Candle[]>([])
  const [q, setQ] = useState('')
  const [view, setView] = useState<'cards' | 'fav' | 'chart'>('fav')

  useEffect(() => {
    void (async () => {
      setFavorites(await getFavorites())
      let t = await cacheGetTickers()
      if (online && t.length === 0) {
        try {
          t = await getExchange(exchange).fetchTickers()
        } catch {
          /* cache empty */
        }
      }
      setTickers(t)
      if (!selected && t[0]) setSelected(t[0].symbol)
    })()
  }, [exchange, online, selected])

  useEffect(() => {
    if (!online) return
    const map = new Map<string, TickerRow>()
    const stop = startLiveTickers(exchange, (t) => {
      map.set(t.symbol, t)
      if (map.size >= 20) {
        setTickers((prev) => {
          const m = new Map(prev.map((x) => [x.symbol, x]))
          for (const v of map.values()) m.set(v.symbol, v)
          map.clear()
          return [...m.values()]
        })
      }
    })
    const flush = window.setInterval(() => {
      if (map.size === 0) return
      setTickers((prev) => {
        const m = new Map(prev.map((x) => [x.symbol, x]))
        for (const v of map.values()) m.set(v.symbol, v)
        map.clear()
        return [...m.values()]
      })
    }, 1000)
    return () => {
      stop()
      window.clearInterval(flush)
    }
  }, [exchange, online])

  useEffect(() => {
    let alive = true
    void (async () => {
      let c = await cacheGetCandles(selected, interval)
      if (online) {
        try {
          c = await getExchange(exchange).fetchCandles(selected, interval, 200)
          await cacheUpsertCandles(selected, interval, c)
        } catch {
          /* use cache */
        }
      }
      if (alive) setCandles(c)
    })()
    if (!online)
      return () => {
        alive = false
      }
    const stop = startLiveCandles(exchange, selected, interval, (candle) => {
      setCandles((prev) => {
        const next = [...prev]
        const idx = next.findIndex((x) => x.time === candle.time)
        if (idx >= 0) next[idx] = candle
        else next.push(candle)
        return next.slice(-300)
      })
    })
    return () => {
      alive = false
      stop()
    }
  }, [exchange, selected, interval, online])

  const ordered = useMemo(() => {
    const favSet = new Set(favorites)
    const list = tickers
      .filter((t) => t.symbol.includes('USDT'))
      .filter((t) => !q || t.symbol.toLowerCase().includes(q.toLowerCase()))
    list.sort((a, b) => {
      const af = favSet.has(a.symbol) ? 0 : 1
      const bf = favSet.has(b.symbol) ? 0 : 1
      if (af !== bf) return af - bf
      return (b.quoteVolume ?? 0) - (a.quoteVolume ?? 0)
    })
    return list.slice(0, 80)
  }, [tickers, favorites, q])

  const favList = useMemo(() => {
    const favSet = new Set(favorites)
    return ordered.filter((t) => favSet.has(t.symbol))
  }, [ordered, favorites])

  async function onToggleFav(symbol: string) {
    setFavorites(await toggleFavorite(symbol))
  }

  function renderTickerList(rows: TickerRow[], empty: string) {
    return (
      <div className="asset-list">
        {rows.map((t) => {
          const fav = favorites.includes(t.symbol)
          const up = t.changePct24h >= 0
          return (
            <div key={t.symbol} className={`asset-row ticker-row ${fav ? 'fav' : ''}`}>
              <button
                type="button"
                className="ticker-main"
                onClick={() => {
                  setSelected(t.symbol)
                  setView('chart')
                }}
              >
                <div className="asset-avatar">{t.symbol.slice(0, 1)}</div>
                <div className="asset-main">
                  <strong>{t.symbol}</strong>
                  <span>Tap for chart</span>
                </div>
                <div className="asset-values">
                  <strong>{t.last}</strong>
                  <span className={up ? 'up' : 'down'}>
                    {up ? '+' : ''}
                    {t.changePct24h.toFixed(2)}%
                  </span>
                </div>
              </button>
              <button
                type="button"
                className={`fav-btn ${fav ? 'on' : ''}`}
                aria-label={fav ? 'Remove favorite' : 'Add favorite'}
                onClick={() => void onToggleFav(t.symbol)}
              >
                {fav ? '★' : '☆'}
              </button>
            </div>
          )
        })}
        {rows.length === 0 && <div className="empty-card">{empty}</div>}
      </div>
    )
  }

  return (
    <div className="mobile-page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Markets</p>
          <h2>Live prices</h2>
        </div>
        <div className="tabs tabs-icons">
          <button type="button" className={`btn ${view === 'fav' ? 'active' : ''}`} onClick={() => setView('fav')}>
            <StarIcon filled={view === 'fav'} />
            Favorites
          </button>
          <button type="button" className={`btn ${view === 'cards' ? 'active' : ''}`} onClick={() => setView('cards')}>
            <ListIcon />
            List
          </button>
          <button type="button" className={`btn ${view === 'chart' ? 'active' : ''}`} onClick={() => setView('chart')}>
            <ChartIcon />
            Chart
          </button>
        </div>
      </div>

      <div className="chip-row">
        <select className="chip-select" value={exchange} onChange={(e) => setExchange(e.target.value as ExchangeId)}>
          <option value="binance">Binance</option>
          <option value="okx">OKX</option>
        </select>
        <input
          className="search-pill"
          placeholder="Search BTC…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {view === 'cards' &&
        renderTickerList(ordered, 'No tickers yet. Connect online to load markets.')}

      {view === 'fav' &&
        renderTickerList(favList, 'No favorites yet. Tap ★ on a coin in List or Chart.')}

      {view === 'chart' && (
        <div className="panel chart-panel">
          <div className="section-head">
            <h3>{selected}</h3>
            <button type="button" className="btn btn-compact" onClick={() => void onToggleFav(selected)}>
              {favorites.includes(selected) ? '★ Fav' : '☆ Fav'}
            </button>
          </div>
          <div className="interval-row">
            {INTERVALS.map((i) => (
              <button
                key={i}
                type="button"
                className={`interval-chip ${interval === i ? 'active' : ''}`}
                onClick={() => setInterval(i)}
              >
                {i === '4h' ? '4H' : i}
              </button>
            ))}
          </div>
          <CandleChart candles={candles} />
          {!online && <p className="muted tight">Offline — showing cached candles.</p>}
        </div>
      )}
    </div>
  )
}

function StarIcon({ filled }: { filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path
        d="M12 3.6 14.4 9l5.9.5-4.5 3.8 1.4 5.7L12 16.2 6.8 19l1.4-5.7L3.7 9.5 9.6 9 12 3.6Z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ListIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M8 7h12M8 12h12M8 17h12" strokeLinecap="round" />
      <circle cx="4.5" cy="7" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="17" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  )
}

function ChartIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M4 19V5M4 19h16" strokeLinecap="round" />
      <path d="M8 15v-4M12 15V8M16 15v-6" strokeLinecap="round" />
    </svg>
  )
}
