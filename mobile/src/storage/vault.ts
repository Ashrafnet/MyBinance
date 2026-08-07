import type { AccountCredentials, AccountMeta } from '../domain/types'
import {
  decryptJson,
  derivePinKey,
  encryptJson,
  exportKeyRaw,
  generateVaultKey,
  importKeyRaw,
  randomSaltB64,
  type EncryptedBlob,
} from '../crypto/vaultCrypto'
import { listAccounts, replaceAllAccounts } from './cache'
import { getDb } from './db'

type VaultRecord = {
  id: 'vault'
  saltB64: string
  wrappedKey: EncryptedBlob
  credentials: Record<string, EncryptedBlob>
  initialized: boolean
}

let unlockedKey: CryptoKey | null = null

async function readVault(): Promise<VaultRecord | undefined> {
  const db = await getDb()
  return db.get('vault', 'vault') as Promise<VaultRecord | undefined>
}

async function writeVault(record: VaultRecord) {
  const db = await getDb()
  await db.put('vault', record)
}

export function isUnlocked() {
  return unlockedKey !== null
}

export async function isVaultInitialized(): Promise<boolean> {
  const v = await readVault()
  return Boolean(v?.initialized)
}

const BIO_KEY_STORAGE = 'mx.vault.bioRaw'

async function persistBiometricMaterial(key: CryptoKey) {
  try {
    localStorage.setItem(BIO_KEY_STORAGE, await exportKeyRaw(key))
  } catch {
    /* private mode */
  }
}

export function clearBiometricMaterial() {
  try {
    localStorage.removeItem(BIO_KEY_STORAGE)
  } catch {
    /* private mode */
  }
}

export async function setupVaultWithPin(pin: string) {
  const vaultKey = await generateVaultKey()
  const saltB64 = randomSaltB64()
  const pinKey = await derivePinKey(pin, saltB64)
  const wrappedKey = await encryptJson(pinKey, { raw: await exportKeyRaw(vaultKey) })
  await writeVault({
    id: 'vault',
    saltB64,
    wrappedKey,
    credentials: {},
    initialized: true,
  })
  unlockedKey = vaultKey
  await persistBiometricMaterial(vaultKey)
}

export async function unlockWithPin(pin: string) {
  const v = await readVault()
  if (!v?.initialized) throw new Error('Vault not initialized')
  const pinKey = await derivePinKey(pin, v.saltB64)
  const { raw } = await decryptJson<{ raw: string }>(pinKey, v.wrappedKey)
  unlockedKey = await importKeyRaw(raw)
  await persistBiometricMaterial(unlockedKey)
}

/** Call only after a successful biometric prompt. */
export async function unlockFromBiometricMaterial() {
  const raw = localStorage.getItem(BIO_KEY_STORAGE)
  if (!raw) throw new Error('Biometric unlock not set up — use PIN once')
  unlockedKey = await importKeyRaw(raw)
}

export function lockVault() {
  unlockedKey = null
}

function requireKey(): CryptoKey {
  if (!unlockedKey) throw new Error('Vault locked')
  return unlockedKey
}

export async function saveCredentials(accountId: string, creds: AccountCredentials) {
  const key = requireKey()
  const v = await readVault()
  if (!v) throw new Error('Vault missing')
  v.credentials[accountId] = await encryptJson(key, creds)
  await writeVault(v)
}

export async function getCredentials(accountId: string): Promise<AccountCredentials | null> {
  const key = requireKey()
  const v = await readVault()
  const blob = v?.credentials[accountId]
  if (!blob) return null
  return decryptJson<AccountCredentials>(key, blob)
}

export async function deleteCredentials(accountId: string) {
  const v = await readVault()
  if (!v) return
  delete v.credentials[accountId]
  await writeVault(v)
}

const BACKUP_FORMAT = 'myexchanges-backup' as const
const BACKUP_VERSION = 2

export type VaultBackupV2 = {
  format: typeof BACKUP_FORMAT
  version: number
  exportedAt: string
  vault: VaultRecord
  accounts: AccountMeta[]
}

export type ImportBackupResult = {
  accountCount: number
  legacyBackup: boolean
}

function isVaultRecord(v: unknown): v is VaultRecord {
  if (!v || typeof v !== 'object') return false
  const r = v as VaultRecord
  return Boolean(r.wrappedKey && r.saltB64)
}

function isAccountMeta(a: unknown): a is AccountMeta {
  if (!a || typeof a !== 'object') return false
  const m = a as AccountMeta
  return typeof m.id === 'string' && typeof m.alias === 'string' && (m.exchange === 'binance' || m.exchange === 'okx')
}

/** Build a portable backup: encrypted keys + account list (aliases / exchanges). */
export async function exportEncryptedBackup(): Promise<string> {
  const v = await readVault()
  if (!v?.initialized) throw new Error('No vault to export')
  const accounts = await listAccounts()
  const backup: VaultBackupV2 = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    vault: { ...v, id: 'vault', initialized: true },
    accounts,
  }
  return JSON.stringify(backup, null, 2)
}

/**
 * Restore vault + accounts from a backup file.
 * Locks the session and clears biometric material so the user must enter the backup PIN next.
 */
export async function importEncryptedBackup(json: string): Promise<ImportBackupResult> {
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    throw new Error('Backup file is not valid JSON')
  }

  let vault: VaultRecord
  let accounts: AccountMeta[] = []
  let legacyBackup = false

  if (data && typeof data === 'object' && (data as VaultBackupV2).format === BACKUP_FORMAT) {
    const b = data as VaultBackupV2
    if (!isVaultRecord(b.vault)) throw new Error('Invalid backup: missing vault')
    vault = { ...b.vault, id: 'vault', initialized: true }
    accounts = Array.isArray(b.accounts) ? b.accounts.filter(isAccountMeta) : []
  } else if (isVaultRecord(data)) {
    // Older exports were vault-only (no account list).
    legacyBackup = true
    vault = { ...(data as VaultRecord), id: 'vault', initialized: true }
    accounts = []
  } else {
    throw new Error('Invalid backup file')
  }

  await writeVault(vault)
  await replaceAllAccounts(accounts)

  // Drop stale market/account caches so restored ids don't mix with old rows.
  const db = await getDb()
  await Promise.all([
    db.clear('balances'),
    db.clear('orders'),
    db.clear('syncMeta'),
    db.clear('history'),
    db.clear('tickers'),
    db.clear('candles'),
  ])

  unlockedKey = null
  clearBiometricMaterial()

  return { accountCount: accounts.length, legacyBackup }
}
