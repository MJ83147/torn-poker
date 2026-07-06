// Bar-shaped components: labelled bar rows, proportional split bars, legends.

// One labelled bar. cls is a severity letter (g/r/a/n/o) mapped via INS_BG,
// or a literal bg-* utility class passed straight through.
function barRow(label, val, max, cls, valStr, val2Str) {
  var w = max > 0 ? clamp(Math.round((val / max) * 100), 0, 100) : 0;
  var fill = INS_BG[cls] || cls || "bg-gold";
  return `<div class="bar ${val2Str ? "bar-3" : ""}">
    <div class="c-gold fw-semibold">${label}</div>
    <div class="bar-track"><div class="bar-fill ${fill}" style="width:${w}%"></div></div>
    <div class="text-meta text-right">${valStr}</div>
    ${val2Str ? `<div class="text-meta text-right">${val2Str}</div>` : ""}
  </div>`;
}

// Proportional split bar: segs [{p, bg}] become width-% segments.
function barStack(segs) {
  return `<div class="bar-stack">${segs
    .map(function (s) {
      return `<div class="bar-seg ${s.bg}" style="width:${s.p}%;"></div>`;
    })
    .join("")}</div>`;
}

// Legend line: items [{cls, label}]. extra is an optional attribute string
// for the wrapper (e.g. a data-tour hook).
function legendRow(items, extra) {
  return `<div class="legend"${extra || ""}>${items
    .map(function (i) {
      return `<div class="legend-item"><div class="swatch ${i.cls}"></div>${i.label}</div>`;
    })
    .join("")}</div>`;
}
