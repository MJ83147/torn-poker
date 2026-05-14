# Files to Change

Categorised list of files that move when the new structure lands. One line per file. Paths are repo-relative.

The shape: every section's stories share a structure (opening statement → pillars → branches → impact → so-what). So we build **one story engine** that consumes data-driven section configs, instead of writing one file per named story.

Stack depth is **not** in our raw data. Anywhere the spec calls for it, we drop the dimension or skip the pillar.

---

## Add (new files)

### DAU layer
- `js/dau/build.js` — emit one DAU per decision point per player per street; walk the `actions` array, track running pot. No stack depth.
- `js/dau/index.js` — public surface (build, query, filter helpers).

### Story engine and section configs
- `js/insights/story-engine.js` — the runner. Takes a story config (pillars, branches, P&L slices, impact and so-what templates) and produces a finding. Generalises the four-clause composer in [js/insights/framework.js](../js/insights/framework.js) into a full interrogation tree, so each section needs only a config file, not one file per story.
- `js/insights/sections/range.js` — Width of Range, Winning Hands as configs.
- `js/insights/sections/cards.js` — six hand-class stories (Premium / Strong / Marginal made hands, Strong / Weak draws, Air or Overcards).
- `js/insights/sections/bets.js` — Bet Sizing Shape, Value vs Bluff Sizing, Response to Sizing.
- `js/insights/sections/streets.js` — c-bet, fold-to-cbet, 3-bet, fold-to-3bet (target-based) plus check-fold, donk bet, delay c-bet (directional).
- `js/insights/sections/position.js` — nine seat stories (UTG, UTG+1, MP, LJ, HJ, CO, BTN, SB, BB). All nine share the pillar-and-P&L-gate structure; they differ only in target bands and pillar names.
- `js/insights/sections/players.js` — five playstyle stories (vs TAG, LAG, Nit, Station, Maniac) plus Profitable and Unprofitable Opponents.
- `js/insights/sections/tables.js` — Table Selection, Time at Table.
- `js/insights/sections/showdown.js` — Going to Showdown, Winning at Showdown, Showdown vs Non-Showdown Winnings.
- `js/insights/sections/allin.js` — placeholder for All-in EV (spec lists the section but does not detail its stories).
- `js/insights/sections/trends.js` — Direction of Travel, Session Swings.
- `js/insights/sections/mygame.js` — cross-section roll-up: Top Strengths, Top Weaknesses, Play Style summary (absorbs the styleMap content).

### Shared helpers
- `js/helpers/target-bands.js` — context-aware bands keyed by metric × position × seat count.
- `js/helpers/pnl-slice.js` — comparator-based P&L slice helper for leak / monitor / play-problem / silent gating.

### Tests
- Extend [js/insights/test/test.html](../js/insights/test/test.html) with fixtures exercising each section's stories across the four states.

---

## Edit (existing files that need reshaping)

### Data and metrics layer
- [js/helpers/hand-parsing.js](../js/helpers/hand-parsing.js) — extend `parseActions` to produce per-decision records with `pot_size`. No stack depth.
- [js/helpers/analysis.js](../js/helpers/analysis.js) — `analyse()` and `bucketizeAnalysis()` consume DAUs; expose metric tables that the story engine can filter without re-walking hands.
- [js/helpers/context.js](../js/helpers/context.js) — add supporting-insight context filters (e.g. "BB hands only" for cross-section pulls).
- [js/helpers/opponent-stats.js](../js/helpers/opponent-stats.js) — surface the 50+ hand threshold for playstyle classification and 30+ for specific-opponent stories.
- [js/helpers/opponent-profile.js](../js/helpers/opponent-profile.js) — align with TAG / LAG / Nit / Station / Maniac thresholds in spec §14.
- [js/helpers/opponent-examples.js](../js/helpers/opponent-examples.js) — feed Profitable / Unprofitable Opponents stories.
- [js/helpers/tables.js](../js/helpers/tables.js) — table-level P&L roll-up for the Tables section.
- [js/stats.js](../js/stats.js) — reconcile with `analysis.js`; deduplicate aggregation logic.

### Insights framework
- [js/insights/framework.js](../js/insights/framework.js) — keep the severity classifier, gates, and four-clause composer; expose them for the new story engine to call. The current `defineStory` becomes the simple-story path (one measurement, one band); complex interrogations go through `story-engine.js`.
- [js/insights/panels-config.js](../js/insights/panels-config.js) — reconcile panel names with the ten spec sections; replace the existing story-ID list with the section configs. Move `play-style` into MyGame (styleMap folds in).

### Existing story prototypes (overlap with section configs; retire)
- [js/insights/stories/hand-selection.js](../js/insights/stories/hand-selection.js) — folds into `sections/range.js`.
- [js/insights/stories/preflop-initiative.js](../js/insights/stories/preflop-initiative.js) — folds into `sections/streets.js` and `sections/bets.js`.
- [js/insights/stories/postflop-aggression-with-initiative.js](../js/insights/stories/postflop-aggression-with-initiative.js) — folds into `sections/streets.js`.
- [js/insights/stories/postflop-defence.js](../js/insights/stories/postflop-defence.js) — folds into `sections/streets.js`.
- [js/insights/stories/aggression-style.js](../js/insights/stories/aggression-style.js) — folds into `sections/bets.js`.

### Panels (render section findings, not legacy cards)
- [js/panels/range.js](../js/panels/range.js)
- [js/panels/cards.js](../js/panels/cards.js)
- [js/panels/street.js](../js/panels/street.js)
- [js/panels/position.js](../js/panels/position.js)
- [js/panels/players.js](../js/panels/players.js)
- [js/panels/tables.js](../js/panels/tables.js)
- [js/panels/showdown.js](../js/panels/showdown.js)
- [js/panels/allin.js](../js/panels/allin.js)
- [js/panels/trends.js](../js/panels/trends.js)
- [js/panels/actions.js](../js/panels/actions.js) — folds across Streets and Bets sections.
- [js/panels/compare.js](../js/panels/compare.js) — reconcile with section model.
- [js/panels/mygame.js](../js/panels/mygame.js) — absorbs styleMap content; renders Top Strengths / Top Weaknesses / Play Style from `sections/mygame.js`.
- [js/panels/welcome.js](../js/panels/welcome.js) — table of contents updated to the ten sections.
- [js/panels/log.js](../js/panels/log.js) — no logic change but consumes DAUs for hand replay.

### App scaffolding
- [index.html](../index.html) — drop the standalone styleMap tab; reconcile remaining tabs to the ten sections.
- [app.js](../app.js) — render orchestrator routes section findings through the new engine.
- [build.js](../build.js) — include new files in the bundle order; drop styleMap.

### Engine (legacy pipeline being replaced)
- [js/engine/engine.js](../js/engine/engine.js) — narrow to an adapter or retire.
- [js/engine/rules.js](../js/engine/rules.js) — retire as sections take over.
- [js/engine/ruleset.js](../js/engine/ruleset.js) — retire.
- [js/engine/verdict.js](../js/engine/verdict.js) — fold target-band logic into `target-bands.js`.
- [js/engine/narrative.js](../js/engine/narrative.js) — retire; story so-what replaces contradiction / chain prose.
- [js/engine/patterns.js](../js/engine/patterns.js) — fold into Trends Direction-of-Travel.
- [js/engine/styleDetector.js](../js/engine/styleDetector.js) — fold into `sections/mygame.js` and `sections/players.js`.
- [js/engine/panelOverview.js](../js/engine/panelOverview.js) — fold into `sections/mygame.js`.
- [js/engine/matrix.js](../js/engine/matrix.js) — fold lookup into `target-bands.js`.

### Misc
- [claude.md](../claude.md) — note the new framework rules.
- [misc/CONTRIBUTING.md](../misc/CONTRIBUTING.md) — replace "adding a tab" as the primary extension point with "adding a story to a section config".
- [version.json](../version.json) — bump on release.

---

## Delete (or retire once covered)

- [js/panels/styleMap.js](../js/panels/styleMap.js) — content absorbed by `mygame.js` and `sections/mygame.js`.
- The five existing prototypes in `js/insights/stories/` once their section configs ship.
- Legacy engine files (`rules.js`, `ruleset.js`, `narrative.js`) once every section has shipped.

Nothing is hard-deleted up front. Retire in lockstep with the section that subsumes it.

---

## Out of scope

- [js/state.js](../js/state.js) — IndexedDB persistence.
- [js/loader.js](../js/loader.js) — file ingest.
- [js/modal.js](../js/modal.js) — example hand replay modal.
- [js/equity.js](../js/equity.js), [js/equity-monte-carlo.js](../js/equity-monte-carlo.js), [js/equity-guidance.js](../js/equity-guidance.js) — equity simulation.
- [js/charting.js](../js/charting.js) — chart rendering.
- [js/tour.js](../js/tour.js) — onboarding tour (only updated when section names change).
- [js/hand-evaluator.js](../js/hand-evaluator.js) — reused as-is for hand strength in the Cards section.
- [js/ui-bindings.js](../js/ui-bindings.js) — DOM bindings.
- [js/helpers/storage.js](../js/helpers/storage.js), [js/helpers/css-classes.js](../js/helpers/css-classes.js), [js/helpers/ui.js](../js/helpers/ui.js), [js/helpers/format.js](../js/helpers/format.js), [js/helpers/cards.js](../js/helpers/cards.js), [js/helpers/migration.js](../js/helpers/migration.js), [js/helpers/panel-shared.js](../js/helpers/panel-shared.js) — utility scaffolding.
- [styles.css](../styles.css), [mobile-styles.css](../mobile-styles.css) — styling.
