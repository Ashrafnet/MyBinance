import type { TickerRow } from '../domain/types'

export type MarketCategory = 'trending' | 'gainers' | 'losers'

function finiteChange(t: TickerRow) {
  return Number.isFinite(t.changePct24h)
}

export function rankTickers(
  tickers: TickerRow[],
  category: MarketCategory,
  limit = 40,
): TickerRow[] {
  const list = tickers.filter((t) => t.symbol.includes('USDT') && finiteChange(t))
  switch (category) {
    case 'gainers':
      list.sort((a, b) => b.changePct24h - a.changePct24h)
      break
    case 'losers':
      list.sort((a, b) => a.changePct24h - b.changePct24h)
      break
    case 'trending':
    default:
      list.sort((a, b) => {
        const vol = (b.quoteVolume ?? 0) - (a.quoteVolume ?? 0)
        if (vol !== 0) return vol
        return Math.abs(b.changePct24h) - Math.abs(a.changePct24h)
      })
      break
  }
  return list.slice(0, limit)
}
