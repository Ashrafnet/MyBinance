import type { OrderRow } from '../domain/types'
import {
  cacheGetSyncMeta,
  cacheGetTickers,
  cacheMergeAccountOrders,
  cacheSetSyncMeta,
  cacheUpsertBalances,
  cacheUpsertHistory,
  cacheUpsertTickers,
  listAccounts,
} from '../storage/cache'
import { getCredentials } from '../storage/vault'
import { formatExchangeSyncError } from '../exchanges/formatSyncError'
import { getExchange, allExchanges } from '../exchanges/registry'
import { sumUsdt, valueBalances } from './valuation'

export type SyncAccountOptions = {
  /** Expensive on Binance (per-symbol allOrders). Default false for portfolio refresh. */
  orderHistory?: boolean
}

export async function syncPublicMarkets(preferred: 'binance' | 'okx' = 'binance') {
  const ex = getExchange(preferred)
  const tickers = await ex.fetchTickers()
  await cacheUpsertTickers(tickers)
  return tickers
}

export async function syncAccount(accountId: string, opts: SyncAccountOptions = {}) {
  const accounts = await listAccounts()
  const account = accounts.find((a) => a.id === accountId)
  if (!account) throw new Error('Account not found')
  const creds = await getCredentials(accountId)
  if (!creds) throw new Error('Credentials missing')

  try {
    const ex = getExchange(account.exchange)
    let tickers = await cacheGetTickers()
    if (tickers.length === 0) tickers = await syncPublicMarkets(account.exchange)

    const rawBalances = await ex.fetchBalances(creds)
    const valued = valueBalances(rawBalances, tickers)
    await cacheUpsertBalances(accountId, valued)

    const open = await ex.fetchOpenOrders(creds, accountId)
    let history: OrderRow[] | null = null
    if (opts.orderHistory) {
      try {
        history = await ex.fetchOrderHistory(creds, accountId)
      } catch {
        history = null
      }
    }
    await cacheMergeAccountOrders(accountId, open, history)

    if (ex.fetchHistory) {
      try {
        const points = await ex.fetchHistory(creds, accountId)
        if (points.length) await cacheUpsertHistory(points)
      } catch {
        /* optional */
      }
    }

    // Always record today's live Spot value so History matches Home (Binance + OKX).
    const today = new Date().toISOString().slice(0, 10)
    const held = valued
      .filter((b) => b.total > 0)
      .slice()
      .sort((a, b) => b.usdtValue - a.usdtValue)
    await cacheUpsertHistory([
      {
        id: `${accountId}:${today}`,
        accountId,
        date: today,
        usdtValue: sumUsdt(held),
        btcValue: held.reduce((s, b) => s + b.btcValue, 0),
        capturedAt: Date.now(),
        assets: held.map((b) => ({
          asset: b.asset,
          free: b.free,
          locked: b.locked,
          total: b.total,
          usdtValue: b.usdtValue,
          btcValue: b.btcValue,
        })),
      },
    ])

    await cacheSetSyncMeta({ accountId, lastSyncAt: Date.now(), lastError: null })
  } catch (e) {
    const raw = e instanceof Error ? e.message : 'Sync failed'
    const msg = formatExchangeSyncError(raw, account.alias)
    const prev = await cacheGetSyncMeta(accountId)
    // Keep prior successful sync time so UI doesn't flip to "Synced Never".
    await cacheSetSyncMeta({
      accountId,
      lastSyncAt: prev?.lastSyncAt ?? null,
      lastError: msg,
    })
    throw new Error(msg)
  }
}

/** Pull Binance daily snapshots for a chosen date window (merged into cache). */
export async function syncHistoryRange(
  accountId: string,
  range: { startTime: number; endTime: number },
) {
  const accounts = await listAccounts()
  const ids = accountId === 'all' ? accounts.map((a) => a.id) : [accountId]
  const errors: string[] = []

  for (const id of ids) {
    if (!id) continue
    const account = accounts.find((a) => a.id === id)
    if (!account) continue
    const creds = await getCredentials(id)
    if (!creds) {
      errors.push(`${account.alias}: credentials missing`)
      continue
    }
    const ex = getExchange(account.exchange)
    if (!ex.fetchHistory) {
      errors.push(`${account.alias}: history range only on Binance`)
      continue
    }
    try {
      const points = await ex.fetchHistory(creds, id, range)
      if (points.length) await cacheUpsertHistory(points)
    } catch (e) {
      errors.push(`${account.alias}: ${e instanceof Error ? e.message : 'history failed'}`)
    }
  }
  return errors
}

export async function syncAll() {
  const errors: string[] = []
  try {
    await syncPublicMarkets('binance')
  } catch {
    try {
      await syncPublicMarkets('okx')
    } catch (e) {
      errors.push(e instanceof Error ? e.message : 'Market sync failed')
    }
  }

  const accounts = await listAccounts()
  for (const a of accounts) {
    try {
      // Portfolio path: balances + open orders only (no per-symbol allOrders).
      await syncAccount(a.id, { orderHistory: false })
    } catch (e) {
      errors.push(formatExchangeSyncError(e instanceof Error ? e.message : 'failed', a.alias))
    }
  }
  return errors
}

export async function warmTickersFromAny() {
  for (const ex of allExchanges()) {
    try {
      const tickers = await ex.fetchTickers()
      await cacheUpsertTickers(tickers)
      return tickers
    } catch {
      /* try next */
    }
  }
  return cacheGetTickers()
}
