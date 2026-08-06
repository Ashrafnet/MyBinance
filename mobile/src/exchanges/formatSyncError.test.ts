import { describe, expect, it } from 'vitest'
import { explainSyncError, formatExchangeSyncError } from './formatSyncError'
import { clearBinanceBanForTests } from './binance/rateLimit'

describe('explainSyncError', () => {
  it('turns Failed to fetch into a friendly network message', () => {
    clearBinanceBanForTests()
    const info = explainSyncError('binance account: Failed to fetch', 'binance account')
    expect(info.kind).toBe('network')
    expect(info.title).toMatch(/Connection/i)
    expect(info.detail).toMatch(/binance account/i)
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

  it('humanizes HTTP 500 instead of showing the raw status', () => {
    const info = explainSyncError('Ashraf: HTTP 500', 'Ashraf')
    expect(info.kind).toBe('other')
    expect(info.title).toBe('Sync failed')
    expect(info.title).not.toMatch(/Ashraf is having/i)
    expect(info.detail).toMatch(/Ashraf/)
    expect(info.detail).not.toMatch(/HTTP\s*500/i)
    expect(info.detail).toMatch(/server error|tap Sync|Cached/i)
  })
})
