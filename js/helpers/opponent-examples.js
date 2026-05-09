// ── OPPONENT EXAMPLES ────────────────────────────────────────────────────────
// Walk a hand list backwards (newest first) and bucket each hand into the
// tendency categories that the players panel surfaces (vpip, limp, passive,
// aggressive, foldToRaise, callsRaise, cbet, showdown, foldPostFlop,
// weakReveal, strongReveal). Returns up to MAX_EX hands per bucket so the
// renderer can show recent illustrative examples next to each tendency.

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
      if (pa.type === 'raise' || pa.type === 'bet') raiseCount++;
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
        if (acts[j].author !== playerName && (acts[j].type === 'raise' || acts[j].type === 'bet')) {
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
        if (acts[j].author !== playerName && (acts[j].type === 'raise' || acts[j].type === 'bet')) {
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
        if (playerActs[j].street === 'Flop' && (playerActs[j].type === 'raise' || playerActs[j].type === 'bet')) {
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
          var isStrong = isStrongShowdownHand(strengthMatch[1]);
          if (!full('weakReveal') && !isStrong) ex.weakReveal.push(h);
          if (!full('strongReveal') && isStrong) ex.strongReveal.push(h);
        }
      }
    }
  }

  return ex;
}
