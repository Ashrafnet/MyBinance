import { beforeEach, describe, expect, it } from 'vitest'
import { formatExchangeSyncError } from '../formatSyncError'
import {
  assertBinanceNotBanned,
  clearBinanceBanForTests,
  formatBinanceBanMessage,
  noteBinanceApiError,
} from './rateLimit'

describe('binance rateLimit', () => {
  beforeEach(() => {
    clearBinanceBanForTests()
  })

  it('parses banned-until and blocks until then', () => {
    const until = Date.now() + 60_000
    noteBinanceApiError(`Way too much request weight used; IP banned until ${until}.`)
    expect(() => assertBinanceNotBanned()).toThrow(/rate-limited/i)
    expect(formatBinanceBanMessage()).toMatch(/until/)
  })

  it('formats weight errors for UI', () => {
    const until = Date.now() + 120_000
    const msg = formatExchangeSyncError(
      `binance account: Way too much request weight used; IP banned until ${until}.`,
    )
    expect(msg).toMatch(/rate-limited/i)
    expect(msg).not.toMatch(/1786/)
  })
})
