import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { listAccounts, upsertAccount } from './cache'
import { getDb, resetDbForTests } from './db'
import {
  clearBiometricMaterial,
  exportEncryptedBackup,
  getCredentials,
  importEncryptedBackup,
  saveCredentials,
  setupVaultWithPin,
  unlockWithPin,
} from './vault'

describe('vault backup v2', () => {
  beforeEach(async () => {
    await resetDbForTests()
    clearBiometricMaterial()
  })

  it('exports accounts with vault and restores them after import', async () => {
    await setupVaultWithPin('1234')
    await upsertAccount({ id: 'acc1', alias: 'Main', exchange: 'binance', createdAt: 1 })
    await upsertAccount({ id: 'acc2', alias: 'OKX', exchange: 'okx', createdAt: 2 })
    await saveCredentials('acc1', { apiKey: 'k1', secretKey: 's1' })
    await saveCredentials('acc2', { apiKey: 'k2', secretKey: 's2', passphrase: 'p' })

    const json = await exportEncryptedBackup()
    const parsed = JSON.parse(json) as { format: string; accounts: unknown[] }
    expect(parsed.format).toBe('myexchanges-backup')
    expect(parsed.accounts).toHaveLength(2)

    await resetDbForTests()
    clearBiometricMaterial()

    const result = await importEncryptedBackup(json)
    expect(result.accountCount).toBe(2)
    expect(result.legacyBackup).toBe(false)

    const accounts = await listAccounts()
    expect(accounts.map((a) => a.alias).sort()).toEqual(['Main', 'OKX'])

    await unlockWithPin('1234')
    await expect(getCredentials('acc1')).resolves.toEqual({ apiKey: 'k1', secretKey: 's1' })
    await expect(getCredentials('acc2')).resolves.toEqual({ apiKey: 'k2', secretKey: 's2', passphrase: 'p' })
  })

  it('imports legacy vault-only backups', async () => {
    await setupVaultWithPin('9999')
    await upsertAccount({ id: 'acc1', alias: 'Main', exchange: 'binance', createdAt: 1 })
    await saveCredentials('acc1', { apiKey: 'k', secretKey: 's' })

    const db = await getDb()
    const vault = await db.get('vault', 'vault')
    const legacyJson = JSON.stringify(vault)

    await resetDbForTests()
    clearBiometricMaterial()

    const result = await importEncryptedBackup(legacyJson!)
    expect(result.legacyBackup).toBe(true)
    expect(result.accountCount).toBe(0)
    await unlockWithPin('9999')
    await expect(getCredentials('acc1')).resolves.toEqual({ apiKey: 'k', secretKey: 's' })
  })
})
