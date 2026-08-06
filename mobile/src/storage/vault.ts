import type { AccountCredentials } from '../domain/types'
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

export async function exportEncryptedBackup(): Promise<string> {
  const v = await readVault()
  if (!v) throw new Error('No vault')
  return JSON.stringify(v)
}

export async function importEncryptedBackup(json: string) {
  const parsed = JSON.parse(json) as VaultRecord
  if (!parsed?.wrappedKey || !parsed?.saltB64) throw new Error('Invalid backup')
  await writeVault({ ...parsed, id: 'vault', initialized: true })
  unlockedKey = null
}
