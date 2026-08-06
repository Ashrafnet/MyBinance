import { describe, expect, it } from 'vitest'
import { signBinanceQuery } from './sign'

describe('signBinanceQuery', () => {
  it('signs totalParams with hmac sha256 hex', async () => {
    const sig = await signBinanceQuery('symbol=BTCUSDT&timestamp=1', 'secret')
    expect(sig).toMatch(/^[a-f0-9]{64}$/)
  })
})
