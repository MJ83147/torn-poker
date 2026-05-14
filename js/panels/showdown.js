// ── SHOWDOWN PANEL (Blue Line / Red Line) ────────────────────────────────────

var _showdownChart = null;
var _potSizeChart = null;

function renderShowdown(container, hands, meta) {
  // Destroy previous chart instance to prevent canvas reuse errors
  if (_showdownChart) { _showdownChart.destroy(); _showdownChart = null; }
  if (_potSizeChart) { _potSizeChart.destroy(); _potSizeChart = null; }

  var sorted = hands.slice().sort(function(a, b) { return (a.timestamp || 0) - (b.timestamp || 0); });

  // Filter to cash hands with outcomes
  var cash = [];
  for (var i = 0; i < sorted.length; i++) {
    if (isCashHand(sorted[i]) && sorted[i].outcome) cash.push(sorted[i]);
  }

  if (cash.length < 5) {
    container.innerHTML = ins('n', 'Showdown', 'Need at least 5 cash hands with outcomes to show showdown graph. Keep playing and tracking.', []);
    return;
  }

  // Build per-hand P&L split by showdown / non-showdown
  var cumSd = 0, cumNsd = 0;
  var sdWon = 0, sdTotal = 0, nsdWon = 0, nsdTotal = 0;
  var dataSd = [], dataNsd = [], dataTotal = [], labels = [];

  // Pot size tracking per category
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

    labels.push(i + 1);
    dataSd.push(cumSd);
    dataNsd.push(cumNsd);
    dataTotal.push(cumSd + cumNsd);
  }

  // Pot size averages
  var avgPotSdWin = Math.round(avg(potSdWin));
  var avgPotSdLoss = Math.round(avg(potSdLoss));
  var avgPotNsdWin = Math.round(avg(potNsdWin));
  var avgPotNsdLoss = Math.round(avg(potNsdLoss));

  // Summary stats
  var sdWinRate = pct(sdWon, sdTotal);
  var nsdWinRate = pct(nsdWon, nsdTotal);

  var statsHtml = '<div class="mini-row mini-row-2col">';

  statsHtml += '<div class="mini">';
  statsHtml += '<div class="mini-label-dot dim-label">' +
    '<span class="line-dot line-dot-blue"></span>Showdown</div>';
  statsHtml += '<div class="serif-value" style="color:' + pnlColor(cumSd) + ';">' + fmtPnl(cumSd) + '</div>';
  statsHtml += '<div class="mini-meta">' + sdTotal + ' hands · ' + (sdWinRate !== null ? sdWinRate + '% win rate' : 'no data') + '</div>';
  statsHtml += '</div>';

  statsHtml += '<div class="mini">';
  statsHtml += '<div class="mini-label-dot dim-label">' +
    '<span class="line-dot line-dot-red"></span>Non-Showdown</div>';
  statsHtml += '<div class="serif-value" style="color:' + pnlColor(cumNsd) + ';">' + fmtPnl(cumNsd) + '</div>';
  statsHtml += '<div class="mini-meta">' + nsdTotal + ' hands · ' + (nsdWinRate !== null ? nsdWinRate + '% win rate' : 'no data') + '</div>';
  statsHtml += '</div>';

  statsHtml += '</div>';

  // Insights. The section stories now own the headline WTSD verdict and the
  // showdown vs non-showdown narrative, so the legacy SD/NSD verdict cards
  // (Non-Showdown Loss, Winning Without Showdown, Showdown Weakness, Solid
  // Across The Board) retire here. The engine rules and the empty-state hint
  // stay; those produce pattern callouts that the stories do not yet cover.
  var insHtml = '<div class="ins-grid">';
  var hasInsight = false;

  // Append engine insights for showdown panel
  var engineSdIns = InsightEngine.forPanel('showdown', 4);
  for (var esi = 0; esi < engineSdIns.length; esi++) {
    insHtml += renderRuleInsight(engineSdIns[esi]);
    hasInsight = true;
  }

  if (!hasInsight) {
    insHtml += ins('n', 'Showdown Breakdown', 'Track more hands to unlock showdown vs non-showdown insights. Aim for 20+ hands in each category.', [
      { v: sdTotal + ' SD hands' },
      { v: nsdTotal + ' NSD hands' },
    ]);
  }
  insHtml += '</div>';

  // ── Pot Size Analysis ──
  var potHtml = '<div class="sec-subtitle mt-0">Average Pot Size by Outcome</div>';

  // Pot size stat cards
  var avgWinPot = (potSdWin.length + potNsdWin.length) > 0 ? avg(potSdWin.concat(potNsdWin)) : 0;
  var avgLossPot = (potSdLoss.length + potNsdLoss.length) > 0 ? avg(potSdLoss.concat(potNsdLoss)) : 0;
  var winLossRatio = avgLossPot > 0 ? (avgWinPot / avgLossPot).toFixed(2) : null;

  potHtml += '<div class="two-col"><div><div class="chart-wrap"><canvas id="pot-size-chart"></canvas></div></div><div>';
  potHtml += '<div class="mini-row mini-row-3col">';

  potHtml += '<div class="mini">';
  potHtml += '<div class="mini-l dim-label">Avg Pot Won</div>';
  potHtml += '<div class="serif-value" style="color:var(--green);">' + fmt(avgWinPot) + '</div>';
  potHtml += '<div class="mini-meta">' + (potSdWin.length + potNsdWin.length) + ' hands</div>';
  potHtml += '</div>';

  potHtml += '<div class="mini">';
  potHtml += '<div class="mini-l dim-label">Avg Pot Lost</div>';
  potHtml += '<div class="serif-value" style="color:var(--red);">' + fmt(avgLossPot) + '</div>';
  potHtml += '<div class="mini-meta">' + (potSdLoss.length + potNsdLoss.length) + ' hands</div>';
  potHtml += '</div>';

  potHtml += '<div class="mini">';
  potHtml += '<div class="mini-l dim-label">Win/Loss Pot Ratio</div>';
  potHtml += '<div class="serif-value" style="color:' + (winLossRatio !== null ? pnlColor(winLossRatio - 1) : 'var(--red)') + ';">' + (winLossRatio !== null ? winLossRatio + 'x' : '-') + '</div>';
  potHtml += '<div class="mini-meta">Target: above 1.0x</div>';
  potHtml += '</div>';

  potHtml += '</div></div></div>';

  // Pot size insights
  var potInsHtml = '<div class="ins-grid">';
  var hasPotInsight = false;
  var minSample = Math.max(5, Math.round(5 * Math.max(1, Math.sqrt(40 / Math.max(1, cash.length)))));
  // Sample-scaled ratio gates: when pot counts are small, demand a larger gap.
  var _ratioGateSd = 1.3 * Math.max(1, Math.sqrt(40 / Math.max(1, Math.min(potSdLoss.length, potSdWin.length))));
  var _ratioGateNsd = 1.5 * Math.max(1, Math.sqrt(40 / Math.max(1, potNsdLoss.length)));

  if (potSdLoss.length >= minSample && potSdWin.length >= minSample) {
    if (avgPotSdLoss > avgPotSdWin * _ratioGateSd) {
      potInsHtml += ins('r', 'Big Showdown Losses', 'Your average losing showdown pot (' + fmt(avgPotSdLoss) + ') is significantly larger than your winning pot (' + fmt(avgPotSdWin) + '). Fold earlier on the river when the action says you\'re beaten.', [
        { v: 'Win: ' + fmt(avgPotSdWin), hi: false },
        { v: 'Loss: ' + fmt(avgPotSdLoss), hi: true },
      ]);
      hasPotInsight = true;
    }
    if (avgPotSdWin > avgPotSdLoss * _ratioGateSd) {
      potInsHtml += ins('g', 'Extracting Value At Showdown', 'Your winning showdown pots (' + fmt(avgPotSdWin) + ') are larger than your losing ones (' + fmt(avgPotSdLoss) + '). Strong value betting.', [
        { v: 'Win: ' + fmt(avgPotSdWin), hi: true },
        { v: 'Loss: ' + fmt(avgPotSdLoss), hi: false },
      ]);
      hasPotInsight = true;
    }
  }

  if (potNsdLoss.length >= minSample) {
    if (avgPotNsdLoss > avgPotNsdWin * _ratioGateNsd && avgPotNsdLoss > avgPotSdLoss * 0.6) {
      potInsHtml += ins('a', 'Expensive Folds', 'Your average non-showdown loss pot is ' + fmt(avgPotNsdLoss) + '. You invest heavily then fold. Pot-control sooner or fold earlier when you don\'t plan to continue.', [
        { v: 'NSD Loss: ' + fmt(avgPotNsdLoss), hi: true },
      ]);
      hasPotInsight = true;
    }
  }

  if (winLossRatio !== null && winLossRatio >= 1.2 && (potSdWin.length + potNsdWin.length) >= minSample) {
    potInsHtml += ins('g', 'Winning Bigger Than Losing', 'Your win/loss pot ratio is ' + winLossRatio + 'x - you win more when you win than you lose when you lose. Hallmark of a solid strategy.', [
      { v: winLossRatio + 'x ratio', hi: true },
    ]);
    hasPotInsight = true;
  } else if (winLossRatio !== null && winLossRatio < 0.8 && (potSdLoss.length + potNsdLoss.length) >= minSample) {
    potInsHtml += ins('r', 'Losing Bigger Than Winning', 'Your win/loss pot ratio is ' + winLossRatio + 'x - your average losing pot is bigger than your average winning pot. The pots you lose cost more than the ones you take down.', [
      { v: winLossRatio + 'x ratio', hi: true },
    ]);
    hasPotInsight = true;
  }

  if (!hasPotInsight) {
    potInsHtml += ins('n', 'Pot Size Analysis', 'Track more hands to unlock pot size insights.', []);
  }
  potInsHtml += '</div>';

  // Assemble HTML
  var html = '<div class="panel-title">Showdown</div>';
  html += '<div class="panel-desc">Showdown vs non-showdown P&L breakdown.</div>';

  // Section stories render above the per-line breakdown and charts. The Showdown
  // section needs a `d` object; the panel only receives raw hands, so compute it
  // locally. analyse() is the same call app.js uses for every other panel.
  var sectionFindingsHtml = '';
  if (typeof Sections !== 'undefined' && typeof Sections.evaluateSections === 'function' && typeof analyse === 'function') {
    var d = analyse(hands);
    if (typeof bucketizeAnalysis === 'function') bucketizeAnalysis(d, hands);
    var f = Sections.findingsForPanel(Sections.evaluateSections(d, {}, hands), 'Showdown');
    if (f.length) sectionFindingsHtml = Sections.renderFindings(f);
  }
  if (sectionFindingsHtml) html += '<div class="p-row">' + sectionFindingsHtml + '</div>';

  html += '<div class="p-row"><div class="sec-subtitle mt-0">Showdown vs Non-Showdown P&L</div>';
  html += '<div class="chart-wrap-full"><canvas id="showdown-chart"></canvas></div>';
  html += statsHtml + '</div>';
  html += '<div class="p-row">' + insHtml + '</div>';
  html += '<div class="p-row">' + potHtml + '</div>';
  html += '<div class="p-row">' + potInsHtml + '</div>';

  container.innerHTML = html;

  // Render Chart.js chart
  var canvas = document.getElementById('showdown-chart');
  if (!canvas) return;

  var colors = getChartColors();

  // ── Pot Size Bar Chart ──
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
