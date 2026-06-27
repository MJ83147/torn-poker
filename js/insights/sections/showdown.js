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

    var openingText = 'Your WTSD is ' + Math.round(wtsd) + '%: that share of your ' +
      d.sawFlop + ' flopped hands reached showdown.';
    if (sdCount > 0) {
      openingText += ' Net P&L across those ' + sdCount + ' showdowns is ' + fmtPnl(sdPnl) + '.';
    }

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
          impactText = 'WTSD of ' + Math.round(wtsd) + '% is above the ' + Sections.fmtBand(SHOWDOWN_BAND) + ' target, and the hands you take to showdown return less per hand than the hands you fold earlier. You are paying to see rivers you should be folding.';
          soWhatText = 'Fold more turns and rivers with marginal holdings. Give up the hands where the bet sizing says you are beat.';
        } else {
          impactText = 'WTSD of ' + Math.round(wtsd) + '% is above the ' + Sections.fmtBand(SHOWDOWN_BAND) + ' target, but the showdowns are still profitable per hand. The high frequency is the thing to watch: if the win rate at showdown slips, this volume starts costing money.';
          soWhatText = 'Keep an eye on your river call-downs. The showdowns pay for now, but reaching them this often leaves little room if the hands get weaker.';
        }
      } else {
        if (sdPerHand > 0 && sdPerHand > nsdPerHand) {
          impactText = 'WTSD of ' + Math.round(wtsd) + '% is below the ' + Sections.fmtBand(SHOWDOWN_BAND) + ' target, and the showdowns you do reach are profitable. You are folding rivers that would have won.';
          soWhatText = 'Call more rivers in the spots you currently fold. The showdowns you reach already profit, so more of them would too.';
        } else {
          impactText = 'WTSD of ' + Math.round(wtsd) + '% is below the ' + Sections.fmtBand(SHOWDOWN_BAND) + ' target. The folding reads disciplined, but the hands you win without showdown are not making up for it.';
          soWhatText = 'Review your river folds against the action that came before them. Some are probably winning hands you let go.';
        }
      }
    } else if (sdPerHand < 0 && sdCount >= 25) {
      impactText = 'WTSD of ' + Math.round(wtsd) + '% sits in the ' + Sections.fmtBand(SHOWDOWN_BAND) + ' target, but the showdowns themselves are losing. How often you show down is right; the hands you arrive with are not.';
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
          coachingNote: 'Showdowns you reached recently. Look at the turn and river action: are you arriving with hands strong enough to call the bets being made, or are you paying off value?'
        });
      }
      var foldedHands = pickHands(hands, function(h) {
        return h && !handIsShowdown(h) && heroLost(h);
      }, 12);
      if (foldedHands.length) {
        examples.push({
          id: 'showdown-going-folded',
          label: 'Hands you folded before showdown',
          hands: foldedHands,
          coachingNote: 'Hands you gave up before the river. Check whether any of these were ahead when you folded.'
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

    var openingText = 'Your W$SD is ' + Math.round(wsd) + '%: you win that share of the showdowns you reach. ' +
      'Across ' + sdCount + ' showdowns, net showdown P&L is ' + fmtPnl(sdPnl) + '.';

    var branchTexts = [];

    if (sev.severity === 'r' || sev.severity === 'a') {
      var dirWord = sev.direction === 'high' ? 'above' : 'below';
      branchTexts.push(
        'W$SD is ' + Math.round(wsd) + '%, ' + dirWord + ' the ' +
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
        impactText = 'W$SD of ' + Math.round(wsd) + '% is below the ' + Sections.fmtBand(WSD_BAND) + ' target, which means you arrive at the river with the second-best hand more often than not. Your river-calling range is too wide for the bets being made.';
        soWhatText = 'Cut marginal hands from your river-calling range. Second pair only wins when opponents are bluffing, and right now they are mostly value-betting.';
      } else {
        impactText = 'W$SD of ' + Math.round(wsd) + '% is above the ' + Sections.fmtBand(WSD_BAND) + ' target. Winning most showdowns sounds good, but a number this high usually means you only show down very strong hands and fold every borderline river. Some of those river folds were winners.';
        soWhatText = 'Call more rivers in the spots you currently fold. You are showing down only your strongest hands; widen the calling range and W$SD settles into the target without giving up profit.';
      }
    } else if (sdPnl < 0 && sdCount >= 25) {
      impactText = 'W$SD of ' + Math.round(wsd) + '% sits in the ' + Sections.fmtBand(WSD_BAND) + ' target, but the showdowns are net negative at ' + fmtPnl(sdPnl) + '. The pots you lose at showdown are bigger than the ones you win.';
      soWhatText = 'Review your largest losing showdowns. The pattern is usually paying off value on the river with one-pair hands you should have folded.';
    }

    var examples = [];
    var sdLost = pickHands(hands, function(h) {
      return handIsShowdown(h) && heroLost(h);
    }, 15);
    if (sdLost.length) {
      examples.push({
        id: 'showdown-winning-lost',
        label: 'Showdowns you lost',
        hands: sdLost,
        coachingNote: 'Showdowns that did not go your way. Check the river bet sizing and your hand strength at the river. Most leaks here are calls with second pair or worse against value-betting ranges.'
      });
    }
    var sdWonHands = pickHands(hands, function(h) {
      return handIsShowdown(h) && wonShowdown(h);
    }, 12);
    if (sdWonHands.length) {
      examples.push({
        id: 'showdown-winning-won',
        label: 'Showdowns you won',
        hands: sdWonHands,
        coachingNote: 'Showdowns you took down. Note the hand strength you needed to win, then compare it against the showdowns you lost.'
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
    var openingText = 'Your P&L splits two ways: ' + fmtPnl(sdPnl) + ' from hands that reached showdown across ' + sdCount + ' showdowns, and ' +
      fmtPnl(nsdPnl) + ' from hands that ended without showdown across ' + nsdCount + ' hands. Total: ' + fmtPnl(totalPnl) + '.';

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
      branchTexts.push('Both lines are losing. Showdowns are at ' + fmtPnl(sdPnl) + ', non-showdowns at ' + fmtPnl(nsdPnl) + '.');
      impactText = 'The leak is not in one area, it is across the game. Both the bets that should fold opponents and the showdowns you call down are net negative.';
      soWhatText = 'Use the position, range, and cards sections to find which combinations of seat and street are doing the damage. The diagnosis here is not specific enough on its own.';
    } else if (sdNeg && nsdPos) {
      severity = 'r';
      branchTexts.push('Your showdown line is at ' + fmtPnl(sdPnl) + '. Your non-showdown line of ' + fmtPnl(nsdPnl) + ' is carrying the result.');
      impactText = 'You make money when opponents fold but lose money when they do not. Either the value hands do not extract, or the river call-downs are too wide.';
      soWhatText = 'Tighten what you take to showdown when you are not the aggressor. You are calling rivers more often than opponents are bluffing.';
    } else if (nsdNeg && sdPos) {
      severity = 'r';
      branchTexts.push('Your non-showdown line is at ' + fmtPnl(nsdPnl) + '. Your showdown line of ' + fmtPnl(sdPnl) + ' is carrying the result.');
      impactText = 'Hands you do not get to showdown on are costing money. You are betting and being called or raised off pots without seeing the river.';
      soWhatText = 'Fewer c-bets and barrels in spots where opponents are calling. Pick bluff spots where folds are likely: dry boards, heads up, in position.';
    } else {
      severity = 'n';
      branchTexts.push('One line is near flat. Read the showdown and non-showdown stats above to see which is driving total P&L.');
    }

    var examples = [];
    if (sdNeg) {
      var sdLosses = pickHands(hands, function(h) {
        return handIsShowdown(h) && heroLost(h);
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
        return h && !handIsShowdown(h) && heroLost(h);
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
    if (!examples.length) {
      var splitHands = pickHands(hands, function(h) { return handIsShowdown(h); }, 12);
      if (splitHands.length) {
        examples.push({
          id: 'showdown-split-sd',
          label: 'Hands you took to showdown',
          hands: splitHands,
          coachingNote: 'A recent sample of the showdowns behind your showdown P&L.'
        });
      }
      var splitNsdWins = pickHands(hands, function(h) {
        return h && !handIsShowdown(h) && wonShowdown(h);
      }, 12);
      if (splitNsdWins.length) {
        examples.push({
          id: 'showdown-split-nsd-wins',
          label: 'Pots won without showdown',
          hands: splitNsdWins,
          coachingNote: 'A recent sample of the pots you took down without a showdown.'
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
