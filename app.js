// ── APP SHELL (orchestrator) ─────────────────────────────────────────────────

// Tab navigation is handled by click listener in helpers.js

// BB toggle handler
document.getElementById('bb-toggle').onclick = function () {
  _displayBB = !_displayBB;
  this.querySelectorAll('.bb-opt').forEach(function (o) {
    o.classList.toggle('active', _displayBB ? o.dataset.mode === 'bb' : o.dataset.mode === 'dollar');
  });
  if (State.allHands.length) {
    renderAll();
  }
};

// Central re-render: filters hands by table filter + exclusions, then renders
function renderAll() {
  var filtered = State.getFilteredHands();
  if (!filtered.length) return false;
  var fd = analyse(filtered);
  bucketizeAnalysis(fd, filtered);
  cacheOpponentProfiles(filtered);
  render(fd, filtered, State.meta);
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
        showImportLoader(hands.length, function () {
          var rd = analyse(hands);
          bucketizeAnalysis(rd, hands);
          render(rd, hands, meta);
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
      InsightEngine._cacheKey = null;
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
      // Force engine re-cache (style affects targets) and render dashboard.
      InsightEngine._cacheKey = null;
      _renderDashboard(d, hands, meta);
    });
  }
  return true;
}

// ── MAIN RENDER (orchestrator) ──────────────────────────────────────────────
function render(d, hands, meta) {
  // First-time users see the style welcome screen instead of the dashboard.
  if (_maybeShowStyleWelcome(d, hands, meta)) return;
  _renderDashboard(d, hands, meta);
}

function _renderDashboard(d, hands, meta) {
  var activeTab = document.querySelector('.tab.active');
  var activeTabId = activeTab ? activeTab.dataset.tab : null;

  State.modalHands = hands;
  document.getElementById('paste-wrap').classList.add('hidden');
  document.getElementById('upload-wrap').classList.add('hidden');
  document.getElementById('dash').classList.add('on');

  var c = d.core;

  // Header meta
  document.getElementById('page-meta').textContent = meta.player + ' · ' + new Date(meta.exportedAt).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  }) + (State.allHands.length && hands.length < State.allHands.length ? ' · Filtered: ' + hands.length + '/' + State.allHands.length + ' hands' : '');

  // Hero strip
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

  // Run insight engine
  InsightEngine.run(d, hands);

  // Render all panels
  renderWelcome(document.getElementById('p-welcome'), d, hands, meta);
  renderCards(document.getElementById('p-cards'), d, hands);
  renderPosition(document.getElementById('p-position'), d, hands);
  renderStreet(document.getElementById('p-street'), d, hands);
  renderActions(document.getElementById('p-actions'), d, hands);
  renderRange(document.getElementById('p-range'), d, hands);
  renderTables(document.getElementById('p-tables'), hands, State.allHands, State.excludedTables, renderAll);
  renderTrends(document.getElementById('p-trends'), hands, meta, d);
  renderShowdown(document.getElementById('p-showdown'), hands, meta);
  renderLog(document.getElementById('p-log'), hands);
  // saved hands now rendered inside log panel
  renderAllIn(document.getElementById('p-allin'), hands);
  renderPlayers(document.getElementById('p-players'), d, hands);
  // Style Map is embedded inside My Game now (not a standalone panel).
  renderMyGame(document.getElementById('p-mygame'), d, hands);
  _renderStyleDisplay(d);

  // Filter banners (cross-cutting)
  var filterEl = document.getElementById('table-filter');
  var filterVal = filterEl.value;
  var pfFilterVal = pfEl.value;
  var bannerParts = [];
  if (filterVal && filterVal !== 'all') {
    bannerParts.push(filterVal === 'unknown' ? 'Unknown Table' : getTableLabel(Number(filterVal)));
  }
  if (pfFilterVal && pfFilterVal !== 'all') {
    bannerParts.push(pfFilterVal + '-player hands');
  }
  if (bannerParts.length) {
    var bannerHtml = '<div class="filter-banner">Showing stats for ' + bannerParts.join(' · ') + '</div>';
    ['p-welcome', 'p-mygame', 'p-cards', 'p-position', 'p-street', 'p-actions', 'p-range', 'p-trends', 'p-showdown', 'p-log', 'p-allin', 'p-players'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.insertAdjacentHTML('afterbegin', bannerHtml);
    });
  }

  // Table filter handler
  filterEl.onchange = function () {
    var v = this.value;
    if (!renderAll()) {
      alert('No hands for this filter.');
      this.value = 'all';
      return;
    }
    document.getElementById('table-filter').value = v;
  };

  // Players count filter handler
  pfEl.onchange = function () {
    var v = this.value;
    if (!renderAll()) {
      alert('No hands for this filter.');
      this.value = 'all';
      return;
    }
    document.getElementById('players-filter').value = v;
  };

  // Style-display in header is wired via _renderStyleDisplay() above.

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
    document.querySelectorAll('.tab').forEach(function (b, i) { b.classList.toggle('active', i === 0); });
    document.querySelectorAll('.panel').forEach(function (p, i) { p.classList.toggle('on', i === 0); });
    checkSavedSession();
  };

  // Restore active tab across re-renders
  if (activeTabId && activeTabId !== 'welcome') {
    switchTab(activeTabId);
  }

  // Sync BB toggle
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
  showImportLoader(hands.length, function () { render(d, hands, meta); });
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
