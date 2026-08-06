import { useEffect, useState } from 'react'

const QUOTE_SUFFIXES = [
  'USDT',
  'USDC',
  'BUSD',
  'FDUSD',
  'TUSD',
  'BTC',
  'ETH',
  'BNB',
  'EUR',
  'TRY',
  'DAI',
  'USD',
] as const

export function baseAsset(symbolOrAsset: string): string {
  const s = symbolOrAsset.trim().toUpperCase()
  for (const q of QUOTE_SUFFIXES) {
    if (s.length > q.length && s.endsWith(q)) return s.slice(0, -q.length)
  }
  return s
}

function iconUrls(asset: string): string[] {
  const a = baseAsset(asset)
  const lower = a.toLowerCase()
  return [
    `https://bin.bnbstatic.com/static/assets/logos/${a}.png`,
    `https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/svg/color/${lower}.svg`,
  ]
}

export function AssetIcon({ asset, className = '' }: { asset: string; className?: string }) {
  const symbol = baseAsset(asset)
  const urls = iconUrls(symbol)
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    setIdx(0)
  }, [symbol])

  const letter = symbol.slice(0, 1) || '?'

  if (idx >= urls.length) {
    return <div className={`asset-avatar ${className}`.trim()}>{letter}</div>
  }

  return (
    <div className={`asset-avatar has-icon ${className}`.trim()}>
      <img
        src={urls[idx]}
        alt=""
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setIdx((i) => i + 1)}
      />
    </div>
  )
}
