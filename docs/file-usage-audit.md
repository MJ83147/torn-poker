# File usage audit

Snapshot of which files in the repo are actually used by the deployed site, and which are not. The deployed site is `index.html` + `app.min.js` (bundled by `build.js`) + `styles.css` + `mobile-styles.css` + `favicon.png`. GitHub Pages serves the repo root.

## Used

### Bundled into `app.min.js` by `build.js`

The build manifest in `build.js` concatenates these in this order, then minifies via esbuild. All files listed below are on disk and accounted for.

Helpers (manual order):

- `js/helpers/css-classes.js`
- `js/helpers/cards.js`
- `js/helpers/tables.js`
- `js/helpers/format.js`
- `js/helpers/hand-parsing.js`
- `js/helpers/analysis.js`
- `js/helpers/sessions.js`
- `js/helpers/storage.js`
- `js/helpers/ui.js`
- `js/helpers/migration.js`
- `js/helpers/panel-shared.js`
- `js/helpers/opponent-stats.js`
- `js/helpers/opponent-examples.js`
- `js/helpers/opponent-profile.js`
- `js/helpers/context.js`
- `js/helpers/target-bands.js`
- `js/helpers/pnl-slice.js`

Engine (manual order):

- `js/engine/matrix.js`
- `js/engine/styleDetector.js`
- `js/engine/verdict.js`
- `js/engine/rules.js`
- `js/engine/panelOverview.js`
- `js/engine/patterns.js`
- `js/engine/narrative.js`
- `js/engine/engine.js`
- `js/engine/ruleset.js`

Insights framework + sections (manual order):

- `js/insights/framework.js`
- `js/insights/panels-config.js`
- `js/insights/story-engine.js`
- `js/insights/sections/range.js`
- `js/insights/sections/position.js`
- `js/insights/sections/showdown.js`
- `js/insights/sections/tables.js`
- `js/insights/sections/trends.js`
- `js/insights/sections/streets.js`
- `js/insights/sections/players.js`
- `js/insights/sections/bets.js`
- `js/insights/sections/allin.js`
- `js/insights/sections/cards.js`

Panels (auto-discovered from `js/panels/*.js`):

- `actions.js`, `allin.js`, `cards.js`, `compare.js`, `log.js`, `mygame.js`, `players.js`, `position.js`, `range.js`, `showdown.js`, `street.js`, `styleMap.js`, `tables.js`, `trends.js`, `welcome.js`

Note: `compare.js` and `styleMap.js` are not standalone panels in `index.html`. They are bundled but invoked elsewhere:

- `renderCompare(...)` is called from the Players panel modal ([js/panels/players.js:182](js/panels/players.js:182)).
- `renderStyleMap(...)` is embedded inside the My Game panel ([js/panels/mygame.js:161](js/panels/mygame.js:161)).

Root standalones:

- `js/stats.js`
- `js/loader.js`
- `js/state.js`
- `js/modal.js`
- `js/charting.js`
- `js/hand-evaluator.js`
- `js/equity-monte-carlo.js`
- `js/equity-guidance.js`
- `js/equity.js`
- `js/tour.js`
- `js/ui-bindings.js`
- `app.js`

### Static assets and config served by Pages

- `index.html` (linked stylesheets and `app.min.js`)
- `styles.css` (linked from `index.html`)
- `mobile-styles.css` (linked from `index.html`)
- `favicon.png` (linked from `index.html`)
- `app.min.js` (loaded by `index.html`)
- `CNAME` (GitHub Pages custom domain: `poker.systoned.cc`)

### Build and repo config

- `build.js`
- `package.json`
- `package-lock.json`
- `.gitignore`
- `claude.md` (agent instructions)

## Not used by the deployed site

### Story files: defined but never registered in production

These four files call `Insights.defineStory(...)`, but they are not in the `build.js` manifest, so they never load when `app.min.js` runs. They are only pulled in by the test harness in [js/insights/test/test.html](js/insights/test/test.html).

- [js/insights/stories/aggression-style.js](js/insights/stories/aggression-style.js)
- [js/insights/stories/postflop-aggression-with-initiative.js](js/insights/stories/postflop-aggression-with-initiative.js)
- [js/insights/stories/postflop-defence.js](js/insights/stories/postflop-defence.js)
- [js/insights/stories/preflop-initiative.js](js/insights/stories/preflop-initiative.js)

Consequence: `Insights._stories` is empty in the live app, and `Insights.evaluateStories(...)` returns nothing. Production rendering instead uses `STORIES_BY_PANEL` in [js/insights/panels-config.js](js/insights/panels-config.js) plus the Section files. The `defineStory` and `evaluateStories` API in [js/insights/framework.js](js/insights/framework.js) is therefore an unused API surface in production (still has callers in the test harness).

### Standalone test page

- [js/insights/test/test.html](js/insights/test/test.html). Loads the four story files above and calls `Insights.evaluateStories(...)`. Useful as a dev harness but not linked from the deployed site.

### Stale planning docs

These are session notes that the code does not reference. Safe to keep, archive, or delete depending on whether they are still useful as history.

- [docs/files-to-change.md](docs/files-to-change.md)
- [docs/new-structure-understanding.md](docs/new-structure-understanding.md)
- [docs/stage-5.2-plan.md](docs/stage-5.2-plan.md)
- [js/new structure.md](js/new%20structure.md) (123 KB design doc; only mentioned in a comment at [js/insights/story-engine.js:5](js/insights/story-engine.js:5))

### Orphan runtime config

- `version.json` (`{"version":"3.8","minVersion":"3.8"}`). No HTML, JS, or CSS reads this file. Likely a leftover from a removed version or update-check mechanism. Either wire it up or delete it.

### Committed junk

- `.DS_Store` (repo root)
- `js/.DS_Store`

`.DS_Store` is not in `.gitignore`. Worth adding `.DS_Store` to `.gitignore` and removing the two tracked copies.

## Code references worth noting

Not file-usage issues, but surfaced during the audit:

- [app.js:211](app.js:211) iterates over a panel id list that includes `'p-compare'`. There is no `<div id="p-compare">` in `index.html` (the Compare view is now rendered into a modal from the Players panel). `getElementById` returns null for that one entry, so the line is harmless but the id is dead.
- `Insights.defineStory` and `Insights.evaluateStories` in [js/insights/framework.js](js/insights/framework.js) have no production callers. If the stories layer is being replaced by Sections, this whole API can be retired together with the four story files and the test harness.

## Suggested follow-ups

1. Decide whether the stories layer (`js/insights/stories/*`, the test harness, and the `defineStory`/`evaluateStories` API in `framework.js`) is still planned. If yes, wire the story files into `build.js`. If no, delete them.
2. Delete `version.json` or start reading it (e.g. for a "you are on an old build, refresh" prompt).
3. Add `.DS_Store` to `.gitignore` and `git rm --cached` the two tracked copies.
4. Remove `'p-compare'` from the panel-id list at [app.js:211](app.js:211) since the element no longer exists.
5. Optional: move the planning docs in `docs/` (and `js/new structure.md`) into an archive folder or delete them if they are no longer load-bearing.
