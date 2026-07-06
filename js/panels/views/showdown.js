// Showdown panel view: assembles the UI from shared components +
// showdownModel.

var _showdownChart = null;
var _potSizeChart = null;

function _sdStatBox(key, eyebrowHtml, valueHtml, metaHtml, clickable) {
  return `<div class="stat${clickable ? ' stat-clickable' : ''}"${clickable ? ` data-sd-box="${key}"` : ''}>
    <div class="eyebrow${eyebrowHtml.indexOf('swatch') !== -1 ? ' row center' : ''}">${eyebrowHtml}${clickable ? '<span class="c-dim cards-row-cue"> &middot; view hands &#8250;</span>' : ''}</div>
    <div class="value ${valueHtml.cls}">${valueHtml.text}</div>
    <div class="text-meta">${metaHtml}</div>
  </div>`;
}

function renderShowdown(container, hands, meta, overallData) {
  if (_showdownChart) { _showdownChart.destroy(); _showdownChart = null; }
  if (_potSizeChart) { _potSizeChart.destroy(); _potSizeChart = null; }

  var m = showdownModel(hands);

  if (m.cashCount < 5) {
    container.innerHTML =
      panelHeader('Showdown', 'Showdown vs non-showdown P&L breakdown.') +
      emptyState('Need at least 5 cash hands with outcomes to show the showdown graph. Keep playing and tracking.');
    return;
  }

  var findingsHtml = '';
  if (typeof Sections !== 'undefined' && typeof Sections.evaluateSections === 'function' && typeof analyse === 'function') {
    // Prefer the cached filter-scoped d; analyse(hands) here is a full extra pass.
    var d = overallData || analyse(hands);
    if (!overallData && typeof bucketizeAnalysis === 'function') bucketizeAnalysis(d, hands);
    findingsHtml = panelFindings('Showdown', d, hands, 'Showdown picture still building.');
  }

  var statsHtml = '<div class="stat-grid">' +
    _sdStatBox('sd',
      '<span class="swatch swatch-dot" style="background:var(--gto-blue)"></span>Showdown',
      { cls: pnlValCls(m.sd.pnl), text: fmtPnl(m.sd.pnl) },
      m.sd.total + ' hands · ' + (m.sd.winRate !== null ? m.sd.winRate + '% win rate' : 'no data'),
      m.sd.hands.length > 0) +
    _sdStatBox('nsd',
      '<span class="swatch swatch-dot bg-neg"></span>Non-Showdown',
      { cls: pnlValCls(m.nsd.pnl), text: fmtPnl(m.nsd.pnl) },
      m.nsd.total + ' hands · ' + (m.nsd.winRate !== null ? m.nsd.winRate + '% win rate' : 'no data'),
      m.nsd.hands.length > 0) +
    '</div>';

  var potStatsHtml = '<div class="stat-grid">' +
    _sdStatBox('won', 'Avg Pot Won',
      { cls: 'c-pos', text: fmt(m.won.avgPot) },
      m.won.count + ' hands', m.won.hands.length > 0) +
    _sdStatBox('lost', 'Avg Pot Lost',
      { cls: 'c-neg', text: fmt(m.lost.avgPot) },
      m.lost.count + ' hands', m.lost.hands.length > 0) +
    `<div class="stat">
      <div class="eyebrow">Win/Loss Pot Ratio</div>
      <div class="value ${m.winLossRatio !== null ? pnlValCls(m.winLossRatio - 1) : 'c-neg'}">${m.winLossRatio !== null ? m.winLossRatio + 'x' : '-'}</div>
      <div class="text-meta">Target: above 1.0x</div>
    </div>` +
    '</div>';

  container.innerHTML =
    panelHeader('Showdown', 'Showdown vs non-showdown P&L breakdown.') +
    findingsHtml +
    section('Showdown vs Non-Showdown P&L',
      '<canvas id="showdown-chart"></canvas>' + statsHtml) +
    `<div class="section">
      <div class="section-head">Average Pot Size by Outcome</div>
      <div class="row">
        <div class="container"><canvas id="pot-size-chart"></canvas></div>
        <div class="container">${potStatsHtml}</div>
      </div>
    </div>`;

  var boxData = {
    sd: { title: 'Showdown hands', hands: m.sd.hands,
      note: 'Hands you took to showdown. Look at the river action and your hand strength: are you arriving with hands strong enough to call the bets, or paying off value?' },
    nsd: { title: 'Non-showdown hands', hands: m.nsd.hands,
      note: 'Hands won or lost without reaching showdown. These are pots decided by betting: your c-bets, barrels, and folds before the river.' },
    won: { title: 'Hands you won', hands: m.won.hands,
      note: 'The pots you won. Compare the average size here against the pots you lose. Winning players win bigger pots than they lose.' },
    lost: { title: 'Hands you lost', hands: m.lost.hands,
      note: 'The pots you lost. If the average lost pot is larger than the average won pot, the leak is in how big the pots get when you are behind.' }
  };
  container.querySelectorAll('[data-sd-box]').forEach(function(box) {
    box.onclick = function() {
      var entry = boxData[box.getAttribute('data-sd-box')];
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
        data: [m.potAvgs.sdWin, m.potAvgs.sdLoss, m.potAvgs.nsdWin, m.potAvgs.nsdLoss],
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
          return ' Avg: ' + fmt(ctx.parsed.y) + ' (' + m.potAvgs.counts[ctx.dataIndex] + ' hands)';
        },
      }),
      scales: {
        x: chartXScale(colors),
        y: chartYScale(colors, { tickCallback: function(val) { return fmt(val); } }),
      },
    });
  }

  _showdownChart = createChart(canvas, 'line', {
    labels: m.chart.labels,
    datasets: [
      {
        label: 'Total P&L',
        data: m.chart.total,
        borderColor: colors.green,
        borderWidth: 2,
        pointRadius: 0,
        pointHitRadius: 6,
        tension: 0.3,
        order: 3,
      },
      {
        label: 'Showdown',
        data: m.chart.sd,
        borderColor: '#4a9eff',
        borderWidth: 1.5,
        pointRadius: 0,
        pointHitRadius: 6,
        tension: 0.3,
        order: 2,
      },
      {
        label: 'Non-Showdown',
        data: m.chart.nsd,
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
      x: chartXScale(colors, { title: 'Hands', tickSize: 9, maxTicksLimit: 8, tickCallback: function(val, idx) { return m.chart.labels[idx]; } }),
      y: chartYScaleZeroLine(colors, { tickCallback: function(val) { return fmt(val); } }),
    },
  });
}
