# Code Review Findings — Torn Poker Analyzer

**Date:** 2026-03-15
**Scope:** Full codebase review of `app.js`, `js/helpers.js`, `js/stats.js`, `js/loader.js`, `styles.css`, `index.html`

---

## 1. Critical Bugs

### 1.1 Wrong Property Name: `h.result` vs `h.outcome.result`

**Severity: Critical**
**Files:** `app.js` lines 771, 777, 937, 941, 945, 950, 1101, 1104

Multiple `findExampleHand()` callbacks reference `h.result`, which **does not exist** on hand objects. The correct property path is `h.outcome.result`.

```javascript
// WRONG (current code):
return parseHoleKey(h.hole) === bestKey && h.result === 'won';

// CORRECT
return parseHoleKey(h.hole) === bestKey && h.outcome && h.outcome.result === 'won';
```

**Impact:** Example hand buttons across Cards, Tables, Range, and Log tabs silently fail — `findExampleHand()` returns `null` and the button does nothing.

### 1.2 Inconsistent Outcome Guard Patterns

Throughout the codebase, outcome checks use three different patterns:

| Pattern | Correct? | Locations |
|---------|----------|-----------|
| `h.outcome && h.outcome.result === 'won'` | Yes | ~5 places |
| `h.outcome.result === 'won'` (no null guard) | Risky | ~3 places |
| `h.result === 'won'` (wrong property) | No | ~8 places |

This inconsistency means some code paths crash when `h.outcome` is `null`/`undefined`, and others silently return wrong results.

### 1.3 Example Hand Logic May Be Inverted (Cards Tab)

**File:** `app.js` lines 210–268

Several insight cards appear to show the wrong example hand — e.g., a "good win rate with pairs" insight showing a hand the player *lost*, or an "ace-rag is costing you" insight showing a hand the player *folded*. This is partly caused by bug 1.1 (`h.result` returning `undefined`), but the filter predicates themselves may also have inverted logic in some cases.

---

## 2. Redundant Code

### 2.1 Investment Calculation Repeated ~10+ Times

The pattern `h.invested || calcInvestmentFromActions(h.actions || [])` appears at lines 69, 104, 146, 1146, 1152, 1156, 1319, and more. This should be a single helper function like `getInvestment(h)`.

### 2.2 Win Rate Percentage Repeated

`pct(d.handsWon, d.handsWithOutcome)` is computed inline ~20 times across different tabs. The stats object returned by `analyse()` could include a pre-computed `d.winRate` field.

### 2.3 Redundant Rounding

`fmt(Math.round(x))` appears in several places, but `fmt()` already handles number formatting. If `fmt` rounds internally, the outer `Math.round()` is redundant.

---

## 3. Unused / Dead Code

### 3.1 Street-Level Average Bet Variables Never Read

**File:** `app.js` lines 478–480

`d.avgBetPre`, `d.avgBetFlop`, `d.avgBetTurn`, `d.avgBetRiver` are assigned values from the stats object but never referenced again in any render logic or template string. They appear to be leftover from a removed or planned feature.

### 3.2 Stale Documentation Reference

**File:** `CONTEXT.md` line ~20

References `analyse.js` but the file was renamed to `stats.js` (commit `98e9724`) to avoid ad blocker false positives. The documentation is now out of sync.

---

## 4. Architectural Issues

### 4.1 Monolithic `render()` Function

**File:** `app.js` line 131 (~1,265 lines long)

The `render()` function builds HTML for all 11 tabs in a single function. This makes it:
- Hard to navigate and debug
- Impossible to render a single tab independently
- Prone to variable name collisions within the function scope

Each tab's rendering could be extracted into its own function (e.g., `renderCardsTab(d)`, `renderBetsTab(d)`, etc.).

### 4.2 Range Heatmap Colors Hardcoded in JS

**File:** `app.js` lines 693–704

The color scale for the range heatmap is defined as inline JS strings rather than CSS custom properties or classes. This makes theming harder and creates a disconnect between the styling in `styles.css` and the colors actually rendered.

### 4.3 Full Re-render on Every Tab Switch

When the user clicks a tab, only the active panel's `display` changes, but `render()` has already built all 11 tabs' HTML on initial load. If `render()` were ever called again (e.g., after filtering), it rebuilds everything. A per-tab render approach would be more efficient.

---

## 5. Data Consistency Issues

### 5.1 Unknown Tables Problem

**Files:** `app.js` line 9, `js/helpers.js` `inferTable()` (~line 252)

The `inferTable()` function uses multiple fallback strategies (tableId → table field → bigBlind matching → action text parsing). When all fail, the hand is tagged as "unknown." Users with older export formats are reportedly seeing 1500+ hands tagged as unknown and effectively filtered out of analysis.

### 5.2 Hand Object Schema Not Validated

There's no schema validation on the incoming JSON. The code assumes certain properties exist (`.hole`, `.actions`, `.outcome`, `.position`) but only checks `.hole` (line 105). Missing or malformed properties elsewhere cause silent failures rather than clear error messages.

---

## 6. CSS Issues

### 6.1 Panel Max-Width Potentially Too Narrow — DONE

### 6.2 Trends Grid Layout — DONE

### 6.3 Cards Panel Grid — DONE

---

## 7. Potential Bugs

### 7.1 Tournament vs Cash Game Classification

The "Beach Please" tournament (ID 37) may be classified as a cash game. The `inferTable()` logic or `TABLE_META` mapping may not correctly identify this table as a tournament.

### 7.2 "Unknown" Player Names in Players Tab

Some opponent entries show as "Unknown" — likely caused by missing `author` fields in action objects, or action text parsing failing to extract player names for certain action formats.

### 7.3 Hand Log Length / Insight Visibility

In the Log tab, insight cards are positioned below what can be 50+ hand rows. Users have to scroll extensively to see insights. The insights should appear above the hand log, or the log should be paginated.

---

## 8. Missing Functionality

### 8.1 Range Panel Click-to-View

Clicking a cell in the range heatmap should show hands played with those hole cards. Currently the heatmap renders but has no click handler to drill into specific holdings.

### 8.2 Some Insights Missing Example Hand Buttons

A few insight cards use `ins()` (no example button) where `insWithExample()` would be more useful — particularly in the Bets tab for flop/turn/river sizing insights (lines 501, 512, 523). However, fixing bug 1.1 first is a prerequisite, as example hand lookups are broken across the board.

---

## 9. Summary

| Category | Count | Severity |
|----------|-------|----------|
| Critical bugs (wrong property names) | 8 locations | Critical |
| Inverted/broken example hand logic | ~5 insights | High |
| Redundant code patterns | 3 patterns | Low |
| Unused variables/dead code | 2 items | Low |
| Architectural concerns | 3 items | Informational |
| CSS/layout issues | 3 items | Medium |
| Missing functionality | 2 features | Low |
