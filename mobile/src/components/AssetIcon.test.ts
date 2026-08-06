import { describe, expect, it } from 'vitest'
import { baseAsset } from './AssetIcon'

describe('baseAsset', () => {
  it('strips common quote suffixes', () => {
    expect(baseAsset('BTCUSDT')).toBe('BTC')
    expect(baseAsset('ethusdc')).toBe('ETH')
    expect(baseAsset('SOLBTC')).toBe('SOL')
    expect(baseAsset('BTCUSD')).toBe('BTC')
  })

  it('keeps bare assets (including stables)', () => {
    expect(baseAsset('USDT')).toBe('USDT')
    expect(baseAsset('BTC')).toBe('BTC')
    expect(baseAsset('BUSD')).toBe('BUSD')
  })

  it('strips Binance.id IDR quote when base is long enough', () => {
    expect(baseAsset('USDTID')).toBe('USDT')
    expect(baseAsset('BTCID')).toBe('BTC')
  })

  it('does not turn GRID into GR', () => {
    expect(baseAsset('GRID')).toBe('GRID')
  })
})
