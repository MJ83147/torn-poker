// Players panel logic. No DOM, no markup — the view is
// js/panels/views/players.js.

// Per-opponent record across the hand set. handRefs are indices into hands.
function playersModel(hands) {
  var oppMap = {};
  for (var i = 0; i < hands.length; i++) {
    var h = hands[i];
    var acts = parseActions(h.actions);
    var seenInHand = {};
    for (var j = 0; j < acts.length; j++) {
      var a = acts[j];
      if (a.isMe || !a.author || seenInHand[a.author]) continue;
      seenInHand[a.author] = true;
      if (!oppMap[a.author]) {
        oppMap[a.author] = { name: a.author, hands: 0, won: 0, lost: 0, folded: 0, profit: 0, handRefs: [] };
      }
      oppMap[a.author].hands++;
      oppMap[a.author].handRefs.push(i);
      if (h.outcome) {
        if (h.outcome.result === 'won') oppMap[a.author].won++;
        else if (h.outcome.result === 'folded') oppMap[a.author].folded++;
        else oppMap[a.author].lost++;
        oppMap[a.author].profit += getHandPnlValue(h);
      }
    }
  }

  var opponents = Object.keys(oppMap).map(function(k) { return oppMap[k]; });
  opponents.sort(function(a, b) { return b.hands - a.hands; });

  return {
    oppMap: oppMap,
    filtered: opponents.filter(function(o) { return o.hands >= 2; }),
  };
}

function sortOpponents(list, col, dir) {
  return list.slice().sort(function(a, b) {
    var va, vb;
    if (col === 'name') {
      va = a.name.toLowerCase();
      vb = b.name.toLowerCase();
      return dir === 'asc' ? (va < vb ? -1 : va > vb ? 1 : 0) : va > vb ? -1 : va < vb ? 1 : 0;
    }
    if (col === 'hands') { va = a.hands; vb = b.hands; }
    else if (col === 'wr') {
      va = pct(a.won, a.won + a.lost) || 0;
      vb = pct(b.won, b.won + b.lost) || 0;
    } else if (col === 'pnl') { va = a.profit; vb = b.profit; }
    else { va = a.hands; vb = b.hands; }
    return dir === 'asc' ? va - vb : vb - va;
  });
}

function getWatchedPlayers() {
  return getJSON('tc_watched_players', []);
}
function setWatchedPlayers(list) {
  setJSON('tc_watched_players', list);
}

// Everyone seen in the actions, hero first, then by hand count.
function comparePlayersList(hands, heroName) {
  var playerSet = {};
  for (var i = 0; i < hands.length; i++) {
    var acts = parseActions(hands[i].actions);
    for (var j = 0; j < acts.length; j++) {
      var author = acts[j].author;
      if (author && author !== '?') playerSet[author] = (playerSet[author] || 0) + 1;
    }
  }
  var names = Object.keys(playerSet).sort(function(a, b) {
    if (a === heroName) return -1;
    if (b === heroName) return 1;
    return playerSet[b] - playerSet[a];
  });
  return { counts: playerSet, names: names };
}

// Map raw opponent counters onto the same stat keys the hero uses.
function opponentStatsMapped(hands, name) {
  var s = computeOpponentStats(hands, name);
  return {
    hands: s.hands,
    vpip: pct(s.vpipHands, s.hands),
    pfr: pct(s.pfrHands, s.hands),
    agg: calcAggression(s.totalRaises, s.totalCalls, s.totalChecks),
    cbet: pct(s.cbetDone, s.cbetOpps),
    foldToRaise: pct(s.foldedToRaise, s.facedRaise),
    wtsd: pct(s.wentToShowdown, s.sawFlop),
    limp: pct(s.limpHands, s.hands),
    wr: pct(s.wonAtShowdown, s.wentToShowdown),
    netPnl: null,
  };
}

function heroStatsMapped(d) {
  var c = d.core || {};
  return {
    hands: d.n,
    vpip: c.vpipPct,
    pfr: c.pfrPct,
    agg: c.agg,
    cbet: c.cbetPct,
    foldToRaise: c.ftrPct,
    wtsd: c.wtsdPct,
    limp: c.limpPct,
    wr: c.wr,
    netPnl: c.netPnl,
  };
}

// One-line edge note for a compared stat. Gated by sample size.
function compareEdgeText(stat, v1, v2, n1, n2) {
  if (v1 === null || v2 === null) return '';
  var diff = v1 - v2;
  var smaller = Math.min(n1 || 0, n2 || 0);
  var gate = 3 * Math.max(1, Math.sqrt(40 / Math.max(1, smaller)));
  if (Math.abs(diff) < gate) return '';
  switch (stat) {
    case 'vpip': return (v1 > v2 ? 'P1' : 'P2') + ' is looser';
    case 'pfr': return (v1 > v2 ? 'P1' : 'P2') + ' more aggressive pre';
    case 'agg': return (v1 > v2 ? 'P1' : 'P2') + ' pressures more';
    case 'cbet': return (v1 > v2 ? 'P1' : 'P2') + ' follows up more';
    case 'foldToRaise': return (v1 > v2 ? 'P1' : 'P2') + ' more exploitable';
    case 'wtsd': return (v1 > v2 ? 'P1' : 'P2') + ' calls down more';
    case 'limp': return (v1 > v2 ? 'P1' : 'P2') + ' limps more';
    default: return '';
  }
}

// Shared hands between two players and who won them.
function compareSharedHands(hands, p1Name, p2Name) {
  var shared = [], p1Wins = 0, p2Wins = 0;
  for (var i = 0; i < hands.length; i++) {
    var h = hands[i];
    var acts = parseActions(h.actions);
    var hasP1 = false, hasP2 = false;
    for (var j = 0; j < acts.length; j++) {
      if (acts[j].author === p1Name) hasP1 = true;
      if (acts[j].author === p2Name) hasP2 = true;
    }
    if (hasP1 && hasP2) {
      shared.push(h);
      for (var k = 0; k < acts.length; k++) {
        if (acts[k].type === 'won') {
          if (acts[k].author === p1Name) p1Wins++;
          if (acts[k].author === p2Name) p2Wins++;
          break;
        }
      }
    }
  }
  return { hands: shared, p1Wins: p1Wins, p2Wins: p2Wins };
}

// Exploit tips against the non-hero target, gated by dominant table size.
function compareExploits(d, targetName, targetStats) {
  var seats = (function() {
    if (!d || !d.bySeatBucket) return null;
    var best = null, bestN = 0;
    for (var sb in d.bySeatBucket) {
      var sd = d.bySeatBucket[sb];
      if (!sd || (sd.n || 0) <= bestN) continue;
      bestN = sd.n;
      best = parseInt(sb, 10);
    }
    return best ? Math.max(2, Math.min(9, best)) : null;
  })();
  var oppProf = typeof _opponentCache !== 'undefined' && targetName ? _opponentCache[targetName] : null;
  var latePosBias = oppProf && oppProf.raw && typeof oppProf.raw.latePos === 'number' ? oppProf.raw.latePos : null;

  var ftrGate = seats && seats <= 2 ? 50 : seats && seats <= 4 ? 55 : 60;
  var cbetGate = seats && seats <= 2 ? 55 : seats && seats <= 4 ? 45 : 35;
  var wtsdGate = seats && seats <= 2 ? 45 : 40;
  var limpGate = seats && seats <= 3 ? 35 : 20;
  var aggGate = 15;
  var vpipGate = seats && seats <= 2 ? 75 : seats && seats <= 3 ? 60 : 50;

  var exploits = [];
  if (targetStats.foldToRaise !== null && targetStats.foldToRaise >= ftrGate) {
    var lateNote = latePosBias && latePosBias > 0.55 ? ' Especially in late position where they open even wider.' : '';
    exploits.push(targetName + ' folds to raises ' + targetStats.foldToRaise + '%: raise wide against them.' + lateNote);
  }
  if (targetStats.cbet !== null && targetStats.cbet <= cbetGate) {
    exploits.push(targetName + ' c-bets only ' + targetStats.cbet + '%: float their checks on the flop and bet when they show weakness.');
  }
  if (targetStats.wtsd !== null && targetStats.wtsd >= wtsdGate) {
    exploits.push(targetName + ' goes to showdown ' + targetStats.wtsd + '%: value bet thin, they call down.');
  }
  if (targetStats.limp !== null && targetStats.limp >= limpGate) {
    exploits.push(targetName + ' limps ' + targetStats.limp + '%: raise their limps with a wide range.');
  }
  if (targetStats.agg !== null && targetStats.agg <= aggGate) {
    exploits.push(targetName + ' is passive (' + targetStats.agg + '% agg). Their bets mean strength, fold more to them.');
  }
  if (targetStats.vpip !== null && targetStats.vpip >= vpipGate) {
    exploits.push(targetName + ' plays ' + targetStats.vpip + '% of hands at this table size: tighten up and value bet relentlessly.');
  }
  return exploits;
}
