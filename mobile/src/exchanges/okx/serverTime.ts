import { restBase } from '../endpoints'
import { httpRequest } from '../http'

/** Local clock adjustment so OKX ISO timestamps stay within their window. */
let offsetMs = 0
let syncedAt = 0
let syncing: Promise<number> | null = null

const RESYNC_AFTER_MS = 5 * 60 * 1000

export function _setOkxTimeOffsetForTests(ms: number) {
  offsetMs = ms
  syncedAt = Date.now()
}

export function okxTimestampIso(): string {
  return new Date(Date.now() + offsetMs).toISOString()
}

export async function syncOkxServerTime(force = false): Promise<number> {
  if (!force && syncedAt && Date.now() - syncedAt < RESYNC_AFTER_MS) {
    return offsetMs
  }
  if (syncing) return syncing

  syncing = (async () => {
    try {
      const before = Date.now()
      const data = await httpRequest<{ code: string; data: Array<{ ts: string }> }>({
        url: `${restBase('okx')}/api/v5/public/time`,
      })
      const after = Date.now()
      const serverTs = Number(data.data?.[0]?.ts)
      if (Number.isFinite(serverTs)) {
        const localMid = Math.floor((before + after) / 2)
        offsetMs = serverTs - localMid
        syncedAt = Date.now()
      } else if (!syncedAt) {
        syncedAt = Date.now()
      }
    } catch {
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
