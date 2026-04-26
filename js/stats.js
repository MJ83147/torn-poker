// ── ANALYSE (pure data-in/data-out) ───────────────────────────────────────────

// Sample-size gates for the layered-verdict engine. Slices below the gate are
// still computed (so the renderer can display "(N hands)") but tagged
// `gated: true` and excluded from weighted-target computation and verdicts.
var MIN_AGGREGATE = 30;
var MIN_AXIS = 20;
var MIN_CELL = 10;

function analyse(hands) {
  // Safety net: ensure every hand has the three-axis dynamics tags. Idempotent.
  if (typeof annotateHandDynamics === 'function') {
    for (var _ai = 0; _ai < hands.length; _ai++) annotateHandDynamics(hands[_ai]);
  }

  const n = hands.length;
  const posMap = {};
  const htMap = {};
  const rangeMap = {};

  const ss = {
    Preflop: { seen: 0, f: 0, ch: 0, ca: 0, ra: 0 },
    Flop:    { seen: 0, f: 0, ch: 0, ca: 0, ra: 0 },
    Turn:    { seen: 0, f: 0, ch: 0, ca: 0, ra: 0 },
    River:   { seen: 0, f: 0, ch: 0, ca: 0, ra: 0 },
  };

  let handsWon = 0;
  let handsWithOutcome = 0;
  let totalWonAmount = 0;
  let totalInvested = 0;

  let folds = 0;
  let checks = 0;
  let calls = 0;
  let raises = 0;
  let totalActs = 0;

  const betAmts = {
    Preflop: [],
    Flop:    [],
    Turn:    [],
    River:   [],
  };

  const betAmtsBB = {
    Preflop: [],
    Flop:    [],
    Turn:    [],
    River:   [],
  };

  const betOpps = {
    Preflop: { b: 0, t: 0 },
    Flop:    { b: 0, t: 0 },
    Turn:    { b: 0, t: 0 },
    River:   { b: 0, t: 0 },
  };

  let pfrHands = 0;
  let limpHands = 0;
  let sawFlop = 0;
  let wentToShowdown = 0;
  let facedRaise = 0;
  let foldedToRaise = 0;

  let facedAllin = 0;
  let foldAllin = 0;
  let callAllin = 0;
  let wonAllin = 0;

  let faced3bet = 0;
  let fold3bet = 0;
  let vpip = 0;

  // Situational stat counters
  let cbetOpps = 0, cbetDone = 0;
  let delayCbetOpps = 0, delayCbetDone = 0;
  let donkOpps = 0, donkDone = 0;
  let foldToCbetOpps = 0, foldToCbetDone = 0;
  let foldTo3betOpps = 0, foldTo3betDone = 0;
  let foldTo4betOpps = 0, foldTo4betDone = 0;

  for (const h of hands) {
    const p = h.position || '?';
    const cash = isCashHand(h);
    if (!posMap[p]) {
      posMap[p] = {
        hands: 0,
        vpip: 0,
        foldPre: 0,
        won: 0,
        pot: 0,
        pnl: 0,
      };
    }
    posMap[p].hands++;
    if (cash) posMap[p].pot += h.pot || 0;
    var handBBPos = getHandBB(h);
    if (cash && handBBPos && handBBPos > 0 && h.pot) {
      posMap[p].potBB = (posMap[p].potBB || 0) + (h.pot / handBBPos);
      posMap[p].potBBCount = (posMap[p].potBBCount || 0) + 1;
    }

    if (h.outcome) {
      handsWithOutcome++;
      // Use stored investment if available, otherwise calculate from actions
      const invested = getInvested(h);
      if (cash) totalInvested += invested;
      const a = h.outcome.amount || 0;
      if (h.outcome.result === 'won') {
        handsWon++;
        const profit = a - invested;
        if (cash) totalWonAmount += a;
        posMap[p].won++;
        if (cash) posMap[p].pnl += profit;
      } else {
        // folded or lost: investment is the loss
        if (cash) posMap[p].pnl -= invested;
      }
    }

    const hkey = parseHoleKey(h.hole);
    if (hkey) {
      if (!rangeMap[hkey]) {
        rangeMap[hkey] = { dealt: 0, played: 0, won: 0, pnl: 0 };
      }
      rangeMap[hkey].dealt++;

      const acts = parseActions(h.actions);
      const myActs = acts.filter(a => a.isMe);
      const didPlay = myActs.some(a => a.type === 'call' || a.type === 'raise' || a.type === 'bet');
      if (didPlay) {
        rangeMap[hkey].played++;
        vpip++;
        posMap[p].vpip++;
      }
      if (didPlay && h.outcome && h.outcome.result === 'won') {
        rangeMap[hkey].won++;
      }
      // Track P&L per hand combo
      if (h.outcome && cash) {
        const inv = getInvested(h);
        if (h.outcome.result === 'won') {
          rangeMap[hkey].pnl += (h.outcome.amount || 0) - inv;
        } else {
          rangeMap[hkey].pnl -= inv;
        }
      }
      // PFR: hero raised preflop
      const heroRaisedPre = myActs.some(a => a.street === 'Preflop' && (a.type === 'raise' || a.type === 'bet'));
      if (heroRaisedPre) pfrHands++;

      // Limp: hero called preflop without raising, and no prior raise existed
      if (!heroRaisedPre) {
        const heroCalledPre = myActs.some(a => a.street === 'Preflop' && a.type === 'call');
        if (heroCalledPre) {
          const preflopActsLimp = acts.filter(a => a.street === 'Preflop');
          var raiseBeforeHeroCall = false;
          for (var li = 0; li < preflopActsLimp.length; li++) {
            if (preflopActsLimp[li].isMe && preflopActsLimp[li].type === 'call') break;
            if (!preflopActsLimp[li].isMe && (preflopActsLimp[li].type === 'raise' || preflopActsLimp[li].type === 'bet')) {
              raiseBeforeHeroCall = true; break;
            }
          }
          if (!raiseBeforeHeroCall) limpHands++;
        }
      }

      const pfFold = myActs.find(a => a.street === 'Preflop' && a.type === 'fold');
      if (pfFold) posMap[p].foldPre++;

      const ht = classifyKey(hkey);
      if (!htMap[ht]) {
        htMap[ht] = { dealt: 0, played: 0, won: 0 };
      }
      htMap[ht].dealt++;
      if (didPlay) htMap[ht].played++;
      if (didPlay && h.outcome && h.outcome.result === 'won') htMap[ht].won++;
    }

    // Street-level and action stats
    const acts = parseActions(h.actions);
    const heroSeenStreets = new Set();
    let allinCountedThisHand = false;
    for (var ai = 0; ai < acts.length; ai++) {
      var a = acts[ai];
      // Only count hero actions for aggregate action stats
      if (a.isMe) {
        totalActs++;
        if (a.type === 'fold') folds++;
        else if (a.type === 'check') checks++;
        else if (a.type === 'call') calls++;
        else if (a.type === 'raise' || a.type === 'bet') raises++;
      }

      // Track which streets the hero reached (exclude blind posts — they don't indicate voluntary street play)
      if (a.isMe && a.type !== 'sb' && a.type !== 'bb' && !heroSeenStreets.has(a.street)) {
        heroSeenStreets.add(a.street);
        if (ss[a.street]) ss[a.street].seen++;
      }
      // Street-level action breakdown (hero only)
      if (a.isMe && ss[a.street]) {
        if (a.type === 'fold') ss[a.street].f++;
        else if (a.type === 'check') ss[a.street].ch++;
        else if (a.type === 'call') ss[a.street].ca++;
        else if (a.type === 'raise' || a.type === 'bet') ss[a.street].ra++;
      }

      if (a.type === 'raise' || a.type === 'bet') {
        if (a.amount > 0 && betAmts[a.street]) {
          betAmts[a.street].push(a.amount);
          if (cash) {
            var handBB = getHandBB(h);
            if (handBB && handBB > 0) {
              betAmtsBB[a.street].push(a.amount / handBB);
            }
          }
        }
      }

      // Bet opportunity tracking: when hero acts post-flop, count as opportunity; raises/bets count as betting
      if (a.isMe && a.street !== 'Preflop' && betOpps[a.street] && a.type !== 'sb' && a.type !== 'bb' && a.type !== 'won') {
        betOpps[a.street].t++;
        if (a.type === 'raise' || a.type === 'bet') betOpps[a.street].b++;
      }

      // All-in detection: uses shared helper that also verifies player doesn't act on later streets
      if (!allinCountedThisHand && !a.isMe && isAllInAction(acts, ai)) {
        const heroResp = acts.filter(b => b.isMe && b.street === a.street);
        const foldResp = heroResp.find(b => b.type === 'fold');
        const callResp = heroResp.find(b => b.type === 'call' || b.type === 'raise');
        if (foldResp || callResp) {
          allinCountedThisHand = true;
          facedAllin++;
          if (foldResp) foldAllin++;
          if (callResp) {
            callAllin++;
            if (h.outcome && h.outcome.result === 'won') wonAllin++;
          }
        }
      }
    }

    // sawFlop / wentToShowdown
    if (heroSeenStreets.has('Flop')) sawFlop++;
    if (isShowdown(h)) wentToShowdown++;

    // facedRaise / foldedToRaise (post-flop only)
    for (var fri = 0; fri < acts.length; fri++) {
      var fa = acts[fri];
      if (!fa.isMe && (fa.type === 'raise' || fa.type === 'bet') && fa.street !== 'Preflop') {
        for (var fk = fri + 1; fk < acts.length; fk++) {
          if (acts[fk].street !== fa.street) break;
          if (acts[fk].isMe) {
            facedRaise++;
            if (acts[fk].type === 'fold') foldedToRaise++;
            break;
          }
        }
      }
    }

    // 3-bet detection (preflop raises against hero)
    const preActs = acts.filter(a => a.street === 'Preflop');
    let raiseCount = 0;
    let faced3ThisHand = false;
    for (const a of preActs) {
      if (!a.isMe && a.type === 'raise') {
        raiseCount++;
        if (raiseCount >= 2) faced3ThisHand = true;
      }
      if (faced3ThisHand && a.isMe && (a.type === 'fold' || a.type === 'call')) {
        faced3bet++;
        if (a.type === 'fold') fold3bet++;
        break;
      }
    }

    // ── Situational stats ──
    // Identify PFR and bet levels
    const preflopActs = acts.filter(a => a.street === 'Preflop');
    let pfr = null;
    let sitRaiseLevel = 0;
    const raisers = [];
    let heroOpenedPF = false;
    let hero3betPF = false;

    for (const a of preflopActs) {
      if (a.type === 'raise') {
        sitRaiseLevel++;
        raisers.push({ author: a.author, isMe: a.isMe, level: sitRaiseLevel });
        pfr = { author: a.author, isMe: a.isMe };
        if (a.isMe && sitRaiseLevel === 1) heroOpenedPF = true;
        if (a.isMe && sitRaiseLevel === 2) hero3betPF = true;
      }
    }

    const flopReached = acts.some(a => a.street === 'Flop');
    const turnReached = acts.some(a => a.street === 'Turn');

    function heroFirstAction(actsList, street) {
      return actsList.find(a => a.isMe && a.street === street && a.type !== 'sb' && a.type !== 'bb');
    }
    const heroFirstFlop = heroFirstAction(acts, 'Flop');
    const heroFirstTurn = heroFirstAction(acts, 'Turn');

    // C-Bet
    if (pfr && pfr.isMe && flopReached && heroFirstFlop) {
      cbetOpps++;
      if (heroFirstFlop.type === 'raise' || heroFirstFlop.type === 'bet') cbetDone++;
    }

    // Delayed C-Bet
    if (pfr && pfr.isMe && flopReached && heroFirstFlop && heroFirstFlop.type === 'check' && turnReached && heroFirstTurn) {
      delayCbetOpps++;
      if (heroFirstTurn.type === 'raise' || heroFirstTurn.type === 'bet') delayCbetDone++;
    }

    // Donk Bet
    if (pfr && !pfr.isMe && sitRaiseLevel >= 1 && flopReached && heroFirstFlop) {
      donkOpps++;
      if (heroFirstFlop.type === 'raise' || heroFirstFlop.type === 'bet') donkDone++;
    }

    // Fold to C-Bet
    if (pfr && !pfr.isMe && flopReached) {
      const flopActs = acts.filter(a => a.street === 'Flop');
      const firstFlopBetIdx = flopActs.findIndex(a => a.type === 'raise' || a.type === 'bet');
      if (firstFlopBetIdx !== -1 && flopActs[firstFlopBetIdx].author === pfr.author) {
        const heroResponse = flopActs.find((a, i) => i > firstFlopBetIdx && a.isMe && (a.type === 'fold' || a.type === 'call' || a.type === 'raise'));
        if (heroResponse) {
          foldToCbetOpps++;
          if (heroResponse.type === 'fold') foldToCbetDone++;
        }
      }
    }

    // Fold to 3-Bet (hero opened)
    if (heroOpenedPF) {
      const threeBettor = raisers.find(r => r.level === 2 && !r.isMe);
      if (threeBettor) {
        const threeBetIdx = preflopActs.findIndex(a => !a.isMe && a.type === 'raise' && a.author === threeBettor.author);
        if (threeBetIdx !== -1) {
          const heroResp = preflopActs.find((a, i) => i > threeBetIdx && a.isMe && (a.type === 'fold' || a.type === 'call' || a.type === 'raise'));
          if (heroResp) {
            foldTo3betOpps++;
            if (heroResp.type === 'fold') foldTo3betDone++;
          }
        }
      }
    }

    // Fold to 4-Bet (hero 3-bet)
    if (hero3betPF) {
      const fourBettor = raisers.find(r => r.level === 3 && !r.isMe);
      if (fourBettor) {
        const fourBetIdx = preflopActs.findIndex(a => !a.isMe && a.type === 'raise' && a.author === fourBettor.author);
        if (fourBetIdx !== -1) {
          const heroResp = preflopActs.find((a, i) => i > fourBetIdx && a.isMe && (a.type === 'fold' || a.type === 'call' || a.type === 'raise'));
          if (heroResp) {
            foldTo4betOpps++;
            if (heroResp.type === 'fold') foldTo4betDone++;
          }
        }
      }
    }
  }

  // Derived percentages — single source of truth for all panels
  var core = {
    wr:        pct(handsWon, handsWithOutcome),
    vpipPct:   pct(vpip, n),
    pfrPct:    pct(pfrHands, n),
    agg:       calcAggression(raises, calls, checks),
    limpPct:   pct(limpHands, n),
    allinFold: pct(foldAllin, facedAllin),
    netPnl:    totalWonAmount - totalInvested,
    ftrPct:    pct(foldedToRaise, facedRaise),
    cbetPct:   pct(cbetDone, cbetOpps),
    wtsdPct:   pct(wentToShowdown, sawFlop),
  };

  return {
    n,
    hands,
    posMap,
    htMap,
    rangeMap,
    ss,
    handsWon,
    handsWithOutcome,
    totalWonAmount,
    totalInvested,
    folds,
    checks,
    calls,
    raises,
    totalActs,
    betAmts,
    betAmtsBB,
    betOpps,
    facedAllin,
    foldAllin,
    callAllin,
    wonAllin,
    faced3bet,
    fold3bet,
    vpip,
    cbetOpps, cbetDone,
    delayCbetOpps, delayCbetDone,
    donkOpps, donkDone,
    foldToCbetOpps, foldToCbetDone,
    foldTo3betOpps, foldTo3betDone,
    foldTo4betOpps, foldTo4betDone,
    pfrHands,
    limpHands,
    sawFlop,
    wentToShowdown,
    facedRaise,
    foldedToRaise,
    core,
  };
}

// Group hands by the dynamics axes and compute a sub-`d` per bucket. Returns
// { bySeatBucket, byFlopBucket, byStackBucket, byPosition, byPosSeat,
//   composition, mixCells } attached to the top-level `d` in render().
// Sub-`d`s are regular analyse() results so every metric is available at every
// level of granularity.
function bucketizeAnalysis(topD, hands) {
  var seatGroups = {};
  var flopGroups = {};
  var stackGroups = {};
  var posGroups = {};
  var posSeatGroups = {};
  var composition = {}; // { 'stack|seat': count }

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
      var gd = analyse(groups[k]);
      gd.gated = gateMin != null && gd.n < gateMin;
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

  // Flat list of {position, seatBucket, hands} for every cell that passes the
  // per-cell gate. Used by the verdict layer to compute weighted targets.
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

