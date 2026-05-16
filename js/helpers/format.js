// ── FORMATTING HELPERS ────────────────────────────────────────────────────────

// Map a win rate percentage to a CSS color variable
function wrColor(w) {
  if (w === null) return 'var(--dim)';
  if (w >= 55) return 'var(--green)';
  if (w <= 38) return 'var(--red)';
  return 'var(--amber)';
}

// Format money ($5.3K, $1.2M, etc)
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
  var bbs = amount / bb;
  if (Math.abs(bbs) >= 100) return Math.round(bbs) + ' BB';
  if (Math.abs(bbs) >= 10) return bbs.toFixed(1) + ' BB';
  return bbs.toFixed(2) + ' BB';
}

function pct(a, b) {
  return b > 0 ? Math.round(a / b * 100) : null;
}

// Standard poker aggression frequency: raises / (raises + calls + checks)
// Excludes folds - folding is not an aggressive or passive action.
function calcAggression(raises, calls, checks) {
  return pct(raises, raises + calls + checks);
}

// Severity rating: maps a value to 'red'/'amber'/'green'/'text' based on thresholds.
// rLo/rHi = red thresholds (outside = red), aLo/aHi = amber thresholds (outside = amber).
// Aggregate VPIP across a group of positions from posMap.
// Returns:
//   {
//     vpip: number|null,   // pct(vpipCount, hands), null when hands===0
//     hands: number,       // total hands across the listed positions
//     vpipCount: number,   // raw vpip count (for further aggregation)
//   }
// All three keys are always set. Callers that destructure must list all keys
// they need - the Position panel had a regression because it destructured
// only `vpip` and left other variable names referencing undefined.
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

// Average of numeric array (returns raw float, callers round if needed)
function avg(arr) {
  if (!arr || !arr.length) return 0;
  var s = 0;
  for (var i = 0; i < arr.length; i++) s += arr[i];
  return s / arr.length;
}

// Format P&L with +/- prefix. Null/NaN/Infinity render as "$0".
function fmtPnl(val) {
  if (val == null || !isFinite(val)) return '$0';
  var abs = Math.abs(val);
  return (val < 0 ? '-' : '+') + fmt(abs);
}

// Format a percentage value (already in 0-100 range) with one decimal.
// Null/non-finite renders as empty string (matches the legacy story-engine
// helper this replaced).
function fmtPct(v) {
  if (v == null || !isFinite(v)) return '';
  return (Math.round(v * 10) / 10) + '%';
}

// CSS class for P&L (table cells)
function pnlCls(val) {
  return val >= 0 ? 'pnl-pos' : 'pnl-neg';
}

// CSS color variable for P&L (inline styles)
function pnlColor(val) {
  return val >= 0 ? 'var(--green)' : 'var(--red)';
}

// CSS class for win rate (table cells)
function wrCls(wr) {
  if (wr === null) return '';
  return wr >= 50 ? 'wr-good' : 'wr-bad';
}

// Display amount as BB or dollar depending on toggle
function fmtAvgAmount(chipArr, bbArr) {
  if (_displayBB && bbArr && bbArr.length) return avg(bbArr).toFixed(1) + ' BB';
  return fmt(Math.round(avg(chipArr)));
}
