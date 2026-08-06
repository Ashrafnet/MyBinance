import { beforeEach, describe, expect, it } from 'vitest'
import {
  assertOkxNotRateLimited,
  clearOkxCoolDownForTests,
  formatOkxRateLimitMessage,
  noteOkxApiError,
} from './rateLimit'
import { formatExchangeSyncError } from '../formatSyncError'

describe('okx rateLimit', () => {
  beforeEach(() => {
    clearOkxCoolDownForTests()
  })

  it('cools down after rate-limit code message', () => {
    noteOkxApiError('Rate limit reached', '50011')
    expect(() => assertOkxNotRateLimited()).toThrow(/rate-limited/i)
    expect(formatOkxRateLimitMessage()).toMatch(/until/)
  })

  it('formats OKX rate errors for UI', () => {
    const msg = formatExchangeSyncError('okx account: Too Many Requests')
    expect(msg).toMatch(/OKX rate/i)
  })
})
