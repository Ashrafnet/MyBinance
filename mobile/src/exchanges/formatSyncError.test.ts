import { describe, expect, it } from 'vitest'
import { explainSyncError, formatExchangeSyncError } from './formatSyncError'
import { clearBinanceBanForTests } from './binance/rateLimit'

describe('explainSyncError', () => {
  it('turns Failed to fetch into a friendly network message', () => {
    clearBinanceBanForTests()
    const info = explainSyncError('binance account: Failed to fetch', 'binance account')
    expect(info.kind).toBe('network')
    expect(info.title).toMatch(/reach|Connection/i)
    expect(info.detail).not.toMatch(/Failed to fetch/i)
  })

  it('formats weight bans without raw timestamps', () => {
    const until = Date.now() + 120_000
    const info = explainSyncError(
      `binance account: Way too much request weight used; IP banned until ${until}.`,
    )
    expect(info.kind).toBe('rate')
    expect(info.detail).toMatch(/rate-limited|cooling|until/i)
    expect(formatExchangeSyncError(`banned until ${until}`)).not.toMatch(String(until))
  })
})
