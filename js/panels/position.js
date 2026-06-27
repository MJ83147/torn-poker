var _positionChart = null;

function renderPosition(container, d, hands) {
  if (_positionChart) { _positionChart.destroy(); _positionChart = null; }
  if (!container) return;

  var activePosOrder = POSITION_ORDER.filter(function(p) { return d.posMap[p] && d.posMap[p].hands > 0; });
  var ctx = getGameContext(d);

  mountPanel(container, 'position', { title: 'Position', desc: 'Which seats make and lose you money.' });
  mountFindings(container, 'Position', d, hands, 'No standout positional patterns yet.');

  setSlot(container, 'head', renderTableHead(['Position', 'Hands', { tip: 'Fold Pre' }, 'VPIP &Delta; vs target', { tip: 'Net P&L' }, { tip: 'Avg Pot' }]));

  setSlot(container, 'rows', activePosOrder.map(function(p) {
    var s = d.posMap[p];
    var fp2 = pct(s.foldPre, s.hands);
    var vp2 = pct(s.vpip, s.hands);
    var avgPot = Math.round(s.pot / s.hands);
    var avgPotDisplay = _displayBB && s.potBBCount > 0
      ? fmtBBRaw(s.potBB / s.potBBCount)
      : fmt(avgPot);
    var band = ctx.band('vpip', p);
    var deltaCell = '-';
    if (band && vp2 !== null) {
      var lo = Math.round(band.tight);
      var hi = Math.round(band.loose);
      var delta = vp2 < lo ? vp2 - lo : (vp2 > hi ? vp2 - hi : 0);
      var deltaStr = delta === 0
        ? '<span class="c-pos">on target</span>'
        : (delta > 0
          ? '<span class="c-warn">+' + delta + '%</span>'
          : '<span class="c-warn">' + delta + '%</span>');
      deltaCell = deltaStr + ' <span class="text-micro">(' + lo + '-' + hi + '%)</span>';
    }
    return '<tr class="link" data-pos-row="' + p + '"><td>' + tipWrap(p) +
      '<span class="c-dim cards-row-cue"> &#8250;</span></td><td>' + s.hands + '</td><td>' + (fp2 !== null ? fp2 + '%' : '-') + '</td><td>' + deltaCell + '</td><td class="' + pnlCls(s.pnl) + '">' + fmtPnl(s.pnl) + '</td><td>' + avgPotDisplay + '</td></tr>';
  }).join(''));

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

  if (activePosOrder.length < 2) return;

  var chartSection = container.querySelector('[data-slot="chartSection"]');
  if (chartSection) chartSection.removeAttribute('hidden');

  var canvas = document.getElementById('position-chart');
  if (!canvas) return;

  var colors = getChartColors();

  var pnlData = activePosOrder.map(function(p) { return d.posMap[p].pnl; });
  var handCounts = activePosOrder.map(function(p) { return d.posMap[p].hands; });
  var bgColors = pnlData.map(function(v) { return (v >= 0 ? colors.green : colors.red) + '99'; });
  var borderColors = pnlData.map(function(v) { return v >= 0 ? colors.green : colors.red; });

  _positionChart = createChart(canvas, 'bar', {
    labels: activePosOrder,
    datasets: [
      {
        label: 'Net P&L',
        data: pnlData,
        backgroundColor: bgColors,
        borderColor: borderColors,
        borderWidth: 1,
        borderRadius: 4,
      },
    ],
  }, {
    legend: chartLegend(colors, false),
    tooltip: chartTooltip(colors, {
      label: function(c) {
        return ' Net P&L: ' + fmtPnl(c.parsed.y) + ' (' + handCounts[c.dataIndex] + ' hands)';
      },
    }),
    scales: {
      x: chartXScale(colors),
      y: chartYScale(colors, { tickCallback: function(val) { return fmtPnl(val); } }),
    },
  });
}
