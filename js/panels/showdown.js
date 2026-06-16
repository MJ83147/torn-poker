var _showdownChart = null;
var _potSizeChart = null;

function renderShowdown(container, hands, meta, overallData) {
  if (_showdownChart) { _showdownChart.destroy(); _showdownChart = null; }
  if (_potSizeChart) { _potSizeChart.destroy(); _potSizeChart = null; }

  var sorted = hands.slice().sort(function(a, b) { return (a.timestamp || 0) - (b.timestamp || 0); });

  var cash = [];
  for (var i = 0; i < sorted.length; i++) {
    if (isCashHand(sorted[i]) && sorted[i].outcome) cash.push(sorted[i]);
  }

  if (cash.length < 5) {
    container.innerHTML = '<div class="panel-title">Showdown</div>' +
      '<div class="text-body panel-desc">Showdown vs non-showdown P&L breakdown.</div>' +
      '<div class="box panel-verdict">Need at least 5 cash hands with outcomes to show the showdown graph. Keep playing and tracking.</div>';
    return;
  }

  // Chart.js bogs down past ~1000 points, so stride to ~500.
  var cumSd = 0, cumNsd = 0;
  var sdWon = 0, sdTotal = 0, nsdWon = 0, nsdTotal = 0;
  var dataSd = [], dataNsd = [], dataTotal = [], labels = [];
  var CHART_TARGET_POINTS = 500;
  var stride = Math.max(1, Math.floor(cash.length / CHART_TARGET_POINTS));

  var potSdWin = [], potSdLoss = [], potNsdWin = [], potNsdLoss = [];

  for (var i = 0; i < cash.length; i++) {
    var h = cash[i];
    var delta = getHandPnlValue(h);
    var won = h.outcome.result === 'won';
    var pot = h.pot || 0;

    var sd = isShowdown(h);
    if (sd) {
      cumSd += delta;
      sdTotal++;
      if (won) { sdWon++; potSdWin.push(pot); }
      else { potSdLoss.push(pot); }
    } else {
      cumNsd += delta;
      nsdTotal++;
      if (won) { nsdWon++; potNsdWin.push(pot); }
      else { potNsdLoss.push(pot); }
    }

    if (i === cash.length - 1 || i % stride === 0) {
      labels.push(i + 1);
      dataSd.push(cumSd);
      dataNsd.push(cumNsd);
      dataTotal.push(cumSd + cumNsd);
    }
  }

  var avgPotSdWin = Math.round(avg(potSdWin));
  var avgPotSdLoss = Math.round(avg(potSdLoss));
  var avgPotNsdWin = Math.round(avg(potNsdWin));
  var avgPotNsdLoss = Math.round(avg(potNsdLoss));

  var sdWinRate = pct(sdWon, sdTotal);
  var nsdWinRate = pct(nsdWon, nsdTotal);

  var statsHtml = '<div class="mini-row mini-row-2col">';

  statsHtml += '<div class="card mini">';
  statsHtml += '<div class="mini-label-dot flex items-center gap-6 label">' +
    '<span class="line-dot line-dot-blue"></span>Showdown</div>';
  statsHtml += '<div class="value ' + pnlValCls(cumSd) + '">' + fmtPnl(cumSd) + '</div>';
  statsHtml += '<div class="text-meta mini-meta">' + sdTotal + ' hands · ' + (sdWinRate !== null ? sdWinRate + '% win rate' : 'no data') + '</div>';
  statsHtml += '</div>';

  statsHtml += '<div class="card mini">';
  statsHtml += '<div class="mini-label-dot flex items-center gap-6 label">' +
    '<span class="line-dot line-dot-red"></span>Non-Showdown</div>';
  statsHtml += '<div class="value ' + pnlValCls(cumNsd) + '">' + fmtPnl(cumNsd) + '</div>';
  statsHtml += '<div class="text-meta mini-meta">' + nsdTotal + ' hands · ' + (nsdWinRate !== null ? nsdWinRate + '% win rate' : 'no data') + '</div>';
  statsHtml += '</div>';

  statsHtml += '</div>';

  var avgWinPot = (potSdWin.length + potNsdWin.length) > 0 ? avg(potSdWin.concat(potNsdWin)) : 0;
  var avgLossPot = (potSdLoss.length + potNsdLoss.length) > 0 ? avg(potSdLoss.concat(potNsdLoss)) : 0;
  var winLossRatio = avgLossPot > 0 ? (avgWinPot / avgLossPot).toFixed(2) : null;

  var potStatsHtml = '<div class="mini-row mini-row-3col">';
  potStatsHtml += '<div class="card mini">';
  potStatsHtml += '<div class="mini-l label">Avg Pot Won</div>';
  potStatsHtml += '<div class="value val-pos">' + fmt(avgWinPot) + '</div>';
  potStatsHtml += '<div class="text-meta mini-meta">' + (potSdWin.length + potNsdWin.length) + ' hands</div>';
  potStatsHtml += '</div>';

  potStatsHtml += '<div class="card mini">';
  potStatsHtml += '<div class="mini-l label">Avg Pot Lost</div>';
  potStatsHtml += '<div class="value val-neg">' + fmt(avgLossPot) + '</div>';
  potStatsHtml += '<div class="text-meta mini-meta">' + (potSdLoss.length + potNsdLoss.length) + ' hands</div>';
  potStatsHtml += '</div>';

  potStatsHtml += '<div class="card mini">';
  potStatsHtml += '<div class="mini-l label">Win/Loss Pot Ratio</div>';
  potStatsHtml += '<div class="value ' + (winLossRatio !== null ? pnlValCls(winLossRatio - 1) : 'val-neg') + '">' + (winLossRatio !== null ? winLossRatio + 'x' : '-') + '</div>';
  potStatsHtml += '<div class="text-meta mini-meta">Target: above 1.0x</div>';
  potStatsHtml += '</div>';
  potStatsHtml += '</div>';

  mountTemplate(container, 'showdown');

  if (typeof Sections !== 'undefined' && typeof Sections.evaluateSections === 'function' && typeof analyse === 'function') {
    // Prefer the cached filter-scoped d; analyse(hands) here is a full extra pass.
    var d = overallData || analyse(hands);
    if (!overallData && typeof bucketizeAnalysis === 'function') bucketizeAnalysis(d, hands);
    mountFindings(container, 'Showdown', d, hands, 'Showdown picture still building.');
  }

  setSlot(container, 'stats', statsHtml);
  setSlot(container, 'potStats', potStatsHtml);

  var canvas = document.getElementById('showdown-chart');
  if (!canvas) return;

  var colors = getChartColors();

  var potCanvas = document.getElementById('pot-size-chart');
  if (potCanvas) {
    _potSizeChart = createChart(potCanvas, 'bar', {
      labels: ['Showdown Win', 'Showdown Loss', 'Non-SD Win', 'Non-SD Loss'],
      datasets: [{
        label: 'Avg Pot Size',
        data: [avgPotSdWin, avgPotSdLoss, avgPotNsdWin, avgPotNsdLoss],
        backgroundColor: [
          'rgba(74, 158, 255, 0.7)',
          'rgba(74, 158, 255, 0.25)',
          'rgba(231, 76, 60, 0.7)',
          'rgba(231, 76, 60, 0.25)',
        ],
        borderColor: [
          '#4a9eff',
          '#4a9eff',
          '#e74c3c',
          '#e74c3c',
        ],
        borderWidth: 1,
        borderRadius: 4,
      }],
    }, {
      aspectRatio: 3,
      tooltip: chartTooltip(colors, {
        label: function(ctx) {
          var counts = [potSdWin.length, potSdLoss.length, potNsdWin.length, potNsdLoss.length];
          return ' Avg: ' + fmt(ctx.parsed.y) + ' (' + counts[ctx.dataIndex] + ' hands)';
        },
      }),
      scales: {
        x: chartXScale(colors),
        y: chartYScale(colors, { tickCallback: function(val) { return fmt(val); } }),
      },
    });
  }

  _showdownChart = createChart(canvas, 'line', {
    labels: labels,
    datasets: [
      {
        label: 'Total P&L',
        data: dataTotal,
        borderColor: colors.green,
        borderWidth: 2,
        pointRadius: 0,
        pointHitRadius: 6,
        tension: 0.3,
        order: 3,
      },
      {
        label: 'Showdown',
        data: dataSd,
        borderColor: '#4a9eff',
        borderWidth: 1.5,
        pointRadius: 0,
        pointHitRadius: 6,
        tension: 0.3,
        order: 2,
      },
      {
        label: 'Non-Showdown',
        data: dataNsd,
        borderColor: '#e74c3c',
        borderWidth: 1.5,
        pointRadius: 0,
        pointHitRadius: 6,
        tension: 0.3,
        order: 1,
      },
    ],
  }, {
    interaction: { mode: 'index', intersect: false },
    legend: chartLegend(colors),
    tooltip: chartTooltip(colors, {
      title: function(items) { return 'Hand #' + items[0].label; },
      label: function(ctx) { return ' ' + ctx.dataset.label + ': ' + fmtPnl(ctx.parsed.y); },
    }),
    scales: {
      x: chartXScale(colors, { title: 'Hands', tickSize: 9, maxTicksLimit: 8, tickCallback: function(val, idx) { return labels[idx]; } }),
      y: chartYScaleZeroLine(colors, { tickCallback: function(val) { return fmt(val); } }),
    },
  });
}
