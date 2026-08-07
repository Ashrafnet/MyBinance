import { Capacitor } from '@capacitor/core'
import { NativeBiometric } from '@capgo/capacitor-native-biometric'

export type BiometricAvailability = {
  available: boolean
  reason?: string
}

export async function checkBiometricAvailability(): Promise<BiometricAvailability> {
  try {
    if (Capacitor.isNativePlatform()) {
      const result = await NativeBiometric.isAvailable()
      return result.isAvailable
        ? { available: true }
        : { available: false, reason: result.errorCode != null ? `Biometric unavailable (${result.errorCode})` : 'Biometric unavailable' }
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
 * Biometric gate. Native Android/iOS uses BiometricPrompt / Face ID.
 * Browser uses WebAuthn userVerification when possible; otherwise caller should use PIN.
 */
export async function promptBiometric(reason = 'Unlock MyExchanges'): Promise<boolean> {
  const avail = await checkBiometricAvailability()
  if (!avail.available) return false

  try {
    if (Capacitor.isNativePlatform()) {
      await NativeBiometric.verifyIdentity({
        reason,
        title: 'Unlock MyExchanges',
        subtitle: 'Confirm fingerprint',
        description: reason,
        negativeButtonText: 'Use PIN',
        maxAttempts: 5,
      })
      return true
    }

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
    return false
  }
}
