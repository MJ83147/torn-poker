// Small stat tiles. items are [{l, v, c, dot}]: label, value, colour (a
// severity letter g/r/a, a literal colour suffix, or 'text' for uncoloured),
// and an optional swatch-line class.
function renderMiniRow(items, opts) {
  opts = opts || {};
  var rowAttrs = '';
  if (opts.columns) rowAttrs += ` style="grid-template-columns:${opts.columns};"`;
  else if (opts.dim) rowAttrs += ' style="opacity:0.45"';
  if (opts.columns && opts.dim) rowAttrs = ` style="grid-template-columns:${opts.columns};opacity:0.45;"`;
  var CMAP = { g: 'c-pos', r: 'c-neg', a: 'c-warn' };
  return `<div class="stat-grid"${rowAttrs}>${items.map(function(m) {
    var cc = CMAP[m.c] || (m.c && m.c !== 'text' ? 'c-' + m.c : '');
    var dot = m.dot ? `<span class="swatch-line ${m.dot}"></span> ` : '';
    return `<div class="stat"><div class="eyebrow">${dot}${m.l}</div><div class="value ${cc}">${m.v}</div></div>`;
  }).join('')}</div>`;
}
