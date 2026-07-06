// Streets panel view: assembles the UI from shared components + streetModel.

var _streetChart = null;

function renderStreet(container, d, hands) {
  if (_streetChart) { _streetChart.destroy(); _streetChart = null; }
  if (!container) return;

  var m = streetModel(d);

  container.innerHTML =
    panelHeader('Streets', 'Action breakdown by preflop, flop, turn, and river.') +
    panelFindings('Street', d, hands, 'Street-by-street action looks balanced for now.', { group: streetGroups }) +
    section('Hands reaching street', `<div class="list" data-tour="street-bars">${m.seenRows.map(function(r) {
      return barRow(r.street, r.seen, r.max, 'o', r.seen, r.pctOfHands + '%');
    }).join('')}</div>`) +
    section('Your fold % by street', `<div class="list">${m.foldRows.map(function(r) {
      return barRow(r.street, r.fp || 0, 100, r.cls, (r.fp !== null ? r.fp + '%' : '-'), r.folds + ' folds');
    }).join('')}</div>`) +
    (m.hasAvgBet
      ? section('Average bet size by street', `<div class="list">${m.avgBetRows.map(function(r) {
          return barRow(r.street, r.val, r.max, 'o', r.valStr, r.meta);
        }).join('')}</div>`)
      : '') +
    chartSection('Action Breakdown by Street', 'street-action-chart');

  var canvas = document.getElementById('street-action-chart');
  if (!canvas) return;

  var colors = getChartColors();
  _streetChart = createChart(canvas, 'bar', {
    labels: STREETS,
    datasets: [
      { label: 'Fold', data: m.chart.fold, backgroundColor: colors.red + '99', borderColor: colors.red, borderWidth: 1, borderRadius: 2 },
      { label: 'Check', data: m.chart.check, backgroundColor: colors.dim + '66', borderColor: colors.dim, borderWidth: 1, borderRadius: 2 },
      { label: 'Call', data: m.chart.call, backgroundColor: colors.gold + '99', borderColor: colors.gold, borderWidth: 1, borderRadius: 2 },
      { label: 'Raise/Bet', data: m.chart.raise, backgroundColor: colors.green + '99', borderColor: colors.green, borderWidth: 1, borderRadius: 2 },
    ],
  }, {
    legend: chartLegend(colors),
    tooltip: chartTooltip(colors, {
      label: function(ctx) {
        var counts = m.chart.counts[ctx.dataIndex];
        return ' ' + ctx.dataset.label + ': ' + ctx.parsed.y + '% (' + counts[ctx.datasetIndex] + ' actions)';
      },
    }),
    scales: {
      x: chartXScale(colors, { stacked: true }),
      y: chartYScale(colors, { stacked: true, max: 100, tickCallback: function(val) { return val + '%'; } }),
    },
  });
}
