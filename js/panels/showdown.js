// ── SHOWDOWN PANEL (Blue Line / Red Line) ────────────────────────────────────

var _showdownChart = null;

function renderShowdown(container, hands, meta) {
  // Destroy previous chart instance to prevent canvas reuse errors
  if (_showdownChart) {
    _showdownChart.destroy();
    _showdownChart = null;
  }

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

  for (var i = 0; i < cash.length; i++) {
    var h = cash[i];
    var invested = h.invested || calcInvestmentFromActions(h.actions || []);
    var delta = 0;
    var won = false;

    if (h.outcome.result === 'won') {
      delta = (h.outcome.amount || 0) - invested;
      won = true;
    } else {
      delta = -invested;
    }

    if (isShowdown(h)) {
      cumSd += delta;
      sdTotal++;
      if (won) sdWon++;
    } else {
      cumNsd += delta;
      nsdTotal++;
      if (won) nsdWon++;
    }

    labels.push(i + 1);
    dataSd.push(cumSd);
    dataNsd.push(cumNsd);
    dataTotal.push(cumSd + cumNsd);
  }

  // Summary stats
  var sdWinRate = pct(sdWon, sdTotal);
  var nsdWinRate = pct(nsdWon, nsdTotal);

  var statsHtml = '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-top:20px;">';

  statsHtml += '<div style="padding:14px;background:var(--card);border:1px solid var(--border);border-radius:8px;">';
  statsHtml += '<div style="font-size:11px;color:var(--dim);margin-bottom:6px;display:flex;align-items:center;gap:6px;">' +
    '<span style="display:inline-block;width:10px;height:3px;background:#4a9eff;border-radius:1px;"></span>Showdown</div>';
  statsHtml += '<div style="font-size:20px;font-weight:500;color:' + (cumSd >= 0 ? 'var(--green)' : 'var(--red)') + ';">' + (cumSd >= 0 ? '+' : '') + fmt(cumSd) + '</div>';
  statsHtml += '<div style="font-size:11px;color:var(--dim);margin-top:4px;">' + sdTotal + ' hands · ' + (sdWinRate !== null ? sdWinRate + '% win rate' : 'no data') + '</div>';
  statsHtml += '</div>';

  statsHtml += '<div style="padding:14px;background:var(--card);border:1px solid var(--border);border-radius:8px;">';
  statsHtml += '<div style="font-size:11px;color:var(--dim);margin-bottom:6px;display:flex;align-items:center;gap:6px;">' +
    '<span style="display:inline-block;width:10px;height:3px;background:#e74c3c;border-radius:1px;"></span>Non-Showdown</div>';
  statsHtml += '<div style="font-size:20px;font-weight:500;color:' + (cumNsd >= 0 ? 'var(--green)' : 'var(--red)') + ';">' + (cumNsd >= 0 ? '+' : '') + fmt(cumNsd) + '</div>';
  statsHtml += '<div style="font-size:11px;color:var(--dim);margin-top:4px;">' + nsdTotal + ' hands · ' + (nsdWinRate !== null ? nsdWinRate + '% win rate' : 'no data') + '</div>';
  statsHtml += '</div>';

  statsHtml += '</div>';

  // Insights
  var insHtml = '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:9px;margin-top:20px;">';
  var hasInsight = false;

  if (sdTotal >= 10 && nsdTotal >= 10) {
    if (cumSd > 0 && cumNsd < 0 && Math.abs(cumNsd) > cumSd * 0.3) {
      insHtml += ins('a', 'Red Line Leak', 'You win at showdown but bleed chips in non-showdown pots. Opponents may be exploiting your folds — consider defending more or bluffing less.', [
        { v: 'SD: ' + (cumSd >= 0 ? '+' : '') + fmt(cumSd), hi: true },
        { v: 'NSD: ' + fmt(cumNsd), hi: true },
      ]);
      hasInsight = true;
    }
    if (cumNsd > 0) {
      insHtml += ins('g', 'Winning Without Showdown', 'Your non-showdown line is positive — you are taking down pots with aggression and well-timed bets.', [
        { v: 'NSD: +' + fmt(cumNsd), hi: true },
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
        { v: 'SD: +' + fmt(cumSd) },
        { v: 'NSD: +' + fmt(cumNsd) },
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

  // Assemble HTML
  var html = '<div class="sec-subtitle" style="margin-top:0;">Showdown vs Non-Showdown P&L</div>';
  html += '<div style="position:relative;width:100%;max-width:720px;"><canvas id="showdown-chart"></canvas></div>';
  html += statsHtml;
  html += insHtml;

  container.innerHTML = html;

  // Render Chart.js chart
  var canvas = document.getElementById('showdown-chart');
  if (!canvas) return;

  var styles = getComputedStyle(document.documentElement);
  var dimColor = styles.getPropertyValue('--dim').trim() || '#666';
  var borderColor = styles.getPropertyValue('--border').trim() || '#333';
  var greenColor = styles.getPropertyValue('--green').trim() || '#2ecc71';

  _showdownChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Total P&L',
          data: dataTotal,
          borderColor: greenColor,
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
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 2.8,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          align: 'start',
          labels: {
            color: dimColor,
            font: { family: 'IBM Plex Mono', size: 11 },
            boxWidth: 14,
            boxHeight: 2,
            padding: 16,
            usePointStyle: false,
          },
        },
        tooltip: {
          backgroundColor: 'rgba(20,20,28,0.95)',
          titleColor: '#aaa',
          bodyColor: '#eee',
          borderColor: borderColor,
          borderWidth: 1,
          titleFont: { family: 'IBM Plex Mono', size: 11 },
          bodyFont: { family: 'IBM Plex Mono', size: 11 },
          padding: 10,
          callbacks: {
            title: function(items) {
              return 'Hand #' + items[0].label;
            },
            label: function(ctx) {
              var val = ctx.parsed.y;
              return ' ' + ctx.dataset.label + ': ' + (val >= 0 ? '+' : '') + fmt(val);
            },
          },
        },
      },
      scales: {
        x: {
          display: true,
          title: {
            display: true,
            text: 'Hands',
            color: dimColor,
            font: { family: 'IBM Plex Mono', size: 10 },
          },
          ticks: {
            color: dimColor,
            font: { family: 'IBM Plex Mono', size: 9 },
            maxTicksLimit: 8,
            callback: function(val, idx) {
              return labels[idx];
            },
          },
          grid: {
            color: 'transparent',
          },
          border: {
            color: borderColor,
          },
        },
        y: {
          display: true,
          ticks: {
            color: dimColor,
            font: { family: 'IBM Plex Mono', size: 9 },
            callback: function(val) {
              return fmt(val);
            },
          },
          grid: {
            color: function(ctx) {
              return ctx.tick.value === 0 ? dimColor : 'rgba(255,255,255,0.04)';
            },
            lineWidth: function(ctx) {
              return ctx.tick.value === 0 ? 1 : 0.5;
            },
          },
          border: {
            display: false,
          },
        },
      },
    },
  });
}
