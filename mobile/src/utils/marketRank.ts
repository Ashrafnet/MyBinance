import type { TickerRow } from '../domain/types'

export type MarketCategory = 'trending' | 'gainers' | 'losers'

function finiteChange(t: TickerRow) {
  return Number.isFinite(t.changePct24h)
}

function usdtPairs(tickers: TickerRow[]) {
  return tickers.filter((t) => t.symbol.includes('USDT') && finiteChange(t))
}

function symbolBase(symbol: string): string {
  const s = symbol.toUpperCase()
  for (const q of ['USDT', 'USDC', 'BUSD', 'FDUSD'] as const) {
    if (s.length > q.length && s.endsWith(q)) return s.slice(0, -q.length)
  }
  return s
}

export function rankTickers(
  tickers: TickerRow[],
  category: MarketCategory,
  limit = 40,
): TickerRow[] {
  const list = usdtPairs(tickers)
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

/** Search all USDT markets (not just the current category top-N). */
export function searchTickers(tickers: TickerRow[], query: string, limit = 80): TickerRow[] {
  const qq = query.trim().toLowerCase()
  if (!qq) return []

  const scored = usdtPairs(tickers)
    .map((t) => {
      const symbol = t.symbol.toLowerCase()
      const base = symbolBase(t.symbol).toLowerCase()
      let score = 0
      if (base === qq || symbol === `${qq}usdt`) score = 300
      else if (base.startsWith(qq) || symbol.startsWith(qq)) score = 200
      else if (base.includes(qq) || symbol.includes(qq)) score = 100
      else return null
      return { t, score }
    })
    .filter((x): x is { t: TickerRow; score: number } => x != null)

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return (b.t.quoteVolume ?? 0) - (a.t.quoteVolume ?? 0)
  })

  return scored.slice(0, limit).map((x) => x.t)
}
