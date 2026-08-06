import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  _setBinanceTimeOffsetForTests,
  binanceTimestamp,
  isRecvWindowError,
  syncBinanceServerTime,
} from './serverTime'

vi.mock('../http', () => ({
  httpRequest: vi.fn(),
}))

import { httpRequest } from '../http'

describe('binance server time', () => {
  beforeEach(() => {
    _setBinanceTimeOffsetForTests(0)
    vi.mocked(httpRequest).mockReset()
  })

  it('applies offset to timestamps', () => {
    _setBinanceTimeOffsetForTests(1500)
    const now = Date.now()
    const ts = binanceTimestamp()
    expect(ts).toBeGreaterThanOrEqual(now + 1400)
    expect(ts).toBeLessThanOrEqual(now + 1600 + 50)
  })

  it('detects recvWindow errors', () => {
    expect(isRecvWindowError(new Error('Timestamp for this request is outside of the recvWindow.'))).toBe(
      true,
    )
    expect(isRecvWindowError(new Error('insufficient balance'))).toBe(false)
  })

  it('syncs offset from /api/v3/time', async () => {
    const fixedNow = 1_700_000_000_000
    vi.spyOn(Date, 'now').mockReturnValue(fixedNow)
    vi.mocked(httpRequest).mockResolvedValue({ serverTime: fixedNow + 2000 })

    const offset = await syncBinanceServerTime(true)
    expect(offset).toBe(2000)
    expect(binanceTimestamp()).toBe(fixedNow + 2000)
  })
})
