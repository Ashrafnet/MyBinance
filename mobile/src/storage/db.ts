import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
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

interface MyExchangesDB extends DBSchema {
  accountsMeta: {
    key: string
    value: AccountMeta
  }
  balances: {
    key: string
    value: { accountId: string; rows: BalanceRow[]; updatedAt: number }
  }
  orders: {
    key: string
    value: OrderRow
    indexes: { 'by-account': string; 'by-status': string }
  }
  tickers: {
    key: string
    value: TickerRow
  }
  candles: {
    key: string
    value: { key: string; symbol: string; interval: string; candles: Candle[] }
  }
  syncMeta: {
    key: string
    value: SyncMeta
  }
  favorites: {
    key: string
    value: { id: 'favorites'; symbols: string[] }
  }
  vault: {
    key: string
    value: { id: string; [key: string]: unknown }
  }
  settings: {
    key: string
    value: AppSettings & { id: 'settings' }
  }
  history: {
    key: string
    value: HistoryPoint & { id: string }
    indexes: { 'by-account': string }
  }
}

let dbPromise: Promise<IDBPDatabase<MyExchangesDB>> | null = null

export function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<MyExchangesDB>('myexchanges-v1', 1, {
      upgrade(db) {
        db.createObjectStore('accountsMeta', { keyPath: 'id' })
        db.createObjectStore('balances', { keyPath: 'accountId' })
        const orders = db.createObjectStore('orders', { keyPath: 'id' })
        orders.createIndex('by-account', 'accountId')
        orders.createIndex('by-status', 'status')
        db.createObjectStore('tickers', { keyPath: 'symbol' })
        db.createObjectStore('candles', { keyPath: 'key' })
        db.createObjectStore('syncMeta', { keyPath: 'accountId' })
        db.createObjectStore('favorites', { keyPath: 'id' })
        db.createObjectStore('vault', { keyPath: 'id' })
        db.createObjectStore('settings', { keyPath: 'id' })
        const history = db.createObjectStore('history', { keyPath: 'id' })
        history.createIndex('by-account', 'accountId')
      },
    })
  }
  return dbPromise
}

export async function resetDbForTests() {
  if (dbPromise) {
    const db = await dbPromise
    db.close()
    dbPromise = null
  }
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('myexchanges-v1')
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
    req.onblocked = () => resolve()
  })
}
