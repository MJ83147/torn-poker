// ── PANEL-SHARED HELPERS ─────────────────────────────────────────────────────
// Small HTML builders that wrap the repeated patterns every panel reaches for.
// Use these instead of inlining the same .panel-title / .p-row / .ins-grid
// markup over and over. See CONTRIBUTING.md for the full shared class list.
//
// All builders take strings and return strings. Callers concatenate as usual:
//
//   var html = panelTitle('My Tab')
//            + panelDesc('What this shows')
//            + pRow(content, 'Section');
//   mountPanel(container, html);

function panelTitle(text) {
  return '<div class="panel-title">' + text + '</div>';
}

function panelDesc(text) {
  return '<div class="panel-desc">' + text + '</div>';
}

function panelHeader(title, desc) {
  return panelTitle(title) + (desc ? panelDesc(desc) : '');
}

function dimLabel(text) {
  return '<div class="dim-label">' + text + '</div>';
}

function descText(text) {
  return '<div class="desc-text">' + text + '</div>';
}

// A standard content section. If `label` is given, it renders as a dim-label
// at the top. `body` is raw HTML for the section content.
function pRow(body, label) {
  var html = '<div class="p-row">';
  if (label) html += dimLabel(label);
  html += (body || '');
  html += '</div>';
  return html;
}

// Wrap an array of insight-card HTML strings (built via ins() / insWithExample())
// in the standard insight grid. Returns empty string if the list is empty.
function insGrid(items, label) {
  if (!items || !items.length) return '';
  var inner = '<div class="ins-grid">' + items.join('') + '</div>';
  return label ? pRow(inner, label) : inner;
}

// Attach the built HTML to the container. Mirrors the
// `container.innerHTML = html;` pattern every panel uses, but tolerates a
// missing container so callers don't all repeat the null check.
function mountPanel(container, html) {
  if (!container) return;
  container.innerHTML = html;
}
