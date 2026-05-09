// ── INSIGHT ENGINE: RULE DEFINITIONS ────────────────────────────────────────
// Each rule combines multiple metrics for deeper, multi-dimensional insights.
// Tags enable contradiction detection and causal chaining in the narrative layer.
//
// Every rule reads game context from `d`:
//   - d.mixCells: list of {position, seatBucket, seats, hands}
//   - d.byFlopBucket: { 'HU' | '3-way' | 'multiway': sub-d }
//   - d.bySeatBucket: { '2p'..'9p': sub-d }
// Thresholds are dynamic - they look up matrixTarget() for matrix-tracked
// metrics, scale by sample size for the rest, and factor flopBucket where
// postflop aggression is involved.

// Context helpers (dominantSeats, dominantPosition, dominantFlopBucket,
// scaleThresh, bandFor, flopMod) live in js/helpers/context.js so panels and
// rules share a single source of truth.

// ── PREFLOP / HAND SELECTION ──

defineRule({
  id: 'limp-too-much',
  panels: ['mygame', 'actions', 'leaks'],
  minSample: { n: 30 },
  test: function(d) {
    var rate = pct(d.limpHands, d.n);
    if (rate === null) return null;
    var seats = dominantSeats(d) || 6;
    // HU and 3-handed correctly limp far more often (limp/complete from SB,
    // limp from BTN with deeper stacks). Full-ring limps are nearly always a
    // leak.
    var base = seats <= 2 ? 50 : seats <= 3 ? 30 : seats <= 5 ? 18 : 12;
    if (rate <= base) return null;
    return { rate: rate, base: base, seats: seats };
  },
  sev: function(ctx) { return ctx.rate > ctx.base + 15 ? 'r' : 'a'; },
  score: function(ctx) { return ctx.rate - ctx.base + 10; },
  label: 'Limping Too Much',
  text: function(ctx) {
    var seatStr = ctx.seats <= 3 ? ctx.seats + '-handed' : ctx.seats + '-max';
    return 'You limp ' + ctx.rate + '% of hands at ' + seatStr + ' (target under ' + ctx.base + '%). Open-raising keeps initiative and can win the pot before the flop.';
  },
  chips: function(ctx) { return [{ v: 'Limp: ' + ctx.rate + '%', hi: true }]; },
  tags: ['limp', 'preflop', 'initiative', 'leak'],
  costBB: function(ctx) { return Math.round((ctx.rate - ctx.base) * 1.5); },
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
    if (pfr === null) return null;
    var band = bandFor('pfr', d);
    var floor = band ? band.tight - 4 : 10;
    if (pfr >= floor) return null;
    return { pfr: pfr, floor: floor, ideal: band ? band.ideal : 18, seats: dominantSeats(d) };
  },
  sev: function(ctx) { return ctx.pfr < ctx.floor - 5 ? 'r' : 'a'; },
  score: function(ctx) { return Math.max(5, ctx.floor - ctx.pfr) + 5; },
  label: 'Passive Opener',
  text: function(ctx) {
    var seatStr = ctx.seats ? (ctx.seats <= 3 ? ctx.seats + '-handed' : ctx.seats + '-max') : 'this table size';
    return 'PFR of only ' + ctx.pfr + '% at ' + seatStr + '. The expected band starts around ' + ctx.floor + '% - you enter pots without initiative.';
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
    if (pfr === null) return null;
    var band = bandFor('pfr', d);
    var floor = band ? band.tight : 15;
    if (pfr <= floor) return null;
    return { pfr: pfr, floor: floor };
  },
  sev: function() { return 'g'; },
  score: function(ctx) { return ctx.pfr - ctx.floor; },
  label: 'Opens With Raises',
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
    if (limp === null) return null;
    var seats = dominantSeats(d) || 6;
    var ceiling = seats <= 2 ? 30 : seats <= 3 ? 18 : seats <= 5 ? 12 : 8;
    if (limp >= ceiling) return null;
    return { limp: limp, ceiling: ceiling };
  },
  sev: function() { return 'g'; },
  score: function(ctx) { return ctx.ceiling - ctx.limp; },
  label: 'Rarely Limps',
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
    if (agg === null) return null;
    var band = bandFor('af', d);
    var floor = band ? band.tight - 5 : 15;
    if (agg >= floor) return null;
    return { agg: agg, floor: floor };
  },
  sev: function() { return 'r'; },
  score: function(ctx) { return Math.max(5, ctx.floor - ctx.agg) + 12; },
  label: 'Too Passive',
  text: function(ctx) {
    return 'Only ' + ctx.agg + '% aggression vs an expected floor of ' + ctx.floor + '%. You check and call when you should be betting for value.';
  },
  chips: function(ctx) { return [{ v: 'Agg: ' + ctx.agg + '%', hi: true }]; },
  tags: ['aggression', 'passive', 'leak'],
  costBB: function(ctx) { return Math.round((ctx.floor - ctx.agg) * 3); }
});

defineRule({
  id: 'balanced-aggression',
  panels: ['mygame', 'actions'],
  minSample: { n: 30 },
  test: function(d) {
    var agg = calcAggression(d.raises, d.calls, d.checks);
    if (agg === null) return null;
    var band = bandFor('af', d);
    if (!band) return null;
    if (agg < band.tight || agg > band.loose) return null;
    return { agg: agg, ideal: band.ideal };
  },
  sev: function() { return 'g'; },
  score: function(ctx) { return 40 - Math.abs(ctx.ideal - ctx.agg); },
  label: 'Balanced Aggression',
  text: function(ctx) {
    return ctx.agg + '% aggression sits inside the expected range. You bet for value without overbluffing.';
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
    if (agg === null) return null;
    var band = bandFor('af', d);
    var ceiling = band ? band.loose + 5 : 50;
    if (agg <= ceiling) return null;
    return { agg: agg, ceiling: ceiling };
  },
  sev: function() { return 'a'; },
  score: function(ctx) { return ctx.agg - ctx.ceiling; },
  label: 'Over-Aggressive',
  text: function(ctx) {
    return 'Aggression at ' + ctx.agg + '% sits above the expected ceiling of ' + ctx.ceiling + '%. Against opponents who call wide, repeated raises get looked up.';
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
    if (ftr === null) return null;
    var band = bandFor('foldToRaise', d);
    var ceiling = band ? band.loose + flopMod('foldToRaise', d) : 60;
    if (ftr <= ceiling) return null;
    return { ftr: ftr, ceiling: ceiling };
  },
  sev: function(ctx) { return ctx.ftr > ctx.ceiling + 10 ? 'r' : 'a'; },
  score: function(ctx) { return ctx.ftr - ctx.ceiling + 8; },
  label: 'Folding To Pressure',
  text: function(ctx) {
    return 'You fold ' + ctx.ftr + '% when raised - the expected ceiling is ' + Math.round(ctx.ceiling) + '%. Opponents push you off hands cheaply.';
  },
  chips: function(ctx) { return [{ v: 'FTR: ' + ctx.ftr + '%', hi: true }]; },
  tags: ['fold-pressure', 'postflop', 'leak'],
  costBB: function(ctx) { return Math.round((ctx.ftr - ctx.ceiling) * 0.4); }
});

// ── C-BET ──

defineRule({
  id: 'good-cbet',
  panels: ['mygame', 'actions'],
  minSample: { cbetOpps: 5 },
  test: function(d) {
    var cb = pct(d.cbetDone, d.cbetOpps);
    if (cb === null) return null;
    var band = bandFor('cbet', d);
    var mod = flopMod('cbet', d);
    if (!band) return null;
    var lo = band.tight + mod;
    var hi = band.loose + mod;
    if (cb < lo || cb > hi) return null;
    return { cb: cb, ideal: band.ideal + mod };
  },
  sev: function() { return 'g'; },
  score: function(ctx) { return 75 - Math.abs(ctx.ideal - ctx.cb); },
  label: 'Good C-Bet Rate',
  text: function(ctx) {
    return 'You continuation bet ' + ctx.cb + '% - inside the expected band for the boards you see. Enough to maintain initiative without going on auto-pilot.';
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
    if (cb === null) return null;
    var band = bandFor('cbet', d);
    var mod = flopMod('cbet', d);
    var floor = band ? band.tight + mod - 5 : 40;
    if (cb >= floor) return null;
    return { cb: cb, floor: floor };
  },
  sev: function(ctx) { return ctx.cb < ctx.floor - 15 ? 'r' : 'a'; },
  score: function(ctx) { return Math.max(5, ctx.floor - ctx.cb) + 5; },
  label: 'Low C-Bet',
  text: function(ctx) {
    return 'You only c-bet ' + ctx.cb + ' % vs an expected floor of ' + Math.round(ctx.floor) + '%. Predictable check-folds get exploited - keep firing the flop after raising.';
  },
  chips: function(ctx) { return [{ v: 'C-Bet: ' + ctx.cb + '%', hi: true }]; },
  tags: ['cbet', 'postflop', 'initiative', 'leak'],
  costBB: function(ctx) { return Math.round((ctx.floor - ctx.cb) * 0.5); }
});

// ── FOLD TO C-BET ──

defineRule({
  id: 'overfolds-to-cbets',
  panels: ['mygame', 'actions', 'leaks'],
  minSample: { foldToCbetOpps: 5 },
  test: function(d) {
    var fcb = pct(d.foldToCbetDone, d.foldToCbetOpps);
    if (fcb === null) return null;
    var band = bandFor('foldToRaise', d);
    var fb = dominantFlopBucket(d);
    // C-bet defence ceiling sits above fold-to-raise; loosen for multiway.
    var base = band ? band.loose + 15 : 65;
    if (fb === 'HU') base -= 5;
    if (fb === 'multiway') base += 5;
    if (fcb <= base) return null;
    return { fcb: fcb, ceiling: base };
  },
  sev: function(ctx) { return ctx.fcb > ctx.ceiling + 10 ? 'r' : 'a'; },
  score: function(ctx) { return ctx.fcb - ctx.ceiling + 5; },
  label: 'Overfolds To C-Bets',
  text: function(ctx) {
    return 'You fold to c-bets ' + ctx.fcb + '% - opponents can bluff your flop calls profitably. Defend wider with backdoor draws and overcards.';
  },
  chips: function(ctx) { return [{ v: 'FCB: ' + ctx.fcb + '%', hi: true }]; },
  tags: ['cbet-fold', 'postflop', 'fold-pressure', 'leak'],
  costBB: function(ctx) { return Math.round((ctx.fcb - ctx.ceiling) * 0.3); }
});

// ── 3-BET ──

defineRule({
  id: 'handles-3bets',
  panels: ['mygame'],
  minSample: { foldTo3betOpps: 5 },
  test: function(d) {
    var f3b = pct(d.foldTo3betDone, d.foldTo3betOpps);
    if (f3b === null) return null;
    var seats = dominantSeats(d) || 6;
    // 3-bet defense ceiling: HU defenders need to fold less, full-ring more.
    var ceiling = seats <= 2 ? 45 : seats <= 4 ? 50 : 55;
    if (f3b >= ceiling) return null;
    return { f3b: f3b, ceiling: ceiling };
  },
  sev: function() { return 'g'; },
  score: function(ctx) { return ctx.ceiling - ctx.f3b; },
  label: 'Handles 3-Bets',
  text: function(ctx) {
    return 'You fold to 3-bets ' + ctx.f3b + '% of the time. You aren\'t giving up opens too cheaply.';
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
    if (wtsd === null) return null;
    var fb = dominantFlopBucket(d);
    // Multiway → expect lower WTSD; HU → expect higher.
    var lo = fb === 'multiway' ? 18 : fb === 'HU' ? 28 : 25;
    var hi = fb === 'multiway' ? 30 : fb === 'HU' ? 42 : 35;
    if (wtsd < lo || wtsd > hi) return null;
    return { wtsd: wtsd, lo: lo, hi: hi };
  },
  sev: function() { return 'g'; },
  score: function(ctx) { return ctx.hi - Math.abs((ctx.lo + ctx.hi) / 2 - ctx.wtsd); },
  label: 'Selective Showdowns',
  text: function(ctx) {
    return 'You reach showdown ' + ctx.wtsd + '% after seeing a flop - inside the expected band. Picking spots well.';
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
    if (wtsd === null) return null;
    var fb = dominantFlopBucket(d);
    // Multiway pots should rarely go to showdown without a strong hand; HU
    // showdowns are normal and frequent.
    var ceiling = fb === 'multiway' ? 32 : fb === 'HU' ? 45 : 38;
    if (wtsd <= ceiling) return null;
    return { wtsd: wtsd, ceiling: ceiling };
  },
  sev: function(ctx) { return ctx.wtsd > ctx.ceiling + 10 ? 'r' : 'a'; },
  score: function(ctx) { return ctx.wtsd - ctx.ceiling + 5; },
  label: 'Paying Off Too Much',
  text: function(ctx) {
    return 'You go to showdown ' + ctx.wtsd + '% - above the expected ceiling of ' + ctx.ceiling + '%. Folding more on later streets saves money against strong hands.';
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
    if (g.hands < 10 || g.vpip === null) return null;
    var seats = dominantSeats(d) || 6;
    var pos = dominantPosition(d, ['UTG', 'UTG+1', 'MP']) || 'UTG';
    var band = matrixTarget('vpip', pos, seats, getUserStyle());
    var ceiling = band ? band.tight + 2 : 18;
    if (g.vpip >= ceiling) return null;
    return { vpip: g.vpip, ceiling: ceiling };
  },
  sev: function() { return 'g'; },
  score: function(ctx) { return ctx.ceiling - ctx.vpip + 5; },
  label: 'Tight Early',
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
    if (g.hands < 10 || g.vpip === null) return null;
    var seats = dominantSeats(d) || 6;
    // At HU/3-handed there is no early position - skip the rule.
    if (seats <= 3) return null;
    var pos = dominantPosition(d, ['UTG', 'UTG+1', 'MP']) || 'UTG';
    var band = matrixTarget('vpip', pos, seats, getUserStyle());
    var ceiling = band ? band.loose + 2 : 30;
    if (g.vpip <= ceiling) return null;
    return { vpip: g.vpip, ceiling: ceiling, seats: seats };
  },
  sev: function(ctx) { return ctx.vpip > ctx.ceiling + 10 ? 'r' : 'a'; },
  score: function(ctx) { return ctx.vpip - ctx.ceiling + 5; },
  label: 'Too Loose Early',
  text: function(ctx) {
    return 'Playing ' + ctx.vpip + '% from early position at ' + ctx.seats + '-max - the expected ceiling is ' + ctx.ceiling + '%. These seats act first on every street; tighten up.';
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
    if (g.hands < 10 || g.vpip === null) return null;
    var seats = dominantSeats(d) || 6;
    var pos = dominantPosition(d, ['CO', 'BTN']) || 'BTN';
    var band = matrixTarget('vpip', pos, seats, getUserStyle());
    var floor = band ? band.tight + 5 : 32;
    if (g.vpip <= floor) return null;
    return { vpip: g.vpip, floor: floor };
  },
  sev: function() { return 'g'; },
  score: function(ctx) { return ctx.vpip - ctx.floor; },
  label: 'Active Late',
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
    var minHands = Math.max(15, Math.round(d.n / keys.length / 2));
    for (var i = 0; i < keys.length; i++) {
      var pm = d.posMap[keys[i]];
      if (pm.hands >= minHands && pm.pnl > bestPnl) {
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
  label: function(ctx) { return 'Best Seat: ' + ctx.pos; },
  text: function(ctx) {
    return 'Your ' + ctx.pos + ' play is profitable at ' + fmtPnl(ctx.pnl) + '. You win ' + (ctx.wr !== null ? ctx.wr : '?') + '% from this seat.';
  },
  chips: function(ctx) { return [{ v: ctx.pos + ': ' + fmtPnl(ctx.pnl) }]; },
  tags: ['position', 'strength']
});

// ═══════════════════════════════════════════════════════════════════════════════
// ── MULTI-FACTOR RULES (cross-referencing insights) ──
// ═══════════════════════════════════════════════════════════════════════════════

defineRule({
  id: 'cbet-then-fold',
  panels: ['mygame', 'actions', 'leaks'],
  minSample: { cbetOpps: 8, facedRaise: 5 },
  test: function(d) {
    var cb = pct(d.cbetDone, d.cbetOpps);
    var ftr = pct(d.foldedToRaise, d.facedRaise);
    if (cb === null || ftr === null) return null;
    var cbBand = bandFor('cbet', d);
    var ftrBand = bandFor('foldToRaise', d);
    var cbFloor = cbBand ? cbBand.tight + flopMod('cbet', d) : 50;
    var ftrCeil = ftrBand ? ftrBand.loose + flopMod('foldToRaise', d) : 60;
    if (cb < cbFloor || ftr < ftrCeil) return null;
    return { cb: cb, ftr: ftr, ftrCeil: ftrCeil };
  },
  sev: function(ctx) { return ctx.ftr > ctx.ftrCeil + 10 ? 'r' : 'a'; },
  score: function(ctx) { return (ctx.cb - 50) * 0.3 + (ctx.ftr - ctx.ftrCeil) * 0.7 + 15; },
  label: 'C-Bet Then Fold',
  text: function(ctx) {
    return 'You c-bet ' + ctx.cb + '% of flops but fold ' + ctx.ftr + '% when raised. Opponents can raise your c-bets profitably - you fire once then give up.';
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
    var aggBand = bandFor('af', d);
    var aggFloor = aggBand ? aggBand.tight : 20;
    var seats = dominantSeats(d) || 6;
    var f3bCeil = seats <= 2 ? 55 : seats <= 4 ? 60 : 65;
    if (agg < aggFloor || f3b < f3bCeil) return null;
    return { agg: agg, f3b: f3b, f3bCeil: f3bCeil };
  },
  sev: function(ctx) { return ctx.f3b > ctx.f3bCeil + 10 ? 'r' : 'a'; },
  score: function(ctx) { return (ctx.f3b - ctx.f3bCeil) + (ctx.agg - 20) * 0.3 + 12; },
  label: 'Aggression Evaporates Under Pressure',
  text: function(ctx) {
    return 'You have ' + ctx.agg + '% aggression overall, but fold to ' + ctx.f3b + '% of 3-bets. You raise proactively, then fold to most 3-bets when opponents punch back.';
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
    var seats = dominantSeats(d) || 6;
    if (seats <= 3) return null; // No early position to speak of.
    var ep = calcPositionGroupVpip(d.posMap, ['UTG', 'UTG+1', 'MP']);
    if (ep.hands < 10 || ep.vpip === null) return null;
    var pos = dominantPosition(d, ['UTG', 'UTG+1', 'MP']) || 'UTG';
    var vpipBand = matrixTarget('vpip', pos, seats, getUserStyle());
    var epCeiling = vpipBand ? vpipBand.loose + 5 : 35;
    if (ep.vpip < epCeiling) return null;
    var flopFoldPct = d.ss.Flop.seen > 0 ? pct(d.ss.Flop.f, d.ss.Flop.seen) : null;
    if (flopFoldPct === null) return null;
    var ffCeiling = 40 + flopMod('flop-fold', d);
    if (flopFoldPct < ffCeiling) return null;
    return { epVpip: ep.vpip, flopFold: flopFoldPct, epCeiling: epCeiling, ffCeiling: ffCeiling };
  },
  sev: function() { return 'r'; },
  score: function(ctx) { return (ctx.epVpip - ctx.epCeiling) + (ctx.flopFold - ctx.ffCeiling) + 10; },
  label: 'Open Wide, Fold Flop',
  text: function(ctx) {
    return 'EP VPIP is ' + ctx.epVpip + '% but you fold ' + ctx.flopFold + '% of flops. You enter with marginal hands then give up when you miss - bleeding chips on both ends.';
  },
  chips: function(ctx) {
    return [{ v: 'EP VPIP: ' + ctx.epVpip + '%', hi: true }, { v: 'Flop fold: ' + ctx.flopFold + '%', hi: true }];
  },
  tags: ['loose-ep', 'flop-fold', 'position', 'preflop', 'postflop', 'leak'],
  costBB: function(ctx) { return Math.round((ctx.epVpip - ctx.epCeiling) * 2); }
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
    // Sample-scale the per-side minimum.
    var minSide = Math.max(5, Math.round(scaleThresh(5, d.handsWithOutcome)));
    if (winPots.length < minSide || lossPots.length < minSide) return null;
    var avgWin = avg(winPots);
    var avgLoss = avg(lossPots);
    // Trigger gap also scales with sample - small samples need a bigger ratio.
    var ratioGate = 1.5 * Math.max(1, Math.sqrt(40 / Math.min(winPots.length, lossPots.length)));
    if (avgLoss <= avgWin * ratioGate) return null;
    var ratio = (avgLoss / avgWin).toFixed(1);
    return { avgWin: Math.round(avgWin), avgLoss: Math.round(avgLoss), ratio: ratio };
  },
  sev: function(ctx) { return parseFloat(ctx.ratio) > 2.5 ? 'r' : 'a'; },
  score: function(ctx) { return parseFloat(ctx.ratio) * 5; },
  label: 'Winning Small, Losing Big',
  text: function(ctx) {
    return 'Average winning pot: ' + fmt(ctx.avgWin) + '. Average losing pot: ' + fmt(ctx.avgLoss) + ' (' + ctx.ratio + 'x bigger). Fold earlier on the river when you\'re beaten and size up bets when you have it.';
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
    var minSide = Math.max(5, Math.round(scaleThresh(5, d.handsWithOutcome)));
    if (winPots.length < minSide || lossPots.length < minSide) return null;
    var avgWin = avg(winPots);
    var avgLoss = avg(lossPots);
    var ratioGate = 1.3 * Math.max(1, Math.sqrt(40 / Math.min(winPots.length, lossPots.length)));
    if (avgWin < avgLoss * ratioGate) return null;
    var ratio = (avgWin / avgLoss).toFixed(1);
    return { avgWin: Math.round(avgWin), avgLoss: Math.round(avgLoss), ratio: ratio };
  },
  sev: function() { return 'g'; },
  score: function(ctx) { return parseFloat(ctx.ratio) * 3; },
  label: 'Win Big, Lose Small',
  text: function(ctx) {
    return 'Average winning pot: ' + fmt(ctx.avgWin) + ' vs average loss: ' + fmt(ctx.avgLoss) + ' (' + ctx.ratio + 'x ratio). Solid pot-control.';
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
    var minSide = Math.max(10, Math.round(scaleThresh(10, d.n)));
    if (aggTotal < minSide || passTotal < minSide) return null;
    var aggWr = pct(aggWon, aggTotal);
    var passWr = pct(passWon, passTotal);
    if (aggWr === null || passWr === null) return null;
    var diff = aggWr - passWr;
    var gate = scaleThresh(8, Math.min(aggTotal, passTotal));
    if (Math.abs(diff) < gate) return null;
    return { aggWr: aggWr, passWr: passWr, diff: diff, aggN: aggTotal, passN: passTotal };
  },
  sev: function(ctx) { return ctx.diff > 0 ? 'g' : 'a'; },
  score: function(ctx) { return Math.abs(ctx.diff) * 0.5; },
  label: function(ctx) { return ctx.diff > 0 ? 'Aggression Pays Off' : 'Passive Play Outperforms'; },
  text: function(ctx) {
    if (ctx.diff > 0) {
      return 'Hands where you raise win ' + ctx.aggWr + '% (' + ctx.aggN + ' hands) vs ' + ctx.passWr + '% when passive (' + ctx.passN + ' hands). Your bets and raises are working.';
    }
    return 'Passive hands win ' + ctx.passWr + '% vs ' + ctx.aggWr + '% when aggressive. Tighten your raising range - opponents are calling your bluffs.';
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
    var minSide = Math.max(5, Math.round(scaleThresh(5, d.n)));
    if (betBet.t < minSide || betCheck.t < minSide) return null;
    var bbWr = pct(betBet.w, betBet.t);
    var bcWr = pct(betCheck.w, betCheck.t);
    if (bbWr === null || bcWr === null) return null;
    var diff = bbWr - bcWr;
    var gate = scaleThresh(10, Math.min(betBet.t, betCheck.t));
    if (diff < gate) return null;
    return { bbWr: bbWr, bcWr: bcWr, bbN: betBet.t, bcN: betCheck.t, diff: diff };
  },
  sev: function() { return 'g'; },
  score: function(ctx) { return ctx.diff * 0.5 + 5; },
  label: 'Double Barrels Work',
  text: function(ctx) {
    return 'When you bet flop then bet turn, you win ' + ctx.bbWr + '% (' + ctx.bbN + ' hands). Bet flop then check turn: only ' + ctx.bcWr + '% (' + ctx.bcN + ' hands). Following through pays off.';
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
    var flopDrop = 100 - flopPct;
    var turnDrop = turnPct !== null ? 100 - turnPct : null;
    return { flopPct: flopPct, turnPct: turnPct, riverPct: riverPct, flopDrop: flopDrop, turnDrop: turnDrop, pfSeen: pfSeen, flopSeen: d.ss.Flop.seen, turnSeen: d.ss.Turn.seen, riverSeen: d.ss.River.seen };
  },
  sev: function() { return 'n'; },
  score: function() { return 3; },
  label: 'Street Funnel',
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
    if (ff === null) return null;
    var ceiling = 45 + flopMod('flop-fold', d);
    if (ff < ceiling) return null;
    // Correlate with VPIP - high VPIP plus high flop-fold is the real leak.
    var v = pct(d.vpip, d.n);
    var vpipBand = bandFor('vpip', d);
    var vpipLoose = vpipBand ? vpipBand.loose : 30;
    var looseTrigger = v !== null && v > vpipLoose;
    return { ff: ff, ceiling: ceiling, vpip: v, vpipLoose: vpipLoose, looseTrigger: looseTrigger };
  },
  sev: function(ctx) {
    if (ctx.looseTrigger && ctx.ff > ctx.ceiling + 10) return 'r';
    return ctx.looseTrigger ? 'a' : 'n';
  },
  score: function(ctx) { return ctx.ff - ctx.ceiling + (ctx.looseTrigger ? 5 : 0); },
  label: 'Flop Folding',
  text: function(ctx) {
    if (ctx.looseTrigger) {
      return 'You fold ' + ctx.ff + '% on the flop and play a loose VPIP of ' + ctx.vpip + '%. Calling pre then folding the flop a lot says your preflop range is too wide.';
    }
    return 'You fold ' + ctx.ff + '% on the flop. With a tight preflop range that\'s normal - most flops don\'t hit.';
  },
  chips: function(ctx) { return [{ v: 'Flop fold: ' + ctx.ff + '%', hi: ctx.looseTrigger }]; },
  tags: ['flop-fold', 'street', 'leak']
});

defineRule({
  id: 'turn-fold-high',
  panels: ['street'],
  minSample: { n: 30 },
  test: function(d) {
    if (d.ss.Turn.seen < 8) return null;
    var tf = pct(d.ss.Turn.f, d.ss.Turn.seen);
    if (tf === null) return null;
    var ceiling = 50 + flopMod('flop-fold', d);
    if (tf < ceiling) return null;
    return { tf: tf, ceiling: ceiling };
  },
  sev: function(ctx) { return ctx.tf > ctx.ceiling + 10 ? 'r' : 'a'; },
  score: function(ctx) { return ctx.tf - ctx.ceiling + 3; },
  label: 'Turn Folding',
  text: function(ctx) {
    return 'Folding ' + ctx.tf + '% on the turn. If you have a made hand, bet and protect it - don\'t check-fold to draws.';
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
    var minSide = Math.max(3, Math.round(scaleThresh(3, d.n)));
    if (!flopAmts || !turnAmts || flopAmts.length < minSide || turnAmts.length < minSide) return null;
    var avgFlop = avg(flopAmts);
    var avgTurn = avg(turnAmts);
    if (avgFlop <= 0 || avgTurn >= avgFlop) return null;
    var drop = Math.round((1 - avgTurn / avgFlop) * 100);
    var gate = Math.round(scaleThresh(15, Math.min(flopAmts.length, turnAmts.length)));
    if (drop < gate) return null;
    return { avgFlop: Math.round(avgFlop), avgTurn: Math.round(avgTurn), drop: drop };
  },
  sev: function(ctx) { return ctx.drop > 30 ? 'r' : 'a'; },
  score: function(ctx) { return ctx.drop * 0.5; },
  label: 'Turn Sizing Drops',
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
    if (!rbo) return null;
    var minOpps = Math.max(5, Math.round(scaleThresh(5, d.n)));
    if (rbo.t < minOpps) return null;
    var riverBetPct = pct(rbo.b, rbo.t);
    if (riverBetPct === null || riverBetPct >= 30) return null;
    return { pct: riverBetPct, bets: rbo.b, opps: rbo.t };
  },
  sev: function(ctx) { return ctx.pct < 15 ? 'r' : 'a'; },
  score: function(ctx) { return 30 - ctx.pct + 5; },
  label: 'Missing River Value',
  text: function(ctx) {
    return 'You only bet the river ' + ctx.pct + '% of the time (' + ctx.bets + '/' + ctx.opps + ' spots). Bet for value with the best hand - that\'s where most of the money goes in.';
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
    if (!fbo) return null;
    var minOpps = Math.max(5, Math.round(scaleThresh(5, d.n)));
    if (fbo.t < minOpps) return null;
    var fp = pct(fbo.b, fbo.t);
    if (fp === null) return null;
    // Floor scales with flop bucket: HU expects more flop bets, multiway less.
    var floor = 30 + flopMod('cbet', d) * 0.4;
    if (fp >= floor) return null;
    return { pct: fp, bets: fbo.b, opps: fbo.t, floor: floor };
  },
  sev: function(ctx) { return ctx.pct < ctx.floor - 15 ? 'r' : 'a'; },
  score: function(ctx) { return ctx.floor - ctx.pct + 5; },
  label: 'Flop Passivity',
  text: function(ctx) {
    return 'You only bet the flop ' + ctx.pct + '% when you had the option (' + ctx.bets + '/' + ctx.opps + '). Checking strong hands gives free cards to draws.';
  },
  chips: function(ctx) { return [{ v: 'Flop bet: ' + ctx.pct + '%', hi: true }]; },
  tags: ['bets', 'flop', 'passive', 'leak'],
  costBB: function(ctx) { return Math.round((ctx.floor - ctx.pct) * 0.4); }
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
    var minPlayed = Math.max(3, Math.round(scaleThresh(3, d.n)));
    if (!ps || ps.played < minPlayed) return null;
    var wr = pct(ps.won, ps.played);
    if (wr === null || wr >= 45) return null;
    return { wr: wr, played: ps.played, dealt: ps.dealt };
  },
  sev: function(ctx) { return ctx.wr < 30 ? 'r' : 'a'; },
  score: function(ctx) { return 45 - ctx.wr + 5; },
  label: 'Pocket Pairs Struggling',
  text: function(ctx) {
    return 'Only ' + ctx.wr + '% win rate with pocket pairs (' + ctx.played + ' played of ' + ctx.dealt + ' dealt). Bet hard preflop and charge draws - don\'t slow play.';
  },
  chips: function(ctx) { return [{ v: ctx.wr + '% win rate', hi: true }, { v: ctx.played + ' played' }]; },
  tags: ['cards', 'pairs', 'leak']
});

defineRule({
  id: 'trash-hands-played',
  panels: ['cards', 'leaks'],
  minSample: { n: 20 },
  test: function(d) {
    var seats = dominantSeats(d) || 6;
    // HU and 3-handed: "trash" hands are routinely correct opens. Skip.
    if (seats <= 3) return null;
    var ts = d.htMap['Offsuit Trash'];
    var minDealt = Math.max(3, Math.round(scaleThresh(3, d.n)));
    if (!ts || ts.dealt < minDealt || ts.played < 1) return null;
    var playRate = pct(ts.played, ts.dealt);
    if (playRate === null) return null;
    // Floor scales with seat count: 4-5p tolerates more trash than full-ring.
    var floor = seats <= 5 ? 28 : 18;
    if (playRate < floor) return null;
    return { playRate: playRate, played: ts.played, dealt: ts.dealt, floor: floor, seats: seats };
  },
  sev: function(ctx) { return ctx.playRate > ctx.floor + 18 ? 'r' : 'a'; },
  score: function(ctx) { return ctx.playRate - ctx.floor + 8; },
  label: 'Playing Trash Hands',
  text: function(ctx) {
    return 'You play ' + ctx.playRate + '% of offsuit trash at ' + ctx.seats + '-max (' + ctx.played + ' of ' + ctx.dealt + ' dealt). At this table size these are nearly always folds.';
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
    var minPlayed = Math.max(3, Math.round(scaleThresh(3, d.n)));
    if (!bw || bw.played < minPlayed) return null;
    var wr = pct(bw.won, bw.played);
    if (wr === null || wr < 55) return null;
    return { wr: wr, played: bw.played };
  },
  sev: function() { return 'g'; },
  score: function(ctx) { return ctx.wr - 55 + 3; },
  label: 'Broadway Hands Performing',
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
    var minPlayed = Math.max(3, Math.round(scaleThresh(3, d.n)));
    if (!sc || sc.played < minPlayed) return null;
    var wr = pct(sc.won, sc.played);
    if (wr === null || wr < 50) return null;
    return { wr: wr, played: sc.played };
  },
  sev: function() { return 'g'; },
  score: function(ctx) { return ctx.wr - 50 + 2; },
  label: 'Suited Connectors Paying Off',
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
    var minSide = Math.max(5, Math.round(scaleThresh(5, hands.length)));
    if (afterLossTotal < minSide || normalTotal < 10) return null;
    var afterWr = pct(afterLossWins, afterLossTotal);
    var normalWr = pct(normalWins, normalTotal);
    if (afterWr === null || normalWr === null) return null;
    var diff = normalWr - afterWr;
    var gate = scaleThresh(10, afterLossTotal);
    if (diff < gate) return null;
    return { afterWr: afterWr, normalWr: normalWr, diff: diff, afterN: afterLossTotal };
  },
  sev: function(ctx) { return ctx.diff > 20 ? 'r' : 'a'; },
  score: function(ctx) { return ctx.diff * 0.8 + 10; },
  label: 'Tilt Detected',
  text: function(ctx) {
    return 'After a big loss, your win rate drops to ' + ctx.afterWr + '% vs ' + ctx.normalWr + '% normally across ' + ctx.afterN + ' tilt-prone hands. Take a break after big losses.';
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
    var halves = splitSessionHalves(hands, 20);
    if (halves.firstHalf.length < 15 || halves.secondHalf.length < 15) return null;
    var d1 = analyse(halves.firstHalf);
    var d2 = analyse(halves.secondHalf);
    var wr1 = pct(d1.handsWon, d1.handsWithOutcome);
    var wr2 = pct(d2.handsWon, d2.handsWithOutcome);
    if (wr1 === null || wr2 === null) return null;
    var diff = wr1 - wr2;
    var gate = scaleThresh(8, Math.min(d1.handsWithOutcome, d2.handsWithOutcome));
    if (diff < gate) return null;
    return { wr1: wr1, wr2: wr2, diff: diff, n1: d1.n, n2: d2.n };
  },
  sev: function(ctx) { return ctx.diff > 15 ? 'r' : 'a'; },
  score: function(ctx) { return ctx.diff * 0.5 + 3; },
  label: 'Late-Session Decline',
  text: function(ctx) {
    return 'Win rate drops from ' + ctx.wr1 + '% early in your sessions to ' + ctx.wr2 + '% later in the same sessions. Fatigue or tilt may be affecting your play - consider shorter sessions.';
  },
  chips: function(ctx) {
    return [{ v: 'Early session: ' + ctx.wr1 + '%' }, { v: 'Late session: ' + ctx.wr2 + '%', hi: true }];
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
    var minBlinds = Math.max(15, Math.round(scaleThresh(15, d.n)));
    if (blindHands < minBlinds) return null;
    var blindLoss = (sb.pnl || 0) + (bb.pnl || 0);
    if (blindLoss >= 0) return null;
    var lossPerHand = Math.abs(blindLoss) / blindHands;
    var avgPot = d.n > 0 ? Math.round((d.totalWonAmount + d.totalInvested) / d.n) : 0;
    if (avgPot <= 0 || lossPerHand < avgPot * 0.15) return null;
    return { loss: Math.round(Math.abs(blindLoss)), hands: blindHands, perHand: Math.round(lossPerHand) };
  },
  sev: function() { return 'a'; },
  score: function(ctx) { return Math.min(ctx.loss / 50, 20); },
  label: 'Blind Defense Bleeding',
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
    var minSd = Math.max(10, Math.round(scaleThresh(10, d.n)));
    if (sdWins < minSd) return null;
    var rate = pct(riverCheckWins, sdWins);
    if (rate === null || rate < 35) return null;
    return { rate: rate, count: riverCheckWins, total: sdWins };
  },
  sev: function(ctx) { return ctx.rate > 50 ? 'r' : 'a'; },
  score: function(ctx) { return ctx.rate - 35 + 8; },
  label: 'Missed Value Bets',
  text: function(ctx) {
    return 'You check the river and win at showdown ' + ctx.rate + '% (' + ctx.count + '/' + ctx.total + '). A bet could have extracted more from second-best hands.';
  },
  chips: function(ctx) { return [{ v: ctx.rate + '% check-win', hi: true }]; },
  tags: ['river', 'value', 'showdown', 'leak'],
  costBB: function(ctx) { return Math.round(ctx.count * 2); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ── PLAYERS / OPPONENT POOL RULES ──
// ═══════════════════════════════════════════════════════════════════════════════

defineRule({
  id: 'opponent-pool-composition',
  panels: ['players'],
  minSample: { n: 20 },
  test: function(d, hands) {
    var types = { LAG: 0, LAP: 0, TAG: 0, TAP: 0, AG: 0, PA: 0, Unknown: 0 };
    var totalProf = 0;
    for (var name in _opponentCache) {
      var prof = _opponentCache[name];
      types[prof.type] = (types[prof.type] || 0) + 1;
      totalProf++;
    }
    if (totalProf < 3) return null;
    var dominant = null, maxCount = 0;
    for (var t in types) {
      if (types[t] > maxCount) { maxCount = types[t]; dominant = t; }
    }
    var dominantPct = Math.round(maxCount / totalProf * 100);
    if (dominantPct < 35) return null;
    var typeNames = { LAG: 'Loose-Aggressive', LAP: 'Loose-Passive', TAG: 'Tight-Aggressive', TAP: 'Tight-Passive', AG: 'Aggressive', PA: 'Passive' };
    return { dominant: dominant, dominantLabel: typeNames[dominant] || dominant, pct: dominantPct, count: maxCount, total: totalProf, types: types };
  },
  sev: function() { return 'n'; },
  score: function() { return 8; },
  label: function(ctx) { return 'Table Profile: ' + ctx.dominantLabel; },
  text: function(ctx) {
    var advice =
      ctx.dominant === 'LAP' || ctx.dominant === 'PA' ? 'Value bet relentlessly, skip bluffs.' :
      ctx.dominant === 'LAG' || ctx.dominant === 'AG' ? 'Tighten up and trap with strong hands.' :
      ctx.dominant === 'TAG' ? 'Respect their bets but steal their blinds.' :
      ctx.dominant === 'TAP' ? 'Bluff them more - they fold too easily.' :
      'Adapt to the mix.';
    return ctx.pct + '% of your opponents (' + ctx.count + '/' + ctx.total + ') play a ' + ctx.dominantLabel + ' style. ' + advice;
  },
  chips: function(ctx) {
    var c = [];
    for (var t in ctx.types) { if (ctx.types[t] > 0) c.push({ v: t + ': ' + ctx.types[t], hi: t === ctx.dominant }); }
    return c;
  },
  tags: ['players', 'pool']
});

defineRule({
  id: 'biggest-fish',
  panels: ['players'],
  minSample: { n: 20 },
  test: function(d, hands) {
    var fish = null, fishVpip = 0;
    for (var name in _opponentCache) {
      var prof = _opponentCache[name];
      if (prof.hands < 10 || prof.vpip === null) continue;
      if (prof.vpip > fishVpip) { fishVpip = prof.vpip; fish = prof; }
    }
    if (!fish || fishVpip < 50) return null;
    return { name: fish.name, vpip: fish.vpip, agg: fish.agg, hands: fish.hands, type: fish.type, ftr: fish.foldToRaise };
  },
  sev: function() { return 'g'; },
  score: function(ctx) { return ctx.vpip - 50 + 5; },
  label: function(ctx) { return 'Fish Spotted: ' + ctx.name; },
  text: function(ctx) {
    var advice = ctx.ftr !== null && ctx.ftr >= 50
      ? 'They fold to raises ' + ctx.ftr + '% - raise their limps and steal pots.'
      : ctx.ftr !== null && ctx.ftr < 30
      ? 'They rarely fold to raises - value bet wide, never bluff.'
      : 'Value bet them relentlessly with strong hands.';
    return ctx.name + ' plays ' + ctx.vpip + '% of hands (' + ctx.type + ', ' + ctx.hands + ' shared hands). ' + advice;
  },
  chips: function(ctx) {
    return [{ v: 'VPIP: ' + ctx.vpip + '%', hi: true }, { v: ctx.type }, { v: ctx.hands + ' hands' }];
  },
  tags: ['players', 'exploit'],
  examples: function(ctx, hands) {
    return findExampleHand(function(h) {
      var acts = parseActions(h.actions);
      return acts.some(function(a) { return a.author === ctx.name; }) && h.outcome && h.outcome.result === 'won';
    });
  },
  coaching: function() { return 'You won this hand with the fish at the table. Keep value betting them.'; }
});

defineRule({
  id: 'most-dangerous-opponent',
  panels: ['players'],
  minSample: { n: 20 },
  test: function(d, hands) {
    var shark = null, sharkScore = 0;
    for (var name in _opponentCache) {
      var prof = _opponentCache[name];
      if (prof.hands < 10 || prof.vpip === null || prof.agg === null) continue;
      var score = 0;
      if (prof.vpip >= 18 && prof.vpip <= 35) score += 10;
      if (prof.agg >= 25 && prof.agg <= 50) score += 10;
      if (prof.cbet !== null && prof.cbet >= 50 && prof.cbet <= 80) score += 5;
      if (prof.raw && prof.raw.showdownStrong > prof.raw.showdownWeak) score += 5;
      if (score > sharkScore) { sharkScore = score; shark = prof; }
    }
    if (!shark || sharkScore < 15) return null;
    return { name: shark.name, vpip: shark.vpip, agg: shark.agg, type: shark.type, hands: shark.hands, score: sharkScore };
  },
  sev: function() { return 'a'; },
  score: function(ctx) { return ctx.score * 0.5; },
  label: function(ctx) { return 'Tough Opponent: ' + ctx.name; },
  text: function(ctx) {
    return ctx.name + ' plays a solid ' + ctx.type + ' style: ' + ctx.vpip + '% VPIP, ' + ctx.agg + '% aggression (' + ctx.hands + ' hands). Avoid big pots without premium hands. Don\'t bluff them.';
  },
  chips: function(ctx) {
    return [{ v: ctx.type, hi: true }, { v: 'VPIP: ' + ctx.vpip + '%' }, { v: 'Agg: ' + ctx.agg + '%' }];
  },
  tags: ['players', 'danger']
});

defineRule({
  id: 'unexploited-opponent',
  panels: ['players', 'leaks'],
  minSample: { n: 30 },
  test: function(d, hands) {
    var targets = [];
    for (var name in _opponentCache) {
      var prof = _opponentCache[name];
      if (prof.hands < 15) continue;
      var heroWins = 0, heroLosses = 0;
      for (var i = 0; i < hands.length; i++) {
        var h = hands[i];
        if (!h.outcome) continue;
        var acts = parseActions(h.actions);
        var inHand = acts.some(function(a) { return a.author === name; });
        if (!inHand) continue;
        if (h.outcome.result === 'won') heroWins++;
        else if (h.outcome.result !== 'folded') heroLosses++;
      }
      if (heroWins + heroLosses < 5) continue;
      var heroWr = pct(heroWins, heroWins + heroLosses);
      if (heroWr === null || heroWr >= 45) continue;
      if (prof.adjustments.length >= 2) {
        targets.push({ name: name, vpip: prof.vpip, agg: prof.agg, type: prof.type, heroWr: heroWr, adjustments: prof.adjustments, hands: prof.hands });
      }
    }
    if (!targets.length) return null;
    targets.sort(function(a, b) { return a.heroWr - b.heroWr; });
    var t = targets[0];
    return t;
  },
  sev: function() { return 'r'; },
  score: function(ctx) { return 45 - ctx.heroWr + 10; },
  label: function(ctx) { return 'Not Exploiting ' + ctx.name; },
  text: function(ctx) {
    return 'You only win ' + ctx.heroWr + '% against ' + ctx.name + ' (' + ctx.type + ', ' + ctx.hands + ' hands) despite clear leaks: ' + ctx.adjustments.slice(0, 2).join('. ') + '.';
  },
  chips: function(ctx) {
    return [{ v: 'Hero WR: ' + ctx.heroWr + '%', hi: true }, { v: ctx.type }, { v: ctx.adjustments.length + ' exploits' }];
  },
  tags: ['players', 'exploit', 'leak'],
  costBB: function(ctx) { return Math.round((45 - ctx.heroWr) * 2); }
});

defineRule({
  id: 'hero-vs-loose-tight',
  panels: ['players'],
  minSample: { n: 30 },
  test: function(d, hands) {
    var vsLoose = { w: 0, t: 0 }, vsTight = { w: 0, t: 0 };
    for (var i = 0; i < hands.length; i++) {
      var h = hands[i];
      if (!h.outcome || h.outcome.result === 'folded') continue;
      var acts = parseActions(h.actions);
      var opponents = {};
      for (var j = 0; j < acts.length; j++) {
        if (!acts[j].isMe && acts[j].author) opponents[acts[j].author] = true;
      }
      var hasLoose = false, hasTight = false;
      for (var opp in opponents) {
        var prof = _opponentCache[opp];
        if (!prof) continue;
        if (prof.vpip !== null && prof.vpip >= 40) hasLoose = true;
        if (prof.vpip !== null && prof.vpip < 25) hasTight = true;
      }
      var won = h.outcome.result === 'won';
      if (hasLoose) { vsLoose.t++; if (won) vsLoose.w++; }
      if (hasTight) { vsTight.t++; if (won) vsTight.w++; }
    }
    var minSide = Math.max(8, Math.round(scaleThresh(8, hands.length)));
    if (vsLoose.t < minSide || vsTight.t < minSide) return null;
    var looseWr = pct(vsLoose.w, vsLoose.t);
    var tightWr = pct(vsTight.w, vsTight.t);
    if (looseWr === null || tightWr === null) return null;
    var diff = Math.abs(looseWr - tightWr);
    var gate = scaleThresh(8, Math.min(vsLoose.t, vsTight.t));
    if (diff < gate) return null;
    return { looseWr: looseWr, tightWr: tightWr, looseN: vsLoose.t, tightN: vsTight.t, diff: diff, betterVs: looseWr > tightWr ? 'loose' : 'tight' };
  },
  sev: function(ctx) { return ctx.diff > 20 ? 'a' : 'n'; },
  score: function(ctx) { return ctx.diff * 0.3 + 5; },
  label: function(ctx) { return ctx.betterVs === 'loose' ? 'Better Vs Loose Players' : 'Better Vs Tight Players'; },
  text: function(ctx) {
    if (ctx.betterVs === 'loose') {
      return 'You win ' + ctx.looseWr + '% against loose opponents (' + ctx.looseN + ' hands) but only ' + ctx.tightWr + '% against tight ones (' + ctx.tightN + ' hands). Your value-betting style works vs calling stations. Vs tight opponents, try more steals and bluffs.';
    }
    return 'You win ' + ctx.tightWr + '% against tight opponents (' + ctx.tightN + ' hands) but only ' + ctx.looseWr + '% against loose ones (' + ctx.looseN + ' hands). Tighten your range vs loose players and value bet more.';
  },
  chips: function(ctx) {
    return [{ v: 'vs Loose: ' + ctx.looseWr + '%', hi: ctx.betterVs === 'loose' }, { v: 'vs Tight: ' + ctx.tightWr + '%', hi: ctx.betterVs === 'tight' }];
  },
  tags: ['players', 'adjustment']
});

defineRule({
  id: 'opponent-aggression-mismatch',
  panels: ['players'],
  minSample: { n: 30 },
  test: function(d, hands) {
    var vsPassive = { w: 0, t: 0 }, vsAggressive = { w: 0, t: 0 };
    for (var i = 0; i < hands.length; i++) {
      var h = hands[i];
      if (!h.outcome || h.outcome.result === 'folded') continue;
      var acts = parseActions(h.actions);
      var opponents = {};
      for (var j = 0; j < acts.length; j++) {
        if (!acts[j].isMe && acts[j].author) opponents[acts[j].author] = true;
      }
      var hasPassive = false, hasAggressive = false;
      for (var opp in opponents) {
        var prof = _opponentCache[opp];
        if (!prof || prof.agg === null) continue;
        if (prof.agg < 15) hasPassive = true;
        if (prof.agg >= 35) hasAggressive = true;
      }
      var won = h.outcome.result === 'won';
      if (hasPassive) { vsPassive.t++; if (won) vsPassive.w++; }
      if (hasAggressive) { vsAggressive.t++; if (won) vsAggressive.w++; }
    }
    var minSide = Math.max(8, Math.round(scaleThresh(8, hands.length)));
    if (vsPassive.t < minSide || vsAggressive.t < minSide) return null;
    var passWr = pct(vsPassive.w, vsPassive.t);
    var aggWr = pct(vsAggressive.w, vsAggressive.t);
    if (passWr === null || aggWr === null) return null;
    var diff = passWr - aggWr;
    var gate = scaleThresh(8, Math.min(vsPassive.t, vsAggressive.t));
    if (diff < gate) return null;
    return { passWr: passWr, aggWr: aggWr, passN: vsPassive.t, aggN: vsAggressive.t, diff: diff };
  },
  sev: function(ctx) { return ctx.diff > 20 ? 'a' : 'n'; },
  score: function(ctx) { return ctx.diff * 0.3 + 3; },
  label: 'Struggling Vs Aggressive Players',
  text: function(ctx) {
    return 'You win ' + ctx.passWr + '% vs passive opponents (' + ctx.passN + ' hands) but only ' + ctx.aggWr + '% vs aggressive ones (' + ctx.aggN + ' hands). Tighten your calling range and trap with strong hands instead of folding.';
  },
  chips: function(ctx) {
    return [{ v: 'vs Passive: ' + ctx.passWr + '%' }, { v: 'vs Aggressive: ' + ctx.aggWr + '%', hi: true }];
  },
  tags: ['players', 'adjustment', 'leak']
});
