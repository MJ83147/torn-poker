var _streetChart = null;

// One-line read of a street for when no leak fired there, so every street
// (Preflop / Flop / Turn / River) still shows something useful.
function streetSummaryNote(d, street) {
  var ss = d.ss && d.ss[street];
  if (!ss) return 'No ' + street.toLowerCase() + ' data yet.';
  var reached = ss.seen || 0;
  var tot = ss.f + ss.ch + ss.ca + ss.ra;
  if (street !== 'Preflop' && reached === 0) {
    return 'You rarely see the ' + street.toLowerCase() + ' in this sample.';
  }
  if (!tot) return 'Reached the ' + street.toLowerCase() + ' ' + reached + ' times. Nothing to flag.';
  var fp = pct(ss.f, tot);
  var aggP = pct(ss.ra, tot);
  var passP = pct(ss.ch + ss.ca, tot);
  var lead = street === 'Preflop'
    ? 'Across all hands you'
    : 'On ' + reached + ' ' + street.toLowerCase() + 's you';
  return lead + ' raise or bet ' + (aggP || 0) + '%, check or call ' + (passP || 0) +
    '%, and fold ' + (fp || 0) + '%. No leak flagged here.';
}

// Render the Street story cards grouped under Preflop / Flop / Turn / River.
function mountStreetFindings(container, d, hands) {
  if (typeof Sections === 'undefined' || typeof Sections.evaluateSections !== 'function') return;
  var findings = Sections.findingsForPanel(Sections.evaluateSections(d, {}, hands), 'Street');
  setSlot(container, 'verdict', Sections.renderVerdict(findings, 'Street-by-street action looks balanced for now.'));

  var STREET_ORDER = ['Preflop', 'Flop', 'Turn', 'River'];
  var byStreet = { Preflop: [], Flop: [], Turn: [], River: [] };
  for (var i = 0; i < findings.length; i++) {
    var st = findings[i].street;
    if (!byStreet[st]) st = 'Flop';
    byStreet[st].push(findings[i]);
  }
  var groups = STREET_ORDER.map(function(s) {
    return { label: s, findings: byStreet[s], emptyNote: streetSummaryNote(d, s) };
  });

  var slot = container.querySelector('[data-slot="findings"]');
  if (slot) {
    slot.innerHTML = Sections.renderFindingsGrouped(groups);
    slot.removeAttribute('hidden');
  }
}

function renderStreet(container, d, hands) {
  if (_streetChart) { _streetChart.destroy(); _streetChart = null; }
  if (!container) return;

  var streets = STREETS;
  var maxSeen = d.ss.Preflop.seen || 1;

  mountPanel(container, 'street', { title: 'Streets', desc: 'Action breakdown by preflop, flop, turn, and river.' });
  mountStreetFindings(container, d, hands);

  setSlot(container, 'seenBars', streets.map(function(s) {
    var seen2 = d.ss[s].seen;
    return barRow(s, seen2, maxSeen, 'o', seen2, pct(seen2, d.n) + '%');
  }).join(''));

  setSlot(container, 'foldBars', streets.map(function(s) {
    var ss2 = d.ss[s];
    var tot2 = ss2.f + ss2.ch + ss2.ca + ss2.ra;
    var fp2 = pct(ss2.f, tot2);
    return barRow(s, fp2 || 0, 100, fp2 > 55 ? 'r' : 'g', (fp2 !== null ? fp2 + '%' : '-'), ss2.f + ' folds');
  }).join(''));

  var stBetDisplay = {};
  var stMaxAvg = 1;
  streets.forEach(function(s) {
    stBetDisplay[s] = _displayBB && d.betAmtsBB && d.betAmtsBB[s] && d.betAmtsBB[s].length
      ? avg(d.betAmtsBB[s]) : avg(d.betAmts[s]);
    if (stBetDisplay[s] > stMaxAvg) stMaxAvg = stBetDisplay[s];
  });
  if (stBetDisplay.Flop > 0 || stBetDisplay.Turn > 0 || stBetDisplay.River > 0) {
    var avgSection = container.querySelector('[data-slot="avgBetSection"]');
    if (avgSection) avgSection.removeAttribute('hidden');
    setSlot(container, 'avgBetBars',
      streets.filter(function(s) { return stBetDisplay[s] > 0; }).map(function(s) {
        return barRow(s, stBetDisplay[s], stMaxAvg, 'o', fmtAvgAmount(d.betAmts[s], d.betAmtsBB ? d.betAmtsBB[s] : []), d.betAmts[s] ? d.betAmts[s].length + ' bets' : '');
      }).join(''));
  }

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
