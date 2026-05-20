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

// ── HTML TEMPLATE LOADING ────────────────────────────────────────────────────
// Panels register their static markup as a sibling `<name>.html` file. The
// build step (build.js) inlines each file into the bundle as
// `window.__TPL[name] = '<minified html>'`. At render time, panels call
// mountTemplate to drop the markup into their container, then bind() to fill
// `[data-bind="key"]` slots from a data object.
//
// Dynamic rows (one per item in an array) use `<X data-fill="key">` as the
// mount point. The caller queries that node, clones its child template, and
// repeats. The fill helper here handles the common simple case.

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

// Fill every `[data-bind="key"]` element in `root` with `data[key]` as text.
// Missing keys leave the element untouched so the template can ship with
// placeholder copy and only get overwritten when the panel has the value.
function bind(root, data) {
  if (!root || !data) return;
  var nodes = root.querySelectorAll('[data-bind]');
  for (var i = 0; i < nodes.length; i++) {
    var key = nodes[i].getAttribute('data-bind');
    if (key in data) nodes[i].textContent = (data[key] == null ? '' : String(data[key]));
  }
}

// Same as bind, but writes HTML rather than text. Use sparingly and only with
// markup the caller controls (never with user-supplied strings).
function bindHtml(root, data) {
  if (!root || !data) return;
  var nodes = root.querySelectorAll('[data-bind-html]');
  for (var i = 0; i < nodes.length; i++) {
    var key = nodes[i].getAttribute('data-bind-html');
    if (key in data) nodes[i].innerHTML = (data[key] == null ? '' : String(data[key]));
  }
}

// Repeat-fill helper. Locates `[data-fill="key"]` inside root, finds the
// `<template data-row>` inside it, clones the row once per item in items,
// runs bind(clone, item) on each clone, and appends to the fill container.
// `onClone(node, item, index)` is an optional hook for wiring per-row event
// handlers or applying classes the template cannot express. Returns the list
// of appended row elements.
function fillRows(root, key, items, onClone) {
  if (!root || !items) return [];
  var holder = root.querySelector('[data-fill="' + key + '"]');
  if (!holder) return [];
  var tpl = holder.querySelector('template[data-row]');
  if (!tpl) return [];
  // Remove any previous rows (everything after the template).
  while (holder.lastChild && holder.lastChild !== tpl) {
    holder.removeChild(holder.lastChild);
  }
  var appended = [];
  for (var i = 0; i < items.length; i++) {
    var frag = tpl.content.cloneNode(true);
    // After clone, frag is a DocumentFragment. Bind operates on it directly.
    bind(frag, items[i]);
    bindHtml(frag, items[i]);
    // Capture the first element child so the caller can wire events.
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
