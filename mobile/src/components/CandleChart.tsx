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
    const chart = createChart(ref.current, {
      layout: {
        background: { color: 'transparent' },
        textColor: '#8aa3b5',
      },
      grid: {
        vertLines: { color: 'rgba(140,180,210,0.08)' },
        horzLines: { color: 'rgba(140,180,210,0.08)' },
      },
      width: ref.current.clientWidth,
      height: 320,
    })
    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#3ddc97',
      downColor: '#ff6b6b',
      borderVisible: false,
      wickUpColor: '#3ddc97',
      wickDownColor: '#ff6b6b',
    })
    chartRef.current = chart
    seriesRef.current = series

    const onResize = () => {
      if (ref.current) chart.applyOptions({ width: ref.current.clientWidth })
    }
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
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
