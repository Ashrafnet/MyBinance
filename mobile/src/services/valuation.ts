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

/** Insert commas every 3 digits (ASCII), independent of Intl/locale quirks. */
function withThousands(intDigits: string): string {
  return intDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

function formatFixedGrouped(n: number, digits: number): string {
  const fixed = Math.abs(n).toFixed(digits)
  const [intPart, frac] = fixed.split('.')
  const grouped = withThousands(intPart)
  return frac != null ? `${grouped}.${frac}` : grouped
}

/** Fiat / USD amounts — always with thousands separators (e.g. $15,488.17). */
export function formatMoney(n: number, opts?: { signed?: boolean; digits?: number }): string {
  if (!Number.isFinite(n)) return '—'
  const digits = opts?.digits ?? 2
  const body = formatFixedGrouped(n, digits)
  if (opts?.signed) {
    if (n > 0) return `+$${body}`
    if (n < 0) return `-$${body}`
    return `$${body}`
  }
  return n < 0 ? `-$${body}` : `$${body}`
}

/** Numeric money without currency symbol (still with thousands separators). */
export function formatMoneyAmount(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return '—'
  const body = formatFixedGrouped(n, digits)
  return n < 0 ? `-${body}` : body
}

export function formatUnitPrice(price: number): string {
  if (!Number.isFinite(price) || price <= 0) return '—'
  if (price >= 1) return formatFixedGrouped(price, 2)
  if (price >= 0.01) {
    const fixed = price.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')
    const [intPart, frac] = fixed.split('.')
    const grouped = withThousands(intPart)
    return frac ? `${grouped}.${frac}` : grouped
  }
  const raw = price.toFixed(6).replace(/0+$/, '').replace(/\.$/, '')
  const [intPart, frac] = raw.split('.')
  const grouped = withThousands(intPart)
  return frac ? `${grouped}.${frac}` : grouped
}
