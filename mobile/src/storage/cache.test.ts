import { beforeEach, describe, expect, it } from 'vitest'
import { cacheClearAll, cacheGetBalances, cacheGetSyncMeta, cacheSetSyncMeta, cacheUpsertBalances } from './cache'
import { getFavorites, toggleFavorite } from './favorites'
import { resetDbForTests } from './db'

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
})
