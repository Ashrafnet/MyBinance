import { describe, expect, it } from 'vitest'
import { decryptJson, encryptJson, generateVaultKey } from './vaultCrypto'

describe('vaultCrypto', () => {
  it('roundtrips credentials', async () => {
    const key = await generateVaultKey()
    const blob = await encryptJson(key, { apiKey: 'a', secretKey: 'b', passphrase: 'c' })
    const out = await decryptJson<{ apiKey: string; secretKey: string }>(key, blob)
    expect(out.apiKey).toBe('a')
    expect(out.secretKey).toBe('b')
  })
})
