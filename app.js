// ── APP SHELL (orchestrator) ─────────────────────────────────────────────────

// Tab navigation is handled by click listener in helpers.js

// BB toggle handler - only changes display units, no recompute. Just re-render
// the active tab so its labels flip.
document.getElementById('bb-toggle').onclick = function () {
  _displayBB = !_displayBB;
  this.querySelectorAll('.bb-opt').forEach(function (o) {
    o.classList.toggle('active', _displayBB ? o.dataset.mode === 'bb' : o.dataset.mode === 'dollar');
  });
  if (State.allHands.length) {
    invalidateRenderedPanels();
    renderActivePanel();
  }
};

// ── PER-TAB ANALYSIS CACHE ──────────────────────────────────────────────────
// The shared analyse() result is computed lazily on first request for a given
// filter, then reused by any panel that needs it until the filter changes.
var _analysisCache = null;       // { key, fd, filtered }
var _opponentCacheKey = null;    // tracks filter the opponent profiles were built for
var _panelsRenderedFor = {};     // tabId -> filterKey (which panel has up-to-date content)

function _filterKey() {
  var tableFilter = document.getElementById('table-filter');
  var playersFilter = document.getElementById('players-filter');
  var excl = [];
  State.excludedTables.forEach(function (v) { excl.push(v); });
  excl.sort();
  return State.sessionEpoch + '|' +
    (tableFilter ? tableFilter.value : 'all') + '|' +
    (playersFilter ? playersFilter.value : 'all') + '|' +
    excl.join(',');
}

// Lazy-build the filter-scoped analysis. Called only by panels that need d.
function getFilteredAnalysis() {
  var key = _filterKey();
  if (_analysisCache && _analysisCache.key === key) return _analysisCache;
  var filtered = State.getFilteredHands();
  var fd = analyse(filtered);
  bucketizeAnalysis(fd, filtered);
  _analysisCache = { key: key, fd: fd, filtered: filtered };
  return _analysisCache;
}

// Build opponent profiles once per filter. Called only by panels that need it
// (Players panel). Heavy: walks every opponent across every hand.
function ensureOpponentProfiles(filtered) {
  var key = _filterKey();
  if (_opponentCacheKey === key) return;
  cacheOpponentProfiles(filtered);
  _opponentCacheKey = key;
}

function invalidateAnalysisCache() {
  _analysisCache = null;
  _opponentCacheKey = null;
}

function invalidateRenderedPanels() {
  _panelsRenderedFor = {};
}

// Central re-render entry point: invalidates cached work and re-renders the
// active tab only. Other tabs stay stale until the user clicks into them.
function renderAll() {
  if (!State.allHands.length) return false;
  invalidateAnalysisCache();
  invalidateRenderedPanels();
  _renderHeaderControls();
  renderActivePanelDeferred();
  return true;
}

// Saved session: check IndexedDB and wire restore button
function checkSavedSession() {
  State.loadSaved(function (json) {
    if (!json) return;
    try {
      var hands = (Array.isArray(json) ? json : (json.hands || [])).filter(function (h) { return h.hole && h.hole.length === 2; });
      if (!hands.length) return;
      var playerName = json.player || detectPlayerFromActions(hands) || 'Unknown';
      var rb = document.getElementById('restore-block');
      var rl = document.getElementById('restore-label');
      var date = json.exportedAt ? new Date(json.exportedAt).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric',
      }) : '';
      rl.textContent = hands.length + ' hands from ' + playerName + (date ? ' · ' + date : '') + ' found in storage';
      rb.style.display = 'block';
      document.getElementById('restore-btn').onclick = function () {
        var meta = {
          player: playerName,
          exportedAt: new Date().toISOString(),
        };
        State.setSession(hands, meta);
        try { fetch('https://script.google.com/macros/s/AKfycbyTtG1UMCpYXP15dgKQttFyG4Pe-BG8FoAftoW3oYtMBISS37Ws5lYhPPDJ0zl1GYxyQA/exec', { method: 'POST', body: JSON.stringify({ player: playerName, hands: hands.length }), mode: 'no-cors' }); } catch (_) { }
        ensureChartJs(function () {
          showImportLoader(hands.length, function () {
            var rd = analyse(hands);
            bucketizeAnalysis(rd, hands);
            State.overallAnalysis = rd;
            invalidateAnalysisCache();
            invalidateRenderedPanels();
            render(rd, hands, meta);
          });
        });
      };
    } catch (_) { }
  });
}

// Render the header "You: <current> -> Target: <target>" display, with an
// inline picker that lets the user swap the target playstyle.
function _renderStyleDisplay(d) {
  var host = document.getElementById('style-display');
  if (!host) return;
  var current = (typeof detectCurrentStyle === 'function' && d) ? detectCurrentStyle(d).name : null;
  var target = (typeof getTargetStyle === 'function') ? getTargetStyle() : 'TAG';

  var styles = ['TAG', 'LAG', 'Nit', 'Station', 'Maniac'];
  var optionsHtml = '';
  for (var i = 0; i < styles.length; i++) {
    var s = styles[i];
    optionsHtml += '<option value="' + s + '"' + (s === target ? ' selected' : '') + '>' + s + '</option>';
  }

  var youLabel = current ? current : '?';
  host.innerHTML = '<span class="sd-you-label">You:</span>' +
    '<span class="sd-you-val">' + youLabel + '</span>' +
    '<span class="sd-arrow">&rarr;</span>' +
    '<span class="sd-target-label">Target:</span>' +
    '<select class="sd-target-pick" id="sd-target-pick">' + optionsHtml + '</select>';

  var picker = host.querySelector('#sd-target-pick');
  if (picker) {
    picker.onchange = function() {
      if (typeof setUserStyle === 'function') setUserStyle(this.value);
      renderAll();
    };
  }
}

// First-time welcome screen guard. Returns true when the welcome screen was
// shown (caller must NOT proceed to dashboard render).
function _maybeShowStyleWelcome(d, hands, meta) {
  var existing = null;
  try { existing = localStorage.getItem('tc_user_style'); } catch (_) {}
  if (existing) return false;

  var welcomeHost = document.getElementById('style-welcome-host');
  if (!welcomeHost) {
    welcomeHost = document.createElement('div');
    welcomeHost.id = 'style-welcome-host';
    document.body.appendChild(welcomeHost);
  }
  welcomeHost.style.display = 'block';

  // Hide dashboard / paste while welcome is up.
  document.getElementById('paste-wrap').classList.add('hidden');
  document.getElementById('upload-wrap').classList.add('hidden');
  document.getElementById('dash').classList.remove('on');

  if (typeof renderStyleWelcome === 'function') {
    renderStyleWelcome(welcomeHost, d, hands, meta, function(/* picked */) {
      welcomeHost.style.display = 'none';
      welcomeHost.innerHTML = '';
      _bootDashboard(meta);
      renderActivePanel();
    });
  }
  return true;
}

// ── PER-TAB RENDER DISPATCH ─────────────────────────────────────────────────
// Only the active panel is rendered. Other panels stay stale (empty) until
// the user clicks into them. switchTab calls renderActivePanel after the
// visual switch.

// Which panels need the filter-scoped d from analyse(). Trends and showdown
// both consume it for section findings; without it they call analyse(hands)
// themselves, costing a full extra pass over the dataset per visit.
var _PANELS_NEED_D = { mygame:1, cards:1, position:1, street:1, actions:1, range:1, players:1, trends:1, showdown:1 };

// Which panels show the "Showing stats for X table" banner.
var _PANELS_HAVE_BANNER = { welcome:1, mygame:1, cards:1, position:1, street:1, actions:1, range:1, trends:1, showdown:1, log:1, allin:1, players:1 };

function _filterBannerHtml() {
  var filterEl = document.getElementById('table-filter');
  var pfEl = document.getElementById('players-filter');
  var parts = [];
  if (filterEl && filterEl.value && filterEl.value !== 'all') {
    parts.push(filterEl.value === 'unknown' ? 'Unknown Table' : getTableLabel(Number(filterEl.value)));
  }
  if (pfEl && pfEl.value && pfEl.value !== 'all') {
    parts.push(pfEl.value + '-player hands');
  }
  return parts.length ? '<div class="filter-banner">Showing stats for ' + parts.join(' · ') + '</div>' : '';
}

function _drawPanel(tabId, meta) {
  var container = document.getElementById('p-' + tabId);
  if (!container) return;

  var d = null;
  var filtered;
  if (_PANELS_NEED_D[tabId]) {
    var fa = getFilteredAnalysis();
    d = fa.fd;
    filtered = fa.filtered;
  } else {
    filtered = State.getFilteredHands();
  }
  State.modalHands = filtered;

  switch (tabId) {
    case 'welcome':  renderWelcome(container, { n: filtered.length }, filtered, meta); break;
    case 'mygame':   renderMyGame(container, d, filtered); break;
    case 'cards':    renderCards(container, d, filtered); break;
    case 'position': renderPosition(container, d, filtered); break;
    case 'street':   renderStreet(container, d, filtered); break;
    case 'actions':  renderActions(container, d, filtered); break;
    case 'range':    renderRange(container, d, filtered); break;
    case 'players':
      ensureOpponentProfiles(filtered);
      renderPlayers(container, d, filtered);
      break;
    case 'tables':   renderTables(container, filtered, State.allHands, State.excludedTables, renderAll); break;
    case 'trends':   renderTrends(container, filtered, meta, d); break;
    case 'showdown': renderShowdown(container, filtered, meta, d); break;
    case 'log':      renderLog(container, filtered); break;
    case 'allin':    renderAllIn(container, filtered); break;
    case 'custom':   renderCustomReport(container, State.allHands); break;
  }

  if (_PANELS_HAVE_BANNER[tabId]) {
    var banner = _filterBannerHtml();
    if (banner) container.insertAdjacentHTML('afterbegin', banner);
  }
}

function _resolveActiveTabId(forceTabId) {
  if (forceTabId) return forceTabId;
  var activeItem = document.querySelector('.tab-item.active');
  if (activeItem) return activeItem.dataset.tab;
  // Direct-link tabs (e.g. Custom Report) live on .tab-menu-btn[data-tab]
  // with no .tab-item underneath them.
  var activeBtn = document.querySelector('.tab-menu-btn[data-tab].active');
  return activeBtn ? activeBtn.dataset.tab : 'welcome';
}

function renderActivePanel(forceTabId) {
  if (!State.allHands.length) return;
  var tabId = _resolveActiveTabId(forceTabId);
  var filterKey = _filterKey();
  if (_panelsRenderedFor[tabId] === filterKey) return;
  _panelsRenderedFor[tabId] = filterKey;
  _drawPanel(tabId, State.meta);
}

// Yield to the browser before doing the heavy first-visit render. Without this,
// click → repaint → analyse → repaint runs in one tick, so the new tab looks
// frozen even though the data is on its way. Showing a loading spinner first
// gives the user immediate feedback that the click landed.
// setTimeout(0) instead of rAF because rAF is throttled when the tab is
// backgrounded — leaving the user staring at a spinner that never resolves.
function renderActivePanelDeferred(forceTabId) {
  if (!State.allHands.length) return;
  var tabId = _resolveActiveTabId(forceTabId);
  var filterKey = _filterKey();
  if (_panelsRenderedFor[tabId] === filterKey) return;
  var container = document.getElementById('p-' + tabId);
  if (container) {
    container.innerHTML = '<div class="panel-loading"><div class="eq-spinner-ring"></div><div class="eq-spinner-text">Crunching numbers…</div></div>';
  }
  setTimeout(function () { renderActivePanel(tabId); }, 0);
}

// Wrap switchTab so the new tab actually renders its content on first visit.
(function () {
  if (typeof switchTab !== 'function') return;
  var _origSwitchTab = switchTab;
  window.switchTab = function (tabId) {
    var result = _origSwitchTab.apply(this, arguments);
    if (State.allHands.length) renderActivePanelDeferred(tabId);
    return result;
  };
})();

// ── HEADER STRIP (one-time at session load) ─────────────────────────────────
function _renderHeaderStrip() {
  var d = State.overallAnalysis;
  if (!d || !d.core) return;
  var c = d.core;
  var sampleNote = d.n < 50
    ? '<div class="sample-warning">⚠ Small sample: ' + d.n + ' hands. The more hands you play and track, the more accurate these stats become. Aim for 100+ hands for reliable patterns.</div>'
    : '';
  document.getElementById('hero-strip').innerHTML = [
    { l: 'Hands', v: d.n, c: 'o' },
    { l: 'Win Rate', v: c.wr !== null ? c.wr + '%' : '-', c: c.wr >= 50 ? 'g' : 'r' },
    { l: 'Net P&L', v: fmtPnl(c.netPnl), c: c.netPnl >= 0 ? 'g' : 'r' },
    { l: 'VPIP', v: c.vpipPct !== null ? c.vpipPct + '%' : '-', c: c.vpipPct > 55 ? 'a' : 'w' },
    { l: 'Aggression', v: c.agg !== null ? c.agg + '%' : '-', c: c.agg > 25 ? 'g' : 'a' },
    { l: 'vs All-in', v: c.allinFold !== null ? c.allinFold + '% fold' : '-', c: 'w' },
  ].map(function (h) { return '<div class="hs"><div class="hs-l dim-label">' + tipWrap(h.l) + '</div><div class="hs-v serif-value ' + h.c + '">' + h.v + '</div></div>'; }).join('');
  var noteEl = document.getElementById('sample-note');
  if (noteEl) noteEl.innerHTML = sampleNote;
}

function _renderHeaderControls() {
  var meta = State.meta;
  var filtered = State.getFilteredHands();
  document.getElementById('page-meta').textContent = (meta && meta.player ? meta.player : '') + (meta && meta.exportedAt ? ' · ' + new Date(meta.exportedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '') + (State.allHands.length && filtered.length < State.allHands.length ? ' · Filtered: ' + filtered.length + '/' + State.allHands.length + ' hands' : '');
}

// ── MAIN RENDER (orchestrator) ──────────────────────────────────────────────
function render(d, hands, meta) {
  // First-time users see the style welcome screen instead of the dashboard.
  if (_maybeShowStyleWelcome(d, hands, meta)) return;
  // Strip any legacy #cr=... fragment in case someone visits an old share URL.
  if (window.location.hash && window.location.hash.indexOf('#cr=') === 0) {
    try { history.replaceState(null, '', window.location.pathname + window.location.search); } catch (_) {}
  }
  _bootDashboard(meta);
  renderActivePanel();
}

// One-time dashboard scaffolding: header strip from the overall analysis,
// filter dropdowns, style picker, button handlers. Does NOT render any panel
// content — that's renderActivePanel's job.
function _bootDashboard(meta) {
  document.getElementById('paste-wrap').classList.add('hidden');
  document.getElementById('upload-wrap').classList.add('hidden');
  document.getElementById('dash').classList.add('on');

  _renderHeaderControls();
  _renderHeaderStrip();

  // Populate players-filter dropdown
  var pfEl = document.getElementById('players-filter');
  var pfVal = pfEl.value;
  var sizeCounts = {};
  for (var si = 0; si < State.allHands.length; si++) {
    var sc = countHandPlayers(State.allHands[si]);
    if (sc >= 2) sizeCounts[sc] = (sizeCounts[sc] || 0) + 1;
  }
  var sizeKeys = Object.keys(sizeCounts).map(Number).sort(function (a, b) { return a - b; });
  pfEl.innerHTML = '<option value="all">All Sizes</option>';
  for (var ski = 0; ski < sizeKeys.length; ski++) {
    var sk = sizeKeys[ski];
    pfEl.innerHTML += '<option value="' + sk + '"' + (pfVal == sk ? ' selected' : '') + '>' + sk + ' Players (' + sizeCounts[sk] + ')</option>';
  }
  pfEl.classList.toggle('hidden', sizeKeys.length <= 1);

  _renderStyleDisplay(State.overallAnalysis);

  // Filter handlers - invalidate caches, re-render active tab only.
  var filterEl = document.getElementById('table-filter');
  filterEl.onchange = function () {
    var prev = this.value;
    if (!renderAll()) {
      alert('No hands for this filter.');
      this.value = 'all';
      return;
    }
    this.value = prev;
  };

  pfEl.onchange = function () {
    var prev = this.value;
    if (!renderAll()) {
      alert('No hands for this filter.');
      this.value = 'all';
      return;
    }
    this.value = prev;
  };

  // Reset button
  document.getElementById('reset-btn').onclick = function () {
    document.getElementById('paste-wrap').classList.remove('hidden');
    document.getElementById('upload-wrap').classList.add('hidden');
    document.getElementById('jin').value = '';
    document.getElementById('dash').classList.remove('on');
    document.getElementById('table-filter').value = 'all';
    document.getElementById('table-filter').classList.add('hidden');
    document.getElementById('players-filter').value = 'all';
    document.getElementById('players-filter').classList.add('hidden');
    State.clear();
    invalidateAnalysisCache();
    invalidateRenderedPanels();
    document.querySelectorAll('.tab').forEach(function (b, i) { b.classList.toggle('active', i === 0); });
    document.querySelectorAll('.panel').forEach(function (p, i) { p.classList.toggle('on', i === 0); });
    document.querySelectorAll('.panel').forEach(function (p) { p.innerHTML = ''; });
    checkSavedSession();
  };

  // Sync BB toggle visual
  var bbBtn = document.getElementById('bb-toggle');
  if (bbBtn) {
    bbBtn.querySelectorAll('.bb-opt').forEach(function (o) {
      o.classList.toggle('active', _displayBB ? o.dataset.mode === 'bb' : o.dataset.mode === 'dollar');
    });
  }
}

// ── PROCESS ─────────────────────────────────────────────────────────────────
function process(raw) {
  var json;
  try {
    json = JSON.parse(raw.trim());
  } catch (e) {
    alert('Could not parse JSON.\n\nMake sure you:\n1. Clicked Export in the TC panel\n2. Pasted the full clipboard contents here\n\nError: ' + e.message);
    return;
  }
  var hands = (Array.isArray(json) ? json : (json.hands || [])).filter(function (h) { return h.hole && h.hole.length === 2; });
  if (!hands.length) {
    alert('No hands found in export. Play some hands first, then export.');
    return;
  }
  var playerName = json.player || 'Unknown';
  if (playerName === 'Unknown') {
    var detected = detectPlayerFromActions(hands);
    if (detected) playerName = detected;
  }
  var meta = {
    player: playerName,
    exportedAt: json.exportedAt || new Date().toISOString(),
  };
  State.setSession(hands, meta);
  hands = State.allHands;
  try { fetch('https://script.google.com/macros/s/AKfycbyTtG1UMCpYXP15dgKQttFyG4Pe-BG8FoAftoW3oYtMBISS37Ws5lYhPPDJ0zl1GYxyQA/exec', { method: 'POST', body: JSON.stringify({ player: playerName, hands: hands.length }), mode: 'no-cors' }); } catch (_) { }
  var d = analyse(hands);
  bucketizeAnalysis(d, hands);
  State.overallAnalysis = d;
  invalidateAnalysisCache();
  invalidateRenderedPanels();
  ensureChartJs(function () {
    showImportLoader(hands.length, function () { render(d, hands, meta); });
  });
}

// ── INPUT HANDLERS ──────────────────────────────────────────────────────────
document.getElementById('go-btn').onclick = function () {
  var v = document.getElementById('jin').value.trim();
  if (v) process(v);
  else alert('Paste JSON first.');
};

document.getElementById('paste-btn').onclick = async function () {
  var errEl = document.getElementById('paste-error');
  var jin = document.getElementById('jin');
  errEl.style.display = 'none';
  try {
    var text = await navigator.clipboard.readText();
    if (!text || !text.trim()) {
      errEl.textContent = 'Clipboard is empty. Make sure you clicked "Analyse Session" in the TC Poker Tracker first.';
      errEl.style.display = 'block';
      return;
    }
    process(text.trim());
  } catch (e) {
    jin.focus();
    jin.placeholder = 'Paste here with Ctrl+V (or Cmd+V on Mac), then press Ctrl+Enter';
    errEl.innerHTML = 'Your browser blocked clipboard access. <strong>Press Ctrl+V</strong> (Cmd+V on Mac) to paste into the box below, then press <strong>Ctrl+Enter</strong> to load.';
    errEl.style.display = 'block';
  }
};

document.getElementById('jin').addEventListener('keydown', function (e) {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) process(this.value);
});

document.getElementById('how-it-works-btn').onclick = function () {
  document.getElementById('hiw-modal').classList.add('show');
};
document.getElementById('hiw-close').onclick = function () {
  document.getElementById('hiw-modal').classList.remove('show');
};
document.getElementById('hiw-modal').onclick = function (e) {
  if (e.target === this) this.classList.remove('show');
};

// ── TOOLTIPS ────────────────────────────────────────────────────────────────
function positionTip(tooltipEl) {
  var tipBox = tooltipEl.querySelector('.tip-box');
  if (!tipBox) return;
  tipBox.style.visibility = 'hidden';
  tipBox.style.display = 'block';
  var anchor = tooltipEl.getBoundingClientRect();
  var tw = tipBox.offsetWidth;
  var th = tipBox.offsetHeight;
  tipBox.style.display = '';
  tipBox.style.visibility = '';
  var top = anchor.top - th - 8;
  var left = anchor.left;
  if (top < 8) top = anchor.bottom + 8;
  if (left + tw > window.innerWidth - 8) left = window.innerWidth - 8 - tw;
  if (left < 8) left = 8;
  tipBox.style.top = top + 'px';
  tipBox.style.left = left + 'px';
}

document.addEventListener('mouseover', function (e) {
  var tip = e.target.closest('.tooltip');
  if (tip) positionTip(tip);
});

document.addEventListener('click', function (e) {
  var tip = e.target.closest('.tooltip');
  document.querySelectorAll('.tooltip.active').forEach(function (t) {
    if (t !== tip) t.classList.remove('active');
  });
  if (tip) {
    tip.classList.toggle('active');
    if (tip.classList.contains('active')) positionTip(tip);
  }
});

window.addEventListener('scroll', function () {
  var active = document.querySelector('.tooltip.active');
  if (active) positionTip(active);
}, true);
window.addEventListener('resize', function () {
  var active = document.querySelector('.tooltip.active');
  if (active) positionTip(active);
});

// ── UPLOAD / MERGE HANDLERS ─────────────────────────────────────────────────
var _uploadedHands = [];

document.getElementById('upload-nav-btn').onclick = function () {
  document.getElementById('paste-wrap').classList.add('hidden');
  document.getElementById('upload-wrap').classList.remove('hidden');
};

document.getElementById('upload-back-btn').onclick = function () {
  document.getElementById('upload-wrap').classList.add('hidden');
  document.getElementById('paste-wrap').classList.remove('hidden');
  _uploadedHands = [];
  document.getElementById('upload-file-list').innerHTML = '';
  document.getElementById('upload-analyse-btn').classList.add('hidden');
  document.getElementById('upload-error').style.display = 'none';
};

document.getElementById('upload-pick-btn').onclick = function () {
  document.getElementById('upload-input').click();
};

document.getElementById('upload-input').onchange = function () {
  var files = this.files;
  if (!files || !files.length) return;
  var errEl = document.getElementById('upload-error');
  var listEl = document.getElementById('upload-file-list');
  errEl.style.display = 'none';
  _uploadedHands = [];
  listEl.innerHTML = '';

  var pending = files.length;
  var fileResults = [];

  for (var i = 0; i < files.length; i++) {
    (function (file) {
      var reader = new FileReader();
      reader.onload = function (e) {
        try {
          var json = JSON.parse(e.target.result);
          var hands = (Array.isArray(json) ? json : (json.hands || [])).filter(function (h) {
            return h.hole && h.hole.length === 2;
          });
          fileResults.push({ name: file.name, count: hands.length, hands: hands });
        } catch (err) {
          fileResults.push({ name: file.name, count: 0, hands: [], error: err.message });
        }
        pending--;
        if (pending === 0) finishUpload(fileResults);
      };
      reader.onerror = function () {
        fileResults.push({ name: file.name, count: 0, hands: [], error: 'Could not read file' });
        pending--;
        if (pending === 0) finishUpload(fileResults);
      };
      reader.readAsText(file);
    })(files[i]);
  }
};

function finishUpload(results) {
  var listEl = document.getElementById('upload-file-list');
  var errEl = document.getElementById('upload-error');
  var analyseBtn = document.getElementById('upload-analyse-btn');
  _uploadedHands = [];
  var html = '';

  for (var i = 0; i < results.length; i++) {
    var r = results[i];
    if (r.error) {
      html += '<div class="desc-text upload-row upload-row-error">' + r.name + ' - error: ' + r.error + '</div>';
    } else if (r.count === 0) {
      html += '<div class="desc-text upload-row upload-row-empty">' + r.name + ' - no valid hands found</div>';
    } else {
      html += '<div class="desc-text upload-row"><strong class="text-gold">' + r.count + '</strong> hands from ' + r.name + '</div>';
      _uploadedHands = _uploadedHands.concat(r.hands);
    }
  }

  listEl.innerHTML = html;

  if (_uploadedHands.length > 0) {
    var total = '<div class="desc-text mt-12"><strong class="text-strong">' + _uploadedHands.length + '</strong> total hands across ' + results.filter(function (r) { return r.count > 0; }).length + ' file(s)</div>';
    listEl.innerHTML += total;
    analyseBtn.classList.remove('hidden');
  } else {
    errEl.textContent = 'No valid hands found in the uploaded files.';
    errEl.style.display = 'block';
    analyseBtn.classList.add('hidden');
  }
}

document.getElementById('upload-analyse-btn').onclick = function () {
  if (!_uploadedHands.length) return;
  var merged = {
    exportedAt: new Date().toISOString(),
    player: detectPlayerFromActions(_uploadedHands) || 'Unknown',
    totalHands: _uploadedHands.length,
    hands: _uploadedHands,
  };
  process(JSON.stringify(merged));
};

// ── BOOT ────────────────────────────────────────────────────────────────────
initStorage(function () {
  checkSavedSession();
});
