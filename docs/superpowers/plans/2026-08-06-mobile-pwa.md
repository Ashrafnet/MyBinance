# Mobile PWA (Binance + OKX) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an offline-first React PWA + Capacitor Android app with multi-account Binance/OKX Spot portfolio, orders, live price cards/candles, favorites, and biometric unlock — no backend of ours.

**Architecture:** Vite React TypeScript SPA under `mobile/`. UI reads IndexedDB cache; sync/trading/live streams when online via `IExchange` adapters. Vault encrypts API credentials; Capacitor native HTTP for private REST (CORS). Same build wraps with Capacitor.

**Tech Stack:** React 18, Vite 5, TypeScript, React Router, Vite PWA plugin, idb, lightweight-charts, vitest, Capacitor 6 (+ Preferences, Preferences/Secure Storage pattern, Native Biometric, Capacitor HTTP).

## Global Constraints

- Branch: `mobile` only (never commit to `main` without explicit ask)
- No backend / no proxy owned by us
- Spot only (Binance + OKX)
- Offline-first: mutations (refresh/place/cancel) online-only
- Biometric unlock with local PIN fallback
- Secrets encrypted at rest; never plaintext `_accounts.json`
- WinForms `MyBinance/` untouched
- Spec: `docs/superpowers/specs/2026-08-06-mobile-pwa-design.md`

## File map

```
mobile/
  package.json
  vite.config.ts
  tsconfig.json
  index.html
  public/manifest.webmanifest
  public/icons/...
  capacitor.config.ts
  src/
    main.tsx
    App.tsx
    styles/global.css
    app/routes.tsx
    app/OnlineContext.tsx
    app/AuthContext.tsx
    domain/types.ts
    storage/db.ts
    storage/cache.ts
    storage/vault.ts
    storage/favorites.ts
    crypto/vaultCrypto.ts
    auth/biometrics.ts
    exchanges/types.ts
    exchanges/http.ts
    exchanges/registry.ts
    exchanges/binance/BinanceSpotAdapter.ts
    exchanges/binance/sign.ts
    exchanges/okx/OkxSpotAdapter.ts
    exchanges/okx/sign.ts
    services/sync.ts
    services/valuation.ts
    services/pricesLive.ts
    screens/*.tsx
    components/*.tsx
  src/**/*.test.ts
```

---

### Task 1: Scaffold Vite React PWA + Vitest

**Files:**
- Create: `mobile/package.json`, `mobile/vite.config.ts`, `mobile/tsconfig.json`, `mobile/tsconfig.node.json`, `mobile/index.html`, `mobile/src/main.tsx`, `mobile/src/App.tsx`, `mobile/src/styles/global.css`, `mobile/public/manifest.webmanifest`, `mobile/vitest.config.ts`, `mobile/src/domain/types.ts`

**Interfaces:**
- Produces: npm scripts `dev`, `build`, `preview`, `test`; base domain types in `domain/types.ts`

- [ ] **Step 1: Scaffold project**

Create `mobile/` with Vite React-TS. Dependencies:

```bash
cd mobile
npm create vite@5 . -- --template react-ts
npm install
npm install react-router-dom idb lightweight-charts
npm install -D vitest @vitest/coverage-v8 jsdom @testing-library/react @testing-library/jest-dom vite-plugin-pwa workbox-window
```

- [ ] **Step 2: Configure Vite PWA + Vitest**

`vite.config.ts` must register `VitePWA` with `registerType: 'autoUpdate'`, include manifest name `MyExchanges`, `display: standalone`, theme color `#0b1220`. Vitest environment `jsdom`.

- [ ] **Step 3: Domain types**

```ts
// src/domain/types.ts
export type ExchangeId = 'binance' | 'okx';
export type OrderSide = 'buy' | 'sell';
export type OrderType = 'market' | 'limit';
export type OrderStatus = 'open' | 'filled' | 'canceled' | 'rejected' | 'partial';

export interface AccountMeta {
  id: string;
  alias: string;
  exchange: ExchangeId;
  createdAt: number;
}

export interface AccountCredentials {
  apiKey: string;
  secretKey: string;
  passphrase?: string; // OKX required
}

export interface BalanceRow {
  asset: string;
  free: number;
  locked: number;
  total: number;
  usdtValue: number;
  btcValue: number;
}

export interface OrderRow {
  id: string;
  accountId: string;
  exchange: ExchangeId;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  price: number | null;
  quantity: number;
  filledQuantity: number;
  status: OrderStatus;
  createdAt: number;
  updatedAt: number;
}

export interface TickerRow {
  symbol: string;
  last: number;
  changePct24h: number;
  quoteVolume?: number;
  updatedAt: number;
}

export interface Candle {
  time: number; // unix sec
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface SyncMeta {
  accountId: string;
  lastSyncAt: number | null;
  lastError: string | null;
}
```

- [ ] **Step 4: Smoke App shell**

`App.tsx` renders a simple shell title `MyExchanges` and route outlet placeholder. `npm run build` and `npm test` (empty suite OK) succeed.

- [ ] **Step 5: Commit**

```bash
git add mobile
git commit -m "feat(mobile): scaffold Vite React PWA with domain types"
```

---

### Task 2: IndexedDB cache + favorites

**Files:**
- Create: `mobile/src/storage/db.ts`, `mobile/src/storage/cache.ts`, `mobile/src/storage/favorites.ts`, `mobile/src/storage/cache.test.ts`

**Interfaces:**
- Produces: `getDb()`, `cacheUpsertBalances`, `cacheGetBalances`, `cacheUpsertOrders`, `cacheGetOpenOrders`, `cacheGetOrderHistory`, `cacheUpsertTickers`, `cacheGetTickers`, `cacheUpsertCandles`, `cacheGetCandles`, `cacheSetSyncMeta`, `cacheGetSyncMeta`, `getFavorites`, `setFavorites`, `toggleFavorite`

- [ ] **Step 1: Write failing tests for cache helpers**

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { getDb } from './db';
import { cacheUpsertBalances, cacheGetBalances, cacheSetSyncMeta, cacheGetSyncMeta } from './cache';
import { getFavorites, toggleFavorite } from './favorites';

beforeEach(async () => {
  const db = await getDb();
  await Promise.all([...(db.objectStoreNames as unknown as string[])].map(async () => {}));
  // clear stores via db clear helpers exported for tests
  await import('./cache').then(m => m.cacheClearAll());
});

it('stores balances by account', async () => {
  await cacheUpsertBalances('acc1', [{ asset: 'BTC', free: 1, locked: 0, total: 1, usdtValue: 50000, btcValue: 1 }]);
  const rows = await cacheGetBalances('acc1');
  expect(rows).toHaveLength(1);
  expect(rows[0].asset).toBe('BTC');
});

it('tracks sync meta and favorites', async () => {
  await cacheSetSyncMeta({ accountId: 'acc1', lastSyncAt: 123, lastError: null });
  expect((await cacheGetSyncMeta('acc1'))?.lastSyncAt).toBe(123);
  expect(await toggleFavorite('BTCUSDT')).toEqual(['BTCUSDT']);
  expect(await getFavorites()).toEqual(['BTCUSDT']);
});
```

- [ ] **Step 2: Implement idb schema**

Stores: `balances`, `orders`, `tickers`, `candles`, `syncMeta`, `favorites`, `accountsMeta` (non-secret account list). Key paths documented in `db.ts`.

- [ ] **Step 3: Pass tests + commit**

```bash
cd mobile && npm test
git add mobile/src/storage
git commit -m "feat(mobile): IndexedDB cache and favorites"
```

---

### Task 3: Vault crypto + biometric/PIN unlock

**Files:**
- Create: `mobile/src/crypto/vaultCrypto.ts`, `mobile/src/auth/biometrics.ts`, `mobile/src/storage/vault.ts`, `mobile/src/app/AuthContext.tsx`, `mobile/src/crypto/vaultCrypto.test.ts`

**Interfaces:**
- Produces: `generateVaultKey()`, `encryptJson(key, data)`, `decryptJson(key, blob)`, `VaultService.lock/unlock/saveCredentials/getCredentials`, `AuthContext` with `unlocked`, `unlockWithBiometric()`, `unlockWithPin()`, `setupPin(pin)`, `lock()`

- [ ] **Step 1: Failing tests for AES-GCM encrypt/decrypt roundtrip**

```ts
import { describe, expect, it } from 'vitest';
import { generateVaultKey, encryptJson, decryptJson } from './vaultCrypto';

it('roundtrips credentials', async () => {
  const key = await generateVaultKey();
  const blob = await encryptJson(key, { apiKey: 'a', secretKey: 'b', passphrase: 'c' });
  const out = await decryptJson<{ apiKey: string }>(key, blob);
  expect(out.apiKey).toBe('a');
});
```

- [ ] **Step 2: Implement WebCrypto AES-GCM + vault storage**

- Vault ciphertext in IndexedDB store `vault`
- In-memory unlocked `CryptoKey` only after biometric/PIN
- PIN: PBKDF2-derived key wrapping the vault key; salt+iters stored with vault
- Biometric: Capacitor Native Biometric when available; WebAuthn platform authenticator in browser when available; else PIN required

- [ ] **Step 3: AuthContext wiring + commit**

```bash
git commit -m "feat(mobile): encrypted vault with biometric/PIN unlock"
```

---

### Task 4: HTTP layer + IExchange + Binance Spot adapter

**Files:**
- Create: `mobile/src/exchanges/types.ts`, `mobile/src/exchanges/http.ts`, `mobile/src/exchanges/binance/sign.ts`, `mobile/src/exchanges/binance/BinanceSpotAdapter.ts`, `mobile/src/exchanges/binance/sign.test.ts`, `mobile/src/exchanges/registry.ts`

**Interfaces:**
- Produces:

```ts
export interface IExchange {
  readonly id: ExchangeId;
  validateCredentials(creds: AccountCredentials): Promise<void>;
  fetchBalances(creds: AccountCredentials): Promise<BalanceRow[]>;
  fetchOpenOrders(creds: AccountCredentials, symbol?: string): Promise<OrderRow[]>;
  fetchOrderHistory(creds: AccountCredentials, symbol?: string): Promise<OrderRow[]>;
  placeOrder(creds: AccountCredentials, req: PlaceOrderRequest): Promise<OrderRow>;
  cancelOrder(creds: AccountCredentials, req: CancelOrderRequest): Promise<void>;
  fetchTickers(): Promise<TickerRow[]>;
  fetchCandles(symbol: string, interval: string, limit?: number): Promise<Candle[]>;
  subscribeTickers(onUpdate: (t: TickerRow) => void): () => void;
  subscribeCandles(symbol: string, interval: string, onUpdate: (c: Candle) => void): () => void;
}
```

- [ ] **Step 1: HMAC sign unit tests for Binance query string**

```ts
it('signs totalParams with hmac sha256', async () => {
  const sig = await signBinanceQuery('symbol=BTCUSDT&timestamp=1', 'secret');
  expect(sig).toMatch(/^[a-f0-9]{64}$/);
});
```

- [ ] **Step 2: Implement `httpRequest`**

Prefer `@capacitor/core` + `@capacitor-community/http` when Capacitor native; fallback `fetch` in browser. Always attach timeouts and JSON parse errors as typed `ExchangeError`.

- [ ] **Step 3: Implement BinanceSpotAdapter** against public REST (`api.binance.com`) and WS (`stream.binance.com`). Map to domain types. Valuation fields may be 0 until Task 6 fills prices.

- [ ] **Step 4: Tests pass + commit**

```bash
git commit -m "feat(mobile): Binance Spot exchange adapter"
```

---

### Task 5: OKX Spot adapter

**Files:**
- Create: `mobile/src/exchanges/okx/sign.ts`, `mobile/src/exchanges/okx/OkxSpotAdapter.ts`, `mobile/src/exchanges/okx/sign.test.ts`
- Modify: `mobile/src/exchanges/registry.ts`

**Interfaces:**
- Consumes: `IExchange`, `httpRequest`
- Produces: `OkxSpotAdapter` registered as `okx`

- [ ] **Step 1: OKX sign tests** (timestamp + method + path + body → Base64 HMAC)

- [ ] **Step 2: Implement adapter** for Spot balances, orders, candles, tickers (REST + public WS). Passphrase header required.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(mobile): OKX Spot exchange adapter"
```

---

### Task 6: Valuation + sync service

**Files:**
- Create: `mobile/src/services/valuation.ts`, `mobile/src/services/sync.ts`, `mobile/src/services/valuation.test.ts`, `mobile/src/services/pricesLive.ts`

**Interfaces:**
- Produces: `valueBalances(balances, tickers) => BalanceRow[]`, `syncAccount(accountId)`, `syncAll()`, `startLiveTickers(symbols, cb)`, `startLiveCandles(exchange, symbol, interval, cb)`

- [ ] **Step 1: Valuation tests** (USDT direct, BTC via BTCUSDT, dust assets)

- [ ] **Step 2: syncAccount loads creds from vault, calls adapter, writes cache + syncMeta, isolates per-account errors

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(mobile): portfolio valuation and sync service"
```

---

### Task 7: App shell, routing, online banner, unlock screen

**Files:**
- Create: `mobile/src/app/routes.tsx`, `mobile/src/app/OnlineContext.tsx`, `mobile/src/screens/UnlockScreen.tsx`, `mobile/src/screens/ShellLayout.tsx`, `mobile/src/components/OfflineBanner.tsx`
- Modify: `mobile/src/App.tsx`, `mobile/src/styles/global.css`

- [ ] **Step 1: OnlineContext** from `navigator.onLine` + `online`/`offline` events
- [ ] **Step 2: Routes** — `/unlock`, `/` portfolio, `/accounts`, `/orders`, `/live`, `/history`, `/summary`, `/settings` guarded by AuthContext
- [ ] **Step 3: UnlockScreen** biometric button + PIN setup/entry
- [ ] **Step 4: Commit**

```bash
git commit -m "feat(mobile): shell, routing, unlock, offline banner"
```

---

### Task 8: Accounts screen

**Files:**
- Create: `mobile/src/screens/AccountsScreen.tsx`, `mobile/src/components/AccountForm.tsx`

- [ ] **Step 1: List/add/edit/delete accounts** — persist `AccountMeta` in cache; credentials in vault only
- [ ] **Step 2: Online validate** via adapter before save; offline save marked `lastError: 'Not validated (offline)'`
- [ ] **Step 3: Commit**

```bash
git commit -m "feat(mobile): multi-account management for Binance and OKX"
```

---

### Task 9: Portfolio + Summary + History screens

**Files:**
- Create: `mobile/src/screens/PortfolioScreen.tsx`, `mobile/src/screens/SummaryScreen.tsx`, `mobile/src/screens/HistoryScreen.tsx`, `mobile/src/components/BalanceTable.tsx`

- [ ] **Step 1: Portfolio** from cache; account filter; dust threshold from settings; search; Refresh calls `syncAll` when online
- [ ] **Step 2: Summary** total USDT + BTC
- [ ] **Step 3: History** cached snapshots / best-effort sync when online
- [ ] **Step 4: Commit**

```bash
git commit -m "feat(mobile): portfolio, summary, and history screens"
```

---

### Task 10: Orders screen (open, place, cancel, history)

**Files:**
- Create: `mobile/src/screens/OrdersScreen.tsx`, `mobile/src/components/PlaceOrderForm.tsx`

- [ ] **Step 1: Open orders + history tabs** from cache; account filter
- [ ] **Step 2: Place market/limit** form disabled offline; on success update cache + optional sync
- [ ] **Step 3: Cancel** with confirm; online-only
- [ ] **Step 4: Commit**

```bash
git commit -m "feat(mobile): order view, place, cancel, and history"
```

---

### Task 11: Live prices (cards + candles + favorites)

**Files:**
- Create: `mobile/src/screens/LiveScreen.tsx`, `mobile/src/components/PriceCard.tsx`, `mobile/src/components/CandleChart.tsx`

- [ ] **Step 1: Cards grid** favorites first; toggle favorite; live updates via `startLiveTickers` when online else cache
- [ ] **Step 2: Candle chart** using `lightweight-charts`; intervals `1m|5m|1h|1d`; subscribe when online
- [ ] **Step 3: Commit**

```bash
git commit -m "feat(mobile): live price cards, candles, and favorites"
```

---

### Task 12: Settings + Capacitor Android wrap

**Files:**
- Create: `mobile/src/screens/SettingsScreen.tsx`, `mobile/capacitor.config.ts`
- Modify: `mobile/package.json`

- [ ] **Step 1: Settings** — auto-refresh seconds, dust USDT threshold, clear cache, encrypted backup export/import (download/upload JSON blob)
- [ ] **Step 2: Add Capacitor**

```bash
cd mobile
npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/preferences @capacitor-community/http @capgo/capacitor-native-biometric
npx cap init MyExchanges com.myexchanges.app --web-dir dist
npm run build
npx cap add android
npx cap sync
```

- [ ] **Step 3: README** in `mobile/README.md` with `npm run dev`, build, `npx cap open android`
- [ ] **Step 4: Commit**

```bash
git commit -m "feat(mobile): settings, PWA assets, Capacitor Android project"
```

---

### Task 13: End-to-end verification

- [ ] **Step 1:** `cd mobile && npm test` — all unit tests pass
- [ ] **Step 2:** `npm run build` — production build succeeds
- [ ] **Step 3:** Manual checklist documented in `mobile/README.md` (accounts, offline banner, live cards/candles, orders disabled offline)
- [ ] **Step 4: Final commit** if docs tweaked

```bash
git commit -m "docs(mobile): usage and verification notes"
```

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| Offline-first cache UI | 2, 6, 7 |
| No backend | Global + 4 HTTP note |
| Binance + OKX Spot | 4, 5 |
| Multi-account | 8 |
| Orders open/cancel/place/history | 10 |
| Live cards + candles + favorites | 11 |
| Biometric + PIN | 3 |
| Portfolio / history / summary | 9 |
| PWA + Capacitor | 1, 12 |
| Encrypted vault / backup | 3, 12 |
| WinForms untouched | Global |
