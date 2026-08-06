import { useEffect, useMemo, useRef, useState } from 'react'
import type { AccountMeta, HistoryAsset, HistoryPoint } from '../domain/types'
import { cacheGetHistory, listAccounts } from '../storage/cache'
import { syncAccount, syncAll } from '../services/sync'
import { useOnline } from '../app/OnlineContext'
import { AppSelect } from '../components/AppSelect'
import { AssetIcon } from '../components/AssetIcon'
import { formatAbsoluteDate, formatAbsoluteTime, formatHumanDate, formatHumanTime } from '../utils/time'

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
  const [accounts, setAccounts] = useState<AccountMeta[]>([])
  const [accountId, setAccountId] = useState('all')
  const [points, setPoints] = useState<Array<HistoryPoint & { id: string }>>([])
  const [busy, setBusy] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const backfillTried = useRef(false)

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
      const accs = await listAccounts()
      setAccounts(accs)
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
  }, [accountId, online])

  async function refresh() {
    if (!online) return
    setBusy(true)
    try {
      if (accountId === 'all') await syncAll()
      else await syncAccount(accountId)
      const accs = await listAccounts()
      setAccounts(accs)
      await loadPoints(accs, accountId)
    } finally {
      setBusy(false)
    }
  }

  const cards = useMemo(() => buildDayCards(points, accounts, accountId), [points, accounts, accountId])

  return (
    <div className="mobile-page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Snapshots</p>
          <h2>History</h2>
        </div>
        <button
          type="button"
          className="btn primary btn-compact"
          disabled={!online || busy}
          onClick={() => void refresh()}
        >
          {busy ? '…' : 'Refresh'}
        </button>
      </div>

      <AppSelect
        fullWidth
        icon="wallet"
        value={accountId}
        onChange={setAccountId}
        options={[
          { value: 'all', label: 'All accounts', hint: 'Combined' },
          ...accounts.map((a) => ({
            value: a.id,
            label: a.alias,
            hint: a.exchange === 'binance' ? 'Binance' : 'OKX',
          })),
        ]}
      />

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
                <div className="asset-avatar">$</div>
                <div className="asset-main">
                  <strong title={formatAbsoluteDate(card.date)}>{formatHumanDate(card.date)}</strong>
                  <span>
                    {assetCount > 0
                      ? `${assetCount} asset${assetCount === 1 ? '' : 's'}`
                      : 'Daily snapshot'}
                    {delta != null
                      ? ` · ${up ? '+' : ''}$${Math.abs(delta).toFixed(2)} vs prior`
                      : ''}
                  </span>
                </div>
                <div className="history-side">
                  <strong>${card.usdtValue.toFixed(2)}</strong>
                  {deltaPct != null ? (
                    <span className={up ? 'up' : 'down'}>
                      {up ? '+' : ''}
                      {deltaPct.toFixed(2)}%
                    </span>
                  ) : (
                    <span>Spot value</span>
                  )}
                  <span className="order-chevron">{open ? '▴' : '▾'}</span>
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
                      <strong>${card.usdtValue.toFixed(2)}</strong>
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
                          : `${up ? '+' : ''}$${delta.toFixed(2)}${
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
                            <strong>${a.usdtValue.toFixed(2)}</strong>
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
                                <strong>${a.usdtValue.toFixed(2)}</strong>
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
          <div className="empty-card">No history cached yet. Tap Refresh to sync daily snapshots.</div>
        )}
      </div>
    </div>
  )
}
