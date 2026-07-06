document.getElementById('bb-toggle').onclick = function () {
  _displayBB = !_displayBB;
  this.querySelectorAll('.bb-opt').forEach(function (o) {
    o.classList.toggle('active', _displayBB ? o.dataset.mode === 'bb' : o.dataset.mode === 'dollar');
  });
  if (State.allHands.length) {
    invalidateRenderedPanels();
    _renderHeaderStrip();
    renderActivePanel();
  }
};

var _analysisCache = null;
var _opponentCacheKey = null;
var _panelsRenderedFor = {};

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

function _isIdentityFilter() {
  var tableFilter = document.getElementById('table-filter');
  var playersFilter = document.getElementById('players-filter');
  var tf = tableFilter ? tableFilter.value : 'all';
  var pf = playersFilter ? playersFilter.value : 'all';
  return tf === 'all' && pf === 'all' && State.excludedTables.size === 0;
}

function getFilteredAnalysis() {
  var key = _filterKey();
  if (_analysisCache && _analysisCache.key === key) return _analysisCache;
  // No filter active: the filtered analysis is identical to the overall one
  // computed at import. Reuse it so we skip a full re-analyse and share its
  // warmed insight (evaluateSections) memo.
  if (_isIdentityFilter() && State.overallAnalysis) {
    _analysisCache = { key: key, fd: State.overallAnalysis, filtered: State.allHands };
    return _analysisCache;
  }
  var filtered = State.getFilteredHands();
  var fd = analyse(filtered);
  bucketizeAnalysis(fd, filtered);
  _analysisCache = { key: key, fd: fd, filtered: filtered };
  return _analysisCache;
}

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

// Single import entry point. Shows the loader, then does ALL the heavy work
// (ingest, analysis, per-hand made-hand caches, insight memo, opponent
// profiles) DURING the loader with a real progress bar, so by the time it
// fades every panel is already computed and opens instantly. The loader is
// real work, not decoration. Minimum on-screen time keeps the deal flourish
// readable on tiny sessions.
function bootSession(hands, meta) {
  var loader = document.getElementById('loader');
  var num = document.getElementById('lnum');
  var prog = document.getElementById('lprog');
  var app = document.getElementById('app');
  var cs = document.querySelectorAll('#loader .card-face');
  var clabel = document.getElementById('lclabel');

  // No loader DOM (defensive): do the work synchronously and render.
  if (!loader || !num || !prog || !app) {
    State.setSession(hands, meta);
    var d0 = analyse(State.allHands);
    bucketizeAnalysis(d0, State.allHands);
    State.overallAnalysis = d0;
    invalidateAnalysisCache();
    invalidateRenderedPanels();
    ensureChartJs(function () { render(d0, State.allHands, meta); });
    return;
  }

  num.textContent = '0';
  prog.style.width = '0%';
  cs.forEach(function (c) { c.classList.remove(CSS.SHOW); });
  loader.style.display = 'flex';
  loader.classList.remove(CSS.OUT);
  app.classList.remove(CSS.ON);

  var displayN = hands.length;
  ensureChartJs(function () {});

  // The loader runs the FULL analysis pipeline (ingest, made-hand evaluation,
  // insights, opponent profiles) before the dashboard appears, so when the UI
  // opens every panel is already computed and there is no background grind
  // afterwards. The bar fills only as real work completes and the count tracks
  // it monotonically. Heavy per-hand passes are time-sliced so the bar paints.
  function setProgress(p) {
    var c = Math.max(0, Math.min(1, p));
    prog.style.width = Math.round(c * 100) + '%';
    num.textContent = Math.round(displayN * c);
  }
  function setLabel(t) { if (clabel) clabel.textContent = t; }
  function paintThen(fn) { setTimeout(fn, 16); }

  // Run doBatch(a,b) over [0,total) in time-sliced bursts (~35ms) so the bar
  // can paint without paying a timer round-trip per small chunk.
  function batchLoop(total, batch, doBatch, onProgress, done) {
    var i = 0;
    function run() {
      var start = performance.now();
      do {
        var end = Math.min(total, i + batch);
        doBatch(i, end);
        i = end;
      } while (i < total && (performance.now() - start) < 35);
      onProgress(total ? i / total : 1);
      if (i < total) { setTimeout(run, 0); return; }
      done();
    }
    run();
  }

  var ah = [], AN = 0;
  var warmCard = (typeof Sections === 'object' && Sections.warmCardCaches) ? Sections.warmCardCaches : null;

  // Phase 1: backfill (normalise, fill outcome/board, annotate) - chunked.
  function phaseBackfill() {
    setLabel('Reading hands');
    batchLoop(displayN, 600,
      function (a, b) { backfillHandData(hands.slice(a, b)); },
      function (f) { setProgress(0.25 * f); },
      function () { paintThen(phaseStore); });
  }

  // Phase 2: dedup + persist + set allHands - fast.
  function phaseStore() {
    setLabel('Saving session');
    State.storeHands(hands, meta);
    ah = State.allHands;
    AN = ah.length;
    setProgress(0.28);
    paintThen(phaseWarm);
  }

  // Phase 3: warm every per-hand cache (action parse + made-hand evaluation).
  // This is the dominant cold cost; doing it here makes analyse/bucketize and
  // the insight pass that follow run against warm caches.
  function phaseWarm() {
    setLabel('Evaluating hands');
    batchLoop(AN, 600,
      function (a, b) {
        preparseHands(ah.slice(a, b));
        if (warmCard) for (var k = a; k < b; k++) warmCard(ah[k]);
      },
      function (f) { setProgress(0.28 + 0.34 * f); },
      function () { paintThen(phaseAnalyse); });
  }

  // Phase 4: overall analysis (caches now warm, so this is fast).
  function phaseAnalyse() {
    setLabel('Crunching stats');
    paintThen(function () {
      var d = analyse(ah);
      bucketizeAnalysis(d, ah);
      State.overallAnalysis = d;
      invalidateAnalysisCache();
      invalidateRenderedPanels();
      setProgress(0.78);
      paintThen(phaseInsights);
    });
  }

  // Phase 5: insight pass - one section per turn so the bar keeps moving and the
  // page never freezes on a single heavy section. Memoised by analysis object,
  // so the panel renders that follow are free.
  function phaseInsights() {
    setLabel('Finding leaks');
    if (typeof Sections === 'object' && Sections.evaluateSectionsChunked) {
      Sections.evaluateSectionsChunked(
        State.overallAnalysis, {}, ah,
        function (f) { setProgress(0.78 + 0.18 * f); },
        function () { paintThen(phaseOpponents); }
      );
    } else {
      try { Sections.evaluateSections(State.overallAnalysis, {}, ah); } catch (_) {}
      setProgress(0.96);
      paintThen(phaseOpponents);
    }
  }

  // Phase 6: opponent profiles - fast block.
  function phaseOpponents() {
    setLabel('Profiling opponents');
    paintThen(function () {
      try {
        if (typeof cacheOpponentProfiles === 'function') {
          cacheOpponentProfiles(ah);
          _opponentCacheKey = _filterKey();
        }
      } catch (_) {}
      setProgress(1);
      finish();
    });
  }

  function finish() {
    setLabel('Hands analysed');
    ensureChartJs(function () {
      loader.classList.add(CSS.OUT);
      setTimeout(function () {
        loader.style.display = 'none';
        app.classList.add(CSS.ON);
        render(State.overallAnalysis, State.allHands, meta);
      }, 400);
    });
  }

  // Deal the cards (cosmetic) and start real work immediately, in parallel.
  var di = 0;
  (function deal() {
    if (di < cs.length) { cs[di].classList.add(CSS.SHOW); di++; setTimeout(deal, 80); }
  })();
  phaseBackfill();
}

function invalidateRenderedPanels() {
  _panelsRenderedFor = {};
}

function renderAll() {
  if (!State.allHands.length) return false;
  invalidateAnalysisCache();
  invalidateRenderedPanels();
  _renderHeaderControls();
  renderActivePanelDeferred();
  return true;
}

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
      rb.classList.remove('hidden');
      document.getElementById('restore-btn').onclick = function () {
        var meta = {
          player: playerName,
          exportedAt: new Date().toISOString(),
          schemaVersion: json.schemaVersion || 1,
        };
        try { fetch('https://script.google.com/macros/s/AKfycbyTtG1UMCpYXP15dgKQttFyG4Pe-BG8FoAftoW3oYtMBISS37Ws5lYhPPDJ0zl1GYxyQA/exec', { method: 'POST', body: JSON.stringify({ player: playerName, hands: hands.length }), mode: 'no-cors' }); } catch (_) { }
        bootSession(hands, meta);
      };
    } catch (_) { }
  });
}

function _renderStyleDisplay(d) {
  // The header "You → Target" archetype chip was removed: it confused more than
  // it helped. The target style still defaults to TAG via getUserStyle().
  var host = document.getElementById('style-display');
  if (!host) return;
  host.innerHTML = '';
  host.style.display = 'none';
}

function _maybeShowStyleWelcome(/* d, hands, meta */) {
  // The first-run "Set your target" style picker was removed. The target style
  // still defaults to TAG via getUserStyle(); boot proceeds straight to the
  // dashboard. Kept as a no-op so the boot path caller stays unchanged.
  return false;
}

var _PANELS_NEED_D = { mygame:1, cards:1, position:1, street:1, actions:1, range:1, players:1, trends:1, showdown:1, allin:1 };

var _PANELS_HAVE_BANNER = { welcome:1, mygame:1, cards:1, position:1, street:1, actions:1, range:1, trends:1, sessions:1, showdown:1, log:1, allin:1, players:1 };

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
    case 'hub-sum':
    case 'hub-brk':
    case 'hub-his':  renderHub(container, tabId.slice(4)); break;
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
    case 'sessions': renderSessions(container, filtered, meta, d); break;
    case 'showdown': renderShowdown(container, filtered, meta, d); break;
    case 'log':      renderLog(container, filtered); break;
    case 'allin':    renderAllIn(container, d, filtered); break;
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
  var activeBtn = document.querySelector('.tab-menu-btn[data-tab].active');
  if (activeBtn) return activeBtn.dataset.tab;
  var activeHub = document.querySelector('.tab-menu-btn[data-hub].active');
  return activeHub ? 'hub-' + activeHub.dataset.hub : 'welcome';
}

function renderActivePanel(forceTabId) {
  if (!State.allHands.length) return;
  var tabId = _resolveActiveTabId(forceTabId);
  var filterKey = _filterKey();
  if (_panelsRenderedFor[tabId] === filterKey) return;
  _panelsRenderedFor[tabId] = filterKey;
  _drawPanel(tabId, State.meta);
}

// setTimeout(0) instead of rAF because rAF is throttled when the tab is
// backgrounded, leaving the user staring at a spinner that never resolves.
function renderActivePanelDeferred(forceTabId) {
  if (!State.allHands.length) return;
  var tabId = _resolveActiveTabId(forceTabId);
  var filterKey = _filterKey();
  if (_panelsRenderedFor[tabId] === filterKey) return;
  var container = document.getElementById('p-' + tabId);
  if (container) {
    container.innerHTML = '<div class="panel-loading"><div class="eq-spinner-ring"></div><div class="c-dim">Crunching numbers…</div></div>';
  }
  setTimeout(function () { renderActivePanel(tabId); }, 0);
}

(function () {
  if (typeof switchTab !== 'function') return;
  var _origSwitchTab = switchTab;
  window.switchTab = function (tabId) {
    var result = _origSwitchTab.apply(this, arguments);
    if (State.allHands.length) renderActivePanelDeferred(tabId);
    return result;
  };
})();

function _renderHeaderStrip() {
  var d = State.overallAnalysis;
  if (!d || !d.core) return;
  var c = d.core;
  var sampleNote = d.n < 50
    ? '<div class="sample-warning">⚠ Small sample: ' + d.n + ' hands. The more hands you play and track, the more accurate these stats become. Aim for 100+ hands for reliable patterns.</div>'
    : '';
  document.getElementById('hero-strip').innerHTML = [
    { l: 'Hands', v: d.n, c: 'c-gold' },
    { l: 'Win Rate', v: c.wr !== null ? c.wr + '%' : '-', c: c.wr >= 50 ? 'c-pos' : 'c-neg' },
    { l: 'Net P&L', v: fmtPnlAgg(c.netPnl, c.netPnlBB), c: c.netPnl >= 0 ? 'c-pos' : 'c-neg' },
    { l: 'VPIP', v: c.vpipPct !== null ? c.vpipPct + '%' : '-', c: c.vpipPct > 55 ? 'c-warn' : '' },
    { l: 'Aggression', v: c.agg !== null ? c.agg + '%' : '-', c: c.agg > 25 ? 'c-pos' : 'c-warn' },
    { l: 'vs All-in', v: c.allinFold !== null ? c.allinFold + '% fold' : '-', c: '' },
  ].map(function (h) { return '<div class="hs"><div class="hs-l eyebrow">' + tipWrap(h.l) + '</div><div class="hs-v value ' + h.c + '">' + h.v + '</div></div>'; }).join('');
  var noteEl = document.getElementById('sample-note');
  if (noteEl) noteEl.innerHTML = sampleNote;
}

function _renderHeaderControls() {
  var meta = State.meta;
  var filtered = State.getFilteredHands();
  document.getElementById('page-meta').textContent = (meta && meta.player ? meta.player : '') + (meta && meta.exportedAt ? ' · ' + new Date(meta.exportedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '') + (State.allHands.length && filtered.length < State.allHands.length ? ' · Filtered: ' + filtered.length + '/' + State.allHands.length + ' hands' : '');
}

function render(d, hands, meta) {
  if (_maybeShowStyleWelcome(d, hands, meta)) return;
  if (window.location.hash && window.location.hash.indexOf('#cr=') === 0) {
    try { history.replaceState(null, '', window.location.pathname + window.location.search); } catch (_) {}
  }
  _bootDashboard(meta);
  renderActivePanel();
}

function _bootDashboard(meta) {
  document.getElementById('paste-wrap').classList.add('hidden');
  document.getElementById('upload-wrap').classList.add('hidden');
  document.getElementById('dash').classList.add('on');

  _renderHeaderControls();
  _renderHeaderStrip();

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

  var bbBtn = document.getElementById('bb-toggle');
  if (bbBtn) {
    bbBtn.querySelectorAll('.bb-opt').forEach(function (o) {
      o.classList.toggle('active', _displayBB ? o.dataset.mode === 'bb' : o.dataset.mode === 'dollar');
    });
  }
}

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
    schemaVersion: json.schemaVersion || 1,
  };
  try { fetch('https://script.google.com/macros/s/AKfycbyTtG1UMCpYXP15dgKQttFyG4Pe-BG8FoAftoW3oYtMBISS37Ws5lYhPPDJ0zl1GYxyQA/exec', { method: 'POST', body: JSON.stringify({ player: playerName, hands: hands.length }), mode: 'no-cors' }); } catch (_) { }
  bootSession(hands, meta);
}

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

var _uploadedHands = [];
// Batch schemaVersion across the uploaded files. If ANY contributing file lacks
// v2, the whole batch is treated as v1 (legacy text path) - we never mix a
// verbatim wipe with append/dedup data in one import.
var _uploadedSchemaVersion = 1;

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
          fileResults.push({ name: file.name, count: hands.length, hands: hands, schemaVersion: json.schemaVersion || 1 });
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
  // Start at 2 and demote to 1 if any contributing file is legacy.
  var batchVersion = 2;
  var html = '';

  for (var i = 0; i < results.length; i++) {
    var r = results[i];
    if (r.error) {
      html += '<div class="text-body upload-row upload-row-error">' + r.name + ' - error: ' + r.error + '</div>';
    } else if (r.count === 0) {
      html += '<div class="text-body upload-row upload-row-empty">' + r.name + ' - no valid hands found</div>';
    } else {
      html += '<div class="text-body upload-row"><strong class="c-gold">' + r.count + '</strong> hands from ' + r.name + '</div>';
      _uploadedHands = _uploadedHands.concat(r.hands);
      if (!(r.schemaVersion >= 2)) batchVersion = 1;
    }
  }
  _uploadedSchemaVersion = _uploadedHands.length ? batchVersion : 1;

  listEl.innerHTML = html;

  if (_uploadedHands.length > 0) {
    var total = '<div class="text-body"><strong class="text-strong">' + _uploadedHands.length + '</strong> total hands across ' + results.filter(function (r) { return r.count > 0; }).length + ' file(s)</div>';
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
    schemaVersion: _uploadedSchemaVersion,
    exportedAt: new Date().toISOString(),
    player: detectPlayerFromActions(_uploadedHands) || 'Unknown',
    totalHands: _uploadedHands.length,
    hands: _uploadedHands,
  };
  process(JSON.stringify(merged));
};

// Export the current app data back out as a .json file. This is the mirror of
// the Upload flow: it reads the FULL stored dataset from IndexedDB (loadSaved
// returns every stored hand, including any the dashboard filters out) and wraps
// it in the same schemaVersion 2 envelope the uploader accepts, so the file
// round-trips straight back into this app or into another device.
function downloadJSON(filename, text) {
  try {
    var blob = new Blob([text], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      try { document.body.removeChild(a); URL.revokeObjectURL(url); } catch (e) {}
    }, 0);
    return true;
  } catch (e) {
    console.warn('Export failed', e);
    return false;
  }
}

function exportAppData() {
  var btn = document.getElementById('export-btn');
  if (btn) btn.disabled = true;
  State.loadSaved(function (data) {
    if (btn) btn.disabled = false;
    var hands = (data && data.hands) || State.allHands || [];
    if (!hands.length) return;
    var envelope = {
      schemaVersion: 2,
      player: (data && data.player) || (State.meta && State.meta.player) || 'Unknown',
      exportedAt: new Date().toISOString(),
      totalHands: hands.length,
      hands: hands
    };
    var stamp = new Date().toISOString().replace(/[:.]/g, '-');
    downloadJSON('tcp-app-export-' + stamp + '.json', JSON.stringify(envelope));
  });
}

document.getElementById('export-btn').onclick = function () {
  exportAppData();
};

initStorage(function () {
  checkSavedSession();
});
