function bufToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}

export async function signOkx(
  timestamp: string,
  method: string,
  pathWithQuery: string,
  body: string,
  secret: string,
): Promise<string> {
  const prehash = `${timestamp}${method.toUpperCase()}${pathWithQuery}${body}`
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(prehash))
  return bufToB64(sig)
}
