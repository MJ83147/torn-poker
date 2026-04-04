// ── ACTIONS PANEL ─────────────────────────────────────────────────────────────

function renderActions(container, d, hands) {
  var streets = ['Preflop', 'Flop', 'Turn', 'River'];
  var aggPct = pct(d.raises, d.totalActs);
  var actTotal = d.folds + d.checks + d.calls + d.raises;
  var fPct = pct(d.folds, actTotal);
  var chPct = pct(d.checks, actTotal);
  var caPct = pct(d.calls, actTotal);
  var raPct = pct(d.raises, actTotal);

  var actHtml = '<div class="panel-title">Actions</div>';
  actHtml += '<div class="panel-desc">Fold, check, call, and raise frequencies.</div>';
  actHtml += '<div class="p-row">' + renderMiniRow([
    { l: 'Total Actions', v: actTotal, c: 'o' },
    { l: 'Folds', v: d.folds, c: 'r' },
    { l: 'Checks', v: d.checks, c: 'w' },
    { l: 'Calls', v: d.calls, c: 'a' },
    { l: 'Raises', v: d.raises, c: 'g' },
    { l: 'Aggression', v: aggPct !== null ? aggPct + '%' : '—', c: aggPct > 25 ? 'g' : 'a' },
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

  actHtml += '<div class="sec-subtitle">By street</div><div class="overflow-x"><table class="tbl"><thead><tr><th>Street</th><th>' + tipWrap('Fold') + '</th><th>' + tipWrap('Check') + '</th><th>' + tipWrap('Call') + '</th><th>' + tipWrap('Raise') + '</th><th>' + tipWrap('Aggression') + '</th></tr></thead><tbody>';
  actHtml += streets.map(function (s) {
    var ss2 = d.ss[s];
    var tot2 = ss2.f + ss2.ch + ss2.ca + ss2.ra;
    var ap = pct(ss2.ra, tot2);
    return '<tr><td>' + tipWrap(s) + '</td><td>' + ss2.f + '</td><td>' + ss2.ch + '</td><td>' + ss2.ca + '</td><td>' + ss2.ra + '</td><td>' + (ap !== null ? ap + '%' : '—') + '</td></tr>';
  }).join('');
  actHtml += '</tbody></table></div></div>';

  // Situational stats
  actHtml += '<div class="p-row"><div class="sec-subtitle mt-0">Situational stats</div>';
  actHtml += '<div class="bar-group">';

  function sitStatColour(label, p) {
    if (p === null) return 'o';
    switch (label) {
      case 'C-Bet': return p >= 60 ? 'g' : p >= 40 ? 'o' : 'r';
      case 'Delayed C-Bet': return p >= 30 ? 'g' : 'o';
      case 'Donk Bet': return p > 30 ? 'a' : 'o';
      case 'Fold to C-Bet': return p > 70 ? 'r' : p > 50 ? 'a' : 'g';
      case 'Fold to 3-Bet': return p > 70 ? 'r' : p > 50 ? 'a' : 'g';
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
    actHtml += barRow(labelHtml, p || 0, 100, cls, (p !== null ? p + '%' : '—'), s.done + '/' + s.opps + ' spots');
  }

  actHtml += '</div></div>';

  // Insights
  var aIns = [];
  if (caPct > raPct + 20) {
    var exCallHeavy = findExampleHand(function (h) {
      var ma = getHeroActions(h);
      return ma.some(function (a) { return a.type === 'call'; }) && !ma.some(function (a) { return a.type === 'raise' || a.type === 'bet'; }) && h.outcome && h.outcome.result !== 'won';
    });
    aIns.push(insWithExample('a', 'Call-Heavy', 'You call ' + caPct + '% but raise only ' + raPct + '% of the time. Where everyone calls anyway, raising more extracts more value.', [{
      v: 'Call: ' + caPct + '%',
    }, {
      v: 'Raise: ' + raPct + '%',
    }], exCallHeavy, 'This hand was called when a raise could have taken down the pot or extracted more value. Passive play lets draws get there for free.'));
  }
  if (aggPct !== null && aggPct < 15) {
    var exLowAgg = findExampleHand(function (h) {
      var ma = getHeroActions(h);
      return ma.some(function (a) { return a.type === 'call'; }) && !ma.some(function (a) { return a.type === 'raise' || a.type === 'bet'; });
    });
    aIns.push(insWithExample('r', 'Low Aggression', 'Only ' + aggPct + '% aggression. Strong hands need to be bet, not called.', [{
      v: d.raises + ' raises from ' + actTotal + ' actions',
    }], exLowAgg, 'Only ' + aggPct + '% of actions are raises. Strong hands need to be bet for value. Checking and calling lets opponents draw cheaply and control the pot size.'));
  } else if (aggPct !== null && aggPct <= 40) {
    var exGoodAgg = findExampleHand(function (h) {
      return parseActions(h.actions).some(function (a) { return a.isMe && (a.type === 'raise' || a.type === 'bet'); });
    });
    aIns.push(insWithExample('g', 'Aggression', aggPct + '% raise frequency is solid. Taking initiative without overdoing it.', [{
      v: d.raises + ' raises',
    }], exGoodAgg, 'A well-timed raise like this one puts opponents on the defensive. Your aggression level is in a healthy range — enough to take initiative without overbluffing.'));
  } else if (aggPct !== null) {
    var exHighAgg = findExampleHand(function (h) {
      var ma = getHeroActions(h);
      return ma.filter(function (a) { return a.type === 'raise' || a.type === 'bet'; }).length >= 2;
    });
    aIns.push(insWithExample('a', 'High Aggression', aggPct + '% is high. Be careful,  bluff raises cost real money.', [{
      v: d.raises + ' raises',
    }], exHighAgg, 'Multiple raises in this hand illustrate your aggressive tendencies. In situations where players call wide, each bluff raise is more likely to get looked up — save aggression for strong holdings.'));
  }
  if (d.faced3bet >= 3) {
    var f3 = pct(d.fold3bet, d.faced3bet);
    if (f3 > 70) {
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
      aIns.push(insWithExample('r', '3-Bet Response', 'Folding to 3-bets ' + f3 + '% of the time. In TC players 3-bet light, so consider calling more with strong hands.', [{
        v: d.fold3bet + '/' + d.faced3bet + ' situations',
      }], ex3bet, 'You folded here facing a 3-bet. Many 3-bets are light. With a decent holding, calling can be profitable given how often opponents are bluffing or semi-bluffing.'));
    }
  }
  // All-in insights
  if (d.facedAllin >= 2) {
    var afp = pct(d.foldAllin, d.facedAllin);
    var awp = pct(d.wonAllin, d.callAllin);
    if (afp > 75 && awp !== null && awp > 60) {
      var exAllinFold = findExampleHand(function (h) {
        var acts2 = parseActions(h.actions);
        return acts2.some(function (a) { return !a.isMe && (a.type === 'raise' || a.type === 'bet') && a.msg && a.msg.indexOf(' to ') === -1; }) && acts2.some(function (a) { return a.isMe && a.type === 'fold'; });
      });
      aIns.push(insWithExample('r', 'All-in Folds x Win Rate', 'Folding all-ins ' + afp + '% of the time but winning ' + awp + '% when you do call. You\'re folding good equity.', [{
        v: d.callAllin + ' calls, ' + d.wonAllin + ' won',
      }], exAllinFold, 'You folded to an all-in here. Given your high win rate when calling (' + awp + '%), you may be folding too many hands with good equity against all-in ranges.'));
    } else {
      aIns.push(ins('n', 'All-in Profile', 'Fold rate: ' + afp + '%. Win rate when calling: ' + (awp !== null ? awp + '%' : '—') + '.', [{
        v: d.facedAllin + ' situations',
      }]));
    }
  }
  // Preflop Fold Rate
  var pfFoldPct = pct(d.ss.Preflop.f, d.ss.Preflop.seen);
  if (pfFoldPct !== null) {
    aIns.push(ins(pfFoldPct > 65 ? 'a' : 'n', 'Preflop Fold Rate', 'You fold preflop ' + pfFoldPct + '% of hands.' + (pfFoldPct > 65 ? ' That\'s tight, which is fine, but make sure you\'re not folding playable hands from position.' : ' Reasonable.'), [{
      v: d.ss.Preflop.f + ' folds',
    }]));
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
    aIns.push(ins(best2.diff > 0 ? 'g' : 'a', 'Aggression x Win Rate (' + best2.street + ')', 'When you raise on the ' + best2.street.toLowerCase() + ', you win ' + best2.aggWr + '% vs ' + best2.passWr + '% when passive. ' + (best2.diff > 0 ? 'Aggression pays off here.' : 'Passive play performs better — opponents may be calling your bluffs.'), [
      { v: 'Aggressive: ' + best2.aggWr + '%', hi: best2.diff > 0 },
      { v: 'Passive: ' + best2.passWr + '%' },
    ]));
  }
  actHtml += '<div class="p-row">' + renderInsights(aIns, 'Actions', 'Keep building data for action pattern insights.') + '</div>';
  container.innerHTML = actHtml;
}
