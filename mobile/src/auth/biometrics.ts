export type BiometricAvailability = {
  available: boolean
  reason?: string
}

export async function checkBiometricAvailability(): Promise<BiometricAvailability> {
  try {
    // Capacitor native plugin when present
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
    if (cap?.isNativePlatform?.()) {
      return { available: true }
    }
    if (window.PublicKeyCredential) {
      const ok = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
      return ok
        ? { available: true }
        : { available: false, reason: 'No platform authenticator' }
    }
    return { available: false, reason: 'WebAuthn unavailable' }
  } catch (e) {
    return { available: false, reason: e instanceof Error ? e.message : 'Biometric check failed' }
  }
}

/**
 * Best-effort biometric gate. On native Capacitor, integrate @capgo/capacitor-native-biometric.
 * In browser, uses WebAuthn userVerification when possible; otherwise caller should use PIN.
 */
export async function promptBiometric(reason = 'Unlock MyExchanges'): Promise<boolean> {
  const avail = await checkBiometricAvailability()
  if (!avail.available) return false

  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32))
    const cred = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: 'MyExchanges' },
        user: {
          id: crypto.getRandomValues(new Uint8Array(16)),
          name: 'local-user',
          displayName: 'Local User',
        },
        pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'discouraged',
        },
        timeout: 60000,
      },
    })) as PublicKeyCredential | null
    return Boolean(cred)
  } catch {
    // User cancel or unsupported — fall back to PIN
    console.warn(reason)
    return false
  }
}
