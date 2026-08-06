# Dark Glass UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle MyExchanges to closely match the dark-glass crypto UI reference, reshape Home / Markets / asset detail, and ship a persisted light theme toggle.

**Architecture:** CSS custom-property dual theme (`data-theme` on `<html>`), tiny theme helper, shell/header/tabbar restyle, then Portfolio + Live layout polish. No exchange/API changes.

**Tech Stack:** React + Vite + TypeScript, existing `global.css`, Vitest for pure helpers.

## Global Constraints

- Fidelity: very close to reference mockups in `.superpowers/brainstorm/` and user image.
- Scope: theme all screens; layout rewrite only Home, Markets list, asset detail.
- Home actions: Trade `/orders`, Markets `/live`, Sync existing sync, More `/more`.
- Brand hybrid: blue primary/glow, green gains, purple ambient only in dark.
- Dark default; light toggle persisted as `mybinance.theme`.
- Do not invent Send/Receive/Transfer or on-chain flows.
- Keep account filter, sync, favorites, charts, orders working.
- Commits: small, focused; do not push unless asked.

---

## File map

| File | Responsibility |
|------|----------------|
| `mobile/index.html` | Early theme boot script, font, theme-color |
| `mobile/src/app/theme.ts` | get/set/subscribe theme; `Theme` type |
| `mobile/src/app/theme.test.ts` | Theme helper tests |
| `mobile/src/utils/marketRank.ts` | Rank tickers: trending / gainers / losers |
| `mobile/src/utils/marketRank.test.ts` | Ranking tests |
| `mobile/src/styles/global.css` | Tokens, shell, glass, home/markets classes |
| `mobile/src/screens/ShellLayout.tsx` | Theme toggle, floating tabbar, header |
| `mobile/src/screens/UnlockScreen.tsx` | Theme-aware unlock + toggle |
| `mobile/src/screens/PortfolioScreen.tsx` | Balance hero, actions, gainers, watchlist |
| `mobile/src/screens/LiveScreen.tsx` | Markets chrome + detail CTAs/timeframe pills |

---

### Task 1: Theme helper + early boot

**Files:**
- Create: `mobile/src/app/theme.ts`
- Create: `mobile/src/app/theme.test.ts`
- Modify: `mobile/index.html`
- Modify: `mobile/src/main.tsx` (import side-effect apply if needed)

**Interfaces:**
- Produces:
  - `export type Theme = 'dark' | 'light'`
  - `export const THEME_KEY = 'mybinance.theme'`
  - `export function getStoredTheme(): Theme`
  - `export function applyTheme(theme: Theme): void` — sets `document.documentElement.dataset.theme` and `localStorage`
  - `export function toggleTheme(): Theme`
  - `export function subscribeTheme(cb: (t: Theme) => void): () => void`

- [ ] **Step 1: Write failing tests**

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { applyTheme, getStoredTheme, THEME_KEY, toggleTheme } from './theme'

describe('theme', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
  })

  it('defaults to dark when unset', () => {
    expect(getStoredTheme()).toBe('dark')
  })

  it('applyTheme persists and sets data-theme', () => {
    applyTheme('light')
    expect(localStorage.getItem(THEME_KEY)).toBe('light')
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('toggleTheme flips dark ↔ light', () => {
    applyTheme('dark')
    expect(toggleTheme()).toBe('light')
    expect(toggleTheme()).toBe('dark')
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `cd mobile && npx vitest run src/app/theme.test.ts`

- [ ] **Step 3: Implement `theme.ts`**

```ts
export type Theme = 'dark' | 'light'
export const THEME_KEY = 'mybinance.theme'

const listeners = new Set<(t: Theme) => void>()

export function getStoredTheme(): Theme {
  const v = localStorage.getItem(THEME_KEY)
  return v === 'light' ? 'light' : 'dark'
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme
  localStorage.setItem(THEME_KEY, theme)
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#07090f' : '#f2f5fa')
  listeners.forEach((cb) => cb(theme))
}

export function toggleTheme(): Theme {
  const next = getStoredTheme() === 'dark' ? 'light' : 'dark'
  applyTheme(next)
  return next
}

export function subscribeTheme(cb: (t: Theme) => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

// Apply on module load for SPA navigations after first paint boot
if (typeof document !== 'undefined') {
  applyTheme(getStoredTheme())
}
```

- [ ] **Step 4: Early boot in `index.html` head** (before CSS flash)

```html
<script>
  (function () {
    try {
      var t = localStorage.getItem('mybinance.theme');
      document.documentElement.dataset.theme = t === 'light' ? 'light' : 'dark';
    } catch (e) {
      document.documentElement.dataset.theme = 'dark';
    }
  })();
</script>
```

Also add DM Sans to the Google Fonts link alongside Inter (or replace Inter with DM Sans per spec — use DM Sans as `--font`).

- [ ] **Step 5: Re-run tests — expect PASS; commit**

```bash
git add mobile/src/app/theme.ts mobile/src/app/theme.test.ts mobile/index.html mobile/src/main.tsx
git commit -m "feat(mobile): add persisted dark/light theme helper"
```

---

### Task 2: CSS tokens + shell chrome

**Files:**
- Modify: `mobile/src/styles/global.css` (`:root` through `.tabbar`, `.phone-shell`, `.topbar`, buttons)
- Modify: `mobile/src/screens/ShellLayout.tsx`

**Interfaces:**
- Consumes: `getStoredTheme`, `toggleTheme`, `subscribeTheme` from `theme.ts`
- Produces: Shell renders theme toggle; CSS variables drive both themes

- [ ] **Step 1: Replace `:root` palette with dark defaults + `html[data-theme="light"]` overrides** matching spec colors (bg `#07090f` / `#f2f5fa`, blue `#2f7df6`, green `#74c044`, glass surfaces). Keep semantic names `--bg`, `--surface`, `--ink`, `--blue`, `--up`, `--down`, add `--glow`, `--glass`, `--tabbar-bg`.

- [ ] **Step 2: Restyle `.phone-stage`, `.phone-shell`, `.topbar`, `.tabbar`** for floating glass nav (inset, blur, active orb). Update `.tabbar-item.active` with blue glow.

- [ ] **Step 3: Wire theme toggle in `ShellLayout` header** (icon button `aria-label="Toggle theme"` calling `toggleTheme()`, local state from `subscribeTheme`).

- [ ] **Step 4: Manual check** — `npm run dev` in `mobile/`, toggle theme, verify tabbar/topbar. Commit:

```bash
git commit -m "feat(mobile): dark glass shell tokens and theme toggle"
```

---

### Task 3: Market ranking helper

**Files:**
- Create: `mobile/src/utils/marketRank.ts`
- Create: `mobile/src/utils/marketRank.test.ts`

**Interfaces:**
- Consumes: `TickerRow` from `domain/types`
- Produces:
  - `export type MarketCategory = 'trending' | 'gainers' | 'losers'`
  - `export function rankTickers(tickers: TickerRow[], category: MarketCategory, limit?: number): TickerRow[]`

Rules:
- `gainers`: `changePct24h` desc, finite only
- `losers`: `changePct24h` asc
- `trending`: sort by `Math.abs(changePct24h)` desc (quoteVolume if present on row later; today use abs %)

- [ ] **Step 1: Write tests** with sample tickers (BTC +5, ETH -2, SOL +12, etc.)

- [ ] **Step 2: Implement + pass vitest**

- [ ] **Step 3: Commit** `feat(mobile): rank tickers for markets tabs`

---

### Task 4: Home layout (PortfolioScreen)

**Files:**
- Modify: `mobile/src/screens/PortfolioScreen.tsx`
- Modify: `mobile/src/styles/global.css` (home hero / gainer cards / action row)

**Interfaces:**
- Consumes: `rankTickers`, navigation, existing sync/valuation/favorites/cache
- Produces: Mock-like Home first viewport

- [ ] **Step 1: Restructure JSX top of Portfolio** to: greeting (optional compact), balance hero, 4 action buttons, Top Gainers strip (`rankTickers(..., 'gainers', 6)`), Watchlist from favorites with prices from tickers. Keep Assets table / filters in a lower “Assets” section.

- [ ] **Step 2: Wire actions** — `navigate('/orders')`, `navigate('/live')`, existing sync handler, `navigate('/more')`.

- [ ] **Step 3: Add CSS** for `.quick-actions`, `.gainer-card`, glass cards; ensure light theme contrast.

- [ ] **Step 4: Smoke in browser; commit** `feat(mobile): reshape home to glass balance hero layout`

---

### Task 5: Markets + asset detail chrome (LiveScreen)

**Files:**
- Modify: `mobile/src/screens/LiveScreen.tsx`
- Modify: `mobile/src/styles/global.css`

**Timeframe pill mapping (detail):**

| Pill | Interval |
|------|----------|
| 24h | `15m` |
| 1W | `1h` |
| 1M | `4h` |
| 6M | `1d` |
| All | `1w` |

Keep existing interval select available under Pro/advanced controls.

- [ ] **Step 1: Markets list mode UI** — search row, category pills (Trending/Gainers/Losers) using `rankTickers`, sparkline rows (reuse AccountsScreen spark pattern or shared inline SVG), tap → select symbol detail.

- [ ] **Step 2: Detail header** — large price, % change, favorite star; style chart container dark-glass; pill timeframes; bottom CTAs Orders + Trade → `/orders`.

- [ ] **Step 3: CSS for pills, market rows, detail CTAs**

- [ ] **Step 4: Commit** `feat(mobile): markets list and asset detail glass chrome`

---

### Task 6: Unlock + remaining screen polish

**Files:**
- Modify: `mobile/src/screens/UnlockScreen.tsx`
- Modify: `mobile/src/styles/global.css` as needed for orders/accounts/settings surfaces on new tokens
- Modify: `mobile/index.html` (`theme-color`, apple status bar `black-translucent` optional)

- [ ] **Step 1: Unlock screen** uses theme tokens + theme toggle
- [ ] **Step 2: Sweep obvious hard-coded light-only colors in CSS/components**
- [ ] **Step 3: Run full test suite** `cd mobile && npm test`
- [ ] **Step 4: Commit** `feat(mobile): theme-aware unlock and global polish`

---

### Task 7: Verification

- [ ] Dark Home / Markets / Detail visually close to mock
- [ ] Light toggle + persistence across reload
- [ ] Sync, favorites, charts, account filter, orders still work
- [ ] `npm test` green

---

## Spec coverage check

| Spec item | Task |
|-----------|------|
| Theme tokens + persistence | 1–2 |
| Hybrid brand colors | 2 |
| Floating glass tab bar | 2 |
| Home hero + actions + gainers + watchlist | 4 |
| Markets search/pills/list | 5 |
| Asset detail chart/CTAs | 5 |
| Light soft twin | 2, 4–6 |
| No API changes | all |
| Ranking helpers tested | 3 |
