// Streets panel logic. No DOM, no markup — the view is
// js/panels/views/street.js.

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

// Group the Street findings under Preflop / Flop / Turn / River. Passed to
// panelFindings as opts.group so the cards render through the shared path;
// streetSummaryNote fills any street with no leak so all four always show.
function streetGroups(findings, d) {
  var STREET_ORDER = ['Preflop', 'Flop', 'Turn', 'River'];
  var byStreet = { Preflop: [], Flop: [], Turn: [], River: [] };
  for (var i = 0; i < findings.length; i++) {
    var st = findings[i].street;
    if (!byStreet[st]) st = 'Flop';
    byStreet[st].push(findings[i]);
  }
  return STREET_ORDER.map(function(s) {
    return { label: s, findings: byStreet[s], emptyNote: streetSummaryNote(d, s) };
  });
}

function streetModel(d) {
  var maxSeen = d.ss.Preflop.seen || 1;

  var seenRows = STREETS.map(function(s) {
    var seen = d.ss[s].seen;
    return { street: s, seen: seen, max: maxSeen, pctOfHands: pct(seen, d.n) };
  });

  var foldRows = STREETS.map(function(s) {
    var ss = d.ss[s];
    var tot = ss.f + ss.ch + ss.ca + ss.ra;
    var fp = pct(ss.f, tot);
    return { street: s, fp: fp, folds: ss.f, cls: fp > 55 ? 'r' : 'g' };
  });

  // Bet sizes shown in BB when the toggle is on and BB data exists.
  var betDisplay = {};
  var maxAvg = 1;
  STREETS.forEach(function(s) {
    betDisplay[s] = _displayBB && d.betAmtsBB && d.betAmtsBB[s] && d.betAmtsBB[s].length
      ? avg(d.betAmtsBB[s]) : avg(d.betAmts[s]);
    if (betDisplay[s] > maxAvg) maxAvg = betDisplay[s];
  });
  var avgBetRows = STREETS.filter(function(s) { return betDisplay[s] > 0; }).map(function(s) {
    return {
      street: s, val: betDisplay[s], max: maxAvg,
      valStr: fmtAvgAmount(d.betAmts[s], d.betAmtsBB ? d.betAmtsBB[s] : []),
      meta: d.betAmts[s] ? d.betAmts[s].length + ' bets' : ''
    };
  });

  var chart = { fold: [], check: [], call: [], raise: [], counts: [] };
  for (var si = 0; si < STREETS.length; si++) {
    var ss = d.ss[STREETS[si]];
    var tot = ss.f + ss.ch + ss.ca + ss.ra;
    chart.fold.push(tot > 0 ? Math.round(ss.f / tot * 100) : 0);
    chart.check.push(tot > 0 ? Math.round(ss.ch / tot * 100) : 0);
    chart.call.push(tot > 0 ? Math.round(ss.ca / tot * 100) : 0);
    chart.raise.push(tot > 0 ? Math.round(ss.ra / tot * 100) : 0);
    chart.counts.push([ss.f, ss.ch, ss.ca, ss.ra]);
  }

  return {
    seenRows: seenRows,
    foldRows: foldRows,
    avgBetRows: avgBetRows,
    hasAvgBet: betDisplay.Flop > 0 || betDisplay.Turn > 0 || betDisplay.River > 0,
    chart: chart,
  };
}
