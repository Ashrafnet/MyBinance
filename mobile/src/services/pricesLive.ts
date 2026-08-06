import type { Candle, ExchangeId, TickerRow } from '../domain/types'
import { cacheUpsertCandles, cacheUpsertTickers } from '../storage/cache'
import { getExchange } from '../exchanges/registry'

export function startLiveTickers(
  exchange: ExchangeId,
  onUpdate: (t: TickerRow) => void,
): () => void {
  const ex = getExchange(exchange)
  let buffer: TickerRow[] = []
  let flushTimer: number | undefined

  const unsub = ex.subscribeTickers((t) => {
    onUpdate(t)
    buffer.push(t)
    if (flushTimer == null) {
      flushTimer = window.setTimeout(() => {
        const batch = buffer
        buffer = []
        flushTimer = undefined
        void cacheUpsertTickers(batch)
      }, 1500)
    }
  })

  return () => {
    unsub()
    if (flushTimer != null) window.clearTimeout(flushTimer)
  }
}

export function startLiveCandles(
  exchange: ExchangeId,
  symbol: string,
  interval: string,
  onUpdate: (c: Candle) => void,
): () => void {
  const ex = getExchange(exchange)
  const candles: Candle[] = []
  const unsub = ex.subscribeCandles(symbol, interval, (c) => {
    onUpdate(c)
    const idx = candles.findIndex((x) => x.time === c.time)
    if (idx >= 0) candles[idx] = c
    else candles.push(c)
    if (candles.length > 300) candles.splice(0, candles.length - 300)
    void cacheUpsertCandles(symbol, interval, candles)
  })
  return unsub
}
