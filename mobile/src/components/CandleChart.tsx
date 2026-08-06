import { memo, useEffect, useRef } from 'react'
import {
  AreaSeries,
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  PriceScaleMode,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type SeriesType,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts'
import type { Candle } from '../domain/types'
import { bollinger, ema, macd, rsi, sma, type IndicatorPoint } from '../services/indicators'

export type ChartType = 'candles' | 'hollow' | 'line' | 'area'
export type IndicatorId = 'vol' | 'ma7' | 'ma25' | 'ema12' | 'ema26' | 'bb' | 'rsi' | 'macd'

export type ChartCrosshair = {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
  values: Record<string, number | null>
} | null

export type CandleChartProps = {
  candles: Candle[]
  chartType?: ChartType
  indicators?: IndicatorId[]
  logScale?: boolean
  fitKey?: string | number
  onCrosshair?: (v: ChartCrosshair) => void
  className?: string
}

type AnySeries = ISeriesApi<SeriesType>

type IndicatorCache = {
  ma7: IndicatorPoint[]
  ma25: IndicatorPoint[]
  ema12: IndicatorPoint[]
  ema26: IndicatorPoint[]
  bb: ReturnType<typeof bollinger>
  rsi: IndicatorPoint[]
  macd: ReturnType<typeof macd>
}

const UP = '#74c044'
const DOWN = '#e11d48'
const COLORS = {
  ma7: '#f59e0b',
  ma25: '#8b5cf6',
  ema12: '#06b6d4',
  ema26: '#ec4899',
  bb: 'rgba(31, 111, 214, 0.55)',
  rsi: '#1f6fd6',
  macd: '#1f6fd6',
  signal: '#f59e0b',
}

function toLine(points: IndicatorPoint[]) {
  return points.map((p) => ({ time: p.time as UTCTimestamp, value: p.value }))
}

function candleAt(candles: Candle[], time: number): Candle | undefined {
  // Candles are chronological — binary search from end for hover.
  for (let i = candles.length - 1; i >= 0; i--) {
    if (candles[i].time === time) return candles[i]
    if (candles[i].time < time) break
  }
  return undefined
}

function valueAt(points: IndicatorPoint[], time: number): number | null {
  for (let i = points.length - 1; i >= 0; i--) {
    if (points[i].time === time) return points[i].value
    if (points[i].time < time) break
  }
  return null
}

function buildCache(candles: Candle[]): IndicatorCache {
  return {
    ma7: sma(candles, 7),
    ma25: sma(candles, 25),
    ema12: ema(candles, 12),
    ema26: ema(candles, 26),
    bb: bollinger(candles, 20, 2),
    rsi: rsi(candles, 14),
    macd: macd(candles),
  }
}

function CandleChartInner({
  candles,
  chartType = 'candles',
  indicators = ['vol', 'ma7', 'ma25'],
  logScale = false,
  fitKey,
  onCrosshair,
  className,
}: CandleChartProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesBag = useRef<Map<string, AnySeries>>(new Map())
  const candlesRef = useRef(candles)
  const prevCandlesRef = useRef<Candle[]>([])
  const indicatorsRef = useRef(indicators)
  const chartTypeRef = useRef(chartType)
  const onCrosshairRef = useRef(onCrosshair)
  const lastFitKey = useRef<string | number | undefined>(undefined)
  const cacheRef = useRef<IndicatorCache>(buildCache(candles))
  const lastHoverTime = useRef<number | null>(null)
  const rafRef = useRef(0)
  const indicatorsKey = [...indicators].sort().join(',')

  candlesRef.current = candles
  indicatorsRef.current = indicators
  chartTypeRef.current = chartType
  onCrosshairRef.current = onCrosshair
  cacheRef.current = buildCache(candles)

  useEffect(() => {
    if (!hostRef.current) return
    const el = hostRef.current
    const chart = createChart(el, {
      autoSize: false,
      width: Math.max(1, el.clientWidth),
      height: Math.max(1, el.clientHeight || 320),
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#8a9199',
        fontSize: 11,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: 'rgba(16,24,40,0.06)' },
        horzLines: { color: 'rgba(16,24,40,0.06)' },
      },
      crosshair: {
        mode: CrosshairMode.Magnet,
        vertLine: {
          color: 'rgba(31,111,214,0.35)',
          labelBackgroundColor: '#1f6fd6',
          width: 1,
        },
        horzLine: {
          color: 'rgba(31,111,214,0.35)',
          labelBackgroundColor: '#1f6fd6',
          width: 1,
        },
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.08, bottom: 0.12 },
      },
      timeScale: {
        borderVisible: false,
        rightOffset: 4,
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: { vertTouchDrag: true, mouseWheel: true },
      handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
    })
    chartRef.current = chart

    const emit = (payload: ChartCrosshair) => {
      const cb = onCrosshairRef.current
      if (!cb) return
      cb(payload)
    }

    const onMove = (param: { time?: Time }) => {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(() => {
        if (param.time == null) {
          if (lastHoverTime.current != null) {
            lastHoverTime.current = null
            emit(null)
          }
          return
        }
        const t = Number(param.time)
        if (lastHoverTime.current === t) return
        lastHoverTime.current = t
        const c = candleAt(candlesRef.current, t)
        if (!c) {
          emit(null)
          return
        }
        const ind = new Set(indicatorsRef.current)
        const cache = cacheRef.current
        const values: Record<string, number | null> = {}
        if (ind.has('ma7')) values.ma7 = valueAt(cache.ma7, t)
        if (ind.has('ma25')) values.ma25 = valueAt(cache.ma25, t)
        if (ind.has('ema12')) values.ema12 = valueAt(cache.ema12, t)
        if (ind.has('ema26')) values.ema26 = valueAt(cache.ema26, t)
        if (ind.has('rsi')) values.rsi = valueAt(cache.rsi, t)
        if (ind.has('bb')) {
          values.bbMid = valueAt(cache.bb.middle, t)
          values.bbUpper = valueAt(cache.bb.upper, t)
          values.bbLower = valueAt(cache.bb.lower, t)
        }
        if (ind.has('macd')) {
          values.macd = valueAt(cache.macd.macd, t)
          values.signal = valueAt(cache.macd.signal, t)
          values.hist = valueAt(cache.macd.histogram, t)
        }
        if (ind.has('vol')) values.vol = c.volume
        emit({
          time: c.time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          volume: c.volume,
          values,
        })
      })
    }

    chart.subscribeCrosshairMove(onMove as never)

    let resizeRaf = 0
    const resize = () => {
      cancelAnimationFrame(resizeRaf)
      resizeRaf = requestAnimationFrame(() => {
        if (!hostRef.current || !chartRef.current) return
        const w = Math.max(1, hostRef.current.clientWidth)
        const h = Math.max(1, hostRef.current.clientHeight || 320)
        chartRef.current.applyOptions({ width: w, height: h })
      })
    }
    const ro = new ResizeObserver(resize)
    ro.observe(el)
    resize()

    return () => {
      cancelAnimationFrame(rafRef.current)
      cancelAnimationFrame(resizeRaf)
      ro.disconnect()
      chart.unsubscribeCrosshairMove(onMove as never)
      chart.remove()
      chartRef.current = null
      seriesBag.current.clear()
    }
  }, [])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return

    for (const s of seriesBag.current.values()) {
      try {
        chart.removeSeries(s)
      } catch {
        /* already gone */
      }
    }
    seriesBag.current.clear()

    const panes = chart.panes()
    for (let i = panes.length - 1; i >= 1; i--) {
      try {
        chart.removePane(i)
      } catch {
        /* ignore */
      }
    }

    chart.priceScale('right').applyOptions({
      mode: logScale ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal,
    })

    const bag = seriesBag.current
    const ind = new Set(indicators)

    if (chartType === 'line') {
      bag.set(
        'main',
        chart.addSeries(LineSeries, {
          color: '#1f6fd6',
          lineWidth: 2,
          priceLineVisible: true,
          lastValueVisible: true,
        }),
      )
    } else if (chartType === 'area') {
      bag.set(
        'main',
        chart.addSeries(AreaSeries, {
          lineColor: '#1f6fd6',
          topColor: 'rgba(31, 111, 214, 0.28)',
          bottomColor: 'rgba(31, 111, 214, 0.02)',
          lineWidth: 2,
          priceLineVisible: true,
          lastValueVisible: true,
        }),
      )
    } else {
      const hollow = chartType === 'hollow'
      bag.set(
        'main',
        chart.addSeries(CandlestickSeries, {
          upColor: hollow ? 'transparent' : UP,
          downColor: hollow ? 'transparent' : DOWN,
          borderVisible: hollow,
          borderUpColor: UP,
          borderDownColor: DOWN,
          wickUpColor: UP,
          wickDownColor: DOWN,
          priceLineVisible: true,
          lastValueVisible: true,
        }),
      )
    }

    let nextPane = 1

    if (ind.has('vol')) {
      const vol = chart.addSeries(
        HistogramSeries,
        { priceFormat: { type: 'volume' }, priceScaleId: 'vol' },
        nextPane,
      )
      chart.priceScale('vol', nextPane).applyOptions({ scaleMargins: { top: 0.15, bottom: 0 } })
      bag.set('vol', vol)
      chart.panes()[nextPane]?.setHeight(72)
      nextPane++
    }

    if (ind.has('ma7')) {
      bag.set(
        'ma7',
        chart.addSeries(LineSeries, {
          color: COLORS.ma7,
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: false,
        }),
      )
    }
    if (ind.has('ma25')) {
      bag.set(
        'ma25',
        chart.addSeries(LineSeries, {
          color: COLORS.ma25,
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: false,
        }),
      )
    }
    if (ind.has('ema12')) {
      bag.set(
        'ema12',
        chart.addSeries(LineSeries, {
          color: COLORS.ema12,
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: false,
        }),
      )
    }
    if (ind.has('ema26')) {
      bag.set(
        'ema26',
        chart.addSeries(LineSeries, {
          color: COLORS.ema26,
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: false,
        }),
      )
    }
    if (ind.has('bb')) {
      bag.set(
        'bbUpper',
        chart.addSeries(LineSeries, {
          color: COLORS.bb,
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          priceLineVisible: false,
          lastValueVisible: false,
        }),
      )
      bag.set(
        'bbMid',
        chart.addSeries(LineSeries, {
          color: COLORS.bb,
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
        }),
      )
      bag.set(
        'bbLower',
        chart.addSeries(LineSeries, {
          color: COLORS.bb,
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          priceLineVisible: false,
          lastValueVisible: false,
        }),
      )
    }

    if (ind.has('rsi')) {
      bag.set(
        'rsi',
        chart.addSeries(
          LineSeries,
          {
            color: COLORS.rsi,
            lineWidth: 2,
            priceLineVisible: false,
            lastValueVisible: true,
            priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
          },
          nextPane,
        ),
      )
      chart.panes()[nextPane]?.setHeight(88)
      nextPane++
    }

    if (ind.has('macd')) {
      bag.set('macdHist', chart.addSeries(HistogramSeries, { priceLineVisible: false, lastValueVisible: false }, nextPane))
      bag.set(
        'macd',
        chart.addSeries(
          LineSeries,
          { color: COLORS.macd, lineWidth: 2, priceLineVisible: false, lastValueVisible: false },
          nextPane,
        ),
      )
      bag.set(
        'signal',
        chart.addSeries(
          LineSeries,
          { color: COLORS.signal, lineWidth: 2, priceLineVisible: false, lastValueVisible: false },
          nextPane,
        ),
      )
      chart.panes()[nextPane]?.setHeight(96)
    }

    applyFullData(bag, candlesRef.current, chartType, indicators, cacheRef.current)
    prevCandlesRef.current = candlesRef.current
  }, [chartType, indicatorsKey, logScale])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart || seriesBag.current.size === 0) return
    const prev = prevCandlesRef.current
    const next = candles
    const bag = seriesBag.current
    const cache = cacheRef.current

    const sameHead = prev.length > 0 && next.length > 0 && prev[0]?.time === next[0]?.time
    const lastOnly =
      sameHead &&
      (next.length === prev.length || next.length === prev.length + 1) &&
      next.length > 0

    if (lastOnly) {
      updateLastBar(bag, next[next.length - 1], chartType, indicators)
      // Refresh overlays without resetting the viewport.
      applyIndicatorData(bag, indicators, cache)
    } else {
      applyFullData(bag, next, chartType, indicators, cache)
    }
    prevCandlesRef.current = next
  }, [candles, chartType, indicatorsKey])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart || fitKey === undefined) return
    if (fitKey === lastFitKey.current) return
    lastFitKey.current = fitKey
    requestAnimationFrame(() => chart.timeScale().fitContent())
  }, [fitKey])

  return <div className={className ? `chart-wrap ${className}` : 'chart-wrap'} ref={hostRef} />
}

function updateLastBar(
  bag: Map<string, AnySeries>,
  c: Candle,
  chartType: ChartType,
  indicators: IndicatorId[],
) {
  const main = bag.get('main')
  if (main) {
    if (chartType === 'line' || chartType === 'area') {
      main.update({ time: c.time as UTCTimestamp, value: c.close })
    } else {
      main.update({
        time: c.time as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })
    }
  }
  if (indicators.includes('vol') && bag.get('vol')) {
    bag.get('vol')!.update({
      time: c.time as UTCTimestamp,
      value: c.volume,
      color: c.close >= c.open ? 'rgba(116, 192, 68, 0.55)' : 'rgba(225, 29, 72, 0.5)',
    })
  }
}

function applyIndicatorData(bag: Map<string, AnySeries>, indicators: IndicatorId[], cache: IndicatorCache) {
  const ind = new Set(indicators)
  if (ind.has('ma7') && bag.get('ma7')) bag.get('ma7')!.setData(toLine(cache.ma7))
  if (ind.has('ma25') && bag.get('ma25')) bag.get('ma25')!.setData(toLine(cache.ma25))
  if (ind.has('ema12') && bag.get('ema12')) bag.get('ema12')!.setData(toLine(cache.ema12))
  if (ind.has('ema26') && bag.get('ema26')) bag.get('ema26')!.setData(toLine(cache.ema26))
  if (ind.has('bb') && bag.get('bbMid')) {
    bag.get('bbUpper')!.setData(toLine(cache.bb.upper))
    bag.get('bbMid')!.setData(toLine(cache.bb.middle))
    bag.get('bbLower')!.setData(toLine(cache.bb.lower))
  }
  if (ind.has('rsi') && bag.get('rsi')) bag.get('rsi')!.setData(toLine(cache.rsi))
  if (ind.has('macd') && bag.get('macd')) {
    bag.get('macd')!.setData(toLine(cache.macd.macd))
    bag.get('signal')!.setData(toLine(cache.macd.signal))
    bag.get('macdHist')!.setData(
      cache.macd.histogram.map((p) => ({
        time: p.time as UTCTimestamp,
        value: p.value,
        color: p.value >= 0 ? 'rgba(116, 192, 68, 0.55)' : 'rgba(225, 29, 72, 0.5)',
      })),
    )
  }
}

function applyFullData(
  bag: Map<string, AnySeries>,
  candles: Candle[],
  chartType: ChartType,
  indicators: IndicatorId[],
  cache: IndicatorCache,
) {
  if (!candles.length) {
    for (const s of bag.values()) s.setData([])
    return
  }

  const main = bag.get('main')
  if (main) {
    if (chartType === 'line' || chartType === 'area') {
      main.setData(candles.map((c) => ({ time: c.time as UTCTimestamp, value: c.close })))
    } else {
      main.setData(
        candles.map((c) => ({
          time: c.time as UTCTimestamp,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        })),
      )
    }
  }

  if (indicators.includes('vol') && bag.get('vol')) {
    bag.get('vol')!.setData(
      candles.map((c) => ({
        time: c.time as UTCTimestamp,
        value: c.volume,
        color: c.close >= c.open ? 'rgba(116, 192, 68, 0.55)' : 'rgba(225, 29, 72, 0.5)',
      })),
    )
  }

  applyIndicatorData(bag, indicators, cache)
}

export const CandleChart = memo(CandleChartInner)
