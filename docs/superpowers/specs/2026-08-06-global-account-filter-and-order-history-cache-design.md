# Global Account Filter + Order History Cache — Design Spec

**Date:** 2026-08-06  
**Branch:** `mobile`  
**Status:** Approved — implementing

## Goal

1. Put a shared account filter in the app topbar (only account control).
2. Make Trade → History cache-first for Binance and OKX, with silent background refresh and no UI flicker/shake.

## Decisions (locked)

| Topic | Decision |
|-------|----------|
| Account control placement | Global topbar under MyExchanges brand |
| Duplicate account dropdowns | Remove from Home, Trade, value-History; topbar only |
| Shared state | React context + persist (Preferences / localStorage) |
| Default filter | `all` (“All accounts” / Combined Spot) |
| Non-account selects | Keep (sort, order type, Markets exchange, chart TF) |
| Order history read | Always paint from IndexedDB first when available |
| Order history write | Silent online refresh; merge/upsert; never wipe on empty/fail |
| UI update | Apply new list only when data fingerprint changes; preserve expand state |

## Architecture

```
ShellLayout topbar
  └── AppSelect (account filter)
        │
        ▼
AccountFilterContext  (value: 'all' | accountId)
  ├── persist read/write
  └── consumers: Portfolio, Orders, History, Summary, sync helpers

OrdersScreen History tab
  ├── load cache → setState (immediate)
  └── if online: syncOrderHistory(account) in background
        ├── fetch Binance / OKX history
        ├── merge into IndexedDB (upsert by order id)
        └── if fingerprint ≠ UI → setState (no empty flash)
```

## 1. Global account filter

### UI

- In `ShellLayout` sticky topbar, below brand + Live/Offline status (or in the same topbar row if space allows on phone: brand left, compact select center/grow, lock right).
- Prefer a second topbar row on narrow widths so the select stays full-width and readable (same `AppSelect` wallet chip as today’s Home control).
- Options: `{ value: 'all', label: 'All accounts', hint: 'Combined Spot' }` plus each `AccountMeta` with exchange hint.
- Hide the filter only when there are zero accounts (optional empty hint) or on Unlock (outside shell).

### State

- `AccountFilterProvider` wraps authenticated shell routes.
- API: `{ accountId: string /* 'all' | id */, setAccountId, accounts }`.
- Persist key e.g. `accountFilterId`; validate on load (if saved id missing, fall back to `all`).
- Deep link from Wallet → Home (`location.state.accountId`) calls `setAccountId` once, then clears/ignores repeat.

### Screen behavior

| Screen | When `all` | When specific account |
|--------|------------|------------------------|
| Home (Portfolio) | Combined balances (current behavior) | That account only |
| Trade Open/History | Combined list for all accounts (sorted by updatedAt) | That account only |
| Trade Place | Resolve **trading account**: first account if `all`, else selected; show small caption “Placing on {alias}” — no second dropdown |
| Cancel | Uses the order’s own `accountId` (unchanged) |
| Value History (`/history`) | Combined day cards | That account |
| Summary | Combined or single (match filter) |
| Markets | Unchanged (exchange select stays local) |
| Wallet / Settings / More | Filter visible but does not change those UIs |

### Removals

- Remove account `AppSelect` from `PortfolioScreen`, `OrdersScreen`, `HistoryScreen`.
- Do not remove other `AppSelect` usages.

## 2. Order history cache + smooth refresh

### Problems today

- `syncAccount` uses `cacheReplaceAccountOrders` with `history = []` on fetch failure → wipes cache.
- History tab triggers full account sync and can show empty “Loading…” instead of stale cache.
- Binance history limited to currently held assets; OKX last ~50 — acceptable for v1 merge, but must not delete prior cached rows outside the fetch window.

### Sync rules

1. **Open orders:** replace open/partial for that account with the fresh open set (canceled/filled leave open set).
2. **History:** `cacheUpsertOrders(historyRows)` merge by `OrderRow.id`. Never delete historical rows because a fetch returned fewer symbols or failed.
3. **Failed history fetch:** leave existing history untouched; still update open/balances if those succeeded.
4. Extract `syncOrderHistory(accountId)` (or a flag on sync) so History tab can refresh orders without waiting on optional daily snapshots when desired; full `syncAccount` may still call the same merge helpers.

### UI rules (Trade → History)

1. On mount / account filter change: `cacheGetOrderHistory(resolvedIds)` → set list immediately.
2. If online: background refresh; optional subtle “Updating…” text — never clear the list to an empty loading card while cache has rows.
3. Fingerprint before `setHistory`: e.g. sorted `id|status|filledQuantity|updatedAt` join. Equal → no state update.
4. Keep `expandedId` if that id still exists after update.
5. Offline + empty cache: keep current empty copy. Offline + cache: show cache, no error implying “must go online” unless cache empty.
6. Apply the same cache-first pattern to Open tab for consistency (show cache, silent refresh).

### Exchanges

- **Binance:** keep multi-symbol `allOrders` approach; merge results into cache (do not drop symbols not in this run).
- **OKX:** keep `orders-history` Spot limit fetch; merge into cache.
- Broader pagination / archive endpoints are out of scope for this change unless needed for correctness of merge.

## Error handling

- Network/API errors on background refresh: toast optional/throttled; never blank the list.
- Missing credentials: toast; keep cache.
- Invalid persisted account id: reset to `all`.

## Testing

- Unit: merge helpers do not delete prior history when new fetch is empty/partial.
- Unit: fingerprint equality skips update.
- Manual: offline reopen shows last history; online reopen shows cache then quiet update; switch topbar account filters lists without layout jump; Place with `all` uses caption account.

## Out of scope

- Global filter driving Markets exchange (separate control).
- Infinite scroll / full Binance all-symbols history crawl.
- Changing WinForms desktop app.

## Success criteria

1. Account filter appears in topbar; no per-screen account dropdowns on Home/Trade/value-History.
2. Selection persists across restarts and applies on every consumer screen.
3. Trade → History always shows cached rows when present, works offline, refreshes silently online for Binance and OKX.
4. Background updates do not flash empty state or visibly “shake” the list when data is unchanged.
