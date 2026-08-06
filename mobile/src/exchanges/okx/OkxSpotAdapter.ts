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
import { signOkx } from './sign'

const REST = 'https://www.okx.com'
const WS = 'wss://ws.okx.com:8443/ws/v5/public'

type OkxResp<T> = { code: string; msg: string; data: T }

async function privateRequest<T>(
  creds: AccountCredentials,
  method: 'GET' | 'POST',
  path: string,
  bodyObj?: Record<string, unknown>,
): Promise<T> {
  if (!creds.passphrase) throw new ExchangeError('OKX passphrase required')
  const body = bodyObj ? JSON.stringify(bodyObj) : ''
  const timestamp = new Date().toISOString()
  const sign = await signOkx(timestamp, method, path, body, creds.secretKey)
  const url = `${REST}${path}`
  const data = await httpRequest<OkxResp<T>>({
    url,
    method,
    headers: {
      'OK-ACCESS-KEY': creds.apiKey,
      'OK-ACCESS-SIGN': sign,
      'OK-ACCESS-TIMESTAMP': timestamp,
      'OK-ACCESS-PASSPHRASE': creds.passphrase,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body || undefined,
  })
  if (data.code !== '0') throw new ExchangeError(data.msg || 'OKX error', data.code)
  return data.data
}

function toBinanceLikeSymbol(instId: string): string {
  return instId.replace('-', '')
}

function fromAppSymbol(symbol: string): string {
  if (symbol.includes('-')) return symbol
  if (symbol.endsWith('USDT')) return `${symbol.slice(0, -4)}-USDT`
  if (symbol.endsWith('BTC')) return `${symbol.slice(0, -3)}-BTC`
  return symbol
}

function mapOrder(o: Record<string, string>, accountId: string): OrderRow {
  const state = (o.state ?? '').toLowerCase()
  let status: OrderRow['status'] = 'open'
  if (state === 'filled') status = 'filled'
  else if (state === 'canceled') status = 'canceled'
  else if (state === 'partially_filled') status = 'partial'

  return {
    id: `okx:${accountId}:${o.ordId}`,
    accountId,
    exchange: 'okx',
    symbol: toBinanceLikeSymbol(o.instId),
    side: o.side === 'buy' ? 'buy' : 'sell',
    type: o.ordType === 'market' ? 'market' : 'limit',
    price: o.px ? Number(o.px) : null,
    quantity: Number(o.sz ?? 0),
    filledQuantity: Number(o.accFillSz ?? 0),
    status,
    createdAt: Number(o.cTime ?? Date.now()),
    updatedAt: Number(o.uTime ?? o.cTime ?? Date.now()),
  }
}

export class OkxSpotAdapter implements IExchange {
  readonly id = 'okx' as const

  async validateCredentials(creds: AccountCredentials): Promise<void> {
    await privateRequest(creds, 'GET', '/api/v5/account/balance')
  }

  async fetchBalances(creds: AccountCredentials): Promise<BalanceRow[]> {
    const data = await privateRequest<Array<{ details?: Array<{ ccy: string; availBal: string; frozenBal: string; cashBal: string }> }>>(
      creds,
      'GET',
      '/api/v5/account/balance',
    )
    const details = data[0]?.details ?? []
    return details
      .map((d) => {
        const free = Number(d.availBal)
        const locked = Number(d.frozenBal)
        const total = Number(d.cashBal || free + locked)
        return { asset: d.ccy, free, locked, total, usdtValue: 0, btcValue: 0 }
      })
      .filter((b) => b.total > 0)
  }

  async fetchOpenOrders(creds: AccountCredentials, accountId: string): Promise<OrderRow[]> {
    const data = await privateRequest<Array<Record<string, string>>>(
      creds,
      'GET',
      '/api/v5/trade/orders-pending?instType=SPOT',
    )
    return data.map((o) => mapOrder(o, accountId))
  }

  async fetchOrderHistory(creds: AccountCredentials, accountId: string): Promise<OrderRow[]> {
    const data = await privateRequest<Array<Record<string, string>>>(
      creds,
      'GET',
      '/api/v5/trade/orders-history?instType=SPOT&limit=50',
    )
    return data.map((o) => mapOrder(o, accountId))
  }

  async placeOrder(creds: AccountCredentials, req: PlaceOrderRequest): Promise<OrderRow> {
    const instId = fromAppSymbol(req.symbol)
    const body: Record<string, unknown> = {
      instId,
      tdMode: 'cash',
      side: req.side,
      ordType: req.type,
      sz: String(req.quantity),
    }
    if (req.type === 'limit') {
      if (req.price == null) throw new ExchangeError('Limit order requires price')
      body.px = String(req.price)
    }
    const data = await privateRequest<Array<Record<string, string>>>(creds, 'POST', '/api/v5/trade/order', body)
    const ordId = data[0]?.ordId
    return {
      id: `okx:${req.accountId}:${ordId}`,
      accountId: req.accountId,
      exchange: 'okx',
      symbol: req.symbol,
      side: req.side,
      type: req.type,
      price: req.price ?? null,
      quantity: req.quantity,
      filledQuantity: 0,
      status: 'open',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
  }

  async cancelOrder(creds: AccountCredentials, req: CancelOrderRequest): Promise<void> {
    const ordId = req.orderId.includes(':') ? req.orderId.split(':').pop()! : req.orderId
    await privateRequest(creds, 'POST', '/api/v5/trade/cancel-order', {
      instId: fromAppSymbol(req.symbol),
      ordId,
    })
  }

  async fetchTickers(): Promise<TickerRow[]> {
    const data = await httpRequest<OkxResp<Array<{ instId: string; last: string; sodUtc0: string; volCcy24h: string }>>>({
      url: `${REST}/api/v5/market/tickers?instType=SPOT`,
    })
    if (data.code !== '0') throw new ExchangeError(data.msg || 'OKX ticker error', data.code)
    const now = Date.now()
    return data.data.map((t) => {
      const last = Number(t.last)
      const open = Number(t.sodUtc0) || last
      return {
        symbol: toBinanceLikeSymbol(t.instId),
        last,
        changePct24h: open ? ((last - open) / open) * 100 : 0,
        quoteVolume: Number(t.volCcy24h),
        updatedAt: now,
      }
    })
  }

  async fetchCandles(symbol: string, interval: string, limit = 200): Promise<Candle[]> {
    const bar =
      interval === '1m' ? '1m' : interval === '5m' ? '5m' : interval === '1h' ? '1H' : interval === '1d' ? '1D' : interval
    const instId = fromAppSymbol(symbol)
    const data = await httpRequest<OkxResp<string[][]>>({
      url: `${REST}/api/v5/market/candles?instId=${encodeURIComponent(instId)}&bar=${bar}&limit=${limit}`,
    })
    if (data.code !== '0') throw new ExchangeError(data.msg || 'OKX candles error', data.code)
    return data.data
      .map((k) => ({
        time: Math.floor(Number(k[0]) / 1000),
        open: Number(k[1]),
        high: Number(k[2]),
        low: Number(k[3]),
        close: Number(k[4]),
        volume: Number(k[5]),
      }))
      .reverse()
  }

  subscribeTickers(onUpdate: (t: TickerRow) => void): () => void {
    const ws = new WebSocket(WS)
    ws.onopen = () => {
      ws.send(JSON.stringify({ op: 'subscribe', args: [{ channel: 'tickers', instType: 'SPOT' }] }))
    }
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as {
          data?: Array<{ instId: string; last: string; sodUtc0: string; volCcy24h: string }>
        }
        if (!msg.data) return
        const now = Date.now()
        for (const t of msg.data) {
          const last = Number(t.last)
          const open = Number(t.sodUtc0) || last
          onUpdate({
            symbol: toBinanceLikeSymbol(t.instId),
            last,
            changePct24h: open ? ((last - open) / open) * 100 : 0,
            quoteVolume: Number(t.volCcy24h),
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
    const bar =
      interval === '1m' ? '1m' : interval === '5m' ? '5m' : interval === '1h' ? '1H' : interval === '1d' ? '1D' : interval
    const instId = fromAppSymbol(symbol)
    const ws = new WebSocket(WS)
    ws.onopen = () => {
      ws.send(JSON.stringify({ op: 'subscribe', args: [{ channel: 'candle' + bar, instId }] }))
    }
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as { data?: string[][] }
        const k = msg.data?.[0]
        if (!k) return
        onUpdate({
          time: Math.floor(Number(k[0]) / 1000),
          open: Number(k[1]),
          high: Number(k[2]),
          low: Number(k[3]),
          close: Number(k[4]),
          volume: Number(k[5]),
        })
      } catch {
        /* ignore */
      }
    }
    return () => ws.close()
  }
}
