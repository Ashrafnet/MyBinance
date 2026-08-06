import { getDb } from './db'

export async function getFavorites(): Promise<string[]> {
  const db = await getDb()
  const row = await db.get('favorites', 'favorites')
  return row?.symbols ?? []
}

export async function setFavorites(symbols: string[]) {
  const db = await getDb()
  await db.put('favorites', { id: 'favorites', symbols: [...new Set(symbols)] })
}

export async function toggleFavorite(symbol: string): Promise<string[]> {
  const current = await getFavorites()
  const next = current.includes(symbol)
    ? current.filter((s) => s !== symbol)
    : [...current, symbol]
  await setFavorites(next)
  return next
}
