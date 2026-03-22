# Torn Poker Analysis Tool - Full Context Document

> Use this document to onboard quickly. It covers how the app works, the file structure, known bugs, and what to fix next.

---

## 1. What This App Does

A browser-based poker hand history analyzer for Torn City's poker game. Users paste JSON hand data exported from a Tampermonkey script, and the app renders a full analytics dashboard across 10 tabs: Cards, Position, Street, Actions, Bets, Combined, Range, Tables, Trends, and Hand Log.

---

## 2. File Structure

```
/Users/jordieblack/torn-poker/
├── index.html            # HTML shell - paste zone, dashboard layout, tab buttons, panel containers
├── app.js                # Main app (~1365 lines) - process(), render(), tab rendering, event handlers
├── js/
│   ├── stats.js        # Pure analysis function (~206 lines) - analyse(hands) returns stats object
│   ├── helpers.js        # Utilities (~370 lines) - parsing, formatting, table detection, tooltips
│   └── loader.js         # Animated loading screen (~92 lines) - card reveal + progress bar
├── styles.css            # Full dark theme (~1189 lines) - all styling
├── CONTEXT.md            # This file
└── "example output"      # Sample hand data (JSON array of ~460 hands)
```

**Script load order matters:** `helpers.js` -> `stats.js` (formerly analyse.js, renamed to avoid ad blocker false positives) -> `loader.js` -> `app.js`

---

## 3. Data Flow (End to End)

```
User pastes JSON into textarea
    |
    v
process(raw) [app.js:1098]
    - JSON.parse()
    - Accepts both { hands: [...] } and raw [...] array formats
    - Saves to localStorage
    - Detects player name from >> prefixed actions
    |
    v
setSession(hands, meta) [app.js:8]
    - Stores in globals: _allHands, _meta
    |
    v
showImportLoader() [loader.js:35]
    - Animated card reveal + progress bar
    |
    v
analyse(hands) [stats.js:3]
    - Pure function, returns stats object (d)
    - Counts: wins, losses, folds, VPIP, actions by street
    - Maps: posMap (by position), htMap (by hand type), rangeMap (by combo)
    - Arrays: betAmts per street
    |
    v
render(d, hands, meta) [app.js:130]
    - Builds HTML for all 10 tab panels
    - Sets innerHTML on each panel element
```

---

## 4. Key Functions Reference

### Core
| Function | File:Line | Purpose |
|----------|-----------|---------|
| `process(raw)` | app.js:1098 | Parse JSON, trigger render |
| `analyse(hands)` | stats.js:3 | Aggregate all stats from hand array |
| `render(d, hands, meta)` | app.js:130 | Build all tab HTML |
| `setSession(hands, meta)` | app.js:8 | Store session globals |

### Parsing & Detection
| Function | File:Line | Purpose |
|----------|-----------|---------|
| `parseActions(actions)` | helpers.js:166 | Parse action strings -> structured events |
| `calcInvestmentFromActions(actions)` | helpers.js:317 | Sum hero's invested chips |
| `inferTable(hand)` | helpers.js:252 | Detect table ID from `tableId`/`table` fields only |
| `detectPlayerFromActions(hands)` | helpers.js:333 | Find hero name from >> prefix |
| `parseHoleKey(hole)` | helpers.js:210 | Convert hole cards to key like "AKs" |
| `classifyKey(key)` | helpers.js:226 | Categorize: Pocket Pairs, Broadway, etc. |
| `isCashHand(hand)` | helpers.js:303 | Check if cash (vs tournament) |

### Display Helpers
| Function | File:Line | Purpose |
|----------|-----------|---------|
| `fmt(n)` | helpers.js:105 | Format chips: $1.5M, $250K |
| `pct(a, b)` | helpers.js:115 | Percentage: a/b*100, null if b=0 |
| `tipWrap(label)` | helpers.js:123 | Wrap label with tooltip span |
| `ins(sev, label, text, chips)` | helpers.js:129 | Insight card HTML |
| `insWithExample(...)` | helpers.js:141 | Insight with "See example hand" button |
| `barRow(...)` | helpers.js:155 | Bar chart row HTML |

### Table Metadata
| Constant | File:Line | Purpose |
|----------|-----------|---------|
| `TABLE_META` | helpers.js:48-88 | Table IDs -> name, blinds, max players |
| `CASH_TABLE_IDS` | helpers.js:91 | Set of cash table IDs |
| `BB_TO_TABLES` | helpers.js:95 | Big blind amount -> table ID mapping |
| `TIPS` | helpers.js:3-45 | Tooltip definitions for poker terms |

---

## 5. analyse() Return Object Shape

```javascript
{
  n: 42,                    // total hands
  handsWon: 18,             // won count
  handsWithOutcome: 40,     // hands with result
  totalWonAmount: 3500,     // total chips won
  totalInvested: 2800,      // total chips invested
  vpip: 28,                 // voluntary put in pot count

  // Per-position stats
  posMap: { "BTN": { hands, vpip, foldPre, won, pot, pnl }, ... },

  // Hand type stats
  htMap: { "Pocket Pairs": { dealt, played, won }, ... },

  // Per-combo stats (13x13 matrix)
  rangeMap: { "AKs": { dealt, played, won }, ... },

  // Per-street stats
  ss: {
    "Preflop": { seen, f, ch, ca, ra },  // fold, check, call, raise
    "Flop":    { seen, f, ch, ca, ra },
    "Turn":    { seen, f, ch, ca, ra },
    "River":   { seen, f, ch, ca, ra },
  },

  // Action totals
  folds, checks, calls, raises, totalActs,

  // Bet data
  betAmts: { "Preflop": [500, ...], "Flop": [...], ... },
  betOpps: { "Flop": { b, t }, ... },  // b=bets made, t=total opportunities

  // All-in stats
  facedAllin, foldAllin, callAllin, wonAllin,

  // 3-bet stats
  faced3bet, fold3bet,
}
```

---

## 6. Tab Rendering (all in app.js render())

| Tab | Lines | Panel ID | Data Source |
|-----|-------|----------|-------------|
| Cards | 163-276 | `#p-cards` | `d.htMap` - stacked bars per hand type |
| Position | 278-330 | `#p-position` | `d.posMap` - table with VPIP, win rate, P&L per position |
| Street | 332-393 | `#p-street` | `d.ss` + `d.betAmts` - bar charts for reaching %, fold %, and avg bet size |
| Actions | 381-462 | `#p-actions` | `d.folds/calls/raises` + `d.ss` - mini stats + per-street table |
| Bets | 464-522 | `#p-bets` | `d.betAmts`, `d.betOpps` - avg bet size bars + frequency |
| Combined | 524-658 | `#p-combined` | Cross-metric analysis (VPIP x Aggression, etc.) |
| Range | 660-768 | `#p-range` | `d.rangeMap` - two 13x13 heatmap grids |
| Hand Log | 770-822 | `#p-log` | Raw `hands` array - paginated rows |
| Tables | 824-937 | `#p-tables` | Groups by `inferTable()`, re-analyses per table |
| Trends | 939-1062 | `#p-trends` | Groups by day, SVG line charts |

---

## 7. Known Bugs - Priority List

### Category 1: Data Parsing & Calculations (DONE)

All Category 1 bugs have been fixed:

- **1a. Bets tab blank** — FIXED: Compute averages from `d.betAmts` arrays in app.js before rendering
- **1b. 150% win rate** — FIXED: Added `didPlay &&` guard in stats.js so wins only count when hero voluntarily played (not when winning BB uncontested)
- **1c. Street reaching % identical** — FIXED: Exclude `sb`/`bb` actions from street "seen" tracking in stats.js
- **1d. Unknown tables** — FIXED: `inferTable()` now only uses `tableId`/`table` fields (no blind-based fallback). Hands from older TM script versions without `tableId` correctly show as "Unknown"
- **1e. Bet frequency empty** — FIXED: `betOpps` now populated during analysis loop (hero post-flop actions = opportunities, raises = bets)
- **1f. vs All-in blank** — FIXED: Replaced check for `'went all-in'` text (never appears in TC data) with heuristic: opponent raises >= 80% of pot where hero responded

### Category 2: Missing "View Example Hand" Buttons (PARTIALLY DONE)

Fixed `h.result` → `h.outcome.result` bug in 8 `findExampleHand()` callbacks — example hand buttons now appear correctly on Range, Tables, and Trends insight cards. Range grid cells are now clickable (opens example hand modal).

Remaining insights that still use `ins()` instead of `insWithExample()`:

| Location | Lines | Insight |
|----------|-------|---------|
| Bets tab | 489, 496, 502 | Flop/Turn/River Sizing |
| Actions tab | 433, 437 | Aggression, High Aggression |

### Category 3: Layout & Sizing (MOSTLY DONE)

- ~~Main content too narrow~~ FIXED
- ~~Trends grid layout~~ FIXED (2x2 grid)
- ~~Cards panel grid~~ FIXED
- **Remaining:** Base font sizes are 10-12px. Could increase by 1-2px globally.

### Category 4: Tooltips (DONE)

- ~~Header tooltips don't work~~ FIXED: Switched `.tip-box` from `position: absolute` to `position: fixed` with JS positioning via `positionTip()`.
- ~~Tooltips clipped on wider panels~~ FIXED: JS calculates viewport-relative coordinates, clamps within bounds.

---

## 8. Action Log Format

Hero's actions are prefixed with `>>`. Examples:
```
">> Systoned: posted small blind $500,000"
">> Systoned: folded"
"   Wardyward: raised $3,000,000 to $5,000,000"
"   The flop: : 9clubs, 5spades, 7hearts"
```

Street markers: `"The preflop:"`, `"The flop:"`, `"The turn:"`, `"The river:"`
Amount format: `$1,000,000` (cash) or `10 chips` (tournament)
Action types detected: folded, checked, called, raised, bet, posted small blind, posted big blind, won, reveals, shows

---

## 9. CSS Color System

```css
--bg: #07090a;        /* Background */
--s1: #0e1410;        /* Surface 1 */
--s2: #121a14;        /* Surface 2 */
--border: #1a2a1c;    /* Borders */
--gold: #c8a94a;      /* Primary accent */
--green: #3fad64;     /* Positive/good */
--red: #c94040;       /* Negative/bad */
--amber: #d4842a;     /* Warning */
--text: #d0d8d0;      /* Primary text */
--dim: #7a9a7a;       /* Secondary text */
```

Fonts: `Cormorant Garamond` (display), `IBM Plex Mono` (UI)

---

## 10. Quick Start for New Agent

1. Read this document first
2. Open `app.js` and `js/stats.js` to understand the data flow
3. The example data is in the `"example output"` file - it's a raw JSON array of ~460 hands
4. To test changes, paste the example data into the app's textarea
5. Categories 1 and 4 are complete. Category 2 mostly done (h.result bug fixed, range click added). Category 3 mostly done. Remaining: a few insights still using `ins()` instead of `insWithExample()`, and base font size increase.
6. The hero player in the example data is "Systoned" (detected from `>>` prefix in actions)
7. The Tampermonkey script (v3.7 by Systoned) is in the repo root — read it for reference on what data fields are captured
