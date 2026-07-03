var _sessCharts = [];

function _destroySessCharts() {
  for (var i = 0; i < _sessCharts.length; i++) { if (_sessCharts[i]) _sessCharts[i].destroy(); }
  _sessCharts = [];
}

function _fmtClock(ts) {
  if (!ts) return '';
  try { return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }
  catch (e) { return ''; }
}

function _stripTags(html) {
  return String(html || '').replace(/<[^>]+>/g, '');
}

function _sessSparkline(session) {
  var hs = session._sorted || session.hands;
  var cum = 0, pts = [];
  for (var i = 0; i < hs.length; i++) { cum += _sessHandPnl(hs[i]); pts.push(cum); }
  if (pts.length < 2) return '';
  var w = 80, h = 22, min = Math.min.apply(null, pts), max = Math.max.apply(null, pts), rng = (max - min) || 1;
  var poly = pts.map(function(v, i) {
    return (i / (pts.length - 1) * w).toFixed(1) + ',' + (h - 2 - ((v - min) / rng) * (h - 4)).toFixed(1);
  }).join(' ');
  var color = session.pnl >= 0 ? 'var(--green)' : 'var(--red)';
  var zeroY = (h - 2 - ((0 - min) / rng) * (h - 4)).toFixed(1);
  return '<svg class="sess-spark" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" aria-hidden="true">' +
    '<line x1="0" y1="' + zeroY + '" x2="' + w + '" y2="' + zeroY + '" stroke="var(--border)" stroke-width="1"/>' +
    '<polyline points="' + poly + '" fill="none" stroke="' + color + '" stroke-width="1.5"/></svg>';
}

function _renderSessionList(sessions) {
  var head = renderTableHead(['Date', 'Table', '', 'Hands', 'Length', 'Result', '']);
  var rows = '';
  for (var i = 0; i < sessions.length; i++) {
    var s = sessions[i];
    var tour = s.hands.some(function(h) { return !isCashHand(h); });
    var resCls = tour ? 'c-muted' : (s.pnl >= 0 ? 'c-pos' : 'c-neg');
    var resTxt = tour ? 'Tournament' : fmtPnl(s.pnl);
    rows += '<tr class="link" data-sess-idx="' + i + '">' +
      '<td>' + fmtDate(s.startTs) + ' <span class="c-dim">' + _fmtClock(s.startTs) + '</span></td>' +
      '<td>' + (s.tableId ? getTableLabel(s.tableId) : 'Unknown') + '</td>' +
      '<td>' + _sessSparkline(s) + '</td>' +
      '<td>' + s.hands.length + '</td>' +
      '<td>' + fmtSessionDuration(s.endTs - s.startTs) + '</td>' +
      '<td class="' + resCls + '">' + resTxt + '</td>' +
      '<td class="c-dim cards-row-cue">&#8250;</td></tr>';
  }
  return '<div class="section"><div class="row"><div class="container"><div class="overflow-x">' +
    '<table class="table"><thead>' + head + '</thead><tbody>' + rows + '</tbody></table></div></div></div></div>';
}

function _sessStatCell(label, val, vs) {
  return '<div class="stat"><div class="eyebrow">' + label + '</div>' +
    '<div class="sess-stat-v">' + (val == null ? '-' : val) + '</div>' +
    (vs ? '<div class="c-dim sess-stat-vs">' + vs + '</div>' : '') + '</div>';
}

function _sessBaseVs(base, key, suffix) {
  var v = base && base.core ? base.core[key] : null;
  return v == null ? '' : ('base ' + v + (suffix || ''));
}

function _sessFlagWord(flag) {
  return flag === 'leak' ? 'Leak' : flag === 'strength' ? 'Strength' : 'Turning point';
}

function _renderStoryCard(st, i) {
  return '<div class="sess-story">' +
    '<div class="sess-story-head"><span class="sess-lens">' + st.lens + '</span>' +
    '<span class="sess-flag ' + st.flag + '">' + _sessFlagWord(st.flag) + '</span></div>' +
    '<div class="sess-story-title">' + st.title + '</div>' +
    '<div class="sess-prose">' + st.prose + '</div>' +
    (st.linkHands && st.linkHands.length
      ? '<div class="sess-link" data-sess-story="' + i + '">' + (st.linkLabel || 'View hands ›') + '</div>'
      : '') +
    '</div>';
}

function _pctCell(v) { return v == null ? '-' : v + '%'; }

function _sessPhaseRow(label, ph, pnl) {
  var c = ph && ph.core ? ph.core : {};
  return '<tr><td>' + label + '</td><td>' + (ph ? ph.n : 0) + '</td>' +
    '<td>' + _pctCell(c.vpipPct) + '</td><td>' + _pctCell(c.agg) + '</td><td>' + _pctCell(c.wtsdPct) + '</td>' +
    '<td class="' + (pnl >= 0 ? 'c-pos' : 'c-neg') + '">' + fmtPnl(pnl) + '</td></tr>';
}

function _chartSection(title, id) {
  return '<div class="section"><div class="section-head">' + title + '</div>' +
    '<div class="row"><div class="container"><canvas id="' + id + '"></canvas></div></div></div>';
}

function _renderSessionDetail(session, ctx, stories) {
  var tour = session.hands.some(function(h) { return !isCashHand(h); });
  var resCls = tour ? 'c-muted' : (ctx.pnl >= 0 ? 'c-pos' : 'c-neg');
  var resTxt = tour ? 'Tournament' : fmtPnl(ctx.pnl);

  var peak = ctx.runline[0], low = ctx.runline[0];
  for (var i = 0; i < ctx.runline.length; i++) {
    if (ctx.runline[i].cum > peak.cum) peak = ctx.runline[i];
    if (ctx.runline[i].cum < low.cum) low = ctx.runline[i];
  }
  var tableName = session.tableId ? getTableLabel(session.tableId) : 'Unknown table';
  var seatsHand = ctx.hands[0] || {};
  var seatsTxt = seatsHand.seats ? (seatsHand.seats + '-handed') : (seatsHand.tableSize ? (seatsHand.tableSize + '-max') : '');

  var html = '';
  html += '<div class="sess-back" data-sess-back>&#8249; All sessions</div>';

  html += '<div class="section"><div class="row"><div class="container"><div class="box sess-head">';
  html += '<div><div class="card-title">' + tableName + ' <span class="c-dim">·</span> ' + fmtDate(ctx.startTs) + ', ' + _fmtClock(ctx.startTs) + '</div>' +
    '<div class="text-meta">' + fmtSessionDuration(ctx.durationMs) + ' · ' + session.hands.length + ' hands' + (seatsTxt ? (' · ' + seatsTxt) : '') + '</div>' +
    '<div class="sess-link" data-sess-allhands>View all ' + session.hands.length + ' hands ›</div></div>';
  html += '<div class="sess-head-right"><div class="sess-head-res ' + resCls + '">' + resTxt + '</div>' +
    '<div class="text-meta">peaked <span class="c-pos">' + fmtPnl(peak.cum) + '</span> at hand ' + peak.i +
    ' · low <span class="c-neg">' + fmtPnl(low.cum) + '</span> at hand ' + low.i + '</div></div>';
  html += '</div></div></div></div>';

  var b = ctx.base;
  html += '<div class="section"><div class="row"><div class="container"><div class="stat-grid">';
  html += _sessStatCell('VPIP', _pctCell(ctx.sd.core.vpipPct), _sessBaseVs(b, 'vpipPct', '%'));
  html += _sessStatCell('PFR', _pctCell(ctx.sd.core.pfrPct), _sessBaseVs(b, 'pfrPct', '%'));
  html += _sessStatCell('Aggression', _pctCell(ctx.sd.core.agg), _sessBaseVs(b, 'agg', '%'));
  html += _sessStatCell('C-bet', _pctCell(ctx.sd.core.cbetPct), _sessBaseVs(b, 'cbetPct', '%'));
  html += _sessStatCell('WTSD', _pctCell(ctx.sd.core.wtsdPct), _sessBaseVs(b, 'wtsdPct', '%'));
  html += _sessStatCell('Result', resTxt, session.hands.length + ' hands');
  html += '</div></div></div></div>';

  html += _chartSection('Stack through the session', 'sess-c-stack');
  html += _chartSection('How your play drifted', 'sess-c-drift');
  if (ctx.durationMs >= 90 * 60000) html += _chartSection('Result over time played', 'sess-c-time');

  html += '<div class="section"><div class="section-head">The stories in this session</div>';
  if (stories.length) {
    html += '<div class="sess-story-grid">';
    for (var si = 0; si < stories.length; si++) html += _renderStoryCard(stories[si], si);
    html += '</div>';
  } else {
    html += '<div class="row"><div class="container"><div class="box text-body">No clear patterns in this session — it played close to your baseline throughout.</div></div></div>';
  }
  html += '</div>';

  var n = ctx.hands.length, t = Math.floor(n / 3);
  function segPnl(a, e) { var s = 0; for (var k = a; k < e; k++) s += ctx.runline[k].pnl; return s; }
  html += '<div class="section"><div class="section-head">By phase of the session</div>' +
    '<div class="row"><div class="container"><div class="overflow-x"><table class="table"><thead>' +
    renderTableHead(['Phase', 'Hands', 'VPIP', 'Aggr', 'WTSD', 'Net']) + '</thead><tbody>' +
    _sessPhaseRow('Early', ctx.phases.early, segPnl(0, t)) +
    _sessPhaseRow('Middle', ctx.phases.mid, segPnl(t, 2 * t)) +
    _sessPhaseRow('Late', ctx.phases.late, segPnl(2 * t, n)) +
    '</tbody></table></div></div></div></div>';

  return html;
}

function _sessGrad(canvas, color) {
  var ctx = canvas.getContext('2d');
  var grad = ctx.createLinearGradient(0, 0, 0, (canvas.parentElement && canvas.parentElement.clientHeight) || 160);
  grad.addColorStop(0, color + '22');
  grad.addColorStop(1, color + '02');
  return grad;
}

function _buildSessionCharts(ctx) {
  var colors = getChartColors();

  var c1 = document.getElementById('sess-c-stack');
  if (c1) {
    var stackData = ctx.runline.map(function(p) { return p.cum; });
    var stackLabels = ctx.runline.map(function(p) { return p.i; });
    _sessCharts.push(createChart(c1, 'line', {
      labels: stackLabels,
      datasets: [{
        data: stackData, borderColor: colors.gold, borderWidth: 2,
        pointRadius: 0, pointHoverRadius: 4, tension: 0.25, fill: true,
        backgroundColor: _sessGrad(c1, colors.gold), spanGaps: true
      }]
    }, {
      interaction: { mode: 'index', intersect: false },
      tooltip: chartTooltip(colors, {
        title: function(items) { return 'Hand ' + items[0].label; },
        label: function(c) { return ' ' + fmtPnl(c.parsed.y); }
      }),
      scales: {
        x: chartXScale(colors, { tickSize: 9, maxTicksLimit: 8, maxRotation: 0, tickCallback: function(v, idx) { return 'h' + this.getLabelForValue(v); } }),
        y: chartYScaleZeroLine(colors, { tickCallback: function(v) { return fmt(v); } })
      }
    }));
  }

  var c2 = document.getElementById('sess-c-drift');
  if (c2) {
    var ph = ctx.phases;
    _sessCharts.push(createChart(c2, 'bar', {
      labels: ['Early', 'Middle', 'Late'],
      datasets: [
        { label: 'VPIP %', data: [ph.early.core.vpipPct, ph.mid.core.vpipPct, ph.late.core.vpipPct], backgroundColor: colors.gold },
        { label: 'Aggression %', data: [ph.early.core.agg, ph.mid.core.agg, ph.late.core.agg], backgroundColor: colors.amber }
      ]
    }, {
      legend: chartLegend(colors, true),
      tooltip: chartTooltip(colors, { label: function(c) { return ' ' + c.dataset.label + ': ' + c.parsed.y + '%'; } }),
      scales: {
        x: chartXScale(colors, { tickSize: 10 }),
        y: chartYScale(colors, { tickCallback: function(v) { return v + '%'; } })
      }
    }));
  }

  var c3 = document.getElementById('sess-c-time');
  if (c3) {
    var blockMs = 20 * 60000;
    var blocks = [];
    for (var i = 0; i < ctx.hands.length; i++) {
      var h = ctx.hands[i];
      var idx = Math.floor(((h.timestamp || ctx.startTs) - ctx.startTs) / blockMs);
      blocks[idx] = (blocks[idx] || 0) + _sessHandPnl(h);
    }
    var timeData = [], timeLabels = [];
    for (var bi = 0; bi < blocks.length; bi++) {
      timeData.push(blocks[bi] || 0);
      timeLabels.push((bi * 20) + '-' + ((bi + 1) * 20));
    }
    _sessCharts.push(createChart(c3, 'bar', {
      labels: timeLabels,
      datasets: [{
        data: timeData,
        backgroundColor: function(c) { return c.raw >= 0 ? colors.green : colors.red; }
      }]
    }, {
      tooltip: chartTooltip(colors, {
        title: function(items) { return items[0].label + ' min'; },
        label: function(c) { return ' ' + fmtPnl(c.parsed.y); }
      }),
      scales: {
        x: chartXScale(colors, { tickSize: 9 }),
        y: chartYScaleZeroLine(colors, { tickCallback: function(v) { return fmt(v); } })
      }
    }));
  }
}

function _openSessionDetail(container, session, base) {
  _destroySessCharts();
  var res = buildSessionStories(session, base);
  var det = container.querySelector('[data-slot="sessionsDetail"]');
  var list = container.querySelector('[data-slot="sessionsList"]');
  if (!det) return;

  det.innerHTML = _renderSessionDetail(session, res.ctx, res.stories);
  det.removeAttribute('hidden');
  if (list) list.setAttribute('hidden', '');
  window.scrollTo(0, 0);

  var back = det.querySelector('[data-sess-back]');
  if (back) back.onclick = function() {
    _destroySessCharts();
    det.setAttribute('hidden', ''); det.innerHTML = '';
    if (list) list.removeAttribute('hidden');
    window.scrollTo(0, 0);
  };

  det.querySelectorAll('[data-sess-story]').forEach(function(el) {
    var idx = parseInt(el.getAttribute('data-sess-story'), 10);
    var st = res.stories[idx];
    el.onclick = function() {
      if (st && st.linkHands && st.linkHands.length) showExampleHandListModal(st.title, st.linkHands, _stripTags(st.prose));
    };
  });

  var allBtn = det.querySelector('[data-sess-allhands]');
  if (allBtn) allBtn.onclick = function() {
    var label = (session.tableId ? getTableLabel(session.tableId) : 'Session') + ' · all hands';
    showExampleHandListModal(label, res.ctx.hands, 'Every hand in this session, in the order played.');
  };

  var ctx = res.ctx;
  var buildWhenReady = function() { _buildSessionCharts(ctx); };
  if (typeof ensureChartJs === 'function') ensureChartJs(function() { setTimeout(buildWhenReady, 0); });
  else setTimeout(buildWhenReady, 0);
}

function renderSessions(container, hands, meta, overallData) {
  _destroySessCharts();
  mountPanel(container, 'sessions', {
    title: 'Sessions',
    desc: 'Each session is one continuous sitting at one table. Click a session to read its full analysis.'
  });

  var base = (typeof State !== 'undefined' && State.overallAnalysis) || overallData || null;
  var sessions = buildSessions(hands || []);
  var listSlot = container.querySelector('[data-slot="sessionsList"]');

  if (!sessions.length) {
    if (listSlot) listSlot.innerHTML = '<div class="section"><div class="row"><div class="container">' +
      '<div class="box lead">No sessions yet. A session needs at least 5 hands played in one sitting at one table.</div></div></div></div>';
    return;
  }

  for (var i = 0; i < sessions.length; i++) {
    var s = sessions[i];
    s._sorted = s.hands.slice().sort(function(a, b) { return (a.timestamp || 0) - (b.timestamp || 0); });
    s.startTs = s._sorted[0].timestamp || 0;
    s.endTs = s._sorted[s._sorted.length - 1].timestamp || 0;
    s.pnl = sessionPnl(s);
  }
  sessions.sort(function(a, b) { return (b.startTs || 0) - (a.startTs || 0); });

  if (listSlot) listSlot.innerHTML = _renderSessionList(sessions);

  container.querySelectorAll('[data-sess-idx]').forEach(function(row) {
    row.onclick = function() {
      var idx = parseInt(row.getAttribute('data-sess-idx'), 10);
      _openSessionDetail(container, sessions[idx], base);
    };
  });
}
