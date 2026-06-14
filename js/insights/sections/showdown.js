(function() {
  var F = Sections.section('showdown', 'Showdown');
  var SHOWDOWN_BAND = { tight: 24, loose: 30 };    // WTSD target.
  var WSD_BAND = { tight: 50, loose: 60 };          // Won-at-showdown target.
  var MIN_AGG = MIN_AGGREGATE;
  var MIN_AX = MIN_AXIS;

  function handIsShowdown(h) {
    return !!isShowdown(h);
  }

  function wonShowdown(h) {
    return h && h.outcome && h.outcome.result === 'won';
  }

  function buildGoingToShowdown(d, extras, hands) {
    if (!d || !d.n || d.n < MIN_AGG) return null;
    if (!d.sawFlop || d.sawFlop < 10) return null;

    var wtsd = (d.wentToShowdown / d.sawFlop) * 100;
    if (!isFinite(wtsd)) return null;

    var sev = Sections.classify(wtsd, SHOWDOWN_BAND, null);
    if (!sev) return null;

    var sdPnl = 0, sdCount = 0, nsdPnl = 0, nsdCount = 0;
    if (hands) {
      for (var i = 0; i < hands.length; i++) {
        var h = hands[i];
        if (!h || !h.outcome) continue;
        var pnl = getHandPnlValue(h);
        if (handIsShowdown(h)) { sdPnl += pnl; sdCount++; }
        else { nsdPnl += pnl; nsdCount++; }
      }
    }

    var openingText = 'You see ' + Math.round(wtsd) + '% of flops go to showdown across ' +
      d.sawFlop + ' flopped hands. Net P&L across ' + sdCount + ' showdowns is ' + fmtPnl(sdPnl) + '.';

    var branchTexts = [];

    if (sev.severity === 'r' || sev.severity === 'a') {
      var dirWord = sev.direction === 'high' ? 'above' : 'below';
      branchTexts.push(
        'WTSD is ' + Math.round(wtsd) + '%, ' + dirWord + ' the ' +
        Sections.fmtBand(SHOWDOWN_BAND) + ' target.'
      );
    }

    var posReads = [];
    if (d.byPosition) {
      for (var pi = 0; pi < POSITION_ORDER.length; pi++) {
        var p = POSITION_ORDER[pi];
        var pd = d.byPosition[p];
        if (!pd || pd.gated || !pd.sawFlop || pd.sawFlop < 10) continue;
        var pv = (pd.wentToShowdown / pd.sawFlop) * 100;
        if (!isFinite(pv)) continue;
        var psev = Sections.classify(pv, SHOWDOWN_BAND, null);
        if (!psev) continue;
        posReads.push({ position: p, n: pd.n, sawFlop: pd.sawFlop, wtsd: pv, sev: psev });
      }
    }

    var offPositions = posReads.filter(function(r) {
      return r.sev.severity === 'r' || r.sev.severity === 'a';
    });
    var highs = offPositions.filter(function(r) { return r.sev.direction === 'high'; })
      .sort(function(a, b) { return b.sev.deltaUnits - a.sev.deltaUnits; });
    var lows = offPositions.filter(function(r) { return r.sev.direction === 'low'; })
      .sort(function(a, b) { return b.sev.deltaUnits - a.sev.deltaUnits; });

    if (highs.length >= 1) {
      var hlbl = joinList(highs.slice(0, 3).map(function(r) {
        return r.position + ' (' + Math.round(r.wtsd) + '%)';
      }));
      branchTexts.push('You reach showdown often from ' + hlbl + ', above the target band.');
    }
    if (lows.length >= 1) {
      var llbl = joinList(lows.slice(0, 3).map(function(r) {
        return r.position + ' (' + Math.round(r.wtsd) + '%)';
      }));
      branchTexts.push('You fold before showdown often from ' + llbl + ', below the target band.');
    }
    if (!highs.length && !lows.length && posReads.length) {
      branchTexts.push('Per-position WTSD reads in-band across the seats with sample.');
    }

    var impactText = null;
    var soWhatText = null;
    var sdPerHand = sdCount > 0 ? sdPnl / sdCount : 0;
    var nsdPerHand = nsdCount > 0 ? nsdPnl / nsdCount : 0;

    if (sev.severity === 'r' || sev.severity === 'a') {
      if (sev.direction === 'high') {
        if (sdPerHand < nsdPerHand) {
          impactText = 'You reach showdown more often than the band, and the hands you take there return less per hand than the hands you fold earlier. You are paying to see hands that the math says fold.';
          soWhatText = 'Fold more rivers and turns with marginal holdings. Tighten the continuation criteria when the bet sizing says you are beat.';
        } else {
          impactText = 'You reach showdown more often than the band, but the showdowns themselves hold up. Worth watching as sample grows; the cost has not landed yet.';
          soWhatText = 'Keep an eye on river call-downs. If WSD stays healthy this is a non-issue, but the volume above target is the warning flag.';
        }
      } else {
        if (sdPerHand > 0 && sdPerHand > nsdPerHand) {
          impactText = 'You reach showdown less often than the band, and the showdowns you do reach are profitable. You are folding rivers that would have won.';
          soWhatText = 'Call more rivers in the spots you are currently folding. The showdowns you reach already profit, which means more would too.';
        } else {
          impactText = 'You are folding before showdown often. The discipline reads tight but the resulting non-showdown line is not picking up the slack.';
          soWhatText = 'Review the river folds against the action that preceded them. Some are probably winning hands you let go.';
        }
      }
    } else if (sdPerHand < 0 && sdCount >= 25) {
      impactText = 'Your showdown frequency is in band but the showdowns themselves are losing. The selection is right; the hands you arrive with are wrong.';
      soWhatText = 'Tighten the range you take to showdown. The frequency is fine; the hand strength at the river needs to improve.';
    }

    var examples = [];
    if (hands) {
      var sdHands = pickHands(hands, function(h) { return handIsShowdown(h); }, 15);
      if (sdHands.length) {
        examples.push({
          id: 'showdown-going-sd',
          label: 'Hands you took to showdown',
          hands: sdHands,
          coachingNote: 'Showdowns you have reached recently. Look at the turn and river action: are you arriving with hands strong enough to call the bets being made, or are you paying off value?'
        });
      }
    }

    var severity = sev.severity;
    var fired = branchTexts.length > 0 || severity === 'r' || severity === 'a' || impactText != null;
    if (!fired) return null;

    return F({
      id: 'showdown-going',
      name: 'Going to Showdown',
      severity: severity,
      magnitude: sev.deltaUnits,
      openingText: openingText,
      branchTexts: branchTexts,
      impactText: impactText,
      soWhatText: soWhatText,
      examples: examples,
      meta: {
        wtsd: wtsd,
        band: SHOWDOWN_BAND,
        sdPnl: sdPnl, sdCount: sdCount,
        nsdPnl: nsdPnl, nsdCount: nsdCount,
        posReads: posReads
      }
    });
  }

  function buildWinningAtShowdown(d, extras, hands) {
    if (!d || !d.n || d.n < MIN_AGG) return null;
    if (!hands || !hands.length) return null;

    var sdCount = 0, sdWon = 0, sdPnl = 0;
    var perPos = {};
    for (var i = 0; i < hands.length; i++) {
      var h = hands[i];
      if (!h || !h.outcome) continue;
      if (!handIsShowdown(h)) continue;
      sdCount++;
      var won = wonShowdown(h);
      if (won) sdWon++;
      sdPnl += getHandPnlValue(h);
      var pos = h.position || null;
      if (pos) {
        if (!perPos[pos]) perPos[pos] = { sd: 0, won: 0, pnl: 0 };
        perPos[pos].sd++;
        if (won) perPos[pos].won++;
        perPos[pos].pnl += getHandPnlValue(h);
      }
    }

    if (sdCount < 10) return null;
    var wsd = (sdWon / sdCount) * 100;

    var sev = Sections.classify(wsd, WSD_BAND, null);
    if (!sev) return null;

    var openingText = 'When you reach showdown you win ' + Math.round(wsd) + '% of the time. ' +
      'Across ' + sdCount + ' showdowns, net showdown P&L is ' + fmtPnl(sdPnl) + '.';

    var branchTexts = [];

    if (sev.severity === 'r' || sev.severity === 'a') {
      var dirWord = sev.direction === 'high' ? 'above' : 'below';
      branchTexts.push(
        'WSD is ' + Math.round(wsd) + '%, ' + dirWord + ' the ' +
        Sections.fmtBand(WSD_BAND) + ' target.'
      );
    }

    var posRows = [];
    for (var p in perPos) {
      var r = perPos[p];
      if (!r || r.sd < 10) continue;
      posRows.push({ position: p, sd: r.sd, won: r.won, wsd: (r.won / r.sd) * 100, pnl: r.pnl });
    }
    posRows.sort(function(a, b) { return b.wsd - a.wsd; });

    if (posRows.length >= 2) {
      var best = posRows[0];
      var worst = posRows[posRows.length - 1];
      if (best.wsd - worst.wsd >= 15) {
        branchTexts.push(
          'Your best showdown seat is ' + best.position + ' (' + Math.round(best.wsd) + '% won across ' + best.sd + ' showdowns), ' +
          'and the worst is ' + worst.position + ' (' + Math.round(worst.wsd) + '% across ' + worst.sd + ').'
        );
      }
    }

    var impactText = null;
    var soWhatText = null;
    if (sev.severity === 'r' || sev.severity === 'a') {
      if (sev.direction === 'low') {
        impactText = 'WSD below the band means you are arriving at the river with second-best hands more often than not. The river-calling range is too wide for the bets being made.';
        soWhatText = 'Cut marginal hands from your river-calling range. Second pair gets there only when opponents are bluffing; for now they are mostly value-betting.';
      } else {
        impactText = 'WSD above the band sounds great, but combined with a thin WTSD it usually means you only get to showdown with the nuts and fold every borderline river. Some of those river folds were winners.';
        soWhatText = 'Widen the river continuation in spots you currently fold. You are showing down only monsters; lower the threshold and the WSD will normalise without giving up profit.';
      }
    } else if (sdPnl < 0 && sdCount >= 25) {
      impactText = 'WSD reads in-band but the showdowns are net negative. The pots you lose at showdown are bigger than the ones you win.';
      soWhatText = 'Review the largest losing showdowns. The pattern is usually paying off value on the river with one-pair hands you should have folded.';
    }

    var examples = [];
    var sdLost = pickHands(hands, function(h) {
      return handIsShowdown(h) && !wonShowdown(h);
    }, 15);
    if (sdLost.length) {
      examples.push({
        id: 'showdown-winning-lost',
        label: 'Showdowns you lost',
        hands: sdLost,
        coachingNote: 'Showdowns that did not go your way. Check the river bet sizing and your hand strength at the river. Most leaks here are calls with second pair or worse against value-betting ranges.'
      });
    }

    var severity = sev.severity;
    var fired = branchTexts.length > 0 || severity === 'r' || severity === 'a' || impactText != null;
    if (!fired) return null;

    return F({
      id: 'showdown-winning',
      name: 'Winning at Showdown',
      severity: severity,
      magnitude: sev.deltaUnits,
      openingText: openingText,
      branchTexts: branchTexts,
      impactText: impactText,
      soWhatText: soWhatText,
      examples: examples,
      meta: {
        wsd: wsd, sdCount: sdCount, sdWon: sdWon, sdPnl: sdPnl,
        band: WSD_BAND, posRows: posRows
      }
    });
  }

  function buildShowdownSplit(d, extras, hands) {
    if (!d || !d.n || d.n < MIN_AGG) return null;
    if (!hands || !hands.length) return null;

    var sdPnl = 0, sdCount = 0, nsdPnl = 0, nsdCount = 0;
    for (var i = 0; i < hands.length; i++) {
      var h = hands[i];
      if (!h || !h.outcome) continue;
      var pnl = getHandPnlValue(h);
      if (handIsShowdown(h)) { sdPnl += pnl; sdCount++; }
      else { nsdPnl += pnl; nsdCount++; }
    }

    if (sdCount + nsdCount < MIN_AGG) return null;

    var totalPnl = sdPnl + nsdPnl;
    var openingText = 'Your winnings split: ' + fmtPnl(sdPnl) + ' from hands that reached showdown, ' +
      fmtPnl(nsdPnl) + ' from hands won without showdown. Total: ' + fmtPnl(totalPnl) + '.';

    var branchTexts = [];
    var severity = 'g';
    var impactText = null;
    var soWhatText = null;

    var sdNeg = sdPnl < 0;
    var nsdNeg = nsdPnl < 0;
    var sdPos = sdPnl > 0;
    var nsdPos = nsdPnl > 0;

    if (sdPos && nsdPos) {
      severity = 'g';
      branchTexts.push('Both lines profit. You win when you show down and you win when you do not.');
      impactText = 'This is the structural shape of a profitable player. Both income streams are working.';
      soWhatText = 'Keep playing. Watch for either line drifting negative as the sample grows.';
    } else if (sdNeg && nsdNeg) {
      severity = 'r';
      branchTexts.push('Both lines are losing. Showdowns down ' + fmtPnl(sdPnl) + ', non-showdowns down ' + fmtPnl(nsdPnl) + '.');
      impactText = 'The leak is not in one area, it is across the game. Both the bets that should fold opponents and the showdowns you call down are net negative.';
      soWhatText = 'Use the position, range, and cards sections to find which combinations of seat and street are doing the damage. The diagnosis here is not specific enough on its own.';
    } else if (sdNeg && nsdPos) {
      severity = 'r';
      branchTexts.push('Your showdown line loses ' + fmtPnl(sdPnl) + '. Your non-showdown winnings of ' + fmtPnl(nsdPnl) + ' are carrying the result.');
      impactText = 'You make money when opponents fold but lose money when they do not. The bluffs work; the value hands do not extract, or the river call-downs are too wide.';
      soWhatText = 'Tighten what you take to showdown when you are not the aggressor. Hero-calls are leaking; bluff-catching frequency is wider than opponents are bluffing.';
    } else if (nsdNeg && sdPos) {
      severity = 'r';
      branchTexts.push('Your non-showdown line loses ' + fmtPnl(nsdPnl) + '. Your showdown winnings of ' + fmtPnl(sdPnl) + ' are carrying the result.');
      impactText = 'Hands you do not get to showdown on are costing money. You are betting and being called or raised off pots without seeing the river.';
      soWhatText = 'Fewer c-bets and barrels in spots where opponents are calling. Pick bluff spots where folds are likely: dry boards, heads up, in position.';
    } else {
      severity = 'n';
      branchTexts.push('One line is near flat. Read the showdown and non-showdown stats above to see which is driving total P&L.');
    }

    var examples = [];
    if (sdNeg) {
      var sdLosses = pickHands(hands, function(h) {
        return handIsShowdown(h) && !wonShowdown(h);
      }, 12);
      if (sdLosses.length) {
        examples.push({
          id: 'showdown-split-sd-losses',
          label: 'Showdown losses',
          hands: sdLosses,
          coachingNote: 'Hands you took to the river and lost. The fix is usually narrower river calls and tighter showdown ranges against value-betting opponents.'
        });
      }
    }
    if (nsdNeg) {
      var nsdLosses = pickHands(hands, function(h) {
        return !handIsShowdown(h) && h && h.outcome && h.outcome.result !== 'won';
      }, 12);
      if (nsdLosses.length) {
        examples.push({
          id: 'showdown-split-nsd-losses',
          label: 'Non-showdown losses',
          hands: nsdLosses,
          coachingNote: 'Hands you lost without reaching showdown. Look for the pattern: are these c-bets that got called, barrels that got raised, or hands where you invested then folded the river?'
        });
      }
    }

    var fired = severity === 'r' || severity === 'g' || branchTexts.length > 0;
    if (!fired) return null;

    return F({
      id: 'showdown-split',
      name: 'Showdown vs Non-Showdown Winnings',
      severity: severity,
      magnitude: 0,
      openingText: openingText,
      branchTexts: branchTexts,
      impactText: impactText,
      soWhatText: soWhatText,
      examples: examples,
      meta: {
        sdPnl: sdPnl, sdCount: sdCount,
        nsdPnl: nsdPnl, nsdCount: nsdCount,
        totalPnl: totalPnl
      }
    });
  }

  Sections.defineSection({
    id: 'showdown',
    panel: 'Showdown',
    run: function(d, extras, hands) {
      var out = [];
      var g = buildGoingToShowdown(d, extras, hands);
      if (g) out.push(g);
      var w = buildWinningAtShowdown(d, extras, hands);
      if (w) out.push(w);
      var s = buildShowdownSplit(d, extras, hands);
      if (s) out.push(s);
      return out;
    }
  });
})();
