import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import type { Candle, ExchangeId, TickerRow } from '../domain/types'
import { cacheGetCandles, cacheGetTickers, cacheUpsertCandles } from '../storage/cache'
import { getFavorites, toggleFavorite } from '../storage/favorites'
import { getExchange } from '../exchanges/registry'
import { startLiveCandles, startLiveTickers } from '../services/pricesLive'
import { useOnline } from '../app/OnlineContext'
import {
  CandleChart,
  type ChartCrosshair,
  type ChartType,
  type IndicatorId,
} from '../components/CandleChart'
import { AssetIcon } from '../components/AssetIcon'
import { AppSelect } from '../components/AppSelect'
import { formatUnitPrice } from '../services/valuation'
import { bollinger, ema, latestIndicatorValue, macd, rsi, sma } from '../services/indicators'

const INTERVALS = ['1m', '5m', '15m', '1h', '4h', '1d', '1w'] as const
const INTERVAL_OPTIONS = [
  { value: '1m', label: '1m', hint: '1 minute candles' },
  { value: '5m', label: '5m', hint: '5 minute candles' },
  { value: '15m', label: '15m', hint: '15 minute candles' },
  { value: '1h', label: '1h', hint: '1 hour candles' },
  { value: '4h', label: '4H', hint: '4 hour candles' },
  { value: '1d', label: '1d', hint: 'Daily candles' },
  { value: '1w', label: '1W', hint: 'Weekly candles' },
] as const
const CHART_TYPES: Array<{ id: ChartType; label: string }> = [
  { id: 'candles', label: 'Candles' },
  { id: 'hollow', label: 'Hollow' },
  { id: 'line', label: 'Line' },
  { id: 'area', label: 'Area' },
]
const INDICATOR_OPTS: Array<{ id: IndicatorId; label: string; color: string }> = [
  { id: 'vol', label: 'Vol', color: '#64748b' },
  { id: 'ma7', label: 'MA7', color: '#f59e0b' },
  { id: 'ma25', label: 'MA25', color: '#8b5cf6' },
  { id: 'ema12', label: 'EMA12', color: '#06b6d4' },
  { id: 'ema26', label: 'EMA26', color: '#ec4899' },
  { id: 'bb', label: 'BB', color: '#1f6fd6' },
  { id: 'rsi', label: 'RSI', color: '#0d9488' },
  { id: 'macd', label: 'MACD', color: '#2563eb' },
]

const PREFS_KEY = 'mybinance.chartPrefs'

type ChartPrefs = {
  interval: (typeof INTERVALS)[number]
  chartType: ChartType
  indicators: IndicatorId[]
  logScale: boolean
}

const DEFAULT_PREFS: ChartPrefs = {
  interval: '1h',
  chartType: 'candles',
  indicators: ['vol', 'ma7', 'ma25'],
  logScale: false,
}

function loadPrefs(): ChartPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return DEFAULT_PREFS
    const parsed = JSON.parse(raw) as Partial<ChartPrefs>
    const interval = INTERVALS.includes(parsed.interval as ChartPrefs['interval'])
      ? (parsed.interval as ChartPrefs['interval'])
      : DEFAULT_PREFS.interval
    const chartType = CHART_TYPES.some((t) => t.id === parsed.chartType)
      ? (parsed.chartType as ChartType)
      : DEFAULT_PREFS.chartType
    const indicators = Array.isArray(parsed.indicators)
      ? parsed.indicators.filter((id): id is IndicatorId => INDICATOR_OPTS.some((o) => o.id === id))
      : DEFAULT_PREFS.indicators
    return {
      interval,
      chartType,
      indicators: indicators.length ? indicators : DEFAULT_PREFS.indicators,
      logScale: Boolean(parsed.logScale),
    }
  } catch {
    return DEFAULT_PREFS
  }
}

type LiveNavState = {
  symbol?: string
  view?: 'cards' | 'fav' | 'chart'
  exchange?: ExchangeId
}

function formatPx(n: number) {
  return formatUnitPrice(n)
}

function formatVol(n: number) {
  if (!Number.isFinite(n)) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toFixed(2)
}

export function LiveScreen() {
  const online = useOnline()
  const location = useLocation()
  const initialPrefs = useMemo(() => loadPrefs(), [])
  const [exchange, setExchange] = useState<ExchangeId>('binance')
  const [tickers, setTickers] = useState<TickerRow[]>([])
  const [favorites, setFavorites] = useState<string[]>([])
  const [selected, setSelected] = useState('BTCUSDT')
  const [interval, setInterval] = useState<(typeof INTERVALS)[number]>(initialPrefs.interval)
  const [chartType, setChartType] = useState<ChartType>(initialPrefs.chartType)
  const [indicators, setIndicators] = useState<IndicatorId[]>(initialPrefs.indicators)
  const [logScale, setLogScale] = useState(initialPrefs.logScale)
  const [fullscreen, setFullscreen] = useState(false)
  const [showIndicators, setShowIndicators] = useState(false)
  const [fitNonce, setFitNonce] = useState(0)
  const [crosshair, setCrosshair] = useState<ChartCrosshair>(null)
  const [candles, setCandles] = useState<Candle[]>([])
  const [q, setQ] = useState('')
  const [view, setView] = useState<'cards' | 'fav' | 'chart'>('fav')

  useEffect(() => {
    const prefs: ChartPrefs = { interval, chartType, indicators, logScale }
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
  }, [interval, chartType, indicators, logScale])

  useEffect(() => {
    const state = (location.state as LiveNavState | null) ?? null
    if (!state?.symbol) return
    setSelected(state.symbol.toUpperCase())
    if (state.view) setView(state.view)
    if (state.exchange) setExchange(state.exchange)
  }, [location.state, location.key])

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
    setCrosshair(null)
    void (async () => {
      let c = await cacheGetCandles(selected, interval)
      if (online) {
        try {
          c = await getExchange(exchange).fetchCandles(selected, interval, 300)
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

  useEffect(() => {
    if (!fullscreen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fullscreen])

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

  const ticker = useMemo(() => tickers.find((t) => t.symbol === selected), [tickers, selected])
  const lastCandle = candles.length ? candles[candles.length - 1] : null
  const hudCandle = crosshair ?? (lastCandle
    ? {
        time: lastCandle.time,
        open: lastCandle.open,
        high: lastCandle.high,
        low: lastCandle.low,
        close: lastCandle.close,
        volume: lastCandle.volume,
        values: {},
      }
    : null)

  const legend = useMemo(() => {
    if (!candles.length) return [] as Array<{ id: string; label: string; color: string }>
    const rows: Array<{ id: string; label: string; color: string }> = []
    const ind = new Set(indicators)
    if (ind.has('ma7')) {
      const v = latestIndicatorValue(sma(candles, 7))
      if (v != null) rows.push({ id: 'ma7', label: `MA7 ${formatPx(v)}`, color: '#f59e0b' })
    }
    if (ind.has('ma25')) {
      const v = latestIndicatorValue(sma(candles, 25))
      if (v != null) rows.push({ id: 'ma25', label: `MA25 ${formatPx(v)}`, color: '#8b5cf6' })
    }
    if (ind.has('ema12')) {
      const v = latestIndicatorValue(ema(candles, 12))
      if (v != null) rows.push({ id: 'ema12', label: `EMA12 ${formatPx(v)}`, color: '#06b6d4' })
    }
    if (ind.has('ema26')) {
      const v = latestIndicatorValue(ema(candles, 26))
      if (v != null) rows.push({ id: 'ema26', label: `EMA26 ${formatPx(v)}`, color: '#ec4899' })
    }
    if (ind.has('bb')) {
      const bb = bollinger(candles, 20, 2)
      const mid = latestIndicatorValue(bb.middle)
      if (mid != null) rows.push({ id: 'bb', label: `BB ${formatPx(mid)}`, color: '#1f6fd6' })
    }
    if (ind.has('rsi')) {
      const v = latestIndicatorValue(rsi(candles, 14))
      if (v != null) rows.push({ id: 'rsi', label: `RSI ${v.toFixed(1)}`, color: '#1f6fd6' })
    }
    if (ind.has('macd')) {
      const m = macd(candles)
      const v = latestIndicatorValue(m.macd)
      if (v != null) rows.push({ id: 'macd', label: `MACD ${v.toFixed(2)}`, color: '#1f6fd6' })
    }
    return rows
  }, [candles, indicators])

  async function onToggleFav(symbol: string) {
    setFavorites(await toggleFavorite(symbol))
  }

  function toggleIndicator(id: IndicatorId) {
    setIndicators((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const onCrosshair = useCallback((v: ChartCrosshair) => {
    setCrosshair((prev) => {
      if (prev == null && v == null) return prev
      if (prev && v && prev.time === v.time && prev.close === v.close && prev.high === v.high) return prev
      return v
    })
  }, [])

  const price = ticker?.last ?? hudCandle?.close
  const change = ticker?.changePct24h
  const up = (change ?? 0) >= 0
  const candleUp = hudCandle ? hudCandle.close >= hudCandle.open : true

  function renderTickerList(rows: TickerRow[], empty: string) {
    return (
      <div className="asset-list">
        {rows.map((t) => {
          const fav = favorites.includes(t.symbol)
          const rowUp = t.changePct24h >= 0
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
                <AssetIcon asset={t.symbol} />
                <div className="asset-main">
                  <strong>{t.symbol}</strong>
                  <span>Tap for chart</span>
                </div>
                <div className="asset-values">
                  <strong>{t.last}</strong>
                  <span className={rowUp ? 'up' : 'down'}>
                    {rowUp ? '+' : ''}
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

  const chartBlock = (
    <div className={`panel chart-panel ${fullscreen ? 'chart-fullscreen' : ''} ${up ? 'tone-up' : 'tone-down'}`}>
      <div className="chart-hud">
        <div className="chart-hud-main">
          <AssetIcon asset={selected} />
          <div className="chart-hud-text">
            <strong className="chart-symbol">{selected}</strong>
            <div className="chart-hud-price">
              <span className={up ? 'up' : 'down'}>{price != null ? `$${formatPx(price)}` : '—'}</span>
              {change != null && (
                <span className={`chart-change ${up ? 'up' : 'down'}`}>
                  {up ? '▲' : '▼'} {up ? '+' : ''}
                  {change.toFixed(2)}%
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="chart-icon-actions" role="toolbar" aria-label="Chart actions">
          <button
            type="button"
            className={`chart-icon-btn ${favorites.includes(selected) ? 'on fav' : ''}`}
            aria-label={favorites.includes(selected) ? 'Remove favorite' : 'Add favorite'}
            onClick={() => void onToggleFav(selected)}
          >
            <StarGlyph filled={favorites.includes(selected)} />
          </button>
          <button
            type="button"
            className="chart-icon-btn"
            aria-label="Fit chart"
            title="Fit"
            onClick={() => setFitNonce((n) => n + 1)}
          >
            <FitGlyph />
          </button>
          <button
            type="button"
            className={`chart-icon-btn ${logScale ? 'on' : ''}`}
            aria-label="Log scale"
            title="Log scale"
            onClick={() => setLogScale((v) => !v)}
          >
            <LogGlyph />
          </button>
          <button
            type="button"
            className={`chart-icon-btn ${showIndicators ? 'on' : ''}`}
            aria-label="Indicators"
            title="Indicators"
            aria-pressed={showIndicators}
            onClick={() => setShowIndicators((v) => !v)}
          >
            <FxGlyph />
          </button>
          <button
            type="button"
            className={`chart-icon-btn ${fullscreen ? 'on' : ''}`}
            aria-label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            title={fullscreen ? 'Exit' : 'Full'}
            onClick={() => setFullscreen((v) => !v)}
          >
            {fullscreen ? <ExitFullGlyph /> : <FullGlyph />}
          </button>
        </div>
      </div>

      {hudCandle && (
        <div className="chart-ohlc">
          <span className="ohlc-o">
            <em>O</em>
            {formatPx(hudCandle.open)}
          </span>
          <span className="ohlc-h">
            <em>H</em>
            {formatPx(hudCandle.high)}
          </span>
          <span className="ohlc-l">
            <em>L</em>
            {formatPx(hudCandle.low)}
          </span>
          <span className={candleUp ? 'ohlc-c up' : 'ohlc-c down'}>
            <em>C</em>
            {formatPx(hudCandle.close)}
          </span>
          <span className="ohlc-v">
            <em>Vol</em>
            {formatVol(hudCandle.volume)}
          </span>
        </div>
      )}

      <div className="chart-controls">
        <AppSelect
          className="chart-tf-select"
          icon="type"
          prefix="TF"
          value={interval}
          onChange={(v) => setInterval(v as (typeof INTERVALS)[number])}
          options={INTERVAL_OPTIONS.map((o) => ({ value: o.value, label: o.label, hint: o.hint }))}
        />

        <div className="chart-type-seg" role="group" aria-label="Chart type">
          {CHART_TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`chart-type-btn ${chartType === t.id ? 'active' : ''}`}
              aria-label={t.label}
              title={t.label}
              onClick={() => setChartType(t.id)}
            >
              <ChartTypeGlyph type={t.id} />
            </button>
          ))}
        </div>
      </div>

      {showIndicators && (
        <div className="chart-ind-panel">
          <div className="chart-ind-head">
            <span>Indicators</span>
            <button type="button" className="chart-ind-clear" onClick={() => setIndicators(['vol'])}>
              Reset
            </button>
          </div>
          <div className="chart-ind-grid">
            {INDICATOR_OPTS.map((opt) => {
              const on = indicators.includes(opt.id)
              return (
                <button
                  key={opt.id}
                  type="button"
                  className={`chart-ind-chip ${on ? 'on' : ''}`}
                  style={{ ['--ind' as string]: opt.color }}
                  aria-pressed={on}
                  onClick={() => toggleIndicator(opt.id)}
                >
                  <i className="chart-ind-dot" aria-hidden="true" />
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {legend.length > 0 && !showIndicators && (
        <div className="chart-legend">
          {legend.map((l) => (
            <span key={l.id} style={{ color: l.color }}>
              <i className="chart-ind-dot" style={{ background: l.color }} aria-hidden="true" />
              {l.label}
            </span>
          ))}
        </div>
      )}

      <CandleChart
        candles={candles}
        chartType={chartType}
        indicators={indicators}
        logScale={logScale}
        fitKey={`${selected}:${interval}:${fitNonce}`}
        onCrosshair={onCrosshair}
        className={fullscreen ? 'chart-wrap-tall' : 'chart-wrap-pro'}
      />
      {!online && <p className="muted tight">Offline — showing cached candles.</p>}
    </div>
  )

  return (
    <div className={`mobile-page ${fullscreen ? 'chart-fs-page' : ''} ${view === 'chart' ? 'chart-mode' : ''}`}>
      {!fullscreen && (
        <>
          <div className={`page-head ${view === 'chart' ? 'page-head-compact' : ''}`}>
            {view !== 'chart' && (
              <div>
                <p className="eyebrow">Markets</p>
                <h2>Live prices</h2>
              </div>
            )}
            <div className="tabs tabs-icons">
              <button type="button" className={`btn ${view === 'fav' ? 'active' : ''}`} onClick={() => setView('fav')}>
                <StarIcon filled={view === 'fav'} />
                Favorites
              </button>
              <button
                type="button"
                className={`btn ${view === 'cards' ? 'active' : ''}`}
                onClick={() => setView('cards')}
              >
                <ListIcon />
                List
              </button>
              <button
                type="button"
                className={`btn ${view === 'chart' ? 'active' : ''}`}
                onClick={() => setView('chart')}
              >
                <ChartIcon />
                Chart
              </button>
            </div>
          </div>

          <div className={`chip-row ${view === 'chart' ? 'chip-row-compact' : ''}`}>
            <AppSelect
              icon="exchange"
              value={exchange}
              onChange={(v) => setExchange(v as ExchangeId)}
              options={[
                { value: 'binance', label: 'Binance', hint: 'Spot markets' },
                { value: 'okx', label: 'OKX', hint: 'Spot markets' },
              ]}
            />
            <input
              className="search-pill"
              placeholder="Search BTC…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </>
      )}

      {view === 'cards' && !fullscreen &&
        renderTickerList(ordered, 'No tickers yet. Connect online to load markets.')}

      {view === 'fav' && !fullscreen &&
        renderTickerList(favList, 'No favorites yet. Tap ★ on a coin in List or Chart.')}

      {(view === 'chart' || fullscreen) && chartBlock}
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

function StarGlyph({ filled }: { filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        d="M12 3.6 14.4 9l5.9.5-4.5 3.8 1.4 5.7L12 16.2 6.8 19l1.4-5.7L3.7 9.5 9.6 9 12 3.6Z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function FitGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function LogGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M4 19c4-10 8-14 16-14" strokeLinecap="round" />
      <path d="M4 19h16" strokeLinecap="round" />
    </svg>
  )
}

function FxGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M5 8h8M9 5v10M14 16l3-8 3 8M15.2 13h3.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function FullGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M8 4H4v4M16 4h4v4M8 20H4v-4M16 20h4v-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ExitFullGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ChartTypeGlyph({ type }: { type: ChartType }) {
  if (type === 'line') {
    return (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
        <path d="M4 16 9 10l4 3 7-9" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  if (type === 'area') {
    return (
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        <path d="M4 17 9 10l4 3 7-8v12H4Z" fill="currentColor" opacity="0.28" />
        <path d="M4 17 9 10l4 3 7-8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  if (type === 'hollow') {
    return (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
        <path d="M8 4v4M8 16v4M16 3v5M16 15v6" strokeLinecap="round" />
        <rect x="5.5" y="8" width="5" height="8" rx="1" />
        <rect x="13.5" y="8" width="5" height="7" rx="1" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path d="M8 4v4M8 16v4M16 3v5M16 15v6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <rect x="5.5" y="8" width="5" height="8" rx="1" fill="#74c044" />
      <rect x="13.5" y="8" width="5" height="7" rx="1" fill="#e11d48" />
    </svg>
  )
}
