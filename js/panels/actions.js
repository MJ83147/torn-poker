// ── BETTING PANEL (Actions + Bets) ───────────────────────────────────────────

function renderActions(container, d, hands) {
  var streets = ['Preflop', 'Flop', 'Turn', 'River'];
  var aggPct = calcAggression(d.raises, d.calls, d.checks);
  var actTotal = d.folds + d.checks + d.calls + d.raises;
  var fPct = pct(d.folds, actTotal);
  var chPct = pct(d.checks, actTotal);
  var caPct = pct(d.calls, actTotal);
  var raPct = pct(d.raises, actTotal);

  // ── Game-context lookups ─────────────────────────────────────────────────
  var ctx = getGameContext(d);
  var _domSeats = ctx.seats;
  var _domFb = ctx.flopBucket;
  function _scaleN(base) { return ctx.scaleN(base); }
  var _aggBand = ctx.band('af');
  var _cbetBand = ctx.band('cbet');
  var _ftrBand = ctx.band('foldToRaise');

  var actHtml = '<div class="panel-title">Betting</div>';
  actHtml += '<div class="panel-desc">How you size your bets and choose your actions.</div>';
  // Aggression mini-box dropped - the header hero strip already shows your
  // headline aggression number always.
  actHtml += '<div class="p-row">' + renderMiniRow([
    { l: 'Total Actions', v: actTotal, c: 'o' },
    { l: 'Folds', v: d.folds, c: 'r' },
    { l: 'Checks', v: d.checks, c: 'w' },
    { l: 'Calls', v: d.calls, c: 'a' },
    { l: 'Raises', v: d.raises, c: 'g' },
  ]) + '</div>';

  actHtml += '<div class="p-row">';
  var segs = [
    { p: fPct || 0, c: 'var(--red)', l: 'Fold ' + fPct + '%' },
    { p: chPct || 0, c: '#2a3a2c', l: 'Check ' + chPct + '%' },
    { p: caPct || 0, c: 'var(--amber)', l: 'Call ' + caPct + '%' },
    { p: raPct || 0, c: 'var(--green)', l: 'Raise ' + raPct + '%' },
  ];
  actHtml += '<div class="sec-subtitle">Action split</div>';
  actHtml += '<div class="stack-bar">' + segs.map(function (s) { return '<div class="stack-seg" style="width:' + s.p + '%;background:' + s.c + ';"></div>'; }).join('') + '</div>';
  actHtml += '<div class="stack-labels">' + segs.map(function (s) { return '<div class="stack-li"><div class="stack-dot" style="background:' + s.c + ';"></div>' + s.l + '</div>'; }).join('') + '</div>';

  // "By street" table dropped - the Streets panel owns action-mix-by-street
  // (it's the panel's whole job; richer stacked-bar chart there).
  actHtml += '</div>';

  // Situational stats
  actHtml += '<div class="p-row"><div class="sec-subtitle mt-0">Situational stats</div>';
  actHtml += '<div class="bar-group">';

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

  for (var si = 0; si < sitStats.length; si++) {
    var s = sitStats[si];
    if (s.opps === 0) continue;
    var p = pct(s.done, s.opps);
    var cls = sitStatColour(s.label, p);
    var labelHtml = tipWrap(s.label);
    actHtml += barRow(labelHtml, p || 0, 100, cls, (p !== null ? p + '%' : '-'), s.done + '/' + s.opps + ' spots');
  }

  actHtml += '</div></div>';

  // Insights
  var aIns = [];
  if (caPct > raPct + 20) {
    var exCallHeavy = findExampleHand(function (h) {
      var ma = getHeroActions(h);
      return ma.some(function (a) { return a.type === 'call'; }) && !ma.some(function (a) { return a.type === 'raise' || a.type === 'bet'; }) && h.outcome && h.outcome.result !== 'won';
    });
    aIns.push(insWithExample('a', 'Call-Heavy',
      'You call ' + caPct + '% of actions but raise only ' + raPct + '%.',
      [{ v: 'Call: ' + caPct + '%' }, { v: 'Raise: ' + raPct + '%' }],
      exCallHeavy,
      'This hand was called when a raise could have taken down the pot or extracted more value. Passive play lets draws get there for free.',
      'Calling lets the opponent control the pot. Raising charges draws, narrows their range, and gives you fold equity. Default to raising when you have a strong hand or a good draw.'));
  }
  var _aggLow = _aggBand ? _aggBand.tight - 3 : 15;
  var _aggHigh = _aggBand ? _aggBand.loose + 3 : 40;
  if (aggPct !== null && aggPct < _aggLow) {
    var exLowAgg = findExampleHand(function (h) {
      var ma = getHeroActions(h);
      return ma.some(function (a) { return a.type === 'call'; }) && !ma.some(function (a) { return a.type === 'raise' || a.type === 'bet'; });
    });
    aIns.push(insWithExample('r', 'Low Aggression',
      'You raise on ' + aggPct + '% of actions. Floor for your style is around ' + Math.round(_aggLow) + '%.',
      [{ v: d.raises + ' raises from ' + actTotal + ' actions' }],
      exLowAgg,
      'Only ' + aggPct + '% of actions are raises. Strong hands need to be bet for value. Checking and calling lets opponents draw cheaply and control the pot size.',
      'Strong hands need to be bet for value, not slowplayed. When you have top pair or better, default to betting. Checking strong hands gives free cards and caps your range.'));
  } else if (aggPct !== null && aggPct <= _aggHigh) {
    var exGoodAgg = findExampleHand(function (h) {
      return parseActions(h.actions).some(function (a) { return a.isMe && (a.type === 'raise' || a.type === 'bet'); });
    });
    aIns.push(insWithExample('g', 'Aggression',
      aggPct + '% raise frequency is inside the expected band for your style.',
      [{ v: d.raises + ' raises' }],
      exGoodAgg,
      'A well-timed raise like this one puts opponents on the defensive. Your aggression level is in a healthy range - enough to take initiative without overbluffing.',
      'Keep this balance. Aggression in the expected band means you take initiative without spewing chips on light bluffs.'));
  } else if (aggPct !== null) {
    var exHighAgg = findExampleHand(function (h) {
      var ma = getHeroActions(h);
      return ma.filter(function (a) { return a.type === 'raise' || a.type === 'bet'; }).length >= 2;
    });
    aIns.push(insWithExample('a', 'High Aggression',
      aggPct + '% raise frequency. Ceiling for your style is around ' + Math.round(_aggHigh) + '%.',
      [{ v: d.raises + ' raises' }],
      exHighAgg,
      'Multiple raises in this hand illustrate your aggressive tendencies. In situations where players call wide, each bluff raise is more likely to get looked up - save aggression for strong holdings.',
      'Calling stations punish bluff raises. Cut bluffs against loose-passive opponents and only bet/raise with hands that beat their calling range.'));
  }
  var _f3Min = _scaleN(3);
  if (d.faced3bet >= _f3Min) {
    var f3 = pct(d.fold3bet, d.faced3bet);
    var _f3Ceil = _domSeats <= 2 ? 55 : _domSeats <= 4 ? 60 : 70;
    if (f3 > _f3Ceil) {
      var ex3bet = findExampleHand(function (h) {
        var acts = parseActions(h.actions);
        var rc = 0;
        for (var ai = 0; ai < acts.length; ai++) {
          var a = acts[ai];
          if (!a.isMe && a.type === 'raise' && a.street === 'Preflop') rc++;
          if (a.isMe && a.street === 'Preflop' && rc >= 2 && a.type === 'fold') return true;
        }
        return false;
      });
      aIns.push(insWithExample('r', '3-Bet Response',
        'You fold to 3-bets ' + f3 + '% of the time at ' + (_domSeats || '?') + '-max. Ceiling around ' + _f3Ceil + '%.',
        [{ v: d.fold3bet + '/' + d.faced3bet + ' situations' }],
        ex3bet,
        'You folded here facing a 3-bet. Many 3-bets are light. With a decent holding, calling can be profitable given how often opponents are bluffing or semi-bluffing.',
        'Many 3-bets are light bluffs and merge raises. Defend with mid pairs, suited broadways, and suited connectors against frequent 3-bettors. 4-bet your premiums to fight back.'));
    }
  }
  // All-in insights
  var _aiMin = _scaleN(2);
  if (d.facedAllin >= _aiMin) {
    var afp = pct(d.foldAllin, d.facedAllin);
    var awp = pct(d.wonAllin, d.callAllin);
    if (afp > 75 && awp !== null && awp > 60) {
      var exAllinFold = findExampleHand(function (h) {
        var acts2 = parseActions(h.actions);
        return acts2.some(function (a) { return !a.isMe && (a.type === 'raise' || a.type === 'bet') && a.msg && a.msg.indexOf(' to ') === -1; }) && acts2.some(function (a) { return a.isMe && a.type === 'fold'; });
      });
      aIns.push(insWithExample('r', 'All-in Folds x Win Rate',
        'You fold all-ins ' + afp + '% of the time but win ' + awp + '% when you call.',
        [{ v: d.callAllin + ' calls, ' + d.wonAllin + ' won' }],
        exAllinFold,
        'You folded to an all-in here. Given your high win rate when calling (' + awp + '%), you may be folding too many hands with good equity against all-in ranges.',
        'A high win rate when you do call means your folding range contains too many hands that beat the typical all-in range. Call wider with mid pairs and broadways when stacks justify the equity.'));
    } else {
      aIns.push(ins('n', 'All-in Profile',
        'Fold rate: ' + afp + '%. Win rate when calling: ' + (awp !== null ? awp + '%' : '-') + '.',
        [{ v: d.facedAllin + ' situations' }]));
    }
  }
  // Preflop Fold Rate
  var pfFoldPct = pct(d.ss.Preflop.f, d.ss.Preflop.seen);
  if (pfFoldPct !== null) {
    var tight = pfFoldPct > 65;
    aIns.push(ins(tight ? 'a' : 'n', 'Preflop Fold Rate',
      'You fold preflop ' + pfFoldPct + '% of the hands you see.',
      [{ v: d.ss.Preflop.f + ' folds' }],
      tight
        ? 'Tight is fine, but check your late-position fold rate too. From CO and BTN you should be opening or 3-betting more, not folding marginal playable hands.'
        : 'A reasonable preflop fold rate. Keep tightening from early position and loosening from late position to maximise positional EV.'));
  }
  // Street Aggression x Win Rate
  var streetAggWins = {};
  for (var hi = 0; hi < hands.length; hi++) {
    var h2 = hands[hi];
    var acts2 = parseActions(h2.actions);
    var heroActs = acts2.filter(function (a) { return a.isMe; });
    var didRaise = {};
    heroActs.forEach(function (a) { if (a.type === 'raise' || a.type === 'bet') didRaise[a.street] = true; });
    var won2 = h2.outcome && h2.outcome.result === 'won';
    for (var sti = 0; sti < streets.length; sti++) {
      var st = streets[sti];
      if (!streetAggWins[st]) streetAggWins[st] = { aggWon: 0, aggTotal: 0, passWon: 0, passTotal: 0 };
      if (heroActs.some(function (a) { return a.street === st; })) {
        if (didRaise[st]) {
          streetAggWins[st].aggTotal++;
          if (won2) streetAggWins[st].aggWon++;
        } else {
          streetAggWins[st].passTotal++;
          if (won2) streetAggWins[st].passWon++;
        }
      }
    }
  }
  var aggVsPassInsights = streets.filter(function (st) {
    var s2 = streetAggWins[st];
    return s2 && s2.aggTotal >= 3 && s2.passTotal >= 3;
  }).map(function (st) {
    var s2 = streetAggWins[st];
    var aggWr = pct(s2.aggWon, s2.aggTotal);
    var passWr = pct(s2.passWon, s2.passTotal);
    return { street: st, aggWr: aggWr, passWr: passWr, diff: (aggWr || 0) - (passWr || 0) };
  }).filter(function (r) { return Math.abs(r.diff) > 10; });
  if (aggVsPassInsights.length > 0) {
    var best2 = aggVsPassInsights.sort(function (a, b) { return b.diff - a.diff; })[0];
    aIns.push(ins(best2.diff > 0 ? 'g' : 'a', 'Aggression x Win Rate (' + best2.street + ')', 'When you raise on the ' + best2.street.toLowerCase() + ', you win ' + best2.aggWr + '% vs ' + best2.passWr + '% when passive. ' + (best2.diff > 0 ? 'Aggression pays off here.' : 'Passive play performs better - opponents may be calling your bluffs.'), [
      { v: 'Aggressive: ' + best2.aggWr + '%', hi: best2.diff > 0 },
      { v: 'Passive: ' + best2.passWr + '%' },
    ]));
  }
  // ── Bet Sizing Section (merged from Bets panel) ──
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

  actHtml += '<div class="p-row"><div class="sec-subtitle mt-0">Bet Sizing</div><div class="two-col">';
  actHtml += '<div><div class="sec-subtitle">Average bet size by street</div><div class="bar-group">' +
    streets.filter(function(s) { return betDisplay[s] > 0; }).map(function(s) {
      return barRow(s, betDisplay[s], maxAvg, 'o', fmtAvgAmount(d.betAmts[s], d.betAmtsBB ? d.betAmtsBB[s] : []), d.betAmts[s] ? d.betAmts[s].length + ' bets' : '');
    }).join('') + '</div></div>';
  actHtml += '<div><div class="sec-subtitle">Bet frequency (when you had the option)</div><div class="bar-group">' +
    streets.map(function(s) {
      var bo = d.betOpps[s];
      if (!bo || !bo.t) return null;
      var fp2 = pct(bo.b, bo.t);
      var cls2 = fp2 < 25 ? 'r' : fp2 > 65 ? 'a' : 'g';
      return barRow(s, fp2 || 0, 100, cls2, (fp2 !== null ? fp2 + '%' : '-'), bo.b + '/' + bo.t + ' opps');
    }).filter(Boolean).join('') + '</div></div>';
  actHtml += '</div></div>';

  // Bet sizing insights
  if (d.avgBetFlop > 0) {
    var exFlopBet = findExampleHand(function(h) {
      if (!h.board || h.board.length < 3) return false;
      return parseActions(h.actions).some(function(a) { return a.isMe && a.street === 'Flop' && (a.type === 'raise' || a.type === 'bet'); });
    });
    var flopDisp = fmtAvgAmount(d.betAmts.Flop, d.betAmtsBB ? d.betAmtsBB.Flop : []);
    aIns.push(insWithExample('o', 'Flop Sizing',
      'Your average flop bet is ' + flopDisp + '.',
      [{ v: 'Avg: ' + flopDisp, hi: true }],
      exFlopBet,
      'This hand shows your typical flop bet sizing. In TC where players call wide, sizing between 60-80% of pot extracts maximum value from weaker hands chasing draws.',
      'TC players call wide. Aim for 60-80% pot on the flop to extract maximum value from weak made hands and charge draws their proper price.'));
  }
  if (d.avgBetTurn > 0) {
    var bigger = d.avgBetTurn >= d.avgBetFlop;
    var exTurnBet = findExampleHand(function(h) {
      if (!h.board || h.board.length < 4) return false;
      return parseActions(h.actions).some(function(a) { return a.isMe && a.street === 'Turn' && (a.type === 'raise' || a.type === 'bet'); });
    });
    var turnDisp = fmtAvgAmount(d.betAmts.Turn, d.betAmtsBB ? d.betAmtsBB.Turn : []);
    var flopDispT = fmtAvgAmount(d.betAmts.Flop, d.betAmtsBB ? d.betAmtsBB.Flop : []);
    aIns.push(insWithExample(bigger ? 'g' : 'a', 'Turn Sizing',
      bigger ? 'Your turn bets (' + turnDisp + ') are larger than your flop bets.' : 'Your turn bets (' + turnDisp + ') are smaller than your flop bets (' + flopDispT + ').',
      [{ v: 'Avg: ' + turnDisp, hi: true }],
      exTurnBet,
      bigger ? 'Good turn sizing here - increasing your bet as the pot grows puts maximum pressure on drawing hands and builds value.' : 'Your turn bet here was smaller than your flop bet. As the pot grows, your bets should scale up to charge opponents for chasing.',
      'Bets should scale with the pot. As the pot grows from flop to turn to river, bet sizes should grow too - same percentage of a bigger pot equals more chips, charging draws and building value.'));
  }
  if (d.avgBetRiver > 0) {
    var exRiverBet = findExampleHand(function(h) {
      if (!h.board || h.board.length < 5) return false;
      if (!h.outcome || h.outcome.result !== 'won') return false;
      return parseActions(h.actions).some(function(a) { return a.isMe && a.street === 'River' && (a.type === 'raise' || a.type === 'bet'); });
    });
    var riverDisp = fmtAvgAmount(d.betAmts.River, d.betAmtsBB ? d.betAmtsBB.River : []);
    aIns.push(insWithExample('o', 'River Sizing',
      'Your average river bet is ' + riverDisp + '.',
      [{ v: 'Avg: ' + riverDisp, hi: true }],
      exRiverBet,
      'This winning hand shows the river paying off. Size up with strong hands - TC players will call with second-best hands more often than they should.',
      'The river is where you get paid. With value hands, size up to 75-100% of pot - TC players call too wide on the end with second-best hands.'));
  }
  var fbo = d.betOpps['Flop'];
  var _flopBetMin = _scaleN(3);
  var _flopBetFloor = _cbetBand ? _cbetBand.tight + (_domFb === 'HU' ? 10 : _domFb === 'multiway' ? -10 : 0) - 5 : 30;
  if (fbo && fbo.t >= _flopBetMin && pct(fbo.b, fbo.t) < _flopBetFloor) {
    var exFlopPassive = findExampleHand(function(h) {
      if (!h.board || h.board.length < 3) return false;
      var ma2 = parseActions(h.actions).filter(function(a) { return a.isMe && a.street === 'Flop'; });
      return ma2.some(function(a) { return a.type === 'check' || a.type === 'call'; }) && !ma2.some(function(a) { return a.type === 'raise' || a.type === 'bet'; });
    });
    aIns.push(insWithExample('r', 'Flop Passivity',
      'You bet the flop only ' + pct(fbo.b, fbo.t) + '% of the time when given the option. Floor around ' + Math.round(_flopBetFloor) + '%.',
      [{ v: fbo.b + '/' + fbo.t + ' opportunities' }],
      exFlopPassive,
      'On this flop you checked or called instead of betting. Betting puts opponents on the defensive and charges draws. Set the price for your value hands.',
      'C-bet the flop the majority of the time when you raised preflop. It maintains range advantage, denies free cards, and folds out unimproved high cards.'));
  }

  // Append engine insights (rules + patterns) to legacy insights
  appendEngineInsights('actions', aIns, { limit: 6 });
  // Engine narrative (returns { narrative, ... } - guard against the object accessor)
  var actNarrative = InsightEngine.narrativeFor('actions', 6);
  if (actNarrative && actNarrative.narrative) {
    actHtml += '<div class="p-row"><div class="engine-narrative">' + actNarrative.narrative + '</div></div>';
  }
  actHtml += '<div class="p-row">' + renderInsights(aIns, 'Betting', 'Keep building data for betting pattern insights.') + '</div>';
  container.innerHTML = actHtml;
}
