import type { ExchangeId } from '../domain/types'
import { BinanceSpotAdapter } from './binance/BinanceSpotAdapter'
import { OkxSpotAdapter } from './okx/OkxSpotAdapter'
import type { IExchange } from './types'

const adapters: Record<ExchangeId, IExchange> = {
  binance: new BinanceSpotAdapter(),
  okx: new OkxSpotAdapter(),
}

export function getExchange(id: ExchangeId): IExchange {
  return adapters[id]
}

export function allExchanges(): IExchange[] {
  return Object.values(adapters)
}
