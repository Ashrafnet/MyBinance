import type { AccountCredentials, OrderRow, OrderSide, OrderStatus, OrderType } from '../../domain/types'
import { wsPrivate } from '../endpoints'
import { assertOkxNotRateLimited, noteOkxApiError } from './rateLimit'
import { signOkx } from './sign'
import { okxTimestampIso, syncOkxServerTime } from './serverTime'

export type OkxUserStreamHandlers = {
  onBalances: (rows: Array<{ asset: string; free: number; locked: number; total: number }>) => void
  onOrder: (order: OrderRow) => void
}

function toAppSymbol(instId: string): string {
  return instId.replace('-', '')
}

function mapOkxOrder(o: Record<string, string>, accountId: string): OrderRow | null {
  const state = (o.state ?? '').toLowerCase()
  let status: OrderStatus = 'open'
  if (state === 'filled') status = 'filled'
  else if (state === 'canceled') status = 'canceled'
  else if (state === 'partially_filled') status = 'partial'
  else if (state === 'live') status = 'open'
  else return null

  const side: OrderSide = o.side === 'buy' ? 'buy' : 'sell'
  const type: OrderType = o.ordType === 'market' ? 'market' : 'limit'
  const ordId = o.ordId
  if (!ordId) return null

  return {
    id: `okx:${accountId}:${ordId}`,
    accountId,
    exchange: 'okx',
    symbol: toAppSymbol(o.instId ?? ''),
    side,
    type,
    price: o.px ? Number(o.px) : null,
    quantity: Number(o.sz ?? 0),
    filledQuantity: Number(o.accFillSz ?? 0),
    status,
    createdAt: Number(o.cTime ?? Date.now()),
    updatedAt: Number(o.uTime ?? o.cTime ?? Date.now()),
  }
}

/**
 * OKX private WS — account + Spot order channels after login.
 */
export function subscribeOkxUserStream(
  creds: AccountCredentials,
  accountId: string,
  handlers: OkxUserStreamHandlers,
): () => void {
  if (!creds.passphrase) return () => {}

  let sock: WebSocket | null = null
  let stopped = false

  const stop = () => {
    stopped = true
    sock?.close()
    sock = null
  }

  void (async () => {
    try {
      assertOkxNotRateLimited()
      await syncOkxServerTime()
      if (stopped) return

      const timestamp = okxTimestampIso()
      const sign = await signOkx(timestamp, 'GET', '/users/self/verify', '', creds.secretKey)

      sock = new WebSocket(wsPrivate('okx'))
      sock.onopen = () => {
        sock?.send(
          JSON.stringify({
            op: 'login',
            args: [
              {
                apiKey: creds.apiKey,
                passphrase: creds.passphrase,
                timestamp,
                sign,
              },
            ],
          }),
        )
      }
      sock.onmessage = (ev) => {
        try {
          const msg = JSON.parse(String(ev.data)) as {
            event?: string
            code?: string
            msg?: string
            arg?: { channel?: string }
            data?: Array<Record<string, string>>
          }
          if (msg.event === 'login') {
            if (msg.code && msg.code !== '0') {
              noteOkxApiError(msg.msg || 'OKX WS login failed', msg.code)
              stop()
              return
            }
            sock?.send(
              JSON.stringify({
                op: 'subscribe',
                args: [
                  { channel: 'account' },
                  { channel: 'orders', instType: 'SPOT' },
                ],
              }),
            )
            return
          }
          if (msg.event === 'error') {
            noteOkxApiError(msg.msg || 'OKX WS error', msg.code)
            return
          }
          const channel = msg.arg?.channel
          const rows = msg.data ?? []
          if (channel === 'account') {
            for (const row of rows) {
              const details = (row as unknown as { details?: Array<Record<string, string>> }).details
              if (!details?.length) continue
              handlers.onBalances(
                details.map((d) => {
                  const free = Number(d.availBal ?? 0)
                  const locked = Number(d.frozenBal ?? 0)
                  const total = Number(d.cashBal || free + locked)
                  return { asset: d.ccy, free, locked, total }
                }),
              )
            }
          } else if (channel === 'orders') {
            for (const row of rows) {
              const order = mapOkxOrder(row, accountId)
              if (order) handlers.onOrder(order)
            }
          }
        } catch {
          /* ignore */
        }
      }
    } catch (e) {
      if (e instanceof Error) noteOkxApiError(e.message)
    }
  })()

  return stop
}
