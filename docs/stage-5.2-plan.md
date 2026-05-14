# Stage 5.2 — Range section complete

First section of the new framework shipped end to end. Engine, configs, helpers, panel render, legacy retirement, tests, build, deploy.

The point of this stage is not just Range. It's to prove the section pattern — engine + section config + target bands + P&L slice + panel render — so Stage 5.3 (Position) and everything after can copy it without re-deciding shape.

---

## Scope

Two stories, both in the Range section per spec §7:

1. **Width of Range** — VPIP across seat count, position, hand type. Target-based. Branches on aggregate vs cell divergence; introduces the band at the level context is sufficient.
2. **Winning Hands** — P&L per hand key, classified as play problem (inside range and losing), selection problem (outside range and losing), monitor (outside range and winning), or skipped (below `MIN_CELL`).

No DAU work in this stage. Both stories read the existing metrics in `posMap` and `rangeMap` from [js/helpers/analysis.js](../js/helpers/analysis.js).

---

## Files

### Add
- **`js/insights/story-engine.js`** — interrogation runner. Takes a story config of the shape:
  ```
  {
    id, name, panel, sectionId,
    minSample,
    openingStatement(d, extras),
    pillars: [
      {
        id, name,
        measure(d, extras),       // returns {value, n, cells, winRate, pnl} or null
        band(d, extras),          // optional, target-based
        strengthSide,             // 'high' | 'low' | null
        pnlSlice(d, extras),      // optional, returns {onTarget, offTarget, comparator}
        implications,             // by direction
        notes                     // directional-only commentary
      }
    ],
    impactTemplates,              // keyed by which pillars fired and how
    soWhatTemplates,              // keyed the same way
    supportingContext             // optional: filter spec for cross-section pulls
  }
  ```
  Output: a finding per pillar (leak / monitor / play problem / silent), plus one story-level finding with title + primaries + impact + so-what.
- **`js/insights/sections/range.js`** — Width of Range and Winning Hands as configs.
- **`js/helpers/target-bands.js`** — context-aware bands keyed by metric × position × seat count. Seeded with VPIP bands per spec §7.1 and §11. Lookup helper: `bandFor(metric, position, seatCount)`.
- **`js/helpers/pnl-slice.js`** — comparator-based P&L slice. Given a metric value, a band, and a P&L pair (on-target slice, off-target slice), classify as leak / monitor / play-problem / silent. Honours `MIN_CELL`.

### Edit
- **[js/insights/framework.js](../js/insights/framework.js)** — expose `classifySeverity`, `hasCellDivergence`, `worstCells`, `composeWinRateTrailer`, and the text composers as named exports the engine can call. Keep `defineStory` for the existing prototypes; the engine is the path for sections.
- **[js/insights/panels-config.js](../js/insights/panels-config.js)** — point the `Range` panel at `sections/range.js`. Drop `hand-selection` from the Range list (it's subsumed by Width of Range).
- **[js/panels/range.js](../js/panels/range.js)** — render Range findings from the engine. Keep the 13×13 hand matrix and the per-position VPIP advisor as raw-data widgets; replace the legacy insight cards with the story output.
- **[build.js](../build.js)** — add `story-engine.js`, `sections/range.js`, `target-bands.js`, `pnl-slice.js` to the bundle order. Confirm they load before `panels/range.js`.
- **[js/insights/stories/hand-selection.js](../js/insights/stories/hand-selection.js)** — remove. Width of Range covers it.

### Retire (do not delete this stage, just stop wiring)
- The Range-specific rules in [js/engine/rules.js](../js/engine/rules.js) — comment out or gate behind a flag so the legacy path doesn't produce duplicate Range cards. Full deletion lands after Stage 5.3 confirms nothing else depends on them.

### Tests
- Extend [js/insights/test/test.html](../js/insights/test/test.html) with fixtures for both stories across the five states: leak, monitor, play problem, silent, on-target. Use synthesised hand sets so the test runs without real data.

---

## Critical reads before starting

- [js/new structure.md §7](../js/new%20structure.md) — Range section spec (lines 182–254).
- [js/insights/framework.js](../js/insights/framework.js) — the four-clause composer and severity classifier the engine reuses.
- [js/helpers/analysis.js](../js/helpers/analysis.js) — `analyse()` output shape; specifically `posMap`, `rangeMap`, `htMap`, `bySeatBucket`, `byPosition`, `byPosSeat`, `mixCells`, plus the `MIN_AGGREGATE` / `MIN_AXIS` / `MIN_CELL` constants.
- [js/insights/panels-config.js](../js/insights/panels-config.js) — current panel/story map.
- [js/panels/range.js](../js/panels/range.js) — current renderer.

---

## Build order

1. Stub `story-engine.js` with the config shape and an empty `runStory(config, d, extras, hands)` that returns null. Wire it into `framework.js` exports.
2. Build `target-bands.js` with the VPIP table from spec §7.1 and §11 (one band per position × seat count). Add the `bandFor` helper.
3. Build `pnl-slice.js` with the four-state classifier. Unit test against synthesised cells.
4. Implement Width of Range in `sections/range.js`. Wire the engine to consume it and emit a finding.
5. Implement Winning Hands. Same shape.
6. Swap [js/panels/range.js](../js/panels/range.js) to render engine findings. Keep the 13×13 matrix and per-position advisor.
7. Gate the legacy Range rules in [js/engine/rules.js](../js/engine/rules.js) so they stop firing.
8. Add test fixtures, run `js/insights/test/test.html` in the browser.
9. `node build.js`. Confirm `app.min.js` includes the new files in the right order.
10. Deploy to GitHub Pages. Push to main.

---

## Verification

End to end, in the browser:

1. Load the app with a real hand set.
2. Range tab renders. The 13×13 matrix and per-position advisor still show.
3. Below them, two story findings render — Width of Range and Winning Hands — with the four-clause shape (behaviour, implication, context with target band, optional outcome gap) and a so-what sentence at the end.
4. The legacy Range insight cards no longer appear (no duplicates).
5. Test page passes the five-state fixtures for both stories.
6. Switch to a tab the legacy engine still drives (e.g. Position) and confirm nothing else broke.

If the worst-cell context clause prints garbage or the band lookup misses, fix in `target-bands.js` first, then re-check.

---

## Out of scope for this stage

- DAU layer. Not needed for Range; defer until a section requires it.
- Other section configs. Stage 5.3 picks up Position.
- Deleting `js/engine/rules.js` entries. Gate them only; deletion comes when no section depends on them.
- styleMap fold-in. That lands with Stage 5.x — My Game section.
- Touching [js/state.js](../js/state.js), equity files, charting, tour.
