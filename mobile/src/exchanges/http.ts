import { Capacitor, CapacitorHttp } from '@capacitor/core'
import { ExchangeError } from './types'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

export async function httpRequest<T>(opts: {
  url: string
  method?: HttpMethod
  headers?: Record<string, string>
  body?: string
}): Promise<T> {
  const method = opts.method ?? 'GET'
  const headers = { Accept: 'application/json', ...opts.headers }

  try {
    if (Capacitor.isNativePlatform()) {
      const res = await CapacitorHttp.request({
        url: opts.url,
        method,
        headers,
        data: opts.body,
        responseType: 'text',
      })
      if (res.status >= 400) {
        throw new ExchangeError(`HTTP ${res.status}: ${String(res.data)}`, res.status)
      }
      const data = typeof res.data === 'string' ? JSON.parse(res.data || 'null') : res.data
      return data as T
    }

    const res = await fetch(opts.url, {
      method,
      headers: {
        ...headers,
        ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: opts.body,
    })
    const text = await res.text()
    if (!res.ok) {
      let detail = text.slice(0, 240)
      try {
        const parsed = JSON.parse(text) as { msg?: string; message?: string }
        detail = parsed.msg || parsed.message || detail
      } catch {
        /* keep raw */
      }
      throw new ExchangeError(detail || `HTTP ${res.status}`, res.status)
    }
    return (text ? JSON.parse(text) : null) as T
  } catch (e) {
    if (e instanceof ExchangeError) throw e
    const raw = e instanceof Error ? e.message : 'Network error'
    if (/failed to fetch|networkerror|load failed/i.test(raw)) {
      throw new ExchangeError('Could not reach the exchange (network)')
    }
    throw new ExchangeError(raw)
  }
}
