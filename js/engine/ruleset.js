// ── INSIGHT ENGINE: RULE DEFINITIONS ────────────────────────────────────────
// Each rule combines multiple metrics for deeper, multi-dimensional insights.
// Tags enable contradiction detection and causal chaining in the narrative layer.

// ── PREFLOP / HAND SELECTION ──

defineRule({
  id: 'limp-too-much',
  panels: ['mygame', 'actions'],
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
  panels: ['mygame', 'actions'],
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
  panels: ['mygame', 'actions'],
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
  panels: ['mygame', 'actions'],
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
  panels: ['mygame', 'actions'],
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
  panels: ['mygame', 'showdown'],
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
  panels: ['mygame', 'actions'],
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
  panels: ['mygame', 'position', 'street'],
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
  panels: ['mygame', 'showdown'],
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
  panels: ['mygame', 'showdown'],
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
