import { describe, expect, it } from 'vitest'
import { valueBalances } from './valuation'

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
