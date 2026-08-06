export type EncryptedBlob = {
  iv: string
  ciphertext: string
}

function bufToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}

function b64ToBuf(b64: string): ArrayBuffer {
  const s = atob(b64)
  const bytes = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i)
  return bytes.buffer
}

export async function generateVaultKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
  ])
}

export async function exportKeyRaw(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', key)
  return bufToB64(raw)
}

export async function importKeyRaw(b64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', b64ToBuf(b64), { name: 'AES-GCM' }, true, [
    'encrypt',
    'decrypt',
  ])
}

export async function encryptJson(key: CryptoKey, data: unknown): Promise<EncryptedBlob> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(JSON.stringify(data))
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded)
  return { iv: bufToB64(iv.buffer), ciphertext: bufToB64(ciphertext) }
}

export async function decryptJson<T>(key: CryptoKey, blob: EncryptedBlob): Promise<T> {
  const iv = new Uint8Array(b64ToBuf(blob.iv))
  const ciphertext = b64ToBuf(blob.ciphertext)
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
  return JSON.parse(new TextDecoder().decode(plain)) as T
}

export async function derivePinKey(pin: string, saltB64: string, iterations = 210000): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: b64ToBuf(saltB64),
      iterations,
      hash: 'SHA-256',
    },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export function randomSaltB64(): string {
  return bufToB64(crypto.getRandomValues(new Uint8Array(16)).buffer)
}
