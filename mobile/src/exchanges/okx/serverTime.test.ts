import { beforeEach, describe, expect, it, vi } from 'vitest'
import { _setOkxTimeOffsetForTests, okxTimestampIso, syncOkxServerTime } from './serverTime'

vi.mock('../http', () => ({
  httpRequest: vi.fn(),
}))

import { httpRequest } from '../http'

describe('okx server time', () => {
  beforeEach(() => {
    _setOkxTimeOffsetForTests(0)
    vi.mocked(httpRequest).mockReset()
  })

  it('applies offset to ISO timestamps', () => {
    _setOkxTimeOffsetForTests(2000)
    const fixed = 1_700_000_000_000
    vi.spyOn(Date, 'now').mockReturnValue(fixed)
    expect(okxTimestampIso()).toBe(new Date(fixed + 2000).toISOString())
  })

  it('syncs offset from /api/v5/public/time', async () => {
    const fixedNow = 1_700_000_000_000
    vi.spyOn(Date, 'now').mockReturnValue(fixedNow)
    vi.mocked(httpRequest).mockResolvedValue({
      code: '0',
      data: [{ ts: String(fixedNow + 1500) }],
    })
    const offset = await syncOkxServerTime(true)
    expect(offset).toBe(1500)
  })
})
