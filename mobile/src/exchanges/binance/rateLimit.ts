import { ExchangeError } from '../types'

/** Soft gate so we stop hammering Binance after a weight/IP ban. */
let bannedUntilMs = 0

export function getBinanceBannedUntil(): number {
  return bannedUntilMs
}

export function clearBinanceBanForTests() {
  bannedUntilMs = 0
}

export function noteBinanceApiError(message: string) {
  const m = /banned until\s+(\d+)/i.exec(message)
  if (m) {
    const until = Number(m[1])
    if (Number.isFinite(until) && until > bannedUntilMs) bannedUntilMs = until
  }
}

export function assertBinanceNotBanned() {
  if (Date.now() < bannedUntilMs) {
    throw new ExchangeError(formatBinanceBanMessage(bannedUntilMs), 418)
  }
}

export function isBinanceWeightOrBanError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return /request weight|IP banned|too many requests|418|-1003|-1015/i.test(msg)
}

export function formatBinanceBanMessage(untilMs = bannedUntilMs): string {
  if (!untilMs || Date.now() >= untilMs) {
    return 'Binance rate limit hit. Wait a bit, then refresh. Prefer Markets websockets for live prices.'
  }
  const when = new Date(untilMs).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
  return `Binance rate-limited this IP until ${when}. Using cache until then — avoid Refresh.`
}

/** @deprecated use `formatExchangeSyncError` from `../formatSyncError` */
export { formatExchangeSyncError } from '../formatSyncError'
