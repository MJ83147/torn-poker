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

// Format P&L with +/- prefix
function fmtPnl(val) {
  return (val >= 0 ? '+' : '') + fmt(val);
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
