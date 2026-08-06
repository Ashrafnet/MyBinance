# Mobile PWA Portfolio App — Design Spec

**Date:** 2026-08-06  
**Branch:** `mobile`  
**Status:** Approved for planning (pending user review of this file)

## Goal

Build an offline-first mobile (and desktop browser) Progressive Web App with the same core portfolio/trading helper functionality as the existing WinForms desktop app, plus OKX Spot support, richer order management, live prices (cards + candles), and biometric unlock. No backend owned by us: the app talks directly to exchanges from the device when online.

## Context (existing desktop)

- Stack: .NET 6 WinForms (`MyBinance/`), Binance.Net SDK
- Features today: multi Binance Spot accounts, balances valued in USDT/BTC, live mini-tickers, open orders + cancel, daily snapshot history, light market sell, floating summary window
- Gaps: Binance-only, no exchange abstraction, plaintext `_accounts.json`, place-order UI stubs, no web/PWA code

The WinForms project remains untouched in v1. New work lives under `mobile/`.

## Locked decisions

| Topic | Decision |
|-------|----------|
| Delivery | Installable PWA (phone + desktop browser) **and** Capacitor packaged app from one codebase |
| Stack | React + Vite + TypeScript |
| Connectivity | Offline-first; refresh/sync and live streams when online |
| Backend | None (no server of ours) |
| Exchanges | Binance Spot + OKX Spot |
| Accounts | One or many accounts per exchange |
| Orders | Open orders, cancel, place market/limit buy & sell, order history |
| Markets | Spot only (no futures/margin in v1) |
| Unlock | Biometric (fingerprint / Face ID); local PIN fallback if device has no biometrics |
| Live prices | Cards + candle charts; user favorites |
| Desktop WinForms | Keep as-is for now |

## Architecture

```
PWA / Capacitor UI (React)
        │
        ▼
App services (accounts, portfolio, orders, prices, sync, favorites)
        │
        ├── Vault (encrypted API credentials) ──► secure storage / IndexedDB ciphertext
        ├── Cache store (balances, orders, history, prices, favorites, sync meta) ──► IndexedDB
        └── Exchange adapters (IExchange)
              ├── BinanceSpotAdapter  (REST + WebSocket when online)
              └── OkxSpotAdapter      (REST + WebSocket when online)
```

**Rules**

1. UI always reads from the local cache (usable offline).
2. Refresh/sync, place/cancel, and live streams run only when online; results update the cache.
3. Secrets never leave the device; no plaintext key files.
4. One UI build targets browser PWA and Capacitor.

**Network / CORS**

Exchange private REST APIs generally block browser origins (CORS). Therefore:

- **Capacitor (Android):** private and public HTTP use the native HTTP layer (no browser CORS). This is the primary path for full account/trading features.
- **Browser PWA:** public market data may use browser WebSocket/REST where allowed; authenticated account/order calls use the same app code but are expected to work fully when installed via Capacitor. If a given browser blocks a call, the UI shows a clear error and keeps serving cache — we do not add a backend proxy in v1.
- Signing (API key signatures) always runs on-device in the exchange adapters.

## Screens & features

| Screen | Behavior |
|--------|----------|
| Unlock | Biometric gate (PIN fallback); vault unusable until unlock |
| Accounts | List by exchange; add/edit/delete; alias, exchange, API key/secret, OKX passphrase; validate credentials when online |
| Portfolio | All or one account; balances with USDT/BTC valuation; dust filter + search; shows last-sync when offline |
| Orders | Open orders; cancel; place market/limit buy/sell; order history (filled/cancelled) |
| Live prices | Online: live ticker cards + candle charts. Favorites first; add/remove favorites. Offline: last cached prices/candles |
| Account history | Value-over-time from each exchange's closest Spot snapshot/bills API (Binance daily snapshot; OKX equivalent aggregation - not required to be identical endpoints) |
| Summary | Compact total portfolio + BTC (desktop notify-window equivalent) |
| Settings | Auto-refresh interval, dust threshold, notification prefs, clear cache, encrypted backup export/import |

### Live prices detail

- **Cards view:** live last/change for selected and favorite symbols; favorites persist offline.
- **Candle view:** per-symbol candlesticks with interval picker (at least `1m`, `5m`, `1h`, `1d`); update live when online; cache recent candles for offline display.

### Order management detail

- View open orders (filter by account or all).
- Cancel order(s).
- Place **market** and **limit** buy/sell (quantity and price as required).
- Order history (filled / cancelled), cached for offline reading.

Online-only mutations: refresh, place, cancel. All other screens remain readable offline from cache.

## Local data & security

- **Biometric unlock** (fingerprint / Face ID) gates vault access.
- **Vault key** held in device secure storage where Capacitor allows; browser PWA uses platform authenticator / WebAuthn when available. Ciphertext for API keys and OKX passphrase stored in IndexedDB.
- **PIN fallback** only when the device has no biometrics — still entirely on-device.
- **Cache (non-secret):** balances, open/closed orders, snapshots, last prices, candles, favorites, last-sync timestamps.
- **Backup:** optional user-held encrypted export/import file (vault + optional cache). No cloud sync.
- **Do not** persist plaintext credentials (no `_accounts.json` pattern).

## Sync, exchanges & errors

### Exchange adapter contract (`IExchange`)

Each adapter implements Spot operations needed by the UI:

- Validate credentials
- Fetch balances
- Fetch open orders; cancel order; place market/limit order; fetch order history
- Public tickers / mini-tickers (WS when possible)
- Klines/candles (REST and/or WS)
- Account value history / daily snapshots where the exchange supports an equivalent
- User data stream / order update notifications when supported

Account model: `{ id, alias, exchange: 'binance' | 'okx', credentialsRef }` — credentials live only in the vault.

### Sync

- Manual **Refresh** plus optional auto-refresh interval.
- When online: pull balances, open orders, history, prices; write cache; update last-sync.
- When online on Live screen: subscribe to ticker WS for cards; kline WS or REST polling for candles.
- When offline: serve cache; disable place/cancel/refresh; show clear “Offline — showing last sync” banner.

### Errors

- Per-account error state (invalid key, rate limit, network); other accounts continue.
- User-visible toast + retry; do not wipe cache on transient failures.

## Project layout (target)

```
mobile/
  package.json
  vite.config.ts
  index.html
  public/manifest.webmanifest
  src/
    app/                 # routes, shell, providers
    screens/             # Unlock, Accounts, Portfolio, Orders, Live, History, Summary, Settings
    services/            # sync, valuation, notifications
    exchanges/           # IExchange, binance/, okx/
    storage/             # vault, cache (IndexedDB), favorites
    components/          # price cards, candle chart, lists, banners
  capacitor.config.ts
```

Desktop WinForms remains under `MyBinance/`.

## Delivery

1. Vite SPA with PWA plugin (manifest + service worker) — installable on mobile and desktop browsers.
2. Capacitor wrap of the same build — Android APK in v1; iOS when requested.
3. Distribution is local/static (no backend hosting requirement for app logic). First install still needs a way to load the app once (dev server, static host, or APK sideload); after install, offline-first applies.

## Testing

- Unit tests: exchange adapters (mocked HTTP/WS), portfolio valuation, cache merge/sync helpers.
- Offline/online UI checks: cache-only mode, mutations disabled offline, favorites persist, biometric/PIN unlock paths (mocked where needed).
- Manual smoke: add Binance + OKX accounts, portfolio, place/cancel on small size or testnet if available, live cards + candles, biometric unlock on a physical device.

## Out of scope (v1)

- Futures / margin
- Any server or cloud vault owned by us
- Rewriting or replacing the WinForms desktop app
- iOS App Store release (Capacitor iOS can follow later)

## Success criteria

1. App installs as PWA on phone and desktop browser and as Capacitor Android build.
2. Works offline from cache; refreshes and trades only when online.
3. User can manage multiple Binance and OKX Spot accounts.
4. User can view/cancel/place market & limit orders and see order history.
5. Live prices screen offers cards and candle charts with favorites.
6. Vault unlocks via biometrics (PIN fallback); secrets never stored in plaintext.
