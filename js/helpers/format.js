function wrColor(w) {
  if (w === null) return 'var(--dim)';
  if (w >= 55) return 'var(--green)';
  if (w <= 38) return 'var(--red)';
  return 'var(--amber)';
}

function fmt(n) {
  const a = Math.abs(Number(n) || 0);
  const s = a >= 1e9
    ? '$' + (a / 1e9).toFixed(1) + 'B'
    : a >= 1e6
      ? '$' + (a / 1e6).toFixed(1) + 'M'
      : a >= 1000
        ? '$' + Math.round(a / 1000) + 'K'
        : '$' + a;
  return Number(n) < 0 ? '-' + s : s;
}

function fmtBB(amount, bb) {
  if (!_displayBB || !bb || bb <= 0) return fmt(amount);
  return fmtBBRaw(amount / bb);
}

// Format a pre-divided BB value with the same scale rules as fmtBB. Use when
// the caller has already done the chips/bb division.
function fmtBBRaw(bbs) {
  if (Math.abs(bbs) >= 100) return Math.round(bbs) + ' BB';
  if (Math.abs(bbs) >= 10) return bbs.toFixed(1) + ' BB';
  return bbs.toFixed(2) + ' BB';
}

function pct(a, b) {
  return b > 0 ? Math.round(a / b * 100) : null;
}

// Standard poker aggression frequency: raises / (raises + calls + checks).
// Excludes folds - folding is not an aggressive or passive action.
function calcAggression(raises, calls, checks) {
  return pct(raises, raises + calls + checks);
}

function calcPositionGroupVpip(posMap, positions) {
  var v = 0, h = 0;
  for (var i = 0; i < positions.length; i++) {
    var p = posMap[positions[i]];
    if (p) { v += p.vpip; h += p.hands; }
  }
  return { vpip: pct(v, h), hands: h, vpipCount: v };
}

function sev(v, rLo, rHi, aLo, aHi) {
  if (v === null) return 'text';
  if (v <= rLo || v >= rHi) return 'red';
  if (v <= aLo || v >= aHi) return 'amber';
  return 'green';
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function avg(arr) {
  if (!arr || !arr.length) return 0;
  var s = 0;
  for (var i = 0; i < arr.length; i++) s += arr[i];
  return s / arr.length;
}

function fmtPnl(val) {
  if (val == null || !isFinite(val)) return '$0';
  var abs = Math.abs(val);
  return (val < 0 ? '-' : '+') + fmt(abs);
}

function fmtPct(v) {
  if (v == null || !isFinite(v)) return '';
  return (Math.round(v * 10) / 10) + '%';
}

function pnlCls(val) {
  return val >= 0 ? 'pnl-pos' : 'pnl-neg';
}

// Unscoped P&L color class for values outside .tbl (e.g. value blocks).
function pnlValCls(val) {
  return val >= 0 ? 'val-pos' : 'val-neg';
}

function pnlColor(val) {
  return val >= 0 ? 'var(--green)' : 'var(--red)';
}

function wrCls(wr) {
  if (wr === null) return '';
  return wr >= 50 ? 'wr-good' : 'wr-bad';
}

function fmtAvgAmount(chipArr, bbArr) {
  if (_displayBB && bbArr && bbArr.length) return avg(bbArr).toFixed(1) + ' BB';
  return fmt(Math.round(avg(chipArr)));
}

// Join a list as "A", "A and B", or "A, B, and C".
function joinList(items) {
  if (!items || !items.length) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return items[0] + ' and ' + items[1];
  return items.slice(0, -1).join(', ') + ', and ' + items[items.length - 1];
}
