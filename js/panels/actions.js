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

function renderActions(container, d, hands) {
  if (!container) return;
  var streets = STREETS;
  var actTotal = d.folds + d.checks + d.calls + d.raises;
  var fPct = pct(d.folds, actTotal);
  var chPct = pct(d.checks, actTotal);
  var caPct = pct(d.calls, actTotal);
  var raPct = pct(d.raises, actTotal);

  var ctx = getGameContext(d);
  var _domSeats = ctx.seats;
  var _domFb = ctx.flopBucket;
  var _cbetBand = ctx.band('cbet');
  var _ftrBand = ctx.band('foldToRaise');

  mountPanel(container, 'actions', { title: 'Betting', desc: 'How you size your bets and choose your actions.' });
  mountFindings(container, 'Betting', d, hands, 'Betting profile looks balanced at this sample size.');

  setSlot(container, 'miniRow', renderMiniRow([
    { l: 'Total Actions', v: actTotal, c: 'o' },
    { l: 'Folds', v: d.folds, c: 'r' },
    { l: 'Checks', v: d.checks, c: 'w' },
    { l: 'Calls', v: d.calls, c: 'a' },
    { l: 'Raises', v: d.raises, c: 'g' },
  ]));

  var segs = [
    { p: fPct || 0, bg: 'bg-neg', l: 'Fold ' + fPct + '%' },
    { p: chPct || 0, bg: 'bg-muted', l: 'Check ' + chPct + '%' },
    { p: caPct || 0, bg: 'bg-warn', l: 'Call ' + caPct + '%' },
    { p: raPct || 0, bg: 'bg-pos', l: 'Raise ' + raPct + '%' },
  ];
  setSlot(container, 'actionSplitBar', segs.map(function (s) { return '<div class="bar-seg ' + s.bg + '" style="width:' + s.p + '%;"></div>'; }).join(''));
  setSlot(container, 'actionSplitLabels', segs.map(function (s) { return '<div class="text-meta row center gap-6"><div class="swatch ' + s.bg + '"></div>' + s.l + '</div>'; }).join(''));

  function sitStatColour(label, p) {
    if (p === null) return 'o';
    var fbMod = _domFb === 'HU' ? 5 : _domFb === 'multiway' ? -10 : 0;
    switch (label) {
      case 'C-Bet': {
        var hi = _cbetBand ? _cbetBand.ideal + fbMod : 60;
        var lo = _cbetBand ? _cbetBand.tight + fbMod : 40;
        return p >= hi ? 'g' : p >= lo ? 'o' : 'r';
      }
      case 'Delayed C-Bet': return p >= 30 ? 'g' : 'o';
      case 'Donk Bet': return p > 30 ? 'a' : 'o';
      case 'Fold to C-Bet': {
        var ceil = _ftrBand ? _ftrBand.loose + 15 + (_domFb === 'multiway' ? 5 : -5) : 70;
        var soft = _ftrBand ? _ftrBand.ideal + 10 : 50;
        return p > ceil ? 'r' : p > soft ? 'a' : 'g';
      }
      case 'Fold to 3-Bet': {
        var ceil3 = _domSeats <= 2 ? 55 : _domSeats <= 4 ? 60 : 70;
        var soft3 = _domSeats <= 2 ? 40 : _domSeats <= 4 ? 45 : 50;
        return p > ceil3 ? 'r' : p > soft3 ? 'a' : 'g';
      }
      case 'Fold to 4-Bet': return p > 80 ? 'a' : 'o';
      default: return 'o';
    }
  }

  var sitStats = [
    { label: 'C-Bet', done: d.cbetDone, opps: d.cbetOpps },
    { label: 'Delayed C-Bet', done: d.delayCbetDone, opps: d.delayCbetOpps },
    { label: 'Donk Bet', done: d.donkDone, opps: d.donkOpps },
    { label: 'Fold to C-Bet', done: d.foldToCbetDone, opps: d.foldToCbetOpps },
    { label: 'Fold to 3-Bet', done: d.foldTo3betDone, opps: d.foldTo3betOpps },
    { label: 'Fold to 4-Bet', done: d.foldTo4betDone, opps: d.foldTo4betOpps },
  ];

  var sitStatHtml = '';
  var sitClickable = [];
  for (var si = 0; si < sitStats.length; si++) {
    var s = sitStats[si];
    if (s.opps === 0) continue;
    var p = pct(s.done, s.opps);
    var cls = sitStatColour(s.label, p);
    var pred = _ACT_SIT_PREDICATES[s.label];
    var matches = pred ? pickHands(hands, pred, 15) : [];
    var clickIdx = sitClickable.length;
    var hasHands = matches.length > 0;
    var labelHtml = tipWrap(s.label) +
      (hasHands ? '<span class="c-dim cards-row-cue"> &middot; view hands &#8250;</span>' : '');
    var rowHtml = barRow(labelHtml, p || 0, 100, cls, (p !== null ? p + '%' : '-'), s.done + '/' + s.opps + ' spots');
    if (hasHands) {
      sitStatHtml += '<div class="cards-bar-row" data-sit-idx="' + clickIdx + '">' + rowHtml + '</div>';
      sitClickable.push({
        title: s.label + ' hands',
        hands: matches,
        note: (_ACT_SIT_NOTES[s.label] || '') +
          ' This happened in ' + s.done + ' of ' + s.opps + ' spots (' + (p !== null ? p + '%' : '-') + ').'
      });
    } else {
      sitStatHtml += rowHtml;
    }
  }
  setSlot(container, 'sitStats', sitStatHtml);

  container.querySelectorAll('[data-sit-idx]').forEach(function(row) {
    row.onclick = function() {
      var idx = parseInt(row.getAttribute('data-sit-idx'), 10);
      var entry = sitClickable[idx];
      if (entry && entry.hands.length) showExampleHandListModal(entry.title, entry.hands, entry.note);
    };
  });

  var avgBets = {};
  var avgBetsBB = {};
  streets.forEach(function(s) {
    avgBets[s] = Math.round(avg(d.betAmts[s]));
    avgBetsBB[s] = avg(d.betAmtsBB ? d.betAmtsBB[s] : []);
  });
  d.avgBetPre = avgBets.Preflop; d.avgBetFlop = avgBets.Flop;
  d.avgBetTurn = avgBets.Turn; d.avgBetRiver = avgBets.River;
  d.avgBetBBFlop = avgBetsBB.Flop; d.avgBetBBTurn = avgBetsBB.Turn; d.avgBetBBRiver = avgBetsBB.River;
  var betDisplay = {};
  streets.forEach(function(s) {
    betDisplay[s] = _displayBB && d.betAmtsBB && d.betAmtsBB[s] && d.betAmtsBB[s].length
      ? avg(d.betAmtsBB[s]) : avg(d.betAmts[s]);
  });
  var maxAvg = Math.max(betDisplay.Preflop, betDisplay.Flop, betDisplay.Turn, betDisplay.River, 1);

  setSlot(container, 'avgBetBars',
    streets.filter(function(s) { return betDisplay[s] > 0; }).map(function(s) {
      return barRow(s, betDisplay[s], maxAvg, 'o', fmtAvgAmount(d.betAmts[s], d.betAmtsBB ? d.betAmtsBB[s] : []), d.betAmts[s] ? d.betAmts[s].length + ' bets' : '');
    }).join(''));
  setSlot(container, 'betFreqBars',
    streets.map(function(s) {
      var bo = d.betOpps[s];
      if (!bo || !bo.t) return null;
      var fp2 = pct(bo.b, bo.t);
      var cls2 = fp2 < 25 ? 'r' : fp2 > 65 ? 'a' : 'g';
      return barRow(s, fp2 || 0, 100, cls2, (fp2 !== null ? fp2 + '%' : '-'), bo.b + '/' + bo.t + ' opps');
    }).filter(Boolean).join(''));
}
