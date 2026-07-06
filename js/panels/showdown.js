// Showdown panel logic. No DOM, no markup — the view is
// js/panels/views/showdown.js.

function showdownModel(hands) {
  var sorted = hands.slice().sort(function(a, b) { return (a.timestamp || 0) - (b.timestamp || 0); });

  var cash = [];
  for (var i = 0; i < sorted.length; i++) {
    if (isCashHand(sorted[i]) && sorted[i].outcome) cash.push(sorted[i]);
  }
  if (cash.length < 5) return { cashCount: cash.length };

  // Chart.js bogs down past ~1000 points, so stride to ~500.
  var cumSd = 0, cumNsd = 0;
  var sdWon = 0, sdTotal = 0, nsdWon = 0, nsdTotal = 0;
  var dataSd = [], dataNsd = [], dataTotal = [], labels = [];
  var CHART_TARGET_POINTS = 500;
  var stride = Math.max(1, Math.floor(cash.length / CHART_TARGET_POINTS));

  var potSdWin = [], potSdLoss = [], potNsdWin = [], potNsdLoss = [];

  for (var ci = 0; ci < cash.length; ci++) {
    var h = cash[ci];
    var delta = getHandPnlValue(h);
    var won = h.outcome.result === 'won';
    var pot = h.pot || 0;

    if (isShowdown(h)) {
      cumSd += delta;
      sdTotal++;
      if (won) { sdWon++; potSdWin.push(pot); }
      else { potSdLoss.push(pot); }
    } else {
      cumNsd += delta;
      nsdTotal++;
      if (won) { nsdWon++; potNsdWin.push(pot); }
      else { potNsdLoss.push(pot); }
    }

    if (ci === cash.length - 1 || ci % stride === 0) {
      labels.push(ci + 1);
      dataSd.push(cumSd);
      dataNsd.push(cumNsd);
      dataTotal.push(cumSd + cumNsd);
    }
  }

  // The hands behind each box, most-recent first, so a click can replay them.
  var sdHands = [], nsdHands = [], wonHands = [], lostHands = [];
  for (var hi = cash.length - 1; hi >= 0; hi--) {
    if (isShowdown(cash[hi])) sdHands.push(cash[hi]);
    else nsdHands.push(cash[hi]);
    if (cash[hi].outcome.result === 'won') wonHands.push(cash[hi]);
    else lostHands.push(cash[hi]);
  }

  var avgWinPot = (potSdWin.length + potNsdWin.length) > 0 ? avg(potSdWin.concat(potNsdWin)) : 0;
  var avgLossPot = (potSdLoss.length + potNsdLoss.length) > 0 ? avg(potSdLoss.concat(potNsdLoss)) : 0;

  return {
    cashCount: cash.length,
    sd: { pnl: cumSd, total: sdTotal, winRate: pct(sdWon, sdTotal), hands: sdHands.slice(0, 15) },
    nsd: { pnl: cumNsd, total: nsdTotal, winRate: pct(nsdWon, nsdTotal), hands: nsdHands.slice(0, 15) },
    won: { avgPot: avgWinPot, count: potSdWin.length + potNsdWin.length, hands: wonHands.slice(0, 15) },
    lost: { avgPot: avgLossPot, count: potSdLoss.length + potNsdLoss.length, hands: lostHands.slice(0, 15) },
    winLossRatio: avgLossPot > 0 ? (avgWinPot / avgLossPot).toFixed(2) : null,
    potAvgs: {
      sdWin: Math.round(avg(potSdWin)), sdLoss: Math.round(avg(potSdLoss)),
      nsdWin: Math.round(avg(potNsdWin)), nsdLoss: Math.round(avg(potNsdLoss)),
      counts: [potSdWin.length, potSdLoss.length, potNsdWin.length, potNsdLoss.length],
    },
    chart: { labels: labels, sd: dataSd, nsd: dataNsd, total: dataTotal },
  };
}
