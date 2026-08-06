import type { Candle } from '../domain/types'

export type IndicatorPoint = { time: number; value: number }

function closes(candles: Candle[]): number[] {
  return candles.map((c) => c.close)
}

export function sma(candles: Candle[], period: number): IndicatorPoint[] {
  if (period < 1) return []
  const out: IndicatorPoint[] = []
  const c = closes(candles)
  let sum = 0
  for (let i = 0; i < c.length; i++) {
    sum += c[i]
    if (i >= period) sum -= c[i - period]
    if (i >= period - 1) out.push({ time: candles[i].time, value: sum / period })
  }
  return out
}

export function ema(candles: Candle[], period: number): IndicatorPoint[] {
  if (period < 1 || candles.length < period) return []
  const c = closes(candles)
  const k = 2 / (period + 1)
  const out: IndicatorPoint[] = []
  let prev = 0
  for (let i = 0; i < period; i++) prev += c[i]
  prev /= period
  out.push({ time: candles[period - 1].time, value: prev })
  for (let i = period; i < c.length; i++) {
    prev = c[i] * k + prev * (1 - k)
    out.push({ time: candles[i].time, value: prev })
  }
  return out
}

export function bollinger(
  candles: Candle[],
  period = 20,
  mult = 2,
): { middle: IndicatorPoint[]; upper: IndicatorPoint[]; lower: IndicatorPoint[] } {
  const middle: IndicatorPoint[] = []
  const upper: IndicatorPoint[] = []
  const lower: IndicatorPoint[] = []
  if (period < 2) return { middle, upper, lower }
  const c = closes(candles)
  for (let i = period - 1; i < c.length; i++) {
    let sum = 0
    for (let j = i - period + 1; j <= i; j++) sum += c[j]
    const mean = sum / period
    let variance = 0
    for (let j = i - period + 1; j <= i; j++) {
      const d = c[j] - mean
      variance += d * d
    }
    const std = Math.sqrt(variance / period)
    const t = candles[i].time
    middle.push({ time: t, value: mean })
    upper.push({ time: t, value: mean + mult * std })
    lower.push({ time: t, value: mean - mult * std })
  }
  return { middle, upper, lower }
}

export function rsi(candles: Candle[], period = 14): IndicatorPoint[] {
  if (period < 1 || candles.length <= period) return []
  const c = closes(candles)
  const out: IndicatorPoint[] = []
  let avgGain = 0
  let avgLoss = 0
  for (let i = 1; i <= period; i++) {
    const d = c[i] - c[i - 1]
    if (d >= 0) avgGain += d
    else avgLoss -= d
  }
  avgGain /= period
  avgLoss /= period
  const push = (i: number, gain: number, loss: number) => {
    const rs = loss === 0 ? 100 : gain / loss
    const value = loss === 0 ? 100 : 100 - 100 / (1 + rs)
    out.push({ time: candles[i].time, value })
  }
  push(period, avgGain, avgLoss)
  for (let i = period + 1; i < c.length; i++) {
    const d = c[i] - c[i - 1]
    const gain = d > 0 ? d : 0
    const loss = d < 0 ? -d : 0
    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period
    push(i, avgGain, avgLoss)
  }
  return out
}

export function macd(
  candles: Candle[],
  fast = 12,
  slow = 26,
  signalPeriod = 9,
): { macd: IndicatorPoint[]; signal: IndicatorPoint[]; histogram: IndicatorPoint[] } {
  const empty = { macd: [] as IndicatorPoint[], signal: [] as IndicatorPoint[], histogram: [] as IndicatorPoint[] }
  if (candles.length < slow + signalPeriod) return empty

  const fastEma = ema(candles, fast)
  const slowEma = ema(candles, slow)
  const slowMap = new Map(slowEma.map((p) => [p.time, p.value]))
  const macdLine: IndicatorPoint[] = []
  for (const f of fastEma) {
    const s = slowMap.get(f.time)
    if (s == null) continue
    macdLine.push({ time: f.time, value: f.value - s })
  }

  // Signal = EMA of MACD line
  if (macdLine.length < signalPeriod) return empty
  const k = 2 / (signalPeriod + 1)
  let prev = 0
  for (let i = 0; i < signalPeriod; i++) prev += macdLine[i].value
  prev /= signalPeriod
  const signal: IndicatorPoint[] = [{ time: macdLine[signalPeriod - 1].time, value: prev }]
  for (let i = signalPeriod; i < macdLine.length; i++) {
    prev = macdLine[i].value * k + prev * (1 - k)
    signal.push({ time: macdLine[i].time, value: prev })
  }

  const signalMap = new Map(signal.map((p) => [p.time, p.value]))
  const histogram: IndicatorPoint[] = []
  const macdOut: IndicatorPoint[] = []
  for (const m of macdLine) {
    const sig = signalMap.get(m.time)
    if (sig == null) continue
    macdOut.push(m)
    histogram.push({ time: m.time, value: m.value - sig })
  }

  return { macd: macdOut, signal, histogram }
}

export function latestIndicatorValue(points: IndicatorPoint[]): number | null {
  if (!points.length) return null
  return points[points.length - 1].value
}
