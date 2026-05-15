// ── BETTING PANEL (Actions + Bets) ───────────────────────────────────────────

function renderActions(container, d, hands) {
  var streets = ['Preflop', 'Flop', 'Turn', 'River'];
  var aggPct = calcAggression(d.raises, d.calls, d.checks);
  var actTotal = d.folds + d.checks + d.calls + d.raises;
  var fPct = pct(d.folds, actTotal);
  var chPct = pct(d.checks, actTotal);
  var caPct = pct(d.calls, actTotal);
  var raPct = pct(d.raises, actTotal);

  // ── Game-context lookups ─────────────────────────────────────────────────
  var ctx = getGameContext(d);
  var _domSeats = ctx.seats;
  var _domFb = ctx.flopBucket;
  function _scaleN(base) { return ctx.scaleN(base); }
  var _aggBand = ctx.band('af');
  var _cbetBand = ctx.band('cbet');
  var _ftrBand = ctx.band('foldToRaise');

  var actHtml = '<div class="panel-title">Betting</div>';
  actHtml += '<div class="panel-desc">How you size your bets and choose your actions.</div>';

  // Verdict + section stories (Bet Sizing Shape, Value vs Bluff Sizing,
  // Response to Sizing) render above the widgets.
  var bettingFindings = [];
  if (typeof Sections !== 'undefined' && typeof Sections.evaluateSections === 'function') {
    bettingFindings = Sections.findingsForPanel(Sections.evaluateSections(d, {}, hands), 'Betting');
    actHtml += Sections.renderVerdict(bettingFindings, 'Betting profile looks balanced at this sample size.');
    if (bettingFindings.length) actHtml += '<div class="p-row">' + Sections.renderFindings(bettingFindings) + '</div>';
  }

  // Aggression mini-box dropped - the header hero strip already shows your
  // headline aggression number always.
  actHtml += '<div class="p-row">' + renderMiniRow([
    { l: 'Total Actions', v: actTotal, c: 'o' },
    { l: 'Folds', v: d.folds, c: 'r' },
    { l: 'Checks', v: d.checks, c: 'w' },
    { l: 'Calls', v: d.calls, c: 'a' },
    { l: 'Raises', v: d.raises, c: 'g' },
  ]) + '</div>';

  actHtml += '<div class="p-row">';
  var segs = [
    { p: fPct || 0, c: 'var(--red)', l: 'Fold ' + fPct + '%' },
    { p: chPct || 0, c: '#2a3a2c', l: 'Check ' + chPct + '%' },
    { p: caPct || 0, c: 'var(--amber)', l: 'Call ' + caPct + '%' },
    { p: raPct || 0, c: 'var(--green)', l: 'Raise ' + raPct + '%' },
  ];
  actHtml += '<div class="sec-subtitle">Action split</div>';
  actHtml += '<div class="stack-bar">' + segs.map(function (s) { return '<div class="stack-seg" style="width:' + s.p + '%;background:' + s.c + ';"></div>'; }).join('') + '</div>';
  actHtml += '<div class="stack-labels">' + segs.map(function (s) { return '<div class="stack-li"><div class="stack-dot" style="background:' + s.c + ';"></div>' + s.l + '</div>'; }).join('') + '</div>';

  // "By street" table dropped - the Streets panel owns action-mix-by-street
  // (it's the panel's whole job; richer stacked-bar chart there).
  actHtml += '</div>';

  // Situational stats
  actHtml += '<div class="p-row"><div class="sec-subtitle mt-0">Situational stats</div>';
  actHtml += '<div class="bar-group">';

  function sitStatColour(label, p) {
    if (p === null) return 'o';
    var fbMod = _domFb === 'HU' ? 5 : _domFb === 'multiway' ? -10 : 0;
    switch (label) {
      case 'C-Bet': {
        var hi = _cbetBand ? _cbetBand.ideal + fbMod : 60;
        var lo = _cbetBand ? _cbetBand.tight + fbMod : 40;
        return p >= hi ? 'g' : p >= lo ? 'o' : 'r';
      }
      case 'Delayed C-Bet': return p >= 30 ? 'g' : 'o';
      case 'Donk Bet': return p > 30 ? 'a' : 'o';
      case 'Fold to C-Bet': {
        var ceil = _ftrBand ? _ftrBand.loose + 15 + (_domFb === 'multiway' ? 5 : -5) : 70;
        var soft = _ftrBand ? _ftrBand.ideal + 10 : 50;
        return p > ceil ? 'r' : p > soft ? 'a' : 'g';
      }
      case 'Fold to 3-Bet': {
        var ceil3 = _domSeats <= 2 ? 55 : _domSeats <= 4 ? 60 : 70;
        var soft3 = _domSeats <= 2 ? 40 : _domSeats <= 4 ? 45 : 50;
        return p > ceil3 ? 'r' : p > soft3 ? 'a' : 'g';
      }
      case 'Fold to 4-Bet': return p > 80 ? 'a' : 'o';
      default: return 'o';
    }
  }

  var sitStats = [
    { label: 'C-Bet', done: d.cbetDone, opps: d.cbetOpps },
    { label: 'Delayed C-Bet', done: d.delayCbetDone, opps: d.delayCbetOpps },
    { label: 'Donk Bet', done: d.donkDone, opps: d.donkOpps },
    { label: 'Fold to C-Bet', done: d.foldToCbetDone, opps: d.foldToCbetOpps },
    { label: 'Fold to 3-Bet', done: d.foldTo3betDone, opps: d.foldTo3betOpps },
    { label: 'Fold to 4-Bet', done: d.foldTo4betDone, opps: d.foldTo4betOpps },
  ];

  for (var si = 0; si < sitStats.length; si++) {
    var s = sitStats[si];
    if (s.opps === 0) continue;
    var p = pct(s.done, s.opps);
    var cls = sitStatColour(s.label, p);
    var labelHtml = tipWrap(s.label);
    actHtml += barRow(labelHtml, p || 0, 100, cls, (p !== null ? p + '%' : '-'), s.done + '/' + s.opps + ' spots');
  }

  actHtml += '</div></div>';

  // ── Bet Sizing Section (merged from Bets panel) ──
  var avgBets = {};
  var avgBetsBB = {};
  streets.forEach(function(s) {
    avgBets[s] = Math.round(avg(d.betAmts[s]));
    avgBetsBB[s] = avg(d.betAmtsBB ? d.betAmtsBB[s] : []);
  });
  d.avgBetPre = avgBets.Preflop; d.avgBetFlop = avgBets.Flop;
  d.avgBetTurn = avgBets.Turn; d.avgBetRiver = avgBets.River;
  d.avgBetBBFlop = avgBetsBB.Flop; d.avgBetBBTurn = avgBetsBB.Turn; d.avgBetBBRiver = avgBetsBB.River;
  var betDisplay = {};
  streets.forEach(function(s) {
    betDisplay[s] = _displayBB && d.betAmtsBB && d.betAmtsBB[s] && d.betAmtsBB[s].length
      ? avg(d.betAmtsBB[s]) : avg(d.betAmts[s]);
  });
  var maxAvg = Math.max(betDisplay.Preflop, betDisplay.Flop, betDisplay.Turn, betDisplay.River, 1);

  actHtml += '<div class="p-row"><div class="sec-subtitle mt-0">Bet Sizing</div><div class="two-col">';
  actHtml += '<div><div class="sec-subtitle">Average bet size by street</div><div class="bar-group">' +
    streets.filter(function(s) { return betDisplay[s] > 0; }).map(function(s) {
      return barRow(s, betDisplay[s], maxAvg, 'o', fmtAvgAmount(d.betAmts[s], d.betAmtsBB ? d.betAmtsBB[s] : []), d.betAmts[s] ? d.betAmts[s].length + ' bets' : '');
    }).join('') + '</div></div>';
  actHtml += '<div><div class="sec-subtitle">Bet frequency (when you had the option)</div><div class="bar-group">' +
    streets.map(function(s) {
      var bo = d.betOpps[s];
      if (!bo || !bo.t) return null;
      var fp2 = pct(bo.b, bo.t);
      var cls2 = fp2 < 25 ? 'r' : fp2 > 65 ? 'a' : 'g';
      return barRow(s, fp2 || 0, 100, cls2, (fp2 !== null ? fp2 + '%' : '-'), bo.b + '/' + bo.t + ' opps');
    }).filter(Boolean).join('') + '</div></div>';
  actHtml += '</div></div>';

  container.innerHTML = actHtml;
}
