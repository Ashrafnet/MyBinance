import { describe, expect, it } from 'vitest'
import { signOkx } from './sign'

describe('signOkx', () => {
  it('returns base64 hmac', async () => {
    const sig = await signOkx('2020-12-08T09:08:57.715Z', 'GET', '/api/v5/account/balance', '', 'secret')
    expect(sig.length).toBeGreaterThan(20)
    expect(() => atob(sig)).not.toThrow()
  })
})
