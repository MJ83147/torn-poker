// ── STREET PANEL ──────────────────────────────────────────────────────────────

var _streetChart = null;

function renderStreet(container, d, hands) {
  if (_streetChart) { _streetChart.destroy(); _streetChart = null; }

  var streets = ['Preflop', 'Flop', 'Turn', 'River'];
  var maxSeen = d.ss.Preflop.seen || 1;
  var stHtml = '<div class="panel-title">Streets</div>';
  stHtml += '<div class="panel-desc">Action breakdown by preflop, flop, turn, and river.</div>';

  // Verdict + section stories render above the existing per-street tables.
  var streetFindings = [];
  if (typeof Sections !== 'undefined' && typeof Sections.evaluateSections === 'function') {
    streetFindings = Sections.findingsForPanel(Sections.evaluateSections(d, {}, hands), 'Street');
    stHtml += Sections.renderVerdict(streetFindings, 'Street-by-street action looks balanced for now.');
    if (streetFindings.length) stHtml += '<div class="p-row">' + Sections.renderFindings(streetFindings) + '</div>';
  }

  stHtml += '<div class="p-row"><div class="two-col">';
  stHtml += '<div><div class="sec-subtitle">Hands reaching street</div><div class="bar-group">' + streets.map(function(s) {
    var seen2 = d.ss[s].seen;
    return barRow(s, seen2, maxSeen, 'o', seen2, pct(seen2, d.n) + '%');
  }).join('') + '</div></div>';
  stHtml += '<div><div class="sec-subtitle">Your fold % by street</div><div class="bar-group">' + streets.map(function(s) {
    var ss2 = d.ss[s];
    var tot2 = ss2.f + ss2.ch + ss2.ca + ss2.ra;
    var fp2 = pct(ss2.f, tot2);
    return barRow(s, fp2 || 0, 100, fp2 > 55 ? 'r' : 'g', (fp2 !== null ? fp2 + '%' : '-'), ss2.f + ' folds');
  }).join('') + '</div></div>';
  stHtml += '</div></div>';

  // Average bet size by street
  var stAvgBets = {};
  var stBetDisplay = {};
  var stMaxAvg = 1;
  streets.forEach(function(s) {
    stAvgBets[s] = Math.round(avg(d.betAmts[s]));
    stBetDisplay[s] = _displayBB && d.betAmtsBB && d.betAmtsBB[s] && d.betAmtsBB[s].length
      ? avg(d.betAmtsBB[s]) : avg(d.betAmts[s]);
    if (stBetDisplay[s] > stMaxAvg) stMaxAvg = stBetDisplay[s];
  });
  if (stBetDisplay.Flop > 0 || stBetDisplay.Turn > 0 || stBetDisplay.River > 0) {
    stHtml += '<div class="p-row"><div class="sec-subtitle mt-0">Average bet size by street</div><div class="bar-group">' +
      streets.filter(function(s) { return stBetDisplay[s] > 0; }).map(function(s) {
        return barRow(s, stBetDisplay[s], stMaxAvg, 'o', fmtAvgAmount(d.betAmts[s], d.betAmtsBB ? d.betAmtsBB[s] : []), d.betAmts[s] ? d.betAmts[s].length + ' bets' : '');
      }).join('') + '</div></div>';
  }

  // Chart: Action breakdown by street
  stHtml += '<div class="p-row"><div class="sec-subtitle mt-0">Action Breakdown by Street</div>';
  stHtml += '<div class="chart-wrap-full"><canvas id="street-action-chart"></canvas></div></div>';

  container.innerHTML = stHtml;

  // ── Render Chart.js stacked bar chart ──
  var canvas = document.getElementById('street-action-chart');
  if (!canvas) return;

  var colors = getChartColors();

  var foldData = [], checkData = [], callData = [], raiseData = [];
  for (var si = 0; si < streets.length; si++) {
    var ss = d.ss[streets[si]];
    var tot = ss.f + ss.ch + ss.ca + ss.ra;
    foldData.push(tot > 0 ? Math.round(ss.f / tot * 100) : 0);
    checkData.push(tot > 0 ? Math.round(ss.ch / tot * 100) : 0);
    callData.push(tot > 0 ? Math.round(ss.ca / tot * 100) : 0);
    raiseData.push(tot > 0 ? Math.round(ss.ra / tot * 100) : 0);
  }

  _streetChart = createChart(canvas, 'bar', {
    labels: streets,
    datasets: [
      {
        label: 'Fold',
        data: foldData,
        backgroundColor: colors.red + '99',
        borderColor: colors.red,
        borderWidth: 1,
        borderRadius: 2,
      },
      {
        label: 'Check',
        data: checkData,
        backgroundColor: colors.dim + '66',
        borderColor: colors.dim,
        borderWidth: 1,
        borderRadius: 2,
      },
      {
        label: 'Call',
        data: callData,
        backgroundColor: colors.gold + '99',
        borderColor: colors.gold,
        borderWidth: 1,
        borderRadius: 2,
      },
      {
        label: 'Raise/Bet',
        data: raiseData,
        backgroundColor: colors.green + '99',
        borderColor: colors.green,
        borderWidth: 1,
        borderRadius: 2,
      },
    ],
  }, {
    legend: chartLegend(colors),
    tooltip: chartTooltip(colors, {
      label: function(ctx) {
        var streetIdx = ctx.dataIndex;
        var ss = d.ss[streets[streetIdx]];
        var counts = [ss.f, ss.ch, ss.ca, ss.ra];
        return ' ' + ctx.dataset.label + ': ' + ctx.parsed.y + '% (' + counts[ctx.datasetIndex] + ' actions)';
      },
    }),
    scales: {
      x: chartXScale(colors, { stacked: true }),
      y: chartYScale(colors, { stacked: true, max: 100, tickCallback: function(val) { return val + '%'; } }),
    },
  });
}
