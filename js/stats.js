// Sample-size gates for the layered-verdict engine. Slices below the gate are
// still computed but tagged `gated: true` and excluded from weighted-target
// computation and verdicts.
var MIN_AGGREGATE = 30;
var MIN_AXIS = 20;
var MIN_CELL = 10;

function _newAnalyseState(n, hands) {
  var ss = {}, betAmts = {}, betAmtsBB = {}, betOpps = {};
  for (var i = 0; i < STREETS.length; i++) {
    var s = STREETS[i];
    ss[s]        = { seen: 0, f: 0, ch: 0, ca: 0, ra: 0 };
    betAmts[s]   = [];
    betAmtsBB[s] = [];
    betOpps[s]   = { b: 0, t: 0 };
  }
  return {
    n: n,
    hands: hands,
    posMap: {},
    htMap: {},
    rangeMap: {},
    ss: ss,
    handsWon: 0,
    handsWithOutcome: 0,
    totalWonAmount: 0,
    totalInvested: 0,
    folds: 0,
    checks: 0,
    calls: 0,
    raises: 0,
    totalActs: 0,
    betAmts: betAmts,
    betAmtsBB: betAmtsBB,
    betOpps: betOpps,
    pfrHands: 0,
    limpHands: 0,
    sawFlop: 0,
    wentToShowdown: 0,
    facedRaise: 0,
    foldedToRaise: 0,
    facedAllin: 0,
    foldAllin: 0,
    callAllin: 0,
    wonAllin: 0,
    faced3bet: 0,
    fold3bet: 0,
    vpip: 0,
    cbetOpps: 0, cbetDone: 0,
    delayCbetOpps: 0, delayCbetDone: 0,
    donkOpps: 0, donkDone: 0,
    foldToCbetOpps: 0, foldToCbetDone: 0,
    foldTo3betOpps: 0, foldTo3betDone: 0,
    foldTo4betOpps: 0, foldTo4betDone: 0,
  };
}

// Must run before _aggregateRangeAndPfr: creates the posMap entry that the
// range/PFR helper later increments (vpip, foldPre).
function _aggregatePosition(state, h) {
  var p = h.position || '?';
  var cash = isCashHand(h);
  if (!state.posMap[p]) {
    state.posMap[p] = { hands: 0, vpip: 0, foldPre: 0, won: 0, pot: 0, pnl: 0 };
  }
  state.posMap[p].hands++;
  if (cash) state.posMap[p].pot += h.pot || 0;

  var handBB = getHandBB(h);
  if (cash && handBB && handBB > 0 && h.pot) {
    state.posMap[p].potBB = (state.posMap[p].potBB || 0) + (h.pot / handBB);
    state.posMap[p].potBBCount = (state.posMap[p].potBBCount || 0) + 1;
  }

  if (h.outcome) {
    state.handsWithOutcome++;
    var invested = getInvested(h);
    if (cash) state.totalInvested += invested;
    var amount = h.outcome.amount || 0;
    var pnlDelta = h.outcome.result === 'won' ? amount - invested : -invested;
    if (h.outcome.result === 'won') {
      state.handsWon++;
      if (cash) state.totalWonAmount += amount;
      state.posMap[p].won++;
    }
    if (cash) {
      state.posMap[p].pnl += pnlDelta;
      // BB-normalized P&L so aggregates spanning stakes can display in BB.
      if (handBB && handBB > 0) {
        state.pnlBB = (state.pnlBB || 0) + pnlDelta / handBB;
        state.pnlBBKnown = true;
        state.posMap[p].pnlBB = (state.posMap[p].pnlBB || 0) + pnlDelta / handBB;
      }
    }
  }
}

function _aggregateRangeAndPfr(state, h) {
  var hkey = parseHoleKey(h.hole);
  if (!hkey) return;

  var p = h.position || '?';
  var cash = isCashHand(h);
  if (!state.rangeMap[hkey]) {
    state.rangeMap[hkey] = { dealt: 0, played: 0, won: 0, pnl: 0 };
  }
  state.rangeMap[hkey].dealt++;

  var acts = parseActions(h.actions);
  var myActs = acts.filter(function (a) { return a.isMe; });
  var didPlay = myActs.some(function (a) {
    return a.type === 'call' || a.type === 'raise' || a.type === 'bet';
  });

  if (didPlay) {
    state.rangeMap[hkey].played++;
    state.vpip++;
    state.posMap[p].vpip++;
  }
  if (didPlay && h.outcome && h.outcome.result === 'won') {
    state.rangeMap[hkey].won++;
  }

  if (h.outcome && cash) {
    var inv = getInvested(h);
    if (h.outcome.result === 'won') {
      state.rangeMap[hkey].pnl += (h.outcome.amount || 0) - inv;
    } else {
      state.rangeMap[hkey].pnl -= inv;
    }
  }

  var heroRaisedPre = myActs.some(function (a) {
    return a.street === 'Preflop' && (a.type === 'raise' || a.type === 'bet');
  });
  if (heroRaisedPre) state.pfrHands++;

  if (!heroRaisedPre) {
    var heroCalledPre = myActs.some(function (a) {
      return a.street === 'Preflop' && a.type === 'call';
    });
    if (heroCalledPre) {
      var preActsLimp = acts.filter(function (a) { return a.street === 'Preflop'; });
      var raiseBeforeHeroCall = false;
      for (var li = 0; li < preActsLimp.length; li++) {
        if (preActsLimp[li].isMe && preActsLimp[li].type === 'call') break;
        if (!preActsLimp[li].isMe && (preActsLimp[li].type === 'raise' || preActsLimp[li].type === 'bet')) {
          raiseBeforeHeroCall = true;
          break;
        }
      }
      if (!raiseBeforeHeroCall) state.limpHands++;
    }
  }

  var pfFold = myActs.find(function (a) { return a.street === 'Preflop' && a.type === 'fold'; });
  if (pfFold) state.posMap[p].foldPre++;

  var ht = classifyKey(hkey);
  if (!state.htMap[ht]) state.htMap[ht] = { dealt: 0, played: 0, won: 0 };
  state.htMap[ht].dealt++;
  if (didPlay) state.htMap[ht].played++;
  if (didPlay && h.outcome && h.outcome.result === 'won') state.htMap[ht].won++;
}

function _aggregateStreetActions(state, h) {
  var acts = parseActions(h.actions);
  var cash = isCashHand(h);
  var heroSeenStreets = new Set();
  var allinCountedThisHand = false;

  for (var ai = 0; ai < acts.length; ai++) {
    var a = acts[ai];

    if (a.isMe) {
      state.totalActs++;
      if (a.type === 'fold') state.folds++;
      else if (a.type === 'check') state.checks++;
      else if (a.type === 'call') state.calls++;
      else if (a.type === 'raise' || a.type === 'bet') state.raises++;
    }

    if (a.isMe && a.type !== 'sb' && a.type !== 'bb' && !heroSeenStreets.has(a.street)) {
      heroSeenStreets.add(a.street);
      if (state.ss[a.street]) state.ss[a.street].seen++;
    }
    if (a.isMe && state.ss[a.street]) {
      if (a.type === 'fold') state.ss[a.street].f++;
      else if (a.type === 'check') state.ss[a.street].ch++;
      else if (a.type === 'call') state.ss[a.street].ca++;
      else if (a.type === 'raise' || a.type === 'bet') state.ss[a.street].ra++;
    }

    if (a.type === 'raise' || a.type === 'bet') {
      if (a.amount > 0 && state.betAmts[a.street]) {
        state.betAmts[a.street].push(a.amount);
        if (cash) {
          var hb = getHandBB(h);
          if (hb && hb > 0) {
            state.betAmtsBB[a.street].push(a.amount / hb);
          }
        }
      }
    }

    if (a.isMe && a.street !== 'Preflop' && state.betOpps[a.street] && a.type !== 'sb' && a.type !== 'bb' && a.type !== 'won') {
      state.betOpps[a.street].t++;
      if (a.type === 'raise' || a.type === 'bet') state.betOpps[a.street].b++;
    }

    if (!allinCountedThisHand && !a.isMe && isAllInAction(acts, ai)) {
      var heroResp = acts.filter(function (b) { return b.isMe && b.street === a.street; });
      var foldResp = heroResp.find(function (b) { return b.type === 'fold'; });
      var callResp = heroResp.find(function (b) { return b.type === 'call' || b.type === 'raise'; });
      if (foldResp || callResp) {
        allinCountedThisHand = true;
        state.facedAllin++;
        if (foldResp) state.foldAllin++;
        if (callResp) {
          state.callAllin++;
          if (h.outcome && h.outcome.result === 'won') state.wonAllin++;
        }
      }
    }
  }

  if (heroSeenStreets.has('Flop')) state.sawFlop++;
  if (isShowdown(h)) state.wentToShowdown++;

  for (var fri = 0; fri < acts.length; fri++) {
    var fa = acts[fri];
    if (!fa.isMe && (fa.type === 'raise' || fa.type === 'bet') && fa.street !== 'Preflop') {
      for (var fk = fri + 1; fk < acts.length; fk++) {
        if (acts[fk].street !== fa.street) break;
        if (acts[fk].isMe) {
          state.facedRaise++;
          if (acts[fk].type === 'fold') state.foldedToRaise++;
          break;
        }
      }
    }
  }
}

function _aggregateThreeBet(state, h) {
  var acts = parseActions(h.actions);
  var preActs = acts.filter(function (a) { return a.street === 'Preflop'; });
  var raiseCount = 0;
  var faced3ThisHand = false;
  for (var i = 0; i < preActs.length; i++) {
    var a = preActs[i];
    if (!a.isMe && a.type === 'raise') {
      raiseCount++;
      if (raiseCount >= 2) faced3ThisHand = true;
    }
    if (faced3ThisHand && a.isMe && (a.type === 'fold' || a.type === 'call')) {
      state.faced3bet++;
      if (a.type === 'fold') state.fold3bet++;
      break;
    }
  }
}

function _aggregateSituational(state, h) {
  var acts = parseActions(h.actions);
  var preflopActs = acts.filter(function (a) { return a.street === 'Preflop'; });
  var pfr = null;
  var sitRaiseLevel = 0;
  var raisers = [];
  var heroOpenedPF = false;
  var hero3betPF = false;

  for (var i = 0; i < preflopActs.length; i++) {
    var a = preflopActs[i];
    if (a.type === 'raise') {
      sitRaiseLevel++;
      raisers.push({ author: a.author, isMe: a.isMe, level: sitRaiseLevel });
      pfr = { author: a.author, isMe: a.isMe };
      if (a.isMe && sitRaiseLevel === 1) heroOpenedPF = true;
      if (a.isMe && sitRaiseLevel === 2) hero3betPF = true;
    }
  }

  var flopReached = acts.some(function (a) { return a.street === 'Flop'; });
  var turnReached = acts.some(function (a) { return a.street === 'Turn'; });

  function heroFirstAction(actsList, street) {
    return actsList.find(function (a) {
      return a.isMe && a.street === street && a.type !== 'sb' && a.type !== 'bb';
    });
  }
  var heroFirstFlop = heroFirstAction(acts, 'Flop');
  var heroFirstTurn = heroFirstAction(acts, 'Turn');

  if (pfr && pfr.isMe && flopReached && heroFirstFlop) {
    state.cbetOpps++;
    if (heroFirstFlop.type === 'raise' || heroFirstFlop.type === 'bet') state.cbetDone++;
  }

  if (pfr && pfr.isMe && flopReached && heroFirstFlop && heroFirstFlop.type === 'check' && turnReached && heroFirstTurn) {
    state.delayCbetOpps++;
    if (heroFirstTurn.type === 'raise' || heroFirstTurn.type === 'bet') state.delayCbetDone++;
  }

  if (pfr && !pfr.isMe && sitRaiseLevel >= 1 && flopReached && heroFirstFlop) {
    state.donkOpps++;
    if (heroFirstFlop.type === 'raise' || heroFirstFlop.type === 'bet') state.donkDone++;
  }

  if (pfr && !pfr.isMe && flopReached) {
    var flopActs = acts.filter(function (a) { return a.street === 'Flop'; });
    var firstFlopBetIdx = flopActs.findIndex(function (a) { return a.type === 'raise' || a.type === 'bet'; });
    if (firstFlopBetIdx !== -1 && flopActs[firstFlopBetIdx].author === pfr.author) {
      var heroResponse = flopActs.find(function (a, idx) {
        return idx > firstFlopBetIdx && a.isMe && (a.type === 'fold' || a.type === 'call' || a.type === 'raise');
      });
      if (heroResponse) {
        state.foldToCbetOpps++;
        if (heroResponse.type === 'fold') state.foldToCbetDone++;
      }
    }
  }

  if (heroOpenedPF) {
    var threeBettor = raisers.find(function (r) { return r.level === 2 && !r.isMe; });
    if (threeBettor) {
      var threeBetIdx = preflopActs.findIndex(function (a) {
        return !a.isMe && a.type === 'raise' && a.author === threeBettor.author;
      });
      if (threeBetIdx !== -1) {
        var heroResp3 = preflopActs.find(function (a, idx) {
          return idx > threeBetIdx && a.isMe && (a.type === 'fold' || a.type === 'call' || a.type === 'raise');
        });
        if (heroResp3) {
          state.foldTo3betOpps++;
          if (heroResp3.type === 'fold') state.foldTo3betDone++;
        }
      }
    }
  }

  if (hero3betPF) {
    var fourBettor = raisers.find(function (r) { return r.level === 3 && !r.isMe; });
    if (fourBettor) {
      var fourBetIdx = preflopActs.findIndex(function (a) {
        return !a.isMe && a.type === 'raise' && a.author === fourBettor.author;
      });
      if (fourBetIdx !== -1) {
        var heroResp4 = preflopActs.find(function (a, idx) {
          return idx > fourBetIdx && a.isMe && (a.type === 'fold' || a.type === 'call' || a.type === 'raise');
        });
        if (heroResp4) {
          state.foldTo4betOpps++;
          if (heroResp4.type === 'fold') state.foldTo4betDone++;
        }
      }
    }
  }
}

function _computeCoreMetrics(state) {
  return {
    wr:        pct(state.handsWon, state.handsWithOutcome),
    vpipPct:   pct(state.vpip, state.n),
    pfrPct:    pct(state.pfrHands, state.n),
    agg:       calcAggression(state.raises, state.calls, state.checks),
    limpPct:   pct(state.limpHands, state.n),
    allinFold: pct(state.foldAllin, state.facedAllin),
    netPnl:    state.totalWonAmount - state.totalInvested,
    netPnlBB:  state.pnlBBKnown ? state.pnlBB : null,
    ftrPct:    pct(state.foldedToRaise, state.facedRaise),
    cbetPct:   pct(state.cbetDone, state.cbetOpps),
    wtsdPct:   pct(state.wentToShowdown, state.sawFlop),
  };
}

// Order matters: _aggregatePosition must run before _aggregateRangeAndPfr,
// which increments fields on the posMap entry created by the position helper.
function analyse(hands) {
  if (typeof annotateHandDynamics === 'function') {
    for (var ai = 0; ai < hands.length; ai++) annotateHandDynamics(hands[ai]);
  }

  var state = _newAnalyseState(hands.length, hands);

  for (var i = 0; i < hands.length; i++) {
    var h = hands[i];
    _aggregatePosition(state, h);
    _aggregateRangeAndPfr(state, h);
    _aggregateStreetActions(state, h);
    _aggregateThreeBet(state, h);
    _aggregateSituational(state, h);
  }

  state.core = _computeCoreMetrics(state);
  return state;
}

function bucketizeAnalysis(topD, hands) {
  var seatGroups = {};
  var flopGroups = {};
  var stackGroups = {};
  var posGroups = {};
  var posSeatGroups = {};
  var composition = {};

  for (var i = 0; i < hands.length; i++) {
    var h = hands[i];
    if (h.seatBucket) {
      (seatGroups[h.seatBucket] = seatGroups[h.seatBucket] || []).push(h);
    }
    if (h.flopBucket) {
      (flopGroups[h.flopBucket] = flopGroups[h.flopBucket] || []).push(h);
    }
    if (h.stackBucket) {
      (stackGroups[h.stackBucket] = stackGroups[h.stackBucket] || []).push(h);
    }
    if (h.stackBucket && h.seatBucket) {
      var cKey = h.stackBucket + '|' + h.seatBucket;
      composition[cKey] = (composition[cKey] || 0) + 1;
    }
    if (h.position) {
      (posGroups[h.position] = posGroups[h.position] || []).push(h);
    }
    if (h.position && h.seatBucket) {
      var psKey = h.position + '|' + h.seatBucket;
      (posSeatGroups[psKey] = posSeatGroups[psKey] || []).push(h);
    }
  }

  function mapGroups(groups, gateMin) {
    var out = {};
    for (var k in groups) {
      var g = groups[k];
      // Skip analyse() for gated cells: consumers only check .n and .gated.
      // Saves work when byPosSeat produces many sub-MIN_CELL cells.
      if (gateMin != null && g.length < gateMin) {
        out[k] = { n: g.length, hands: g, gated: true };
        continue;
      }
      var gd = analyse(g);
      gd.gated = false;
      out[k] = gd;
    }
    return out;
  }

  topD.bySeatBucket = mapGroups(seatGroups, MIN_AXIS);
  topD.byFlopBucket = mapGroups(flopGroups, null);
  topD.byStackBucket = mapGroups(stackGroups, null);
  topD.byPosition = mapGroups(posGroups, MIN_AXIS);
  topD.byPosSeat = mapGroups(posSeatGroups, MIN_CELL);
  topD.stackSeatComposition = composition;

  var mixCells = [];
  for (var pk in topD.byPosSeat) {
    var cell = topD.byPosSeat[pk];
    if (cell.gated) continue;
    var parts = pk.split('|');
    mixCells.push({ position: parts[0], seatBucket: parts[1], seats: parseInt(parts[1], 10), hands: cell.n });
  }
  topD.mixCells = mixCells;
  topD.gated = topD.n < MIN_AGGREGATE;
  return topD;
}
