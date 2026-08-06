# Dark Glass UI Redesign — Design Spec

**Date:** 2026-08-06  
**Branch:** `mobile`  
**Status:** Approved (user directed: proceed without further approval loops)  
**Related:** `2026-08-06-mobile-pwa-design.md` (product/architecture unchanged)

## Goal

Restyle the existing MyExchanges mobile app to closely match the provided crypto-fintech reference (dark glass, blue glow, floating tab bar), reshape Home / Markets / asset-detail layouts to that mock, and add a persisted light theme toggle — without inventing new wallet flows or changing exchange/data architecture.

## Locked decisions

| Topic | Decision |
|-------|----------|
| Scope | Theme + key layouts (Home, Markets, asset detail). Trade / Wallet / More get theme only |
| Fidelity | Very close to reference (spacing, glow, glass tab bar, card shapes) |
| Theme | Dark by default + light toggle (persisted). Soft light twin of same layouts |
| Brand | Hybrid: blue primary / glow; green for gains; soft purple ambient wash in dark only |
| Home actions | Map to real flows: Trade → `/orders`, Markets → `/live`, Sync → existing sync, More → `/more` |
| Approach | CSS tokens + shell restyle, then targeted layout polish (no new component library first) |
| Tabs | Keep: Home, Trade, Markets, Wallet, More |
| Architecture | No exchange/API/schema changes; UI + theme preference only |

## Visual system

### Tokens

- Implement dual palettes via CSS variables on `:root` (dark) and `html[data-theme="light"]` (light).
- Persist `data-theme` in `localStorage` key `mybinance.theme` (`dark` | `light`). Default `dark`.
- Apply theme on `document.documentElement` as early as practical (inline boot snippet or `main.tsx` before paint) to avoid flash.

### Color roles

| Role | Dark | Light |
|------|------|-------|
| Background | Near-black `#07090f` + blue/purple radial wash | Soft `#f2f5fa` + light blue/green wash |
| Surface / glass | Semi-transparent elevated panels, `backdrop-filter` | White/frosted cards, soft shadow |
| Primary | `#2f7df6` → `#1558ad` gradients | Same blues, quieter glow |
| Gain | Brand green `#74c044` / `#5aa332` | Same |
| Loss | Existing danger red | Same |
| Text | Light ink on dark | Existing ink `#101828` / muted greys |

### Shape & chrome

- Card radius ~18–24px; pills ~20px; CTA buttons ~24px height radius.
- Floating glass tab bar (inset from edges, blur, active tab blue orb glow).
- Primary CTAs: blue gradient + shadow; secondary: glass/outline.
- Font: prefer **DM Sans** (or keep Inter if load cost is a concern — pick one and use consistently). Avoid default system-only stack for display numbers.

### Theme toggle

- Sun/moon control in shell header next to Lock.
- Same control on Unlock screen.
- Toggle flips `data-theme` and persistence immediately.

## Screen layouts

### Shell

- Keep account filter in header (restyle to glass select).
- Connection status remains visible but visually quieter under brand/greeting.
- Tab bar: floating glass; active state matches mock glow.
- On chart fullscreen, continue hiding tab bar as today.

### Home (`PortfolioScreen`)

Reshape to match reference hierarchy:

1. Greeting row (avatar/initials + “Good Morning” / brand) + theme + lock.
2. **Total Balance** hero (USDT, optional BTC subline, hide-balance eye if already present or easy).
3. **Quick actions** (4 glow circles): Trade, Markets, Sync, More.
4. **Top Gainers** horizontal cards (asset icon, name, price, % change, sparkline) from cached tickers; “See all” → Markets.
5. **Watchlist** vertical list from favorites (price, %, sparkline); empty state → prompt to favorite from Markets.

Keep existing portfolio power features (sort, dust hide, expand-by-account) accessible below the fold or via a secondary “Assets” section — do not delete capability; de-emphasize vs hero layout.

### Markets (`LiveScreen` list mode)

- Search + filter affordance.
- Category pills: Trending / Top Gainers / Top Losers (derived from ticker 24h change; Trending = |change| or volume proxy if available, else absolute % movers).
- Rows: icon, name/ticker, sparkline, price, % change.
- Tap row → asset detail (chart) for that symbol.
- Keep pro chart controls in detail view (intervals, indicators) — may sit under a “Pro” disclosure or secondary toolbar so the first viewport stays mock-like.

### Asset detail (same route / focused state of Live)

- Back, symbol title, favorite star.
- Large price + 24h change.
- Candlestick chart (existing `CandleChart`).
- Timeframe pills styled like mock (map to existing intervals: e.g. 24h→1h/15m pragmatic mapping, 1W→1d, 1M→1d, etc. — document exact mapping in plan).
- Bottom CTAs: **Orders** → `/orders`, **Trade** → `/orders` with symbol context if already supported; otherwise navigate to Trade tab.

### Other screens

- Orders, Accounts, History, Summary, Settings, More, Unlock: apply theme tokens and shared controls only; no forced layout rewrite.

## Data / behavior notes

- Sparklines: reuse existing sparkline CSS/SVG patterns; feed from cached candle closes or ticker history if already available; if only last price exists, show flat/empty spark gracefully.
- Top Gainers / losers: compute client-side from `cacheGetTickers()`; no new API.
- Sync action: call existing `syncAll` / portfolio sync path; show toast on success/failure (existing patterns).
- No Send/Receive/Transfer crypto transfers — those labels are not used.

## Out of scope

- New exchanges, futures, on-chain wallet, deposits/withdrawals.
- Full redesign of Trade order form layout.
- Pixel-perfect status-bar skinning beyond safe-area padding.
- Separate design-system package / Storybook.

## Files likely touched

- `mobile/src/styles/global.css` — tokens, shell, cards, tabbar, new home/markets classes
- `mobile/src/screens/ShellLayout.tsx` — floating tabbar classes, theme toggle, header
- `mobile/src/screens/PortfolioScreen.tsx` — hero layout, actions, gainers, watchlist
- `mobile/src/screens/LiveScreen.tsx` — markets list chrome + detail header/CTAs
- `mobile/src/screens/UnlockScreen.tsx` — theme + dark/light styling
- `mobile/src/main.tsx` / `index.html` — early theme boot, font link
- Optional tiny helper: `mobile/src/app/theme.ts` for get/set/subscribe theme

## Success criteria

1. Side-by-side with reference: dark Home / Markets / Detail clearly recognize as the same design language.
2. Light theme usable and consistent; no unreadable contrast on primary screens.
3. Theme preference survives reload.
4. Existing sync, orders, charts, favorites, account filter still work.
5. No new backend; tests for theme helper (if extracted) and any pure ticker-ranking helpers.

## Preview artifacts

Interactive HTML mockups live under `.superpowers/brainstorm/` (gitignored): `ui-mockup-v1.html`, `light-theme-v1.html`.
