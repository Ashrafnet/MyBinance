import { ExchangeError } from '../types'

/** Soft gate after OKX rate-limit responses. */
let coolDownUntilMs = 0

const DEFAULT_COOLDOWN_MS = 60_000

export function getOkxCoolDownUntil(): number {
  return coolDownUntilMs
}

export function clearOkxCoolDownForTests() {
  coolDownUntilMs = 0
}

export function noteOkxApiError(message: string, code?: string | number) {
  const untilMatch = /banned until\s+(\d+)|retry after\s+(\d+)/i.exec(message)
  if (untilMatch) {
    const until = Number(untilMatch[1] || untilMatch[2])
    if (Number.isFinite(until)) {
      // OKX sometimes returns seconds; treat large values as ms timestamps.
      const ms = until < 1e12 ? Date.now() + until * 1000 : until
      if (ms > coolDownUntilMs) coolDownUntilMs = ms
      return
    }
  }
  if (isOkxRateLimitMessage(message, code)) {
    const next = Date.now() + DEFAULT_COOLDOWN_MS
    if (next > coolDownUntilMs) coolDownUntilMs = next
  }
}

export function assertOkxNotRateLimited() {
  if (Date.now() < coolDownUntilMs) {
    throw new ExchangeError(formatOkxRateLimitMessage(coolDownUntilMs), 429)
  }
}

export function isOkxRateLimitError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  const code = err instanceof ExchangeError ? err.code : undefined
  return isOkxRateLimitMessage(msg, code)
}

function isOkxRateLimitMessage(message: string, code?: string | number): boolean {
  const c = String(code ?? '')
  return (
    c === '50011' ||
    c === '50013' ||
    c === '429' ||
    /too many requests|rate limit|50011|50013|429/i.test(message)
  )
}

export function formatOkxRateLimitMessage(untilMs = coolDownUntilMs): string {
  if (!untilMs || Date.now() >= untilMs) {
    return 'OKX rate limit hit. Wait a bit, then refresh. Prefer Markets websockets for live prices.'
  }
  const when = new Date(untilMs).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
  return `OKX rate-limited until ${when}. Using cache until then — avoid Refresh.`
}
