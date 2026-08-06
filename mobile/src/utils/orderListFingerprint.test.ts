import { describe, expect, it } from 'vitest'
import { orderListFingerprint } from './orderListFingerprint'
import type { OrderRow } from '../domain/types'

const base: OrderRow = {
  id: 'binance:a:1',
  accountId: 'a',
  exchange: 'binance',
  symbol: 'BTCUSDT',
  side: 'buy',
  type: 'limit',
  price: 1,
  quantity: 1,
  filledQuantity: 1,
  status: 'filled',
  createdAt: 1,
  updatedAt: 2,
}

describe('orderListFingerprint', () => {
  it('is order-independent for same rows', () => {
    const a = orderListFingerprint([base, { ...base, id: 'x', updatedAt: 3 }])
    const b = orderListFingerprint([{ ...base, id: 'x', updatedAt: 3 }, base])
    expect(a).toBe(b)
  })

  it('changes when filledQuantity changes', () => {
    expect(orderListFingerprint([base])).not.toBe(
      orderListFingerprint([{ ...base, filledQuantity: 0.5 }]),
    )
  })
})
