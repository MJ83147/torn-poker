// Position panel view: assembles the UI from shared components +
// positionModel.

var _positionChart = null;

function renderPosition(container, d, hands) {
  if (_positionChart) { _positionChart.destroy(); _positionChart = null; }
  if (!container) return;

  var m = positionModel(d);

  var rowsHtml = m.rows.map(function(r) {
    var deltaCell = '-';
    if (r.delta !== null) {
      var deltaStr = r.delta === 0
        ? '<span class="c-pos">on target</span>'
        : `<span class="c-warn">${r.delta > 0 ? '+' : ''}${r.delta}%</span>`;
      deltaCell = `${deltaStr} <span class="text-micro">(${r.bandLo}-${r.bandHi}%)</span>`;
    }
    return `<tr class="link" data-pos-row="${r.pos}">
      <td>${tipWrap(r.pos)}<span class="c-dim cards-row-cue"> &#8250;</span></td>
      <td>${r.hands}</td>
      <td>${r.foldPrePct !== null ? r.foldPrePct + '%' : '-'}</td>
      <td>${deltaCell}</td>
      <td class="${pnlCls(r.pnl)}">${fmtPnl(r.pnl)}</td>
      <td>${r.avgPotDisplay}</td>
    </tr>`;
  });

  container.innerHTML =
    panelHeader('Position', 'Which seats make and lose you money.') +
    panelFindings('Position', d, hands, 'No standout positional patterns yet.') +
    dataTable({
      title: 'Stats by Position',
      head: ['Position', 'Hands', { tip: 'Fold Pre' }, 'VPIP &Delta; vs target', { tip: 'Net P&L' }, { tip: 'Avg Pot' }],
      rows: rowsHtml,
    }) +
    (m.rows.length >= 2 ? chartSection('Net P&L by Position', 'position-chart') : '');

  container.querySelectorAll('[data-pos-row]').forEach(function(row) {
    row.onclick = function() {
      var p = row.getAttribute('data-pos-row');
      var played = pickHands(hands, function(h) {
        return (h.position || '?') === p && heroPlayed(h);
      }, 15);
      if (!played.length) return;
      var s = d.posMap[p];
      showExampleHandListModal('Hands played from ' + p, played,
        'Hands you played from ' + p + '. Net P&L at this seat is ' + fmtPnl(s.pnl) +
        ' across ' + s.hands + ' hands. Look for the postflop pattern that repeats at this position.');
    };
  });

  if (m.rows.length < 2) return;
  var canvas = document.getElementById('position-chart');
  if (!canvas) return;

  var colors = getChartColors();
  _positionChart = createChart(canvas, 'bar', {
    labels: m.chart.labels,
    datasets: [
      {
        label: 'Net P&L',
        data: m.chart.pnl,
        backgroundColor: m.chart.pnl.map(function(v) { return (v >= 0 ? colors.green : colors.red) + '99'; }),
        borderColor: m.chart.pnl.map(function(v) { return v >= 0 ? colors.green : colors.red; }),
        borderWidth: 1,
        borderRadius: 4,
      },
    ],
  }, {
    legend: chartLegend(colors, false),
    tooltip: chartTooltip(colors, {
      label: function(c) {
        return ' Net P&L: ' + fmtPnl(c.parsed.y) + ' (' + m.chart.handCounts[c.dataIndex] + ' hands)';
      },
    }),
    scales: {
      x: chartXScale(colors),
      y: chartYScale(colors, { tickCallback: function(val) { return fmtPnl(val); } }),
    },
  });
}
