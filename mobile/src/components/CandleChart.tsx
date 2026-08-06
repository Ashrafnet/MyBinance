import { useEffect, useRef } from 'react'
import {
  CandlestickSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type Time,
} from 'lightweight-charts'
import type { Candle } from '../domain/types'

export function CandleChart({ candles }: { candles: Candle[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)

  useEffect(() => {
    if (!ref.current) return
    const el = ref.current
    const chart = createChart(el, {
      layout: {
        background: { color: 'transparent' },
        textColor: '#8a9199',
      },
      grid: {
        vertLines: { color: 'rgba(16,24,40,0.05)' },
        horzLines: { color: 'rgba(16,24,40,0.05)' },
      },
      width: el.clientWidth,
      height: Math.max(220, el.clientHeight || 260),
      autoSize: false,
    })
    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#74c044',
      downColor: '#e11d48',
      borderVisible: false,
      wickUpColor: '#74c044',
      wickDownColor: '#e11d48',
    })
    chartRef.current = chart
    seriesRef.current = series

    const resize = () => {
      if (!ref.current) return
      chart.applyOptions({
        width: ref.current.clientWidth,
        height: Math.max(220, ref.current.clientHeight || 320),
      })
    }

    const ro = new ResizeObserver(() => resize())
    ro.observe(el)
    window.addEventListener('orientationchange', resize)

    return () => {
      ro.disconnect()
      window.removeEventListener('orientationchange', resize)
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!seriesRef.current) return
    const data: CandlestickData<Time>[] = candles.map((c) => ({
      time: c.time as Time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }))
    seriesRef.current.setData(data)
    chartRef.current?.timeScale().fitContent()
  }, [candles])

  return <div className="chart-wrap" ref={ref} />
}
