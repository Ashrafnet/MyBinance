import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { AccountMeta } from '../domain/types'
import { listAccounts } from '../storage/cache'

const STORAGE_KEY = 'myex.accountFilterId'

type AccountFilterState = {
  ready: boolean
  accountId: string
  setAccountId: (id: string) => void
  accounts: AccountMeta[]
  /** Concrete account for place-order when filter is 'all' */
  tradingAccountId: string
  refreshAccounts: () => Promise<void>
}

const AccountFilterContext = createContext<AccountFilterState | null>(null)

export function AccountFilterProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [accounts, setAccounts] = useState<AccountMeta[]>([])
  const [accountId, setAccountIdState] = useState('all')

  const refreshAccounts = useCallback(async () => {
    const accs = await listAccounts()
    setAccounts(accs)
    setAccountIdState((prev) => {
      if (prev === 'all') return prev
      return accs.some((a) => a.id === prev) ? prev : 'all'
    })
  }, [])

  useEffect(() => {
    void (async () => {
      const saved = localStorage.getItem(STORAGE_KEY) || 'all'
      const accs = await listAccounts()
      setAccounts(accs)
      const valid = saved === 'all' || accs.some((a) => a.id === saved)
      setAccountIdState(valid ? saved : 'all')
      setReady(true)
    })()
  }, [])

  const setAccountId = useCallback((id: string) => {
    setAccountIdState(id)
    localStorage.setItem(STORAGE_KEY, id)
  }, [])

  const tradingAccountId = accountId === 'all' ? (accounts[0]?.id ?? '') : accountId

  const value = useMemo(
    () => ({ ready, accountId, setAccountId, accounts, tradingAccountId, refreshAccounts }),
    [ready, accountId, setAccountId, accounts, tradingAccountId, refreshAccounts],
  )

  return <AccountFilterContext.Provider value={value}>{children}</AccountFilterContext.Provider>
}

export function useAccountFilter(): AccountFilterState {
  const ctx = useContext(AccountFilterContext)
  if (!ctx) throw new Error('useAccountFilter must be used within AccountFilterProvider')
  return ctx
}
