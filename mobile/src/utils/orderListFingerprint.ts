import type { OrderRow } from '../domain/types'

export function orderListFingerprint(orders: OrderRow[]): string {
  return orders
    .map((o) => `${o.id}|${o.status}|${o.filledQuantity}|${o.updatedAt}`)
    .sort()
    .join(';')
}
