import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import type { OrderRow, OrderSide, OrderType, TickerRow } from '../domain/types'
import {
  cacheGetOpenOrders,
  cacheGetOrderHistory,
  cacheGetTickers,
  cacheUpsertOrders,
  listAccounts,
} from '../storage/cache'
import { getCredentials } from '../storage/vault'
import { getExchange } from '../exchanges/registry'
import { useAccountFilter } from '../app/AccountFilterContext'
import { useOnline } from '../app/OnlineContext'
import { Toast } from '../components/Toast'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { AssetIcon } from '../components/AssetIcon'
import { AppSelect } from '../components/AppSelect'
import { ACCOUNT_LIVE_EVENT } from '../services/accountLive'
import { syncAccount } from '../services/sync'
import { formatMoney, formatUnitPrice } from '../services/valuation'
import { formatAbsoluteTime, formatHumanTime } from '../utils/time'
import { orderListFingerprint } from '../utils/orderListFingerprint'

async function loadOrdersForAccounts(ids: string[]) {
  const openRows: OrderRow[] = []
  const histRows: OrderRow[] = []
  for (const id of ids) {
    if (!id) continue
    openRows.push(...(await cacheGetOpenOrders(id)))
    histRows.push(...(await cacheGetOrderHistory(id)))
  }
  openRows.sort((a, b) => b.updatedAt - a.updatedAt)
  histRows.sort((a, b) => b.updatedAt - a.updatedAt)
  return { open: openRows, history: histRows }
}

export function OrdersScreen() {
  const online = useOnline()
  const navigate = useNavigate()
  const { accountId, accounts, tradingAccountId, refreshAccounts } = useAccountFilter()
  const [tab, setTab] = useState<'open' | 'history' | 'place'>('open')
  const [open, setOpen] = useState<OrderRow[]>([])
  const [history, setHistory] = useState<OrderRow[]>([])
  const [toast, setToast] = useState<string | null>(null)
  const [pendingCancel, setPendingCancel] = useState<OrderRow | null>(null)
  const [cancelBusy, setCancelBusy] = useState(false)
  const [syncBusy, setSyncBusy] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const [symbol, setSymbol] = useState('BTCUSDT')
  const [side, setSide] = useState<OrderSide>('buy')
  const [type, setType] = useState<OrderType>('limit')
  const [quantity, setQuantity] = useState('0.001')
  const [price, setPrice] = useState('')
  const [tickers, setTickers] = useState<TickerRow[]>([])
  const [symbolFocus, setSymbolFocus] = useState(false)
  const [symbolHi, setSymbolHi] = useState(0)
  const pricedSymbolRef = useRef('')

  const scopedIds = useMemo(() => {
    if (accountId === 'all') return accounts.map((a) => a.id)
    return accountId ? [accountId] : []
  }, [accountId, accounts])

  const load = useCallback(async () => {
    await refreshAccounts()
    const accs = await listAccounts()
    const ids = accountId === 'all' ? accs.map((a) => a.id) : accountId ? [accountId] : []
    const next = await loadOrdersForAccounts(ids)
    setOpen((prev) => (orderListFingerprint(prev) === orderListFingerprint(next.open) ? prev : next.open))
    setHistory((prev) =>
      orderListFingerprint(prev) === orderListFingerprint(next.history) ? prev : next.history,
    )
  }, [accountId, refreshAccounts])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const onLive = () => {
      void load()
    }
    window.addEventListener(ACCOUNT_LIVE_EVENT, onLive)
    return () => window.removeEventListener(ACCOUNT_LIVE_EVENT, onLive)
  }, [load])

  useEffect(() => {
    setExpandedId(null)
  }, [tab, accountId])

  useEffect(() => {
    if (tab !== 'place') return
    void (async () => {
      let t = await cacheGetTickers()
      if (online && t.length === 0) {
        const acc = accounts.find((a) => a.id === tradingAccountId)
        try {
          t = await getExchange(acc?.exchange ?? 'binance').fetchTickers()
        } catch {
          /* keep cache */
        }
      }
      setTickers(t.filter((x) => x.symbol.endsWith('USDT')))
    })()
  }, [tab, online, tradingAccountId, accounts])

  const symbolSuggestions = useMemo(() => {
    const q = symbol.trim().toUpperCase()
    if (!q || q.length < 1) return []
    const exact = tickers.find((t) => t.symbol === q)
    const starts = tickers.filter((t) => t.symbol.startsWith(q) && t.symbol !== q)
    const contains = tickers.filter((t) => !t.symbol.startsWith(q) && t.symbol.includes(q))
    const ranked = [...(exact ? [exact] : []), ...starts, ...contains]
    return ranked.slice(0, 8)
  }, [symbol, tickers])

  const showSymbolMenu = symbolFocus && symbol.trim().length > 0 && symbolSuggestions.length > 0
  const matchedSymbol = showSymbolMenu
    ? (symbolSuggestions[symbolHi]?.symbol ?? symbolSuggestions[0]?.symbol ?? null)
    : (tickers.find((t) => t.symbol === symbol.trim().toUpperCase())?.symbol ?? null)

  useEffect(() => {
    setSymbolHi(0)
  }, [symbol, symbolSuggestions.length])

  function pickSymbol(t: TickerRow) {
    setSymbol(t.symbol)
    setSymbolFocus(false)
    setSymbolHi(0)
    fillPriceForSymbol(t.symbol, t.last)
  }

  function onSymbolKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!showSymbolMenu && e.key !== 'ArrowDown') return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSymbolFocus(true)
      if (!symbolSuggestions.length) return
      setSymbolHi((i) => (showSymbolMenu ? (i + 1) % symbolSuggestions.length : 0))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (!symbolSuggestions.length) return
      setSymbolHi((i) => (i - 1 + symbolSuggestions.length) % symbolSuggestions.length)
      return
    }
    if (e.key === 'Enter' && showSymbolMenu) {
      const pick = symbolSuggestions[symbolHi]
      if (pick) {
        e.preventDefault()
        pickSymbol(pick)
      }
      return
    }
    if (e.key === 'Escape') {
      setSymbolFocus(false)
      setSymbolHi(0)
    }
  }

  function fillPriceForSymbol(sym: string, last?: number) {
    const s = sym.trim().toUpperCase()
    const px = last ?? tickers.find((t) => t.symbol === s)?.last
    if (!px || !Number.isFinite(px)) return
    pricedSymbolRef.current = s
    setPrice(formatPriceInput(px))
  }

  // When the typed/selected symbol matches a market, seed the limit price.
  useEffect(() => {
    if (type !== 'limit') return
    const s = symbol.trim().toUpperCase()
    const t = tickers.find((row) => row.symbol === s)
    if (!t?.last) return
    if (pricedSymbolRef.current === s && price !== '') return
    fillPriceForSymbol(s, t.last)
  }, [symbol, tickers, type])

  // Cache-first: paint from IndexedDB via `load`, then silently refresh online.
  // Order history is Binance-heavy — only fetch when History tab is open.
  useEffect(() => {
    if (tab !== 'history' && tab !== 'open') return
    if (!online || scopedIds.length === 0) return
    let alive = true
    void (async () => {
      setSyncBusy(true)
      try {
        for (const id of scopedIds) {
          try {
            await syncAccount(id, { orderHistory: tab === 'history' })
          } catch {
            /* keep cache */
          }
        }
        if (!alive) return
        const next = await loadOrdersForAccounts(scopedIds)
        setOpen((prev) =>
          orderListFingerprint(prev) === orderListFingerprint(next.open) ? prev : next.open,
        )
        setHistory((prev) =>
          orderListFingerprint(prev) === orderListFingerprint(next.history) ? prev : next.history,
        )
      } finally {
        if (alive) setSyncBusy(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [tab, scopedIds, online])

  async function confirmCancel() {
    const order = pendingCancel
    if (!order || !online) return
    setCancelBusy(true)
    try {
      const creds = await getCredentials(order.accountId)
      if (!creds) throw new Error('Missing credentials')
      await getExchange(order.exchange).cancelOrder(creds, {
        accountId: order.accountId,
        symbol: order.symbol,
        orderId: order.id,
      })
      await syncAccount(order.accountId)
      await load()
      setPendingCancel(null)
      setToast('Order canceled')
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Cancel failed')
    } finally {
      setCancelBusy(false)
    }
  }

  async function place(e: FormEvent) {
    e.preventDefault()
    if (!online || !tradingAccountId) return
    try {
      const acc = accounts.find((a) => a.id === tradingAccountId)
      if (!acc) throw new Error('Pick an account')
      const creds = await getCredentials(tradingAccountId)
      if (!creds) throw new Error('Missing credentials')
      const order = await getExchange(acc.exchange).placeOrder(creds, {
        accountId: tradingAccountId,
        symbol: symbol.toUpperCase(),
        side,
        type,
        quantity: Number(quantity),
        price: type === 'limit' ? Number(price) : undefined,
      })
      await cacheUpsertOrders([order])
      await syncAccount(tradingAccountId)
      await load()
      setTab('open')
      setToast('Order placed')
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Place failed')
    }
  }

  const list = tab === 'open' ? open : history
  const accountAlias = (id: string) => accounts.find((a) => a.id === id)?.alias ?? id
  const tradingAlias = accountAlias(tradingAccountId)

  return (
    <div className="mobile-page">
      <p className="eyebrow">Trading</p>
      <h2>Orders</h2>

      <div className="tabs tabs-stretch tabs-icons order-tabs">
        <button
          type="button"
          className={`btn tone-open ${tab === 'open' ? 'active' : ''}`}
          onClick={() => setTab('open')}
        >
          <OrderOpenIcon />
          Open
        </button>
        <button
          type="button"
          className={`btn tone-history ${tab === 'history' ? 'active' : ''}`}
          onClick={() => setTab('history')}
        >
          <OrderHistoryIcon />
          History
        </button>
        <button
          type="button"
          className={`btn tone-place ${tab === 'place' ? 'active' : ''}`}
          onClick={() => setTab('place')}
        >
          <OrderPlaceIcon />
          Place
        </button>
      </div>

      {tab === 'place' && (
        <form className="panel" onSubmit={(e) => void place(e)}>
          {tradingAccountId && (
            <p className="muted tight">
              Placing on {tradingAlias}
              {accountId === 'all' ? ' (first account — pick one in the top bar to choose)' : ''}
            </p>
          )}
          <div className="symbol-field">
            <label htmlFor="order-symbol">Symbol</label>
            <div className={`symbol-input-wrap ${matchedSymbol ? 'has-icon' : ''}`}>
              {matchedSymbol && <AssetIcon asset={matchedSymbol} />}
              <input
                id="order-symbol"
                value={symbol}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                placeholder="Search BTC, ETH…"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={showSymbolMenu}
                aria-controls="symbol-suggest-list"
                aria-activedescendant={
                  showSymbolMenu && symbolSuggestions[symbolHi]
                    ? `symbol-opt-${symbolSuggestions[symbolHi]!.symbol}`
                    : undefined
                }
                onFocus={() => setSymbolFocus(true)}
                onBlur={() => window.setTimeout(() => setSymbolFocus(false), 150)}
                onChange={(e) => {
                  setSymbolFocus(true)
                  setSymbol(e.target.value.toUpperCase())
                }}
                onKeyDown={onSymbolKeyDown}
              />
            </div>
            {showSymbolMenu && (
              <ul id="symbol-suggest-list" className="symbol-suggest" role="listbox">
                {symbolSuggestions.map((t, idx) => (
                  <li key={t.symbol} id={`symbol-opt-${t.symbol}`} role="option" aria-selected={idx === symbolHi}>
                    <button
                      type="button"
                      className={`symbol-suggest-item ${idx === symbolHi ? 'active' : ''}`}
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseEnter={() => setSymbolHi(idx)}
                      onClick={() => pickSymbol(t)}
                    >
                      <AssetIcon asset={t.symbol} />
                      <span className="symbol-suggest-main">
                        <strong>{t.symbol}</strong>
                        <span>${formatUnitPrice(t.last)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="side-toggle">
            <button
              type="button"
              className={`side-btn buy ${side === 'buy' ? 'active' : ''}`}
              onClick={() => setSide('buy')}
            >
              <BuyIcon />
              Buy
            </button>
            <button
              type="button"
              className={`side-btn sell ${side === 'sell' ? 'active' : ''}`}
              onClick={() => setSide('sell')}
            >
              <SellIcon />
              Sell
            </button>
          </div>
          <div className="form-grid two">
            <AppSelect
              variant="field"
              icon="type"
              label="Type"
              value={type}
              onChange={(v) => setType(v as OrderType)}
              options={[
                { value: 'limit', label: 'Limit', hint: 'Set your price' },
                { value: 'market', label: 'Market', hint: 'Fill now' },
              ]}
            />
            <label>
              Quantity
              <input value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </label>
            {type === 'limit' && (
              <label className="full">
                Price
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  required
                />
              </label>
            )}
          </div>
          <button
            type="submit"
            className={`btn block ${side === 'buy' ? 'buy' : 'sell'}`}
            disabled={!online || !tradingAccountId}
          >
            {side === 'buy' ? 'Buy' : 'Sell'} {symbol.toUpperCase()}
          </button>
        </form>
      )}

      {(tab === 'open' || tab === 'history') && (
        <div className="asset-list">
          {list.map((o) => {
            const expanded = expandedId === o.id
            const fillPct = o.quantity > 0 ? Math.min(100, (o.filledQuantity / o.quantity) * 100) : 0
            const remaining = Math.max(0, o.quantity - o.filledQuantity)
            const orderSizeUsd =
              o.price != null ? o.quantity * o.price : null
            const filledUsd =
              o.price != null && o.filledQuantity > 0 ? o.filledQuantity * o.price : null
            const statusTone =
              o.status === 'filled' ? 'ok' : o.status === 'canceled' || o.status === 'rejected' ? 'bad' : 'live'
            const statusLabel =
              o.status === 'filled'
                ? 'Completed'
                : o.status === 'canceled'
                  ? 'Canceled'
                  : o.status === 'rejected'
                    ? 'Rejected'
                    : o.status === 'partial'
                      ? 'Partly filled'
                      : 'Waiting'
            const sideVerb = o.side === 'buy' ? 'Buy' : 'Sell'
            const typeLabel = o.type === 'limit' ? 'Limit' : 'Market'
            return (
              <div key={o.id} className={`order-card ${o.side} ${expanded ? 'open' : ''} ${statusTone}`}>
                <button
                  type="button"
                  className="order-summary"
                  aria-expanded={expanded}
                  onClick={() => setExpandedId(expanded ? null : o.id)}
                >
                  <AssetIcon asset={o.symbol} />
                  <div className="order-main">
                    <div className="order-top">
                      <strong>{o.symbol}</strong>
                      <span className={`pill ${o.side === 'buy' ? 'up' : 'down'}`}>{sideVerb}</span>
                      <span className={`pill status ${statusTone}`}>{statusLabel}</span>
                    </div>
                    <span className="order-summary-line">
                      {typeLabel} · {formatQty(o.filledQuantity)} of {formatQty(o.quantity)} done
                      {o.price != null ? ` · $${formatUnitPrice(o.price)} each` : ' · market price'}
                    </span>
                    <div className="order-fill-track" aria-hidden="true">
                      <div className="order-fill-bar" style={{ width: `${fillPct}%` }} />
                    </div>
                  </div>
                  <div className="order-summary-side">
                    <strong>{orderSizeUsd != null ? formatMoney(orderSizeUsd) : '—'}</strong>
                    <span className="order-side-caption">Order size</span>
                    <span className="order-chevron">{expanded ? '▴' : '▾'}</span>
                  </div>
                </button>

                {expanded && (
                  <div className="order-details">
                    <div className="order-hero-stat">
                      <div>
                        <em>Order size</em>
                        <strong>{orderSizeUsd != null ? formatMoney(orderSizeUsd) : 'Uses market price'}</strong>
                        <p>
                          {o.price != null
                            ? `${formatQty(o.quantity)} coins × $${formatUnitPrice(o.price)}`
                            : 'Filled at whatever the market price is when it executes'}
                        </p>
                      </div>
                      <div>
                        <em>Progress</em>
                        <strong>{fillPct.toFixed(0)}% done</strong>
                        <p>
                          {formatQty(o.filledQuantity)} filled · {formatQty(remaining)} left
                          {filledUsd != null ? ` · ${formatMoney(filledUsd)} so far` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="order-detail-grid plain">
                      <div>
                        <em>{o.side === 'buy' ? 'Amount to buy' : 'Amount to sell'}</em>
                        <strong>{formatQty(o.quantity)}</strong>
                      </div>
                      <div>
                        <em>{o.type === 'limit' ? 'Your limit price' : 'Price type'}</em>
                        <strong>{o.price != null ? `$${formatUnitPrice(o.price)}` : 'Market'}</strong>
                      </div>
                      <div>
                        <em>Already filled</em>
                        <strong>{formatQty(o.filledQuantity)}</strong>
                      </div>
                      <div>
                        <em>Still open</em>
                        <strong>{formatQty(remaining)}</strong>
                      </div>
                    </div>

                    <div className="order-meta-block">
                      <div>
                        <em>Exchange</em>
                        <strong>{o.exchange === 'binance' ? 'Binance' : 'OKX'}</strong>
                      </div>
                      <div>
                        <em>Account</em>
                        <strong>{accountAlias(o.accountId)}</strong>
                      </div>
                      <div>
                        <em>Created</em>
                        <strong title={formatAbsoluteTime(o.createdAt)}>{formatHumanTime(o.createdAt)}</strong>
                      </div>
                      <div>
                        <em>Last update</em>
                        <strong title={formatAbsoluteTime(o.updatedAt)}>{formatHumanTime(o.updatedAt)}</strong>
                      </div>
                    </div>

                    <p className="order-id">Order ID {shortOrderId(o.id)}</p>
                    <div className="order-detail-actions">
                      <button
                        type="button"
                        className="icon-btn order-action-btn primary"
                        aria-label="Open chart"
                        title="Open chart"
                        onClick={() =>
                          navigate('/live', {
                            state: { symbol: o.symbol, view: 'chart', exchange: o.exchange },
                          })
                        }
                      >
                        <ChartActionIcon />
                      </button>
                      {tab === 'open' && (
                        <button
                          type="button"
                          className="icon-btn order-action-btn danger"
                          aria-label="Cancel order"
                          title="Cancel order"
                          disabled={!online}
                          onClick={() => setPendingCancel(o)}
                        >
                          <CancelOrderIcon />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
          {list.length === 0 && (
            <div className="empty-card">
              {tab === 'open'
                ? syncBusy
                  ? 'Updating open orders…'
                  : 'No open orders.'
                : syncBusy
                  ? 'Updating order history…'
                  : !online
                    ? 'No cached history yet. Go online to load from the exchange.'
                    : 'No filled or canceled orders found for your held assets.'}
            </div>
          )}
          {list.length > 0 && syncBusy && (
            <p className="muted tight" aria-live="polite">
              Updating…
            </p>
          )}
        </div>
      )}

      <ConfirmDialog
        open={pendingCancel != null}
        title="Cancel this order?"
        message="This removes the open order from the exchange. Filled amount stays filled."
        detail={
          pendingCancel
            ? `${pendingCancel.side.toUpperCase()} ${pendingCancel.symbol} · ${pendingCancel.type} · ${pendingCancel.filledQuantity}/${pendingCancel.quantity} @ ${pendingCancel.price ?? 'market'}`
            : undefined
        }
        confirmLabel="Cancel order"
        cancelLabel="Keep order"
        danger
        busy={cancelBusy}
        onConfirm={() => void confirmCancel()}
        onCancel={() => {
          if (!cancelBusy) setPendingCancel(null)
        }}
      />

      <Toast message={toast} onClose={() => setToast(null)} />
    </div>
  )
}

function formatPriceInput(n: number) {
  if (!Number.isFinite(n) || n <= 0) return ''
  if (n >= 1000) return n.toFixed(2)
  if (n >= 1) return n.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')
  return n.toFixed(8).replace(/0+$/, '').replace(/\.$/, '')
}

function formatQty(n: number) {
  if (!Number.isFinite(n)) return '—'
  if (Math.abs(n) >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 })
  if (Math.abs(n) >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 4 })
  return n.toPrecision(4).replace(/0+$/, '').replace(/\.$/, '')
}

function shortOrderId(id: string) {
  const raw = id.includes(':') ? id.split(':').pop()! : id
  return raw.length > 18 ? `${raw.slice(0, 10)}…${raw.slice(-6)}` : raw
}

function OrderOpenIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M8 7h12M8 12h12M8 17h12" strokeLinecap="round" />
      <circle cx="4.5" cy="7" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="12" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="17" r="1.15" fill="currentColor" stroke="none" />
    </svg>
  )
}

function OrderHistoryIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function OrderPlaceIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M4 7h12M16 7l-3.2-3.2M16 7l-3.2 3.2M20 17H8M8 17l3.2-3.2M8 17l3.2 3.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function BuyIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M12 19V5" strokeLinecap="round" />
      <path d="M6.5 10.5 12 5l5.5 5.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SellIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M12 5v14" strokeLinecap="round" />
      <path d="M6.5 13.5 12 19l5.5-5.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ChartActionIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 19V5M4 19h16" strokeLinecap="round" />
      <path d="M8 15v-4M12 15V8M16 15v-6" strokeLinecap="round" />
    </svg>
  )
}

function CancelOrderIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="8" />
      <path d="M9 9l6 6M15 9l-6 6" strokeLinecap="round" />
    </svg>
  )
}
