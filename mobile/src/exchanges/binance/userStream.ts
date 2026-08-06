import type { AccountCredentials, OrderRow, OrderSide, OrderStatus, OrderType } from '../../domain/types'
import { restBase, wsPrivate } from '../endpoints'
import { httpRequest } from '../http'
import { assertBinanceNotBanned, noteBinanceApiError } from './rateLimit'

export type BinanceUserStreamHandlers = {
  onBalances: (rows: Array<{ asset: string; free: number; locked: number; total: number }>) => void
  onOrder: (order: OrderRow) => void
}

async function createListenKey(apiKey: string): Promise<string> {
  assertBinanceNotBanned()
  try {
    const data = await httpRequest<{ listenKey: string }>({
      url: `${restBase('binance')}/api/v3/userDataStream`,
      method: 'POST',
      headers: { 'X-MBX-APIKEY': apiKey },
    })
    return data.listenKey
  } catch (e) {
    if (e instanceof Error) noteBinanceApiError(e.message)
    throw e
  }
}

async function keepAliveListenKey(apiKey: string, listenKey: string) {
  assertBinanceNotBanned()
  try {
    await httpRequest({
      url: `${restBase('binance')}/api/v3/userDataStream?listenKey=${encodeURIComponent(listenKey)}`,
      method: 'PUT',
      headers: { 'X-MBX-APIKEY': apiKey },
    })
  } catch (e) {
    if (e instanceof Error) noteBinanceApiError(e.message)
  }
}

function mapExecReport(o: Record<string, unknown>, accountId: string): OrderRow | null {
  const statusRaw = String(o.X ?? '').toUpperCase()
  let status: OrderStatus = 'open'
  if (statusRaw === 'FILLED') status = 'filled'
  else if (statusRaw === 'CANCELED' || statusRaw === 'EXPIRED') status = 'canceled'
  else if (statusRaw === 'REJECTED') status = 'rejected'
  else if (statusRaw === 'PARTIALLY_FILLED') status = 'partial'
  else if (statusRaw === 'NEW' || statusRaw === 'PENDING_NEW') status = 'open'
  else return null

  const typeRaw = String(o.o ?? 'LIMIT').toUpperCase()
  const side: OrderSide = String(o.S).toLowerCase() === 'buy' ? 'buy' : 'sell'
  const type: OrderType = typeRaw.includes('MARKET') ? 'market' : 'limit'
  const orderId = String(o.i ?? '')
  if (!orderId) return null

  return {
    id: `binance:${accountId}:${orderId}`,
    accountId,
    exchange: 'binance',
    symbol: String(o.s ?? ''),
    side,
    type,
    price: o.p != null && String(o.p) !== '0' ? Number(o.p) : null,
    quantity: Number(o.q ?? 0),
    filledQuantity: Number(o.z ?? 0),
    status,
    createdAt: Number(o.O ?? o.T ?? Date.now()),
    updatedAt: Number(o.T ?? Date.now()),
  }
}

/**
 * Binance Spot user data stream — balances + order updates with almost no REST weight
 * (listenKey create/keepalive only).
 */
export function subscribeBinanceUserStream(
  creds: AccountCredentials,
  accountId: string,
  handlers: BinanceUserStreamHandlers,
): () => void {
  let sock: WebSocket | null = null
  let stopped = false
  let keepTimer: number | undefined
  let listenKey = ''

  const stop = () => {
    stopped = true
    if (keepTimer != null) window.clearInterval(keepTimer)
    sock?.close()
    sock = null
  }

  void (async () => {
    try {
      listenKey = await createListenKey(creds.apiKey)
      if (stopped) return
      sock = new WebSocket(`${wsPrivate('binance')}/${listenKey}`)
      sock.onmessage = (ev) => {
        try {
          const msg = JSON.parse(String(ev.data)) as Record<string, unknown>
          const event = String(msg.e ?? '')
          if (event === 'outboundAccountPosition') {
            const bals = (msg.B as Array<{ a: string; f: string; l: string }> | undefined) ?? []
            handlers.onBalances(
              bals.map((b) => {
                const free = Number(b.f)
                const locked = Number(b.l)
                return { asset: b.a, free, locked, total: free + locked }
              }),
            )
          } else if (event === 'executionReport') {
            const order = mapExecReport(msg, accountId)
            if (order) handlers.onOrder(order)
          }
        } catch {
          /* ignore bad frames */
        }
      }
      keepTimer = window.setInterval(() => {
        void keepAliveListenKey(creds.apiKey, listenKey)
      }, 30 * 60 * 1000)
    } catch {
      /* stream optional — REST sync remains fallback */
    }
  })()

  return stop
}
