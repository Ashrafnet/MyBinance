import { useEffect, useMemo, useState } from 'react'

/** Longest-first so USDT wins over USD, FDUSD over USD, etc. */
const QUOTE_SUFFIXES = [
  'FDUSD',
  'USDT',
  'USDC',
  'BUSD',
  'TUSD',
  'BTC',
  'ETH',
  'BNB',
  'EUR',
  'TRY',
  'BRL',
  'DAI',
  'USD',
  // Binance.id quote (IDR). Only applied when base length >= 3 (avoids GRID->GR).
  'ID',
] as const

/** Remember which CDN URL worked (or that all failed) across remounts. */
const resolvedUrl = new Map<string, string | null>()

export function baseAsset(symbolOrAsset: string): string {
  const s = symbolOrAsset.trim().toUpperCase()
  for (const q of QUOTE_SUFFIXES) {
    if (s.length <= q.length || !s.endsWith(q)) continue
    const base = s.slice(0, -q.length)
    // Avoid BUSD→B (via USD) and GRID→GR (via ID). Real pairs have base length ≥ 2 / ≥ 3 for ID.
    if (q === 'ID' ? base.length < 3 : base.length < 2) continue
    return base
  }
  return s
}

function iconUrls(asset: string): string[] {
  const a = baseAsset(asset)
  const lower = a.toLowerCase()
  return [
    `https://bin.bnbstatic.com/static/assets/logos/${a}.png`,
    `https://cdn.jsdelivr.net/gh/prasangapokharel/crypto-icons@v1.0.0/binance/${a}.png`,
    `https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/svg/color/${lower}.svg`,
  ]
}

function initialIndex(symbol: string, urls: string[]): number {
  const cached = resolvedUrl.get(symbol)
  if (cached === null) return urls.length
  if (cached) {
    const at = urls.indexOf(cached)
    return at >= 0 ? at : 0
  }
  return 0
}

export function AssetIcon({ asset, className = '' }: { asset: string; className?: string }) {
  const symbol = baseAsset(asset)
  const urls = useMemo(() => iconUrls(symbol), [symbol])
  const [idx, setIdx] = useState(() => initialIndex(symbol, urls))

  useEffect(() => {
    setIdx(initialIndex(symbol, urls))
  }, [symbol, urls])

  const letter = symbol.slice(0, 1) || '?'
  const src = idx < urls.length ? urls[idx] : null

  if (!src) {
    return <div className={`asset-avatar ${className}`.trim()}>{letter}</div>
  }

  return (
    <div className={`asset-avatar has-icon ${className}`.trim()}>
      <img
        key={src}
        src={src}
        alt=""
        loading="eager"
        decoding="async"
        referrerPolicy="no-referrer"
        onLoad={() => {
          resolvedUrl.set(symbol, src)
        }}
        onError={() => {
          setIdx((i) => {
            const next = i + 1
            if (next >= urls.length) resolvedUrl.set(symbol, null)
            return next
          })
        }}
      />
    </div>
  )
}
