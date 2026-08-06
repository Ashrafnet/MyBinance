# Global Account Filter + Order History Cache Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Status:** Implemented in-session (2026-08-06). Tests + build green.

**Goal:** Shared topbar account filter (persisted context) plus cache-first Trade order history with silent merge refresh for Binance and OKX.

**Architecture:** `AccountFilterProvider` wraps authenticated shell routes; topbar owns the only account `AppSelect`. Order sync splits open-order replace from history upsert-merge; OrdersScreen paints IndexedDB first and applies network results only when a list fingerprint changes.

**Tech Stack:** React 18, React Router 7, TypeScript, IndexedDB via existing `cache.ts` / `idb`, Vitest, Vite PWA under `mobile/`.

## Global Constraints

- Work only under `mobile/` (WinForms untouched).
- Prefer `D:\source\repos\MyBinance\mobile` for npm/Vite.
- Offline-first: UI reads cache; network updates cache then UI.
- Never wipe order history on empty/failed history fetch.
- No second account dropdown on Home / Trade / value-History.
- Do not commit unless the user explicitly asks.
- Spec: `docs/superpowers/specs/2026-08-06-global-account-filter-and-order-history-cache-design.md`

---

## File map

| File | Responsibility |
|------|----------------|
| `mobile/src/app/AccountFilterContext.tsx` | Persist + expose `accountId` (`'all' \| id`), `setAccountId`, `accounts`, `tradingAccountId` |
| `mobile/src/utils/orderListFingerprint.ts` | Stable fingerprint string for order lists |
| `mobile/src/storage/cache.ts` | Add `cacheMergeAccountOrders(accountId, open, history)` |
| `mobile/src/services/sync.ts` | Use merge helper; keep history on fetch failure |
| `mobile/src/screens/ShellLayout.tsx` | Topbar account select |
| `mobile/src/app/routes.tsx` or `App.tsx` | Mount `AccountFilterProvider` inside auth |
| `mobile/src/screens/PortfolioScreen.tsx` | Consume context; remove account select |
| `mobile/src/screens/OrdersScreen.tsx` | Consume context; cache-first history/open; remove account select |
| `mobile/src/screens/HistoryScreen.tsx` | Consume context; remove account select |
| `mobile/src/screens/SummaryScreen.tsx` | Filter totals by context account |
| `mobile/src/screens/AccountsScreen.tsx` | Deep-link sets context account |
| `mobile/src/styles/global.css` | Topbar account row styles |
| `mobile/src/storage/cache.test.ts` | Merge does not wipe history |
| `mobile/src/utils/orderListFingerprint.test.ts` | Fingerprint equality |

---

### Task 1: Order list fingerprint + cache merge

**Files:**
- Create: `mobile/src/utils/orderListFingerprint.ts`
- Create: `mobile/src/utils/orderListFingerprint.test.ts`
- Modify: `mobile/src/storage/cache.ts`
- Modify: `mobile/src/storage/cache.test.ts`

**Interfaces:**
- Produces: `orderListFingerprint(orders: OrderRow[]): string`
- Produces: `cacheMergeAccountOrders(accountId: string, open: OrderRow[], history: OrderRow[] | null): Promise<void>`
  - `history === null` means history fetch failed → do not touch non-open rows
  - `history` array (even empty) → upsert those rows; delete open/partial for account not in `open`; keep other historical ids not in this fetch

- [ ] **Step 1: Write failing fingerprint tests**

```ts
import { describe, expect, it } from 'vitest'
import { orderListFingerprint } from './orderListFingerprint'
import type { OrderRow } from '../domain/types'

const base: OrderRow = {
  id: 'binance:a:1',
  accountId: 'a',
  exchange: 'binance',
  symbol: 'BTCUSDT',
  side: 'buy',
  type: 'limit',
  price: 1,
  quantity: 1,
  filledQuantity: 1,
  status: 'filled',
  createdAt: 1,
  updatedAt: 2,
}

describe('orderListFingerprint', () => {
  it('is order-independent for same rows', () => {
    const a = orderListFingerprint([base, { ...base, id: 'x', updatedAt: 3 }])
    const b = orderListFingerprint([{ ...base, id: 'x', updatedAt: 3 }, base])
    expect(a).toBe(b)
  })
  it('changes when filledQuantity changes', () => {
    expect(orderListFingerprint([base])).not.toBe(
      orderListFingerprint([{ ...base, filledQuantity: 0.5 }]),
    )
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npm test -- src/utils/orderListFingerprint.test.ts`  
Expected: FAIL module not found

- [ ] **Step 3: Implement fingerprint**

```ts
import type { OrderRow } from '../domain/types'

export function orderListFingerprint(orders: OrderRow[]): string {
  return orders
    .map((o) => `${o.id}|${o.status}|${o.filledQuantity}|${o.updatedAt}`)
    .sort()
    .join(';')
}
```

- [ ] **Step 4: Write failing merge test**

```ts
it('keeps prior history when history merge is null (fetch failed)', async () => {
  const hist = {
    id: 'binance:acc1:99',
    accountId: 'acc1',
    exchange: 'binance' as const,
    symbol: 'ETHUSDT',
    side: 'buy' as const,
    type: 'limit' as const,
    price: 1,
    quantity: 1,
    filledQuantity: 1,
    status: 'filled' as const,
    createdAt: 1,
    updatedAt: 2,
  }
  await cacheUpsertOrders([hist])
  await cacheMergeAccountOrders('acc1', [], null)
  const rows = await cacheGetOrderHistory('acc1')
  expect(rows.map((r) => r.id)).toContain('binance:acc1:99')
})

it('upserts history without dropping other historical ids', async () => {
  const old = { /* ... id old ... status filled */ }
  const neu = { /* ... id neu ... status filled */ }
  await cacheUpsertOrders([old])
  await cacheMergeAccountOrders('acc1', [], [neu])
  const ids = (await cacheGetOrderHistory('acc1')).map((r) => r.id).sort()
  expect(ids).toEqual(['binance:acc1:neu', 'binance:acc1:old'].sort())
})
```

(Use full `OrderRow` objects matching `domain/types`.)

- [ ] **Step 5: Implement `cacheMergeAccountOrders`**

```ts
export async function cacheMergeAccountOrders(
  accountId: string,
  open: OrderRow[],
  history: OrderRow[] | null,
) {
  const db = await getDb()
  const existing = await db.getAllFromIndex('orders', 'by-account', accountId)
  const tx = db.transaction('orders', 'readwrite')
  for (const o of existing) {
    if (o.status === 'open' || o.status === 'partial') {
      await tx.store.delete(o.id)
    }
  }
  for (const o of open) await tx.store.put(o)
  if (history) {
    for (const o of history) await tx.store.put(o)
  }
  await tx.done
}
```

- [ ] **Step 6: Run tests — expect PASS**

Run: `npm test -- src/utils/orderListFingerprint.test.ts src/storage/cache.test.ts`

---

### Task 2: Sync uses merge (never wipe history)

**Files:**
- Modify: `mobile/src/services/sync.ts`

**Interfaces:**
- Consumes: `cacheMergeAccountOrders`
- Produces: same `syncAccount(accountId: string)` signature; history failure passes `null`

- [ ] **Step 1: Replace order write block in `syncAccount`**

```ts
const open = await ex.fetchOpenOrders(creds, accountId)
let history: OrderRow[] | null = null
try {
  history = await ex.fetchOrderHistory(creds, accountId)
} catch {
  history = null
}
await cacheMergeAccountOrders(accountId, open, history)
```

Import `OrderRow` if needed; remove `cacheReplaceAccountOrders` usage here (keep export for other callers if any).

- [ ] **Step 2: Manual sanity** — no automated sync test required if cache merge covered; optional smoke via app later.

---

### Task 3: AccountFilterContext

**Files:**
- Create: `mobile/src/app/AccountFilterContext.tsx`
- Modify: `mobile/src/app/routes.tsx` (wrap shell)

**Interfaces:**
- Produces:
```ts
type AccountFilterState = {
  ready: boolean
  accountId: string // 'all' | account id
  setAccountId: (id: string) => void
  accounts: AccountMeta[]
  /** Concrete account for place-order when filter is 'all' */
  tradingAccountId: string
  refreshAccounts: () => Promise<void>
}
export function AccountFilterProvider({ children }: { children: ReactNode }): JSX.Element
export function useAccountFilter(): AccountFilterState
```

- [ ] **Step 1: Implement provider**

```tsx
const STORAGE_KEY = 'myex.accountFilterId'

export function AccountFilterProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [accounts, setAccounts] = useState<AccountMeta[]>([])
  const [accountId, setAccountIdState] = useState('all')

  const refreshAccounts = useCallback(async () => {
    const accs = await listAccounts()
    setAccounts(accs)
    setAccountIdState((prev) => {
      if (prev === 'all') return prev
      return accs.some((a) => a.id === prev) ? prev : 'all'
    })
  }, [])

  useEffect(() => {
    void (async () => {
      const saved = localStorage.getItem(STORAGE_KEY) || 'all'
      const accs = await listAccounts()
      setAccounts(accs)
      const valid = saved === 'all' || accs.some((a) => a.id === saved)
      setAccountIdState(valid ? saved : 'all')
      setReady(true)
    })()
  }, [])

  const setAccountId = useCallback((id: string) => {
    setAccountIdState(id)
    localStorage.setItem(STORAGE_KEY, id)
  }, [])

  const tradingAccountId = accountId === 'all' ? (accounts[0]?.id ?? '') : accountId

  const value = useMemo(
    () => ({ ready, accountId, setAccountId, accounts, tradingAccountId, refreshAccounts }),
    [ready, accountId, setAccountId, accounts, tradingAccountId, refreshAccounts],
  )

  return <AccountFilterContext.Provider value={value}>{children}</AccountFilterContext.Provider>
}
```

- [ ] **Step 2: Wrap in routes**

```tsx
<RequireAuth>
  <AccountFilterProvider>
    <ShellLayout />
  </AccountFilterProvider>
</RequireAuth>
```

---

### Task 4: Topbar UI + remove screen account selects

**Files:**
- Modify: `mobile/src/screens/ShellLayout.tsx`
- Modify: `mobile/src/styles/global.css`
- Modify: `mobile/src/screens/PortfolioScreen.tsx`
- Modify: `mobile/src/screens/OrdersScreen.tsx`
- Modify: `mobile/src/screens/HistoryScreen.tsx`
- Modify: `mobile/src/screens/SummaryScreen.tsx`
- Modify: `mobile/src/screens/AccountsScreen.tsx`

**Interfaces:**
- Consumes: `useAccountFilter()`

- [ ] **Step 1: Topbar select in ShellLayout**

Add under `.topbar-main` a `.topbar-account` row with `AppSelect` wallet options (`all` + accounts). Wire `value={accountId}` `onChange={setAccountId}`.

CSS sketch:

```css
.topbar-account {
  padding: 0 16px 10px;
}
.topbar-account .app-select {
  width: 100%;
}
```

- [ ] **Step 2: PortfolioScreen** — remove local `accountId` state and account `AppSelect`; use `const { accountId, setAccountId } = useAccountFilter()`. Keep deep-link effect calling `setAccountId(state.accountId)`. Keep search/sort selects.

- [ ] **Step 3: HistoryScreen** — same; remove account `AppSelect`.

- [ ] **Step 4: OrdersScreen** — use `accountId` + `tradingAccountId` from context; remove account `AppSelect`. Place/cancel use `tradingAccountId` for new orders. Open/History load:

```ts
const ids = accountId === 'all' ? accounts.map((a) => a.id) : [accountId]
// load open/history for those ids (concat + sort by updatedAt desc)
```

- [ ] **Step 5: SummaryScreen** — when `accountId !== 'all'`, sum only that account’s balances.

- [ ] **Step 6: AccountsScreen** — on navigate to portfolio with account, also `setAccountId(meta.id)` from context (in addition to location state).

---

### Task 5: OrdersScreen cache-first smooth refresh

**Files:**
- Modify: `mobile/src/screens/OrdersScreen.tsx`
- Consumes: `orderListFingerprint`, `syncAccount` (merge-backed)

- [ ] **Step 1: Replace history sync effect**

```ts
useEffect(() => {
  if (tab !== 'history' && tab !== 'open') return
  let alive = true
  void (async () => {
    await load() // cache first
    if (!online || !alive) return
    setSyncBusy(true)
    try {
      const ids =
        accountId === 'all' ? accounts.map((a) => a.id) : accountId ? [accountId] : []
      for (const id of ids) {
        try {
          await syncAccount(id)
        } catch {
          /* keep cache */
        }
      }
      if (!alive) return
      const nextOpen = /* load open for ids */
      const nextHist = /* load history for ids */
      setOpen((prev) =>
        orderListFingerprint(prev) === orderListFingerprint(nextOpen) ? prev : nextOpen,
      )
      setHistory((prev) =>
        orderListFingerprint(prev) === orderListFingerprint(nextHist) ? prev : nextHist,
      )
    } finally {
      if (alive) setSyncBusy(false)
    }
  })()
  return () => {
    alive = false
  }
}, [tab, accountId, online, accounts, load])
```

- [ ] **Step 2: Empty copy** — if `list.length === 0 && syncBusy` show loading; if offline && empty show go-online; if online empty after sync show no orders. Never clear list before sync finishes when cache had rows.

- [ ] **Step 3: Place caption** — when `accountId === 'all' && tradingAccountId`, show muted line: `Placing on {alias}`.

- [ ] **Step 4: Preserve expand** — after setState, if `expandedId` missing from new list, clear it (effect already ok).

---

### Task 6: Verify

**Files:** none new

- [ ] **Step 1:** `npm test` from `D:\source\repos\MyBinance\mobile`
- [ ] **Step 2:** `npm run build`
- [ ] **Step 3:** Manual — topbar filter persists; Home/Trade/History have no account chip; History offline shows cache; online refresh no flash when unchanged

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| Topbar account control | 4 |
| Context + persist | 3 |
| Remove per-screen account selects | 4 |
| Place with `all` → tradingAccountId + caption | 4–5 |
| Cache-first history | 5 |
| Merge / no wipe | 1–2 |
| Fingerprint / no shake | 1, 5 |
| Binance + OKX same path | 2, 5 |
| Summary respects filter | 4 |
| Deep link from Wallet | 4 |

## Execution

User directed: execute without further approval prompts. Prefer inline execution in this session (executing-plans style), skip git commits unless asked.
