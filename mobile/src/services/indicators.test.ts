import { describe, expect, it } from 'vitest'
import type { Candle } from '../domain/types'
import { bollinger, ema, macd, rsi, sma } from './indicators'

function makeCandles(closes: number[]): Candle[] {
  return closes.map((close, i) => ({
    time: 1_700_000_000 + i * 60,
    open: close,
    high: close + 1,
    low: close - 1,
    close,
    volume: 100 + i,
  }))
}

describe('sma', () => {
  it('averages the trailing window', () => {
    const pts = sma(makeCandles([1, 2, 3, 4, 5]), 3)
    expect(pts).toHaveLength(3)
    expect(pts[0].value).toBe(2)
    expect(pts[1].value).toBe(3)
    expect(pts[2].value).toBe(4)
  })
})

describe('ema', () => {
  it('seeds with SMA then smooths', () => {
    const pts = ema(makeCandles([1, 2, 3, 4, 5, 6]), 3)
    expect(pts[0].value).toBe(2)
    expect(pts[1].value).toBeCloseTo(3, 5)
    expect(pts.length).toBe(4)
  })
})

describe('bollinger', () => {
  it('centers on SMA with upper/lower bands', () => {
    const { middle, upper, lower } = bollinger(makeCandles([2, 2, 2, 2, 2]), 3, 2)
    expect(middle).toHaveLength(3)
    expect(middle[0].value).toBe(2)
    expect(upper[0].value).toBe(2)
    expect(lower[0].value).toBe(2)
  })
})

describe('rsi', () => {
  it('returns 100 for a pure uptrend', () => {
    const closes = Array.from({ length: 20 }, (_, i) => 100 + i)
    const pts = rsi(makeCandles(closes), 14)
    expect(pts.length).toBeGreaterThan(0)
    expect(pts[pts.length - 1].value).toBe(100)
  })

  it('returns near 0 for a pure downtrend', () => {
    const closes = Array.from({ length: 20 }, (_, i) => 100 - i)
    const pts = rsi(makeCandles(closes), 14)
    expect(pts[pts.length - 1].value).toBe(0)
  })
})

describe('macd', () => {
  it('produces macd/signal/histogram once enough bars exist', () => {
    const closes = Array.from({ length: 60 }, (_, i) => 100 + Math.sin(i / 3) * 5 + i * 0.1)
    const { macd: line, signal, histogram } = macd(makeCandles(closes))
    expect(line.length).toBeGreaterThan(0)
    expect(signal.length).toBeGreaterThan(0)
    expect(histogram.length).toBe(line.length)
    const last = histogram[histogram.length - 1]
    const m = line[line.length - 1]
    const s = signal[signal.length - 1]
    expect(last.value).toBeCloseTo(m.value - s.value, 8)
  })
})
