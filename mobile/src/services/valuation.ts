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
