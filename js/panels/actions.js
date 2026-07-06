// Betting (actions) panel logic. No DOM, no markup — the view is
// js/panels/views/actions.js.

// Standalone hand predicates for the situational-stats rows, so each stat box
// can open the hands behind it. These mirror the definitions used in the
// Streets insight section but are kept local so the panel does not depend on
// that section's internals.
function _actPreRaiserContext(h) {
  // Returns { pfrIsHero, pfrAuthor } or null.
  if (!h || !h.actions) return null;
  var acts = parseActions(h.actions);
  var pfrAuthor = null, pfrIsHero = null;
  for (var i = 0; i < acts.length; i++) {
    var a = acts[i];
    if (a.street === 'Preflop' && a.type === 'raise' && pfrAuthor == null) {
      pfrAuthor = a.author;
      pfrIsHero = !!a.isMe;
      break;
    }
  }
  if (pfrAuthor == null) return null;
  return { pfrIsHero: pfrIsHero, pfrAuthor: pfrAuthor };
}

function _actHeroCbet(h) {
  var ctx = _actPreRaiserContext(h);
  if (!ctx || !ctx.pfrIsHero) return false;
  var acts = parseActions(h.actions);
  for (var i = 0; i < acts.length; i++) {
    var a = acts[i];
    if (a.isMe && a.street === 'Flop' && a.type !== 'sb' && a.type !== 'bb') {
      return a.type === 'bet' || a.type === 'raise';
    }
  }
  return false;
}

function _actHeroDelayCbet(h) {
  var ctx = _actPreRaiserContext(h);
  if (!ctx || !ctx.pfrIsHero) return false;
  var acts = parseActions(h.actions);
  var firstFlop = null, firstTurn = null;
  for (var i = 0; i < acts.length; i++) {
    var a = acts[i];
    if (!a.isMe || a.type === 'sb' || a.type === 'bb') continue;
    if (a.street === 'Flop' && firstFlop === null) firstFlop = a.type;
    if (a.street === 'Turn' && firstTurn === null) firstTurn = a.type;
  }
  if (firstFlop !== 'check' || firstTurn === null) return false;
  return firstTurn === 'bet' || firstTurn === 'raise';
}

function _actHeroDonk(h) {
  var ctx = _actPreRaiserContext(h);
  if (!ctx || ctx.pfrIsHero !== false) return false;
  var acts = parseActions(h.actions);
  for (var i = 0; i < acts.length; i++) {
    var a = acts[i];
    if (a.isMe && a.street === 'Flop' && a.type !== 'sb' && a.type !== 'bb') {
      return a.type === 'bet' || a.type === 'raise';
    }
  }
  return false;
}

function _actHeroFoldToCbet(h) {
  var ctx = _actPreRaiserContext(h);
  if (!ctx || ctx.pfrIsHero !== false) return false;
  var acts = parseActions(h.actions);
  var firstFlopBetByPfr = false;
  for (var i = 0; i < acts.length; i++) {
    var a = acts[i];
    if (a.street === 'Flop' && (a.type === 'bet' || a.type === 'raise') && a.author === ctx.pfrAuthor && !firstFlopBetByPfr) {
      firstFlopBetByPfr = true;
      continue;
    }
    if (firstFlopBetByPfr && a.street === 'Flop' && a.isMe && (a.type === 'fold' || a.type === 'call' || a.type === 'raise')) {
      return a.type === 'fold';
    }
  }
  return false;
}

function _actHeroFoldToNbet(h, level) {
  // level 3 = fold to 3-bet (hero opened, villain reraised, hero folds preflop)
  // level 4 = fold to 4-bet (hero 3-bet, villain 4-bet, hero folds preflop)
  if (!h || !h.actions) return false;
  var acts = parseActions(h.actions);
  var preRaiseLevel = 0;
  var heroReachedLevel = false;
  for (var i = 0; i < acts.length; i++) {
    var a = acts[i];
    if (a.street !== 'Preflop') break;
    if (a.type === 'sb' || a.type === 'bb') continue;
    if (a.type === 'raise') {
      preRaiseLevel++;
      // Hero made the raise that sits one below the level we are testing
      // (open for 3-bet defence, 3-bet for 4-bet defence).
      if (a.isMe && preRaiseLevel === level - 1) heroReachedLevel = true;
    }
    if (heroReachedLevel && a.isMe && a.type === 'fold' && preRaiseLevel >= level) {
      return true;
    }
  }
  return false;
}

var _ACT_SIT_PREDICATES = {
  'C-Bet': _actHeroCbet,
  'Delayed C-Bet': _actHeroDelayCbet,
  'Donk Bet': _actHeroDonk,
  'Fold to C-Bet': _actHeroFoldToCbet,
  'Fold to 3-Bet': function(h) { return _actHeroFoldToNbet(h, 3); },
  'Fold to 4-Bet': function(h) { return _actHeroFoldToNbet(h, 4); }
};

var _ACT_SIT_NOTES = {
  'C-Bet': 'Flops where you had the preflop lead and bet. Look at the board texture and how often the bet got through versus got called or raised.',
  'Delayed C-Bet': 'Turns you bet after checking back the flop as the preflop raiser. The strongest spots have a turn card that improves your range or threatens the caller.',
  'Donk Bet': 'Flops where you bet into the preflop raiser. Donks usually only profit on textures that miss the raiser entirely.',
  'Fold to C-Bet': 'Flops where you faced a c-bet and folded. Some are correct; the leak is folding pairs or strong backdoors that should continue at least one street.',
  'Fold to 3-Bet': 'Opens you gave up on when an opponent 3-bet. Look for the suited broadways and pairs in this list, they are usually defends.',
  'Fold to 4-Bet': 'Hands where you 3-bet, faced a 4-bet, and folded. Check whether any of these are strong enough to 5-bet jam or call.'
};

// Colour a situational stat vs the profile bands for this game context.
function _actSitStatColour(label, p, ctx) {
  if (p === null) return 'o';
  var fb = ctx.flopBucket;
  var fbMod = fb === 'HU' ? 5 : fb === 'multiway' ? -10 : 0;
  var cbetBand = ctx.band('cbet');
  var ftrBand = ctx.band('foldToRaise');
  switch (label) {
    case 'C-Bet': {
      var hi = cbetBand ? cbetBand.ideal + fbMod : 60;
      var lo = cbetBand ? cbetBand.tight + fbMod : 40;
      return p >= hi ? 'g' : p >= lo ? 'o' : 'r';
    }
    case 'Delayed C-Bet': return p >= 30 ? 'g' : 'o';
    case 'Donk Bet': return p > 30 ? 'a' : 'o';
    case 'Fold to C-Bet': {
      var ceil = ftrBand ? ftrBand.loose + 15 + (fb === 'multiway' ? 5 : -5) : 70;
      var soft = ftrBand ? ftrBand.ideal + 10 : 50;
      return p > ceil ? 'r' : p > soft ? 'a' : 'g';
    }
    case 'Fold to 3-Bet': {
      var ceil3 = ctx.seats <= 2 ? 55 : ctx.seats <= 4 ? 60 : 70;
      var soft3 = ctx.seats <= 2 ? 40 : ctx.seats <= 4 ? 45 : 50;
      return p > ceil3 ? 'r' : p > soft3 ? 'a' : 'g';
    }
    case 'Fold to 4-Bet': return p > 80 ? 'a' : 'o';
    default: return 'o';
  }
}

function actionsModel(d, hands) {
  var actTotal = d.folds + d.checks + d.calls + d.raises;
  var split = {
    fold: pct(d.folds, actTotal),
    check: pct(d.checks, actTotal),
    call: pct(d.calls, actTotal),
    raise: pct(d.raises, actTotal),
  };

  var ctx = getGameContext(d);
  var sit = [
    { label: 'C-Bet', done: d.cbetDone, opps: d.cbetOpps },
    { label: 'Delayed C-Bet', done: d.delayCbetDone, opps: d.delayCbetOpps },
    { label: 'Donk Bet', done: d.donkDone, opps: d.donkOpps },
    { label: 'Fold to C-Bet', done: d.foldToCbetDone, opps: d.foldToCbetOpps },
    { label: 'Fold to 3-Bet', done: d.foldTo3betDone, opps: d.foldTo3betOpps },
    { label: 'Fold to 4-Bet', done: d.foldTo4betDone, opps: d.foldTo4betOpps },
  ].filter(function(s) { return s.opps !== 0; }).map(function(s) {
    var p = pct(s.done, s.opps);
    var pred = _ACT_SIT_PREDICATES[s.label];
    var matches = pred ? pickHands(hands, pred, 15) : [];
    return {
      label: s.label, done: s.done, opps: s.opps, p: p,
      cls: _actSitStatColour(s.label, p, ctx),
      hands: matches,
      note: (_ACT_SIT_NOTES[s.label] || '') +
        ' This happened in ' + s.done + ' of ' + s.opps + ' spots (' + (p !== null ? p + '%' : '-') + ').'
    };
  });

  // Bet sizes shown in BB when the toggle is on and BB data exists.
  var betDisplay = {};
  STREETS.forEach(function(s) {
    betDisplay[s] = _displayBB && d.betAmtsBB && d.betAmtsBB[s] && d.betAmtsBB[s].length
      ? avg(d.betAmtsBB[s]) : avg(d.betAmts[s]);
  });
  var maxAvg = Math.max(betDisplay.Preflop, betDisplay.Flop, betDisplay.Turn, betDisplay.River, 1);
  var avgBetRows = STREETS.filter(function(s) { return betDisplay[s] > 0; }).map(function(s) {
    return {
      street: s, val: betDisplay[s], max: maxAvg,
      valStr: fmtAvgAmount(d.betAmts[s], d.betAmtsBB ? d.betAmtsBB[s] : []),
      meta: d.betAmts[s] ? d.betAmts[s].length + ' bets' : ''
    };
  });

  var betFreqRows = STREETS.map(function(s) {
    var bo = d.betOpps[s];
    if (!bo || !bo.t) return null;
    var p = pct(bo.b, bo.t);
    return { street: s, p: p, cls: p < 25 ? 'r' : p > 65 ? 'a' : 'g', meta: bo.b + '/' + bo.t + ' opps' };
  }).filter(Boolean);

  return {
    actTotal: actTotal,
    counts: { folds: d.folds, checks: d.checks, calls: d.calls, raises: d.raises },
    split: split,
    sit: sit,
    avgBetRows: avgBetRows,
    betFreqRows: betFreqRows,
  };
}
