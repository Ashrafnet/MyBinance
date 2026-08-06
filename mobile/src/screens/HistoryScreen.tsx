import { useEffect, useMemo, useRef, useState } from 'react'
import type { AccountMeta, HistoryAsset, HistoryPoint } from '../domain/types'
import { cacheGetHistory, listAccounts } from '../storage/cache'
import { syncAccount, syncAll, syncHistoryRange } from '../services/sync'
import { useAccountFilter } from '../app/AccountFilterContext'
import { useOnline } from '../app/OnlineContext'
import { AssetIcon } from '../components/AssetIcon'
import { Toast } from '../components/Toast'
import { formatMoney } from '../services/valuation'
import { formatAbsoluteDate, formatAbsoluteTime, formatHumanDate, formatHumanTime } from '../utils/time'

const DAY_MS = 24 * 60 * 60 * 1000
/** Binance allows under 30 days and only within the last month. */
const MAX_SPAN_DAYS = 29

function ymdLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseYmdStart(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d, 0, 0, 0, 0).getTime()
}

function parseYmdEnd(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d, 23, 59, 59, 999).getTime()
}

function oldestAllowedYmd(): string {
  return ymdLocal(new Date(Date.now() - MAX_SPAN_DAYS * DAY_MS))
}

function clampHistoryDates(from: string, to: string): { from: string; to: string; note: string | null } {
  const today = ymdLocal(new Date())
  const oldest = oldestAllowedYmd()
  let f = from
  let t = to
  let note: string | null = null

  if (t > today) t = today
  if (f > t) f = t
  if (f < oldest) {
    f = oldest
    note = 'Binance only keeps about the last 30 days of Spot snapshots.'
  }

  const span = Math.round((parseYmdEnd(t) - parseYmdStart(f)) / DAY_MS)
  if (span > MAX_SPAN_DAYS) {
    f = ymdLocal(new Date(parseYmdEnd(t) - MAX_SPAN_DAYS * DAY_MS))
    if (f < oldest) f = oldest
    note = 'Range capped at 29 days (Binance limit).'
  }

  return { from: f, to: t, note }
}

type DayCard = {
  id: string
  date: string
  usdtValue: number
  btcValue: number
  assets: HistoryAsset[]
  accounts: Array<{
    accountId: string
    alias: string
    exchange: string
    usdtValue: number
    btcValue: number
    assets: HistoryAsset[]
    capturedAt?: number
  }>
  capturedAt?: number
}

function formatQty(n: number) {
  if (!Number.isFinite(n)) return '—'
  if (Math.abs(n) >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 })
  if (Math.abs(n) >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 4 })
  return n.toLocaleString(undefined, { maximumSignificantDigits: 6 })
}

function mergeAssets(lists: HistoryAsset[][]): HistoryAsset[] {
  const map = new Map<string, HistoryAsset>()
  for (const list of lists) {
    for (const a of list) {
      const prev = map.get(a.asset)
      if (!prev) {
        map.set(a.asset, { ...a })
        continue
      }
      map.set(a.asset, {
        asset: a.asset,
        free: prev.free + a.free,
        locked: prev.locked + a.locked,
        total: prev.total + a.total,
        usdtValue: prev.usdtValue + a.usdtValue,
        btcValue: prev.btcValue + a.btcValue,
      })
    }
  }
  return [...map.values()].sort((a, b) => b.usdtValue - a.usdtValue)
}

function buildDayCards(
  points: Array<HistoryPoint & { id: string }>,
  accounts: AccountMeta[],
  accountId: string,
): DayCard[] {
  const alias = (id: string) => accounts.find((a) => a.id === id)?.alias ?? id
  const exchange = (id: string) => accounts.find((a) => a.id === id)?.exchange ?? '—'

  if (accountId !== 'all') {
    return points
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((p) => ({
        id: p.id,
        date: p.date,
        usdtValue: p.usdtValue,
        btcValue: p.btcValue ?? p.assets?.reduce((s, a) => s + a.btcValue, 0) ?? 0,
        assets: (p.assets ?? []).slice().sort((a, b) => b.usdtValue - a.usdtValue),
        capturedAt: p.capturedAt,
        accounts: [
          {
            accountId: p.accountId,
            alias: alias(p.accountId),
            exchange: exchange(p.accountId),
            usdtValue: p.usdtValue,
            btcValue: p.btcValue ?? 0,
            assets: p.assets ?? [],
            capturedAt: p.capturedAt,
          },
        ],
      }))
  }

  const byDate = new Map<string, Array<HistoryPoint & { id: string }>>()
  for (const p of points) {
    const list = byDate.get(p.date) ?? []
    list.push(p)
    byDate.set(p.date, list)
  }

  return [...byDate.entries()]
    .map(([date, rows]) => {
      const assets = mergeAssets(rows.map((r) => r.assets ?? []))
      const usdtValue = rows.reduce((s, r) => s + r.usdtValue, 0)
      const btcValue = rows.reduce(
        (s, r) => s + (r.btcValue ?? r.assets?.reduce((x, a) => x + a.btcValue, 0) ?? 0),
        0,
      )
      const capturedAt = rows.reduce<number | undefined>((latest, r) => {
        if (r.capturedAt == null) return latest
        if (latest == null) return r.capturedAt
        return Math.max(latest, r.capturedAt)
      }, undefined)
      return {
        id: `all:${date}`,
        date,
        usdtValue,
        btcValue,
        assets,
        capturedAt,
        accounts: rows
          .slice()
          .sort((a, b) => b.usdtValue - a.usdtValue)
          .map((r) => ({
            accountId: r.accountId,
            alias: alias(r.accountId),
            exchange: exchange(r.accountId),
            usdtValue: r.usdtValue,
            btcValue: r.btcValue ?? 0,
            assets: r.assets ?? [],
            capturedAt: r.capturedAt,
          })),
      }
    })
    .sort((a, b) => b.date.localeCompare(a.date))
}

export function HistoryScreen() {
  const online = useOnline()
  const { accountId, accounts, refreshAccounts } = useAccountFilter()
  const [points, setPoints] = useState<Array<HistoryPoint & { id: string }>>([])
  const [busy, setBusy] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [fromDate, setFromDate] = useState(() => oldestAllowedYmd())
  const [toDate, setToDate] = useState(() => ymdLocal(new Date()))
  const [rangeNote, setRangeNote] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const backfillTried = useRef(false)

  const todayYmd = ymdLocal(new Date())
  const minYmd = oldestAllowedYmd()

  useEffect(() => {
    setExpanded(null)
    backfillTried.current = false
  }, [accountId])

  async function loadPoints(accs: AccountMeta[], id: string) {
    const ids = id === 'all' ? accs.map((a) => a.id) : [id]
    const all: Array<HistoryPoint & { id: string }> = []
    for (const account of ids) {
      if (account) all.push(...(await cacheGetHistory(account)))
    }
    setPoints(all)
    return all
  }

  useEffect(() => {
    void (async () => {
      await refreshAccounts()
      const accs = await listAccounts()
      const all = await loadPoints(accs, accountId)
      const missingAssets = all.some((p) => !p.assets?.length)
      if (!missingAssets || !online || backfillTried.current) return
      backfillTried.current = true
      setBusy(true)
      try {
        if (accountId === 'all') await syncAll()
        else await syncAccount(accountId)
        await loadPoints(accs, accountId)
      } catch {
        /* keep cached totals */
      } finally {
        setBusy(false)
      }
    })()
  }, [accountId, online, refreshAccounts])

  function applyPreset(days: number) {
    const to = ymdLocal(new Date())
    const from = ymdLocal(new Date(Date.now() - (days - 1) * DAY_MS))
    const clamped = clampHistoryDates(from, to)
    setFromDate(clamped.from)
    setToDate(clamped.to)
    setRangeNote(clamped.note)
  }

  function onFromChange(value: string) {
    const clamped = clampHistoryDates(value, toDate)
    setFromDate(clamped.from)
    setToDate(clamped.to)
    setRangeNote(clamped.note)
  }

  function onToChange(value: string) {
    const clamped = clampHistoryDates(fromDate, value)
    setFromDate(clamped.from)
    setToDate(clamped.to)
    setRangeNote(clamped.note)
  }

  async function refresh() {
    if (!online) return
    const clamped = clampHistoryDates(fromDate, toDate)
    setFromDate(clamped.from)
    setToDate(clamped.to)
    setRangeNote(clamped.note)
    setBusy(true)
    setToast(null)
    try {
      const range = {
        startTime: parseYmdStart(clamped.from),
        endTime: parseYmdEnd(clamped.to),
      }
      const errors = await syncHistoryRange(accountId, range)
      await refreshAccounts()
      const accs = await listAccounts()
      await loadPoints(accs, accountId)
      if (errors.length) setToast(errors.join(' · '))
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Could not load history')
    } finally {
      setBusy(false)
    }
  }

  const cards = useMemo(() => {
    const all = buildDayCards(points, accounts, accountId)
    return all.filter((c) => c.date >= fromDate && c.date <= toDate)
  }, [points, accounts, accountId, fromDate, toDate])

  return (
    <div className="mobile-page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Snapshots</p>
          <h2>History</h2>
        </div>
        <button
          type="button"
          className={`icon-btn page-head-action ${busy ? 'muted-action is-busy' : 'primary-glow'}`}
          disabled={!online || busy}
          aria-label={busy ? 'Loading history' : 'Load history'}
          title={!online ? 'Go online to load' : busy ? 'Loading…' : 'Load history'}
          onClick={() => void refresh()}
        >
          {busy ? (
            <svg className="spin" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
              <path d="M12 4a8 8 0 1 1-6.3 3.1" strokeLinecap="round" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
              <path d="M12 4v11" strokeLinecap="round" />
              <path d="M7.5 11.5 12 16l4.5-4.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M5 19h14" strokeLinecap="round" />
            </svg>
          )}
        </button>
      </div>

      <div className="history-range panel">
        <div className="history-range-presets">
          <button type="button" className="interval-chip" onClick={() => applyPreset(7)}>
            7d
          </button>
          <button type="button" className="interval-chip" onClick={() => applyPreset(14)}>
            14d
          </button>
          <button type="button" className="interval-chip" onClick={() => applyPreset(30)}>
            30d
          </button>
        </div>
        <div className="history-range-fields">
          <label>
            <span>From</span>
            <input
              type="date"
              value={fromDate}
              min={minYmd}
              max={toDate}
              onChange={(e) => onFromChange(e.target.value)}
            />
          </label>
          <label>
            <span>To</span>
            <input
              type="date"
              value={toDate}
              min={fromDate}
              max={todayYmd}
              onChange={(e) => onToChange(e.target.value)}
            />
          </label>
        </div>
        <p className="muted tight history-hint">
          {rangeNote ??
            (cards.length
              ? `${cards.length} day${cards.length === 1 ? '' : 's'} in range · Binance Spot max ~30 days`
              : 'Pick From / To, then Load while online')}
        </p>
      </div>

      <div className="asset-list">
        {cards.map((card, idx) => {
          const open = expanded === card.id
          const prev = cards[idx + 1]
          const delta = prev ? card.usdtValue - prev.usdtValue : null
          const deltaPct =
            prev && prev.usdtValue > 0 && delta != null ? (delta / prev.usdtValue) * 100 : null
          const up = (delta ?? 0) >= 0
          const assetCount = card.assets.length
          const topShare =
            card.usdtValue > 0 && card.assets[0]
              ? (card.assets[0].usdtValue / card.usdtValue) * 100
              : 0

          return (
            <div key={card.id} className={`history-card ${open ? 'open' : ''} ${up ? 'up' : 'down'}`}>
              <button
                type="button"
                className="history-summary"
                aria-expanded={open}
                onClick={() => setExpanded(open ? null : card.id)}
              >
                <div className="history-body">
                  <div className="history-top">
                    <div className="history-date-block">
                      <strong className="history-date" title={formatAbsoluteDate(card.date)}>
                        {formatHumanDate(card.date)}
                      </strong>
                      <span className="history-date-sub">{card.date}</span>
                    </div>
                    <div className="history-value-block">
                      <strong className="history-value">{formatMoney(card.usdtValue)}</strong>
                      {deltaPct != null ? (
                        <span className={`history-delta-pill ${up ? 'up' : 'down'}`}>
                          {up ? '▲' : '▼'} {up ? '+' : ''}
                          {deltaPct.toFixed(2)}%
                          {delta != null ? ` · ${formatMoney(delta, { signed: true })}` : ''}
                        </span>
                      ) : (
                        <span className="history-delta-pill muted">Spot portfolio</span>
                      )}
                    </div>
                  </div>

                  <div className="history-tags" aria-label="Snapshot type and accounts">
                    {accountId === 'all' ? (
                      <span className="pill history-tag combined" title="Sum of Spot value across accounts">
                        Combined Spot
                      </span>
                    ) : (
                      <span className="pill history-tag single" title="Selected account Spot value">
                        Spot snapshot
                      </span>
                    )}
                    {(accountId === 'all' ? card.accounts : card.accounts.slice(0, 1)).map((a) => (
                      <span
                        key={a.accountId}
                        className={`pill exchange history-account-tag ${a.exchange}`}
                        title={`${a.alias} · ${formatMoney(a.usdtValue)}`}
                      >
                        <em>{a.exchange === 'binance' ? 'B' : 'O'}</em>
                        {a.alias}
                        {accountId === 'all' && card.accounts.length > 1 ? (
                          <i>{formatMoney(a.usdtValue)}</i>
                        ) : null}
                      </span>
                    ))}
                  </div>

                  <div className="history-foot">
                    <span>
                      {assetCount > 0
                        ? `${assetCount} asset${assetCount === 1 ? '' : 's'}`
                        : 'No asset breakdown yet'}
                      {accountId === 'all' && card.accounts.length > 1
                        ? ` · ${card.accounts.length} accounts`
                        : ''}
                    </span>
                    <span className="history-chevron" aria-hidden="true">
                      {open ? '▴' : '▾'}
                    </span>
                  </div>
                </div>
              </button>

              {open && (
                <div className="history-details">
                  <div className="order-hero-stat">
                    <div>
                      <em>What this is</em>
                      <strong>End-of-day Spot bag</strong>
                      <p>
                        A frozen look at how much your Spot wallet was worth in USDT on{' '}
                        {formatAbsoluteDate(card.date)}. Expand shows every coin that made up that
                        total — quantities, free vs locked, and each coin’s share.
                      </p>
                    </div>
                  </div>

                  <div className="order-detail-grid plain">
                    <div>
                      <em>Total value</em>
                      <strong>{formatMoney(card.usdtValue)}</strong>
                    </div>
                    <div>
                      <em>BTC value</em>
                      <strong>{card.btcValue > 0 ? card.btcValue.toFixed(6) : '—'}</strong>
                    </div>
                    <div>
                      <em>vs previous day</em>
                      <strong className={delta == null ? '' : up ? 'up' : 'down'}>
                        {delta == null
                          ? 'First in list'
                          : `${formatMoney(delta, { signed: true })}${
                              deltaPct != null ? ` (${up ? '+' : ''}${deltaPct.toFixed(2)}%)` : ''
                            }`}
                      </strong>
                    </div>
                    <div>
                      <em>Assets held</em>
                      <strong>{assetCount > 0 ? assetCount : busy ? 'Loading…' : '—'}</strong>
                    </div>
                    <div>
                      <em>Calendar day</em>
                      <strong title={card.date}>{formatAbsoluteDate(card.date)}</strong>
                    </div>
                    <div>
                      <em>Captured</em>
                      <strong title={card.capturedAt ? formatAbsoluteTime(card.capturedAt) : undefined}>
                        {card.capturedAt ? formatHumanTime(card.capturedAt) : '—'}
                      </strong>
                    </div>
                    <div>
                      <em>Accounts in snap</em>
                      <strong>{card.accounts.length}</strong>
                    </div>
                    <div>
                      <em>Largest holding</em>
                      <strong>
                        {card.assets[0]
                          ? `${card.assets[0].asset} · ${topShare.toFixed(1)}%`
                          : '—'}
                      </strong>
                    </div>
                  </div>

                  {card.accounts.length > 1 && (
                    <div className="history-section">
                      <em>By account</em>
                      <div className="history-account-list">
                        {card.accounts.map((a) => (
                          <div key={a.accountId} className="history-account-row">
                            <div>
                              <strong>{a.alias}</strong>
                              <span>
                                {a.exchange === 'binance' ? 'Binance' : a.exchange === 'okx' ? 'OKX' : a.exchange}
                                {a.assets.length ? ` · ${a.assets.length} assets` : ''}
                              </span>
                            </div>
                            <strong>{formatMoney(a.usdtValue)}</strong>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="history-section">
                    <em>Holdings in this snapshot</em>
                    {card.assets.length === 0 ? (
                      <div className="history-empty-assets">
                        No coin breakdown stored for this day yet. Tap <strong>Refresh</strong> while
                        online — Binance Spot snapshots include every balance, and today’s sync
                        saves your live holdings.
                      </div>
                    ) : (
                      <div className="history-asset-list">
                        {card.assets.map((a) => {
                          const share = card.usdtValue > 0 ? (a.usdtValue / card.usdtValue) * 100 : 0
                          const locked = Math.max(0, a.total - a.free)
                          return (
                            <div key={a.asset} className="history-asset-row">
                              <AssetIcon asset={a.asset} />
                              <div className="asset-main">
                                <div className="asset-title">
                                  <strong>{a.asset}</strong>
                                  <span className="asset-price">{share.toFixed(1)}% of bag</span>
                                </div>
                                <div className="holding-meta">
                                  <span>
                                    <em>Total</em> {formatQty(a.total)}
                                  </span>
                                  <span>
                                    <em>Free</em> {formatQty(a.free)}
                                  </span>
                                  <span>
                                    <em>Locked</em> {formatQty(locked)}
                                  </span>
                                </div>
                                <div className="holding-share-track" aria-hidden="true">
                                  <div
                                    className="holding-share-bar"
                                    style={{ width: `${Math.min(100, share)}%` }}
                                  />
                                </div>
                              </div>
                              <div className="history-asset-values">
                                <strong>{formatMoney(a.usdtValue)}</strong>
                                <span>{a.btcValue > 0 ? `${a.btcValue.toFixed(6)} BTC` : '—'}</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  <p className="history-footnote">
                    Why it matters: compare days to see whether the bag grew from price moves or from
                    buying/selling. Locked amounts are usually coins sitting in open orders.
                  </p>
                </div>
              )}
            </div>
          )
        })}
        {cards.length === 0 && (
          <div className="empty-card">
            No snapshots in this date range. Tap Load while online to pull Binance daily history.
          </div>
        )}
      </div>

      <Toast message={toast} onClose={() => setToast(null)} />
    </div>
  )
}
