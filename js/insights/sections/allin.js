(function() {
  var FOLD_HIGH = 70; // folding to more than 70% of all-ins is escapism
  var FOLD_LOW  = 30; // folding under 30% is calling too light
  var WIN_FLOOR = 35; // sub 35% win rate when calling means weak calling range

  function handHadAllIn(h) {
    if (!h || !h.actions) return false;
    var acts = parseActions(h.actions);
    for (var i = 0; i < acts.length; i++) {
      var a = acts[i];
      if (a.type !== 'raise') continue;
      if (a.msg && a.msg.indexOf(' to ') === -1) return true;
    }
    return false;
  }

  function build(d, extras, hands) {
    if (!d || !d.facedAllin || d.facedAllin < 5) return null;

    var faced = d.facedAllin;
    var folds = d.foldAllin || 0;
    var calls = d.callAllin || 0;
    var won = d.wonAllin || 0;

    var foldPct = faced > 0 ? (folds / faced) * 100 : null;
    var winPct  = calls > 0 ? (won / calls) * 100 : null;
    var allinShare = d.n > 0 ? (faced / d.n) * 100 : 0;

    var fmtFn = (typeof fmtPnl === 'function') ? fmtPnl : function(v) { return String(Math.round(v)); };

    var openingText = 'You faced ' + faced + ' all-in spots across ' + d.n + ' hands' +
      ' (' + Math.round(allinShare * 10) / 10 + '% of your hands).';
    if (foldPct != null) openingText += ' You folded ' + Math.round(foldPct) + '%';
    if (winPct  != null) openingText += ' and won ' + Math.round(winPct) + '% of the spots you called.';
    else                 openingText += '.';

    var branchTexts = [];
    var firedHigh = false;
    var firedLow = false;
    var firedWeakCall = false;

    if (foldPct != null && foldPct >= FOLD_HIGH) {
      firedHigh = true;
      branchTexts.push('Folding to ' + Math.round(foldPct) + '% of all-ins is high. Opponents who shove against you do not need a real hand to get through.');
    } else if (foldPct != null && foldPct <= FOLD_LOW) {
      firedLow = true;
      branchTexts.push('Folding to only ' + Math.round(foldPct) + '% of all-ins is light. You are calling shoves with hands that cannot beat a value shoving range.');
    }

    if (winPct != null && calls >= 5 && winPct < WIN_FLOOR) {
      firedWeakCall = true;
      branchTexts.push('When you do call shoves you win only ' + Math.round(winPct) + '%. The calling range is too wide for the spots you are in.');
    }

    var severity = 'g';
    var deltaUnits = 0;
    if (firedLow && firedWeakCall) {
      severity = 'r';
      deltaUnits = 1.4;
    } else if (firedHigh) {
      severity = 'a';
      deltaUnits = (foldPct - FOLD_HIGH) / 15;
    } else if (firedLow || firedWeakCall) {
      severity = 'a';
      deltaUnits = 0.6;
    } else {
      branchTexts.push('Your all-in posture is balanced: you fold the obvious value shoves and call the spots that should be called.');
    }

    var impactText = null;
    var soWhatText = null;
    if (firedLow && firedWeakCall) {
      impactText = 'Calling light against a shove pays the opponent. Most all-in shoves are value at most stakes, and a wide calling range eats your stack at the exact moment you can least afford it.';
      soWhatText = 'Tighten the calling range. Pairs of pocket nines and up, AK, AQ suited, and the occasional read-driven hero call. Everything else folds.';
    } else if (firedHigh) {
      impactText = 'Folding to most all-ins lets opponents shove a wider range than they should. Their bluffs work because they expect you to give up the chips you have already put in.';
      soWhatText = 'Call shoves you are getting the right price for. The math is simple: pot odds versus equity against a sensible shoving range.';
    } else if (firedWeakCall) {
      impactText = 'Your call frequency is in range but your win rate when called says the hands themselves are too thin.';
      soWhatText = 'Drop the bottom of your calling range. Pocket pairs below TT and offsuit broadway hands are usually the cuts.';
    }

    var examples = [];
    var lostCalls = pickHands(hands, function(h) { return handHadAllIn(h) && heroLost(h); }, 15);
    if (lostCalls.length) {
      examples.push({
        id: 'allin-losing',
        label: 'All-in spots you lost',
        hands: lostCalls,
        coachingNote: 'These are the all-in spots where the chips went the wrong way. Look at what you held and whether the calling threshold should be tighter.'
      });
    }
    var allAllIn = pickHands(hands, handHadAllIn, 20);
    if (allAllIn.length) {
      examples.push({
        id: 'allin-all',
        label: 'All all-in spots',
        hands: allAllIn,
        coachingNote: 'Every hand where an all-in pressure point came up. Use this set to spot the patterns in your shove/call decisions.'
      });
    }

    return {
      id: 'allin-pressure',
      name: 'All-in Pressure',
      panel: 'All-In EV',
      sectionId: 'allin',
      severity: severity,
      score: Sections.score(severity, deltaUnits),
      openingText: openingText,
      branchTexts: branchTexts,
      impactText: impactText,
      soWhatText: soWhatText,
      examples: examples,
      meta: {
        facedAllin: faced, foldAllin: folds, callAllin: calls, wonAllin: won,
        foldPct: foldPct, winPct: winPct
      }
    };
  }

  Sections.defineSection({
    id: 'allin',
    panel: 'All-In EV',
    run: function(d, extras, hands) {
      var story = build(d, extras, hands);
      return story ? [story] : [];
    }
  });
})();
