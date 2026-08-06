import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

const OnlineContext = createContext(true)

export function OnlineProvider({ children }: { children: ReactNode }) {
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  return <OnlineContext.Provider value={online}>{children}</OnlineContext.Provider>
}

export function useOnline() {
  return useContext(OnlineContext)
}
