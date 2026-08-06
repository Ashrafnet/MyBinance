import { Capacitor } from '@capacitor/core'
import type { ExchangeId } from '../domain/types'

/**
 * Browser pages cannot call exchange private REST directly (CORS).
 * Use same-origin Vite/proxy paths in the browser; full URLs on native Capacitor.
 */
export function restBase(exchange: ExchangeId): string {
  if (Capacitor.isNativePlatform()) {
    return exchange === 'binance' ? 'https://api.binance.com' : 'https://www.okx.com'
  }
  return exchange === 'binance' ? '/proxy/binance' : '/proxy/okx'
}

export function wsPublic(exchange: ExchangeId): string {
  return exchange === 'binance'
    ? 'wss://stream.binance.com:9443/ws'
    : 'wss://ws.okx.com:8443/ws/v5/public'
}

/** Authenticated account/order streams (not proxied — browser connects directly). */
export function wsPrivate(exchange: ExchangeId): string {
  return exchange === 'binance'
    ? 'wss://stream.binance.com:9443/ws'
    : 'wss://ws.okx.com:8443/ws/v5/private'
}
