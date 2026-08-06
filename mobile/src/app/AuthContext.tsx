import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { checkBiometricAvailability, promptBiometric } from '../auth/biometrics'
import {
  isUnlocked,
  isVaultInitialized,
  lockVault,
  setupVaultWithPin,
  unlockFromBiometricMaterial,
  unlockWithPin,
} from '../storage/vault'

type AuthState = {
  ready: boolean
  initialized: boolean
  unlocked: boolean
  biometricAvailable: boolean
  setupPin: (pin: string) => Promise<void>
  unlockPin: (pin: string) => Promise<void>
  unlockBiometric: () => Promise<boolean>
  lock: () => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const [unlocked, setUnlocked] = useState(false)
  const [biometricAvailable, setBiometricAvailable] = useState(false)

  useEffect(() => {
    void (async () => {
      setInitialized(await isVaultInitialized())
      setUnlocked(isUnlocked())
      setBiometricAvailable((await checkBiometricAvailability()).available)
      setReady(true)
    })()
  }, [])

  const setupPin = useCallback(async (pin: string) => {
    await setupVaultWithPin(pin)
    setInitialized(true)
    setUnlocked(true)
  }, [])

  const unlockPin = useCallback(async (pin: string) => {
    await unlockWithPin(pin)
    setUnlocked(true)
  }, [])

  const unlockBiometric = useCallback(async () => {
    const ok = await promptBiometric('Unlock MyExchanges vault')
    if (!ok) return false
    try {
      await unlockFromBiometricMaterial()
      setUnlocked(true)
      return true
    } catch {
      return false
    }
  }, [])

  const lock = useCallback(() => {
    lockVault()
    setUnlocked(false)
  }, [])

  const value = useMemo(
    () => ({
      ready,
      initialized,
      unlocked,
      biometricAvailable,
      setupPin,
      unlockPin,
      unlockBiometric,
      lock,
    }),
    [ready, initialized, unlocked, biometricAvailable, setupPin, unlockPin, unlockBiometric, lock],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth outside provider')
  return ctx
}
