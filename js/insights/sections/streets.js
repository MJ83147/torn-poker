(function() {
  var F = Sections.section('streets', 'Street');
  var MIN_AGG = (typeof MIN_AGGREGATE === 'number') ? MIN_AGGREGATE : 30;
  var MIN_CL = (typeof MIN_CELL === 'number') ? MIN_CELL : 10;
  var MIN_OPP = 12; // floor for any opp-count gate on a pillar

  var FOLD_TO_CBET_BAND = { tight: 40, loose: 55 };
  var THREE_BET_BAND = { tight: 6, loose: 12 };
  var FOLD_TO_THREE_BET_BAND = { tight: 60, loose: 70 };

  function sumHandPnl(hands, predicate) {
    if (!hands || !hands.length) return { pnl: 0, count: 0 };
    var pnl = 0, count = 0;
    for (var i = 0; i < hands.length; i++) {
      var h = hands[i];
      if (!h || !h.outcome) continue;
      if (predicate && !predicate(h)) continue;
      pnl += getHandPnlValue(h);
      count++;
    }
    return { pnl: pnl, count: count };
  }

  function actionContext(h) {
    if (!h || !h.actions) return null;
    var acts = parseActions(h.actions);
    if (!acts.length) return null;
    var ctx = {
      heroOpened: false,
      heroFaced3bet: false,
      heroFolded3bet: false,
      raiserBeforeHero: false,
      heroFirstFlop: null,
      heroFirstTurn: null,
      flopReached: false,
      turnReached: false,
      pfrIsHero: null
    };
    var preRaiseLevel = 0;
    var seenHeroFirstPre = false;
    var heroFirstPreSeenLevel = 0;
    for (var i = 0; i < acts.length; i++) {
      var a = acts[i];
      if (a.street === 'Flop') ctx.flopReached = true;
      if (a.street === 'Turn') ctx.turnReached = true;
      if (a.street === 'Preflop' && a.type === 'raise') {
        preRaiseLevel++;
        if (preRaiseLevel === 1) ctx.pfrIsHero = !!a.isMe;
        if (a.isMe && preRaiseLevel === 1) ctx.heroOpened = true;
      }
      if (a.street === 'Preflop' && a.isMe && a.type !== 'sb' && a.type !== 'bb' && !seenHeroFirstPre) {
        seenHeroFirstPre = true;
        heroFirstPreSeenLevel = preRaiseLevel;
      }
      if (ctx.heroOpened && !a.isMe && a.type === 'raise' && a.street === 'Preflop' && preRaiseLevel >= 2) {
        ctx.heroFaced3bet = true;
      }
      if (ctx.heroFaced3bet && a.isMe && a.street === 'Preflop' && a.type === 'fold') {
        ctx.heroFolded3bet = true;
      }
      if (a.isMe && a.street === 'Flop' && !ctx.heroFirstFlop && a.type !== 'sb' && a.type !== 'bb') {
        ctx.heroFirstFlop = a.type;
      }
      if (a.isMe && a.street === 'Turn' && !ctx.heroFirstTurn && a.type !== 'sb' && a.type !== 'bb') {
        ctx.heroFirstTurn = a.type;
      }
    }
    return ctx;
  }

  function heroCheckFoldedFlop(h) {
    if (!h || !h.actions) return false;
    var acts = parseActions(h.actions);
    var sawCheck = false;
    for (var i = 0; i < acts.length; i++) {
      var a = acts[i];
      if (!a.isMe || a.street !== 'Flop') continue;
      if (!sawCheck) {
        if (a.type === 'check') sawCheck = true;
        else return false;
      } else if (a.type === 'fold') {
        return true;
      }
    }
    return false;
  }

  function heroDonkedFlop(h) {
    var c = actionContext(h);
    if (!c || !c.flopReached || c.pfrIsHero !== false) return false;
    return c.heroFirstFlop === 'bet' || c.heroFirstFlop === 'raise';
  }

  function heroDelayCbet(h) {
    var c = actionContext(h);
    if (!c || c.pfrIsHero !== true) return false;
    if (!c.flopReached || c.heroFirstFlop !== 'check') return false;
    if (!c.turnReached) return false;
    return c.heroFirstTurn === 'bet' || c.heroFirstTurn === 'raise';
  }

  function heroCbet(h) {
    var c = actionContext(h);
    if (!c || c.pfrIsHero !== true || !c.flopReached) return false;
    return c.heroFirstFlop === 'bet' || c.heroFirstFlop === 'raise';
  }

  function heroFacedCbet(h) {
    if (!h || !h.actions) return false;
    var acts = parseActions(h.actions);
    var pfrAuthor = null, pfrIsHero = null;
    var heroResp = null;
    var firstFlopBetByPfr = false;
    for (var i = 0; i < acts.length; i++) {
      var a = acts[i];
      if (a.street === 'Preflop' && a.type === 'raise' && pfrAuthor == null) {
        pfrAuthor = a.author;
        pfrIsHero = !!a.isMe;
      }
      if (a.street === 'Flop' && (a.type === 'bet' || a.type === 'raise') && a.author === pfrAuthor && !firstFlopBetByPfr) {
        firstFlopBetByPfr = true;
        continue;
      }
      if (firstFlopBetByPfr && a.street === 'Flop' && a.isMe && (a.type === 'fold' || a.type === 'call' || a.type === 'raise')) {
        heroResp = a.type;
        break;
      }
    }
    return pfrIsHero === false && firstFlopBetByPfr && heroResp !== null;
  }

  function heroFoldedToCbet(h) {
    if (!h || !h.actions) return false;
    var acts = parseActions(h.actions);
    var pfrAuthor = null, pfrIsHero = null;
    var firstFlopBetByPfr = false;
    for (var i = 0; i < acts.length; i++) {
      var a = acts[i];
      if (a.street === 'Preflop' && a.type === 'raise' && pfrAuthor == null) {
        pfrAuthor = a.author;
        pfrIsHero = !!a.isMe;
      }
      if (a.street === 'Flop' && (a.type === 'bet' || a.type === 'raise') && a.author === pfrAuthor && !firstFlopBetByPfr) {
        firstFlopBetByPfr = true;
        continue;
      }
      if (firstFlopBetByPfr && a.street === 'Flop' && a.isMe && (a.type === 'fold' || a.type === 'call' || a.type === 'raise')) {
        return pfrIsHero === false && a.type === 'fold';
      }
    }
    return false;
  }

  function perPositionFrequency(d, doneKey, oppsKey, band, minOpps) {
    if (!d || !d.byPosition) return [];
    var rows = [];
    var floor = minOpps != null ? minOpps : MIN_OPP;
    for (var pi = 0; pi < POSITION_ORDER.length; pi++) {
      var p = POSITION_ORDER[pi];
      var pd = d.byPosition[p];
      if (!pd || pd.gated) continue;
      var opps = pd[oppsKey] || 0;
      if (opps < floor) continue;
      var done = pd[doneKey] || 0;
      var freq = (done / opps) * 100;
      if (!isFinite(freq)) continue;
      var sev = band ? Sections.classify(freq, band, null) : null;
      rows.push({ position: p, n: pd.n, opps: opps, done: done, freq: freq, sev: sev });
    }
    return rows;
  }

  function pushBandBranches(branchTexts, posReads, band, label) {
    var offs = posReads.filter(function(r) {
      return r.sev && (r.sev.severity === 'r' || r.sev.severity === 'a');
    });
    var highs = offs.filter(function(r) { return r.sev.direction === 'high'; })
      .sort(function(a, b) { return b.sev.deltaUnits - a.sev.deltaUnits; });
    var lows = offs.filter(function(r) { return r.sev.direction === 'low'; })
      .sort(function(a, b) { return b.sev.deltaUnits - a.sev.deltaUnits; });
    if (highs.length) {
      var hlbl = joinList(highs.slice(0, 3).map(function(r) {
        return r.position + ' (' + Math.round(r.freq) + '%)';
      }));
      branchTexts.push('You ' + label + ' often from ' + hlbl + ', above the ' + Sections.fmtBand(band) + ' target.');
    }
    if (lows.length) {
      var llbl = joinList(lows.slice(0, 3).map(function(r) {
        return r.position + ' (' + Math.round(r.freq) + '%)';
      }));
      branchTexts.push('You ' + label + ' rarely from ' + llbl + ', below the ' + Sections.fmtBand(band) + ' target.');
    }
    return { highs: highs, lows: lows };
  }

  function buildCbet(d, extras, hands) {
    if (!d || !d.n || d.n < MIN_AGG) return null;
    var opps = d.cbetOpps || 0;
    if (opps < MIN_OPP) return null;
    var freq = (d.cbetDone / opps) * 100;
    if (!isFinite(freq)) return null;

    var seats = dominantSeats(d);
    var domPos = (typeof dominantPosition === 'function') ? dominantPosition(d) : null;
    var band = (seats && domPos && typeof TargetBands !== 'undefined')
      ? TargetBands.bandFor('cbet', domPos, seats)
      : null;
    var sev = band ? Sections.classify(freq, band, null) : { severity: 'n', direction: 'mid', deltaUnits: 0 };

    var openingText = 'You c-bet ' + Math.round(freq) + '% of flops when you had the lead preflop, across ' + opps + ' opportunities.';

    var branchTexts = [];
    if (band && (sev.severity === 'r' || sev.severity === 'a')) {
      var dirWord = sev.direction === 'high' ? 'above' : 'below';
      branchTexts.push('C-bet sits ' + Math.round(freq) + '%, ' + dirWord + ' the ' + Sections.fmtBand(band) + ' target for ' + domPos + ' at ' + seats + '-handed.');
    }

    var posReads = perPositionFrequency(d, 'cbetDone', 'cbetOpps', band, MIN_OPP);
    var grouped = pushBandBranches(branchTexts, posReads, band, 'c-bet');

    var pnlCbet = sumHandPnl(hands, function(h) { return heroCbet(h); });
    var pnlGiveUp = sumHandPnl(hands, function(h) {
      var c = actionContext(h);
      return c && c.pfrIsHero === true && c.flopReached && c.heroFirstFlop === 'check';
    });
    var per = function(s) { return s.count > 0 ? s.pnl / s.count : null; };

    if (pnlCbet.count >= MIN_CL || pnlGiveUp.count >= MIN_CL) {
      var cBetPP = per(pnlCbet), giveUpPP = per(pnlGiveUp);
      var line = 'When you c-bet, net P&L is ' + fmtPnl(pnlCbet.pnl) + ' across ' + pnlCbet.count + ' hands';
      if (pnlGiveUp.count >= MIN_CL) {
        line += '. When you check back instead, it is ' + fmtPnl(pnlGiveUp.pnl) + ' across ' + pnlGiveUp.count + ' hands.';
      } else {
        line += '.';
      }
      branchTexts.push(line);
    }

    var impactText = null;
    var soWhatText = null;
    if (sev.severity === 'r' || sev.severity === 'a') {
      if (sev.direction === 'high') {
        impactText = 'Firing the flop every time you held the lead means opponents stop folding. Floats and raises turn what should be free pots into committed losers.';
        soWhatText = 'Cut c-bets on boards that miss your opening range, especially multiway. Bet for value and protection, check when the board hits the caller harder.';
      } else {
        impactText = 'Giving up too often hands free cards to weak holdings that would have folded. You are leaving the equity edge of being PFR on the table.';
        soWhatText = 'C-bet more on dry boards heads up. Range-bet small when in position and the texture connects with your opening range.';
      }
    } else if (pnlCbet.count >= MIN_CL && pnlCbet.pnl < 0) {
      impactText = 'C-bet frequency reads in band but the line is losing money. The bets themselves are not picking up the right pots.';
      soWhatText = 'Look at the boards you are c-betting. The frequency is fine; the texture selection or sizing is off.';
    }

    var fired = branchTexts.length > 0 || sev.severity === 'r' || sev.severity === 'a' || impactText != null;
    if (!fired) return null;

    var examples = [];
    if (hands) {
      var cbetHands = pickHands(hands, function(h) { return heroCbet(h); }, 12);
      if (cbetHands.length) {
        examples.push({
          id: 'streets-cbet-fired',
          label: 'Hands where you c-bet',
          hands: cbetHands,
          coachingNote: 'Flops where you took the c-bet line. Look at the board texture and the response. The lines that get called or raised on wet multiway boards are the leak; the lines that fold opponents on dry heads-up boards are the edge.'
        });
      }
      var giveUpHands = pickHands(hands, function(h) {
        var c = actionContext(h);
        return c && c.pfrIsHero === true && c.flopReached && c.heroFirstFlop === 'check';
      }, 12);
      if (giveUpHands.length) {
        examples.push({
          id: 'streets-cbet-skipped',
          label: 'Flops you checked back as PFR',
          hands: giveUpHands,
          coachingNote: 'Flops where you had the lead and gave up. Some of these are correct, but on dry heads-up boards the c-bet is usually the higher-EV play.'
        });
      }
    }

    var severity = sev.severity || 'n';
    return F({
      id: 'streets-cbet',
      name: 'C-Bet',
      severity: severity,
      magnitude: sev.deltaUnits || 0,
      openingText: openingText,
      branchTexts: branchTexts,
      impactText: impactText,
      soWhatText: soWhatText,
      examples: examples,
      meta: { freq: freq, opps: opps, band: band, seats: seats, position: domPos, posReads: posReads, grouped: grouped, pnlCbet: pnlCbet, pnlGiveUp: pnlGiveUp }
    });
  }

  function buildFoldToCbet(d, extras, hands) {
    if (!d || !d.n || d.n < MIN_AGG) return null;
    var opps = d.foldToCbetOpps || 0;
    if (opps < MIN_OPP) return null;
    var freq = (d.foldToCbetDone / opps) * 100;
    if (!isFinite(freq)) return null;

    var band = FOLD_TO_CBET_BAND;
    var sev = Sections.classify(freq, band, null) || { severity: 'n', direction: 'mid', deltaUnits: 0 };

    var openingText = 'When opponents c-bet the flop into you, you fold ' + Math.round(freq) + '% of the time, across ' + opps + ' spots.';

    var branchTexts = [];
    if (sev.severity === 'r' || sev.severity === 'a') {
      var dirWord = sev.direction === 'high' ? 'above' : 'below';
      branchTexts.push('Fold-to-c-bet is ' + Math.round(freq) + '%, ' + dirWord + ' the ' + Sections.fmtBand(band) + ' target.');
    }

    var posReads = perPositionFrequency(d, 'foldToCbetDone', 'foldToCbetOpps', band, MIN_OPP);
    pushBandBranches(branchTexts, posReads, band, 'fold to flop c-bets');

    var pnlContinue = sumHandPnl(hands, function(h) { return heroFacedCbet(h) && !heroFoldedToCbet(h); });
    var pnlFold = sumHandPnl(hands, function(h) { return heroFoldedToCbet(h); });
    if (pnlContinue.count >= MIN_CL || pnlFold.count >= MIN_CL) {
      var line = 'When you fold to a c-bet, net P&L is ' + fmtPnl(pnlFold.pnl) + ' across ' + pnlFold.count + ' hands';
      if (pnlContinue.count >= MIN_CL) {
        line += '. When you continue, it is ' + fmtPnl(pnlContinue.pnl) + ' across ' + pnlContinue.count + ' hands.';
      } else {
        line += '.';
      }
      branchTexts.push(line);
    }

    var impactText = null;
    var soWhatText = null;
    if (sev.severity === 'r' || sev.severity === 'a') {
      if (sev.direction === 'high') {
        impactText = 'Folding too often to flop bets pays the c-bettor regardless of what they hold. Aware opponents widen their c-bet range to print money against you.';
        soWhatText = 'Continue more on flops with backdoors, gutshots, or a pair, especially heads up in position. You do not need to win every flop call to make it profitable.';
      } else {
        impactText = 'Calling too many flop c-bets bloats pots with weak holdings. Most of those calls cap your range and lose to turn pressure.';
        soWhatText = 'Tighten the flop call range on boards that smash the c-bettor. Keep pair plus backdoor, fold the dry overcards.';
      }
    } else if (pnlContinue.count >= MIN_CL && pnlContinue.pnl < 0) {
      impactText = 'Fold-to-c-bet rate is in band but the hands you continue are losing money on later streets.';
      soWhatText = 'Review the turns and rivers in the continue group. Continuing is correct; the leak is what you do once the next card lands.';
    }

    var fired = branchTexts.length > 0 || sev.severity === 'r' || sev.severity === 'a' || impactText != null;
    if (!fired) return null;

    var examples = [];
    if (hands) {
      var foldedHands = pickHands(hands, function(h) { return heroFoldedToCbet(h); }, 12);
      if (foldedHands.length) {
        examples.push({
          id: 'streets-ftcb-folded',
          label: 'Flops you folded to a c-bet',
          hands: foldedHands,
          coachingNote: 'Spots where you faced a flop c-bet and gave up. Some are correct folds; others are pairs or strong backdoors that should continue at least one street.'
        });
      }
      var continued = pickHands(hands, function(h) { return heroFacedCbet(h) && !heroFoldedToCbet(h); }, 12);
      if (continued.length) {
        examples.push({
          id: 'streets-ftcb-continued',
          label: 'Flops you continued against a c-bet',
          hands: continued,
          coachingNote: 'Hands where you took the c-bet on. Look at the turn and river action: are you arriving with enough equity to call the second barrel, or folding away your flop investment?'
        });
      }
    }

    var severity = sev.severity || 'n';
    return F({
      id: 'streets-fold-to-cbet',
      name: 'Fold to C-Bet',
      severity: severity,
      magnitude: sev.deltaUnits || 0,
      openingText: openingText,
      branchTexts: branchTexts,
      impactText: impactText,
      soWhatText: soWhatText,
      examples: examples,
      meta: { freq: freq, opps: opps, band: band, posReads: posReads, pnlFold: pnlFold, pnlContinue: pnlContinue }
    });
  }

  function compute3BetCounts(hands) {
    var totalOpps = 0, totalDone = 0;
    var perPos = {};
    for (var i = 0; i < hands.length; i++) {
      var h = hands[i];
      if (!h || !h.actions) continue;
      var acts = parseActions(h.actions);
      var sawOpen = false;
      var heroRespAfterOpen = null;
      var heroResp3bet = false;
      for (var k = 0; k < acts.length; k++) {
        var a = acts[k];
        if (a.street !== 'Preflop') break;
        if (a.type === 'sb' || a.type === 'bb') continue;
        if (!sawOpen) {
          if (a.type === 'raise' && !a.isMe) {
            sawOpen = true;
          }
          continue;
        }
        if (a.isMe && heroRespAfterOpen === null) {
          heroRespAfterOpen = a.type;
          if (a.type === 'raise') heroResp3bet = true;
          break;
        }
      }
      if (!sawOpen || heroRespAfterOpen === null) continue;
      totalOpps++;
      if (heroResp3bet) totalDone++;
      var pos = h.position || null;
      if (pos) {
        if (!perPos[pos]) perPos[pos] = { opps: 0, done: 0 };
        perPos[pos].opps++;
        if (heroResp3bet) perPos[pos].done++;
      }
    }
    return { opps: totalOpps, done: totalDone, perPos: perPos };
  }

  function buildThreeBet(d, extras, hands) {
    if (!d || !d.n || d.n < MIN_AGG) return null;
    if (!hands || !hands.length) return null;
    var counts = compute3BetCounts(hands);
    if (counts.opps < MIN_OPP) return null;
    var freq = (counts.done / counts.opps) * 100;
    if (!isFinite(freq)) return null;

    var band = THREE_BET_BAND;
    var sev = Sections.classify(freq, band, null) || { severity: 'n', direction: 'mid', deltaUnits: 0 };

    var openingText = 'You 3-bet ' + Math.round(freq) + '% of the time when an opponent opened ahead of you, across ' + counts.opps + ' opportunities.';
    var branchTexts = [];

    if (sev.severity === 'r' || sev.severity === 'a') {
      var dirWord = sev.direction === 'high' ? 'above' : 'below';
      branchTexts.push('3-bet rate is ' + Math.round(freq) + '%, ' + dirWord + ' the ' + Sections.fmtBand(band) + ' target.');
    }

    var posReads = [];
    for (var pi = 0; pi < POSITION_ORDER.length; pi++) {
      var p = POSITION_ORDER[pi];
      var pc = counts.perPos[p];
      if (!pc || pc.opps < MIN_OPP) continue;
      var pf = (pc.done / pc.opps) * 100;
      if (!isFinite(pf)) continue;
      var psev = Sections.classify(pf, band, null);
      if (!psev) continue;
      posReads.push({ position: p, freq: pf, opps: pc.opps, done: pc.done, sev: psev });
    }
    pushBandBranches(branchTexts, posReads, band, '3-bet');

    var pnl3 = sumHandPnl(hands, function(h) {
      var acts = parseActions(h.actions || []);
      var sawOpen = false;
      for (var k = 0; k < acts.length; k++) {
        var a = acts[k];
        if (a.street !== 'Preflop') return false;
        if (a.type === 'sb' || a.type === 'bb') continue;
        if (!sawOpen && a.type === 'raise' && !a.isMe) { sawOpen = true; continue; }
        if (sawOpen && a.isMe) return a.type === 'raise';
      }
      return false;
    });
    var pnlFlat = sumHandPnl(hands, function(h) {
      var acts = parseActions(h.actions || []);
      var sawOpen = false;
      for (var k = 0; k < acts.length; k++) {
        var a = acts[k];
        if (a.street !== 'Preflop') return false;
        if (a.type === 'sb' || a.type === 'bb') continue;
        if (!sawOpen && a.type === 'raise' && !a.isMe) { sawOpen = true; continue; }
        if (sawOpen && a.isMe) return a.type === 'call';
      }
      return false;
    });
    if (pnl3.count >= MIN_CL || pnlFlat.count >= MIN_CL) {
      var line = '3-bet hands return ' + fmtPnl(pnl3.pnl) + ' across ' + pnl3.count;
      if (pnlFlat.count >= MIN_CL) {
        line += '; flat hands return ' + fmtPnl(pnlFlat.pnl) + ' across ' + pnlFlat.count + '.';
      } else {
        line += '.';
      }
      branchTexts.push(line);
    }

    var impactText = null;
    var soWhatText = null;
    if (sev.severity === 'r' || sev.severity === 'a') {
      if (sev.direction === 'high') {
        impactText = '3-betting too often bloats pots with hands that play poorly against tight 4-bet ranges. Opponents start calling wider and pulling you into hard postflop spots.';
        soWhatText = 'Tighten your 3-bet range against early-position opens. Reserve light 3-bets for late-position opens where the opener folds the most.';
      } else {
        impactText = 'Flatting opens when you should be 3-betting hands oversea opponents who flat behind and lets blinds defend cheaply. Initiative is being surrendered.';
        soWhatText = '3-bet more from the blinds and the button against late-position opens. Add suited blockers and a thicker value range.';
      }
    } else if (pnl3.count >= MIN_CL && pnl3.pnl < 0) {
      impactText = '3-bet frequency is in band but the line is losing. The hands you 3-bet are running into trouble postflop or against 4-bets.';
      soWhatText = 'Review the 3-bet hands. Selection looks fine in volume; the postflop execution after a called 3-bet needs work.';
    }

    var fired = branchTexts.length > 0 || sev.severity === 'r' || sev.severity === 'a' || impactText != null;
    if (!fired) return null;

    var examples = [];
    if (hands) {
      var threeBet = pickHands(hands, function(h) {
        var acts = parseActions(h.actions || []);
        var sawOpen = false;
        for (var k = 0; k < acts.length; k++) {
          var a = acts[k];
          if (a.street !== 'Preflop') return false;
          if (a.type === 'sb' || a.type === 'bb') continue;
          if (!sawOpen && a.type === 'raise' && !a.isMe) { sawOpen = true; continue; }
          if (sawOpen && a.isMe) return a.type === 'raise';
        }
        return false;
      }, 12);
      if (threeBet.length) {
        examples.push({
          id: 'streets-3bet-fired',
          label: 'Hands where you 3-bet',
          hands: threeBet,
          coachingNote: 'Spots where you took the 3-bet line. Watch the hands that get flatted out of position: those are usually where the line bleeds back to the opener.'
        });
      }
    }

    var severity = sev.severity || 'n';
    return F({
      id: 'streets-three-bet',
      name: '3-Bet',
      severity: severity,
      magnitude: sev.deltaUnits || 0,
      openingText: openingText,
      branchTexts: branchTexts,
      impactText: impactText,
      soWhatText: soWhatText,
      examples: examples,
      meta: { freq: freq, opps: counts.opps, done: counts.done, band: band, posReads: posReads, pnl3: pnl3, pnlFlat: pnlFlat }
    });
  }

  function buildFoldToThreeBet(d, extras, hands) {
    if (!d || !d.n || d.n < MIN_AGG) return null;
    var opps = d.foldTo3betOpps || 0;
    if (opps < MIN_OPP) return null;
    var freq = (d.foldTo3betDone / opps) * 100;
    if (!isFinite(freq)) return null;

    var band = FOLD_TO_THREE_BET_BAND;
    var sev = Sections.classify(freq, band, null) || { severity: 'n', direction: 'mid', deltaUnits: 0 };

    var openingText = 'When you open and an opponent 3-bets, you fold ' + Math.round(freq) + '% of the time, across ' + opps + ' spots.';
    var branchTexts = [];

    if (sev.severity === 'r' || sev.severity === 'a') {
      var dirWord = sev.direction === 'high' ? 'above' : 'below';
      branchTexts.push('Fold-to-3-bet is ' + Math.round(freq) + '%, ' + dirWord + ' the ' + Sections.fmtBand(band) + ' target.');
    }

    var posReads = perPositionFrequency(d, 'foldTo3betDone', 'foldTo3betOpps', band, MIN_OPP);
    pushBandBranches(branchTexts, posReads, band, 'fold to 3-bets');

    var pnlFold = sumHandPnl(hands, function(h) {
      var c = actionContext(h);
      return c && c.heroFaced3bet && c.heroFolded3bet;
    });
    var pnlCont = sumHandPnl(hands, function(h) {
      var c = actionContext(h);
      return c && c.heroFaced3bet && !c.heroFolded3bet;
    });
    if (pnlFold.count >= MIN_CL || pnlCont.count >= MIN_CL) {
      var line = 'Folding to a 3-bet costs the open: ' + fmtPnl(pnlFold.pnl) + ' across ' + pnlFold.count + ' hands';
      if (pnlCont.count >= MIN_CL) {
        line += '. Continuing returns ' + fmtPnl(pnlCont.pnl) + ' across ' + pnlCont.count + ' hands.';
      } else {
        line += '.';
      }
      branchTexts.push(line);
    }

    var impactText = null;
    var soWhatText = null;
    if (sev.severity === 'r' || sev.severity === 'a') {
      if (sev.direction === 'high') {
        impactText = 'Folding to almost every 3-bet teaches opponents the open is weak. They reraise wider until the open itself stops paying.';
        soWhatText = 'Defend more 3-bets in position with suited broadways and pairs. 4-bet pairs JJ+ and AKs for value, mix in occasional light 4-bets vs late-position 3-bettors.';
      } else {
        impactText = 'Calling too many 3-bets out of position with marginal hands puts you in bloated pots with no initiative.';
        soWhatText = 'Tighten the call range vs 3-bets out of position. Either 4-bet for value or fold the suited connectors that flop weak postflop.';
      }
    } else if (pnlCont.count >= MIN_CL && pnlCont.pnl < 0) {
      impactText = 'Fold-to-3-bet is in band but the continues are losing. The hands you keep are underperforming in the 3-bet pot.';
      soWhatText = 'Check the continues for combos that play poorly out of position. Some of these probably should have folded.';
    }

    var fired = branchTexts.length > 0 || sev.severity === 'r' || sev.severity === 'a' || impactText != null;
    if (!fired) return null;

    var examples = [];
    if (hands) {
      var foldedHands = pickHands(hands, function(h) {
        var c = actionContext(h);
        return c && c.heroFaced3bet && c.heroFolded3bet;
      }, 12);
      if (foldedHands.length) {
        examples.push({
          id: 'streets-ft3-folded',
          label: 'Opens you folded to a 3-bet',
          hands: foldedHands,
          coachingNote: 'Opens you gave up on when 3-bet. Look for the suited broadways and pairs in this list, they are usually defends.'
        });
      }
    }

    var severity = sev.severity || 'n';
    return F({
      id: 'streets-fold-to-three-bet',
      name: 'Fold to 3-Bet',
      severity: severity,
      magnitude: sev.deltaUnits || 0,
      openingText: openingText,
      branchTexts: branchTexts,
      impactText: impactText,
      soWhatText: soWhatText,
      examples: examples,
      meta: { freq: freq, opps: opps, band: band, posReads: posReads, pnlFold: pnlFold, pnlCont: pnlCont }
    });
  }

  function buildCheckFold(d, extras, hands) {
    if (!d || !d.n || d.n < MIN_AGG) return null;
    if (!d.ss || !d.ss.Flop || !d.ss.Flop.seen || d.ss.Flop.seen < MIN_OPP) return null;
    if (!hands || !hands.length) return null;

    var seen = d.ss.Flop.seen;
    var checkFoldCount = 0;
    var checkFoldHands = [];
    for (var i = 0; i < hands.length; i++) {
      if (heroCheckFoldedFlop(hands[i])) {
        checkFoldCount++;
        if (checkFoldHands.length < 200) checkFoldHands.push(hands[i]);
      }
    }
    if (checkFoldCount < MIN_OPP) return null;
    var freq = (checkFoldCount / seen) * 100;
    if (!isFinite(freq)) return null;

    var openingText = 'On flops you saw, you check-folded ' + Math.round(freq) + '% (' + checkFoldCount + ' of ' + seen + ').';
    var branchTexts = [];

    var posRows = [];
    if (d.byPosition) {
      for (var pi = 0; pi < POSITION_ORDER.length; pi++) {
        var p = POSITION_ORDER[pi];
        var pd = d.byPosition[p];
        if (!pd || pd.gated || !pd.ss || !pd.ss.Flop.seen || pd.ss.Flop.seen < MIN_OPP) continue;
        var posCheckFold = 0;
        for (var hi = 0; hi < hands.length; hi++) {
          if ((hands[hi].position || '?') === p && heroCheckFoldedFlop(hands[hi])) posCheckFold++;
        }
        if (posCheckFold < MIN_CL) continue;
        var pf = (posCheckFold / pd.ss.Flop.seen) * 100;
        posRows.push({ position: p, freq: pf, seen: pd.ss.Flop.seen, count: posCheckFold });
      }
    }
    posRows.sort(function(a, b) { return b.freq - a.freq; });
    if (posRows.length >= 2) {
      var top = posRows[0];
      var bottom = posRows[posRows.length - 1];
      if (top.freq - bottom.freq >= 15) {
        branchTexts.push('You check-fold ' + Math.round(top.freq) + '% of flops from ' + top.position + ' and ' + Math.round(bottom.freq) + '% from ' + bottom.position + '.');
      }
    }

    var pnlCF = sumHandPnl(hands, function(h) { return heroCheckFoldedFlop(h); });
    if (pnlCF.count >= MIN_CL) {
      branchTexts.push('Net P&L on the check-fold flops is ' + fmtPnl(pnlCF.pnl) + ' across ' + pnlCF.count + ' hands.');
    }

    var severity = 'n';
    if (freq >= 55) severity = 'a';
    if (freq >= 70) severity = 'r';

    var impactText = null;
    var soWhatText = null;
    if (severity === 'r' || severity === 'a') {
      impactText = 'Checking and folding the flop most of the time tells opponents your range is capped. They c-bet wider, barrel more, and steal the pot whenever you check.';
      soWhatText = 'Mix in flop check-raises with strong draws and pair plus equity. Lead some flops out of position to break the pattern.';
    }

    if (!branchTexts.length && severity === 'n') return null;

    var examples = [];
    var cf = pickHands(hands, function(h) { return heroCheckFoldedFlop(h); }, 12);
    if (cf.length) {
      examples.push({
        id: 'streets-cf-flop',
        label: 'Flops you checked and folded',
        hands: cf,
        coachingNote: 'Flops where you checked your option and folded to a bet. Some are fine; the leak is folding pair plus equity or strong backdoors that should at least call.'
      });
    }

    return F({
      id: 'streets-check-fold',
      name: 'Check-Fold',
      severity: severity,
      magnitude: 0,
      openingText: openingText,
      branchTexts: branchTexts,
      impactText: impactText,
      soWhatText: soWhatText,
      examples: examples,
      meta: { freq: freq, count: checkFoldCount, seen: seen, posRows: posRows, pnlCF: pnlCF }
    });
  }

  function buildDonk(d, extras, hands) {
    if (!d || !d.n || d.n < MIN_AGG) return null;
    var opps = d.donkOpps || 0;
    if (opps < MIN_OPP) return null;
    var freq = (d.donkDone / opps) * 100;
    if (!isFinite(freq)) return null;

    var openingText = 'You donk into the preflop raiser on ' + Math.round(freq) + '% of flops where you had the option, across ' + opps + ' spots.';
    var branchTexts = [];

    var posReads = perPositionFrequency(d, 'donkDone', 'donkOpps', null, MIN_OPP);
    var heavy = posReads.filter(function(r) { return r.freq >= 25; })
      .sort(function(a, b) { return b.freq - a.freq; });
    if (heavy.length) {
      var lbl = joinList(heavy.slice(0, 3).map(function(r) {
        return r.position + ' (' + Math.round(r.freq) + '%)';
      }));
      branchTexts.push('Donk rate is heaviest from ' + lbl + '.');
    }

    var pnlDonk = sumHandPnl(hands, function(h) { return heroDonkedFlop(h); });
    var pnlCheck = sumHandPnl(hands, function(h) {
      var c = actionContext(h);
      return c && c.flopReached && c.pfrIsHero === false && c.heroFirstFlop === 'check';
    });
    if (pnlDonk.count >= MIN_CL || pnlCheck.count >= MIN_CL) {
      var line = 'Donk hands return ' + fmtPnl(pnlDonk.pnl) + ' across ' + pnlDonk.count;
      if (pnlCheck.count >= MIN_CL) {
        line += '; checking to the raiser returns ' + fmtPnl(pnlCheck.pnl) + ' across ' + pnlCheck.count + '.';
      } else {
        line += '.';
      }
      branchTexts.push(line);
    }

    var severity = 'n';
    var perDonk = pnlDonk.count > 0 ? pnlDonk.pnl / pnlDonk.count : 0;
    if (freq >= 25 && perDonk < 0) severity = 'a';
    if (freq >= 40 && perDonk < 0) severity = 'r';
    if (freq >= 15 && perDonk > 0 && pnlDonk.count >= MIN_CL) severity = 'g';

    var impactText = null;
    var soWhatText = null;
    if (severity === 'r' || severity === 'a') {
      impactText = 'Donking too often telegraphs strength on boards that connect with the caller, which is exactly when the raiser would have checked back. Opponents fold, then exploit the spots you do check.';
      soWhatText = 'Cut donks back to boards that drastically miss the raiser. Most flops play better with a check, especially heads up in position.';
    } else if (severity === 'g') {
      impactText = 'Donking is paying off on boards that favour the calling range. The bets get folds from the raiser, or they pay off when called.';
      soWhatText = 'Keep the spots you already donk. Watch for opponents adjusting; the moment they start raising back, contract the range.';
    }

    if (!branchTexts.length && severity === 'n') return null;

    var examples = [];
    if (hands) {
      var donkHands = pickHands(hands, function(h) { return heroDonkedFlop(h); }, 12);
      if (donkHands.length) {
        examples.push({
          id: 'streets-donk-fired',
          label: 'Hands where you donked the flop',
          hands: donkHands,
          coachingNote: 'Spots where you bet into the preflop raiser on the flop. Look at the board: donks usually only profit on textures that miss the raiser entirely.'
        });
      }
    }

    return F({
      id: 'streets-donk',
      name: 'Donk Bet',
      severity: severity,
      magnitude: 0,
      openingText: openingText,
      branchTexts: branchTexts,
      impactText: impactText,
      soWhatText: soWhatText,
      examples: examples,
      meta: { freq: freq, opps: opps, posReads: posReads, pnlDonk: pnlDonk, pnlCheck: pnlCheck }
    });
  }

  function buildDelayCbet(d, extras, hands) {
    if (!d || !d.n || d.n < MIN_AGG) return null;
    var opps = d.delayCbetOpps || 0;
    if (opps < MIN_OPP) return null;
    var freq = (d.delayCbetDone / opps) * 100;
    if (!isFinite(freq)) return null;

    var openingText = 'When you check back the flop as PFR, you delay c-bet the turn ' + Math.round(freq) + '% of the time, across ' + opps + ' spots.';
    var branchTexts = [];

    var posReads = perPositionFrequency(d, 'delayCbetDone', 'delayCbetOpps', null, MIN_OPP);
    var heavy = posReads.filter(function(r) { return r.freq >= 40; })
      .sort(function(a, b) { return b.freq - a.freq; });
    if (heavy.length) {
      var lbl = joinList(heavy.slice(0, 3).map(function(r) {
        return r.position + ' (' + Math.round(r.freq) + '%)';
      }));
      branchTexts.push('Delay c-bet rate is heaviest from ' + lbl + '.');
    }

    var pnlDelay = sumHandPnl(hands, function(h) { return heroDelayCbet(h); });
    var pnlGiveUp = sumHandPnl(hands, function(h) {
      var c = actionContext(h);
      return c && c.pfrIsHero === true && c.heroFirstFlop === 'check' && c.turnReached && c.heroFirstTurn === 'check';
    });
    if (pnlDelay.count >= MIN_CL || pnlGiveUp.count >= MIN_CL) {
      var line = 'Delay c-bet lines return ' + fmtPnl(pnlDelay.pnl) + ' across ' + pnlDelay.count;
      if (pnlGiveUp.count >= MIN_CL) {
        line += '; double-check lines return ' + fmtPnl(pnlGiveUp.pnl) + ' across ' + pnlGiveUp.count + '.';
      } else {
        line += '.';
      }
      branchTexts.push(line);
    }

    var severity = 'n';
    var perDelay = pnlDelay.count > 0 ? pnlDelay.pnl / pnlDelay.count : 0;
    if (freq < 20 && pnlGiveUp.count >= MIN_CL && pnlGiveUp.pnl < 0) severity = 'a';
    if (freq >= 50 && perDelay < 0) severity = 'a';
    if (freq >= 20 && perDelay > 0 && pnlDelay.count >= MIN_CL) severity = 'g';

    var impactText = null;
    var soWhatText = null;
    if (severity === 'a' || severity === 'r') {
      if (freq < 20) {
        impactText = 'Almost never firing the turn after checking back the flop hands opponents free showdowns when their range is capped.';
        soWhatText = 'Take the delay c-bet more often when the turn improves your range or scares the caller. Picking up the pot uncontested is the entire reason to check back the flop.';
      } else {
        impactText = 'Delay c-betting most turns burns chips when opponents have already paired or floated. The check-back gave them the chance to define their range; they did.';
        soWhatText = 'Pick the turns that genuinely scare the caller. Static turns that fix nothing usually play better as a double-check.';
      }
    } else if (severity === 'g') {
      impactText = 'Delay c-bets are landing in profitable spots. The check-flop-then-bet-turn pattern picks up pots where the caller cannot continue.';
      soWhatText = 'Keep the line. Watch for opponents float-calling the turn lighter; the moment that starts, the delay c-bet stops printing.';
    }

    if (!branchTexts.length && severity === 'n') return null;

    var examples = [];
    if (hands) {
      var delayHands = pickHands(hands, function(h) { return heroDelayCbet(h); }, 12);
      if (delayHands.length) {
        examples.push({
          id: 'streets-delay-fired',
          label: 'Hands where you delay c-bet',
          hands: delayHands,
          coachingNote: 'Turns you fired after checking back the flop. The strongest spots have a turn card that improves your range or directly threatens the caller.'
        });
      }
    }

    return F({
      id: 'streets-delay-cbet',
      name: 'Delay C-Bet',
      severity: severity,
      magnitude: 0,
      openingText: openingText,
      branchTexts: branchTexts,
      impactText: impactText,
      soWhatText: soWhatText,
      examples: examples,
      meta: { freq: freq, opps: opps, posReads: posReads, pnlDelay: pnlDelay, pnlGiveUp: pnlGiveUp }
    });
  }

  Sections.defineSection({
    id: 'streets',
    panel: 'Street',
    run: function(d, extras, hands) {
      var out = [];
      var s;
      s = buildCbet(d, extras, hands);            if (s) out.push(s);
      s = buildFoldToCbet(d, extras, hands);      if (s) out.push(s);
      s = buildThreeBet(d, extras, hands);        if (s) out.push(s);
      s = buildFoldToThreeBet(d, extras, hands);  if (s) out.push(s);
      s = buildCheckFold(d, extras, hands);       if (s) out.push(s);
      s = buildDonk(d, extras, hands);            if (s) out.push(s);
      s = buildDelayCbet(d, extras, hands);       if (s) out.push(s);
      return out;
    }
  });
})();
