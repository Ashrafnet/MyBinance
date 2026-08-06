import type {
  AccountCredentials,
  BalanceRow,
  CancelOrderRequest,
  Candle,
  ExchangeId,
  HistoryPoint,
  OrderRow,
  PlaceOrderRequest,
  TickerRow,
} from '../domain/types'

export class ExchangeError extends Error {
  constructor(
    message: string,
    public readonly code?: string | number,
  ) {
    super(message)
    this.name = 'ExchangeError'
  }
}

export interface IExchange {
  readonly id: ExchangeId
  validateCredentials(creds: AccountCredentials): Promise<void>
  fetchBalances(creds: AccountCredentials): Promise<BalanceRow[]>
  fetchOpenOrders(creds: AccountCredentials, accountId: string, symbol?: string): Promise<OrderRow[]>
  fetchOrderHistory(creds: AccountCredentials, accountId: string, symbol?: string): Promise<OrderRow[]>
  placeOrder(creds: AccountCredentials, req: PlaceOrderRequest): Promise<OrderRow>
  cancelOrder(creds: AccountCredentials, req: CancelOrderRequest): Promise<void>
  fetchTickers(): Promise<TickerRow[]>
  fetchCandles(symbol: string, interval: string, limit?: number): Promise<Candle[]>
  fetchHistory?(creds: AccountCredentials, accountId: string): Promise<Array<HistoryPoint & { id: string }>>
  subscribeTickers(onUpdate: (t: TickerRow) => void): () => void
  subscribeCandles(symbol: string, interval: string, onUpdate: (c: Candle) => void): () => void
}
