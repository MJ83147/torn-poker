function renderActions(container, d, hands) {
  if (!container) return;
  var streets = STREETS;
  var actTotal = d.folds + d.checks + d.calls + d.raises;
  var fPct = pct(d.folds, actTotal);
  var chPct = pct(d.checks, actTotal);
  var caPct = pct(d.calls, actTotal);
  var raPct = pct(d.raises, actTotal);

  var ctx = getGameContext(d);
  var _domSeats = ctx.seats;
  var _domFb = ctx.flopBucket;
  var _cbetBand = ctx.band('cbet');
  var _ftrBand = ctx.band('foldToRaise');

  mountTemplate(container, 'actions');
  mountFindings(container, 'Betting', d, hands, 'Betting profile looks balanced at this sample size.');

  setSlot(container, 'miniRow', renderMiniRow([
    { l: 'Total Actions', v: actTotal, c: 'o' },
    { l: 'Folds', v: d.folds, c: 'r' },
    { l: 'Checks', v: d.checks, c: 'w' },
    { l: 'Calls', v: d.calls, c: 'a' },
    { l: 'Raises', v: d.raises, c: 'g' },
  ]));

  var segs = [
    { p: fPct || 0, c: 'var(--red)', l: 'Fold ' + fPct + '%' },
    { p: chPct || 0, c: '#2a3a2c', l: 'Check ' + chPct + '%' },
    { p: caPct || 0, c: 'var(--amber)', l: 'Call ' + caPct + '%' },
    { p: raPct || 0, c: 'var(--green)', l: 'Raise ' + raPct + '%' },
  ];
  setSlot(container, 'actionSplitBar', segs.map(function (s) { return '<div class="stack-seg" style="width:' + s.p + '%;background:' + s.c + ';"></div>'; }).join(''));
  setSlot(container, 'actionSplitLabels', segs.map(function (s) { return '<div class="stack-li"><div class="dot" style="background:' + s.c + ';"></div>' + s.l + '</div>'; }).join(''));

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

  var sitStatHtml = '';
  for (var si = 0; si < sitStats.length; si++) {
    var s = sitStats[si];
    if (s.opps === 0) continue;
    var p = pct(s.done, s.opps);
    var cls = sitStatColour(s.label, p);
    var labelHtml = tipWrap(s.label);
    sitStatHtml += barRow(labelHtml, p || 0, 100, cls, (p !== null ? p + '%' : '-'), s.done + '/' + s.opps + ' spots');
  }
  setSlot(container, 'sitStats', sitStatHtml);

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

  setSlot(container, 'avgBetBars',
    streets.filter(function(s) { return betDisplay[s] > 0; }).map(function(s) {
      return barRow(s, betDisplay[s], maxAvg, 'o', fmtAvgAmount(d.betAmts[s], d.betAmtsBB ? d.betAmtsBB[s] : []), d.betAmts[s] ? d.betAmts[s].length + ' bets' : '');
    }).join(''));
  setSlot(container, 'betFreqBars',
    streets.map(function(s) {
      var bo = d.betOpps[s];
      if (!bo || !bo.t) return null;
      var fp2 = pct(bo.b, bo.t);
      var cls2 = fp2 < 25 ? 'r' : fp2 > 65 ? 'a' : 'g';
      return barRow(s, fp2 || 0, 100, cls2, (fp2 !== null ? fp2 + '%' : '-'), bo.b + '/' + bo.t + ' opps');
    }).filter(Boolean).join(''));
}
