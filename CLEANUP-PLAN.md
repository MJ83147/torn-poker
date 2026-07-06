# Cleanup plan — the full proposed CSS + markup refactor

---

## How it gets done (process rules)

- **Manual only.** One small change at a time, no scripts, no bulk/automated passes.
- **CSS + markup move together.** A clean stylesheet needs the markup migrated to
  match it — you can't clean the CSS alone.
- **Verify each step** before the next.
- **Decisions get flagged, not guessed.**

---

## 1. Structure model

```
panel > section > row > container > box | card
```

- Every `.row` wraps `.container`(s). Never a bare row; never a box/card sitting
  directly in a row.
- `.container` owns padding. Two jobs: a single padded slot, OR the flex-wrap
  parent for multiple cards.
- Findings render as `row > container(grid) > cards`.
- **`.box`** = one single thing inside (e.g. a verdict = just text).
- **`.card`** = header + numbers + text + sections.
- A shared **`.grid`** primitive (auto-fit) for multi-card slots — lives in Structure.

---

## 2. Type — 7 roles (mostly real HTML elements)

| role   | element / class        | for                                                | replaces (remove)                            |
| ------ | ---------------------- | -------------------------------------------------- | -------------------------------------------- |
| H1     | `<h1>`                 | panel title                                        | `title`, `title-lg`, `title-xl`              |
| H2     | `<h2>`                 | section title                                      | `section-head`                               |
| H3     | `<h3>`                 | card title                                         | `card-title`                                 |
| H4     | `<h4>` (+`<th>`)       | body-size ALL CAPS labels / table headers          | uppercase `eyebrow` uses                     |
| Body   | `<body>`/`<p>` default | paragraph & default text                           | `text-body` (drop class)                     |
| Meta   | `.meta`                | small text — eyebrows, ticks, timestamps, captions | `text-meta`, `text-micro`, `lead`, `eyebrow` |
| Metric | `.metric`              | big stat-box numbers                               | `value`, `value-lg`                          |

Type all lives in ONE section of the stylesheet.

---

## 3. Markers

- **`.tag`** — one inline label pill. Removes `badge`, `chip`, `story-tag`, `sentence-seg-tag`.
- **`.dot`** — one small coloured circle (colour via `.bg-*`). Removes `dot-lg` (folded in), `swatch-dot`, `dot-cat-*`, `sm-dot-*`.
- Carousel pagination dots stay with the carousel.
- Chevrons/arrows defined once.

---

## 4. Interactive

- **One `.link`** for anything clickable — rows and cards. `cursor:pointer` + tint on hover.
- Removes `card-link`, `stat-clickable`, `cards-bar-row`.
- Grouped with buttons.

---

## 5. Colours

- `.c-*` (text) and `.bg-*` (fill) are the one colour system.
- Verdict colours `.v-ok/.v-low/.v-high/.v-na` fold into `.c-pos/.c-warn/.c-neg/.c-dim`
  (via `bandVerdict()`).

---

## 6. No soup, no trivial classes

- At most **one alignment modifier** per element. Kill `row wrap center` / `row between`
  used as content-lines and alignment soup.
- A trivial one-property class → a single reusable modifier
  (e.g. `.saved-card-note-empty{italic}` → `.italic`).
- `overflow-x` is a utility, not structure.
- Dividers = a divider element, not a class.
- Bulleted lists = the `<ul>`/`<li>` elements, not a `.story-branches` class.

---

## 7. No per-panel styling

Panels are built from shared primitives. No `<panel>-*` classes for layout/spacing/type.
Slim / remove these families (markup moves onto primitives):

`welcome-*` · `dynamics-*` · `saved-*` · `profile-*` · `paste-*` · `hero-strip`/`hs-*` ·
`cards-row-cue`/`cards-bar-row` · `insight*` (→ story) · `style-map-*`

**welcome** = just a panel with a row and two unequal-width containers.

---

## 8. Components kept (genuinely unique — they own their internals)

`.rc` range matrix · `.table` · `.tab*` / `.subtab*` · `.carousel*` · `.modal*` /
`.tooltip*` / `.popover` · `.story` (expandable finding card) · `.bar*` · `.stat*` /
`.legend*` / `.swatch*` · `.introjs*` (3rd-party) ·
`.cr-*` report builder (kept as its own feature, your call).

---

## 9. Panels kept minimal

- **saved, paste, loader, maintenance** — foundation only, no bespoke families.
- Loader keeps only the **card-deal animation**.

---

## 10. The stylesheet structure

One file, sectioned, only classes actually used, no dead classes, no noise comments:

```
1. TOKENS       design variables
2. BASE         reset, body, links, form controls, ul/li
3. TYPE         h1–h4, .meta, .metric
4. UTILITIES    .c-* · .bg-* · .fw-* · .hidden · .overflow-x
5. STRUCTURE    .panel .section .row .container .box .card .list .inner-section .grid
6. MARKERS      .tag .dot
7. COMPONENTS   buttons · link · tabs · table · bars · stat · legend · spark ·
                range · equity · story · carousel · modal · report builder · panels
8. RESPONSIVE   @media
9. THIRD-PARTY  intro.js
```

---

## 11. Dead classes to delete (verified unused)

`badge-warn` · `swatch-dot` · `grow` · `welcome-body` · `bottom-*`/`top-*` · `md` ·
plus any orphaned per-panel classes surfaced during migration.

---
