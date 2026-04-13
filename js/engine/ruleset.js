// ── INSIGHT ENGINE: RULE DEFINITIONS ────────────────────────────────────────
// Each rule combines multiple metrics for deeper, multi-dimensional insights.
// Tags enable contradiction detection and causal chaining in the narrative layer.

// ── PREFLOP / HAND SELECTION ──

defineRule({
  id: 'limp-too-much',
  panels: ['mygame', 'actions', 'leaks'],
  minSample: { n: 30 },
  test: function(d) {
    var rate = pct(d.limpHands, d.n);
    if (rate === null || rate <= 15) return null;
    return { rate: rate };
  },
  sev: function(ctx) { return ctx.rate > 25 ? 'r' : 'a'; },
  score: function(ctx) { return ctx.rate - 15 + 10; },
  label: 'Limping too much',
  text: function(ctx) {
    return 'You limp ' + ctx.rate + '% of hands. Limping gives up initiative and lets opponents see cheap flops with position.';
  },
  chips: function(ctx) { return [{ v: 'Limp: ' + ctx.rate + '%', hi: true }]; },
  tags: ['limp', 'preflop', 'initiative', 'leak'],
  costBB: function(ctx) { return Math.round(ctx.rate * 1.5); },
  examples: function(ctx, hands) {
    return findExampleHand(function(h) {
      var ma = getHeroActions(h);
      var limped = ma.some(function(a) { return a.street === 'Preflop' && a.type === 'call'; });
      var raised = ma.some(function(a) { return a.street === 'Preflop' && (a.type === 'raise' || a.type === 'bet'); });
      return limped && !raised;
    });
  },
  coaching: 'You limped here instead of raising or folding. Either commit with a raise or save the chips.'
});

defineRule({
  id: 'passive-preflop',
  panels: ['mygame', 'actions'],
  minSample: { n: 30 },
  test: function(d) {
    var pfr = pct(d.pfrHands, d.n);
    if (pfr === null || pfr >= 10) return null;
    return { pfr: pfr };
  },
  sev: function() { return 'r'; },
  score: function(ctx) { return 10 - ctx.pfr + 5; },
  label: 'Passive opener',
  text: function(ctx) {
    return 'PFR of only ' + ctx.pfr + '%. You play hands but rarely raise, entering pots without initiative.';
  },
  chips: function(ctx) { return [{ v: 'PFR: ' + ctx.pfr + '%', hi: true }]; },
  tags: ['pfr', 'preflop', 'passive', 'initiative', 'leak']
});

defineRule({
  id: 'opens-with-raises',
  panels: ['mygame'],
  minSample: { n: 30 },
  test: function(d) {
    var pfr = pct(d.pfrHands, d.n);
    if (pfr === null || pfr <= 15) return null;
    return { pfr: pfr };
  },
  sev: function() { return 'g'; },
  score: function(ctx) { return ctx.pfr - 15; },
  label: 'Opens with raises',
  text: function(ctx) {
    return 'PFR of ' + ctx.pfr + '%. You raise when you play, putting opponents on the defensive.';
  },
  chips: function(ctx) { return [{ v: 'PFR: ' + ctx.pfr + '%' }]; },
  tags: ['pfr', 'preflop', 'initiative', 'strength']
});

defineRule({
  id: 'rarely-limps',
  panels: ['mygame'],
  minSample: { n: 30 },
  test: function(d) {
    var limp = pct(d.limpHands, d.n);
    if (limp === null || limp >= 10) return null;
    return { limp: limp };
  },
  sev: function() { return 'g'; },
  score: function(ctx) { return 10 - ctx.limp; },
  label: 'Rarely limps',
  text: function(ctx) {
    return 'Only ' + ctx.limp + '% limp rate. You enter pots with initiative.';
  },
  chips: function(ctx) { return [{ v: 'Limp: ' + ctx.limp + '%' }]; },
  tags: ['limp', 'preflop', 'strength']
});

// ── AGGRESSION ──

defineRule({
  id: 'too-passive',
  panels: ['mygame', 'actions', 'leaks'],
  minSample: { n: 30 },
  test: function(d) {
    var agg = calcAggression(d.raises, d.calls, d.checks);
    if (agg === null || agg >= 15) return null;
    return { agg: agg };
  },
  sev: function() { return 'r'; },
  score: function(ctx) { return 15 - ctx.agg + 12; },
  label: 'Too passive',
  text: function(ctx) {
    return 'Only ' + ctx.agg + '% aggression. You check and call when you should be betting for value.';
  },
  chips: function(ctx) { return [{ v: 'Agg: ' + ctx.agg + '%', hi: true }]; },
  tags: ['aggression', 'passive', 'leak'],
  costBB: function(ctx) { return Math.round((15 - ctx.agg) * 3); }
});

defineRule({
  id: 'balanced-aggression',
  panels: ['mygame', 'actions'],
  minSample: { n: 30 },
  test: function(d) {
    var agg = calcAggression(d.raises, d.calls, d.checks);
    if (agg === null || agg < 15 || agg > 40) return null;
    return { agg: agg };
  },
  sev: function() { return 'g'; },
  score: function(ctx) { return 40 - Math.abs(27.5 - ctx.agg); },
  label: 'Balanced aggression',
  text: function(ctx) {
    return ctx.agg + '% aggression is solid. You bet for value without overbluffing.';
  },
  chips: function(ctx) { return [{ v: 'Agg: ' + ctx.agg + '%' }]; },
  tags: ['aggression', 'strength']
});

defineRule({
  id: 'over-aggressive',
  panels: ['mygame', 'actions'],
  minSample: { n: 30 },
  test: function(d) {
    var agg = calcAggression(d.raises, d.calls, d.checks);
    if (agg === null || agg <= 50) return null;
    return { agg: agg };
  },
  sev: function() { return 'a'; },
  score: function(ctx) { return ctx.agg - 50; },
  label: 'Over-aggressive',
  text: function(ctx) {
    return 'Aggression at ' + ctx.agg + '%. In TC where players call wide, excessive raising gets called down.';
  },
  chips: function(ctx) { return [{ v: 'Agg: ' + ctx.agg + '%', hi: true }]; },
  tags: ['aggression', 'leak']
});

// ── FOLD PRESSURE ──

defineRule({
  id: 'folding-to-pressure',
  panels: ['mygame', 'actions', 'leaks'],
  minSample: { facedRaise: 5 },
  test: function(d) {
    var ftr = pct(d.foldedToRaise, d.facedRaise);
    if (ftr === null || ftr <= 60) return null;
    return { ftr: ftr };
  },
  sev: function(ctx) { return ctx.ftr > 70 ? 'r' : 'a'; },
  score: function(ctx) { return ctx.ftr - 60 + 8; },
  label: 'Folding to pressure',
  text: function(ctx) {
    return 'You fold ' + ctx.ftr + '% when raised. Opponents can push you off hands cheaply.';
  },
  chips: function(ctx) { return [{ v: 'FTR: ' + ctx.ftr + '%', hi: true }]; },
  tags: ['fold-pressure', 'postflop', 'leak'],
  costBB: function(ctx) { return Math.round(ctx.ftr * 0.4); }
});

// ── C-BET ──

defineRule({
  id: 'good-cbet',
  panels: ['mygame', 'actions'],
  minSample: { cbetOpps: 5 },
  test: function(d) {
    var cb = pct(d.cbetDone, d.cbetOpps);
    if (cb === null || cb < 50 || cb > 75) return null;
    return { cb: cb };
  },
  sev: function() { return 'g'; },
  score: function(ctx) { return 75 - Math.abs(62.5 - ctx.cb); },
  label: 'Good c-bet rate',
  text: function(ctx) {
    return 'You continuation bet ' + ctx.cb + '% of the time. Enough to maintain initiative without being auto-pilot.';
  },
  chips: function(ctx) { return [{ v: 'C-Bet: ' + ctx.cb + '%' }]; },
  tags: ['cbet', 'postflop', 'strength']
});

defineRule({
  id: 'low-cbet',
  panels: ['mygame', 'actions', 'leaks'],
  minSample: { cbetOpps: 5 },
  test: function(d) {
    var cb = pct(d.cbetDone, d.cbetOpps);
    if (cb === null || cb >= 40) return null;
    return { cb: cb };
  },
  sev: function(ctx) { return ctx.cb < 25 ? 'r' : 'a'; },
  score: function(ctx) { return 40 - ctx.cb + 5; },
  label: 'Low c-bet',
  text: function(ctx) {
    return 'You only c-bet ' + ctx.cb + '%. After raising preflop, follow through on the flop or opponents learn you give up easily.';
  },
  chips: function(ctx) { return [{ v: 'C-Bet: ' + ctx.cb + '%', hi: true }]; },
  tags: ['cbet', 'postflop', 'initiative', 'leak'],
  costBB: function(ctx) { return Math.round((40 - ctx.cb) * 0.5); }
});

// ── FOLD TO C-BET ──

defineRule({
  id: 'overfolds-to-cbets',
  panels: ['mygame', 'actions', 'leaks'],
  minSample: { foldToCbetOpps: 5 },
  test: function(d) {
    var fcb = pct(d.foldToCbetDone, d.foldToCbetOpps);
    if (fcb === null || fcb <= 65) return null;
    return { fcb: fcb };
  },
  sev: function(ctx) { return ctx.fcb > 75 ? 'r' : 'a'; },
  score: function(ctx) { return ctx.fcb - 65 + 5; },
  label: 'Overfolds to c-bets',
  text: function(ctx) {
    return 'You fold to c-bets ' + ctx.fcb + '% of the time. Opponents can bluff you off the flop profitably.';
  },
  chips: function(ctx) { return [{ v: 'FCB: ' + ctx.fcb + '%', hi: true }]; },
  tags: ['cbet-fold', 'postflop', 'fold-pressure', 'leak'],
  costBB: function(ctx) { return Math.round(ctx.fcb * 0.3); }
});

// ── 3-BET ──

defineRule({
  id: 'handles-3bets',
  panels: ['mygame'],
  minSample: { foldTo3betOpps: 5 },
  test: function(d) {
    var f3b = pct(d.foldTo3betDone, d.foldTo3betOpps);
    if (f3b === null || f3b >= 55) return null;
    return { f3b: f3b };
  },
  sev: function() { return 'g'; },
  score: function(ctx) { return 55 - ctx.f3b; },
  label: 'Handles 3-bets',
  text: function(ctx) {
    return 'You fold to 3-bets ' + ctx.f3b + '% of the time. Not giving up opens too cheaply.';
  },
  chips: function(ctx) { return [{ v: 'F3B: ' + ctx.f3b + '%' }]; },
  tags: ['3bet', 'preflop', 'strength']
});

// ── SHOWDOWN ──

defineRule({
  id: 'selective-showdowns',
  panels: ['mygame', 'showdown'],
  minSample: { sawFlop: 10 },
  test: function(d) {
    var wtsd = pct(d.wentToShowdown, d.sawFlop);
    if (wtsd === null || wtsd < 25 || wtsd > 35) return null;
    return { wtsd: wtsd };
  },
  sev: function() { return 'g'; },
  score: function(ctx) { return 35 - Math.abs(30 - ctx.wtsd); },
  label: 'Selective showdowns',
  text: function(ctx) {
    return 'You reach showdown ' + ctx.wtsd + '% after seeing a flop. Picking spots well.';
  },
  chips: function(ctx) { return [{ v: 'WTSD: ' + ctx.wtsd + '%' }]; },
  tags: ['showdown', 'strength']
});

defineRule({
  id: 'paying-off-too-much',
  panels: ['mygame', 'showdown', 'leaks'],
  minSample: { sawFlop: 10 },
  test: function(d) {
    var wtsd = pct(d.wentToShowdown, d.sawFlop);
    if (wtsd === null || wtsd <= 40) return null;
    return { wtsd: wtsd };
  },
  sev: function(ctx) { return ctx.wtsd > 50 ? 'r' : 'a'; },
  score: function(ctx) { return ctx.wtsd - 40 + 5; },
  label: 'Paying off too much',
  text: function(ctx) {
    return 'You go to showdown ' + ctx.wtsd + '% of the time. Folding more on later streets saves money against strong hands.';
  },
  chips: function(ctx) { return [{ v: 'WTSD: ' + ctx.wtsd + '%', hi: true }]; },
  tags: ['showdown', 'leak']
});

// ── POSITION ──

defineRule({
  id: 'tight-early',
  panels: ['mygame', 'position'],
  minSample: { n: 30 },
  test: function(d) {
    var g = calcPositionGroupVpip(d.posMap, ['UTG', 'UTG+1', 'MP']);
    if (g.hands < 10 || g.vpip === null || g.vpip >= 30) return null;
    return { vpip: g.vpip };
  },
  sev: function() { return 'g'; },
  score: function(ctx) { return 30 - ctx.vpip; },
  label: 'Tight early',
  text: function(ctx) {
    return 'Only ' + ctx.vpip + '% VPIP from early position. Good discipline where you act first.';
  },
  chips: function(ctx) { return [{ v: 'EP VPIP: ' + ctx.vpip + '%' }]; },
  tags: ['tight-ep', 'position', 'preflop', 'strength']
});

defineRule({
  id: 'too-loose-early',
  panels: ['mygame', 'position'],
  minSample: { n: 30 },
  test: function(d) {
    var g = calcPositionGroupVpip(d.posMap, ['UTG', 'UTG+1', 'MP']);
    if (g.hands < 10 || g.vpip === null || g.vpip <= 45) return null;
    return { vpip: g.vpip };
  },
  sev: function(ctx) { return ctx.vpip > 55 ? 'r' : 'a'; },
  score: function(ctx) { return ctx.vpip - 45 + 5; },
  label: 'Too loose early',
  text: function(ctx) {
    return 'Playing ' + ctx.vpip + '% from early position. These seats act first on every street; tighten up.';
  },
  chips: function(ctx) { return [{ v: 'EP VPIP: ' + ctx.vpip + '%', hi: true }]; },
  tags: ['loose-ep', 'loose', 'position', 'preflop', 'leak']
});

defineRule({
  id: 'active-late',
  panels: ['mygame', 'position'],
  minSample: { n: 30 },
  test: function(d) {
    var g = calcPositionGroupVpip(d.posMap, ['CO', 'BTN']);
    if (g.hands < 10 || g.vpip === null || g.vpip <= 40) return null;
    return { vpip: g.vpip };
  },
  sev: function() { return 'g'; },
  score: function(ctx) { return ctx.vpip - 40; },
  label: 'Active late',
  text: function(ctx) {
    return 'Playing ' + ctx.vpip + '% from CO/BTN. Using positional advantage.';
  },
  chips: function(ctx) { return [{ v: 'LP VPIP: ' + ctx.vpip + '%' }]; },
  tags: ['position', 'preflop', 'strength']
});

// ── BEST POSITION ──

defineRule({
  id: 'best-seat',
  panels: ['mygame', 'position'],
  minSample: { n: 30 },
  test: function(d) {
    var bestPos = null, bestPnl = -Infinity, bestWr = null;
    var keys = Object.keys(d.posMap);
    for (var i = 0; i < keys.length; i++) {
      var pm = d.posMap[keys[i]];
      if (pm.hands >= 15 && pm.pnl > bestPnl) {
        bestPnl = pm.pnl;
        bestPos = keys[i];
        bestWr = pct(pm.won, pm.hands);
      }
    }
    if (!bestPos || bestPnl <= 0) return null;
    return { pos: bestPos, pnl: bestPnl, wr: bestWr };
  },
  sev: function() { return 'g'; },
  score: function(ctx) { return Math.min(ctx.pnl / 100, 30); },
  label: function(ctx) { return 'Best seat: ' + ctx.pos; },
  text: function(ctx) {
    return 'Your ' + ctx.pos + ' play is profitable at ' + fmtPnl(ctx.pnl) + '. You win ' + (ctx.wr !== null ? ctx.wr : '?') + '% from this seat.';
  },
  chips: function(ctx) { return [{ v: ctx.pos + ': ' + fmtPnl(ctx.pnl) }]; },
  tags: ['position', 'strength']
});

// ═══════════════════════════════════════════════════════════════════════════════
// ── MULTI-FACTOR RULES (new cross-referencing insights) ──
// ═══════════════════════════════════════════════════════════════════════════════

defineRule({
  id: 'cbet-then-fold',
  panels: ['mygame', 'actions', 'leaks'],
  minSample: { cbetOpps: 8, facedRaise: 5 },
  test: function(d) {
    var cb = pct(d.cbetDone, d.cbetOpps);
    var ftr = pct(d.foldedToRaise, d.facedRaise);
    if (cb === null || ftr === null) return null;
    if (cb < 50 || ftr < 60) return null;
    return { cb: cb, ftr: ftr };
  },
  sev: function(ctx) { return ctx.ftr > 70 ? 'r' : 'a'; },
  score: function(ctx) { return (ctx.cb - 50) * 0.3 + (ctx.ftr - 60) * 0.7 + 15; },
  label: 'C-bet then fold',
  text: function(ctx) {
    return 'You c-bet ' + ctx.cb + '% of flops but fold ' + ctx.ftr + '% when raised. Opponents can raise your c-bets profitably \u2014 you fire once then give up.';
  },
  chips: function(ctx) {
    return [{ v: 'C-bet: ' + ctx.cb + '%' }, { v: 'FTR: ' + ctx.ftr + '%', hi: true }];
  },
  tags: ['cbet', 'cbet-fold', 'fold-pressure', 'postflop', 'leak'],
  costBB: function(ctx) { return Math.round(ctx.ftr * 0.4); }
});

defineRule({
  id: 'aggression-under-pressure',
  panels: ['mygame', 'actions'],
  minSample: { n: 30, foldTo3betOpps: 3 },
  test: function(d) {
    var agg = calcAggression(d.raises, d.calls, d.checks);
    var f3b = pct(d.foldTo3betDone, d.foldTo3betOpps);
    if (agg === null || f3b === null) return null;
    if (agg < 20 || f3b < 65) return null;
    return { agg: agg, f3b: f3b };
  },
  sev: function(ctx) { return ctx.f3b > 75 ? 'r' : 'a'; },
  score: function(ctx) { return (ctx.f3b - 65) + (ctx.agg - 20) * 0.3 + 12; },
  label: 'Aggression evaporates under pressure',
  text: function(ctx) {
    return 'You have ' + ctx.agg + '% aggression overall, but fold to 3-bets ' + ctx.f3b + '% of the time. You bet and raise proactively, but collapse when opponents fight back.';
  },
  chips: function(ctx) {
    return [{ v: 'Agg: ' + ctx.agg + '%' }, { v: 'F3B fold: ' + ctx.f3b + '%', hi: true }];
  },
  tags: ['aggression', 'fold-pressure', '3bet', 'leak']
});

defineRule({
  id: 'loose-ep-then-fold-flop',
  panels: ['mygame', 'position', 'street', 'leaks'],
  minSample: { n: 40 },
  test: function(d) {
    var ep = calcPositionGroupVpip(d.posMap, ['UTG', 'UTG+1', 'MP']);
    if (ep.hands < 10 || ep.vpip === null || ep.vpip < 35) return null;
    var flopFoldPct = d.ss.Flop.seen > 0 ? pct(d.ss.Flop.f, d.ss.Flop.seen) : null;
    if (flopFoldPct === null || flopFoldPct < 40) return null;
    return { epVpip: ep.vpip, flopFold: flopFoldPct };
  },
  sev: function() { return 'r'; },
  score: function(ctx) { return (ctx.epVpip - 35) + (ctx.flopFold - 40) + 10; },
  label: 'Open wide, fold flop',
  text: function(ctx) {
    return 'EP VPIP is ' + ctx.epVpip + '% but you fold ' + ctx.flopFold + '% of flops. You enter with marginal hands then give up when you miss \u2014 bleeding chips on both ends.';
  },
  chips: function(ctx) {
    return [{ v: 'EP VPIP: ' + ctx.epVpip + '%', hi: true }, { v: 'Flop fold: ' + ctx.flopFold + '%', hi: true }];
  },
  tags: ['loose-ep', 'flop-fold', 'position', 'preflop', 'postflop', 'leak'],
  costBB: function(ctx) { return Math.round((ctx.epVpip - 25) * 2); }
});

defineRule({
  id: 'winning-small-losing-big',
  panels: ['mygame', 'showdown', 'bets', 'leaks'],
  minSample: { handsWithOutcome: 20 },
  test: function(d, hands) {
    var winPots = [], lossPots = [];
    for (var i = 0; i < hands.length; i++) {
      var h = hands[i];
      if (!h.outcome || !isCashHand(h)) continue;
      var pnlVal = getHandPnlValue(h);
      if (h.outcome.result === 'won' && pnlVal > 0) winPots.push(pnlVal);
      else if (pnlVal < 0) lossPots.push(Math.abs(pnlVal));
    }
    if (winPots.length < 5 || lossPots.length < 5) return null;
    var avgWin = avg(winPots);
    var avgLoss = avg(lossPots);
    if (avgLoss <= avgWin * 1.5) return null;
    var ratio = (avgLoss / avgWin).toFixed(1);
    return { avgWin: Math.round(avgWin), avgLoss: Math.round(avgLoss), ratio: ratio };
  },
  sev: function(ctx) { return parseFloat(ctx.ratio) > 2.5 ? 'r' : 'a'; },
  score: function(ctx) { return parseFloat(ctx.ratio) * 5; },
  label: 'Winning small, losing big',
  text: function(ctx) {
    return 'Average winning pot: ' + fmt(ctx.avgWin) + '. Average losing pot: ' + fmt(ctx.avgLoss) + ' (' + ctx.ratio + 'x bigger). You give back gains in a few big hands. Focus on folding earlier or sizing up value bets.';
  },
  chips: function(ctx) {
    return [{ v: 'Avg win: ' + fmt(ctx.avgWin) }, { v: 'Avg loss: ' + fmt(ctx.avgLoss), hi: true }];
  },
  tags: ['showdown', 'sizing', 'leak']
});

defineRule({
  id: 'winning-bigger-than-losing',
  panels: ['mygame', 'showdown', 'bets'],
  minSample: { handsWithOutcome: 20 },
  test: function(d, hands) {
    var winPots = [], lossPots = [];
    for (var i = 0; i < hands.length; i++) {
      var h = hands[i];
      if (!h.outcome || !isCashHand(h)) continue;
      var pnlVal = getHandPnlValue(h);
      if (h.outcome.result === 'won' && pnlVal > 0) winPots.push(pnlVal);
      else if (pnlVal < 0) lossPots.push(Math.abs(pnlVal));
    }
    if (winPots.length < 5 || lossPots.length < 5) return null;
    var avgWin = avg(winPots);
    var avgLoss = avg(lossPots);
    if (avgWin < avgLoss * 1.3) return null;
    var ratio = (avgWin / avgLoss).toFixed(1);
    return { avgWin: Math.round(avgWin), avgLoss: Math.round(avgLoss), ratio: ratio };
  },
  sev: function() { return 'g'; },
  score: function(ctx) { return parseFloat(ctx.ratio) * 3; },
  label: 'Win big, lose small',
  text: function(ctx) {
    return 'Average winning pot: ' + fmt(ctx.avgWin) + ' vs average loss: ' + fmt(ctx.avgLoss) + ' (' + ctx.ratio + 'x ratio). You extract more when ahead and cut losses when behind \u2014 solid strategy.';
  },
  chips: function(ctx) {
    return [{ v: 'Avg win: ' + fmt(ctx.avgWin), hi: true }, { v: 'Avg loss: ' + fmt(ctx.avgLoss) }];
  },
  tags: ['showdown', 'sizing', 'strength']
});

defineRule({
  id: 'aggression-pays-off',
  panels: ['actions'],
  minSample: { n: 40 },
  test: function(d, hands) {
    var aggWon = 0, aggTotal = 0, passWon = 0, passTotal = 0;
    for (var i = 0; i < hands.length; i++) {
      var h = hands[i];
      var ma = getHeroActions(h);
      var didRaise = ma.some(function(a) { return a.type === 'raise' || a.type === 'bet'; });
      var didAct = ma.length > 0;
      if (!didAct) continue;
      var won = h.outcome && h.outcome.result === 'won';
      if (didRaise) { aggTotal++; if (won) aggWon++; }
      else { passTotal++; if (won) passWon++; }
    }
    if (aggTotal < 10 || passTotal < 10) return null;
    var aggWr = pct(aggWon, aggTotal);
    var passWr = pct(passWon, passTotal);
    if (aggWr === null || passWr === null) return null;
    var diff = aggWr - passWr;
    if (Math.abs(diff) < 10) return null;
    return { aggWr: aggWr, passWr: passWr, diff: diff, aggN: aggTotal, passN: passTotal };
  },
  sev: function(ctx) { return ctx.diff > 0 ? 'g' : 'a'; },
  score: function(ctx) { return Math.abs(ctx.diff) * 0.5; },
  label: function(ctx) { return ctx.diff > 0 ? 'Aggression pays off' : 'Passive play outperforms'; },
  text: function(ctx) {
    if (ctx.diff > 0) {
      return 'Hands where you raise win ' + ctx.aggWr + '% (' + ctx.aggN + ' hands) vs ' + ctx.passWr + '% when passive (' + ctx.passN + ' hands). Your bets and raises are working.';
    }
    return 'Passive hands win ' + ctx.passWr + '% vs ' + ctx.aggWr + '% when aggressive. Opponents may be calling your bluffs \u2014 tighten your raising range.';
  },
  chips: function(ctx) {
    return [
      { v: 'Raise WR: ' + ctx.aggWr + '%', hi: ctx.diff > 0 },
      { v: 'Passive WR: ' + ctx.passWr + '%', hi: ctx.diff < 0 }
    ];
  },
  tags: ['aggression', 'actions']
});

defineRule({
  id: 'double-barrel-effect',
  panels: ['actions', 'street'],
  minSample: { n: 50 },
  test: function(d, hands) {
    var betBet = { w: 0, t: 0 }, betCheck = { w: 0, t: 0 };
    for (var i = 0; i < hands.length; i++) {
      var h = hands[i];
      var ma = getHeroActions(h);
      var flopBet = ma.some(function(a) { return a.street === 'Flop' && (a.type === 'raise' || a.type === 'bet'); });
      if (!flopBet) continue;
      var turnBet = ma.some(function(a) { return a.street === 'Turn' && (a.type === 'raise' || a.type === 'bet'); });
      var turnCheck = ma.some(function(a) { return a.street === 'Turn' && (a.type === 'check' || a.type === 'call'); });
      var won = h.outcome && h.outcome.result === 'won';
      if (turnBet) { betBet.t++; if (won) betBet.w++; }
      else if (turnCheck) { betCheck.t++; if (won) betCheck.w++; }
    }
    if (betBet.t < 5 || betCheck.t < 5) return null;
    var bbWr = pct(betBet.w, betBet.t);
    var bcWr = pct(betCheck.w, betCheck.t);
    if (bbWr === null || bcWr === null) return null;
    var diff = bbWr - bcWr;
    if (diff < 12) return null;
    return { bbWr: bbWr, bcWr: bcWr, bbN: betBet.t, bcN: betCheck.t, diff: diff };
  },
  sev: function() { return 'g'; },
  score: function(ctx) { return ctx.diff * 0.5 + 5; },
  label: 'Double barrels work',
  text: function(ctx) {
    return 'When you bet flop then bet turn, you win ' + ctx.bbWr + '% (' + ctx.bbN + ' hands). Bet flop then check turn: only ' + ctx.bcWr + '% (' + ctx.bcN + ' hands). Following through is key.';
  },
  chips: function(ctx) {
    return [{ v: 'Bet-Bet: ' + ctx.bbWr + '%', hi: true }, { v: 'Bet-Check: ' + ctx.bcWr + '%' }];
  },
  tags: ['street', 'aggression', 'postflop']
});

defineRule({
  id: 'street-funnel',
  panels: ['street'],
  minSample: { n: 30 },
  test: function(d) {
    var pfSeen = d.ss.Preflop.seen;
    if (pfSeen < 20) return null;
    var flopPct = pct(d.ss.Flop.seen, pfSeen);
    var turnPct = d.ss.Flop.seen > 0 ? pct(d.ss.Turn.seen, d.ss.Flop.seen) : null;
    var riverPct = d.ss.Turn.seen > 0 ? pct(d.ss.River.seen, d.ss.Turn.seen) : null;
    if (flopPct === null) return null;
    // Find the biggest drop-off
    var flopDrop = 100 - flopPct;
    var turnDrop = turnPct !== null ? 100 - turnPct : null;
    return { flopPct: flopPct, turnPct: turnPct, riverPct: riverPct, flopDrop: flopDrop, turnDrop: turnDrop, pfSeen: pfSeen, flopSeen: d.ss.Flop.seen, turnSeen: d.ss.Turn.seen, riverSeen: d.ss.River.seen };
  },
  sev: function() { return 'n'; },
  score: function(ctx) { return 3; },
  label: 'Street funnel',
  text: function(ctx) {
    return 'Of ' + ctx.pfSeen + ' preflop hands, ' + ctx.flopSeen + ' see the flop (' + ctx.flopPct + '%), ' + ctx.turnSeen + ' see the turn' + (ctx.turnPct !== null ? ' (' + ctx.turnPct + '% of flops)' : '') + ', and ' + ctx.riverSeen + ' see the river' + (ctx.riverPct !== null ? ' (' + ctx.riverPct + '% of turns)' : '') + '.';
  },
  chips: function(ctx) {
    var c = [{ v: 'Flop: ' + ctx.flopSeen }];
    if (ctx.turnSeen > 0) c.push({ v: 'Turn: ' + ctx.turnSeen });
    if (ctx.riverSeen > 0) c.push({ v: 'River: ' + ctx.riverSeen });
    return c;
  },
  tags: ['street', 'funnel']
});

defineRule({
  id: 'flop-fold-high',
  panels: ['street', 'mygame'],
  minSample: { n: 30 },
  test: function(d) {
    if (d.ss.Flop.seen < 10) return null;
    var ff = pct(d.ss.Flop.f, d.ss.Flop.seen);
    if (ff === null || ff < 45) return null;
    return { ff: ff };
  },
  sev: function(ctx) { return ctx.ff > 55 ? 'r' : 'a'; },
  score: function(ctx) { return ctx.ff - 45 + 5; },
  label: 'Flop folding',
  text: function(ctx) {
    return 'You fold ' + ctx.ff + '% on the flop. If you\'re calling pre and folding the flop often, your preflop range is too wide.';
  },
  chips: function(ctx) { return [{ v: 'Flop fold: ' + ctx.ff + '%', hi: true }]; },
  tags: ['flop-fold', 'street', 'leak']
});

defineRule({
  id: 'turn-fold-high',
  panels: ['street'],
  minSample: { n: 30 },
  test: function(d) {
    if (d.ss.Turn.seen < 8) return null;
    var tf = pct(d.ss.Turn.f, d.ss.Turn.seen);
    if (tf === null || tf < 50) return null;
    return { tf: tf };
  },
  sev: function(ctx) { return ctx.tf > 60 ? 'r' : 'a'; },
  score: function(ctx) { return ctx.tf - 50 + 3; },
  label: 'Turn folding',
  text: function(ctx) {
    return 'Folding ' + ctx.tf + '% on the turn. If you have a made hand, bet and protect it \u2014 don\'t check-fold to draws.';
  },
  chips: function(ctx) { return [{ v: 'Turn fold: ' + ctx.tf + '%', hi: true }]; },
  tags: ['street', 'leak']
});

// ═══════════════════════════════════════════════════════════════════════════════
// ── BETS / SIZING RULES ──
// ═══════════════════════════════════════════════════════════════════════════════

defineRule({
  id: 'turn-sizing-drops',
  panels: ['bets', 'actions'],
  minSample: { n: 30 },
  test: function(d) {
    var flopAmts = d.betAmts.Flop;
    var turnAmts = d.betAmts.Turn;
    if (!flopAmts || !turnAmts || flopAmts.length < 3 || turnAmts.length < 3) return null;
    var avgFlop = avg(flopAmts);
    var avgTurn = avg(turnAmts);
    if (avgFlop <= 0 || avgTurn >= avgFlop) return null;
    var drop = Math.round((1 - avgTurn / avgFlop) * 100);
    if (drop < 15) return null;
    return { avgFlop: Math.round(avgFlop), avgTurn: Math.round(avgTurn), drop: drop };
  },
  sev: function(ctx) { return ctx.drop > 30 ? 'r' : 'a'; },
  score: function(ctx) { return ctx.drop * 0.5; },
  label: 'Turn sizing drops',
  text: function(ctx) {
    return 'Average turn bet (' + fmt(ctx.avgTurn) + ') is ' + ctx.drop + '% smaller than flop (' + fmt(ctx.avgFlop) + '). Size up as the pot grows to charge draws.';
  },
  chips: function(ctx) {
    return [{ v: 'Flop: ' + fmt(ctx.avgFlop) }, { v: 'Turn: ' + fmt(ctx.avgTurn), hi: true }];
  },
  tags: ['bets', 'sizing', 'leak'],
  costBB: function(ctx) { return Math.round(ctx.drop * 0.3); }
});

defineRule({
  id: 'river-value-missed',
  panels: ['bets', 'leaks'],
  minSample: { n: 40 },
  test: function(d) {
    var rbo = d.betOpps.River;
    if (!rbo || rbo.t < 5) return null;
    var riverBetPct = pct(rbo.b, rbo.t);
    if (riverBetPct === null || riverBetPct >= 30) return null;
    return { pct: riverBetPct, bets: rbo.b, opps: rbo.t };
  },
  sev: function(ctx) { return ctx.pct < 15 ? 'r' : 'a'; },
  score: function(ctx) { return 30 - ctx.pct + 5; },
  label: 'Missing river value',
  text: function(ctx) {
    return 'You only bet the river ' + ctx.pct + '% of the time (' + ctx.bets + '/' + ctx.opps + ' spots). The river is where you get paid with strong hands \u2014 bet more for value.';
  },
  chips: function(ctx) { return [{ v: 'River bet: ' + ctx.pct + '%', hi: true }]; },
  tags: ['bets', 'sizing', 'river', 'leak'],
  costBB: function(ctx) { return Math.round((30 - ctx.pct) * 0.5); }
});

defineRule({
  id: 'flop-bet-frequency-low',
  panels: ['bets', 'actions', 'leaks'],
  minSample: { n: 30 },
  test: function(d) {
    var fbo = d.betOpps.Flop;
    if (!fbo || fbo.t < 5) return null;
    var fp = pct(fbo.b, fbo.t);
    if (fp === null || fp >= 30) return null;
    return { pct: fp, bets: fbo.b, opps: fbo.t };
  },
  sev: function(ctx) { return ctx.pct < 15 ? 'r' : 'a'; },
  score: function(ctx) { return 30 - ctx.pct + 5; },
  label: 'Flop passivity',
  text: function(ctx) {
    return 'You only bet the flop ' + ctx.pct + '% of the time when you have the option (' + ctx.bets + '/' + ctx.opps + '). Checking strong hands gives free cards to draws.';
  },
  chips: function(ctx) { return [{ v: 'Flop bet: ' + ctx.pct + '%', hi: true }]; },
  tags: ['bets', 'flop', 'passive', 'leak'],
  costBB: function(ctx) { return Math.round((30 - ctx.pct) * 0.4); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ── CARDS / HAND TYPE RULES ──
// ═══════════════════════════════════════════════════════════════════════════════

defineRule({
  id: 'pairs-underperforming',
  panels: ['cards'],
  minSample: { n: 20 },
  test: function(d) {
    var ps = d.htMap['Pocket Pairs'];
    if (!ps || ps.played < 3) return null;
    var wr = pct(ps.won, ps.played);
    if (wr === null || wr >= 45) return null;
    return { wr: wr, played: ps.played, dealt: ps.dealt };
  },
  sev: function(ctx) { return ctx.wr < 30 ? 'r' : 'a'; },
  score: function(ctx) { return 45 - ctx.wr + 5; },
  label: 'Pocket pairs struggling',
  text: function(ctx) {
    return 'Only ' + ctx.wr + '% win rate with pocket pairs (' + ctx.played + ' played of ' + ctx.dealt + ' dealt). Bet aggressively preflop and charge draws \u2014 don\'t slow play.';
  },
  chips: function(ctx) { return [{ v: ctx.wr + '% win rate', hi: true }, { v: ctx.played + ' played' }]; },
  tags: ['cards', 'pairs', 'leak']
});

defineRule({
  id: 'trash-hands-played',
  panels: ['cards', 'leaks'],
  minSample: { n: 20 },
  test: function(d) {
    var ts = d.htMap['Offsuit Trash'];
    if (!ts || ts.dealt < 3 || ts.played < 1) return null;
    var playRate = pct(ts.played, ts.dealt);
    if (playRate === null || playRate < 20) return null;
    return { playRate: playRate, played: ts.played, dealt: ts.dealt };
  },
  sev: function(ctx) { return ctx.playRate > 40 ? 'r' : 'a'; },
  score: function(ctx) { return ctx.playRate - 20 + 8; },
  label: 'Playing trash hands',
  text: function(ctx) {
    return 'You play ' + ctx.playRate + '% of offsuit trash hands (' + ctx.played + ' of ' + ctx.dealt + ' dealt). These are almost always folds preflop \u2014 they cost chips over time.';
  },
  chips: function(ctx) { return [{ v: ctx.playRate + '% play rate', hi: true }]; },
  tags: ['cards', 'preflop', 'leak'],
  costBB: function(ctx) { return Math.round(ctx.played * 1.5); }
});

defineRule({
  id: 'broadway-strong',
  panels: ['cards'],
  minSample: { n: 20 },
  test: function(d) {
    var bw = d.htMap['Broadway'];
    if (!bw || bw.played < 3) return null;
    var wr = pct(bw.won, bw.played);
    if (wr === null || wr < 55) return null;
    return { wr: wr, played: bw.played };
  },
  sev: function() { return 'g'; },
  score: function(ctx) { return ctx.wr - 55 + 3; },
  label: 'Broadway hands performing',
  text: function(ctx) {
    return ctx.wr + '% win rate with broadway hands across ' + ctx.played + ' played. Premium hands are your bread and butter.';
  },
  chips: function(ctx) { return [{ v: ctx.wr + '% win rate', hi: true }]; },
  tags: ['cards', 'strength']
});

defineRule({
  id: 'suited-connectors-profit',
  panels: ['cards'],
  minSample: { n: 20 },
  test: function(d) {
    var sc = d.htMap['Suited Connectors'];
    if (!sc || sc.played < 3) return null;
    var wr = pct(sc.won, sc.played);
    if (wr === null || wr < 50) return null;
    return { wr: wr, played: sc.played };
  },
  sev: function() { return 'g'; },
  score: function(ctx) { return ctx.wr - 50 + 2; },
  label: 'Suited connectors paying off',
  text: function(ctx) {
    return ctx.wr + '% win rate with suited connectors (' + ctx.played + ' played). These drawing hands hit big when they connect.';
  },
  chips: function(ctx) { return [{ v: ctx.wr + '% win rate' }]; },
  tags: ['cards', 'strength']
});

// ═══════════════════════════════════════════════════════════════════════════════
// ── TRENDS RULES ──
// ═══════════════════════════════════════════════════════════════════════════════

defineRule({
  id: 'session-tilt-detected',
  panels: ['trends', 'mygame', 'leaks'],
  minSample: { n: 40 },
  test: function(d, hands) {
    if (hands.length < 20) return null;
    var sorted = hands.slice().sort(function(a, b) { return (a.timestamp || 0) - (b.timestamp || 0); });
    var afterLossWins = 0, afterLossTotal = 0;
    var normalWins = 0, normalTotal = 0;
    for (var i = 1; i < sorted.length; i++) {
      var prev = sorted[i - 1];
      var prevPnl = getHandPnlValue(prev);
      var bb = getHandBB(prev);
      var cur = sorted[i];
      var won = cur.outcome && cur.outcome.result === 'won';
      if (bb && bb > 0 && prevPnl < -bb * 10) {
        afterLossTotal++;
        if (won) afterLossWins++;
      } else {
        normalTotal++;
        if (won) normalWins++;
      }
    }
    if (afterLossTotal < 5 || normalTotal < 10) return null;
    var afterWr = pct(afterLossWins, afterLossTotal);
    var normalWr = pct(normalWins, normalTotal);
    if (afterWr === null || normalWr === null) return null;
    var diff = normalWr - afterWr;
    if (diff < 12) return null;
    return { afterWr: afterWr, normalWr: normalWr, diff: diff, afterN: afterLossTotal };
  },
  sev: function(ctx) { return ctx.diff > 20 ? 'r' : 'a'; },
  score: function(ctx) { return ctx.diff * 0.8 + 10; },
  label: 'Tilt detected',
  text: function(ctx) {
    return 'After a big loss, your win rate drops to ' + ctx.afterWr + '% vs ' + ctx.normalWr + '% normally (' + ctx.diff + '-point gap across ' + ctx.afterN + ' hands). Take a break after big losses.';
  },
  chips: function(ctx) {
    return [{ v: 'After loss: ' + ctx.afterWr + '%', hi: true }, { v: 'Normal: ' + ctx.normalWr + '%' }];
  },
  tags: ['tilt', 'trends', 'leak'],
  costBB: function(ctx) { return Math.round(ctx.diff * ctx.afterN * 0.1); }
});

defineRule({
  id: 'second-half-decline',
  panels: ['trends'],
  minSample: { n: 40 },
  test: function(d, hands) {
    if (hands.length < 20) return null;
    var sorted = hands.slice().sort(function(a, b) { return (a.timestamp || 0) - (b.timestamp || 0); });
    var mid = Math.floor(sorted.length / 2);
    var firstHalf = sorted.slice(0, mid);
    var secondHalf = sorted.slice(mid);
    var d1 = analyse(firstHalf);
    var d2 = analyse(secondHalf);
    var wr1 = pct(d1.handsWon, d1.handsWithOutcome);
    var wr2 = pct(d2.handsWon, d2.handsWithOutcome);
    if (wr1 === null || wr2 === null) return null;
    var diff = wr1 - wr2;
    if (diff < 10) return null;
    return { wr1: wr1, wr2: wr2, diff: diff, n1: d1.n, n2: d2.n };
  },
  sev: function(ctx) { return ctx.diff > 15 ? 'r' : 'a'; },
  score: function(ctx) { return ctx.diff * 0.5 + 3; },
  label: 'Late-session decline',
  text: function(ctx) {
    return 'Win rate drops from ' + ctx.wr1 + '% in the first half to ' + ctx.wr2 + '% in the second half. Fatigue or tilt may be affecting your play \u2014 consider shorter sessions.';
  },
  chips: function(ctx) {
    return [{ v: 'First half: ' + ctx.wr1 + '%' }, { v: 'Second half: ' + ctx.wr2 + '%', hi: true }];
  },
  tags: ['trends', 'fatigue', 'leak']
});

// ═══════════════════════════════════════════════════════════════════════════════
// ── LEAKS-SPECIFIC RULES ──
// ═══════════════════════════════════════════════════════════════════════════════

defineRule({
  id: 'blind-defense-leak',
  panels: ['leaks', 'position'],
  minSample: { n: 30 },
  test: function(d) {
    var sb = d.posMap['SB'];
    var bb = d.posMap['BB'];
    if (!sb || !bb) return null;
    var blindHands = (sb.hands || 0) + (bb.hands || 0);
    if (blindHands < 15) return null;
    var blindLoss = (sb.pnl || 0) + (bb.pnl || 0);
    if (blindLoss >= 0) return null;
    var lossPerHand = Math.abs(blindLoss) / blindHands;
    var avgPot = d.n > 0 ? Math.round((d.totalWonAmount + d.totalInvested) / d.n) : 0;
    if (avgPot <= 0 || lossPerHand < avgPot * 0.15) return null;
    return { loss: Math.round(Math.abs(blindLoss)), hands: blindHands, perHand: Math.round(lossPerHand) };
  },
  sev: function() { return 'a'; },
  score: function(ctx) { return Math.min(ctx.loss / 50, 20); },
  label: 'Blind defense bleeding',
  text: function(ctx) {
    return 'You\'ve lost ' + fmt(ctx.loss) + ' from the blinds over ' + ctx.hands + ' hands (~' + fmt(ctx.perHand) + '/hand). Tighten blind defense or play more aggressively post-flop.';
  },
  chips: function(ctx) { return [{ v: fmt(ctx.loss) + ' lost', hi: true }, { v: ctx.hands + ' blind hands' }]; },
  tags: ['blinds', 'position', 'leak'],
  costBB: function(ctx) { return Math.round(ctx.loss / 10); }
});

defineRule({
  id: 'missed-river-value',
  panels: ['leaks', 'showdown'],
  minSample: { n: 30 },
  test: function(d, hands) {
    var sdWins = 0, riverCheckWins = 0;
    for (var i = 0; i < hands.length; i++) {
      var h = hands[i];
      if (!h.outcome || h.outcome.result !== 'won') continue;
      var acts = parseActions(h.actions);
      var wentToSD = (h.actions || []).some(function(a) { return (a || '').indexOf(' reveals ') !== -1; });
      if (!wentToSD) continue;
      sdWins++;
      var heroCheckedRiver = acts.some(function(a) { return a.isMe && a.street === 'River' && a.type === 'check'; });
      if (heroCheckedRiver) riverCheckWins++;
    }
    if (sdWins < 10) return null;
    var rate = pct(riverCheckWins, sdWins);
    if (rate === null || rate < 35) return null;
    return { rate: rate, count: riverCheckWins, total: sdWins };
  },
  sev: function(ctx) { return ctx.rate > 50 ? 'r' : 'a'; },
  score: function(ctx) { return ctx.rate - 35 + 8; },
  label: 'Missed value bets',
  text: function(ctx) {
    return 'You check the river and win at showdown ' + ctx.rate + '% of the time (' + ctx.count + '/' + ctx.total + '). A bet could have extracted more value from second-best hands.';
  },
  chips: function(ctx) { return [{ v: ctx.rate + '% check-win', hi: true }]; },
  tags: ['river', 'value', 'showdown', 'leak'],
  costBB: function(ctx) { return Math.round(ctx.count * 2); }
});
