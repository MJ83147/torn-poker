# Torn Poker Refactoring Analysis

**Total codebase: ~8,500 lines across 22 source files**

---

## Agent 1 (Analyst) — Refactoring Proposals

### 1. Chart.js Configuration Duplication (~150 lines saveable)

**Files affected:** showdown.js (433), trends.js (239), position.js (202), street.js (198)

**Problem:** Every Chart.js chart repeats the same tooltip config, scale config, font families, and color lookups. The tooltip block alone (`backgroundColor: 'rgba(20,20,28,0.95)'`, `titleColor`, `bodyColor`, `borderColor`, `borderWidth`, `titleFont`, `bodyFont`, `padding`) is copy-pasted 6+ times across 4 files.

**Proposal:** Create a `chartDefaults()` helper in helpers.js that returns a base config object. Each chart merges its specific overrides.

```js
function chartDefaults(overrides) {
  var s = getComputedStyle(document.documentElement);
  var base = {
    responsive: true, maintainAspectRatio: true, aspectRatio: 2.8,
    plugins: { tooltip: { /* shared config */ }, legend: { /* shared */ } },
    scales: { x: { /* shared */ }, y: { /* shared */ } }
  };
  // deep merge overrides
  return mergeDeep(base, overrides);
}
```

**Estimated saving:** ~150 lines
**Risk:** Low. Pure config extraction, no logic changes.

---

### 2. Saved Hand Card Rendering Duplication (~50 lines saveable)

**Files affected:** log.js (214), saved.js (81)

**Problem:** `renderSavedSection()` in log.js and `renderSavedHands()` in saved.js contain nearly identical card-rendering loops — same HTML structure for `.saved-card`, same note preview, same date formatting, same unsave button wiring.

**Proposal:** Extract a shared `renderSavedCardList(keys, map)` that returns the HTML, and a `wireSavedCardEvents(container, map, onRemove)` for event binding.

**Estimated saving:** ~50 lines
**Risk:** Low. Both already use the same helpers (getActsSummary, renderResult).

---

### 3. Hand List Modal Duplication (~40 lines saveable)

**Files affected:** helpers.js:400-450 (showExampleHandListModal), range.js:180-220

**Problem:** `showExampleHandListModal()` in helpers.js and the range cell click handler in range.js both create modal overlays with nearly identical structure: create overlay, create box, render hand rows with `.range-hand-row`, wire click-to-open-detail.

**Proposal:** Have range.js call `showExampleHandListModal()` with the appropriate title and hands, instead of building its own modal from scratch.

**Estimated saving:** ~40 lines
**Risk:** Very low. The range modal adds a subtitle with dealt/played stats — easy to support via an options parameter.

---

### 4. Opponent Action Parsing Duplication (~30 lines saveable)

**Files affected:** players.js (658)

**Problem:** `computeOpponentStats()` and `findInsightExamples()` both iterate hands, parse actions, filter by playerName, and check the same conditions (raisedPre, calledPre, seenPostFlop, foldedPostFlop, showdown detection). The hand-scanning loop pattern is duplicated between lines 28-142 and 285-393.

**Proposal:** Extract a per-hand summary function: `summarizePlayerHand(hand, playerName)` that returns `{ raisedPre, calledPre, limpedPre, seenPostFlop, foldedPostFlop, hasShowdown, raiseCount, callCheckCount, ... }`. Both functions consume this summary.

**Estimated saving:** ~30 lines
**Risk:** Low. Both functions already compute the same flags.

---

### 5. Showdown Detection Duplication (~15 lines saveable)

**Files affected:** helpers.js:650 (isShowdown), showdown.js:47-57, players.js:99-121

**Problem:** Showdown detection (checking for ` reveals ` in action lines) appears 3 times:
- `isShowdown()` in helpers.js
- Inline in showdown.js line 16 (`isCashHand` + `sorted[i].outcome`)
- `computeOpponentStats()` in players.js lines 99-104

**Proposal:** Ensure all consumers use the `isShowdown()` helper from helpers.js.

**Estimated saving:** ~15 lines
**Risk:** Very low.

---

### 6. Strength Classification Duplication (~15 lines saveable)

**Files affected:** players.js:124-141 and players.js:378-392

**Problem:** The "is this a strong reveal?" check — looking for 'two pair', 'three of a kind', 'straight', 'flush', etc. in the reveal parenthetical — is duplicated verbatim in `computeOpponentStats()` and `findInsightExamples()`.

**Proposal:** Extract `isStrongReveal(strengthString)` into helpers.js.

**Estimated saving:** ~15 lines
**Risk:** Very low. Pure string check.

---

### 7. `fmt()` / `fmtDollar()` Duplication (~10 lines saveable)

**Files affected:** helpers.js:272 (fmt), equity.js:365 (fmtDollar)

**Problem:** `fmtDollar()` in equity.js does the same thing as `fmt()` in helpers.js but without negative number handling. Since equity.js only formats positive amounts, this works, but it's unnecessary duplication.

**Proposal:** Delete `fmtDollar()` from equity.js, use `fmt()` everywhere.

**Estimated saving:** ~10 lines
**Risk:** Very low. `fmt()` already handles the same formatting.

---

### 8. CSS: styles.css at 2,270 lines

**Files affected:** styles.css (2270), mobile-styles.css (365)

**Problem:** styles.css is the largest file in the project. It contains panel-specific styles mixed together. Not a code duplication issue per se, but it makes maintenance harder.

**Proposal:** NOT recommending splitting into per-panel CSS files — the build system concatenates JS but not CSS, and adding a CSS build step adds complexity. Instead, just ensure consistent section comments exist (they already largely do). **No action needed.**

**Estimated saving:** 0 lines (organizational only)
**Risk:** N/A

---

### 9. Insight Pattern in Panel Files

**Files affected:** All panel files (actions.js, cards.js, position.js, street.js, bets.js, showdown.js, tables.js, trends.js)

**Problem:** Each panel follows the pattern: compute data, build HTML string, generate insights array, render. The insight generation is very panel-specific (poker domain logic), so abstracting the pattern further would lose clarity.

**Proposal:** **No action needed.** The current pattern is consistent and readable. The `ins()`, `insWithExample()`, `renderInsights()` helpers already reduce the boilerplate. Further abstraction would obscure the poker-specific logic.

**Estimated saving:** 0
**Risk:** N/A

---

## Summary Table

| # | Refactoring | Lines Saved | Risk | Priority |
|---|-------------|-------------|------|----------|
| 1 | Chart.js config extraction | ~150 | Low | High |
| 2 | Saved card rendering dedup | ~50 | Low | Medium |
| 3 | Hand list modal reuse | ~40 | Very Low | Medium |
| 4 | Opponent action parsing dedup | ~30 | Low | Medium |
| 5 | Showdown detection dedup | ~15 | Very Low | Low |
| 6 | Strength classification dedup | ~15 | Very Low | Low |
| 7 | fmt/fmtDollar dedup | ~10 | Very Low | Low |
| 8 | CSS organization | 0 | N/A | Skip |
| 9 | Insight pattern abstraction | 0 | N/A | Skip |

**Total estimated reduction: ~310 lines (~3.6% of codebase)**

---

## Agent 2 (Reviewer) — Response

### General Assessment

Agent 1's analysis is methodical and well-structured. The proposals are correctly prioritized by impact, and the two "no action" recommendations (CSS organization, insight pattern abstraction) show good judgment. However, several line-savings estimates are overstated, one proposal understates complexity, and Agent 1 missed a few genuine opportunities. I will go proposal-by-proposal, then add what was missed.

---

### Proposal 1: Chart.js Configuration Duplication — AGREE, but savings overstated

**Verdict: Agree with approach, revise estimate down to ~100 lines.**

I verified the duplication by counting occurrences across the 4 chart files:

- `backgroundColor: 'rgba(20,20,28,0.95)'` appears 5 times across position.js, showdown.js (x2), street.js, trends.js
- `family: 'IBM Plex Mono'` appears 24 times across those 4 files (5 in position.js, 10 in showdown.js, 5 in street.js, 4 in trends.js)
- The CSS variable retrieval block (`getComputedStyle` + `getPropertyValue` for `--dim`, `--border`, `--green`, etc.) appears 4 times, totaling ~18 lines

The tooltip config block is indeed copy-pasted (7-8 lines each time, 5 occurrences = ~35 lines). The scales config is similar but not identical: street.js uses `stacked: true`, showdown.js line chart uses a zero-line highlight function, position.js uses percentage ticks. These differences mean a `chartDefaults()` function needs a non-trivial deep-merge strategy.

Agent 1's proposed `mergeDeep` is hand-wavy. This codebase uses no utility library, so we would need to either write a `mergeDeep` (~15 lines) or use a simpler pattern of overwriting specific nested keys. I recommend the latter: return a base config and let callers mutate specific properties. That avoids introducing a fragile deep-merge utility.

Realistic saving after accounting for the helper function itself and the merge overhead: **~100 lines**, not 150.

Also worth noting: the CSS variable retrieval block (lines like `var dimColor = styles.getPropertyValue('--dim').trim() || '#666'`) should be extracted into a `chartColors()` helper returning `{ dim, border, green, gold, amber, red }`. That alone saves ~18 lines and eliminates the inconsistency where showdown.js only reads 3 variables while street.js reads 6. Each chart file would call `var c = chartColors();` once.

**Risk assessment: Agree, low risk**, but I would note that the custom tooltip `callbacks` in each chart are all different — those must remain per-chart. The helper should NOT try to abstract callbacks.

---

### Proposal 2: Saved Hand Card Rendering Duplication — AGREE, savings accurate

**Verdict: Agree, ~50 lines is realistic.**

I confirmed line-by-line: log.js lines 124-153 and saved.js lines 26-55 are nearly character-for-character identical. The HTML structure (`.saved-card`, `.saved-card-top`, `.saved-card-hole`, `.saved-card-meta`, `.saved-card-board`, `.saved-card-acts`, `.saved-card-note-wrap`, `.saved-card-date`) is the same. The event wiring in log.js `wireSavedSection()` (lines 174-192) and saved.js (lines 61-80) follow the same pattern with the same `showExampleHandModal` call.

The only differences: (a) saved.js adds a header with count and description text, (b) log.js wraps in a collapsible `.saved-section` container. These are easily handled by the caller after receiving the rendered card list HTML.

One caution: `renderSavedHands` in saved.js (line 3) is a standalone panel renderer receiving `container` as parameter, while `renderSavedSection` in log.js (line 104) returns an HTML string. The shared function should return HTML (like `renderSavedSection` does), and saved.js adapts to use that pattern.

**Risk: Agree, low.** Both already rely on `getStarredHands()`, `getActsSummary()`, and `renderResult()`.

---

### Proposal 3: Hand List Modal Reuse — AGREE, savings slightly overstated

**Verdict: Agree, but ~30 lines is more realistic than ~40.**

I compared `showExampleHandListModal()` in helpers.js (lines 400-450) with the range cell click handler in range.js (lines 181-221). The overlap is real: both create `#example-hand-modal` overlay, create `.modal-box`, render `.range-hand-row` elements, and wire click-to-open-detail.

However, range.js adds:
- A `modal-subtitle` with dealt/played/win-rate stats (line 193-195)
- A different title format (just the key name like "AKs" vs a descriptive title)

These are minor and easily supported via an options parameter as Agent 1 suggests. But the range.js handler is only ~40 lines total, and about 10 of those are range-specific data lookups (lines 173-179) that would remain. So the actual saving from reusing `showExampleHandListModal()` is closer to **~30 lines**.

**Risk: Agree, very low.**

---

### Proposal 4: Opponent Action Parsing Dedup — AGREE, but underestimated complexity

**Verdict: Agree with the concept, but risk should be Medium, not Low.**

I verified the duplication. `computeOpponentStats()` (players.js lines 28-142) and `findInsightExamples()` (lines 285-393) both:
- Call `parseActions(h.actions)` and filter by `playerName`
- Compute `raisedPre`, `calledPre`, `limpedPre`, `seenPostFlop`, `foldedPostFlop`
- Check for showdown via `' reveals '` in raw action lines
- Check strength classification via the parenthetical match

The proposed `summarizePlayerHand()` function would work, but there is a subtlety Agent 1 missed: `findInsightExamples()` also computes `raiseCount` and `callCheckCount` (lines 297, 308-309) for the aggressive/passive bucketing, which `computeOpponentStats()` does not compute the same way (it uses `totalRaises`/`totalCalls` across ALL hands, not per-hand). So the summary object needs to be carefully designed to serve both consumers without breaking the per-hand vs aggregate distinction.

Also, `findInsightExamples()` has an early-exit optimization (`allFull()` on line 286) that iterates hands in reverse. A naive `summarizePlayerHand()` extraction could lose that optimization if callers still need the early-exit logic.

**Risk: Medium.** The logic is intertwined with opponent profiling, which is the most complex feature in the app. Test carefully.

---

### Proposal 5: Showdown Detection Dedup — PARTIALLY DISAGREE

**Verdict: The duplication claim is overstated. Only players.js lines 99-104 is a real duplicate.**

Agent 1 claims three duplications:
1. `isShowdown()` in helpers.js (lines 650-662) — the canonical version
2. "Inline in showdown.js line 16" — Agent 1 references `isCashHand` + `sorted[i].outcome`. But looking at showdown.js line 46, it actually calls `isShowdown(h)` already! There is no duplication here. Agent 1 was wrong about this one.
3. `computeOpponentStats()` in players.js lines 99-104 — this IS a genuine duplicate. It manually scans `h.actions` for `' reveals '` instead of calling `isShowdown(h)`.

However, there is a reason the players.js version exists: `isShowdown()` in helpers.js checks `hand.outcome.result === 'lost'` as a shortcut (line 653), which is specific to the hero's perspective. In `computeOpponentStats()`, we are analyzing whether any player revealed, not whether the hero lost. The `' reveals '` scan is actually the correct general-purpose check. So `isShowdown(h)` is NOT a drop-in replacement here.

That said, a small refactor to make `isShowdown()` usable for both contexts (or extracting just the reveals-scan part) could save ~5 lines, not 15.

**Risk: Very low, but the saving is ~5 lines, not ~15.**

---

### Proposal 6: Strength Classification Dedup — AGREE

**Verdict: Agree, ~15 lines is accurate.**

Confirmed: players.js lines 131-138 and lines 384-389 contain the exact same `strength.indexOf('two pair') !== -1 || strength.indexOf('three of a kind') !== -1 || ...` chain. An `isStrongReveal(strengthStr)` helper is a clean extraction.

One minor suggestion: place it in helpers.js near `isShowdown()` since they are conceptually related (both deal with showdown/reveal parsing).

**Risk: Very low. Agree.**

---

### Proposal 7: fmt/fmtDollar Dedup — AGREE

**Verdict: Agree, ~10 lines, very low risk.**

Confirmed: `fmtDollar()` in equity.js (lines 365-370) is a strict subset of `fmt()` in helpers.js (lines 272-281). The only difference is `fmt()` handles negative numbers. Since equity only formats positive pot/bet amounts, `fmt()` is a drop-in replacement.

Grep shows `fmtDollar` is only used within equity.js itself, so the change is contained.

**Risk: Very low. Agree.**

---

### Proposal 8: CSS — AGREE (no action)

**Verdict: Agree, skip.**

---

### Proposal 9: Insight Pattern — AGREE (no action)

**Verdict: Agree, skip.** The current `ins()` / `insWithExample()` / `renderInsights()` pattern is already well-factored. Pushing further would hurt readability.

---

### Missed Opportunities

Agent 1 missed the following refactoring targets:

#### M1. CSS Variable Retrieval Block (~18 lines saveable)

Partially covered under Proposal 1, but worth calling out separately. The 4-6 line block of `styles.getPropertyValue('--dim').trim() || '#666'` repeated in every chart file should become a `chartColors()` function in helpers.js returning a plain object. This is independent of the Chart.js config extraction and could be done first as a simpler prerequisite step.

**Estimated saving:** ~18 lines across 4 files
**Risk:** Very low

#### M2. Note Preview HTML Escaping (~4 lines saveable, but a correctness win)

The pattern `entry.note.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, ' ')` appears in log.js line 134, saved.js line 36, and a variation in modal.js line 56. A tiny `escHtml(str)` helper would eliminate the duplication AND reduce the chance of forgetting to escape in a future template.

**Estimated saving:** ~4 lines
**Risk:** Very low

#### M3. Chart Destruction Boilerplate (~6 lines saveable)

Every chart file starts with the same pattern:
```
var _someChart = null;
// in render function:
if (_someChart) { _someChart.destroy(); _someChart = null; }
```
This appears in showdown.js (x2 charts), trends.js (array variant), position.js, and street.js. A `destroyChart(ref)` or a chart registry pattern could reduce this, though the savings are minor. **Low priority.**

#### M4. Sorted Hands Preamble

Several panel render functions start with `var sorted = hands.slice().sort(function(a,b) { return (a.timestamp||0) - (b.timestamp||0); })`. This appears in showdown.js line 11, trends.js line 15, and variations elsewhere. A `sortByTime(hands)` helper would save a few lines and prevent inconsistency. **Low priority, ~4 lines.**

---

### Revised Summary Table

| # | Refactoring | Agent 1 Est. | Revised Est. | Risk | Priority |
|---|-------------|-------------|-------------|------|----------|
| 1 | Chart.js config extraction (incl. M1 chartColors) | ~150 | ~100+18 = ~118 | Low | **High** |
| 2 | Saved card rendering dedup | ~50 | ~50 | Low | Medium |
| 3 | Hand list modal reuse | ~40 | ~30 | Very Low | Medium |
| 4 | Opponent action parsing dedup | ~30 | ~30 | **Medium** | Medium |
| 5 | Showdown detection dedup | ~15 | **~5** | Very Low | Low |
| 6 | Strength classification dedup | ~15 | ~15 | Very Low | Low |
| 7 | fmt/fmtDollar dedup | ~10 | ~10 | Very Low | Low |
| M2 | HTML escaping helper | — | ~4 | Very Low | Low |
| M3 | Chart destruction boilerplate | — | ~6 | Very Low | Low |
| M4 | sortByTime helper | — | ~4 | Very Low | Low |

**Revised total: ~272 lines (~3.2% of codebase)**

Agent 1's original estimate of ~310 was slightly optimistic. The real number is closer to ~272, primarily because the Chart.js extraction is ~118 not ~150, the modal reuse is ~30 not ~40, and showdown detection is ~5 not ~15.

---

## Agreed Action Plan

Based on the joint analysis, here is the final prioritized implementation plan. Items are grouped into phases to minimize risk and maximize testability.

### Phase 1: Quick Wins (Very Low Risk, ~34 lines)
*These can be done in a single commit, each is self-contained.*

1. **Extract `isStrongReveal(strengthStr)` into helpers.js** (Proposal 6, ~15 lines)
   - Pull the strength-check chain from players.js lines 131-138 and 384-389 into a shared helper
   - Both call sites become one-liners

2. **Delete `fmtDollar()` from equity.js, use `fmt()` everywhere** (Proposal 7, ~10 lines)
   - Find all `fmtDollar(` calls in equity.js, replace with `fmt(`
   - Delete the function definition at equity.js lines 365-370

3. **Replace inline showdown detection in players.js with `isShowdown()` or extract a `hasReveals(hand)` helper** (Proposal 5, ~5 lines)
   - players.js lines 99-104 and 367-371 can use a shared reveals check
   - Note: cannot use `isShowdown()` directly due to hero-perspective logic; extract the reveals scan into a small helper like `handHasReveals(hand)`

4. **Extract `escHtml(str)` helper** (M2, ~4 lines)
   - Used by log.js, saved.js, and modal.js for note preview escaping

### Phase 2: Chart Config Extraction (~118 lines, Low Risk)
*Largest single saving. Do as its own commit.*

5. **Extract `chartColors()` into helpers.js** (M1, ~18 lines)
   - Returns `{ dim, border, green, gold, amber, red }` from CSS variables
   - Replace the 4 identical blocks in showdown.js, trends.js, position.js, street.js

6. **Extract `chartDefaults(type, overrides)` into helpers.js** (Proposal 1, ~100 lines)
   - Returns base config with shared tooltip styling, font, scale defaults
   - Each chart file calls `chartDefaults('line', { ... })` or `chartDefaults('bar', { ... })`
   - Do NOT abstract tooltip callbacks — keep those per-chart
   - Use simple property assignment for overrides, NOT deep merge

### Phase 3: Template Dedup (~80 lines, Low Risk)
*Reduces HTML rendering duplication.*

7. **Extract `renderSavedCardList(keys, map)` and `wireSavedCardEvents(container, map, onRemove)`** (Proposal 2, ~50 lines)
   - Shared by log.js `renderSavedSection()` and saved.js `renderSavedHands()`
   - saved.js becomes a thin wrapper that adds its header/empty-state

8. **Have range.js call `showExampleHandListModal()` with subtitle option** (Proposal 3, ~30 lines)
   - Add optional `subtitle` parameter to `showExampleHandListModal()`
   - range.js click handler passes title, hands, and subtitle with dealt/played stats

### Phase 4: Logic Dedup (~30 lines, Medium Risk)
*Most complex, do last and test thoroughly.*

9. **Extract `summarizePlayerHand(hand, playerName)` in players.js** (Proposal 4, ~30 lines)
   - Returns `{ raisedPre, calledPre, limpedPre, seenPostFlop, foldedPostFlop, raiseCount, callCheckCount, hasReveals, revealStrength }`
   - `computeOpponentStats()` and `findInsightExamples()` both consume this
   - Preserve `findInsightExamples()`'s reverse iteration and early-exit optimization

### Not Doing
- CSS reorganization (Proposal 8) — no benefit for a single-file build
- Insight pattern abstraction (Proposal 9) — already well-factored
- Chart destruction boilerplate (M3) — too minor for the abstraction cost
- sortByTime helper (M4) — too minor, only 2-3 call sites
