import {
  cacheGetTickers,
  cacheReplaceAccountOrders,
  cacheSetSyncMeta,
  cacheUpsertBalances,
  cacheUpsertHistory,
  cacheUpsertTickers,
  listAccounts,
} from '../storage/cache'
import { getCredentials } from '../storage/vault'
import { getExchange, allExchanges } from '../exchanges/registry'
import { valueBalances } from './valuation'

export async function syncPublicMarkets(preferred: 'binance' | 'okx' = 'binance') {
  const ex = getExchange(preferred)
  const tickers = await ex.fetchTickers()
  await cacheUpsertTickers(tickers)
  return tickers
}

export async function syncAccount(accountId: string) {
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
    let history: typeof open = []
    try {
      history = await ex.fetchOrderHistory(creds, accountId)
    } catch {
      history = []
    }
    await cacheReplaceAccountOrders(accountId, [...open, ...history])

    if (ex.fetchHistory) {
      try {
        const points = await ex.fetchHistory(creds, accountId)
        if (points.length) await cacheUpsertHistory(points)
      } catch {
        /* optional */
      }
    }

    await cacheSetSyncMeta({ accountId, lastSyncAt: Date.now(), lastError: null })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Sync failed'
    await cacheSetSyncMeta({ accountId, lastSyncAt: null, lastError: msg })
    throw e
  }
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
      await syncAccount(a.id)
    } catch (e) {
      errors.push(`${a.alias}: ${e instanceof Error ? e.message : 'failed'}`)
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
