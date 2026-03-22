// ── APP SHELL (orchestrator) ─────────────────────────────────────────────────

// Tabs
document.getElementById('tabs').addEventListener('click', function(e) {
  var t = e.target.closest('.tab');
  if (!t) return;
  document.querySelectorAll('.tab').forEach(function(b) { b.classList.remove('active'); });
  t.classList.add('active');
  var id = 'p-' + t.dataset.tab;
  document.querySelectorAll('.panel').forEach(function(p) { p.classList.remove('on'); });
  document.getElementById(id).classList.add('on');
});

// BB toggle handler
document.getElementById('bb-toggle').onclick = function() {
  _displayBB = !_displayBB;
  this.querySelectorAll('.bb-opt').forEach(function(o) {
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
  render(fd, filtered, State.meta);
  return true;
}

// Saved session: check localStorage and wire restore button
function checkSavedSession() {
  var saved = localStorage.getItem('tc_poker_analysis');
  if (!saved) return;
  try {
    var json = JSON.parse(saved);
    var hands = (Array.isArray(json) ? json : (json.hands || [])).filter(function(h) { return h.hole && h.hole.length === 2; });
    if (!hands.length) return;
    var playerName = json.player || detectPlayerFromActions(hands) || 'Unknown';
    var rb = document.getElementById('restore-block');
    var rl = document.getElementById('restore-label');
    var date = json.exportedAt ? new Date(json.exportedAt).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
    }) : '';
    rl.textContent = hands.length + ' hands from ' + playerName + (date ? ' · ' + date : '') + ' found in storage';
    rb.style.display = 'block';
    document.getElementById('restore-btn').onclick = function() {
      var meta = {
        player: playerName,
        exportedAt: new Date().toISOString(),
      };
      State.setSession(hands, meta);
      try { fetch('https://script.google.com/macros/s/AKfycbyTtG1UMCpYXP15dgKQttFyG4Pe-BG8FoAftoW3oYtMBISS37Ws5lYhPPDJ0zl1GYxyQA/exec', { method: 'POST', body: JSON.stringify({ player: playerName, hands: hands.length }), mode: 'no-cors' }); } catch(_) {}
      showImportLoader(hands.length, function() { render(analyse(hands), hands, meta); });
    };
  } catch (_) {}
}

// ── MAIN RENDER (orchestrator) ──────────────────────────────────────────────
function render(d, hands, meta) {
  var activeTab = document.querySelector('.tab.active');
  var activeTabId = activeTab ? activeTab.dataset.tab : null;

  State.modalHands = hands;
  document.getElementById('paste-wrap').style.display = 'none';
  document.getElementById('dash').classList.add('on');

  var netPnl = d.totalWonAmount - d.totalInvested;
  var wr = pct(d.handsWon, d.handsWithOutcome);
  var vpipPct = pct(d.vpip, d.n);
  var aggPct = pct(d.raises, d.totalActs);
  var allinFoldPct = pct(d.foldAllin, d.facedAllin);

  // Header meta
  document.getElementById('page-meta').textContent = meta.player + ' · ' + new Date(meta.exportedAt).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  }) + (State.allHands.length && hands.length < State.allHands.length ? ' · Filtered: ' + hands.length + '/' + State.allHands.length + ' hands' : '');

  // Hero strip
  var sampleNote = d.n < 50
    ? '<div style="padding:12px 32px;font-size:12px;color:var(--amber);background:rgba(212,132,42,0.08);border-bottom:1px solid var(--border);">⚠ Small sample: ' + d.n + ' hands. The more hands you play and track, the more accurate these stats become. Aim for 100+ hands for reliable patterns.</div>'
    : '';
  document.getElementById('hero-strip').innerHTML = [
    { l: 'Hands',      v: d.n,                        c: 'o' },
    { l: 'Win Rate',   v: wr !== null ? wr + '%' : '—', c: wr >= 50 ? 'g' : 'r' },
    { l: 'Net P&L',    v: (netPnl >= 0 ? '+' : '') + fmt(netPnl), c: netPnl >= 0 ? 'g' : 'r' },
    { l: 'VPIP',       v: vpipPct !== null ? vpipPct + '%' : '—', c: vpipPct > 55 ? 'a' : 'w' },
    { l: 'Aggression', v: aggPct !== null ? aggPct + '%' : '—',   c: aggPct > 25 ? 'g' : 'a' },
    { l: 'vs All-in',  v: allinFoldPct !== null ? allinFoldPct + '% fold' : '—', c: 'w' },
  ].map(function(h) { return '<div class="hs"><div class="hs-l">' + tipWrap(h.l) + '</div><div class="hs-v ' + h.c + '">' + h.v + '</div></div>'; }).join('');
  var noteEl = document.getElementById('sample-note');
  if (noteEl) noteEl.innerHTML = sampleNote;

  // Render all panels
  renderWelcome(document.getElementById('p-welcome'), d, hands, meta);
  renderCards(document.getElementById('p-cards'), d, hands);
  renderPosition(document.getElementById('p-position'), d, hands);
  renderStreet(document.getElementById('p-street'), d, hands);
  renderActions(document.getElementById('p-actions'), d, hands);
  renderBets(document.getElementById('p-bets'), d, hands);
  renderRange(document.getElementById('p-range'), d, hands);
  renderTables(document.getElementById('p-tables'), hands, State.allHands, State.excludedTables, renderAll);
  renderTrends(document.getElementById('p-trends'), hands, meta);
  renderShowdown(document.getElementById('p-showdown'), hands, meta);
  renderLog(document.getElementById('p-log'), hands);
  renderPlayers(document.getElementById('p-players'), d, hands);

  // Table filter banner (cross-cutting)
  var filterEl = document.getElementById('table-filter');
  var filterVal = filterEl.value;
  if (filterVal && filterVal !== 'all') {
    var filterLabel = filterVal === 'unknown' ? 'Unknown Table' : getTableLabel(Number(filterVal));
    var bannerHtml = '<div class="filter-banner">Showing stats for ' + filterLabel + '</div>';
    ['p-welcome', 'p-cards', 'p-position', 'p-street', 'p-actions', 'p-bets', 'p-range', 'p-trends', 'p-showdown', 'p-log', 'p-players'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.innerHTML = bannerHtml + el.innerHTML;
    });
  }

  // Table filter handler
  filterEl.onchange = function() {
    var v = this.value;
    if (!renderAll()) {
      alert('No hands for this table.');
      this.value = 'all';
      return;
    }
    document.getElementById('table-filter').value = v;
  };

  // Reset button
  document.getElementById('reset-btn').onclick = function() {
    document.getElementById('paste-wrap').style.display = 'block';
    document.getElementById('jin').value = '';
    document.getElementById('dash').classList.remove('on');
    document.getElementById('table-filter').value = 'all';
    document.getElementById('table-filter').style.display = 'none';
    State.clear();
    document.querySelectorAll('.tab').forEach(function(b, i) { b.classList.toggle('active', i === 0); });
    document.querySelectorAll('.panel').forEach(function(p, i) { p.classList.toggle('on', i === 0); });
    checkSavedSession();
  };

  // Restore active tab across re-renders
  if (activeTabId && activeTabId !== 'welcome') {
    document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
    document.querySelectorAll('.panel').forEach(function(p) { p.classList.remove('on'); });
    var restoreTab = document.querySelector('[data-tab="' + activeTabId + '"]');
    if (restoreTab) {
      restoreTab.classList.add('active');
      document.getElementById('p-' + activeTabId).classList.add('on');
    }
  }

  // Sync BB toggle
  var bbBtn = document.getElementById('bb-toggle');
  if (bbBtn) {
    bbBtn.querySelectorAll('.bb-opt').forEach(function(o) {
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
  var hands = (Array.isArray(json) ? json : (json.hands || [])).filter(function(h) { return h.hole && h.hole.length === 2; });
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
  try { fetch('https://script.google.com/macros/s/AKfycbyTtG1UMCpYXP15dgKQttFyG4Pe-BG8FoAftoW3oYtMBISS37Ws5lYhPPDJ0zl1GYxyQA/exec', { method: 'POST', body: JSON.stringify({ player: playerName, hands: hands.length }), mode: 'no-cors' }); } catch(_) {}
  var d = analyse(hands);
  showImportLoader(hands.length, function() { render(d, hands, meta); });
}

// ── INPUT HANDLERS ──────────────────────────────────────────────────────────
document.getElementById('go-btn').onclick = function() {
  var v = document.getElementById('jin').value.trim();
  if (v) process(v);
  else alert('Paste JSON first.');
};

document.getElementById('paste-btn').onclick = async function() {
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

document.getElementById('jin').addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) process(this.value);
});

document.getElementById('how-it-works-btn').onclick = function() {
  document.getElementById('hiw-modal').classList.add('show');
};
document.getElementById('hiw-close').onclick = function() {
  document.getElementById('hiw-modal').classList.remove('show');
};
document.getElementById('hiw-modal').onclick = function(e) {
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

document.addEventListener('mouseover', function(e) {
  var tip = e.target.closest('.tooltip');
  if (tip) positionTip(tip);
});

document.addEventListener('click', function(e) {
  var tip = e.target.closest('.tooltip');
  document.querySelectorAll('.tooltip.active').forEach(function(t) {
    if (t !== tip) t.classList.remove('active');
  });
  if (tip) {
    tip.classList.toggle('active');
    if (tip.classList.contains('active')) positionTip(tip);
  }
});

window.addEventListener('scroll', function() {
  var active = document.querySelector('.tooltip.active');
  if (active) positionTip(active);
}, true);
window.addEventListener('resize', function() {
  var active = document.querySelector('.tooltip.active');
  if (active) positionTip(active);
});

// ── BOOT ────────────────────────────────────────────────────────────────────
checkSavedSession();
