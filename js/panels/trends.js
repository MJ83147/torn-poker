// ── TRENDS PANEL ──────────────────────────────────────────────────────────────

var _trendsCharts = [];

function destroyTrendsCharts() {
  for (var i = 0; i < _trendsCharts.length; i++) {
    if (_trendsCharts[i]) _trendsCharts[i].destroy();
  }
  _trendsCharts = [];
}

function renderTrends(container, hands, meta) {
  destroyTrendsCharts();

  var sorted = hands.slice().sort(function(a, b) { return (a.timestamp || 0) - (b.timestamp || 0); });
  if (sorted.length < 5) {
    container.innerHTML = ins('n', 'Trends', 'Need at least 5 hands to show trends. Keep playing and tracking.', []);
    return;
  }
  var sessions = [];
  var dayMap = {};
  for (var i = 0; i < sorted.length; i++) {
    var ts = sorted[i].timestamp || 0;
    var day = new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    if (!dayMap[day]) { dayMap[day] = []; sessions.push(day); }
    dayMap[day].push(sorted[i]);
  }
  var points = [];
  var cumWon = 0, cumOutcome = 0, cumVpip = 0, cumN = 0, cumRaise = 0, cumActs = 0, cumCashWon = 0, cumCashInvested = 0;
  for (var si = 0; si < sessions.length; si++) {
    var dayHands = dayMap[sessions[si]];
    var dStats = analyse(dayHands);
    cumWon += dStats.handsWon;
    cumOutcome += dStats.handsWithOutcome;
    cumVpip += dStats.vpip;
    cumN += dStats.n;
    cumRaise += dStats.raises;
    cumActs += dStats.totalActs;
    cumCashWon += dStats.totalWonAmount;
    cumCashInvested += dStats.totalInvested;
    points.push({
      label: sessions[si],
      hands: dayHands.length,
      cumHands: cumN,
      wr: cumOutcome > 0 ? Math.round(cumWon / cumOutcome * 100) : null,
      vpip: cumN > 0 ? Math.round(cumVpip / cumN * 100) : null,
      agg: cumActs > 0 ? Math.round(cumRaise / cumActs * 100) : null,
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

  var tHtml = '<div class="panel-title">Trends</div>';
  tHtml += '<div class="panel-desc">Session-over-session charts for win rate, VPIP, and P&L.</div>';
  tHtml += '<div class="p-row"><div class="trends-grid">';
  for (var ci = 0; ci < chartConfigs.length; ci++) {
    var cfg = chartConfigs[ci];
    var vals = points.map(function(p) { return p[cfg.key]; }).filter(function(v) { return v !== null; });
    if (vals.length < 2) continue;
    tHtml += '<div><div class="sec-subtitle mt-0">' + cfg.title + '</div>' +
      '<div class="chart-wrap-full"><canvas id="' + cfg.id + '"></canvas></div></div>';
  }
  tHtml += '</div></div>';

  tHtml += '<div class="p-row"><div class="sec-subtitle mt-0">Session Breakdown</div>';
  tHtml += '<div class="overflow-x"><table class="tbl"><thead><tr><th>Date</th><th>Hands</th><th>Session ' + tipWrap('Win Rate') + '</th><th>Cumulative ' + tipWrap('Win Rate') + '</th><th>' + tipWrap('VPIP') + '</th><th>' + tipWrap('Aggression') + '</th></tr></thead><tbody>';
  for (var pi = points.length - 1; pi >= 0; pi--) {
    var pt = points[pi];
    var wrCol2 = pt.sessionWr !== null ? pnlColor(pt.sessionWr - 50) : 'var(--dim)';
    tHtml += '<tr><td>' + pt.label + '</td><td>' + pt.hands + '</td>' +
      '<td style="color:' + wrCol2 + '">' + (pt.sessionWr !== null ? pt.sessionWr + '%' : '—') + '</td>' +
      '<td>' + (pt.wr !== null ? pt.wr + '%' : '—') + '</td>' +
      '<td>' + (pt.vpip !== null ? pt.vpip + '%' : '—') + '</td>' +
      '<td>' + (pt.agg !== null ? pt.agg + '%' : '—') + '</td></tr>';
  }
  tHtml += '</tbody></table></div></div>';

  var tIns = [];
  if (points.length >= 3) {
    var last = points[points.length - 1];
    var mid = points[Math.floor(points.length / 2)];
    if (last.wr !== null && mid.wr !== null) {
      var diff = last.wr - mid.wr;
      if (diff > 5) {
        var exRecentWin = findExampleHand(function(h) { return h.outcome && h.outcome.result === 'won' && (h.timestamp || 0) >= (sorted[Math.floor(sorted.length / 2)].timestamp || 0); });
        tIns.push(insWithExample('g', 'Win Rate Improving', 'Your cumulative win rate has climbed ' + diff + ' percentage points over the second half of your sessions.', [{ v: mid.wr + '% → ' + last.wr + '%', hi: true }], exRecentWin, 'A recent winning hand from your improving stretch. Whatever adjustments you have made are paying off — keep it up.'));
      } else if (diff < -5) {
        var exRecentLoss = findExampleHand(function(h) { return h.outcome && h.outcome.result !== 'won' && (h.timestamp || 0) >= (sorted[Math.floor(sorted.length / 2)].timestamp || 0); });
        tIns.push(insWithExample('a', 'Win Rate Declining', 'Your cumulative win rate has dropped ' + Math.abs(diff) + ' percentage points. Check for recent leaks or tilt.', [{ v: mid.wr + '% → ' + last.wr + '%', hi: true }], exRecentLoss, 'A recent losing hand during your downswing. Review whether you are tilting, calling too wide, or facing tougher competition.'));
      } else tIns.push(ins('n', 'Win Rate Stable', 'Consistent at around ' + last.wr + '% across sessions.', [{ v: last.wr + '%' }]));
    }
    if (last.vpip !== null && mid.vpip !== null) {
      var vdiff = last.vpip - mid.vpip;
      if (Math.abs(vdiff) > 8) {
        var exVpipShift = findExampleHand(function(h) {
          if (!h.timestamp || h.timestamp < (sorted[Math.floor(sorted.length / 2)].timestamp || 0)) return false;
          var ma = parseActions(h.actions).filter(function(a) { return a.isMe && a.street === 'Preflop'; });
          return vdiff > 0
            ? ma.some(function(a) { return a.type === 'call' || a.type === 'raise'; })
            : ma.some(function(a) { return a.type === 'fold'; });
        });
        tIns.push(insWithExample('a', 'VPIP Shift', 'Your VPIP has moved ' + (vdiff > 0 ? 'up' : 'down') + ' by ' + Math.abs(vdiff) + ' points. Check if your hand selection has changed intentionally.', [{ v: mid.vpip + '% → ' + last.vpip + '%', hi: true }], exVpipShift, vdiff > 0 ? 'A recent hand where you voluntarily entered the pot. Your VPIP has increased — make sure you are not playing too many marginal hands.' : 'A recent hand where you folded preflop. Your VPIP has dropped — make sure you are not being too tight and missing value.'));
      }
    }
  }
  tHtml += '<div class="p-row">' + renderInsights(tIns, 'Trends', 'Keep tracking to build up enough data points for trend insights.') + '</div>';
  container.innerHTML = tHtml;

  // ── Render Chart.js charts ──
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
