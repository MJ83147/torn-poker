# Contributing Guide

How to add features, new tabs, and maintain code quality in TC Poker Analysis.

---

## Architecture Overview

```
index.html          → Tab buttons + panel containers
app.js              → Tab switching, render orchestrator
js/helpers.js       → Shared constants, formatting, utilities
js/stats.js         → Data analysis (analyse() function)
js/state.js         → IndexedDB persistence, session management
js/modal.js         → Example hand replay modal
js/equity.js        → Monte Carlo equity simulation
js/tour.js          → Intro.js guided tours per tab
js/panels/*.js      → One file per tab (renderXxx function)
styles.css          → All styling, CSS variables in :root
mobile-styles.css   → Mobile responsive overrides
build.js            → Concatenates + minifies → app.min.js
```

---

## Adding a New Tab

### 1. Create the panel renderer

Create `js/panels/mytab.js`:

```js
// ── MY TAB PANEL ─────────────────────────────────────────────────────────────

function renderMyTab(container, d, hands) {
  var html = '<div class="panel-title">My Tab</div>';
  html += '<div class="panel-desc">One-line description of what this tab shows.</div>';

  // Content sections use .p-row for spacing
  html += '<div class="p-row">';
  html += '<div class="dim-label">Section Heading</div>';
  // ... your content
  html += '</div>';

  // Insight cards use .ins-grid + ins() helper
  var insights = [];
  insights.push(ins('green', 'Good Thing', 'Explanation of the insight'));
  if (insights.length) {
    html += '<div class="p-row"><div class="dim-label">Insights</div>';
    html += '<div class="ins-grid">' + insights.join('') + '</div></div>';
  }

  container.innerHTML = html;
}
```

### 2. Add the tab button in index.html

Find the `<div id="tabs">` section and add your button:

```html
<button class="tab" data-tab="mytab">My Tab</button>
```

### 3. Add the panel container in index.html

Find the panel divs and add:

```html
<div class="panel" id="p-mytab"></div>
```

### 4. Wire up the render call in app.js

In the `render()` function, add your render call alongside the others:

```js
renderMyTab(document.getElementById('p-mytab'), d, hands);
```

Also add `'p-mytab'` to the filter banner array if your tab should show the active filter.

### 5. Add to the welcome tab's table of contents

In `js/panels/welcome.js`, add an entry to the `tabDescs` array:

```js
{ tab: 'mytab', name: 'My Tab', desc: 'Short description for the overview page' },
```

### 6. Add tour steps in tour.js

In `js/tour.js`, add a `mytab` key to the `tabTourSteps` object:

```js
mytab: [
  { el: '.panel-title', intro: '<strong>My Tab</strong><br>What this tab is for.', pos: 'bottom' },
  { el: '.some-element', intro: 'Explanation of this element.', pos: 'top' },
  { el: '.ins-grid', intro: 'Insight cards...', fallback: 'Insights appear when you have enough data.' },
]
```

Use `fallback` for elements that may not render (e.g., insights that require minimum hand counts).

### 7. Register in build.js

Add your file to the `files` array in `build.js`, **before** `app.js` and after the other panels:

```js
'js/panels/mytab.js',
```

### 8. Build, bump cache, and deploy

```bash
node build.js
```

Then bump the JS cache version in `index.html`:

```html
<script src="app.min.js?v=15"></script>  <!-- increment the number -->
```

---

## Code Quality Checklist

Run through these before saving your work.

### Use shared helpers — don't repeat code

| Instead of | Use |
|---|---|
| `Math.round(a / b * 100)` | `pct(a, b)` |
| `'$' + num.toLocaleString()` | `fmt(num)` |
| `num + 'BB'` with manual division | `fmtBB(num, bb)` |
| Manual P&L coloring | `fmtPnl(num)` |
| Inline insight HTML | `ins(color, label, text)` or `insWithExample(...)` |
| Inline tooltip HTML | `tipWrap(term)` |
| Finding example hands manually | `findExampleHand(predicate)` |

Check `js/helpers.js` before writing any utility — it likely already exists.

### Use CSS variables — not hardcoded colors

```css
/* Bad */
color: #c8a94a;
background: #0e1410;

/* Good */
color: var(--gold);
background: var(--s1);
```

Available variables (defined in `:root` in `styles.css`):

| Variable | Purpose |
|---|---|
| `--bg` | Page background |
| `--s1` | Surface 1 (cards, sections) |
| `--s2` | Surface 2 (inputs, nested) |
| `--border` | Borders |
| `--gold` | Primary accent, titles |
| `--gold2` | Gold hover/darker |
| `--green` | Positive / strength |
| `--red` | Negative / leak |
| `--amber` | Warning / caution |
| `--text` | Body text |
| `--dim` | Secondary / muted text |
| `--muted` | Very subtle background |

### Use shared CSS classes — not panel-specific styling

| Class | Purpose |
|---|---|
| `.panel-title` | Tab heading (Cormorant Garamond, gold) |
| `.panel-desc` | Subtitle under the title |
| `.p-row` | Content section with bottom margin |
| `.dim-label` | Small uppercase label (11px, dim) |
| `.desc-text` | Descriptive paragraph text |
| `.serif-value` | Large numeric display value |
| `.ins-grid` | Responsive grid for insight cards |
| `.ins` | Individual insight card |
| `.two-col` | Two-column layout |
| `.mini-row` | Small stat card grid |
| `.bar-group` / `.bar-row` | Bar chart rows |

If you need new styling, add it to `styles.css` using the existing variables. Avoid inline styles except for dynamic values (widths, colors based on data).

### Data access patterns

- Analysis data comes from `d` (output of `analyse()` in `js/stats.js`)
- Raw hands come from `hands` array
- Use `isCashHand(h)` to check hand type
- Use `isShowdown(h)` to check if hand reached showdown
- Use `getHeroActions(h)` to get the player's actions
- Player name is in `State.meta.player`

### Panel function signature

All panels follow the same pattern:

```js
function renderXxx(container, d, hands) {
  // Build HTML string
  container.innerHTML = html;
}
```

Some panels take extra args (e.g., `renderWelcome` gets `meta`, `renderTables` gets `allHands` and a callback). Keep signatures minimal.

---

## Deployment Workflow

```bash
# 1. Make your changes to source files

# 2. Build the bundle
node build.js

# 3. Bump cache version in index.html if you changed JS
#    <script src="app.min.js?v=15">
#    Also bump CSS version if you changed styles.css
#    <link href="styles.css?v=8">

# 4. Commit and push
git add -A
git commit -m "Add My Tab panel with insights and tour"
git push origin main
```

The site loads `app.min.js`, not the source files. If you forget to build, your changes won't appear.

---

## Common Patterns

### Adding insights with example hands

```js
var exHand = findExampleHand(function(h) { return someCondition(h); });
insights.push(insWithExample('green', 'Label', 'Description text', exHand, 'Coaching note'));
```

### Conditional rendering based on data

```js
if (d.n >= 20) {
  // Only show this section with enough data
}
```

### Using the tooltip system

Any poker term in the `TIPS` object (in `helpers.js`) can be wrapped:

```js
tipWrap('VPIP')  // Returns clickable tooltip HTML with the definition
```

### Bar charts

```js
html += '<div class="bar-group">';
items.forEach(function(item) {
  html += '<div class="bar-row">' +
    '<div class="bar-label">' + item.label + '</div>' +
    '<div class="bar-track"><div class="bar-fill" style="width:' + item.pct + '%;"></div></div>' +
    '<div class="bar-val">' + item.pct + '%</div>' +
    '</div>';
});
html += '</div>';
```
