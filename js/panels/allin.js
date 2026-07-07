// All-In EV panel logic. No DOM, no markup — the view is
// js/panels/views/allin.js.

// Cache candidate detection by hands array: re-walking 20k+ hands on every
// panel revisit is the freeze.
var _allinCandidatesFor = null;
var _allinCandidates = null;

function allinCandidates(hands) {
  if (_allinCandidatesFor === hands && _allinCandidates) return _allinCandidates;
  _allinCandidates = detectAllInCandidates(hands);
  _allinCandidatesFor = hands;
  return _allinCandidates;
}

function detectAllInCandidates(hands) {
  var results = [];

  for (var hi = 0; hi < hands.length; hi++) {
    var h = hands[hi];
    if (!h.hole || h.hole.length !== 2) continue;
    if (!h.actions || !h.actions.length) continue;
    if (!h.outcome) continue;
    if (h.outcome.result === 'folded') continue;

    var acts = parseActions(h.actions);
    var allInStreet = null;
    var allInFound = false;
    var heroInAllIn = false;

    // Find every all-in and note whether the hero was ever all-in. The decisive
    // street is the first all-in's street: once a player is all-in and the pot
    // is contested, betting on that street is done. Scanning every action (not
    // breaking on the first called all-in) is what catches the hero shoving
    // over a villain's shove — the hero's all-in comes after the villain's.
    for (var ai = 0; ai < acts.length; ai++) {
      if (isAllInAction(acts, ai)) {
        allInFound = true;
        if (allInStreet === null) allInStreet = acts[ai].street;
        if (acts[ai].isMe) heroInAllIn = true;
      }
    }

    // Reaching showdown with a revealed opponent (checked below) is the proof
    // the all-in was contested, so no separate "was it called" scan is needed.
    if (!allInFound || !heroInAllIn) continue;
    if (allInStreet === 'River') continue;

    // Structured (v2) hands carry showdown reveals natively as
    // { author, isMe, hole }. Take every non-hero revealed hand.
    var reveals = h.reveals || [];
    if (!reveals.length) continue;

    var heroHole = [normCardCode(h.hole[0]), normCardCode(h.hole[1])];

    var opponentHoles = [];
    for (var ri = 0; ri < reveals.length; ri++) {
      var rv = reveals[ri];
      if (rv.isMe || !rv.hole || rv.hole.length !== 2) continue;
      opponentHoles.push([normCardCode(rv.hole[0]), normCardCode(rv.hole[1])]);
    }
    if (!opponentHoles.length) continue;

    var streetIdx = { 'Preflop': 0, 'Flop': 3, 'Turn': 4, 'River': 5 };
    var boardSlice = streetIdx[allInStreet] || 0;
    var fullBoard = (h.board || []).map(normCardCode);
    var boardAtAllIn = fullBoard.slice(0, boardSlice);

    var potAtAllIn = 0;
    var pastAllIn = false;
    for (var pi = 0; pi < acts.length; pi++) {
      var pa = acts[pi];
      if (pa.type === 'won') continue;
      if (pa.amount) potAtAllIn += pa.amount;
      if (pastAllIn && (pa.type === 'call' || pa.type === 'raise')) break;
      if (isAllInAction(acts, pi)) pastAllIn = true;
    }
    if (potAtAllIn === 0) potAtAllIn = h.pot || 0;

    var heroInvested = getInvested(h);
    var actualWon = h.outcome.result === 'won' ? ((h.outcome.amount || 0) - heroInvested) : -heroInvested;

    results.push({
      hand: h,
      street: allInStreet,
      heroHole: heroHole,
      opponents: opponentHoles,
      boardAtAllIn: boardAtAllIn,
      fullBoard: fullBoard,
      potAtAllIn: potAtAllIn,
      heroInvested: heroInvested,
      actualResult: actualWon,
      isCash: isCashHand(h),
      timestamp: h.timestamp || 0,
      equity: null,
      fairShare: null,
      expectedValue: null,
      evDiff: null
    });
  }

  results.sort(function (a, b) { return a.timestamp - b.timestamp; });
  return results;
}

// Post-simulation summary across the all-in hands (equity fields filled in).
function allinSummary(allInHands) {
  var cashAllIns = allInHands.filter(function(ah) { return ah.isCash; });

  var totalEvDiff = 0, favouriteCount = 0, actualWins = 0;
  for (var i = 0; i < allInHands.length; i++) {
    totalEvDiff += allInHands[i].evDiff;
    if (allInHands[i].equity > 0.5) favouriteCount++;
    if (allInHands[i].actualResult > 0) actualWins++;
  }
  var equityWinRate = pct(favouriteCount, allInHands.length);
  var actualWinRate = pct(actualWins, allInHands.length);

  var n = allInHands.length;
  var variance = '';
  if (n >= 10 && totalEvDiff > 1) {
    variance = 'You\'re running ' + fmt(totalEvDiff) + ' above expectation across ' + n + ' all-in hands. Results converge toward the EV line over time.';
  } else if (n >= 10 && totalEvDiff < -1) {
    variance = 'You\'re running ' + fmt(Math.abs(totalEvDiff)) + ' below expectation across ' + n + ' all-in hands. Play has been correct more often than results suggest.';
  } else if (equityWinRate !== null && equityWinRate < 45) {
    variance = 'You\'re frequently all-in as an underdog (' + equityWinRate + '% favourite rate). Check whether the spots are +EV given pot odds, or if tighter selection helps.';
  }

  return {
    cashAllIns: cashAllIns,
    totalEvDiff: totalEvDiff,
    equityWinRate: equityWinRate,
    actualWinRate: actualWinRate,
    variance: variance,
  };
}
