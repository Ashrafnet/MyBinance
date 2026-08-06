const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

function startOfLocalDay(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** Parse `YYYY-MM-DD` (or timestamp) as a local calendar day. */
export function parseDay(input: string | number | null | undefined): number | null {
  if (input == null) return null
  if (typeof input === 'number') {
    if (!Number.isFinite(input) || input <= 0) return null
    return startOfLocalDay(input)
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.trim())
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0).getTime()
  }
  const t = Date.parse(input)
  if (!Number.isFinite(t)) return null
  return startOfLocalDay(t)
}

/** Human calendar day for history / snapshot labels. */
export function formatHumanDate(input: string | number | null | undefined, now = Date.now()): string {
  const ts = parseDay(input)
  if (ts == null) return '—'

  const dayDiff = Math.round((startOfLocalDay(now) - startOfLocalDay(ts)) / DAY)
  if (dayDiff === 0) return 'Today'
  if (dayDiff === 1) return 'Yesterday'
  if (dayDiff === -1) return 'Tomorrow'
  if (dayDiff > 1 && dayDiff < 7) return `${dayDiff}d ago`
  if (dayDiff < -1 && dayDiff > -7) return `in ${Math.abs(dayDiff)}d`

  const d = new Date(ts)
  const sameYear = d.getFullYear() === new Date(now).getFullYear()
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
}

export function formatAbsoluteDate(input: string | number | null | undefined): string {
  const ts = parseDay(input)
  if (ts == null) return ''
  return new Date(ts).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/** Relative, readable time for UI (absolute date available via `formatAbsoluteTime`). */
export function formatHumanTime(ts: number | null | undefined, now = Date.now()): string {
  if (ts == null || !Number.isFinite(ts) || ts <= 0) return '—'
  const diff = now - ts
  const abs = Math.abs(diff)
  const future = diff < 0

  if (abs < 15_000) return 'Just now'
  if (abs < MINUTE) {
    const s = Math.max(1, Math.round(abs / 1000))
    return future ? `in ${s}s` : `${s}s ago`
  }
  if (abs < HOUR) {
    const m = Math.max(1, Math.round(abs / MINUTE))
    return future ? `in ${m}m` : `${m}m ago`
  }
  if (abs < DAY) {
    const h = Math.max(1, Math.round(abs / HOUR))
    return future ? `in ${h}h` : `${h}h ago`
  }

  // Same calendar day rules once we're past hours
  return formatHumanDate(ts, now)
}

export function formatAbsoluteTime(ts: number | null | undefined): string {
  if (ts == null || !Number.isFinite(ts) || ts <= 0) return ''
  return new Date(ts).toLocaleString()
}
