import type { AccountMeta, BalanceRow, OrderRow } from '../domain/types'
import { subscribeBinanceUserStream } from '../exchanges/binance/userStream'
import { subscribeOkxUserStream } from '../exchanges/okx/userStream'
import {
  cacheGetBalances,
  cacheGetTickers,
  cacheUpsertBalances,
  cacheUpsertOrders,
  listAccounts,
} from '../storage/cache'
import { getCredentials } from '../storage/vault'
import { valueBalances } from './valuation'

export const ACCOUNT_LIVE_EVENT = 'myex:account-live'

function emitLive(accountId: string, kind: 'balances' | 'orders') {
  window.dispatchEvent(
    new CustomEvent(ACCOUNT_LIVE_EVENT, { detail: { accountId, kind, at: Date.now() } }),
  )
}

async function applyBalanceDelta(
  accountId: string,
  rows: Array<{ asset: string; free: number; locked: number; total: number }>,
) {
  const prev = await cacheGetBalances(accountId)
  const map = new Map(prev.map((b) => [b.asset, { ...b }]))
  for (const r of rows) {
    if (r.total <= 0 && !map.has(r.asset)) continue
    map.set(r.asset, {
      asset: r.asset,
      free: r.free,
      locked: r.locked,
      total: r.total,
      usdtValue: map.get(r.asset)?.usdtValue ?? 0,
      btcValue: map.get(r.asset)?.btcValue ?? 0,
    })
  }
  const tickers = await cacheGetTickers()
  const valued = valueBalances([...map.values()] as BalanceRow[], tickers).filter((b) => b.total > 0)
  await cacheUpsertBalances(accountId, valued)
  emitLive(accountId, 'balances')
}

async function applyOrder(order: OrderRow) {
  await cacheUpsertOrders([order])
  emitLive(order.accountId, 'orders')
}

/**
 * Start private user-data WebSockets for every vault account.
 * Updates IndexedDB on push; UI listens for ACCOUNT_LIVE_EVENT (no REST).
 */
export async function startAccountLiveStreams(): Promise<() => void> {
  const stops: Array<() => void> = []
  let accounts: AccountMeta[] = []
  try {
    accounts = await listAccounts()
  } catch {
    return () => {}
  }

  for (const acc of accounts) {
    try {
      const creds = await getCredentials(acc.id)
      if (!creds) continue
      if (acc.exchange === 'binance') {
        stops.push(
          subscribeBinanceUserStream(creds, acc.id, {
            onBalances: (rows) => void applyBalanceDelta(acc.id, rows),
            onOrder: (o) => void applyOrder(o),
          }),
        )
      } else {
        stops.push(
          subscribeOkxUserStream(creds, acc.id, {
            onBalances: (rows) => void applyBalanceDelta(acc.id, rows),
            onOrder: (o) => void applyOrder(o),
          }),
        )
      }
    } catch {
      /* skip account */
    }
  }

  return () => {
    for (const stop of stops) stop()
  }
}
