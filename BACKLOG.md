# BACKLOG

Pending work for the poker app. **Read this at the start of every session and update it at the end.**
Status: `TODO` · `IN PROGRESS` · `DONE` (move done items to the bottom or delete once deployed).

---

## Open

### 1. Stacks before/after on all hands and replays — TODO
Show each player's stack **before** and **after** on every hand and in hand replays.
The tracker user script already emits per-player `startStack`/`endStack`. Hands without
that data must be treated as **unknown (excluded)**, never zero.

### 2. Range overview panel is showing "cards" charts — TODO
The range overview is rendering the wrong content (cards-style charts). Completely wrong — must
render range content.

### 3. Range story-card title/breakdown width mismatch — TODO
On the Range page, the story card ("You play 58% of hands preflop across 591 hands") has a
full-width title but a shorter breakdown below — looks off. Make widths consistent.

### 4. Section headings are far too small — TODO
Bump section heading size (via the shared font-size token, not per-panel).

### 5. Mini rows have no clear distinction — TODO
Mini rows need clearer separation between them.

### 6. Rows in general need better separation — TODO
Repeated rows/list items across panels need better visual separation (shared treatment, not per-panel).

### 7. Example-hands modal font sizes look wrong — TODO
Fix the weird/inconsistent font sizes in the example-hands modal; use the shared scale.

### 8. Range tables: wrong colours + tick/cross — TODO
Range grid should convey the range purely by cell **colour** — remove the right/wrong tick/cross marks.

### 9. Modal title should reuse the standard heading — TODO
Drop the bespoke "modal title" style; use the same heading style used elsewhere.

### 10. Remove bespoke `.modal-coaching-head` style — TODO
Replace the bespoke block below with an existing shared class:
```
.modal-coaching-head { color: var(--amber); text-transform: uppercase;
  font-size: var(--fs-xs); letter-spacing: var(--bw); margin-bottom: var(--sp-6); }
```

### 11. Too many classes on elements — TODO
Many elements stack far too many utility classes where a shared component class should be used.
Consolidate onto shared classes.

### 12. Kill ALL bespoke title/heading/label classes — TODO
There must be NO `*-title` / `*-heading` bespoke classes — the shared `.title` scale
(`.title-md/-lg/-xl`) + colour utility (`.c-gold`) already covers headings. Delete bespoke
heading rules (e.g. `.welcome-intro-heading`, `.style-welcome-headline`, `.work-on-title`,
`.cr-pop-title`, `.cr-headline*`, `.eq-sim-title`, `.header-title`, `.gold-heading`, `.paste-title`,
`.dynamics-*-head`, `.player-detail-head`, `.expand-head`, etc.) and swap markup to shared classes.
Also merge the DUPLICATE small-label classes — `.eyebrow`, `.label`, `.chart-label`, and bespoke
`*-label` one-offs all do "uppercase dim 12px label" — collapse to ONE canonical label class + colour util.
(The typography pass was too conservative about what's "genuinely unique"; it mostly isn't.)

---

## Key facts about the codebase (verified 2026-07-01)
- **One stylesheet only: `style.css`** (~2300 lines). `styles.css` was deleted (the "css2 cutover").
  `index.html` loads only `style.css`.
- Deleting `styles.css` **orphaned classes still used in markup** — they now have no CSS rule:
  `mini-row`, `player-row`, `player-detail`, `allin-row`, `hrow`, `hrow-star`, `rc-hero`,
  `draw-outs`, `board-texture-badge`, `badge-neutral`, `eq-sim-note`, `welcome-tip`,
  `saved-section`, `-compare`, `-mini-label`, `-value`, `-trio`, and others. Several
  "looks weird / no separation" bugs (items 5, 6) are these MISSING styles — restore them
  as shared classes in style.css, don't invent per-panel styles.
- Story/insight cards: classes are `.story` / `.story-head` / `.insight-title` / `.insight-body`
  (story-engine.js renderFindings). Item 3 = `.insight-title` (padding-right) vs `.insight-body`.
- Stacks data (`hand.stacks[]`, hero `startStack`/`endStack`) is ALREADY imported+stored
  (schemaVersion 2). Item 1 is display-only; treat missing as unknown/excluded, never 0.
- `app.min.js` is a BUILT bundle — never hand-edit; run `npm run build`.

## Design system — the primitives (keep it to THESE, no bespoke variants)
- **Text = 3 roles.** `body` (default 14px, `--fs-md`), `.title` (serif; sizes md/lg/xl),
  `.eyebrow` (uppercase label). Plus `.value` for big numbers. Do NOT create `*-title`,
  `*-heading`, `*-label`, or per-component font rules — compose these + a colour util.
- **One inner-row.** Define a single shared row primitive with built-in vertical margin +
  divider; drop content into it so spacing is automatic. Used for modal street rows, insight
  breakdown lines, stat rows. (TODO — item 16.)
- **Buttons look like buttons at rest** (filled/outlined), not hover-only.
- **Cards** = `.card`/`.box` padding + a `.title` + body. No `.story-head`/`.insight-title`
  special text rules (removed 2026-07-01).

### 17. Type owned only by roles — DONE (verified 0 violations)
After the token block, NOTHING sets `font-size` / `line-height` / `letter-spacing` without a
documented `/* good reason */`. Only the `:root` tokens and the role classes (`.title*`,
`.eyebrow`, `.section-head`, `.text-body`, `.text-meta`, `.text-micro`, `.lead`, `.value`) may set type.

### 18. No dangling mt/mb on text elements — DONE (verified 0; spacing via parent gap)
Inspecting the rendered site, no text element (title/body/meta/eyebrow/section-head/value/lead)
carries an `mt-*`/`mb-*` utility. Spacing comes from the primitive (title/section-head margins)
or the parent container's `gap`. ~67 offenders to clear.

### 19. Story chevron affordance — DONE (clear resting state)
The expand chevron is only clear on hover — poor UX. Give it a clear RESTING state so it
obviously reads as an expand control (same fix applied to `.example-hand-btn`).

### 20. Drop `.story-teaser` bespoke class — DONE (folded to text-body + hook)
`.story-teaser` (margin-top + padding-right + color:dim) not needed — fold to `.text-body`,
or remove the collapsed-state teaser line entirely (confirm which with user).

### 16. Shared inner-row for modal + section spacing — TODO
Modal equity-sim streets (Preflop/Flop/Turn/River) and insight breakdown lines have ad-hoc,
inconsistent margins. Define ONE inner-row class (vertical rhythm baked in) and apply it so the
text inside inherits correct spacing. Rendered in js/equity.js + js/modal.js.

## Working rules (reminders)
- Use CSS variables for colours, spacing, font sizes. No hardcoded/inline styles.
- Min font size 10px.
- Panels use **shared** CSS classes — no bespoke per-panel styles. New need → add to shared styles.
- Keep JS in separate files, CSS in stylesheets (not inline).
- Run `npm run build` after changes; commit + deploy — don't leave work uncommitted.

### 13. Consolidate duplicated app-chrome CSS — TODO
Excess in the loader/maintenance/header/tab CSS. Merge duplicates, keep structural:
- `.deal-card` (1386) ≡ `.lc` (1457) byte-identical; `.mc` (1477) same at smaller size →
  one shared `.card-face` (+ size modifier).
- Single-letter colour modifiers `.lc.r/.b`, `.mc.r/.b`, `.deal-card.red/.black`, `.hs-v.g/.r/.a/.o/.w`
  duplicate `.c-pos/.c-neg/.c-warn/.c-gold` → swap markup to `.c-*`, delete modifiers.
- `.l-eyebrow`/`.m-eyebrow` → `.eyebrow` + margin util.
- KEEP (structural): screen states (#loader/#app/#dash/.panel/#maintenance/.panels-wrap.blurred),
  .dash-header, .tab-* dropdown mechanics, .l-prog*, .eq-spinner-*, .hiw-* grids.

### 14. Strip dead range-grid colour CSS — TODO
Confirmed nothing in JS emits these — pure dead weight in style.css (~13 selectors):
- Frequency heatmap: `.rc.rc-played[data-freq=...]`, `.freq-low`, `.freq-med` (old "how often played" mode).
- Right/wrong overlay: `.rc[data-hero="ontarget"|"wrong"|"unjudged"]` (only `data-hero="none"` is emitted now).
- Likely also `.rc.rc-folded` / `.rc.rc-undealt` (not emitted — verify before deleting).
LIVE and KEEP: `.rc:hover`, all `.rc[data-gto=...]`, `.rc[data-act=...]`, `.rc[data-hero="none"]`.

## Done
- **Bugfix: My Game crash** — `renderTableDynamicsReference` (mygame.js) read `subD.posMap[p]`
  on gated seat buckets (n>0 but below MIN_AXIS → no posMap; stats.js:430), throwing
  "Cannot read ... 'BTN'". Pre-existing bug. Fixed: bail to a "not enough hands" note when
  `!subD.posMap`.
