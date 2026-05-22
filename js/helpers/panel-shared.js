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

function pRow(body, label) {
  var html = '<div class="p-row">';
  if (label) html += dimLabel(label);
  html += (body || '');
  html += '</div>';
  return html;
}

function insGrid(items, label) {
  if (!items || !items.length) return '';
  var inner = '<div class="ins-grid">' + items.join('') + '</div>';
  return label ? pRow(inner, label) : inner;
}

function mountPanel(container, html) {
  if (!container) return;
  container.innerHTML = html;
}

function mountTemplate(container, name) {
  if (!container) return;
  var TPL = (typeof window !== 'undefined' && window.__TPL) || {};
  var html = TPL[name];
  if (html == null) {
    console.warn('[panel-shared] missing template for "' + name + '"');
    container.innerHTML = '';
    return;
  }
  container.innerHTML = html;
}

function bind(root, data) {
  if (!root || !data) return;
  var nodes = root.querySelectorAll('[data-bind]');
  for (var i = 0; i < nodes.length; i++) {
    var key = nodes[i].getAttribute('data-bind');
    if (key in data) nodes[i].textContent = (data[key] == null ? '' : String(data[key]));
  }
}

// innerHTML variant: only pass markup the caller controls, never user strings.
function bindHtml(root, data) {
  if (!root || !data) return;
  var nodes = root.querySelectorAll('[data-bind-html]');
  for (var i = 0; i < nodes.length; i++) {
    var key = nodes[i].getAttribute('data-bind-html');
    if (key in data) nodes[i].innerHTML = (data[key] == null ? '' : String(data[key]));
  }
}

function setSlot(root, name, html) {
  if (!root) return null;
  var el = root.querySelector('[data-slot="' + name + '"]');
  if (!el) return null;
  el.innerHTML = html || '';
  return el;
}

// Classify a value against a [lo, hi] band. Returns { cls, label } using the
// shared v-* color classes. null value -> no-data.
function bandVerdict(value, lo, hi) {
  if (value == null) return { cls: 'v-na', label: 'no data' };
  if (value < lo) return { cls: 'v-low', label: 'too low' };
  if (value > hi) return { cls: 'v-high', label: 'too high' };
  return { cls: 'v-ok', label: 'on target' };
}

// Format a {tight, loose} band as "X-Y%". '-' when absent.
function fmtBandRange(band) {
  if (!band) return '-';
  return Math.round(band.tight) + '-' + Math.round(band.loose) + '%';
}

// Build a <tr> of <th> from column specs. Each spec is one of:
//   '' / null            -> empty <th></th>
//   'Plain'              -> <th>Plain</th> (raw HTML allowed)
//   { tip: 'Win Rate' }  -> <th> with tipWrap(label)
//   { html: '...' }      -> <th> with custom inner HTML
//   { label/tip, sort: 'key' } -> sortable <th data-sort-col="key"> with arrow
// sortState is { col, dir } and drives the active-column arrow.
function renderTableHead(cols, sortState) {
  function arrow(key) {
    if (!sortState || sortState.col !== key) return '';
    return sortState.dir === 'asc' ? ' &#9650;' : ' &#9660;';
  }
  var ths = cols.map(function(c) {
    if (c == null || c === '') return '<th></th>';
    if (typeof c === 'string') return '<th>' + c + '</th>';
    var label = c.tip ? tipWrap(c.tip) : (c.html != null ? c.html : c.label);
    if (c.sort) return '<th class="sortable" data-sort-col="' + c.sort + '">' + label + arrow(c.sort) + '</th>';
    return '<th>' + label + '</th>';
  });
  return '<tr>' + ths.join('') + '</tr>';
}

// Templates must provide a `verdict` slot and a `findings` slot.
function mountFindings(root, panelName, d, hands, fallback) {
  if (typeof Sections === 'undefined' || typeof Sections.evaluateSections !== 'function') {
    return [];
  }
  var findings = Sections.findingsForPanel(Sections.evaluateSections(d, {}, hands), panelName);
  setSlot(root, 'verdict', Sections.renderVerdict(findings, fallback));
  var slot = root.querySelector('[data-slot="findings"]');
  if (slot) {
    if (findings.length) {
      slot.innerHTML = Sections.renderFindings(findings);
      slot.removeAttribute('hidden');
    } else {
      slot.innerHTML = '';
      slot.setAttribute('hidden', '');
    }
  }
  return findings;
}

// Clone `<template data-row>` inside `[data-fill="key"]` once per item.
// onClone(rowEl, item, index) wires per-row events the template cannot express.
function fillRows(root, key, items, onClone) {
  if (!root || !items) return [];
  var holder = root.querySelector('[data-fill="' + key + '"]');
  if (!holder) return [];
  var tpl = holder.querySelector('template[data-row]');
  if (!tpl) return [];
  while (holder.lastChild && holder.lastChild !== tpl) {
    holder.removeChild(holder.lastChild);
  }
  var appended = [];
  for (var i = 0; i < items.length; i++) {
    var frag = tpl.content.cloneNode(true);
    bind(frag, items[i]);
    bindHtml(frag, items[i]);
    var firstEl = null;
    for (var c = 0; c < frag.childNodes.length; c++) {
      if (frag.childNodes[c].nodeType === 1) { firstEl = frag.childNodes[c]; break; }
    }
    if (onClone && firstEl) onClone(firstEl, items[i], i);
    holder.appendChild(frag);
    if (firstEl) appended.push(firstEl);
  }
  return appended;
}
