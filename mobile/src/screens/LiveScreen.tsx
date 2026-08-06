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
  const [view, setView] = useState<'cards' | 'chart'>('cards')

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
    if (!online) return () => {
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

  async function onToggleFav(symbol: string) {
    setFavorites(await toggleFavorite(symbol))
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <p className="eyebrow">Markets</p>
          <h2>Live prices</h2>
        </div>
        <div className="tabs">
          <button type="button" className={`btn ${view === 'cards' ? 'active' : ''}`} onClick={() => setView('cards')}>
            Cards
          </button>
          <button type="button" className={`btn ${view === 'chart' ? 'active' : ''}`} onClick={() => setView('chart')}>
            Candles
          </button>
        </div>
      </div>
      <div className="live-controls">
        <select value={exchange} onChange={(e) => setExchange(e.target.value as ExchangeId)}>
          <option value="binance">Binance</option>
          <option value="okx">OKX</option>
        </select>
        <input
          className="grow"
          placeholder="Search e.g. BTC"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {view === 'cards' && (
        <div className="cards">
          {ordered.map((t) => {
            const fav = favorites.includes(t.symbol)
            const up = t.changePct24h >= 0
            return (
              <div
                key={t.symbol}
                className={`price-card ${fav ? 'fav' : ''}`}
                onClick={() => {
                  setSelected(t.symbol)
                  setView('chart')
                }}
              >
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <div className="sym">{t.symbol}</div>
                  <button
                    type="button"
                    className="btn btn-compact"
                    onClick={(e) => {
                      e.stopPropagation()
                      void onToggleFav(t.symbol)
                    }}
                  >
                    {fav ? '★' : '☆'}
                  </button>
                </div>
                <div className="last">{t.last}</div>
                <div className={up ? 'up' : 'down'}>
                  {up ? '+' : ''}
                  {t.changePct24h.toFixed(2)}%
                </div>
              </div>
            )
          })}
        </div>
      )}

      {view === 'chart' && (
        <div className="panel">
          <div className="row filters" style={{ marginBottom: 10 }}>
            <strong style={{ flex: '1 1 auto' }}>{selected}</strong>
            <button type="button" className="btn btn-compact" onClick={() => void onToggleFav(selected)}>
              {favorites.includes(selected) ? 'Unfavorite' : 'Favorite'}
            </button>
            <select value={interval} onChange={(e) => setInterval(e.target.value as (typeof INTERVALS)[number])}>
              {INTERVALS.map((i) => (
                <option key={i} value={i}>
                  {i === '4h' ? '4H' : i}
                </option>
              ))}
            </select>
          </div>
          <CandleChart candles={candles} />
          {!online && <p className="muted">Offline — showing cached candles.</p>}
        </div>
      )}
    </div>
  )
}
