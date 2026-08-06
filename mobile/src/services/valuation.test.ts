import { describe, expect, it } from 'vitest'
import { formatUnitPrice, unitPriceUsdt, valueBalances } from './valuation'

describe('valueBalances', () => {
  it('values USDT and BTC via BTCUSDT', () => {
    const rows = valueBalances(
      [
        { asset: 'USDT', free: 100, locked: 0, total: 100, usdtValue: 0, btcValue: 0 },
        { asset: 'BTC', free: 1, locked: 0, total: 1, usdtValue: 0, btcValue: 0 },
      ],
      [{ symbol: 'BTCUSDT', last: 50000, changePct24h: 0, updatedAt: 1 }],
    )
    expect(rows[0].usdtValue).toBe(100)
    expect(rows[1].usdtValue).toBe(50000)
    expect(rows[1].btcValue).toBe(1)
  })
})

describe('unitPriceUsdt', () => {
  it('prefers USDT ticker then falls back to value/total', () => {
    const tickers = new Map([['LSKUSDT', 0.0749]])
    expect(unitPriceUsdt('LSK', 100, 1, tickers)).toBe(0.0749)
    expect(unitPriceUsdt('FOO', 10, 2.5, new Map())).toBe(0.25)
    expect(unitPriceUsdt('USDT', 50, 50, new Map())).toBe(1)
  })
})

describe('formatUnitPrice', () => {
  it('picks decimals by magnitude', () => {
    expect(formatUnitPrice(65000)).toMatch(/65/)
    expect(formatUnitPrice(1.234)).toBe('1.23')
    expect(formatUnitPrice(0.0749)).toBe('0.0749')
  })
})
