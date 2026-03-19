# TC Poker Analysis — BB Display Toggle Implementation

## Overview

Add a toggle button in the dashboard header that switches dollar amounts to Big Blind (BB) units. This normalizes bet sizing and pot sizes across different stakes, making cross-table comparisons meaningful. A $500 bet at a $25/$50 table is 10 BB, but at a $500/$1,000 table it's only 0.5 BB.

**P&L is excluded.** Net profit/loss figures always display in dollars regardless of the toggle.

---

## What the toggle affects

**Converts to BB when toggled ON:**
- Hero strip: Avg Pot (if shown)
- Bets tab: average bet size by street (bar charts + bar labels)
- Bets tab: insight card text referencing bet amounts (e.g. "Average flop bet: $500" becomes "Average flop bet: 10 BB")
- Street tab: average bet size by street section
- Position tab: Avg Pot column
- Tables tab: Avg Pot column
- Hand log: result column amounts (win/loss per hand) — **EXCEPT** this is P&L, so **skip this**
- Insight cards: any `fmt()` call that references a bet amount or pot size (not P&L)
- Modal hand detail: pot size display

**Always stays in dollars (never converted):**
- Hero strip: Net P&L
- Position tab: Net P&L column
- Tables tab: Net P&L column
- Combined tab: P&L references
- Trends tab: Cumulative Net P&L chart and values
- Hand log result column (this is profit/loss)
- Table blinds display (these are labels, not analysis values)

---

## Architecture

### Global state

Add a global variable near the top of the JS, alongside `_allHands`, `_meta`, `_excludedTables`:

```javascript
let _displayBB = false;
```

### New formatting function

Add a new function alongside the existing `fmt()` function. Do NOT modify `fmt()` itself.

```javascript
function fmtBB(amount, bb) {
  if (!_displayBB || !bb || bb <= 0) return fmt(amount);
  var bbs = amount / bb;
  if (Math.abs(bbs) >= 100) return Math.round(bbs) + ' BB';
  if (Math.abs(bbs) >= 10) return bbs.toFixed(1) + ' BB';
  return bbs.toFixed(2) + ' BB';
}
```

This function:
- If BB mode is OFF, or BB is unknown/zero, falls back to `fmt()` (dollar display)
- Otherwise divides the dollar amount by the big blind and formats with appropriate precision
- Small values (under 10 BB) get 2 decimal places
- Medium values (10-99 BB) get 1 decimal place
- Large values (100+ BB) are rounded to whole numbers

### Getting BB for a hand

The BB for any hand can be looked up via the existing `inferTable()` and `TABLE_META`:

```javascript
function getHandBB(hand) {
  var tid = inferTable(hand);
  if (tid !== null && TABLE_META[tid]) return TABLE_META[tid].bb;
  return null;
}
```

Add this as a helper function near `inferTable()` and `getTableLabel()`.

---

## Change 1: HTML — Add the toggle button

In the header, find the area with the table filter and meta. It's in `.header-inner`, in the right-side `div`:

```html
<div style="display:flex;align-items:center;gap:16px;">
  <select id="table-filter" ...>
```

Add the toggle button **before** the table filter select:

```html
<button id="bb-toggle" class="bb-toggle" title="Toggle between dollar amounts and Big Blinds">$</button>
```

The button text shows `$` when in dollar mode, `BB` when in BB mode.

---

## Change 2: CSS — Style the toggle button

Add this CSS (near the `.table-filter` styles):

```css
/* BB TOGGLE */
.bb-toggle {
  background: var(--s2);
  border: 1px solid var(--border);
  color: var(--dim);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 10px;
  font-weight: 600;
  padding: 6px 10px;
  border-radius: 4px;
  cursor: pointer;
  min-width: 36px;
  text-align: center;
  transition: border-color .2s, color .2s;
}
.bb-toggle:hover {
  border-color: var(--dim);
  color: var(--text);
}
.bb-toggle.active {
  border-color: var(--gold2);
  color: var(--gold);
}
```

---

## Change 3: JS — Wire the toggle

Add this event listener. It should go near the other header wiring (near the table filter `onchange` handler, or at the end of the main script before the closing IIFE):

```javascript
document.getElementById('bb-toggle').onclick = function() {
  _displayBB = !_displayBB;
  this.textContent = _displayBB ? 'BB' : '$';
  this.classList.toggle('active', _displayBB);
  // Re-render with current data
  if (_allHands.length) {
    var currentFilter = document.getElementById('table-filter').value;
    var filtered = _allHands;
    if (currentFilter !== 'all') {
      filtered = _allHands.filter(function(h) {
        var tid = inferTable(h);
        return currentFilter === 'unknown' ? tid === null : tid === Number(currentFilter);
      });
    }
    filtered = filtered.filter(function(h) {
      return !_excludedTables.has(String(inferTable(h) || 'unknown'));
    });
    var fd = analyse(filtered);
    render(fd, filtered, _meta);
    // Restore the active tab after re-render (render defaults to welcome/first tab)
    // This needs to preserve whichever tab was active before the toggle
  }
};
```

**Important: Preserve the active tab across re-renders.** The toggle triggers a full `render()` call, which resets to the default tab (Overview/welcome). To fix this, at the very start of the `render()` function, capture the currently active tab:

```javascript
var activeTab = document.querySelector('.tab.active');
var activeTabId = activeTab ? activeTab.dataset.tab : null;
```

Then at the very end of the `render()` function (after all panels are built), restore it:

```javascript
if (activeTabId && activeTabId !== 'welcome') {
  document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
  document.querySelectorAll('.panel').forEach(function(p) { p.classList.remove('on'); });
  var restoreTab = document.querySelector('[data-tab="' + activeTabId + '"]');
  if (restoreTab) {
    restoreTab.classList.add('active');
    document.getElementById('p-' + activeTabId).classList.add('on');
  }
}
```

Also restore the BB toggle button state after render (since render doesn't touch it, this should persist, but verify the button still shows `BB` and has the `active` class if `_displayBB` is true).

---

## Change 4: JS — Modify `analyse()` to produce BB-normalized bet data

The `analyse()` function currently collects bet amounts per street in `d.betAmts` as arrays of raw dollar values (e.g. `d.betAmts.Flop = [500, 1000, 250]`).

Add a parallel structure `d.betAmtsBB` that stores the BB-normalized values. During the loop where bet amounts are pushed to `d.betAmts[street]`, also compute and push the BB value:

```javascript
// Existing line (approximately):
d.betAmts[street].push(amount);

// Add alongside it:
var handBB = getHandBB(hand);  // hand = the current hand object in the loop
if (!d.betAmtsBB[street]) d.betAmtsBB[street] = [];
if (handBB && handBB > 0) {
  d.betAmtsBB[street].push(amount / handBB);
}
```

Initialize `d.betAmtsBB` at the same place `d.betAmts` is initialized:

```javascript
d.betAmtsBB = { Preflop: [], Flop: [], Turn: [], River: [] };
```

Similarly, for pot sizes, track a BB-normalized average pot. Wherever `h.pot` or pot amounts are used in analysis, also compute `h.pot / getHandBB(h)`.

---

## Change 5: JS — Use `fmtBB()` in render functions

This is the most widespread change. Anywhere in the `render()` function that displays a dollar amount which is NOT P&L, replace `fmt(amount)` with `fmtBB(amount, bb)` where `bb` is the relevant big blind.

### Bets tab

The Bets tab computes `avgBets` per street. When `_displayBB` is on, compute averages from `d.betAmtsBB` instead of `d.betAmts`:

```javascript
var betSource = _displayBB ? d.betAmtsBB : d.betAmts;
betStreets.forEach(function(s) {
  var a = betSource[s];
  avgBets[s] = a && a.length ? (a.reduce(function(x, y) { return x + y; }, 0) / a.length) : 0;
});
```

Then format the display values:

```javascript
// Instead of: fmt(avgBets[s])
// Use:
_displayBB ? (avgBets[s].toFixed(1) + ' BB') : fmt(avgBets[s])
```

### Street tab — average bet size section

Same approach as Bets tab. The Street tab also renders average bet by street. Use `betSource` and format accordingly.

### Position tab — Avg Pot column

The position table shows average pot per position. To BB-normalize this, you need to know the BB. When viewing a single table (via filter), the BB is known. When viewing "All Tables", you'd need per-position pot averages computed in BB during analysis.

**Simplest approach for Avg Pot:** In the position map during `analyse()`, track a `potBB` accumulator:

```javascript
// When processing each hand for position stats:
var handBB = getHandBB(hand);
if (handBB > 0) {
  posEntry.potBB = (posEntry.potBB || 0) + ((hand.pot || 0) / handBB);
  posEntry.potBBCount = (posEntry.potBBCount || 0) + 1;
}
```

Then in the render:

```javascript
var avgPot = Math.round(s.pot / s.hands);
var avgPotDisplay = _displayBB && s.potBBCount > 0
  ? (s.potBB / s.potBBCount).toFixed(1) + ' BB'
  : fmt(avgPot);
```

### Tables tab — Avg Pot column

Same pattern. Compute BB-normalized average pot per table group during the per-table `analyse()` call. Since each table group has a known BB (from `TABLE_META[tid].bb`), this is simpler:

```javascript
var avgPotDisplay = _displayBB && tid !== 'unknown' && TABLE_META[tid]
  ? (r.avgPot / TABLE_META[tid].bb).toFixed(1) + ' BB'
  : fmt(r.avgPot);
```

### Insight cards

Insight cards contain hardcoded `fmt()` calls for bet amounts. These need to use `fmtBB()` instead. The tricky part is knowing which BB to use. For insight cards that reference aggregate stats (like "Average flop bet"), use the average from `d.betAmtsBB` when in BB mode.

For insight cards, the simplest approach is to precompute display strings at the top of the relevant section:

```javascript
var flopBetDisplay = _displayBB && d.betAmtsBB.Flop.length
  ? (d.betAmtsBB.Flop.reduce(function(a,b){return a+b;},0) / d.betAmtsBB.Flop.length).toFixed(1) + ' BB'
  : fmt(d.avgBetFlop);
```

Then reference `flopBetDisplay` in the insight text instead of `fmt(d.avgBetFlop)`.

Apply the same pattern for `d.avgBetTurn`, `d.avgBetRiver`, etc.

### Modal hand detail — Pot display

In `showExampleHandModal()`, the pot is displayed as:

```javascript
'Pot: <strong>' + fmt(hand.pot || 0) + '</strong>'
```

Change to:

```javascript
var handBB = getHandBB(hand);
'Pot: <strong>' + fmtBB(hand.pot || 0, handBB) + '</strong>'
```

---

## Summary of all changes

| # | What | Where |
|---|------|-------|
| 1 | Add `<button id="bb-toggle">` | HTML, in `.header-inner` before table filter |
| 2 | Add `.bb-toggle` CSS | Stylesheet, near `.table-filter` styles |
| 3 | Add `_displayBB` global, `fmtBB()`, `getHandBB()`, toggle click handler | JS, top-level and near helpers |
| 4 | Add `d.betAmtsBB` to `analyse()`, track BB-normalized bet amounts and pot averages | JS, inside `analyse()` function |
| 5 | Replace `fmt()` with `fmtBB()` for non-P&L amounts in render | JS, throughout `render()` and `showExampleHandModal()` |
| 6 | Preserve active tab across re-render when toggle is clicked | JS, start and end of `render()` |

## Key rules

- `fmt()` is NEVER modified. It always formats in dollars.
- `fmtBB()` wraps `fmt()` and only converts when `_displayBB` is true AND a valid BB is available.
- P&L amounts (net profit/loss, win/loss results) ALWAYS use `fmt()`, never `fmtBB()`.
- When BB is unknown for a hand (table not detected), fall back to dollar display for that value.
- The toggle re-renders the entire dashboard but preserves the currently active tab.

## Design notes

- Toggle button uses existing design system: `var(--s2)` background, `var(--border)` border, `var(--gold)` when active
- Font: IBM Plex Mono (matches table filter and other header controls)
- Button shows `$` in dollar mode, `BB` in BB mode
- Consistent with the existing table filter styling