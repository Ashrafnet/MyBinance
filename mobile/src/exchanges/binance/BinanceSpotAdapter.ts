import type {
  AccountCredentials,
  BalanceRow,
  CancelOrderRequest,
  Candle,
  OrderRow,
  PlaceOrderRequest,
  TickerRow,
} from '../../domain/types'
import { sumUsdt, valueBalances } from '../../services/valuation'
import { restBase, wsPublic } from '../endpoints'
import { httpRequest } from '../http'
import type { IExchange } from '../types'
import { ExchangeError } from '../types'
import { signBinanceQuery } from './sign'

function rest() {
  return restBase('binance')
}

function ws() {
  return wsPublic('binance')
}

async function signedRequest<T>(
  creds: AccountCredentials,
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  params: Record<string, string | number> = {},
): Promise<T> {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) q.set(k, String(v))
  q.set('timestamp', String(Date.now()))
  q.set('recvWindow', '60000')
  const total = q.toString()
  const signature = await signBinanceQuery(total, creds.secretKey)
  const url = `${rest()}${path}?${total}&signature=${signature}`
  return httpRequest<T>({
    url,
    method,
    headers: { 'X-MBX-APIKEY': creds.apiKey },
  })
}

function mapOrder(o: Record<string, unknown>, accountId: string): OrderRow {
  const statusRaw = String(o.status ?? '').toUpperCase()
  let status: OrderRow['status'] = 'open'
  if (statusRaw === 'FILLED') status = 'filled'
  else if (statusRaw === 'CANCELED' || statusRaw === 'EXPIRED') status = 'canceled'
  else if (statusRaw === 'REJECTED') status = 'rejected'
  else if (statusRaw === 'PARTIALLY_FILLED') status = 'partial'

  const typeRaw = String(o.type ?? 'LIMIT').toUpperCase()
  return {
    id: `binance:${accountId}:${o.orderId}`,
    accountId,
    exchange: 'binance',
    symbol: String(o.symbol),
    side: String(o.side).toLowerCase() === 'buy' ? 'buy' : 'sell',
    type: typeRaw.includes('MARKET') ? 'market' : 'limit',
    price: o.price != null ? Number(o.price) : null,
    quantity: Number(o.origQty ?? 0),
    filledQuantity: Number(o.executedQty ?? 0),
    status,
    createdAt: Number(o.time ?? o.updateTime ?? Date.now()),
    updatedAt: Number(o.updateTime ?? o.time ?? Date.now()),
  }
}

export class BinanceSpotAdapter implements IExchange {
  readonly id = 'binance' as const

  async validateCredentials(creds: AccountCredentials): Promise<void> {
    await signedRequest(creds, 'GET', '/api/v3/account')
  }

  async fetchBalances(creds: AccountCredentials): Promise<BalanceRow[]> {
    const data = await signedRequest<{ balances: Array<{ asset: string; free: string; locked: string }> }>(
      creds,
      'GET',
      '/api/v3/account',
    )
    return data.balances
      .map((b) => {
        const free = Number(b.free)
        const locked = Number(b.locked)
        const total = free + locked
        return { asset: b.asset, free, locked, total, usdtValue: 0, btcValue: 0 }
      })
      .filter((b) => b.total > 0)
  }

  async fetchOpenOrders(creds: AccountCredentials, accountId: string, symbol?: string): Promise<OrderRow[]> {
    const params: Record<string, string | number> = {}
    if (symbol) params.symbol = symbol
    const data = await signedRequest<Array<Record<string, unknown>>>(
      creds,
      'GET',
      '/api/v3/openOrders',
      params,
    )
    return data.map((o) => mapOrder(o, accountId))
  }

  async fetchOrderHistory(creds: AccountCredentials, accountId: string, symbol?: string): Promise<OrderRow[]> {
    // Binance /api/v3/allOrders requires a symbol — when omitted, pull history for held assets.
    const symbols = symbol
      ? [symbol.toUpperCase()]
      : (await this.fetchBalances(creds))
          .map((b) => b.asset.toUpperCase())
          .filter((a) => !['USDT', 'USDC', 'BUSD', 'FDUSD', 'TUSD', 'DAI', 'USD'].includes(a))
          .map((a) => `${a}USDT`)
          .slice(0, 30)

    const byId = new Map<string, OrderRow>()
    for (const sym of symbols) {
      try {
        const data = await signedRequest<Array<Record<string, unknown>>>(creds, 'GET', '/api/v3/allOrders', {
          symbol: sym,
          limit: 50,
        })
        for (const row of data.map((o) => mapOrder(o, accountId))) {
          if (row.status === 'open' || row.status === 'partial') continue
          byId.set(row.id, row)
        }
      } catch {
        /* no USDT market or no trades for this asset */
      }
    }
    return [...byId.values()].sort((a, b) => b.updatedAt - a.updatedAt)
  }

  async placeOrder(creds: AccountCredentials, req: PlaceOrderRequest): Promise<OrderRow> {
    const params: Record<string, string | number> = {
      symbol: req.symbol,
      side: req.side.toUpperCase(),
      type: req.type.toUpperCase(),
      quantity: req.quantity,
    }
    if (req.type === 'limit') {
      if (req.price == null) throw new ExchangeError('Limit order requires price')
      params.price = req.price
      params.timeInForce = 'GTC'
    }
    const data = await signedRequest<Record<string, unknown>>(creds, 'POST', '/api/v3/order', params)
    return mapOrder(data, req.accountId)
  }

  async cancelOrder(creds: AccountCredentials, req: CancelOrderRequest): Promise<void> {
    const orderId = req.orderId.includes(':') ? req.orderId.split(':').pop()! : req.orderId
    await signedRequest(creds, 'DELETE', '/api/v3/order', { symbol: req.symbol, orderId })
  }

  async fetchTickers(): Promise<TickerRow[]> {
    const data = await httpRequest<Array<{ symbol: string; lastPrice: string; priceChangePercent: string; quoteVolume: string }>>({
      url: `${rest()}/api/v3/ticker/24hr`,
    })
    const now = Date.now()
    return data.map((t) => ({
      symbol: t.symbol,
      last: Number(t.lastPrice),
      changePct24h: Number(t.priceChangePercent),
      quoteVolume: Number(t.quoteVolume),
      updatedAt: now,
    }))
  }

  async fetchCandles(symbol: string, interval: string, limit = 200): Promise<Candle[]> {
    const url = `${rest()}/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=${limit}`
    const data = await httpRequest<Array<Array<string | number>>>({ url })
    return data.map((k) => ({
      time: Math.floor(Number(k[0]) / 1000),
      open: Number(k[1]),
      high: Number(k[2]),
      low: Number(k[3]),
      close: Number(k[4]),
      volume: Number(k[5]),
    }))
  }

  async fetchHistory(
    creds: AccountCredentials,
    accountId: string,
    range?: { startTime: number; endTime: number },
  ) {
    type SnapshotResponse = {
      code?: number | string
      msg?: string
      snapshotVos?: Array<{
        updateTime: number
        data: {
          totalAssetOfBtc?: string
          balances?: Array<{ asset: string; free: string; locked: string }>
        }
      }>
    }

    // Binance: period must be < 30 days and within the last month.
    const end = range?.endTime ?? Date.now()
    const start = range?.startTime ?? end - 29 * 24 * 60 * 60 * 1000

    const pull = async (params: Record<string, string | number>) => {
      const data = await signedRequest<SnapshotResponse>(creds, 'GET', '/sapi/v1/accountSnapshot', params)
      if (data.code != null && Number(data.code) !== 200) {
        throw new ExchangeError(data.msg || `Snapshot code ${data.code}`, Number(data.code) || 400)
      }
      return data.snapshotVos ?? []
    }

    try {
      let snapshots: NonNullable<SnapshotResponse['snapshotVos']> = []
      try {
        snapshots = await pull({ type: 'SPOT', startTime: start, endTime: end, limit: 30 })
      } catch {
        // Fallback when the ranged query fails (weight / window quirks).
        snapshots = await pull({ type: 'SPOT', limit: 30 })
      }
      if (!snapshots.length) return []

      const tickers = await this.fetchTickers()
      const byDate = new Map<
        string,
        {
          id: string
          accountId: string
          date: string
          usdtValue: number
          btcValue: number
          capturedAt: number
          assets: Array<{
            asset: string
            free: number
            locked: number
            total: number
            usdtValue: number
            btcValue: number
          }>
        }
      >()

      for (const s of snapshots) {
        const date = new Date(s.updateTime).toISOString().slice(0, 10)
        const raw = (s.data?.balances ?? [])
          .map((b) => {
            const free = Number(b.free)
            const locked = Number(b.locked)
            const total = free + locked
            return { asset: b.asset, free, locked, total, usdtValue: 0, btcValue: 0 }
          })
          .filter((b) => b.total > 0 && Number.isFinite(b.total))

        const valued = valueBalances(raw, tickers).sort((a, b) => b.usdtValue - a.usdtValue)
        let usdtValue = sumUsdt(valued)
        let btcValue = valued.reduce((sum, b) => sum + b.btcValue, 0)
        if (usdtValue <= 0 && s.data?.totalAssetOfBtc) {
          const btcUsdt = tickers.find((t) => t.symbol === 'BTCUSDT')?.last ?? 0
          usdtValue = Number(s.data.totalAssetOfBtc) * btcUsdt
          btcValue = Number(s.data.totalAssetOfBtc)
        }

        const prev = byDate.get(date)
        if (prev && (prev.capturedAt ?? 0) > s.updateTime) continue

        byDate.set(date, {
          id: `${accountId}:${date}`,
          accountId,
          date,
          usdtValue,
          btcValue,
          capturedAt: s.updateTime,
          assets: valued.map((b) => ({
            asset: b.asset,
            free: b.free,
            locked: b.locked,
            total: b.total,
            usdtValue: b.usdtValue,
            btcValue: b.btcValue,
          })),
        })
      }

      return [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date))
    } catch {
      return []
    }
  }

  subscribeTickers(onUpdate: (t: TickerRow) => void): () => void {
    const sock = new WebSocket(`${ws()}/!miniTicker@arr`)
    sock.onmessage = (ev) => {
      try {
        const arr = JSON.parse(String(ev.data)) as Array<{ s: string; c: string; o: string }>
        const now = Date.now()
        for (const t of arr) {
          const last = Number(t.c)
          const open = Number(t.o) || last
          onUpdate({
            symbol: t.s,
            last,
            changePct24h: open ? ((last - open) / open) * 100 : 0,
            updatedAt: now,
          })
        }
      } catch {
        /* ignore */
      }
    }
    return () => sock.close()
  }

  subscribeCandles(symbol: string, interval: string, onUpdate: (c: Candle) => void): () => void {
    const stream = `${symbol.toLowerCase()}@kline_${interval}`
    const sock = new WebSocket(`${ws()}/${stream}`)
    sock.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as { k: { t: number; o: string; h: string; l: string; c: string; v: string } }
        const k = msg.k
        onUpdate({
          time: Math.floor(k.t / 1000),
          open: Number(k.o),
          high: Number(k.h),
          low: Number(k.l),
          close: Number(k.c),
          volume: Number(k.v),
        })
      } catch {
        /* ignore */
      }
    }
    return () => sock.close()
  }
}
