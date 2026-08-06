# MyExchanges (mobile PWA)

Offline-first Binance + OKX Spot portfolio app. Install as a PWA or wrap with Capacitor for Android.

## Features

- Multi-account Binance / OKX Spot
- Encrypted vault (fingerprint unlock + recovery PIN)
- Portfolio, orders (open / place / cancel / history), account history, summary
- Live price cards + candle charts with favorites
- Works offline from IndexedDB cache; refresh/trade when online

## Develop

> On this machine `C:\Users\...\source` is a mount of `D:\source`. Prefer running npm from `D:\source\repos\MyBinance\mobile` so Vite/PWA builds resolve paths correctly.

```bash
cd D:\source\repos\MyBinance\mobile
npm install
npm run dev
```

## Test / build

```bash
npm test
npm run build
```

## Capacitor Android

```bash
npm run build
npx cap add android   # first time only
npx cap sync
npx cap open android
```

Private exchange REST calls work best in the Capacitor native HTTP layer (avoids browser CORS).

## Manual smoke checklist

1. Create recovery PIN, unlock, lock, unlock with fingerprint (or PIN)
2. Add Binance and OKX accounts (online validation)
3. Refresh portfolio; turn offline and confirm cached balances still show
4. Live: favorite a coin, switch Cards / Candles
5. Place/cancel disabled offline; works online
