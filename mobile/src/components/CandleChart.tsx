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
        textColor: '#8b93a7',
      },
      grid: {
        vertLines: { color: 'rgba(11,18,32,0.05)' },
        horzLines: { color: 'rgba(11,18,32,0.05)' },
      },
      width: el.clientWidth,
      height: Math.max(220, el.clientHeight || 320),
      autoSize: false,
    })
    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#16c784',
      downColor: '#ea3943',
      borderVisible: false,
      wickUpColor: '#16c784',
      wickDownColor: '#ea3943',
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
