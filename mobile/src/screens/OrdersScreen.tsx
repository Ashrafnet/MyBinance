import { useCallback, useEffect, useState, type FormEvent } from 'react'
import type { AccountMeta, OrderRow, OrderSide, OrderType } from '../domain/types'
import {
  cacheGetOpenOrders,
  cacheGetOrderHistory,
  cacheUpsertOrders,
  listAccounts,
} from '../storage/cache'
import { getCredentials } from '../storage/vault'
import { getExchange } from '../exchanges/registry'
import { useOnline } from '../app/OnlineContext'
import { Toast } from '../components/Toast'
import { syncAccount } from '../services/sync'

export function OrdersScreen() {
  const online = useOnline()
  const [tab, setTab] = useState<'open' | 'history' | 'place'>('open')
  const [accounts, setAccounts] = useState<AccountMeta[]>([])
  const [accountId, setAccountId] = useState('')
  const [open, setOpen] = useState<OrderRow[]>([])
  const [history, setHistory] = useState<OrderRow[]>([])
  const [toast, setToast] = useState<string | null>(null)

  const [symbol, setSymbol] = useState('BTCUSDT')
  const [side, setSide] = useState<OrderSide>('buy')
  const [type, setType] = useState<OrderType>('limit')
  const [quantity, setQuantity] = useState('0.001')
  const [price, setPrice] = useState('')

  const load = useCallback(async () => {
    const accs = await listAccounts()
    setAccounts(accs)
    if (!accountId && accs[0]) setAccountId(accs[0].id)
    const id = accountId || accs[0]?.id
    setOpen(await cacheGetOpenOrders(id))
    setHistory(await cacheGetOrderHistory(id))
  }, [accountId])

  useEffect(() => {
    void load()
  }, [load])

  async function cancel(order: OrderRow) {
    if (!online) return
    if (!confirm(`Cancel ${order.side} ${order.symbol}?`)) return
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
      setToast('Order canceled')
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Cancel failed')
    }
  }

  async function place(e: FormEvent) {
    e.preventDefault()
    if (!online || !accountId) return
    try {
      const acc = accounts.find((a) => a.id === accountId)
      if (!acc) throw new Error('Pick an account')
      const creds = await getCredentials(accountId)
      if (!creds) throw new Error('Missing credentials')
      const order = await getExchange(acc.exchange).placeOrder(creds, {
        accountId,
        symbol: symbol.toUpperCase(),
        side,
        type,
        quantity: Number(quantity),
        price: type === 'limit' ? Number(price) : undefined,
      })
      await cacheUpsertOrders([order])
      await syncAccount(accountId)
      await load()
      setTab('open')
      setToast('Order placed')
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Place failed')
    }
  }

  return (
    <div>
      <p className="eyebrow">Trading</p>
      <h2>Orders</h2>
      <div className="row filters">
        <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.alias} ({a.exchange})
            </option>
          ))}
        </select>
      </div>
      <div className="tabs">
        <button type="button" className={`btn ${tab === 'open' ? 'active' : ''}`} onClick={() => setTab('open')}>
          Open
        </button>
        <button type="button" className={`btn ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>
          History
        </button>
        <button type="button" className={`btn ${tab === 'place' ? 'active' : ''}`} onClick={() => setTab('place')}>
          Place
        </button>
      </div>

      {tab === 'place' && (
        <form className="panel" onSubmit={(e) => void place(e)}>
          <div className="form-grid">
            <label className="full">
              Symbol
              <input value={symbol} onChange={(e) => setSymbol(e.target.value)} />
            </label>
            <label>
              Side
              <select value={side} onChange={(e) => setSide(e.target.value as OrderSide)}>
                <option value="buy">Buy</option>
                <option value="sell">Sell</option>
              </select>
            </label>
            <label>
              Type
              <select value={type} onChange={(e) => setType(e.target.value as OrderType)}>
                <option value="limit">Limit</option>
                <option value="market">Market</option>
              </select>
            </label>
            <label>
              Quantity
              <input value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </label>
            {type === 'limit' && (
              <label>
                Price
                <input value={price} onChange={(e) => setPrice(e.target.value)} required />
              </label>
            )}
          </div>
          <button type="submit" className="btn primary block" disabled={!online}>
            Place order
          </button>
        </form>
      )}

      {(tab === 'open' || tab === 'history') && (
        <div className="panel balance-shell">
          <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Side</th>
                <th>Type</th>
                <th>Qty</th>
                <th>Price</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(tab === 'open' ? open : history).map((o) => (
                <tr key={o.id}>
                  <td>{o.symbol}</td>
                  <td className={o.side === 'buy' ? 'up' : 'down'}>{o.side}</td>
                  <td>{o.type}</td>
                  <td>
                    {o.filledQuantity}/{o.quantity}
                  </td>
                  <td>{o.price ?? 'mkt'}</td>
                  <td>{o.status}</td>
                  <td>
                    {tab === 'open' && (
                      <button type="button" className="btn danger btn-compact" disabled={!online} onClick={() => void cancel(o)}>
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
      <Toast message={toast} onClose={() => setToast(null)} />
    </div>
  )
}
