// ── OPPONENT STATS ───────────────────────────────────────────────────────────
// Per-opponent tendency calculator and exploit-insight generator. Used by the
// players panel and by cacheOpponentProfiles() in opponent-profile.js.

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
    var h = hands[i];
    var acts = parseActions(h.actions);

    var playerActs = [];
    for (var j = 0; j < acts.length; j++) {
      if (acts[j].author === playerName) playerActs.push(acts[j]);
    }
    if (!playerActs.length) continue;
    s.hands++;

    // Preflop analysis
    var raisedPre = false;
    var calledPre = false;
    var foldedPre = false;
    for (var j = 0; j < playerActs.length; j++) {
      var pa = playerActs[j];
      if (pa.street !== 'Preflop') continue;
      if (pa.type === 'raise') raisedPre = true;
      if (pa.type === 'call') calledPre = true;
      if (pa.type === 'fold') foldedPre = true;
    }

    if (raisedPre || calledPre) s.vpipHands++;
    if (raisedPre) s.pfrHands++;
    if (calledPre && !raisedPre) s.limpHands++;
    if (foldedPre) s.foldPreHands++;

    // Post-flop presence
    var seenPostFlop = false;
    for (var j = 0; j < playerActs.length; j++) {
      if (playerActs[j].street !== 'Preflop') { seenPostFlop = true; break; }
    }
    if (seenPostFlop) s.sawFlop++;

    // Aggression counts (all streets, non-blind, non-won)
    for (var j = 0; j < playerActs.length; j++) {
      var a = playerActs[j];
      if (a.type === 'sb' || a.type === 'bb' || a.type === 'won') continue;
      s.totalActions++;
      if (a.type === 'raise' || a.type === 'bet') s.totalRaises++;
      else if (a.type === 'call') s.totalCalls++;
      else if (a.type === 'check') s.totalChecks++;
      else if (a.type === 'fold') s.totalFolds++;
    }

    // C-bet: raised preflop, saw flop, bet/raised on flop
    if (raisedPre && seenPostFlop) {
      s.cbetOpps++;
      for (var j = 0; j < playerActs.length; j++) {
        if (playerActs[j].street === 'Flop' && (playerActs[j].type === 'raise' || playerActs[j].type === 'bet')) {
          s.cbetDone++; break;
        }
      }
    }

    // Fold to raise: scan full action list for raise then this player's response
    for (var j = 0; j < acts.length; j++) {
      if (acts[j].author !== playerName && (acts[j].type === 'raise' || acts[j].type === 'bet')) {
        for (var k = j + 1; k < acts.length; k++) {
          if (acts[k].street !== acts[j].street) break;
          if (acts[k].author === playerName) {
            s.facedRaise++;
            if (acts[k].type === 'fold') s.foldedToRaise++;
            break;
          }
        }
      }
    }

    // Showdown detection
    var handHasShowdown = false;
    for (var j = 0; j < (h.actions || []).length; j++) {
      if ((h.actions[j] || '').indexOf(' reveals ') !== -1) {
        handHasShowdown = true; break;
      }
    }

    if (seenPostFlop && handHasShowdown) {
      var foldedPostFlop = false;
      for (var j = 0; j < playerActs.length; j++) {
        if (playerActs[j].street !== 'Preflop' && playerActs[j].type === 'fold') {
          foldedPostFlop = true; break;
        }
      }
      if (!foldedPostFlop) {
        s.wentToShowdown++;
        for (var j = 0; j < acts.length; j++) {
          if (acts[j].author === playerName && acts[j].type === 'won') {
            s.wonAtShowdown++; break;
          }
        }
      }
    }

    // Showdown strength from reveals
    for (var j = 0; j < (h.actions || []).length; j++) {
      var line = h.actions[j] || '';
      if (line.indexOf(playerName) !== -1 && line.indexOf(' reveals ') !== -1) {
        s.reveals++;
        var strengthMatch = line.match(/\(([^)]+)\)/);
        if (strengthMatch) {
          if (isStrongShowdownHand(strengthMatch[1])) s.showdownStrong++;
          else s.showdownWeak++;
        }
      }
    }
  }

  return s;
}

// Generate exploit insights based on opponent tendencies.
// `s` is the stats object from computeOpponentStats(). Calls
// findInsightExamples() (in opponent-examples.js) to attach a real hand to
// each tendency-based insight.
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
      insights.push(insWithExample('r', 'Very Loose', playerName + ' plays ' + vpip + '% of hands. They enter pots with weak holdings constantly.', [{ v: 'VPIP: ' + vpip + '%' }], examples.vpip, 'This hand shows ' + playerName + ' entering the pot - typical of their loose play style.'));
    } else if (vpip >= 40) {
      insights.push(insWithExample('a', 'Loose', playerName + ' plays ' + vpip + '% of hands. Wider than average, often with marginal cards.', [{ v: 'VPIP: ' + vpip + '%' }], examples.vpip, 'Here ' + playerName + ' enters the pot with a marginal holding.'));
    } else if (vpip <= 18) {
      insights.push(insWithExample('a', 'Very Tight', playerName + ' only plays ' + vpip + '% of hands. When they enter, they have something.', [{ v: 'VPIP: ' + vpip + '%' }], examples.vpip, 'One of the rare hands where ' + playerName + ' voluntarily entered the pot.'));
    }
  }

  // Limp
  if (limp !== null && limp >= 30) {
    insights.push(insWithExample('r', 'Limps Often', playerName + ' limps ' + limp + '% of hands. They rarely open-raise, preferring cheap flops.', [{ v: 'Limp: ' + limp + '%' }], examples.limp, playerName + ' limps in here instead of raising - a common pattern for them.'));
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
      insights.push(insWithExample('r', 'Folds to Pressure', playerName + ' folds ' + foldToRaise + '% when raised. Aggression prints money against them.', [{ v: 'Fold to raise: ' + foldToRaise + '%' }], examples.foldToRaise, playerName + ' folds here when facing a raise - very exploitable.'));
    } else if (foldToRaise <= 25) {
      insights.push(insWithExample('a', 'Calls Everything', playerName + ' only folds ' + foldToRaise + '% to raises. Bluffing them is expensive.', [{ v: 'Fold to raise: ' + foldToRaise + '%' }], examples.callsRaise, playerName + ' calls the raise here - they almost never fold to aggression.'));
    }
  }

  // C-bet
  if (cbet !== null && s.cbetOpps >= 5) {
    if (cbet >= 75) {
      insights.push(insWithExample('a', 'Auto C-Bets', playerName + ' continuation bets ' + cbet + '% of the time. Their flop bets often mean nothing.', [{ v: 'C-bet: ' + cbet + '%' }], examples.cbet, playerName + ' fires a c-bet on the flop after raising preflop - they do this almost automatically.'));
    } else if (cbet <= 30) {
      insights.push(insWithExample('o', 'Honest C-Bets', playerName + ' only c-bets ' + cbet + '%. When they bet the flop after raising pre, believe them.', [{ v: 'C-bet: ' + cbet + '%' }], examples.cbet, playerName + ' c-bets here - when they do this, they usually have a real hand.'));
    }
  }

  // WTSD
  if (wtsd !== null && s.sawFlop >= 10) {
    if (wtsd >= 55) {
      insights.push(insWithExample('a', 'Showdown Bound', playerName + ' goes to showdown ' + wtsd + '% of the time. They hate folding post-flop.', [{ v: 'WTSD: ' + wtsd + '%' }], examples.showdown, playerName + ' hangs on all the way to showdown in this hand.'));
    } else if (wtsd <= 25) {
      insights.push(insWithExample('o', 'Gives Up Easy', playerName + ' only reaches showdown ' + wtsd + '%. Pressure on later streets works well.', [{ v: 'WTSD: ' + wtsd + '%' }], examples.foldPostFlop, playerName + ' gives up post-flop here - sustained pressure works against them.'));
    }
  }

  // Showdown strength
  if (s.reveals >= 5) {
    var weakPct = pct(s.showdownWeak, s.reveals);
    if (weakPct >= 60) {
      insights.push(insWithExample('r', 'Weak at Showdown', playerName + ' shows weak hands ' + weakPct + '% of the time. They call down light.', [{ v: weakPct + '% weak reveals' }], examples.weakReveal, playerName + ' reveals a weak hand here - they call down too light.'));
    } else if (weakPct <= 25) {
      insights.push(insWithExample('o', 'Strong at Showdown', playerName + ' shows strong hands ' + (100 - weakPct) + '% of the time. Respect their river calls.', [{ v: (100 - weakPct) + '% strong reveals' }], examples.strongReveal, playerName + ' shows a strong hand - respect their showdown range.'));
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
