var _trendsCharts = [];

function destroyTrendsCharts() {
  for (var i = 0; i < _trendsCharts.length; i++) {
    if (_trendsCharts[i]) _trendsCharts[i].destroy();
  }
  _trendsCharts = [];
}

// Walk each hand once instead of calling analyse() per day-group — at 20k+
// hands the per-group analyse() turns into multi-second freezes.
function _trendsAccumulate(stats, h) {
  stats.n++;
  if (h.outcome) {
    stats.handsWithOutcome++;
    if (h.outcome.result === 'won') stats.handsWon++;
  }
  var cash = isCashHand(h);
  if (cash && h.outcome) {
    if (h.outcome.result === 'won') stats.totalWonAmount += h.outcome.amount || 0;
    stats.totalInvested += getInvested(h);
  }
  var acts = parseActions(h.actions);
  var heroPlayed = false;
  for (var i = 0; i < acts.length; i++) {
    var a = acts[i];
    if (!a.isMe) continue;
    if (a.type === 'fold') { /* no-op for counters below */ }
    else if (a.type === 'check') stats.checks++;
    else if (a.type === 'call') { stats.calls++; if (!heroPlayed) heroPlayed = true; }
    else if (a.type === 'raise' || a.type === 'bet') { stats.raises++; if (!heroPlayed) heroPlayed = true; }
  }
  if (heroPlayed) stats.vpip++;
}

function _newTrendsAccum() {
  return { n: 0, handsWon: 0, handsWithOutcome: 0, vpip: 0, raises: 0, calls: 0, checks: 0, totalWonAmount: 0, totalInvested: 0 };
}

function renderTrends(container, hands, meta, overallData) {
  destroyTrendsCharts();

  var sorted = hands.slice().sort(function(a, b) { return (a.timestamp || 0) - (b.timestamp || 0); });
  if (sorted.length < 5) {
    mountPanel(container, 'trends', { title: 'Trends', desc: 'Session-over-session charts for win rate, VPIP, and P&L.' });
    var vSlot = container.querySelector('[data-slot="verdict"]');
    if (vSlot) vSlot.innerHTML = '<div class="box lead">Need at least 5 hands to show trends. Keep playing and tracking.</div>';
    return;
  }
  var sessions = [];
  var dayMap = {};
  // Bucket by integer day first, format the label once per distinct day —
  // 20k toLocaleDateString calls cost ~1.7s, ~60 calls is negligible.
  var labelByBucket = {};
  for (var i = 0; i < sorted.length; i++) {
    var ts = sorted[i].timestamp || 0;
    var bucket = Math.floor(ts / 86400000);
    var day = labelByBucket[bucket];
    if (!day) {
      day = new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      labelByBucket[bucket] = day;
    }
    if (!dayMap[day]) { dayMap[day] = []; sessions.push(day); }
    dayMap[day].push(sorted[i]);
  }
  var points = [];
  var cumWon = 0, cumOutcome = 0, cumVpip = 0, cumN = 0, cumRaise = 0, cumCalls = 0, cumChecks = 0, cumCashWon = 0, cumCashInvested = 0;
  for (var si = 0; si < sessions.length; si++) {
    var dayHands = dayMap[sessions[si]];
    var dStats = _newTrendsAccum();
    for (var dhi = 0; dhi < dayHands.length; dhi++) _trendsAccumulate(dStats, dayHands[dhi]);
    cumWon += dStats.handsWon;
    cumOutcome += dStats.handsWithOutcome;
    cumVpip += dStats.vpip;
    cumN += dStats.n;
    cumRaise += dStats.raises;
    cumCalls += dStats.calls;
    cumChecks += dStats.checks;
    cumCashWon += dStats.totalWonAmount;
    cumCashInvested += dStats.totalInvested;
    points.push({
      label: sessions[si],
      hands: dayHands.length,
      cumHands: cumN,
      wr: cumOutcome > 0 ? Math.round(cumWon / cumOutcome * 100) : null,
      vpip: cumN > 0 ? Math.round(cumVpip / cumN * 100) : null,
      agg: calcAggression(cumRaise, cumCalls, cumChecks),
      sessionWr: dStats.handsWithOutcome > 0 ? Math.round(dStats.handsWon / dStats.handsWithOutcome * 100) : null,
      netPnl: cumCashWon - cumCashInvested,
    });
  }

  var colors = getChartColors();
  var dimColor = colors.dim;
  var greenColor = colors.green;
  var goldColor = colors.gold;
  var amberColor = colors.amber;

  var chartConfigs = [
    { id: 'trend-wr', title: 'Cumulative Win Rate', key: 'wr', color: greenColor, suffix: '%', baseline: 50 },
    { id: 'trend-vpip', title: 'Cumulative VPIP', key: 'vpip', color: goldColor, suffix: '%', baseline: null },
    { id: 'trend-agg', title: 'Cumulative Aggression', key: 'agg', color: amberColor, suffix: '%', baseline: null },
    { id: 'trend-pnl', title: 'Cumulative Net P&L (Cash Only)', key: 'netPnl', color: greenColor, suffix: '', baseline: 0 },
  ];

  mountPanel(container, 'trends', { title: 'Trends', desc: 'Session-over-session charts for win rate, VPIP, and P&L.' });

  if (typeof Sections !== 'undefined' && typeof Sections.evaluateSections === 'function') {
    // overallData is cached upstream; reuse it to avoid a second full-pass analyse.
    var sectionD = overallData || (typeof State !== 'undefined' && State.overallAnalysis) || analyse(hands);
    mountFindings(container, 'Tables and Trends', sectionD, hands, 'Direction of travel is steady across sessions.');
  }

  var chartsHtml = '';
  for (var ci = 0; ci < chartConfigs.length; ci++) {
    var cfg = chartConfigs[ci];
    var vals = points.map(function(p) { return p[cfg.key]; }).filter(function(v) { return v !== null; });
    if (vals.length < 2) continue;
    chartsHtml += '<div class="section">' +
      '<div class="section-head">' + cfg.title + '</div>' +
      '<div class="row"><div class="container">' +
      '<canvas id="' + cfg.id + '"></canvas></div></div></div>';
  }
  setSlot(container, 'charts', chartsHtml);

  if (overallData) {
    var bwHtml = renderBestWorstSessions(hands, overallData);
    if (bwHtml) {
      var bwSlot = container.querySelector('[data-slot="bestWorst"]');
      if (bwSlot) { bwSlot.innerHTML = bwHtml; bwSlot.removeAttribute('hidden'); }
    }
  }

  setSlot(container, 'head', renderTableHead(['Date', 'Hands', { html: 'Session ' + tipWrap('Win Rate') }, { html: 'Cumulative ' + tipWrap('Win Rate') }]));
  var rowsHtml = '';
  for (var pi = points.length - 1; pi >= 0; pi--) {
    var pt = points[pi];
    var wrCls2 = pt.sessionWr === null ? 'c-muted' : pnlCls(pt.sessionWr - 50);
    rowsHtml += '<tr class="link" data-trend-idx="' + pi + '"><td>' + pt.label +
      '<span class="c-dim cards-row-cue"> &#8250;</span></td><td>' + pt.hands + '</td>' +
      '<td class="' + wrCls2 + '">' + (pt.sessionWr !== null ? pt.sessionWr + '%' : '-') + '</td>' +
      '<td>' + (pt.wr !== null ? pt.wr + '%' : '-') + '</td></tr>';
  }
  setSlot(container, 'rows', rowsHtml);

  container.querySelectorAll('[data-trend-idx]').forEach(function(row) {
    row.onclick = function() {
      var idx = parseInt(row.getAttribute('data-trend-idx'), 10);
      var pt = points[idx];
      if (!pt) return;
      var day = pt.label;
      var dayHands = dayMap[day];
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
      showExampleHandListModal('Hands on ' + day, recent,
        'Hands played on ' + day + '. ' + dayHands.length + ' hands, ' + wrStr + ', net ' + fmtPnl(net) +
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
            return ctx.tick.value === bl ? dimColor : 'rgba(255,255,255,0.04)';
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
