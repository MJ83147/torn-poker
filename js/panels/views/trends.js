// Trends panel view: assembles the UI from shared components + trendsModel.

// Best & Worst Sessions cards (uses detectSessionPatterns from the logic file).
function renderBestWorstSessions(hands, overallData) {
  var sessions = buildSessions(hands);
  if (sessions.length < 3) return '';

  for (var si = 0; si < sessions.length; si++) {
    sessions[si].pnl = sessionPnl(sessions[si]);
  }
  sessions.sort(function(a, b) { return b.pnl - a.pnl; });

  var best = sessions[0];
  var worst = sessions[sessions.length - 1];
  for (var bi = 1; bi < sessions.length; bi++) {
    if (sessions[bi].pnl === best.pnl && sessions[bi].hands.length > best.hands.length) best = sessions[bi];
  }
  for (var wi = sessions.length - 2; wi >= 0; wi--) {
    if (sessions[wi].pnl === worst.pnl && sessions[wi].hands.length > worst.hands.length) worst = sessions[wi];
  }

  var html = '<div class="section">';
  html += '<div class="section-head">Best &amp; Worst Sessions</div>';
  html += '<div class="row">';

  var sessionPairs = [
    { session: best, label: 'Best Session', frame: 'right' },
    { session: worst, label: 'Worst Session', frame: 'wrong' },
  ];

  for (var sp = 0; sp < sessionPairs.length; sp++) {
    var sess = sessionPairs[sp];
    var s = sess.session;
    var tableName = s.tableId ? getTableLabel(s.tableId) : 'Unknown Table';
    var isTourney = s.hands.some(function(h) { return !isCashHand(h); });
    var pnlDisplay = isTourney ? 'Tournament' : fmtPnl(s.pnl);
    var pnlCellCls = isTourney ? '' : (typeof pnlValCls === 'function' ? pnlValCls(s.pnl) : '');

    var sessStart = fmtDate(s.startTs);
    var lastHand = s.hands[s.hands.length - 1];
    var sessEnd = fmtDate(lastHand && lastHand.timestamp);
    var dateLabel = sessStart ? (sessStart === sessEnd ? sessStart : sessStart + ' - ' + sessEnd) : '';

    html += '<div class="container">';
    html += '<div class="eyebrow">' + sess.label + '</div>';
    html += '<div class="list">';
    if (dateLabel) html += '<div class="text-body">' + dateLabel + '</div>';
    html += '<div class="text-body">' + tableName + ' &middot; ' + s.hands.length + ' hands &middot; <span class="value ' + pnlCellCls + '">' + pnlDisplay + '</span></div>';

    var sessionData = analyse(s.hands);
    var patterns = detectSessionPatterns(sessionData, overallData);

    if (patterns.length) {
      var frameWord = sess.frame === 'right' ? 'what went right' : 'what went wrong';
      html += '<div class="text-body">Patterns: ' + frameWord + ':</div>';
      html += '<ul class="text-body">';
      for (var pi2 = 0; pi2 < patterns.length; pi2++) {
        html += '<li>' + patterns[pi2].text + '</li>';
      }
      html += '</ul>';
    } else if (sess.frame === 'wrong') {
      html += '<div class="text-body">No clear pattern detected. Review the hands below for specific spots.</div>';
    }

    var seeHandsBtnId = 'see-sess-' + Math.random().toString(36).slice(2, 8);
    var sessTitle = sess.label + ' Hands';
    html += '<button class="btn btn-ghost" id="' + seeHandsBtnId + '">Show hands played</button>';
    setTimeout((function(id, title, h2) {
      return function() {
        var el = document.getElementById(id);
        if (el) el.onclick = function() { showExampleHandListModal(title, h2); };
      };
    })(seeHandsBtnId, sessTitle, s.hands), 50);

    html += '</div>';
    html += '</div>';
  }
  html += '</div>';
  html += '</div>';
  return html;
}

var _trendsCharts = [];

function destroyTrendsCharts() {
  for (var i = 0; i < _trendsCharts.length; i++) {
    if (_trendsCharts[i]) _trendsCharts[i].destroy();
  }
  _trendsCharts = [];
}

function renderTrends(container, hands, meta, overallData) {
  destroyTrendsCharts();

  var m = trendsModel(hands);
  if (m.tooFew) {
    container.innerHTML =
      panelHeader('Trends', 'Session-over-session charts for win rate, VPIP, and P&L.') +
      emptyState('Need at least 5 hands to show trends. Keep playing and tracking.');
    return;
  }
  var points = m.points;

  var colors = getChartColors();
  var chartConfigs = [
    { id: 'trend-wr', title: 'Cumulative Win Rate', key: 'wr', color: colors.green, suffix: '%', baseline: 50 },
    { id: 'trend-vpip', title: 'Cumulative VPIP', key: 'vpip', color: colors.gold, suffix: '%', baseline: null },
    { id: 'trend-agg', title: 'Cumulative Aggression', key: 'agg', color: colors.amber, suffix: '%', baseline: null },
    { id: 'trend-pnl', title: 'Cumulative Net P&L (Cash Only)', key: 'netPnl', color: colors.green, suffix: '', baseline: 0 },
  ];

  var findingsHtml = '';
  if (typeof Sections !== 'undefined' && typeof Sections.evaluateSections === 'function') {
    // overallData is cached upstream; reuse it to avoid a second full-pass analyse.
    var sectionD = overallData || (typeof State !== 'undefined' && State.overallAnalysis) || analyse(hands);
    findingsHtml = panelFindings('Tables and Trends', sectionD, hands, 'Direction of travel is steady across sessions.');
  }

  var chartsHtml = chartConfigs.map(function(cfg) {
    var vals = points.map(function(p) { return p[cfg.key]; }).filter(function(v) { return v !== null; });
    return vals.length < 2 ? '' : chartSection(cfg.title, cfg.id);
  }).join('');

  var bwHtml = overallData ? (renderBestWorstSessions(hands, overallData) || '') : '';

  var rowsHtml = [];
  for (var pi = points.length - 1; pi >= 0; pi--) {
    var pt = points[pi];
    var cls = pt.sessionWr === null ? 'c-muted' : pnlCls(pt.sessionWr - 50);
    rowsHtml.push(`<tr class="link" data-trend-idx="${pi}">
      <td>${pt.label}<span class="c-dim cards-row-cue"> &#8250;</span></td>
      <td>${pt.hands}</td>
      <td class="${cls}">${pt.sessionWr !== null ? pt.sessionWr + '%' : '-'}</td>
      <td>${pt.wr !== null ? pt.wr + '%' : '-'}</td>
    </tr>`);
  }

  container.innerHTML =
    panelHeader('Trends', 'Session-over-session charts for win rate, VPIP, and P&L.') +
    findingsHtml +
    chartsHtml +
    bwHtml +
    dataTable({
      title: 'Session Breakdown',
      head: ['Date', 'Hands', { html: 'Session ' + tipWrap('Win Rate') }, { html: 'Cumulative ' + tipWrap('Win Rate') }],
      rows: rowsHtml,
    });

  container.querySelectorAll('[data-trend-idx]').forEach(function(row) {
    row.onclick = function() {
      var idx = parseInt(row.getAttribute('data-trend-idx'), 10);
      var pt = points[idx];
      if (!pt) return;
      var dayHands = m.dayMap[pt.label];
      if (!dayHands || !dayHands.length) return;
      var recent = dayHands.slice().sort(function(a, b) {
        return (b.timestamp || 0) - (a.timestamp || 0);
      }).slice(0, 15);
      var net = 0, withOutcome = 0, won = 0;
      for (var di = 0; di < dayHands.length; di++) {
        var h = dayHands[di];
        net += getHandPnlValue(h) || 0;
        if (h.outcome) { withOutcome++; if (h.outcome.result === 'won') won++; }
      }
      var wrStr = withOutcome > 0 ? Math.round(won / withOutcome * 100) + '% win rate' : 'no outcome data';
      showExampleHandListModal('Hands on ' + pt.label, recent,
        'Hands played on ' + pt.label + '. ' + dayHands.length + ' hands, ' + wrStr + ', net ' + fmtPnl(net) +
        '. Look at how this day played out versus your usual game.');
    };
  });

  var labels = points.map(function(p) { return p.label; });

  for (var ci = 0; ci < chartConfigs.length; ci++) {
    var cfg = chartConfigs[ci];
    var canvas = document.getElementById(cfg.id);
    if (!canvas) continue;

    var data = points.map(function(p) { return p[cfg.key]; });
    var validCount = data.filter(function(v) { return v !== null; }).length;
    if (validCount < 2) continue;

    var suffix = cfg.suffix;
    var baselineVal = cfg.baseline;

    var gridColorFn = (baselineVal !== null)
      ? (function(bl) {
          return function(ctx) {
            return ctx.tick.value === bl ? colors.dim : 'rgba(255,255,255,0.04)';
          };
        })(baselineVal)
      : 'rgba(255,255,255,0.04)';

    var gridWidthFn = (baselineVal !== null)
      ? (function(bl) {
          return function(ctx) {
            return ctx.tick.value === bl ? 1 : 0.5;
          };
        })(baselineVal)
      : 0.5;

    var tooltipLabelFn = (function(s) {
      return function(ctx) {
        var v = ctx.parsed.y;
        return s ? ' ' + v + s : ' ' + fmtPnl(v);
      };
    })(suffix);

    var tickFn = (function(s) {
      return function(val) { return s ? val + s : fmt(val); };
    })(suffix);

    var yScale = (baselineVal !== null)
      ? chartYScaleZeroLine(colors, { tickCallback: tickFn })
      : chartYScale(colors, { tickCallback: tickFn, gridColor: gridColorFn, gridWidth: gridWidthFn });

    var chart = createChart(canvas, 'line', {
      labels: labels,
      datasets: [{
        data: data,
        borderColor: cfg.color,
        borderWidth: 2,
        pointRadius: points.length <= 15 ? 3 : 0,
        pointHoverRadius: 5,
        pointBackgroundColor: cfg.color,
        pointHitRadius: 8,
        tension: 0.3,
        fill: true,
        backgroundColor: (function(c) {
          var ctx = canvas.getContext('2d');
          var grad = ctx.createLinearGradient(0, 0, 0, canvas.parentElement.clientHeight || 160);
          grad.addColorStop(0, c + '22');
          grad.addColorStop(1, c + '02');
          return grad;
        })(cfg.color),
        spanGaps: true,
      }],
    }, {
      interaction: { mode: 'index', intersect: false },
      tooltip: chartTooltip(colors, {
        title: function(items) { return items[0].label; },
        label: tooltipLabelFn,
      }),
      scales: {
        x: chartXScale(colors, { tickSize: 9, maxTicksLimit: 6, maxRotation: 0 }),
        y: yScale,
      },
    });
    _trendsCharts.push(chart);
  }
}
