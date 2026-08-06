import { restBase } from '../endpoints'
import { httpRequest } from '../http'

/** Local clock adjustment so signed timestamps match Binance server time. */
let offsetMs = 0
let syncedAt = 0
let syncing: Promise<number> | null = null

const RESYNC_AFTER_MS = 5 * 60 * 1000

export function getBinanceTimeOffsetMs() {
  return offsetMs
}

/** For tests */
export function _setBinanceTimeOffsetForTests(ms: number) {
  offsetMs = ms
  syncedAt = Date.now()
}

export function binanceTimestamp(): number {
  return Date.now() + offsetMs
}

export function isRecvWindowError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return /recvWindow|Timestamp for this request/i.test(msg)
}

export async function syncBinanceServerTime(force = false): Promise<number> {
  if (!force && syncedAt && Date.now() - syncedAt < RESYNC_AFTER_MS) {
    return offsetMs
  }
  if (syncing) return syncing

  syncing = (async () => {
    try {
      const before = Date.now()
      const data = await httpRequest<{ serverTime: number }>({
        url: `${restBase('binance')}/api/v3/time`,
      })
      const after = Date.now()
      // Approximate RTT midpoint so latency doesn't bias the offset too far.
      const localMid = Math.floor((before + after) / 2)
      offsetMs = data.serverTime - localMid
      syncedAt = Date.now()
    } catch {
      // Keep prior offset (or 0); signed calls may still work if the clock is close.
      if (!syncedAt) syncedAt = Date.now()
    }
    return offsetMs
  })()

  try {
    return await syncing
  } finally {
    syncing = null
  }
}
