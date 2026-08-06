import { useEffect, useState } from 'react'
import { getBinanceBannedUntil } from '../exchanges/binance/rateLimit'
import { getOkxCoolDownUntil } from '../exchanges/okx/rateLimit'
import { ACCOUNT_LIVE_EVENT } from '../services/accountLive'
import { cacheGetAllSyncMeta } from '../storage/cache'
import { useOnline } from './OnlineContext'

export type ConnectionTone = 'live' | 'limited' | 'offline'

export type ConnectionStatus = {
  tone: ConnectionTone
  label: string
  title: string
}

async function computeStatus(online: boolean): Promise<ConnectionStatus> {
  if (!online) {
    return {
      tone: 'offline',
      label: 'Offline',
      title: 'No network — showing cached data',
    }
  }

  const now = Date.now()
  if (getBinanceBannedUntil() > now || getOkxCoolDownUntil() > now) {
    return {
      tone: 'limited',
      label: 'Limited',
      title: 'Exchange rate limit — using cache until cool-down ends',
    }
  }

  try {
    const metas = await cacheGetAllSyncMeta()
    const recentError = metas.find((m) => m.lastError)
    if (recentError?.lastError) {
      return {
        tone: 'limited',
        label: 'Issue',
        title: recentError.lastError,
      }
    }
  } catch {
    /* ignore */
  }

  return {
    tone: 'live',
    label: 'Live',
    title: 'Online — exchanges reachable',
  }
}

export function useConnectionStatus(): ConnectionStatus {
  const online = useOnline()
  const [status, setStatus] = useState<ConnectionStatus>(() =>
    online
      ? { tone: 'live', label: 'Live', title: 'Online' }
      : { tone: 'offline', label: 'Offline', title: 'No network' },
  )

  useEffect(() => {
    let alive = true
    const refresh = () => {
      void computeStatus(online).then((s) => {
        if (alive) setStatus(s)
      })
    }
    refresh()
    const timer = window.setInterval(refresh, 5000)
    window.addEventListener(ACCOUNT_LIVE_EVENT, refresh)
    return () => {
      alive = false
      window.clearInterval(timer)
      window.removeEventListener(ACCOUNT_LIVE_EVENT, refresh)
    }
  }, [online])

  return status
}
