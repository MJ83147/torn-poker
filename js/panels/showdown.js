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
    var invested = getInvested(h);
    var delta = 0;
    var won = false;
    var pot = h.pot || 0;

    if (h.outcome.result === 'won') {
      delta = (h.outcome.amount || 0) - invested;
      won = true;
    } else {
      delta = -invested;
    }

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

  var statsHtml = '<div class="mini-row" style="grid-template-columns:repeat(2,1fr);">';

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

  // Insights
  var insHtml = '<div class="ins-grid">';
  var hasInsight = false;

  if (sdTotal >= 10 && nsdTotal >= 10) {
    if (cumSd > 0 && cumNsd < 0 && Math.abs(cumNsd) > cumSd * 0.3) {
      insHtml += ins('a', 'Red Line Leak', 'You win at showdown but bleed chips in non-showdown pots. Opponents may be exploiting your folds — consider defending more or bluffing less.', [
        { v: 'SD: ' + fmtPnl(cumSd), hi: true },
        { v: 'NSD: ' + fmtPnl(cumNsd), hi: true },
      ]);
      hasInsight = true;
    }
    if (cumNsd > 0) {
      insHtml += ins('g', 'Winning Without Showdown', 'Your non-showdown line is positive — you are taking down pots with aggression and well-timed bets.', [
        { v: 'NSD: ' + fmtPnl(cumNsd), hi: true },
      ]);
      hasInsight = true;
    }
    if (cumSd < 0 && sdTotal >= 15) {
      insHtml += ins('r', 'Showdown Weakness', 'You are losing money at showdown. This may mean you are calling too wide or not value-betting enough with strong hands.', [
        { v: 'SD: ' + fmt(cumSd), hi: true },
        { v: sdWinRate + '% win rate', hi: false },
      ]);
      hasInsight = true;
    }
    if (cumSd > 0 && cumNsd >= 0) {
      insHtml += ins('g', 'Solid Across the Board', 'Both your showdown and non-showdown lines are positive. You are winning with strong hands and also taking down pots without needing to show.', [
        { v: 'SD: ' + fmtPnl(cumSd) },
        { v: 'NSD: ' + fmtPnl(cumNsd) },
      ]);
      hasInsight = true;
    }
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
  potHtml += '<div class="mini-row" style="grid-template-columns:repeat(3,1fr);">';

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
  potHtml += '<div class="serif-value" style="color:' + (winLossRatio !== null ? pnlColor(winLossRatio - 1) : 'var(--red)') + ';">' + (winLossRatio !== null ? winLossRatio + 'x' : '—') + '</div>';
  potHtml += '<div class="mini-meta">Target: above 1.0x</div>';
  potHtml += '</div>';

  potHtml += '</div></div></div>';

  // Pot size insights
  var potInsHtml = '<div class="ins-grid">';
  var hasPotInsight = false;
  var minSample = 5;

  if (potSdLoss.length >= minSample && potSdWin.length >= minSample) {
    if (avgPotSdLoss > avgPotSdWin * 1.3) {
      potInsHtml += ins('r', 'Big Showdown Losses', 'Your average losing showdown pot (' + fmt(avgPotSdLoss) + ') is significantly larger than your winning pot (' + fmt(avgPotSdWin) + '). You may be calling too much in big pots with second-best hands, or not folding when the action tells you to.', [
        { v: 'Win: ' + fmt(avgPotSdWin), hi: false },
        { v: 'Loss: ' + fmt(avgPotSdLoss), hi: true },
      ]);
      hasPotInsight = true;
    }
    if (avgPotSdWin > avgPotSdLoss * 1.3) {
      potInsHtml += ins('g', 'Extracting Value at Showdown', 'Your winning showdown pots (' + fmt(avgPotSdWin) + ') are larger than your losing ones (' + fmt(avgPotSdLoss) + '). You are building bigger pots when you have the best hand — strong value betting.', [
        { v: 'Win: ' + fmt(avgPotSdWin), hi: true },
        { v: 'Loss: ' + fmt(avgPotSdLoss), hi: false },
      ]);
      hasPotInsight = true;
    }
  }

  if (potNsdLoss.length >= minSample) {
    if (avgPotNsdLoss > avgPotNsdWin * 1.5 && avgPotNsdLoss > avgPotSdLoss * 0.6) {
      potInsHtml += ins('a', 'Expensive Folds', 'Your average non-showdown loss pot is ' + fmt(avgPotNsdLoss) + '. You are investing heavily then folding. Consider pot-controlling more or folding earlier when you do not intend to continue.', [
        { v: 'NSD Loss: ' + fmt(avgPotNsdLoss), hi: true },
      ]);
      hasPotInsight = true;
    }
  }

  if (winLossRatio !== null && winLossRatio >= 1.2 && (potSdWin.length + potNsdWin.length) >= minSample) {
    potInsHtml += ins('g', 'Winning Bigger Than Losing', 'Your win/loss pot ratio is ' + winLossRatio + 'x — you win more when you win than you lose when you lose. This is the hallmark of a solid strategy.', [
      { v: winLossRatio + 'x ratio', hi: true },
    ]);
    hasPotInsight = true;
  } else if (winLossRatio !== null && winLossRatio < 0.8 && (potSdLoss.length + potNsdLoss.length) >= minSample) {
    potInsHtml += ins('r', 'Losing Bigger Than Winning', 'Your win/loss pot ratio is ' + winLossRatio + 'x — your average losing pot is bigger than your average winning pot. This means the pots you lose are more expensive than the ones you take down.', [
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
