// ── PERF TRACING ─────────────────────────────────────────────────────────────
//
// Lightweight in-page timing so the user can capture what's slow on a tab
// switch without opening devtools. Enable with `?perf=1` in the URL or by
// running `Perf.enable()` in the console. Once enabled it persists in
// localStorage and survives reloads until `Perf.disable()` is called.
//
// On every measurement it logs to console with a [PERF] prefix and appends a
// row to a fixed-position HUD in the bottom-right of the page so the user can
// see the timings live as they click.

(function() {
  var STORAGE_KEY = 'tcp_perf';
  var enabled = false;
  try {
    var qs = new URLSearchParams(window.location.search);
    if (qs.has('perf')) { localStorage.setItem(STORAGE_KEY, '1'); }
    enabled = localStorage.getItem(STORAGE_KEY) === '1';
  } catch (_) {}

  var hud = null;
  var rows = [];
  var MAX_ROWS = 40;

  function ensureHud() {
    if (!enabled) return null;
    if (hud) return hud;
    hud = document.createElement('div');
    hud.id = 'perf-hud';
    hud.style.cssText = [
      'position:fixed', 'right:8px', 'bottom:8px',
      'width:340px', 'max-height:50vh',
      'overflow:auto',
      'background:rgba(0,0,0,0.85)',
      'color:#e6c272',
      'font:11px/1.4 monospace',
      'padding:8px 10px',
      'border:1px solid #4a3a1a',
      'border-radius:4px',
      'z-index:99999',
      'pointer-events:auto',
      'white-space:pre',
    ].join(';');
    var header = document.createElement('div');
    header.style.cssText = 'color:#f5d989;font-weight:bold;margin-bottom:6px;display:flex;justify-content:space-between;';
    var title = document.createElement('span');
    title.textContent = 'PERF (click to clear)';
    var off = document.createElement('span');
    off.textContent = '✕';
    off.style.cssText = 'cursor:pointer;color:#a87a3a;';
    off.title = 'Disable perf logging';
    off.onclick = function(e) { e.stopPropagation(); disable(); if (hud) { hud.remove(); hud = null; } };
    header.appendChild(title);
    header.appendChild(off);
    hud.appendChild(header);
    var body = document.createElement('div');
    body.id = 'perf-hud-body';
    hud.appendChild(body);
    hud.onclick = function() { rows = []; redraw(); };
    if (document.body) document.body.appendChild(hud);
    else document.addEventListener('DOMContentLoaded', function() { document.body.appendChild(hud); });
    return hud;
  }

  function redraw() {
    if (!enabled) return;
    var el = hud && hud.querySelector('#perf-hud-body');
    if (!el) return;
    el.textContent = rows.join('\n');
    el.scrollTop = el.scrollHeight;
  }

  function fmt(ms) {
    if (ms < 10) return ms.toFixed(1) + 'ms';
    return Math.round(ms) + 'ms';
  }

  function log(label, ms, extra) {
    if (!enabled) return;
    var row = label + ' ' + fmt(ms) + (extra ? ' ' + extra : '');
    rows.push(row);
    if (rows.length > MAX_ROWS) rows.shift();
    try { console.log('[PERF]', label, fmt(ms), extra || ''); } catch (_) {}
    ensureHud();
    redraw();
  }

  function note(text) {
    if (!enabled) return;
    rows.push('— ' + text);
    if (rows.length > MAX_ROWS) rows.shift();
    try { console.log('[PERF]', text); } catch (_) {}
    ensureHud();
    redraw();
  }

  function time(label, fn) {
    if (!enabled) return fn();
    var t0 = performance.now();
    var out = fn();
    log(label, performance.now() - t0);
    return out;
  }

  // Wrap a function so every call is timed. Returns the wrapped fn.
  function wrap(label, fn) {
    if (!enabled || typeof fn !== 'function') return fn;
    return function() {
      var t0 = performance.now();
      var r = fn.apply(this, arguments);
      log(label, performance.now() - t0);
      return r;
    };
  }

  function enable() {
    enabled = true;
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch (_) {}
    ensureHud();
    note('perf enabled');
  }

  function disable() {
    enabled = false;
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
  }

  function isOn() { return enabled; }

  // Watch for long main-thread tasks (>50ms). Browser tells us when the thread
  // was blocked even if we didn't instrument that path.
  try {
    if (enabled && typeof PerformanceObserver !== 'undefined') {
      var po = new PerformanceObserver(function(list) {
        list.getEntries().forEach(function(e) {
          if (e.duration >= 50) log('⏱ long-task', e.duration);
        });
      });
      po.observe({ entryTypes: ['longtask'] });
    }
  } catch (_) {}

  window.Perf = {
    enable: enable,
    disable: disable,
    isOn: isOn,
    log: log,
    note: note,
    time: time,
    wrap: wrap,
  };

  if (enabled) {
    // Defer HUD creation until DOM is ready
    if (document.body) ensureHud();
  }
})();
