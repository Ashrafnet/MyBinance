import { beforeEach, describe, expect, it } from 'vitest'
import {
  cacheClearAll,
  cacheGetBalances,
  cacheGetOrderHistory,
  cacheGetSyncMeta,
  cacheMergeAccountOrders,
  cacheSetSyncMeta,
  cacheUpsertBalances,
  cacheUpsertOrders,
} from './cache'
import { getFavorites, toggleFavorite } from './favorites'
import { resetDbForTests } from './db'
import type { OrderRow } from '../domain/types'

function histOrder(id: string, accountId = 'acc1'): OrderRow {
  return {
    id,
    accountId,
    exchange: 'binance',
    symbol: 'ETHUSDT',
    side: 'buy',
    type: 'limit',
    price: 1,
    quantity: 1,
    filledQuantity: 1,
    status: 'filled',
    createdAt: 1,
    updatedAt: 2,
  }
}

beforeEach(async () => {
  await resetDbForTests()
  await cacheClearAll()
})

describe('cache', () => {
  it('stores balances by account', async () => {
    await cacheUpsertBalances('acc1', [
      { asset: 'BTC', free: 1, locked: 0, total: 1, usdtValue: 50000, btcValue: 1 },
    ])
    const rows = await cacheGetBalances('acc1')
    expect(rows).toHaveLength(1)
    expect(rows[0].asset).toBe('BTC')
  })

  it('tracks sync meta and favorites', async () => {
    await cacheSetSyncMeta({ accountId: 'acc1', lastSyncAt: 123, lastError: null })
    expect((await cacheGetSyncMeta('acc1'))?.lastSyncAt).toBe(123)
    expect(await toggleFavorite('BTCUSDT')).toEqual(['BTCUSDT'])
    expect(await getFavorites()).toEqual(['BTCUSDT'])
  })

  it('keeps prior history when history merge is null (fetch failed)', async () => {
    await cacheUpsertOrders([histOrder('binance:acc1:99')])
    await cacheMergeAccountOrders('acc1', [], null)
    const rows = await cacheGetOrderHistory('acc1')
    expect(rows.map((r) => r.id)).toContain('binance:acc1:99')
  })

  it('upserts history without dropping other historical ids', async () => {
    await cacheUpsertOrders([histOrder('binance:acc1:old')])
    await cacheMergeAccountOrders('acc1', [], [histOrder('binance:acc1:neu')])
    const ids = (await cacheGetOrderHistory('acc1')).map((r) => r.id).sort()
    expect(ids).toEqual(['binance:acc1:neu', 'binance:acc1:old'].sort())
  })
})
