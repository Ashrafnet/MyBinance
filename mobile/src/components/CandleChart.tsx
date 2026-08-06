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
        textColor: '#5a6675',
      },
      grid: {
        vertLines: { color: 'rgba(20,26,34,0.06)' },
        horzLines: { color: 'rgba(20,26,34,0.06)' },
      },
      width: ref.current.clientWidth,
      height: 320,
    })
    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#0f6b4c',
      downColor: '#b42318',
      borderVisible: false,
      wickUpColor: '#0f6b4c',
      wickDownColor: '#b42318',
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
