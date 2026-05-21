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
