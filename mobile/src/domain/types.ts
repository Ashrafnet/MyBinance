export type ExchangeId = 'binance' | 'okx'
export type OrderSide = 'buy' | 'sell'
export type OrderType = 'market' | 'limit'
export type OrderStatus = 'open' | 'filled' | 'canceled' | 'rejected' | 'partial'

export interface AccountMeta {
  id: string
  alias: string
  exchange: ExchangeId
  createdAt: number
}

export interface AccountCredentials {
  apiKey: string
  secretKey: string
  passphrase?: string
}

export interface BalanceRow {
  asset: string
  free: number
  locked: number
  total: number
  usdtValue: number
  btcValue: number
}

export interface OrderRow {
  id: string
  accountId: string
  exchange: ExchangeId
  symbol: string
  side: OrderSide
  type: OrderType
  price: number | null
  quantity: number
  filledQuantity: number
  status: OrderStatus
  createdAt: number
  updatedAt: number
}

export interface TickerRow {
  symbol: string
  last: number
  changePct24h: number
  quoteVolume?: number
  updatedAt: number
}

export interface Candle {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface SyncMeta {
  accountId: string
  lastSyncAt: number | null
  lastError: string | null
}

export interface PlaceOrderRequest {
  accountId: string
  symbol: string
  side: OrderSide
  type: OrderType
  quantity: number
  price?: number
}

export interface CancelOrderRequest {
  accountId: string
  symbol: string
  orderId: string
}

export interface AppSettings {
  autoRefreshSeconds: number
  dustUsdt: number
}

export const DEFAULT_SETTINGS: AppSettings = {
  autoRefreshSeconds: 100,
  dustUsdt: 3,
}

export interface HistoryPoint {
  accountId: string
  date: string
  usdtValue: number
}
