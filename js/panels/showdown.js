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
    mountPanel(container, 'showdown', { title: 'Showdown', desc: 'Showdown vs non-showdown P&L breakdown.' });
    setSlot(container, 'verdict', '<div class="section"><div class="row"><div class="container"><div class="box lead">Need at least 5 cash hands with outcomes to show the showdown graph. Keep playing and tracking.</div></div></div></div>');
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

  // The hands behind each box, most-recent first, so a click can replay them.
  var sdHands = [];
  var nsdHands = [];
  for (var hi = cash.length - 1; hi >= 0; hi--) {
    if (isShowdown(cash[hi])) sdHands.push(cash[hi]);
    else nsdHands.push(cash[hi]);
  }
  var sdShow = sdHands.slice(0, 15);
  var nsdShow = nsdHands.slice(0, 15);

  var statsHtml = '<div class="cols-2 gap-8">';

  statsHtml += '<div class="stat' + (sdShow.length ? ' stat-clickable' : '') + '"' +
    (sdShow.length ? ' data-sd-box="sd"' : '') + '>';
  statsHtml += '<div class="eyebrow stat-label row center gap-6">' +
    '<span class="swatch swatch-dot" style="background:var(--gto-blue)"></span>Showdown' +
    (sdShow.length ? '<span class="c-dim cards-row-cue"> &middot; view hands &#8250;</span>' : '') + '</div>';
  statsHtml += '<div class="value ' + pnlValCls(cumSd) + '">' + fmtPnl(cumSd) + '</div>';
  statsHtml += '<div class="text-meta">' + sdTotal + ' hands · ' + (sdWinRate !== null ? sdWinRate + '% win rate' : 'no data') + '</div>';
  statsHtml += '</div>';

  statsHtml += '<div class="stat' + (nsdShow.length ? ' stat-clickable' : '') + '"' +
    (nsdShow.length ? ' data-sd-box="nsd"' : '') + '>';
  statsHtml += '<div class="eyebrow stat-label row center gap-6">' +
    '<span class="swatch swatch-dot bg-neg"></span>Non-Showdown' +
    (nsdShow.length ? '<span class="c-dim cards-row-cue"> &middot; view hands &#8250;</span>' : '') + '</div>';
  statsHtml += '<div class="value ' + pnlValCls(cumNsd) + '">' + fmtPnl(cumNsd) + '</div>';
  statsHtml += '<div class="text-meta">' + nsdTotal + ' hands · ' + (nsdWinRate !== null ? nsdWinRate + '% win rate' : 'no data') + '</div>';
  statsHtml += '</div>';

  statsHtml += '</div>';

  var avgWinPot = (potSdWin.length + potNsdWin.length) > 0 ? avg(potSdWin.concat(potNsdWin)) : 0;
  var avgLossPot = (potSdLoss.length + potNsdLoss.length) > 0 ? avg(potSdLoss.concat(potNsdLoss)) : 0;
  var winLossRatio = avgLossPot > 0 ? (avgWinPot / avgLossPot).toFixed(2) : null;

  // Hands behind the pot-size boxes: every won / lost cash hand, recent first.
  var wonHands = [];
  var lostHands = [];
  for (var pwi = cash.length - 1; pwi >= 0; pwi--) {
    if (cash[pwi].outcome && cash[pwi].outcome.result === 'won') wonHands.push(cash[pwi]);
    else if (cash[pwi].outcome) lostHands.push(cash[pwi]);
  }
  var wonShow = wonHands.slice(0, 15);
  var lostShow = lostHands.slice(0, 15);

  var potStatsHtml = '<div class="cols-3 gap-8">';
  potStatsHtml += '<div class="stat' + (wonShow.length ? ' stat-clickable' : '') + '"' +
    (wonShow.length ? ' data-sd-box="won"' : '') + '>';
  potStatsHtml += '<div class="eyebrow stat-label">Avg Pot Won' +
    (wonShow.length ? '<span class="c-dim cards-row-cue"> &middot; view hands &#8250;</span>' : '') + '</div>';
  potStatsHtml += '<div class="value c-pos">' + fmt(avgWinPot) + '</div>';
  potStatsHtml += '<div class="text-meta">' + (potSdWin.length + potNsdWin.length) + ' hands</div>';
  potStatsHtml += '</div>';

  potStatsHtml += '<div class="stat' + (lostShow.length ? ' stat-clickable' : '') + '"' +
    (lostShow.length ? ' data-sd-box="lost"' : '') + '>';
  potStatsHtml += '<div class="eyebrow stat-label">Avg Pot Lost' +
    (lostShow.length ? '<span class="c-dim cards-row-cue"> &middot; view hands &#8250;</span>' : '') + '</div>';
  potStatsHtml += '<div class="value c-neg">' + fmt(avgLossPot) + '</div>';
  potStatsHtml += '<div class="text-meta">' + (potSdLoss.length + potNsdLoss.length) + ' hands</div>';
  potStatsHtml += '</div>';

  potStatsHtml += '<div class="stat">';
  potStatsHtml += '<div class="eyebrow stat-label">Win/Loss Pot Ratio</div>';
  potStatsHtml += '<div class="value ' + (winLossRatio !== null ? pnlValCls(winLossRatio - 1) : 'c-neg') + '">' + (winLossRatio !== null ? winLossRatio + 'x' : '-') + '</div>';
  potStatsHtml += '<div class="text-meta">Target: above 1.0x</div>';
  potStatsHtml += '</div>';
  potStatsHtml += '</div>';

  mountPanel(container, 'showdown', { title: 'Showdown', desc: 'Showdown vs non-showdown P&L breakdown.' });

  if (typeof Sections !== 'undefined' && typeof Sections.evaluateSections === 'function' && typeof analyse === 'function') {
    // Prefer the cached filter-scoped d; analyse(hands) here is a full extra pass.
    var d = overallData || analyse(hands);
    if (!overallData && typeof bucketizeAnalysis === 'function') bucketizeAnalysis(d, hands);
    mountFindings(container, 'Showdown', d, hands, 'Showdown picture still building.');
  }

  setSlot(container, 'stats', statsHtml);
  setSlot(container, 'potStats', potStatsHtml);

  var _sdBoxData = {
    sd: { title: 'Showdown hands', hands: sdShow,
      note: 'Hands you took to showdown. Look at the river action and your hand strength: are you arriving with hands strong enough to call the bets, or paying off value?' },
    nsd: { title: 'Non-showdown hands', hands: nsdShow,
      note: 'Hands won or lost without reaching showdown. These are pots decided by betting: your c-bets, barrels, and folds before the river.' },
    won: { title: 'Hands you won', hands: wonShow,
      note: 'The pots you won. Compare the average size here against the pots you lose. Winning players win bigger pots than they lose.' },
    lost: { title: 'Hands you lost', hands: lostShow,
      note: 'The pots you lost. If the average lost pot is larger than the average won pot, the leak is in how big the pots get when you are behind.' }
  };
  container.querySelectorAll('[data-sd-box]').forEach(function(box) {
    box.onclick = function() {
      var entry = _sdBoxData[box.getAttribute('data-sd-box')];
      if (entry && entry.hands.length) showExampleHandListModal(entry.title, entry.hands, entry.note);
    };
  });

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
