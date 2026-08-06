import {
  formatBinanceBanMessage,
  getBinanceBannedUntil,
  noteBinanceApiError,
} from './binance/rateLimit'
import { formatOkxRateLimitMessage, noteOkxApiError } from './okx/rateLimit'

export type SyncErrorInfo = {
  title: string
  detail: string
  kind: 'network' | 'rate' | 'time' | 'auth' | 'other'
}

/** Strip leading "alias: " so we can reformat cleanly. */
function stripAliasPrefix(raw: string): string {
  return raw.replace(/^[^:\n]{1,48}:\s*/, '').trim() || raw.trim()
}

function looksNetwork(msg: string): boolean {
  return /failed to fetch|could not reach|networkerror|load failed|network request failed|fetch failed|econnreset|econnrefused|etimedout|offline|cors/i.test(
    msg,
  )
}

/**
 * Human-readable sync/exchange errors for Binance + OKX.
 * Prefer this over showing raw API / browser text.
 */
export function explainSyncError(raw: string, accountAlias?: string): SyncErrorInfo {
  const msg = stripAliasPrefix(raw)
  const who = accountAlias?.trim() || guessExchangeLabel(raw)

  if (/banned until|request weight|Way too much/i.test(msg) || /banned until|request weight/i.test(raw)) {
    noteBinanceApiError(raw)
    return {
      kind: 'rate',
      title: 'Binance is cooling down',
      detail: formatBinanceBanMessage(),
    }
  }

  if (/recvWindow|Timestamp for this request/i.test(msg)) {
    return {
      kind: 'time',
      title: 'Clock out of sync',
      detail: 'Binance rejected the request time. Wait a moment, then tap refresh.',
    }
  }

  if (/too many requests|rate limit|50011|50013/i.test(msg)) {
    noteOkxApiError(msg)
    return {
      kind: 'rate',
      title: 'OKX is cooling down',
      detail: formatOkxRateLimitMessage(),
    }
  }

  if (/50102|50113|invalid timestamp/i.test(msg)) {
    return {
      kind: 'time',
      title: 'Clock out of sync',
      detail: 'OKX rejected the request time. Wait a moment, then tap refresh.',
    }
  }

  if (/api[_-]?key|invalid key|signature|-2015|-2014|50111|50113|unauthorized|401/i.test(msg)) {
    return {
      kind: 'auth',
      title: who ? `${who}: check API keys` : 'Check API keys',
      detail: 'Credentials were rejected. Edit the account in Wallet and verify key, secret, and permissions.',
    }
  }

  if (looksNetwork(msg)) {
    if (getBinanceBannedUntil() > Date.now()) {
      return {
        kind: 'rate',
        title: 'Binance is cooling down',
        detail: formatBinanceBanMessage(),
      }
    }
    return {
      kind: 'network',
      title: 'Connection problem',
      detail: who
        ? `Couldn’t reach the exchange for “${who}”. Check your internet, then try again. Cached balances stay on this device.`
        : 'No response from the exchange. Check your internet, then try again. Cached balances stay on this device.',
    }
  }

  if (/\bHTTP\s*5\d\d\b|\b50[0234]\b|internal server error|bad gateway|service unavailable|gateway timeout/i.test(msg)) {
    return {
      kind: 'other',
      title: 'Sync failed',
      detail: who
        ? `“${who}”: the exchange returned a server error. Wait a moment, then tap Sync again. Cached balances stay on this device.`
        : 'The exchange returned a server error. Wait a moment, then tap Sync again. Cached balances stay on this device.',
    }
  }

  // Already-friendly messages we stored earlier
  if (/rate-limited|cooling down|Connection problem|Clock out of sync/i.test(msg)) {
    return {
      kind: /rate|cool/i.test(msg) ? 'rate' : /clock/i.test(msg) ? 'time' : 'other',
      title: 'Sync issue',
      detail: who && !msg.toLowerCase().includes(who.toLowerCase()) ? `${who}: ${msg}` : msg,
    }
  }

  return {
    kind: 'other',
    title: 'Sync failed',
    detail: who
      ? `“${who}”: ${msg.slice(0, 180) || 'Something went wrong while refreshing. Cached data is still available.'}`
      : msg.slice(0, 220) || 'Something went wrong while refreshing. Cached data is still available.',
  }
}

function guessExchangeLabel(raw: string): string | undefined {
  if (/binance/i.test(raw)) return 'Binance'
  if (/\bokx\b/i.test(raw)) return 'OKX'
  return undefined
}

/** Single-line fallback (toasts, sync meta storage). */
export function formatExchangeSyncError(raw: string, accountAlias?: string): string {
  const info = explainSyncError(raw, accountAlias)
  if (info.detail.startsWith(info.title)) return info.detail
  return `${info.title} — ${info.detail}`
}
