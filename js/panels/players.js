// ── PLAYERS PANEL ─────────────────────────────────────────────────────────────

// Compute opponent tendencies from their actions across all shared hands
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
      if (a.type === 'raise') s.totalRaises++;
      else if (a.type === 'call') s.totalCalls++;
      else if (a.type === 'check') s.totalChecks++;
      else if (a.type === 'fold') s.totalFolds++;
    }

    // C-bet: raised preflop, saw flop, bet/raised on flop
    if (raisedPre && seenPostFlop) {
      s.cbetOpps++;
      for (var j = 0; j < playerActs.length; j++) {
        if (playerActs[j].street === 'Flop' && playerActs[j].type === 'raise') {
          s.cbetDone++; break;
        }
      }
    }

    // Fold to raise: scan full action list for raise then this player's response
    for (var j = 0; j < acts.length; j++) {
      if (acts[j].author !== playerName && acts[j].type === 'raise') {
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
          var strength = strengthMatch[1].toLowerCase();
          if (strength.indexOf('two pair') !== -1 || strength.indexOf('three of a kind') !== -1 ||
              strength.indexOf('straight') !== -1 || strength.indexOf('flush') !== -1 ||
              strength.indexOf('full house') !== -1 || strength.indexOf('four of a kind') !== -1 ||
              strength.indexOf('straight flush') !== -1 || strength.indexOf('royal flush') !== -1) {
            s.showdownStrong++;
          } else {
            s.showdownWeak++;
          }
        }
      }
    }
  }

  return s;
}

// Generate exploit insights based on opponent tendencies
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
  var agg = pct(s.totalRaises, s.totalRaises + s.totalCalls + s.totalChecks);
  var foldToRaise = pct(s.foldedToRaise, s.facedRaise);
  var cbet = pct(s.cbetDone, s.cbetOpps);
  var wtsd = pct(s.wentToShowdown, s.sawFlop);

  // VPIP
  if (vpip !== null) {
    if (vpip >= 55) {
      insights.push(insWithExample('r', 'Very Loose', playerName + ' plays ' + vpip + '% of hands. They enter pots with weak holdings constantly.', [{ v: 'VPIP: ' + vpip + '%' }], examples.vpip, 'This hand shows ' + playerName + ' entering the pot — typical of their loose play style.'));
    } else if (vpip >= 40) {
      insights.push(insWithExample('a', 'Loose', playerName + ' plays ' + vpip + '% of hands. Wider than average, often with marginal cards.', [{ v: 'VPIP: ' + vpip + '%' }], examples.vpip, 'Here ' + playerName + ' enters the pot with a marginal holding.'));
    } else if (vpip <= 18) {
      insights.push(insWithExample('a', 'Very Tight', playerName + ' only plays ' + vpip + '% of hands. When they enter, they have something.', [{ v: 'VPIP: ' + vpip + '%' }], examples.vpip, 'One of the rare hands where ' + playerName + ' voluntarily entered the pot.'));
    }
  }

  // Limp
  if (limp !== null && limp >= 30) {
    insights.push(insWithExample('r', 'Limps Often', playerName + ' limps ' + limp + '% of hands. They rarely open-raise, preferring cheap flops.', [{ v: 'Limp: ' + limp + '%' }], examples.limp, playerName + ' limps in here instead of raising — a common pattern for them.'));
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
      insights.push(insWithExample('r', 'Folds to Pressure', playerName + ' folds ' + foldToRaise + '% when raised. Aggression prints money against them.', [{ v: 'Fold to raise: ' + foldToRaise + '%' }], examples.foldToRaise, playerName + ' folds here when facing a raise — very exploitable.'));
    } else if (foldToRaise <= 25) {
      insights.push(insWithExample('a', 'Calls Everything', playerName + ' only folds ' + foldToRaise + '% to raises. Bluffing them is expensive.', [{ v: 'Fold to raise: ' + foldToRaise + '%' }], examples.callsRaise, playerName + ' calls the raise here — they almost never fold to aggression.'));
    }
  }

  // C-bet
  if (cbet !== null && s.cbetOpps >= 5) {
    if (cbet >= 75) {
      insights.push(insWithExample('a', 'Auto C-Bets', playerName + ' continuation bets ' + cbet + '% of the time. Their flop bets often mean nothing.', [{ v: 'C-bet: ' + cbet + '%' }], examples.cbet, playerName + ' fires a c-bet on the flop after raising preflop — they do this almost automatically.'));
    } else if (cbet <= 30) {
      insights.push(insWithExample('o', 'Honest C-Bets', playerName + ' only c-bets ' + cbet + '%. When they bet the flop after raising pre, believe them.', [{ v: 'C-bet: ' + cbet + '%' }], examples.cbet, playerName + ' c-bets here — when they do this, they usually have a real hand.'));
    }
  }

  // WTSD
  if (wtsd !== null && s.sawFlop >= 10) {
    if (wtsd >= 55) {
      insights.push(insWithExample('a', 'Showdown Bound', playerName + ' goes to showdown ' + wtsd + '% of the time. They hate folding post-flop.', [{ v: 'WTSD: ' + wtsd + '%' }], examples.showdown, playerName + ' hangs on all the way to showdown in this hand.'));
    } else if (wtsd <= 25) {
      insights.push(insWithExample('o', 'Gives Up Easy', playerName + ' only reaches showdown ' + wtsd + '%. Pressure on later streets works well.', [{ v: 'WTSD: ' + wtsd + '%' }], examples.foldPostFlop, playerName + ' gives up post-flop here — sustained pressure works against them.'));
    }
  }

  // Showdown strength
  if (s.reveals >= 5) {
    var weakPct = pct(s.showdownWeak, s.reveals);
    if (weakPct >= 60) {
      insights.push(insWithExample('r', 'Weak at Showdown', playerName + ' shows weak hands ' + weakPct + '% of the time. They call down light.', [{ v: weakPct + '% weak reveals' }], examples.weakReveal, playerName + ' reveals a weak hand here — they call down too light.'));
    } else if (weakPct <= 25) {
      insights.push(insWithExample('o', 'Strong at Showdown', playerName + ' shows strong hands ' + (100 - weakPct) + '% of the time. Respect their river calls.', [{ v: (100 - weakPct) + '% strong reveals' }], examples.strongReveal, playerName + ' shows a strong hand — respect their showdown range.'));
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

// Find example hands for each insight type (returns arrays, max MAX_EX each)
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
    var acts = parseActions(h.actions);
    var playerActs = [];
    for (var j = 0; j < acts.length; j++) {
      if (acts[j].author === playerName) playerActs.push(acts[j]);
    }
    if (!playerActs.length) continue;

    var raisedPre = false, calledPre = false, limpedPre = false;
    var seenPostFlop = false, foldedPostFlop = false;
    var raiseCount = 0, callCheckCount = 0;

    for (var j = 0; j < playerActs.length; j++) {
      var pa = playerActs[j];
      if (pa.street === 'Preflop') {
        if (pa.type === 'raise') raisedPre = true;
        if (pa.type === 'call') calledPre = true;
        if (pa.type === 'call' && !raisedPre) limpedPre = true;
      }
      if (pa.street !== 'Preflop') seenPostFlop = true;
      if (pa.street !== 'Preflop' && pa.type === 'fold') foldedPostFlop = true;
      if (pa.type === 'raise') raiseCount++;
      if (pa.type === 'call' || pa.type === 'check') callCheckCount++;
    }

    // VPIP: entered pot voluntarily
    if (!full('vpip') && (raisedPre || calledPre)) ex.vpip.push(h);

    // Limp
    if (!full('limp') && limpedPre) ex.limp.push(h);

    // Passive: mostly calls/checks, no raises
    if (!full('passive') && callCheckCount >= 2 && raiseCount === 0) ex.passive.push(h);

    // Aggressive: multiple raises
    if (!full('aggressive') && raiseCount >= 2) ex.aggressive.push(h);

    // Fold to raise
    if (!full('foldToRaise')) {
      for (var j = 0; j < acts.length; j++) {
        if (acts[j].author !== playerName && acts[j].type === 'raise') {
          for (var k = j + 1; k < acts.length; k++) {
            if (acts[k].street !== acts[j].street) break;
            if (acts[k].author === playerName && acts[k].type === 'fold') {
              ex.foldToRaise.push(h); break;
            }
            if (acts[k].author === playerName) break;
          }
          if (ex.foldToRaise[ex.foldToRaise.length - 1] === h) break;
        }
      }
    }

    // Calls raise
    if (!full('callsRaise')) {
      for (var j = 0; j < acts.length; j++) {
        if (acts[j].author !== playerName && acts[j].type === 'raise') {
          for (var k = j + 1; k < acts.length; k++) {
            if (acts[k].street !== acts[j].street) break;
            if (acts[k].author === playerName && acts[k].type === 'call') {
              ex.callsRaise.push(h); break;
            }
            if (acts[k].author === playerName) break;
          }
          if (ex.callsRaise[ex.callsRaise.length - 1] === h) break;
        }
      }
    }

    // C-bet: raised pre, bet flop
    if (!full('cbet') && raisedPre && seenPostFlop) {
      for (var j = 0; j < playerActs.length; j++) {
        if (playerActs[j].street === 'Flop' && playerActs[j].type === 'raise') {
          ex.cbet.push(h); break;
        }
      }
    }

    // Showdown: went to showdown
    if (!full('showdown')) {
      var handHasShowdown = false;
      for (var j = 0; j < (h.actions || []).length; j++) {
        if ((h.actions[j] || '').indexOf(' reveals ') !== -1) { handHasShowdown = true; break; }
      }
      if (seenPostFlop && handHasShowdown && !foldedPostFlop) ex.showdown.push(h);
    }

    // Fold post-flop
    if (!full('foldPostFlop') && foldedPostFlop) ex.foldPostFlop.push(h);

    // Reveal strength
    for (var j = 0; j < (h.actions || []).length; j++) {
      var line = h.actions[j] || '';
      if (line.indexOf(playerName) !== -1 && line.indexOf(' reveals ') !== -1) {
        var strengthMatch = line.match(/\(([^)]+)\)/);
        if (strengthMatch) {
          var strength = strengthMatch[1].toLowerCase();
          var isStrong = strength.indexOf('two pair') !== -1 || strength.indexOf('three of a kind') !== -1 ||
              strength.indexOf('straight') !== -1 || strength.indexOf('flush') !== -1 ||
              strength.indexOf('full house') !== -1 || strength.indexOf('four of a kind') !== -1 ||
              strength.indexOf('straight flush') !== -1 || strength.indexOf('royal flush') !== -1;
          if (!full('weakReveal') && !isStrong) ex.weakReveal.push(h);
          if (!full('strongReveal') && isStrong) ex.strongReveal.push(h);
        }
      }
    }
  }

  return ex;
}

function renderPlayers(container, d, hands) {
  // Build opponent map
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
        var inv = getInvested(h);
        if (h.outcome.result === 'won') {
          oppMap[a.author].won++;
          oppMap[a.author].profit += (h.outcome.amount || 0) - inv;
        } else if (h.outcome.result === 'folded') {
          oppMap[a.author].folded++;
          oppMap[a.author].profit -= inv;
        } else {
          oppMap[a.author].lost++;
          oppMap[a.author].profit -= inv;
        }
      }
    }
  }

  var opponents = Object.keys(oppMap).map(function(k) { return oppMap[k]; });
  opponents.sort(function(a, b) { return b.hands - a.hands; });
  var filtered = opponents.filter(function(o) { return o.hands >= 2; });

  function getWatchedPlayers() {
    try { return JSON.parse(localStorage.getItem('tc_watched_players') || '[]'); } catch(e) { return []; }
  }
  function setWatchedPlayers(list) {
    localStorage.setItem('tc_watched_players', JSON.stringify(list));
  }
  function toggleWatch(name) {
    var list = getWatchedPlayers();
    var idx = list.indexOf(name);
    if (idx >= 0) list.splice(idx, 1); else list.push(name);
    setWatchedPlayers(list);
    renderPlayerList();
  }

  function renderPlayerList() {
    if (!filtered.length) {
      container.innerHTML = ins('n', 'Players', 'Not enough shared hands to show opponent stats. Keep playing to build data.', []);
      return;
    }
    var watched = getWatchedPlayers();
    var maxH = Math.max.apply(null, filtered.map(function(o) { return o.hands; }));
    var watchedOpps = filtered.filter(function(o) { return watched.indexOf(o.name) >= 0; });
    var html = '<div class="panel-title">Players</div>';
    html += '<div class="panel-desc">Opponent records, head-to-head stats, and watch list.</div>';

    if (watchedOpps.length) {
      html += '<div class="p-row"><div class="sec-subtitle mt-0">Watched Players</div>';
      html += '<div class="meta-text-mb">Click star to unwatch · click row to view hands</div>';
      html += '<div class="overflow-x"><table class="tbl"><thead><tr>';
      html += '<th></th><th>Player</th><th>Hands</th><th></th><th>' + tipWrap('Win Rate') + '</th><th>Net P&L</th>';
      html += '</tr></thead><tbody>';
      for (var w = 0; w < watchedOpps.length; w++) {
        var o = watchedOpps[w];
        var wr = pct(o.won, o.won + o.lost);
        var barW = Math.round(o.hands / maxH * 100);
        html += '<tr class="player-row row-hover" data-player="' + o.name + '">';
        html += '<td class="watch-star watched" data-watch="' + o.name + '" title="Unwatch player">&#9733;</td>';
        html += '<td>' + o.name + '</td><td>' + o.hands + '</td>';
        html += '<td style="width:80px;"><span class="tbl-spark" style="width:' + barW + '%;background:var(--gold2);"></span></td>';
        html += '<td class="' + wrCls(wr) + '">' + (wr !== null ? wr + '%' : '—') + '</td>';
        html += '<td class="' + pnlCls(o.profit) + '">' + fmtPnl(o.profit) + '</td></tr>';
      }
      html += '</tbody></table></div></div>';
    }

    var pIns = [];
    if (filtered.length >= 1) {
      pIns.push(ins('n', 'Most Seen', 'You have played ' + filtered[0].hands + ' hands with ' + filtered[0].name + '.', [{ v: filtered[0].name, hi: true }, { v: filtered[0].hands + ' hands' }]));
    }
    var best = null, worst = null;
    for (var m = 0; m < filtered.length; m++) {
      var ow = filtered[m];
      var owr = pct(ow.won, ow.won + ow.lost);
      if (owr === null || (ow.won + ow.lost) < 5) continue;
      if (!best || owr > pct(best.won, best.won + best.lost)) best = ow;
      if (!worst || owr < pct(worst.won, worst.won + worst.lost)) worst = ow;
    }
    if (best) pIns.push(ins('g', 'Best Record', 'You win ' + pct(best.won, best.won + best.lost) + '% against ' + best.name + ' (' + (best.won + best.lost) + ' contested hands).', [{ v: best.name, hi: true }, { v: pct(best.won, best.won + best.lost) + '% win' }]));
    if (worst && worst !== best) pIns.push(ins('r', 'Toughest Opponent', 'Only ' + pct(worst.won, worst.won + worst.lost) + '% win rate against ' + worst.name + ' (' + (worst.won + worst.lost) + ' contested hands).', [{ v: worst.name, hi: true }, { v: pct(worst.won, worst.won + worst.lost) + '% win' }]));
    if (pIns.length) html += '<div class="p-row"><div class="ins-grid">' + pIns.join('') + '</div></div>';

    html += '<div class="p-row"><div class="sec-subtitle mt-0">All Opponents</div>';
    html += '<div class="meta-text-mb">' + filtered.length + ' opponents with 2+ shared hands · click star to watch · click row to view hands</div>';
    html += '<div class="players-table-scroll"><table class="tbl"><thead><tr>';
    html += '<th></th><th>Player</th><th>Hands</th><th></th><th>' + tipWrap('Win Rate') + '</th><th>Net P&L</th>';
    html += '</tr></thead><tbody>';
    for (var k = 0; k < filtered.length; k++) {
      var o2 = filtered[k];
      var wr2 = pct(o2.won, o2.won + o2.lost);
      var barW2 = Math.round(o2.hands / maxH * 100);
      var isWatched = watched.indexOf(o2.name) >= 0;
      html += '<tr class="player-row row-hover" data-player="' + o2.name + '">';
      html += '<td class="watch-star' + (isWatched ? ' watched' : '') + '" data-watch="' + o2.name + '" title="' + (isWatched ? 'Unwatch' : 'Watch') + ' player">' + (isWatched ? '&#9733;' : '&#9734;') + '</td>';
      html += '<td>' + o2.name + '</td><td>' + o2.hands + '</td>';
      html += '<td style="width:80px;"><span class="tbl-spark" style="width:' + barW2 + '%;background:var(--gold2);"></span></td>';
      html += '<td class="' + wrCls(wr2) + '">' + (wr2 !== null ? wr2 + '%' : '—') + '</td>';
      html += '<td class="' + pnlCls(o2.profit) + '">' + fmtPnl(o2.profit) + '</td></tr>';
    }
    html += '</tbody></table></div></div>';
    container.innerHTML = html;

    container.querySelectorAll('.watch-star').forEach(function(star) {
      star.onclick = function(e) { e.stopPropagation(); toggleWatch(this.getAttribute('data-watch')); };
    });
    container.querySelectorAll('.player-row').forEach(function(row) {
      row.onclick = function() { renderPlayerHands(this.getAttribute('data-player')); };
    });
  }

  function renderPlayerHands(playerName) {
    var opp = oppMap[playerName];
    if (!opp) return;
    var playerHands = opp.handRefs.map(function(idx) { return hands[idx]; });
    var phPage = 0;
    var PH_SIZE = 50;

    var oppStats = computeOpponentStats(hands, playerName);

    function renderPage() {
      var start = phPage * PH_SIZE;
      var end = Math.min(start + PH_SIZE, playerHands.length);
      var page = playerHands.slice(start, end);
      var totalPages = Math.ceil(playerHands.length / PH_SIZE);
      var wr = pct(opp.won, opp.won + opp.lost);
      var ph = '<div class="flex-between mb-16">';
      ph += '<div><button class="log-nav-btn mr-12" id="players-back">&laquo; All Players</button>';
      ph += '<span class="player-detail-name">' + playerName + '</span></div>';
      ph += '<div class="meta-text">' + opp.hands + ' hands · ' + (wr !== null ? wr + '% win' : '—') + ' · ' + fmtPnl(opp.profit) + '</div></div>';

      // ── Opponent tendency minis with severity ──
      var vpip = pct(oppStats.vpipHands, oppStats.hands);
      var pfr = pct(oppStats.pfrHands, oppStats.hands);
      var limp = pct(oppStats.limpHands, oppStats.hands);
      var aggPct = pct(oppStats.totalRaises, oppStats.totalRaises + oppStats.totalCalls + oppStats.totalChecks);
      var ftr = pct(oppStats.foldedToRaise, oppStats.facedRaise);
      var cbet = pct(oppStats.cbetDone, oppStats.cbetOpps);
      var wtsd = pct(oppStats.wentToShowdown, oppStats.sawFlop);
      var wsd = pct(oppStats.wonAtShowdown, oppStats.wentToShowdown);

      function sev(v, rLo, rHi, aLo, aHi) {
        if (v === null) return 'text';
        if (v <= rLo || v >= rHi) return 'red';
        if (v <= aLo || v >= aHi) return 'amber';
        return 'green';
      }

      if (oppStats.hands >= 5) {
        var minis = [
          { l: tipWrap('VPIP'),       v: vpip !== null ? vpip + '%' : '—',     c: sev(vpip, -1, 55, 18, 40) },
          { l: 'PFR',                 v: pfr !== null ? pfr + '%' : '—',       c: sev(pfr, 8, 999, 8, 35) },
          { l: 'Limp',                v: limp !== null ? limp + '%' : '—',     c: sev(limp, -1, 30, -1, 20) },
          { l: tipWrap('Aggression'), v: aggPct !== null ? aggPct + '%' : '—', c: sev(aggPct, 15, 999, 15, 50) },
          { l: 'Fold to Raise',       v: ftr !== null ? ftr + '%' : '—',       c: sev(ftr, 25, 65, 25, 65) },
          { l: tipWrap('C-Bet'),      v: cbet !== null ? cbet + '%' : '—',     c: sev(cbet, -1, 999, -1, 75) },
          { l: 'WTSD',                v: wtsd !== null ? wtsd + '%' : '—',     c: sev(wtsd, 25, 55, 25, 55) },
          { l: 'WSD',                 v: wsd !== null ? wsd + '%' : '—',       c: sev(wsd, 35, 999, 35, 60) },
        ];

        ph += '<div class="sec-subtitle mt-0">Tendencies</div>';
        ph += renderMiniRow(minis);

        // ── Exploit insights ──
        var exploitIns = generateExploitInsights(oppStats, playerName, hands);
        if (exploitIns.length) {
          ph += '<div class="ins-grid mb-16">' + exploitIns.join('') + '</div>';
        }
      } else {
        ph += '<div class="mb-16">' + ins('n', 'Building Profile', 'Need ' + Math.max(0, 5 - oppStats.hands) + ' more shared hands to show tendency stats.', [{ v: oppStats.hands + '/5 hands' }]) + '</div>';
      }

      // ── Hand list ──
      ph += '<div class="sec-subtitle">Shared Hands</div>';
      if (totalPages > 1) {
        ph += '<div class="flex-gap-6 mb-8" style="justify-content:flex-end;">' +
          renderPagination(phPage, playerHands.length, PH_SIZE, 'ph-prev', 'ph-next') + '</div>';
      }
      ph += '<div class="overflow-x"><table class="tbl hlog-tbl"><thead><tr><th>Pos</th><th>Cards</th><th>Board</th><th>Actions</th><th>Result</th></tr></thead><tbody>';
      ph += page.map(function(h, pi) {
        return renderHandRow(h, start + pi, null).replace('data-hand-idx', 'data-ph-idx');
      }).join('') + '</tbody></table></div>';
      container.innerHTML = ph;
      document.getElementById('players-back').onclick = function() { renderPlayerList(); };
      container.querySelectorAll('.hrow[data-ph-idx]').forEach(function(row) {
        row.onclick = function() {
          var idx = parseInt(this.getAttribute('data-ph-idx'));
          if (!isNaN(idx) && playerHands[idx]) showExampleHandModal(playerHands[idx]);
        };
      });
      var prev = document.getElementById('ph-prev');
      var next = document.getElementById('ph-next');
      if (prev) prev.onclick = function() { phPage--; renderPage(); };
      if (next) next.onclick = function() { phPage++; renderPage(); };
    }
    renderPage();
  }

  renderPlayerList();
}