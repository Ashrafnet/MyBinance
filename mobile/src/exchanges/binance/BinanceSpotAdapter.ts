import type {
  AccountCredentials,
  BalanceRow,
  CancelOrderRequest,
  Candle,
  OrderRow,
  PlaceOrderRequest,
  TickerRow,
} from '../../domain/types'
import { httpRequest } from '../http'
import type { IExchange } from '../types'
import { ExchangeError } from '../types'
import { signBinanceQuery } from './sign'

const REST = 'https://api.binance.com'
const WS = 'wss://stream.binance.com:9443/ws'

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
  const url = `${REST}${path}?${total}&signature=${signature}`
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
    if (!symbol) return []
    const data = await signedRequest<Array<Record<string, unknown>>>(creds, 'GET', '/api/v3/allOrders', {
      symbol,
      limit: 50,
    })
    return data.map((o) => mapOrder(o, accountId)).filter((o) => o.status !== 'open' && o.status !== 'partial')
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
      url: `${REST}/api/v3/ticker/24hr`,
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
    const url = `${REST}/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=${limit}`
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

  async fetchHistory(creds: AccountCredentials, accountId: string) {
    const end = Date.now()
    const start = end - 30 * 24 * 60 * 60 * 1000
    try {
      const data = await signedRequest<{
        snapshotVos?: Array<{ updateTime: number; data: { totalAssetOfBtc: string } }>
      }>(creds, 'GET', '/sapi/v1/accountSnapshot', {
        type: 'SPOT',
        startTime: start,
        endTime: end,
        limit: 30,
      })
      const tickers = await this.fetchTickers()
      const btcUsdt = tickers.find((t) => t.symbol === 'BTCUSDT')?.last ?? 0
      return (data.snapshotVos ?? []).map((s) => {
        const btc = Number(s.data.totalAssetOfBtc)
        const date = new Date(s.updateTime).toISOString().slice(0, 10)
        return {
          id: `${accountId}:${date}`,
          accountId,
          date,
          usdtValue: btc * btcUsdt,
        }
      })
    } catch {
      return []
    }
  }

  subscribeTickers(onUpdate: (t: TickerRow) => void): () => void {
    const ws = new WebSocket(`${WS}/!miniTicker@arr`)
    ws.onmessage = (ev) => {
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
    return () => ws.close()
  }

  subscribeCandles(symbol: string, interval: string, onUpdate: (c: Candle) => void): () => void {
    const stream = `${symbol.toLowerCase()}@kline_${interval}`
    const ws = new WebSocket(`${WS}/${stream}`)
    ws.onmessage = (ev) => {
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
    return () => ws.close()
  }
}
