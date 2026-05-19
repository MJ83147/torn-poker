// ── OPPONENT STATS ───────────────────────────────────────────────────────────
// Per-opponent tendency calculator, illustrative-hand finder, and exploit-
// insight generator. Used by the players panel and by cacheOpponentProfiles()
// in opponent-profile.js.

// Walk a single hand once and produce every per-hand flag both
// computeOpponentStats() and findInsightExamples() need. Keeps the action-
// classification logic in one place; the two consumers just accumulate or
// bucket from the returned object.
function classifyHandForPlayer(h, playerName) {
  var acts = parseActions(h ? h.actions : null);
  var playerActs = [];
  for (var i = 0; i < acts.length; i++) {
    if (acts[i].author === playerName) playerActs.push(acts[i]);
  }

  var raisedPre = false, calledPre = false, foldedPre = false;
  var seenPostFlop = false, foldedPostFlop = false;
  var raiseCount = 0, callCheckCount = 0;
  var aggRaises = 0, aggCalls = 0, aggChecks = 0, aggFolds = 0, aggActions = 0;
  var playerWon = false;

  for (var j = 0; j < playerActs.length; j++) {
    var pa = playerActs[j];
    if (pa.type === 'won') playerWon = true;

    if (pa.street === 'Preflop') {
      if (pa.type === 'raise') raisedPre = true;
      if (pa.type === 'call') calledPre = true;
      if (pa.type === 'fold') foldedPre = true;
    } else {
      seenPostFlop = true;
      if (pa.type === 'fold') foldedPostFlop = true;
    }

    if (pa.type === 'raise' || pa.type === 'bet') raiseCount++;
    if (pa.type === 'call' || pa.type === 'check') callCheckCount++;

    if (pa.type !== 'sb' && pa.type !== 'bb' && pa.type !== 'won') {
      aggActions++;
      if (pa.type === 'raise' || pa.type === 'bet') aggRaises++;
      else if (pa.type === 'call') aggCalls++;
      else if (pa.type === 'check') aggChecks++;
      else if (pa.type === 'fold') aggFolds++;
    }
  }

  var limpedPre = calledPre && !raisedPre;

  // C-bet: raised pre, saw flop, first flop action by player was bet/raise.
  var cbetOpp = raisedPre && seenPostFlop;
  var cbetDone = false;
  if (cbetOpp) {
    for (var ci = 0; ci < playerActs.length; ci++) {
      if (playerActs[ci].street === 'Flop' && (playerActs[ci].type === 'raise' || playerActs[ci].type === 'bet')) {
        cbetDone = true; break;
      }
    }
  }

  // Walk full action list for "opponent raise then player response on the
  // same street". Track both per-encounter counts (for the rate denominator)
  // and per-hand booleans (for the example-hand buckets).
  var facedRaiseCount = 0, foldedToRaiseCount = 0;
  var facedRaiseThisHand = false, foldedToRaiseThisHand = false, calledRaiseThisHand = false;
  for (var ai = 0; ai < acts.length; ai++) {
    if (acts[ai].author !== playerName && (acts[ai].type === 'raise' || acts[ai].type === 'bet')) {
      for (var ak = ai + 1; ak < acts.length; ak++) {
        if (acts[ak].street !== acts[ai].street) break;
        if (acts[ak].author === playerName) {
          facedRaiseCount++;
          facedRaiseThisHand = true;
          if (acts[ak].type === 'fold') {
            foldedToRaiseCount++;
            foldedToRaiseThisHand = true;
          } else if (acts[ak].type === 'call') {
            calledRaiseThisHand = true;
          }
          break;
        }
      }
    }
  }

  // Showdown detection from the raw action lines. handHasShowdown matches any
  // " reveals " in the hand; playerReveals only captures lines mentioning the
  // target player and parses the strength group out of the trailing "(...)".
  var handHasShowdown = false;
  var playerReveals = [];
  var raw = (h && h.actions) ? h.actions : [];
  for (var li = 0; li < raw.length; li++) {
    var line = raw[li] || '';
    if (line.indexOf(' reveals ') === -1) continue;
    handHasShowdown = true;
    if (line.indexOf(playerName) !== -1) {
      var sm = line.match(/\(([^)]+)\)/);
      playerReveals.push({
        hasStrength: !!sm,
        isStrong: sm ? isStrongShowdownHand(sm[1]) : false
      });
    }
  }

  var wentToShowdown = seenPostFlop && handHasShowdown && !foldedPostFlop;

  return {
    hasPlayerActs: playerActs.length > 0,
    playerActs: playerActs,
    raisedPre: raisedPre, calledPre: calledPre, foldedPre: foldedPre,
    limpedPre: limpedPre,
    seenPostFlop: seenPostFlop, foldedPostFlop: foldedPostFlop,
    raiseCount: raiseCount, callCheckCount: callCheckCount,
    aggRaises: aggRaises, aggCalls: aggCalls, aggChecks: aggChecks,
    aggFolds: aggFolds, aggActions: aggActions,
    cbetOpp: cbetOpp, cbetDone: cbetDone,
    facedRaiseCount: facedRaiseCount, foldedToRaiseCount: foldedToRaiseCount,
    facedRaiseThisHand: facedRaiseThisHand,
    foldedToRaiseThisHand: foldedToRaiseThisHand,
    calledRaiseThisHand: calledRaiseThisHand,
    handHasShowdown: handHasShowdown,
    wentToShowdown: wentToShowdown,
    playerWon: playerWon,
    playerReveals: playerReveals
  };
}

// Compute opponent tendencies from their actions across all shared hands.
// Returns a stats object that the profile cache and the exploit-insight
// generator both read from. Shape:
//   {
//     hands, vpipHands, pfrHands, limpHands, foldPreHands,
//     totalRaises, totalCalls, totalChecks, totalFolds, totalActions,
//     cbetOpps, cbetDone, facedRaise, foldedToRaise,
//     sawFlop, wentToShowdown, wonAtShowdown,
//     showdownStrong, showdownWeak, reveals
//   }
function computeOpponentStats(hands, playerName) {
  var s = {
    hands: 0,
    vpipHands: 0,
    pfrHands: 0,
    limpHands: 0,
    foldPreHands: 0,
    totalRaises: 0,
    totalCalls: 0,
    totalChecks: 0,
    totalFolds: 0,
    totalActions: 0,
    cbetOpps: 0,
    cbetDone: 0,
    facedRaise: 0,
    foldedToRaise: 0,
    sawFlop: 0,
    wentToShowdown: 0,
    wonAtShowdown: 0,
    showdownStrong: 0,
    showdownWeak: 0,
    reveals: 0,
  };

  for (var i = 0; i < hands.length; i++) {
    var c = classifyHandForPlayer(hands[i], playerName);
    if (!c.hasPlayerActs) continue;
    s.hands++;

    if (c.raisedPre || c.calledPre) s.vpipHands++;
    if (c.raisedPre) s.pfrHands++;
    if (c.limpedPre) s.limpHands++;
    if (c.foldedPre) s.foldPreHands++;
    if (c.seenPostFlop) s.sawFlop++;

    s.totalRaises  += c.aggRaises;
    s.totalCalls   += c.aggCalls;
    s.totalChecks  += c.aggChecks;
    s.totalFolds   += c.aggFolds;
    s.totalActions += c.aggActions;

    if (c.cbetOpp) {
      s.cbetOpps++;
      if (c.cbetDone) s.cbetDone++;
    }

    s.facedRaise    += c.facedRaiseCount;
    s.foldedToRaise += c.foldedToRaiseCount;

    if (c.wentToShowdown) {
      s.wentToShowdown++;
      if (c.playerWon) s.wonAtShowdown++;
    }

    for (var ri = 0; ri < c.playerReveals.length; ri++) {
      s.reveals++;
      if (!c.playerReveals[ri].hasStrength) continue;
      if (c.playerReveals[ri].isStrong) s.showdownStrong++;
      else s.showdownWeak++;
    }
  }

  return s;
}

// Batch version of computeOpponentStats: walks `hands` once and produces a
// { name -> statsObj } map for every opponent that appears. Identical numbers
// to computeOpponentStats but O(hands) instead of O(opponents × hands), which
// matters once the profile cache is built across tens of thousands of hands.
function computeAllOpponentStats(hands) {
  var byName = {};
  function statsFor(name) {
    var s = byName[name];
    if (s) return s;
    s = byName[name] = {
      hands: 0, vpipHands: 0, pfrHands: 0, limpHands: 0, foldPreHands: 0,
      totalRaises: 0, totalCalls: 0, totalChecks: 0, totalFolds: 0, totalActions: 0,
      cbetOpps: 0, cbetDone: 0, facedRaise: 0, foldedToRaise: 0,
      sawFlop: 0, wentToShowdown: 0, wonAtShowdown: 0,
      showdownStrong: 0, showdownWeak: 0, reveals: 0,
    };
    return s;
  }

  for (var hi = 0; hi < hands.length; hi++) {
    var h = hands[hi];
    var acts = parseActions(h ? h.actions : null);
    if (!acts.length) continue;

    var perHand = {};
    function entry(name) {
      var p = perHand[name];
      if (p) return p;
      p = perHand[name] = {
        raisedPre: false, calledPre: false, foldedPre: false,
        seenPostFlop: false, foldedPostFlop: false,
        aggRaises: 0, aggCalls: 0, aggChecks: 0, aggFolds: 0, aggActions: 0,
        firstFlopActionSeen: false, cbetDone: false,
        facedRaiseCount: 0, foldedToRaiseCount: 0,
        playerWon: false
      };
      return p;
    }

    for (var ai = 0; ai < acts.length; ai++) {
      var a = acts[ai];
      if (!a.author || a.isMe) continue;
      var p = entry(a.author);

      if (a.type === 'won') { p.playerWon = true; continue; }

      if (a.street === 'Preflop') {
        if (a.type === 'raise') p.raisedPre = true;
        if (a.type === 'call') p.calledPre = true;
        if (a.type === 'fold') p.foldedPre = true;
      } else {
        p.seenPostFlop = true;
        if (a.type === 'fold') p.foldedPostFlop = true;
      }

      if (a.type !== 'sb' && a.type !== 'bb') {
        p.aggActions++;
        if (a.type === 'raise' || a.type === 'bet') p.aggRaises++;
        else if (a.type === 'call') p.aggCalls++;
        else if (a.type === 'check') p.aggChecks++;
        else if (a.type === 'fold') p.aggFolds++;
      }

      if (a.street === 'Flop' && !p.firstFlopActionSeen) {
        p.firstFlopActionSeen = true;
        if (a.type === 'raise' || a.type === 'bet') p.cbetDone = true;
      }
    }

    // facedRaise: for each raise/bet at index ri by author X, find each other
    // opponent's first response on the same street. Mirrors the per-player loop
    // inside classifyHandForPlayer so the numbers match exactly.
    for (var ri = 0; ri < acts.length; ri++) {
      var r = acts[ri];
      if (r.type !== 'raise' && r.type !== 'bet') continue;
      if (!r.author) continue;
      var counted = {};
      for (var rk = ri + 1; rk < acts.length; rk++) {
        if (acts[rk].street !== r.street) break;
        var b = acts[rk];
        if (!b.author || b.author === r.author) continue;
        if (b.isMe) continue;
        if (counted[b.author]) continue;
        counted[b.author] = true;
        var pp = entry(b.author);
        pp.facedRaiseCount++;
        if (b.type === 'fold') pp.foldedToRaiseCount++;
      }
    }

    // Showdowns. Walk raw lines once and credit reveals to whichever known
    // perHand author the line starts with.
    var raw = (h && h.actions) ? h.actions : [];
    var handHasShowdown = false;
    var revealStrengths = {};
    for (var li = 0; li < raw.length; li++) {
      var line = raw[li] || '';
      if (line.indexOf(' reveals ') === -1) continue;
      handHasShowdown = true;
      var sm = line.match(/\(([^)]+)\)/);
      var info = { hasStrength: !!sm, isStrong: sm ? isStrongShowdownHand(sm[1]) : false };
      for (var pname in perHand) {
        if (line.indexOf(pname) !== -1) {
          (revealStrengths[pname] = revealStrengths[pname] || []).push(info);
          break;
        }
      }
    }

    for (var pname2 in perHand) {
      var pp2 = perHand[pname2];
      var s = statsFor(pname2);
      s.hands++;
      if (pp2.raisedPre || pp2.calledPre) s.vpipHands++;
      if (pp2.raisedPre) s.pfrHands++;
      if (pp2.calledPre && !pp2.raisedPre) s.limpHands++;
      if (pp2.foldedPre) s.foldPreHands++;
      if (pp2.seenPostFlop) s.sawFlop++;
      s.totalRaises  += pp2.aggRaises;
      s.totalCalls   += pp2.aggCalls;
      s.totalChecks  += pp2.aggChecks;
      s.totalFolds   += pp2.aggFolds;
      s.totalActions += pp2.aggActions;
      if (pp2.raisedPre && pp2.seenPostFlop) {
        s.cbetOpps++;
        if (pp2.cbetDone) s.cbetDone++;
      }
      s.facedRaise    += pp2.facedRaiseCount;
      s.foldedToRaise += pp2.foldedToRaiseCount;
      if (pp2.seenPostFlop && handHasShowdown && !pp2.foldedPostFlop) {
        s.wentToShowdown++;
        if (pp2.playerWon) s.wonAtShowdown++;
      }
      var revs = revealStrengths[pname2] || [];
      for (var rvi = 0; rvi < revs.length; rvi++) {
        s.reveals++;
        if (!revs[rvi].hasStrength) continue;
        if (revs[rvi].isStrong) s.showdownStrong++;
        else s.showdownWeak++;
      }
    }
  }

  return byName;
}

// Walk a hand list backwards (newest first) and bucket each hand into the
// tendency categories that the players panel surfaces. Returns up to MAX_EX
// hands per bucket so the renderer can show illustrative examples next to
// each tendency. Called by generateExploitInsights below.
function findInsightExamples(hands, playerName) {
  var MAX_EX = 20;
  var ex = {
    vpip: [], limp: [], passive: [], aggressive: [],
    foldToRaise: [], callsRaise: [], cbet: [],
    showdown: [], foldPostFlop: [], weakReveal: [], strongReveal: []
  };

  function full(key) { return ex[key].length >= MAX_EX; }
  function allFull() {
    for (var k in ex) { if (ex[k].length < MAX_EX) return false; }
    return true;
  }

  for (var i = hands.length - 1; i >= 0; i--) {
    if (allFull()) break;
    var h = hands[i];
    var c = classifyHandForPlayer(h, playerName);
    if (!c.hasPlayerActs) continue;

    if (!full('vpip') && (c.raisedPre || c.calledPre)) ex.vpip.push(h);
    if (!full('limp') && c.limpedPre) ex.limp.push(h);
    if (!full('passive') && c.callCheckCount >= 2 && c.raiseCount === 0) ex.passive.push(h);
    if (!full('aggressive') && c.raiseCount >= 2) ex.aggressive.push(h);

    if (!full('foldToRaise') && c.foldedToRaiseThisHand) ex.foldToRaise.push(h);
    if (!full('callsRaise') && c.calledRaiseThisHand) ex.callsRaise.push(h);
    if (!full('cbet') && c.cbetDone) ex.cbet.push(h);

    if (!full('showdown') && c.wentToShowdown) ex.showdown.push(h);
    if (!full('foldPostFlop') && c.foldedPostFlop) ex.foldPostFlop.push(h);

    for (var ri = 0; ri < c.playerReveals.length; ri++) {
      if (!c.playerReveals[ri].hasStrength) continue;
      var isStrong = c.playerReveals[ri].isStrong;
      if (!full('weakReveal') && !isStrong) ex.weakReveal.push(h);
      if (!full('strongReveal') && isStrong) ex.strongReveal.push(h);
    }
  }

  return ex;
}

// Generate exploit insights based on opponent tendencies. `s` is the stats
// object from computeOpponentStats(); each insight gets an illustrative hand
// attached via findInsightExamples() above.
function generateExploitInsights(s, playerName, hands) {
  var insights = [];
  var MIN_HANDS = 10;
  var EXPLOIT_HANDS = 20;

  if (s.hands < MIN_HANDS) {
    insights.push(ins('n', 'Building Profile', 'Need ' + (MIN_HANDS - s.hands) + ' more shared hands before tendencies become reliable.', [
      { v: s.hands + '/' + MIN_HANDS + ' hands' }
    ]));
    return insights;
  }

  // Find example hands for each insight type
  var examples = findInsightExamples(hands || [], playerName);

  var vpip = pct(s.vpipHands, s.hands);
  var pfr = pct(s.pfrHands, s.hands);
  var limp = pct(s.limpHands, s.hands);
  var agg = calcAggression(s.totalRaises, s.totalCalls, s.totalChecks);
  var foldToRaise = pct(s.foldedToRaise, s.facedRaise);
  var cbet = pct(s.cbetDone, s.cbetOpps);
  var wtsd = pct(s.wentToShowdown, s.sawFlop);

  // VPIP
  if (vpip !== null) {
    if (vpip >= 55) {
      insights.push(insWithExample('r', 'Very Loose', playerName + ' plays ' + vpip + '% of hands. They enter pots with weak holdings constantly.', [{ v: 'VPIP: ' + vpip + '%' }], examples.vpip, 'This hand shows ' + playerName + ' entering the pot. Typical of their loose play style.'));
    } else if (vpip >= 40) {
      insights.push(insWithExample('a', 'Loose', playerName + ' plays ' + vpip + '% of hands. Wider than average, often with marginal cards.', [{ v: 'VPIP: ' + vpip + '%' }], examples.vpip, 'Here ' + playerName + ' enters the pot with a marginal holding.'));
    } else if (vpip <= 18) {
      insights.push(insWithExample('a', 'Very Tight', playerName + ' only plays ' + vpip + '% of hands. When they enter, they have something.', [{ v: 'VPIP: ' + vpip + '%' }], examples.vpip, 'One of the rare hands where ' + playerName + ' voluntarily entered the pot.'));
    }
  }

  // Limp
  if (limp !== null && limp >= 30) {
    insights.push(insWithExample('r', 'Limps Often', playerName + ' limps ' + limp + '% of hands. They rarely open-raise, preferring cheap flops.', [{ v: 'Limp: ' + limp + '%' }], examples.limp, playerName + ' limps in here instead of raising. A common pattern for them.'));
  }

  // Aggression
  if (agg !== null) {
    if (agg < 15) {
      insights.push(insWithExample('r', 'Passive', playerName + ' only raises ' + agg + '% of the time. Calls and checks dominate.', [{ v: 'Aggression: ' + agg + '%' }], examples.passive, 'Watch how ' + playerName + ' checks and calls through this hand instead of raising.'));
    } else if (agg >= 50) {
      insights.push(insWithExample('a', 'Aggressive', playerName + ' raises ' + agg + '% of the time. They apply pressure frequently.', [{ v: 'Aggression: ' + agg + '%' }], examples.aggressive, playerName + ' applies pressure with raises throughout this hand.'));
    }
  }

  // Fold to raise
  if (foldToRaise !== null && s.facedRaise >= 5) {
    if (foldToRaise >= 65) {
      insights.push(insWithExample('r', 'Folds to Pressure', playerName + ' folds ' + foldToRaise + '% when raised. Aggression prints money against them.', [{ v: 'Fold to raise: ' + foldToRaise + '%' }], examples.foldToRaise, playerName + ' folds here when facing a raise. Very exploitable.'));
    } else if (foldToRaise <= 25) {
      insights.push(insWithExample('a', 'Calls Everything', playerName + ' only folds ' + foldToRaise + '% to raises. Bluffing them is expensive.', [{ v: 'Fold to raise: ' + foldToRaise + '%' }], examples.callsRaise, playerName + ' calls the raise here. They almost never fold to aggression.'));
    }
  }

  // C-bet
  if (cbet !== null && s.cbetOpps >= 5) {
    if (cbet >= 75) {
      insights.push(insWithExample('a', 'Auto C-Bets', playerName + ' continuation bets ' + cbet + '% of the time. Their flop bets often mean nothing.', [{ v: 'C-bet: ' + cbet + '%' }], examples.cbet, playerName + ' fires a c-bet on the flop after raising preflop. They do this almost automatically.'));
    } else if (cbet <= 30) {
      insights.push(insWithExample('o', 'Honest C-Bets', playerName + ' only c-bets ' + cbet + '%. When they bet the flop after raising pre, believe them.', [{ v: 'C-bet: ' + cbet + '%' }], examples.cbet, playerName + ' c-bets here. When they do this, they usually have a real hand.'));
    }
  }

  // WTSD
  if (wtsd !== null && s.sawFlop >= 10) {
    if (wtsd >= 55) {
      insights.push(insWithExample('a', 'Showdown Bound', playerName + ' goes to showdown ' + wtsd + '% of the time. They hate folding post-flop.', [{ v: 'WTSD: ' + wtsd + '%' }], examples.showdown, playerName + ' hangs on all the way to showdown in this hand.'));
    } else if (wtsd <= 25) {
      insights.push(insWithExample('o', 'Gives Up Easy', playerName + ' only reaches showdown ' + wtsd + '%. Pressure on later streets works well.', [{ v: 'WTSD: ' + wtsd + '%' }], examples.foldPostFlop, playerName + ' gives up post-flop here. Sustained pressure works against them.'));
    }
  }

  // Showdown strength
  if (s.reveals >= 5) {
    var weakPct = pct(s.showdownWeak, s.reveals);
    if (weakPct >= 60) {
      insights.push(insWithExample('r', 'Weak at Showdown', playerName + ' shows weak hands ' + weakPct + '% of the time. They call down light.', [{ v: weakPct + '% weak reveals' }], examples.weakReveal, playerName + ' reveals a weak hand here. They call down too light.'));
    } else if (weakPct <= 25) {
      insights.push(insWithExample('o', 'Strong at Showdown', playerName + ' shows strong hands ' + (100 - weakPct) + '% of the time. Respect their river calls.', [{ v: (100 - weakPct) + '% strong reveals' }], examples.strongReveal, playerName + ' shows a strong hand. Respect their showdown range.'));
    }
  }

  // Exploit plan (needs more data)
  if (s.hands >= EXPLOIT_HANDS && insights.length > 0) {
    var exploits = [];

    if (vpip >= 50 && foldToRaise !== null && foldToRaise >= 50) {
      exploits.push('Raise their limps and wide entries. They play too many hands and fold too often to pressure.');
    } else if (vpip >= 50 && foldToRaise !== null && foldToRaise < 30) {
      exploits.push('Value bet relentlessly. They call with weak hands and rarely fold. Do not bluff.');
    }
    if (agg !== null && agg < 20 && cbet !== null && cbet <= 40) {
      exploits.push('Steal pots post-flop with aggression. They check and call passively, so take initiative.');
    }
    if (cbet !== null && cbet >= 75 && foldToRaise !== null && foldToRaise >= 50) {
      exploits.push('Raise their c-bets. They bet the flop automatically but fold when challenged.');
    }
    if (limp !== null && limp >= 30) {
      exploits.push('Isolate their limps with raises. They see cheap flops with junk; make them pay.');
    }
    if (wtsd !== null && wtsd >= 55 && s.sawFlop >= 10) {
      exploits.push('Bet for value on all streets. They will call down to showdown with marginal hands.');
    }
    if (wtsd !== null && wtsd <= 25 && s.sawFlop >= 10) {
      exploits.push('Fire multiple barrels. They fold post-flop often, so sustained pressure wins pots.');
    }

    if (exploits.length) {
      insights.push(ins('g', 'Exploit Plan', exploits.join(' '), []));
    }
  }

  if (!insights.length) {
    insights.push(ins('n', 'Tendencies', playerName + ' plays a balanced style with no obvious leaks from ' + s.hands + ' hands. Keep gathering data.', [{ v: s.hands + ' hands' }]));
  }

  return insights;
}
