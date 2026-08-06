import type {
  AccountMeta,
  AppSettings,
  BalanceRow,
  Candle,
  HistoryPoint,
  OrderRow,
  SyncMeta,
  TickerRow,
} from '../domain/types'
import { DEFAULT_SETTINGS } from '../domain/types'
import { getDb } from './db'

export async function cacheClearAll() {
  const db = await getDb()
  await Promise.all([
    db.clear('accountsMeta'),
    db.clear('balances'),
    db.clear('orders'),
    db.clear('tickers'),
    db.clear('candles'),
    db.clear('syncMeta'),
    db.clear('favorites'),
    db.clear('history'),
    db.clear('settings'),
  ])
}

export async function listAccounts(): Promise<AccountMeta[]> {
  const db = await getDb()
  return db.getAll('accountsMeta')
}

export async function upsertAccount(account: AccountMeta) {
  const db = await getDb()
  await db.put('accountsMeta', account)
}

export async function deleteAccountMeta(accountId: string) {
  const db = await getDb()
  await db.delete('accountsMeta', accountId)
  await db.delete('balances', accountId)
  await db.delete('syncMeta', accountId)
  const orders = await db.getAllFromIndex('orders', 'by-account', accountId)
  await Promise.all(orders.map((o) => db.delete('orders', o.id)))
}

export async function cacheUpsertBalances(accountId: string, rows: BalanceRow[]) {
  const db = await getDb()
  await db.put('balances', { accountId, rows, updatedAt: Date.now() })
}

export async function cacheGetBalances(accountId: string): Promise<BalanceRow[]> {
  const db = await getDb()
  const row = await db.get('balances', accountId)
  return row?.rows ?? []
}

export async function cacheUpsertOrders(orders: OrderRow[]) {
  const db = await getDb()
  const tx = db.transaction('orders', 'readwrite')
  await Promise.all(orders.map((o) => tx.store.put(o)))
  await tx.done
}

export async function cacheReplaceAccountOrders(accountId: string, orders: OrderRow[]) {
  const db = await getDb()
  const existing = await db.getAllFromIndex('orders', 'by-account', accountId)
  const tx = db.transaction('orders', 'readwrite')
  await Promise.all(existing.map((o) => tx.store.delete(o.id)))
  await Promise.all(orders.map((o) => tx.store.put(o)))
  await tx.done
}

export async function cacheGetOpenOrders(accountId?: string): Promise<OrderRow[]> {
  const db = await getDb()
  const all = accountId
    ? await db.getAllFromIndex('orders', 'by-account', accountId)
    : await db.getAll('orders')
  return all.filter((o) => o.status === 'open' || o.status === 'partial')
}

export async function cacheGetOrderHistory(accountId?: string): Promise<OrderRow[]> {
  const db = await getDb()
  const all = accountId
    ? await db.getAllFromIndex('orders', 'by-account', accountId)
    : await db.getAll('orders')
  return all.filter((o) => o.status !== 'open' && o.status !== 'partial')
}

export async function cacheUpsertTickers(tickers: TickerRow[]) {
  const db = await getDb()
  const tx = db.transaction('tickers', 'readwrite')
  await Promise.all(tickers.map((t) => tx.store.put(t)))
  await tx.done
}

export async function cacheGetTickers(): Promise<TickerRow[]> {
  const db = await getDb()
  return db.getAll('tickers')
}

export async function cacheGetTicker(symbol: string): Promise<TickerRow | undefined> {
  const db = await getDb()
  return db.get('tickers', symbol)
}

export async function cacheUpsertCandles(symbol: string, interval: string, candles: Candle[]) {
  const db = await getDb()
  const key = `${symbol}:${interval}`
  await db.put('candles', { key, symbol, interval, candles })
}

export async function cacheGetCandles(symbol: string, interval: string): Promise<Candle[]> {
  const db = await getDb()
  const row = await db.get('candles', `${symbol}:${interval}`)
  return row?.candles ?? []
}

export async function cacheSetSyncMeta(meta: SyncMeta) {
  const db = await getDb()
  await db.put('syncMeta', meta)
}

export async function cacheGetSyncMeta(accountId: string): Promise<SyncMeta | undefined> {
  const db = await getDb()
  return db.get('syncMeta', accountId)
}

export async function cacheGetAllSyncMeta(): Promise<SyncMeta[]> {
  const db = await getDb()
  return db.getAll('syncMeta')
}

export async function getSettings(): Promise<AppSettings> {
  const db = await getDb()
  const row = await db.get('settings', 'settings')
  if (!row) return { ...DEFAULT_SETTINGS }
  const { id: _id, ...settings } = row
  return settings
}

export async function saveSettings(settings: AppSettings) {
  const db = await getDb()
  await db.put('settings', { id: 'settings', ...settings })
}

export async function cacheUpsertHistory(points: Array<HistoryPoint & { id: string }>) {
  const db = await getDb()
  const tx = db.transaction('history', 'readwrite')
  await Promise.all(points.map((p) => tx.store.put(p)))
  await tx.done
}

export async function cacheGetHistory(accountId: string): Promise<Array<HistoryPoint & { id: string }>> {
  const db = await getDb()
  return db.getAllFromIndex('history', 'by-account', accountId)
}
