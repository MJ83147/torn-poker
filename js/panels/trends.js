// Trends panel logic. No DOM, no markup — the view is js/panels/views/trends.js.

// Walk each hand once instead of calling analyse() per day-group — at 20k+
// hands the per-group analyse() turns into multi-second freezes.
function _trendsAccumulate(stats, h) {
  stats.n++;
  if (h.outcome) {
    stats.handsWithOutcome++;
    if (h.outcome.result === 'won') stats.handsWon++;
  }
  var cash = isCashHand(h);
  if (cash && h.outcome) {
    if (h.outcome.result === 'won') stats.totalWonAmount += h.outcome.amount || 0;
    stats.totalInvested += getInvested(h);
  }
  var acts = parseActions(h.actions);
  var heroPlayed = false;
  for (var i = 0; i < acts.length; i++) {
    var a = acts[i];
    if (!a.isMe) continue;
    if (a.type === 'fold') { /* no-op for counters below */ }
    else if (a.type === 'check') stats.checks++;
    else if (a.type === 'call') { stats.calls++; if (!heroPlayed) heroPlayed = true; }
    else if (a.type === 'raise' || a.type === 'bet') { stats.raises++; if (!heroPlayed) heroPlayed = true; }
  }
  if (heroPlayed) stats.vpip++;
}

function _newTrendsAccum() {
  return { n: 0, handsWon: 0, handsWithOutcome: 0, vpip: 0, raises: 0, calls: 0, checks: 0, totalWonAmount: 0, totalInvested: 0 };
}

// How a single session's stats deviated from the player's overall baseline.
// Feeds the Best & Worst Sessions cards in the Trends view.
function detectSessionPatterns(sessionData, overallData) {
  var patterns = [];
  var sCore = sessionData.core || {};
  var oCore = overallData.core || {};
  var sVpip = sCore.vpipPct, oVpip = oCore.vpipPct;
  var sAgg  = sCore.agg,     oAgg  = oCore.agg;
  var sLimp = sCore.limpPct, oLimp = oCore.limpPct;
  var sPfr  = sCore.pfrPct,  oPfr  = oCore.pfrPct;
  var sCbet = sCore.cbetPct, oCbet = oCore.cbetPct;
  var sWtsd = sCore.wtsdPct, oWtsd = oCore.wtsdPct;

  var sEpGroup = calcPositionGroupVpip(sessionData.posMap, EARLY_POSITIONS);
  var sEpVpip = sEpGroup.vpip;
  var sEarlyHands = sEpGroup.hands;
  var oEpVpip = calcPositionGroupVpip(overallData.posMap, EARLY_POSITIONS).vpip;

  var THRESH = 10;

  if (sVpip !== null && oVpip !== null && sVpip - oVpip >= THRESH) {
    patterns.push({ stat: 'VPIP', session: sVpip, overall: oVpip, dir: 'up', text: 'Played looser than usual (' + sVpip + '% vs your average ' + oVpip + '%). More hands entered, more exposure.' });
  }
  if (sVpip !== null && oVpip !== null && oVpip - sVpip >= THRESH) {
    patterns.push({ stat: 'VPIP', session: sVpip, overall: oVpip, dir: 'down', text: 'Played tighter than usual (' + sVpip + '% vs your average ' + oVpip + '%). Fewer hands, less risk.' });
  }
  if (sAgg !== null && oAgg !== null && oAgg - sAgg >= THRESH) {
    patterns.push({ stat: 'Aggression', session: sAgg, overall: oAgg, dir: 'down', text: 'Aggression dropped to ' + sAgg + '% (average ' + oAgg + '%). More checking and calling, less betting.' });
  }
  if (sAgg !== null && oAgg !== null && sAgg - oAgg >= THRESH) {
    patterns.push({ stat: 'Aggression', session: sAgg, overall: oAgg, dir: 'up', text: 'Aggression spiked to ' + sAgg + '% (average ' + oAgg + '%). More raising, possibly over-bluffing.' });
  }
  if (sLimp !== null && oLimp !== null && sLimp - oLimp >= THRESH) {
    patterns.push({ stat: 'Limp', session: sLimp, overall: oLimp, dir: 'up', text: 'Limping spiked to ' + sLimp + '% (average ' + oLimp + '%). Entering pots without initiative.' });
  }
  if (sPfr !== null && oPfr !== null && oPfr - sPfr >= THRESH) {
    patterns.push({ stat: 'PFR', session: sPfr, overall: oPfr, dir: 'down', text: 'Preflop raise rate dropped to ' + sPfr + '% (average ' + oPfr + '%). Less initiative preflop.' });
  }
  if (sCbet !== null && oCbet !== null && oCbet - sCbet >= 15) {
    patterns.push({ stat: 'C-Bet', session: sCbet, overall: oCbet, dir: 'down', text: 'C-bet dropped to ' + sCbet + '% (average ' + oCbet + '%). Gave up flop initiative more often.' });
  }
  if (sWtsd !== null && oWtsd !== null && sWtsd - oWtsd >= THRESH) {
    patterns.push({ stat: 'WTSD', session: sWtsd, overall: oWtsd, dir: 'up', text: 'Went to showdown ' + sWtsd + '% (average ' + oWtsd + '%). Called down more often than usual.' });
  }
  if (sEpVpip !== null && oEpVpip !== null && sEpVpip - oEpVpip >= 15 && sEarlyHands >= 3) {
    patterns.push({ stat: 'EP VPIP', session: sEpVpip, overall: oEpVpip, dir: 'up', text: 'Early position VPIP was ' + sEpVpip + '% (average ' + oEpVpip + '%). Played too wide from bad seats.' });
  }

  return patterns;
}

// Day-bucketed cumulative trend points.
function trendsModel(hands) {
  var sorted = hands.slice().sort(function(a, b) { return (a.timestamp || 0) - (b.timestamp || 0); });
  if (sorted.length < 5) return { tooFew: true };

  var days = [];
  var dayMap = {};
  // Bucket by integer day first, format the label once per distinct day —
  // 20k toLocaleDateString calls cost ~1.7s, ~60 calls is negligible.
  var labelByBucket = {};
  for (var i = 0; i < sorted.length; i++) {
    var ts = sorted[i].timestamp || 0;
    var bucket = Math.floor(ts / 86400000);
    var day = labelByBucket[bucket];
    if (!day) {
      day = new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      labelByBucket[bucket] = day;
    }
    if (!dayMap[day]) { dayMap[day] = []; days.push(day); }
    dayMap[day].push(sorted[i]);
  }

  var points = [];
  var cumWon = 0, cumOutcome = 0, cumVpip = 0, cumN = 0, cumRaise = 0, cumCalls = 0, cumChecks = 0, cumCashWon = 0, cumCashInvested = 0;
  for (var si = 0; si < days.length; si++) {
    var dayHands = dayMap[days[si]];
    var dStats = _newTrendsAccum();
    for (var dhi = 0; dhi < dayHands.length; dhi++) _trendsAccumulate(dStats, dayHands[dhi]);
    cumWon += dStats.handsWon;
    cumOutcome += dStats.handsWithOutcome;
    cumVpip += dStats.vpip;
    cumN += dStats.n;
    cumRaise += dStats.raises;
    cumCalls += dStats.calls;
    cumChecks += dStats.checks;
    cumCashWon += dStats.totalWonAmount;
    cumCashInvested += dStats.totalInvested;
    points.push({
      label: days[si],
      hands: dayHands.length,
      cumHands: cumN,
      wr: cumOutcome > 0 ? Math.round(cumWon / cumOutcome * 100) : null,
      vpip: cumN > 0 ? Math.round(cumVpip / cumN * 100) : null,
      agg: calcAggression(cumRaise, cumCalls, cumChecks),
      sessionWr: dStats.handsWithOutcome > 0 ? Math.round(dStats.handsWon / dStats.handsWithOutcome * 100) : null,
      netPnl: cumCashWon - cumCashInvested,
    });
  }

  return { tooFew: false, points: points, dayMap: dayMap };
}
