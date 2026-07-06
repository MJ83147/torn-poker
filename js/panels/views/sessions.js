// Sessions panel view: the session list, the per-session detail page and its
// charts. Logic (story engine, models) lives in js/panels/sessions.js.

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
  return `<svg style="vertical-align:middle" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">
    <line x1="0" y1="${zeroY}" x2="${w}" y2="${zeroY}" stroke="var(--border)" stroke-width="1"/>
    <polyline points="${poly}" fill="none" stroke="${color}" stroke-width="1.5"/></svg>`;
}

function _sessListRow(s, i) {
  var tour = s.hands.some(function(h) { return !isCashHand(h); });
  var resCls = tour ? 'c-muted' : (s.pnl >= 0 ? 'c-pos' : 'c-neg');
  var resTxt = tour ? 'Tournament' : fmtPnl(s.pnl);
  return `<tr class="link" data-sess-idx="${i}">
    <td>${fmtDate(s.startTs)} <span class="c-dim">${_fmtClock(s.startTs)}</span></td>
    <td>${s.tableId ? getTableLabel(s.tableId) : 'Unknown'}</td>
    <td>${_sessSparkline(s)}</td>
    <td>${s.hands.length}</td>
    <td>${fmtSessionDuration(s.endTs - s.startTs)}</td>
    <td class="${resCls}">${resTxt}</td>
    <td class="c-dim cards-row-cue">&#8250;</td>
  </tr>`;
}

function _sessStatCell(label, val, vs, cls) {
  return `<div class="stat"><div class="eyebrow">${label}</div>
    <div class="value${cls ? ' ' + cls : ''}">${val == null ? '-' : val}</div>
    ${vs ? `<div class="text-micro">${vs}</div>` : ''}</div>`;
}

// Colour a session stat vs the player's baseline: green when it moved the good
// way this session, red the bad way, uncoloured when within ~2 points.
// betterHigher marks which direction is good for that stat.
function _sessStatColor(sessVal, baseVal, betterHigher) {
  if (sessVal == null || baseVal == null) return '';
  var diff = sessVal - baseVal;
  if (Math.abs(diff) < 2) return '';
  return (betterHigher ? diff > 0 : diff < 0) ? 'c-pos' : 'c-neg';
}

function _sessBaseVs(base, key, suffix) {
  var v = base && base.core ? base.core[key] : null;
  return v == null ? '' : ('base ' + v + (suffix || ''));
}

function _pctCell(v) { return v == null ? '-' : v + '%'; }

function _sessPhaseRow(label, ph, pnl) {
  var c = ph && ph.core ? ph.core : {};
  return `<tr><td>${label}</td><td>${ph ? ph.n : 0}</td>
    <td>${_pctCell(c.vpipPct)}</td><td>${_pctCell(c.agg)}</td><td>${_pctCell(c.wtsdPct)}</td>
    <td class="${pnl >= 0 ? 'c-pos' : 'c-neg'}">${fmtPnl(pnl)}</td></tr>`;
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

  var html = '<div class="section"><div class="row center"><button class="btn btn-ghost" data-sess-back>&laquo; All sessions</button></div></div>';

  html += section('', `<div class="box"><div class="row between">
    <div><div class="card-title">${tableName} <span class="c-dim">·</span> ${fmtDate(ctx.startTs)}, ${_fmtClock(ctx.startTs)}</div>
      <div class="text-meta">${fmtSessionDuration(ctx.durationMs)} · ${session.hands.length} hands${seatsTxt ? ' · ' + seatsTxt : ''}</div>
      <button class="btn btn-ghost" data-sess-allhands>View all ${session.hands.length} hands</button></div>
    <div class="text-right"><div class="value value-lg ${resCls}">${resTxt}</div>
      <div class="text-meta">peaked <span class="c-pos">${fmtPnl(peak.cum)}</span> at hand ${peak.i} · low <span class="c-neg">${fmtPnl(low.cum)}</span> at hand ${low.i}</div></div>
  </div></div>`);

  var b = ctx.base;
  var sc = ctx.sd.core, bc = (b && b.core) || {};
  // VPIP has no inherently good/bad direction, so it stays uncoloured.
  html += section('Session Stats', '<div class="stat-grid">' +
    _sessStatCell('VPIP', _pctCell(sc.vpipPct), _sessBaseVs(b, 'vpipPct', '%'), '') +
    _sessStatCell('PFR', _pctCell(sc.pfrPct), _sessBaseVs(b, 'pfrPct', '%'), _sessStatColor(sc.pfrPct, bc.pfrPct, true)) +
    _sessStatCell('Aggression', _pctCell(sc.agg), _sessBaseVs(b, 'agg', '%'), _sessStatColor(sc.agg, bc.agg, true)) +
    _sessStatCell('C-bet', _pctCell(sc.cbetPct), _sessBaseVs(b, 'cbetPct', '%'), _sessStatColor(sc.cbetPct, bc.cbetPct, true)) +
    _sessStatCell('WTSD', _pctCell(sc.wtsdPct), _sessBaseVs(b, 'wtsdPct', '%'), _sessStatColor(sc.wtsdPct, bc.wtsdPct, false)) +
    _sessStatCell('Result', resTxt, session.hands.length + ' hands', resCls) +
    '</div>');

  html += chartSection('Stack through the session', 'sess-c-stack');
  html += chartSection('How your play drifted', 'sess-c-drift');
  if (ctx.durationMs >= 90 * 60000) html += chartSection('Result over time played', 'sess-c-time');

  html += '<div class="section"><div class="section-head">The stories in this session</div>';
  if (stories.length) {
    var cards = stories.map(function(st) {
      return (typeof Sections !== 'undefined' && Sections.renderStoryCard)
        ? Sections.renderStoryCard(_sessStoryToFinding(st)) : '';
    }).join('');
    html += `<div class="row" data-findings>${cards}</div>`;
  } else {
    html += '<div class="row"><div class="container"><div class="box text-body">No clear patterns in this session — it played close to your baseline throughout.</div></div></div>';
  }
  html += '</div>';

  var n = ctx.hands.length, t = Math.floor(n / 3);
  function segPnl(a, e) { var s = 0; for (var k = a; k < e; k++) s += ctx.runline[k].pnl; return s; }
  html += dataTable({
    title: 'By phase of the session',
    head: ['Phase', 'Hands', 'VPIP', 'Aggr', 'WTSD', 'Net'],
    rows: [
      _sessPhaseRow('Early', ctx.phases.early, segPnl(0, t)),
      _sessPhaseRow('Middle', ctx.phases.mid, segPnl(t, 2 * t)),
      _sessPhaseRow('Late', ctx.phases.late, segPnl(2 * t, n)),
    ],
  });

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
  // Wire the story cards' example buttons + expand toggles (shared component).
  if (typeof Sections !== 'undefined' && Sections.wireFindings) Sections.wireFindings(det);

  var back = det.querySelector('[data-sess-back]');
  if (back) back.onclick = function() {
    _destroySessCharts();
    det.setAttribute('hidden', ''); det.innerHTML = '';
    if (list) list.removeAttribute('hidden');
    window.scrollTo(0, 0);
  };

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

  container.innerHTML =
    panelHeader('Sessions', 'Each session is one continuous sitting at one table. Click a session to read its full analysis.') +
    '<div data-slot="sessionsList"></div>' +
    '<div data-slot="sessionsDetail" hidden></div>';

  var base = (typeof State !== 'undefined' && State.overallAnalysis) || overallData || null;
  var sessions = sessionsListModel(hands);
  var listSlot = container.querySelector('[data-slot="sessionsList"]');

  if (!sessions.length) {
    if (listSlot) listSlot.innerHTML = emptyState('No sessions yet. A session needs at least 5 hands played in one sitting at one table.');
    return;
  }

  if (listSlot) listSlot.innerHTML = dataTable({
    head: ['Date', 'Table', '', 'Hands', 'Length', 'Result', ''],
    rows: sessions.map(function(s, i) { return _sessListRow(s, i); }),
  });

  container.querySelectorAll('[data-sess-idx]').forEach(function(row) {
    row.onclick = function() {
      var idx = parseInt(row.getAttribute('data-sess-idx'), 10);
      _openSessionDetail(container, sessions[idx], base);
    };
  });
}
