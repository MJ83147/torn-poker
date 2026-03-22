# Torn Poker — App.js Refactoring Plan

## Current State

`app.js` is **1,951 lines** and handles everything: global state, modals, session management, data import, and rendering all 11 dashboard panels. The prior refactor extracted `helpers.js` (387 lines), `stats.js` (345 lines), and `loader.js` (94 lines) — good separation of utilities, analysis, and loading animation. But `app.js` remains a monolith.

### What's in app.js today

| Responsibility | ~Lines | Functions |
|---|---|---|
| Global state & session management | ~40 | `setSession()`, `checkSavedSession()` |
| Modal system | ~65 | `showExampleHandModal()`, `closeModal()`, `findExampleHand()` |
| Data import & processing | ~35 | `process()` |
| Main render orchestration | ~50 | `render()` entry, tab wiring, filter setup |
| Welcome panel | ~120 | Inline in `render()` |
| Cards panel | ~100 | Inline in `render()` |
| Position panel | ~80 | Inline in `render()` |
| Street panel | ~100 | Inline in `render()` |
| Actions panel | ~130 | Inline in `render()` |
| Bets panel | ~80 | Inline in `render()` |
| Range panel | ~160 | `buildRangeContent()`, `renderRangeGrids()` |
| Tables panel | ~80 | Inline in `render()` |
| Trends panel | ~140 | `renderTrends()` |
| Log panel | ~55 | `renderLogPage()` |
| Players panel | ~240 | `renderPlayers()`, `renderPlayerHands()` |
| Profile/changelog | ~100 | `openProfile()`, `renderProfile()` |
| Tooltip positioning | ~25 | `positionTip()` |
| BB toggle & UI event handlers | ~50 | Various inline handlers |

---

## Refactoring Goals

1. **No panel render function exceeds ~150 lines** in its own file
2. **Each module has a single responsibility** — one panel, one concern
3. **Shared state is explicit** — passed as arguments, not hidden globals
4. **Zero breaking changes** — same HTML structure, same UX, same script load order
5. **No build tools required** — stays as plain `<script>` tags (can add module bundler later)

---

## Phase 1: Extract State & Shared Services (~Day 1)

### 1.1 — Create `js/state.js` (~40 lines)

Centralize all global state into a single module:

```js
// js/state.js — Single source of truth for app state
const State = {
  allHands: [],
  meta: {},
  excludedTables: new Set(),
  displayBB: false,
  modalHands: [],

  setSession(hands, meta) {
    this.allHands = hands;
    this.meta = meta;
  },

  getFilteredHands() {
    return this.allHands.filter(h => !this.excludedTables.has(inferTable(h)));
  },

  // localStorage persistence
  save() { ... },
  load() { ... },
  clear() { ... }
};
```

**Why:** Every panel currently reads `_allHands`, `_meta`, `_displayBB` as implicit globals. Making state explicit reveals dependencies and prevents hidden coupling.

### 1.2 — Create `js/modal.js` (~70 lines)

Extract the modal system:

```js
// js/modal.js
function showExampleHandModal(hand, coachingNote) { ... }
function closeModal() { ... }
function findExampleHand(hands, filterFn) { ... }
```

**Why:** Modals are used across multiple panels (Welcome, Cards, Actions, Street) but are a self-contained UI concern.

### 1.3 — Create `js/tooltip.js` (~30 lines)

Extract tooltip positioning logic:

```js
// js/tooltip.js
function positionTip(tooltipEl) { ... }
function initTooltips(container) { ... }
```

---

## Phase 2: Extract Panel Renderers (~Days 2–4)

Each panel becomes its own file under `js/panels/`. Every panel exports a single render function with a consistent signature:

```js
function renderXxx(container, stats, hands, meta) { ... }
```

### 2.1 — Create `js/panels/welcome.js` (~120 lines)

The Welcome/overview panel with hero stats, win rate badge, insights, and tips.

- Receives: `stats` object, `hands` array, `meta` object
- Produces: HTML string or DOM mutations into `#p-welcome`
- Dependencies: `ins()`, `insWithExample()`, `fmtBB()`, `pct()` from helpers

### 2.2 — Create `js/panels/cards.js` (~100 lines)

Hand type breakdown with stacked bar charts.

- Receives: `stats.htMap`, `hands`
- Produces: HTML into `#p-cards`
- Dependencies: `barRow()`, `ins()`, `classifyKey()` from helpers

### 2.3 — Create `js/panels/position.js` (~80 lines)

Per-seat statistics table (VPIP, fold rate, win rate by position).

- Receives: `stats.posMap`
- Produces: HTML into `#p-position`
- Dependencies: `pct()`, `fmtBB()` from helpers

### 2.4 — Create `js/panels/street.js` (~100 lines)

Preflop/Flop/Turn/River action breakdown.

- Receives: `stats.ss` (street stats)
- Produces: HTML into `#p-street`
- Dependencies: `barRow()`, `ins()`, `insWithExample()` from helpers

### 2.5 — Create `js/panels/actions.js` (~130 lines)

Fold/check/call/raise frequencies plus situational stats (C-Bet, Donk Bet, etc.).

- Receives: `stats` (aggregate action counts + situational counters)
- Produces: HTML into `#p-actions`
- Dependencies: `barRow()`, `ins()`, `pct()` from helpers

### 2.6 — Create `js/panels/bets.js` (~80 lines)

Average bet sizing by street.

- Receives: `stats` (bet sizing data)
- Produces: HTML into `#p-bets`
- Dependencies: `fmtBB()`, `barRow()` from helpers

### 2.7 — Create `js/panels/range.js` (~160 lines)

13x13 hand grid with win rate and frequency heatmaps.

- Receives: `stats.rangeMap`, `hands`
- Contains: `buildRangeContent()`, `renderRangeGrids()`
- Dependencies: `parseHoleKey()`, `classifyKey()`, `pct()` from helpers

### 2.8 — Create `js/panels/tables.js` (~80 lines)

Per-table comparison with exclude/include toggle buttons.

- Receives: `hands`, `State.excludedTables`
- Produces: HTML into `#p-tables`
- Callback: triggers re-render when exclusions change
- Dependencies: `inferTable()`, `getTableLabel()` from helpers

### 2.9 — Create `js/panels/trends.js` (~140 lines)

SVG line charts for cumulative win rate, VPIP, aggression, P&L.

- Receives: `hands`, `meta`
- Produces: SVG + HTML into `#p-trends`
- Dependencies: `fmtBB()`, `pct()` from helpers

### 2.10 — Create `js/panels/log.js` (~55 lines)

Paginated hand history list with action summaries.

- Receives: `hands`
- Produces: HTML into `#p-log`
- Contains: Internal pagination state
- Dependencies: `fmt()` from helpers

### 2.11 — Create `js/panels/players.js` (~240 lines)

Opponent tracking, watch list, per-player hand review.

- Receives: `hands`, `stats`
- Contains: `renderPlayers()`, `renderPlayerHands()`
- Dependencies: `analyse()` from stats (re-analyses per-opponent), `fmt()`, `pct()`
- State: reads/writes `localStorage` for watched players

### 2.12 — Create `js/panels/profile.js` (~100 lines)

Profile stats display and changelog panel.

- Receives: `hands`, `meta`
- Produces: HTML for profile/changelog overlay

---

## Phase 3: Slim Down app.js to Orchestrator (~Day 5)

After all panels are extracted, `app.js` becomes a thin orchestrator (~150–200 lines):

```js
// app.js — Orchestrator (target: ~150 lines)

// 1. Check for saved session on load
checkSavedSession();

// 2. process() — parse pasted JSON, validate, call render
function process(raw) {
  const { hands, meta } = JSON.parse(raw);
  State.setSession(hands, meta);
  render();
}

// 3. render() — orchestrate panel rendering
function render() {
  const hands = State.getFilteredHands();
  const d = analyse(hands);

  renderWelcome(document.getElementById('p-welcome'), d, hands, State.meta);
  renderCards(document.getElementById('p-cards'), d, hands);
  renderPosition(document.getElementById('p-position'), d);
  renderStreet(document.getElementById('p-street'), d, hands);
  renderActions(document.getElementById('p-actions'), d, hands);
  renderBets(document.getElementById('p-bets'), d);
  renderRange(document.getElementById('p-range'), d, hands);
  renderTables(document.getElementById('p-tables'), hands, () => render());
  renderTrends(document.getElementById('p-trends'), hands, State.meta);
  renderLog(document.getElementById('p-log'), hands);
  renderPlayers(document.getElementById('p-players'), hands, d);

  initTooltips(document.body);
  wireTabSwitching();
  wireBBToggle();
}

// 4. Tab switching, BB toggle, filter wiring
function wireTabSwitching() { ... }
function wireBBToggle() { ... }
```

### Updated Script Load Order in index.html

```html
<!-- Core -->
<script src="js/helpers.js"></script>
<script src="js/stats.js"></script>
<script src="js/loader.js"></script>

<!-- Services -->
<script src="js/state.js"></script>
<script src="js/modal.js"></script>
<script src="js/tooltip.js"></script>

<!-- Panels -->
<script src="js/panels/welcome.js"></script>
<script src="js/panels/cards.js"></script>
<script src="js/panels/position.js"></script>
<script src="js/panels/position.js"></script>
<script src="js/panels/street.js"></script>
<script src="js/panels/actions.js"></script>
<script src="js/panels/bets.js"></script>
<script src="js/panels/range.js"></script>
<script src="js/panels/tables.js"></script>
<script src="js/panels/trends.js"></script>
<script src="js/panels/log.js"></script>
<script src="js/panels/players.js"></script>
<script src="js/panels/profile.js"></script>

<!-- Orchestrator (last) -->
<script src="app.js"></script>
```

---

## Phase 4: Polish & Verify (~Day 6)

### 4.1 — Verify nothing broke
- Import a saved session → all 11 tabs render correctly
- Toggle BB display → values update across all panels
- Exclude/include tables → re-render fires correctly
- Example hand modals open from any panel
- Tooltips position correctly
- Trends SVG charts render
- Players watch list persists across reload
- Profile/changelog panel opens

### 4.2 — Clean up
- Remove any dead code from app.js
- Ensure no duplicate function definitions
- Verify localStorage keys still work
- Test with fresh browser (no saved session)

---

## Execution Order & Dependencies

```
Phase 1 (foundation — do first):
  1.1 state.js    ← no dependencies
  1.2 modal.js    ← no dependencies
  1.3 tooltip.js  ← no dependencies

Phase 2 (panels — can parallelize):
  2.1–2.12 panels ← depend on Phase 1 being done
  Each panel is independent — can be extracted in any order

Phase 3 (slim app.js):
  ← depends on all panels being extracted

Phase 4 (verify):
  ← depends on Phase 3
```

---

## Risk Mitigation

| Risk | Mitigation |
|---|---|
| Breaking implicit global references | Search for every `_allHands`, `_meta`, `_displayBB`, `_excludedTables`, `_modalHands` reference before extracting |
| Event handler `this` context issues | Panel render functions attach handlers with explicit closures, not `this` |
| Script load order breaks | Each file only references functions defined in scripts loaded before it |
| Panels share inline state (e.g., pagination vars) | Each panel module keeps its own closure-scoped state |
| Re-render performance | `render()` already does full re-render; no regression expected |

---

## Final State

| File | Lines | Responsibility |
|---|---|---|
| `app.js` | ~150 | Orchestrator: wires everything together |
| `js/state.js` | ~40 | Centralized state management |
| `js/modal.js` | ~70 | Example hand modal system |
| `js/tooltip.js` | ~30 | Tooltip positioning |
| `js/helpers.js` | 387 | Constants & utility functions (unchanged) |
| `js/stats.js` | 345 | Analysis engine (unchanged) |
| `js/loader.js` | 94 | Page load animation (unchanged) |
| `js/panels/welcome.js` | ~120 | Welcome/overview panel |
| `js/panels/cards.js` | ~100 | Hand type breakdown |
| `js/panels/position.js` | ~80 | Position stats |
| `js/panels/street.js` | ~100 | Street action breakdown |
| `js/panels/actions.js` | ~130 | Action frequencies |
| `js/panels/bets.js` | ~80 | Bet sizing |
| `js/panels/range.js` | ~160 | Range grid heatmaps |
| `js/panels/tables.js` | ~80 | Table comparison |
| `js/panels/trends.js` | ~140 | Trend charts |
| `js/panels/log.js` | ~55 | Hand history log |
| `js/panels/players.js` | ~240 | Opponent tracking |
| `js/panels/profile.js` | ~100 | Profile & changelog |

**Result:** app.js goes from **1,951 lines → ~150 lines**. Every file has a single, clear responsibility. No build tools needed.

---

## Review Feedback

*Reviewed by: Architecture Review Agent*

### 1. Strengths

**The plan correctly identifies the core problem.** A 1,947-line `render()` function that mixes state, DOM manipulation, event wiring, data analysis, and insight generation is genuinely difficult to maintain. The monolith diagnosis is accurate.

**The per-panel file structure is sound.** Each panel has a natural boundary: it owns a DOM container, consumes stats data, and produces HTML. This is a clean decomposition axis that matches the existing tab-based UI.

**The consistent render function signature (`renderXxx(container, stats, hands, meta)`) is a good convention.** It makes each panel testable in isolation and documents the data contract explicitly.

**Identifying `_displayBB` as a hidden global coupling risk is correct.** The plan acknowledges this in the risk table, which is important because `fmtBB()` in `helpers.js` reads `_displayBB` directly.

**The script load order in the plan is correct in principle** — services before panels, panels before orchestrator. The dependency graph is acyclic.

---

### 2. Gaps and Risks

#### 2.1 — `_displayBB` lives in helpers.js, not app.js

The plan says to centralize `_displayBB` into `js/state.js`, but `_displayBB` is declared and mutated in `helpers.js` (line 110), and `fmtBB()` reads it directly (line 124). Moving it to `state.js` means either:

- Every call to `fmtBB()` must pass `displayBB` as an argument (breaking the existing API used dozens of times), or
- `state.js` must load before `helpers.js` and `fmtBB()` must reference `State.displayBB` instead of `_displayBB`.

**The plan does not address this. It is the single hardest coupling in the codebase** because `fmtBB()` is called from nearly every panel.

#### 2.2 — `findExampleHand()` reads from `_modalHands`, set inside `render()`

`findExampleHand()` searches `_modalHands`, which is set at line 159: `_modalHands = hands;`. Multiple panels call `findExampleHand()` during their render. The modal module must expose `findExampleHand()` globally, and the orchestrator must call `State.modalHands = hands` **before** rendering any panel.

#### 2.3 — `insWithExample()` in helpers.js uses `setTimeout` to wire click handlers

`insWithExample()` calls `showExampleHandModal()` which is currently defined in app.js. After refactor, it will be in `modal.js`. `helpers.js` loads **before** `modal.js` in the script order. This works with global functions (resolved at call time, not load time), but the plan should explicitly note this runtime dependency.

#### 2.4 — The Tables panel has bidirectional coupling with app.js state

The Tables panel is the most complex extraction. It:
1. Reads `_allHands` directly (not the filtered set) to build table groups
2. Mutates `_excludedTables` directly
3. After re-render, manually switches back to the tables tab
4. Populates the **header's** `table-filter` dropdown, which is outside `#p-tables`

Passing a `() => render()` callback is insufficient. The panel needs the full unfiltered hands, the exclusion set, and the table filter dropdown element. This is significantly more complex than the plan's 80-line estimate.

#### 2.5 — BB toggle handler also triggers a full re-render

The BB toggle click handler filters hands (reading `_allHands`, `_excludedTables`, and the table-filter dropdown), calls `analyse()`, then calls `render()`. This duplicates filtering logic in the table exclude handler and the table-filter `onchange` handler. The plan does not identify this duplication.

#### 2.6 — `render()` re-wires event handlers on every call

Event handlers set in `render()` close over the current `hands` and `d` variables. After extraction, panels that wire handlers closing over render-scoped data will need that data passed explicitly or stored in module scope.

#### 2.7 — Profile panel references `CHANGELOG` and `tagColors` which may be undefined

These variables are referenced but do not appear in tracked source files. They may be in uncommitted changes. The plan does not mention them as dependencies for `profile.js`.

#### 2.8 — Range and Tables panels call `analyse()` internally

Range calls `analyse()` per position filter. Tables calls `analyse()` per table group. Trends calls `analyse()` per session day. These panels are not pure renderers — they perform computation. The plan should note that `analyse` must remain globally accessible.

#### 2.9 — Log panel pagination resets on every render (existing bug)

The current implementation creates the `logPage` closure inside `render()`, meaning every re-render resets pagination to page 0. Extraction could fix this by keeping `logPage` in module scope, but the plan should call this out as a behavioral change.

#### 2.10 — Players panel has nested sub-routing

Players contains `renderPlayerList()` and `renderPlayerHands()` which is a sub-view with its own pagination. `renderPlayerHands()` closes over `oppMap` and `hands` from the outer IIFE scope. The 240-line estimate is accurate but understates the internal complexity.

---

### 3. Ordering Concerns

#### 3.1 — Phase 1.1 `getFilteredHands()` is incomplete

The actual filtering logic is more complex than shown. The BB toggle handler also applies the table-filter dropdown value. Moving one variation into `State` while leaving others in place creates inconsistency. Either centralize **all** filtering or leave it to the orchestrator.

#### 3.2 — Tooltip extraction (Phase 1.3) is low value

The tooltip system is just `positionTip()` (25 lines) plus three global event listeners. These are never referenced by panels. Extracting them buys almost nothing and should be deferred.

#### 3.3 — Tables panel should be extracted last among panels

Given the bidirectional coupling, Tables is the riskiest extraction. Extract it after all other panels.

#### 3.4 — `process()` and input handlers are unaccounted orchestrator budget

Lines 1740-1811 (input processing, clipboard handling, keyboard shortcuts) are ~70 lines of entry-point wiring. The "150 lines" estimate for the final app.js is too low.

---

### 4. Alternative Approaches

#### 4.1 — Extract named functions within app.js first (recommended)

A safer intermediate step: refactor `render()` into named functions **within app.js** first (`renderWelcome()`, `renderCards()`, etc.) without moving to separate files. This is a purely structural refactor with zero risk of script-load-order bugs. Once all functions are isolated and working, moving them to separate files becomes trivial cut-and-paste. **The plan jumps straight to multi-file extraction, which conflates two concerns: code organization and module separation.**

#### 4.2 — Pass `_displayBB` as a parameter

Instead of having `fmtBB()` read a global, change its signature to `fmtBB(amount, bb, useBB)` and pass the display preference explicitly. This eliminates the most pervasive hidden coupling.

#### 4.3 — Create a single `renderAll()` entry point

Three different places duplicate the "filter hands → call analyse → call render" pattern. Consolidate into one function:

```js
function renderAll() {
    const hands = getFilteredHands();
    const d = analyse(hands);
    render(d, hands, _meta);
}
```

#### 4.4 — Consider ES modules (future)

Using `<script type="module">` with `export`/`import` works in all modern browsers without any build step. This would give proper scope isolation and eliminate global namespace pollution. Not required now, but worth noting as a next evolution.

---

### 5. Specific Technical Feedback

- **Hero strip is not a panel.** Lines 251-264 render `#hero-strip` and `#sample-note` in the dashboard header. Put it in the orchestrator or a small `js/hero.js`.
- **Table filter dropdown population is not a Tables panel concern.** It modifies a header element. Should live in the orchestrator.
- **Filter banner logic spans all panels.** Lines 1676-1685 prepend a filter banner to every panel. This cross-cutting concern should stay in the orchestrator.
- **Range panel is likely 200+ lines**, not 160 — the cell-click modal logic alone is 70 lines.
- **Duplicate script tag in plan.** The script load order lists `js/panels/position.js` twice.
- **Shared computed values** (`netPnl`, `wr`, `vpipPct`, `aggPct`) are computed at the top of `render()` and used across panels. After extraction, each panel must recompute or receive these.

---

### 6. Recommendations (Prioritized)

1. **Add an intermediate step:** Extract named functions within app.js before splitting to files. Test. Then move to files. This halves the risk.
2. **Address `_displayBB` coupling explicitly.** Either change `fmtBB()` to accept a display flag, or document that it stays as a global in `helpers.js`.
3. **Consolidate the filter-and-rerender pattern** into a single `renderAll()` function before extracting panels.
4. **Extract the hero strip** as a separate concern — it is not a panel.
5. **Move table filter dropdown population** out of the Tables panel into the orchestrator.
6. **Revise line count estimates upward.** Range → ~220, Tables → ~130, final app.js → ~200-250.
7. **Fix the duplicate `position.js` script tag** in the proposed load order.
8. **Add `CHANGELOG` and `tagColors`** to the Profile panel dependency list.
9. **Extract Tables panel last** among all panels due to state coupling.
10. **Defer tooltip extraction** — 30 lines with zero panel coupling is not worth a separate file.
