(function() {
  var F = Sections.section('allin', 'All-In EV');
  var FOLD_HIGH = 70; // folding to more than 70% of all-ins is escapism
  var FOLD_LOW  = 30; // folding under 30% is calling too light
  var WIN_FLOOR = 35; // sub 35% win rate when calling means weak calling range

  function handHadAllIn(h) {
    if (!h || !h.actions) return false;
    var acts = parseActions(h.actions);
    for (var i = 0; i < acts.length; i++) {
      if (isAllInAction(acts, i)) return true;
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
      branchTexts.push('When you call shoves you win ' + Math.round(winPct) + '% of the time, across ' + calls + ' calls. Some of that is variance, but a number this low usually means the calling range is too wide for the spots you are in.');
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
      impactText = 'Calling light against a shove pays the opponent. At most stakes a shove is a value hand more often than a bluff, so a wide calling range costs you your stack at the worst possible moment.';
      soWhatText = 'Tighten the calling range. Pocket nines and up, AK, and AQ suited, plus the occasional call when you have a read. Everything else folds.';
    } else if (firedHigh) {
      impactText = 'Folding to most all-ins lets opponents shove a wider range than they should. Their bluffs work because they expect you to give up the chips you have already put in.';
      soWhatText = 'Call the shoves you are getting the right price for. Compare your pot odds against your equity versus a sensible shoving range, and call when the equity is there.';
    } else if (firedWeakCall) {
      impactText = 'Your call frequency is reasonable, but how often you win when you call suggests the hands themselves are too thin.';
      soWhatText = 'Drop the bottom of your calling range. Pocket pairs below tens and offsuit broadway hands are usually the first to cut.';
    }

    var examples = [];
    var lostCalls = pickHands(hands, function(h) { return handHadAllIn(h) && heroLost(h); }, 15);
    if (lostCalls.length) {
      examples.push({
        id: 'allin-losing',
        label: 'All-in spots you lost',
        hands: lostCalls,
        coachingNote: 'These are the all-in spots where the chips went the wrong way. Look at what you held and whether you should be calling lighter or tighter.'
      });
    }
    var allAllIn = pickHands(hands, handHadAllIn, 20);
    if (allAllIn.length) {
      examples.push({
        id: 'allin-all',
        label: 'Every all-in spot',
        hands: allAllIn,
        coachingNote: 'Every hand where an all-in came up. Use this set to spot the patterns in your shove and call decisions.'
      });
    }
    if (!examples.length) {
      var anyPlayed = pickHands(hands, heroPlayed, 20);
      if (anyPlayed.length) {
        examples.push({
          id: 'allin-played',
          label: 'Hands you played',
          hands: anyPlayed,
          coachingNote: 'A sample of hands you played. Watch how you handle the spots where the stacks get deep and a shove is on the table.'
        });
      }
    }

    return F({
      id: 'allin-pressure',
      name: 'All-in Pressure',
      severity: severity,
      magnitude: deltaUnits,
      openingText: openingText,
      branchTexts: branchTexts,
      impactText: impactText,
      soWhatText: soWhatText,
      examples: examples,
      meta: {
        facedAllin: faced, foldAllin: folds, callAllin: calls, wonAllin: won,
        foldPct: foldPct, winPct: winPct
      }
    });
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
