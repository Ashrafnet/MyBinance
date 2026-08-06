import { describe, expect, it } from 'vitest'
import type { TickerRow } from '../domain/types'
import { rankTickers } from './marketRank'

function t(symbol: string, changePct24h: number, quoteVolume = 0): TickerRow {
  return { symbol, last: 1, changePct24h, quoteVolume, updatedAt: 0 }
}

describe('rankTickers', () => {
  const sample = [
    t('BTCUSDT', 5, 100),
    t('ETHUSDT', -2, 80),
    t('SOLUSDT', 12, 50),
    t('ADAUSDT', -8, 200),
    t('BNBUSDT', Number.NaN, 10),
  ]

  it('ranks gainers by change desc', () => {
    const rows = rankTickers(sample, 'gainers', 3)
    expect(rows.map((r) => r.symbol)).toEqual(['SOLUSDT', 'BTCUSDT', 'ETHUSDT'])
  })

  it('ranks losers by change asc', () => {
    const rows = rankTickers(sample, 'losers', 2)
    expect(rows.map((r) => r.symbol)).toEqual(['ADAUSDT', 'ETHUSDT'])
  })

  it('ranks trending by volume then abs change', () => {
    const rows = rankTickers(sample, 'trending', 3)
    expect(rows[0].symbol).toBe('ADAUSDT')
    expect(rows.map((r) => r.symbol)).not.toContain('BNBUSDT')
  })
})
