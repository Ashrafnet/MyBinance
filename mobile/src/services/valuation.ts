import type { BalanceRow, TickerRow } from '../domain/types'

export function valueBalances(balances: BalanceRow[], tickers: TickerRow[]): BalanceRow[] {
  const bySymbol = new Map(tickers.map((t) => [t.symbol, t.last]))
  const btcUsdt = bySymbol.get('BTCUSDT') ?? 0

  return balances.map((b) => {
    let usdtValue = 0
    if (b.asset === 'USDT' || b.asset === 'BUSD' || b.asset === 'USD') {
      usdtValue = b.total
    } else if (bySymbol.has(`${b.asset}USDT`)) {
      usdtValue = b.total * (bySymbol.get(`${b.asset}USDT`) ?? 0)
    } else if (bySymbol.has(`${b.asset}BTC`) && btcUsdt) {
      usdtValue = b.total * (bySymbol.get(`${b.asset}BTC`) ?? 0) * btcUsdt
    }
    const btcValue = btcUsdt > 0 ? usdtValue / btcUsdt : 0
    return { ...b, usdtValue, btcValue }
  })
}

export function sumUsdt(balances: BalanceRow[]): number {
  return balances.reduce((s, b) => s + b.usdtValue, 0)
}

export function sumBtc(balances: BalanceRow[]): number {
  return balances.reduce((s, b) => s + b.btcValue, 0)
}

export function unitPriceUsdt(
  asset: string,
  total: number,
  usdtValue: number,
  tickersBySymbol: Map<string, number>,
): number | null {
  if (asset === 'USDT' || asset === 'BUSD' || asset === 'USD' || asset === 'FDUSD' || asset === 'TUSD') {
    return 1
  }
  const usdtPair = tickersBySymbol.get(`${asset}USDT`)
  if (usdtPair && usdtPair > 0) return usdtPair

  const btcPair = tickersBySymbol.get(`${asset}BTC`)
  const btcUsdt = tickersBySymbol.get('BTCUSDT') ?? 0
  if (btcPair && btcPair > 0 && btcUsdt > 0) return btcPair * btcUsdt

  if (total > 0 && usdtValue > 0) return usdtValue / total
  return null
}

export function formatUnitPrice(price: number): string {
  if (!Number.isFinite(price) || price <= 0) return '—'
  if (price >= 1000) return price.toLocaleString(undefined, { maximumFractionDigits: 2 })
  if (price >= 1) return price.toFixed(2)
  if (price >= 0.01) return price.toFixed(4)
  return price.toFixed(6).replace(/0+$/, '').replace(/\.$/, '')
}
