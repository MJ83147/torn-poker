// ── LEAK FINDER PANEL ─────────────────────────────────────────────────────────

function renderLeaks(container, d, hands) {
  var leaks = [];

  // ── 1. Loose from Early Position ────────────────────────────────────────
  (function() {
    var epHands = 0, epVpip = 0;
    var examples = [];
    for (var i = 0; i < hands.length; i++) {
      var pos = getPositionCategory(hands[i].position);
      if (pos !== 'EP') continue;
      epHands++;
      var heroActs = getHeroActions(hands[i]);
      var entered = false;
      for (var j = 0; j < heroActs.length; j++) {
        if (heroActs[j].street === 'Preflop' && (heroActs[j].type === 'call' || heroActs[j].type === 'raise')) {
          entered = true; break;
        }
      }
      if (entered) { epVpip++; if (examples.length < 10) examples.push(hands[i]); }
    }
    if (epHands < 20) {
      leaks.push({ cost: 0, html: ins('n', 'EP Discipline', 'Need ' + (20 - epHands) + ' more early position hands to assess.', [{ v: epHands + '/20 EP hands' }]) });
      return;
    }
    var rate = pct(epVpip, epHands);
    if (rate > 25) {
      var est = Math.round((rate - 25) * epHands * 0.3);
      leaks.push({ cost: est, html: insWithExample('r', 'Loose in Early Position', 'EP VPIP is ' + rate + '%. You\'re entering too many pots from UTG/UTG+1 where you\'re out of position for the rest of the hand.', [{ v: 'EP VPIP: ' + rate + '%' }, { v: '~' + est + ' BB cost' }], examples, 'This hand shows you entering from early position with a marginal holding.') });
    }
  })();

  // ── 2. Low C-bet Frequency ──────────────────────────────────────────────
  (function() {
    if (d.cbetOpps < 10) {
      leaks.push({ cost: 0, html: ins('n', 'C-bet Frequency', 'Need ' + (10 - d.cbetOpps) + ' more c-bet opportunities to assess.', [{ v: d.cbetOpps + '/10 opps' }]) });
      return;
    }
    var rate = pct(d.cbetDone, d.cbetOpps);
    if (rate < 50) {
      var est = Math.round((50 - rate) * d.cbetOpps * 0.2);
      var examples = [];
      for (var i = 0; i < hands.length && examples.length < 10; i++) {
        var acts = parseActions(hands[i].actions);
        var heroRaisedPre = false, heroCheckedFlop = false;
        for (var j = 0; j < acts.length; j++) {
          if (acts[j].isMe && acts[j].street === 'Preflop' && acts[j].type === 'raise') heroRaisedPre = true;
          if (acts[j].isMe && acts[j].street === 'Flop' && acts[j].type === 'check') heroCheckedFlop = true;
        }
        if (heroRaisedPre && heroCheckedFlop) examples.push(hands[i]);
      }
      leaks.push({ cost: est, html: insWithExample('r', 'Low C-bet Rate', 'You c-bet only ' + rate + '% of the time after raising preflop. Continuation betting below 50% gives up too much initiative.', [{ v: 'C-bet: ' + rate + '%' }, { v: '~' + est + ' BB cost' }], examples, 'You raised preflop but checked the flop — a c-bet would maintain initiative.') });
    }
  })();

  // ── 3. Over-folding to Aggression ───────────────────────────────────────
  (function() {
    if (d.facedRaise < 15) {
      leaks.push({ cost: 0, html: ins('n', 'Fold to Aggression', 'Need ' + (15 - d.facedRaise) + ' more raised pots to assess.', [{ v: d.facedRaise + '/15 faced' }]) });
      return;
    }
    var rate = pct(d.foldedToRaise, d.facedRaise);
    if (rate > 60) {
      var est = Math.round((rate - 60) * d.facedRaise * 0.25);
      var examples = [];
      for (var i = 0; i < hands.length && examples.length < 10; i++) {
        var acts = parseActions(hands[i].actions);
        for (var j = 0; j < acts.length; j++) {
          if (!acts[j].isMe && acts[j].type === 'raise' && acts[j].street !== 'Preflop') {
            for (var k = j + 1; k < acts.length; k++) {
              if (acts[k].isMe && acts[k].type === 'fold') { examples.push(hands[i]); break; }
              if (acts[k].isMe) break;
            }
            break;
          }
        }
      }
      leaks.push({ cost: est, html: insWithExample('r', 'Over-folding to Raises', 'You fold ' + rate + '% when facing a raise. Opponents can exploit this by raising with anything.', [{ v: 'Fold to raise: ' + rate + '%' }, { v: '~' + est + ' BB cost' }], examples, 'You folded to a raise here — consider if your hand had enough equity to continue.') });
    }
  })();

  // ── 4. Over-folding to C-bets ──────────────────────────────────────────
  (function() {
    var faced = 0, folded = 0;
    for (var i = 0; i < hands.length; i++) {
      var acts = parseActions(hands[i].actions);
      var pfRaiser = null;
      for (var j = 0; j < acts.length; j++) {
        if (acts[j].street === 'Preflop' && acts[j].type === 'raise' && !acts[j].isMe) {
          pfRaiser = acts[j].author; break;
        }
      }
      if (!pfRaiser) continue;
      for (var j = 0; j < acts.length; j++) {
        if (acts[j].street === 'Flop' && acts[j].author === pfRaiser && (acts[j].type === 'bet' || acts[j].type === 'raise')) {
          for (var k = j + 1; k < acts.length; k++) {
            if (acts[k].street !== 'Flop') break;
            if (acts[k].isMe) {
              faced++;
              if (acts[k].type === 'fold') folded++;
              break;
            }
          }
          break;
        }
      }
    }
    if (faced < 10) {
      leaks.push({ cost: 0, html: ins('n', 'Fold to C-bet', 'Need ' + (10 - faced) + ' more c-bet situations to assess.', [{ v: faced + '/10 faced' }]) });
      return;
    }
    var rate = pct(folded, faced);
    if (rate > 65) {
      var est = Math.round((rate - 65) * faced * 0.2);
      var examples = [];
      for (var ii = 0; ii < hands.length && examples.length < 10; ii++) {
        var acts2 = parseActions(hands[ii].actions);
        var pfr2 = null;
        for (var jj = 0; jj < acts2.length; jj++) {
          if (acts2[jj].street === 'Preflop' && acts2[jj].type === 'raise' && !acts2[jj].isMe) { pfr2 = acts2[jj].author; break; }
        }
        if (!pfr2) continue;
        for (var jj = 0; jj < acts2.length; jj++) {
          if (acts2[jj].street === 'Flop' && acts2[jj].author === pfr2 && (acts2[jj].type === 'bet' || acts2[jj].type === 'raise')) {
            for (var kk = jj + 1; kk < acts2.length; kk++) {
              if (acts2[kk].street !== 'Flop') break;
              if (acts2[kk].isMe && acts2[kk].type === 'fold') { examples.push(hands[ii]); break; }
              if (acts2[kk].isMe) break;
            }
            break;
          }
        }
      }
      leaks.push({ cost: est, html: insWithExample('r', 'Over-folding to C-bets', 'You fold ' + rate + '% to continuation bets. Opponents can c-bet profitably with any hand.', [{ v: 'Fold to c-bet: ' + rate + '%' }, { v: '~' + est + ' BB cost' }], examples, 'You folded to a c-bet here — many c-bets are bluffs worth calling or raising.') });
    }
  })();

  // ── 5. Over-folding to 3-bets ─────────────────────────────────────────
  (function() {
    var faced = 0, folded = 0;
    for (var i = 0; i < hands.length; i++) {
      var acts = parseActions(hands[i].actions);
      var heroRaisedPre = false;
      for (var j = 0; j < acts.length; j++) {
        if (acts[j].street === 'Preflop' && acts[j].isMe && acts[j].type === 'raise') { heroRaisedPre = true; break; }
      }
      if (!heroRaisedPre) continue;
      for (var j = 0; j < acts.length; j++) {
        if (acts[j].street === 'Preflop' && !acts[j].isMe && acts[j].type === 'raise') {
          // This is a 3-bet against us
          for (var k = j + 1; k < acts.length; k++) {
            if (acts[k].street !== 'Preflop') break;
            if (acts[k].isMe) {
              faced++;
              if (acts[k].type === 'fold') folded++;
              break;
            }
          }
          break;
        }
      }
    }
    if (faced < 8) {
      leaks.push({ cost: 0, html: ins('n', 'Fold to 3-bet', 'Need ' + (8 - faced) + ' more 3-bet situations to assess.', [{ v: faced + '/8 faced' }]) });
      return;
    }
    var rate = pct(folded, faced);
    if (rate > 75) {
      var est = Math.round((rate - 75) * faced * 0.3);
      var examples = [];
      for (var ii = 0; ii < hands.length && examples.length < 10; ii++) {
        var acts2 = parseActions(hands[ii].actions);
        var heroRaised = false;
        for (var jj = 0; jj < acts2.length; jj++) {
          if (acts2[jj].street === 'Preflop' && acts2[jj].isMe && acts2[jj].type === 'raise') { heroRaised = true; break; }
        }
        if (!heroRaised) continue;
        for (var jj = 0; jj < acts2.length; jj++) {
          if (acts2[jj].street === 'Preflop' && !acts2[jj].isMe && acts2[jj].type === 'raise') {
            for (var kk = jj + 1; kk < acts2.length; kk++) {
              if (acts2[kk].street !== 'Preflop') break;
              if (acts2[kk].isMe && acts2[kk].type === 'fold') { examples.push(hands[ii]); break; }
              if (acts2[kk].isMe) break;
            }
            break;
          }
        }
      }
      leaks.push({ cost: est, html: insWithExample('r', 'Over-folding to 3-bets', 'You fold ' + rate + '% to 3-bets. Opponents can 3-bet you profitably with any two cards.', [{ v: 'Fold to 3-bet: ' + rate + '%' }, { v: '~' + est + ' BB cost' }], examples, 'You folded to a 3-bet here — consider defending with suited connectors and strong broadways.') });
    }
  })();

  // ── 6. Limping ─────────────────────────────────────────────────────────
  (function() {
    if (d.n < 30) return;
    var rate = pct(d.limpHands, d.n);
    if (rate > 15) {
      var est = Math.round(rate * d.n * 0.1);
      var examples = [];
      for (var i = hands.length - 1; i >= 0 && examples.length < 10; i--) {
        var heroActs = getHeroActions(hands[i]);
        var limped = false, raised = false;
        for (var j = 0; j < heroActs.length; j++) {
          if (heroActs[j].street === 'Preflop') {
            if (heroActs[j].type === 'call') limped = true;
            if (heroActs[j].type === 'raise') raised = true;
          }
        }
        if (limped && !raised) examples.push(hands[i]);
      }
      leaks.push({ cost: est, html: insWithExample('r', 'Limping Too Much', 'You limp ' + rate + '% of hands. Open-raising is almost always better — it gives you initiative and can win the pot preflop.', [{ v: 'Limp: ' + rate + '%' }, { v: '~' + est + ' BB cost' }], examples, 'You limp here instead of raising or folding — either commit with a raise or save the chips.') });
    }
  })();

  // ── 7. Passive Post-flop ───────────────────────────────────────────────
  (function() {
    if (d.n < 30) return;
    var agg = calcAggression(d.raises, d.calls, d.checks);
    if (agg !== null && agg < 18) {
      var est = Math.round((18 - agg) * d.n * 0.15);
      var examples = [];
      for (var i = 0; i < hands.length && examples.length < 10; i++) {
        var heroActs = getHeroActions(hands[i]);
        var postFlopCalls = 0, postFlopBets = 0;
        for (var j = 0; j < heroActs.length; j++) {
          if (heroActs[j].street === 'Preflop') continue;
          if (heroActs[j].type === 'call' || heroActs[j].type === 'check') postFlopCalls++;
          if (heroActs[j].type === 'bet' || heroActs[j].type === 'raise') postFlopBets++;
        }
        if (postFlopCalls >= 2 && postFlopBets === 0) examples.push(hands[i]);
      }
      leaks.push({ cost: est, html: insWithExample('r', 'Passive Post-flop', 'Aggression is only ' + agg + '%. You check and call too often instead of betting and raising for value or as bluffs.', [{ v: 'Aggression: ' + agg + '%' }, { v: '~' + est + ' BB cost' }], examples, 'You checked and called multiple streets here — consider if a bet or raise would have been stronger.') });
    }
  })();

  // ── 8. Missed Value Bets ───────────────────────────────────────────────
  (function() {
    var sdHands = 0, riverCheckWins = 0;
    var examples = [];
    for (var i = 0; i < hands.length; i++) {
      var h = hands[i];
      if (!h.outcome || h.outcome.result !== 'won') continue;
      var acts = parseActions(h.actions);
      var wentToSD = false;
      var rawActs = h.actions || [];
      for (var j = 0; j < rawActs.length; j++) {
        if ((rawActs[j] || '').indexOf(' reveals ') !== -1) { wentToSD = true; break; }
      }
      if (!wentToSD) continue;
      sdHands++;
      // Check if hero checked river
      var heroCheckedRiver = false;
      for (var j = 0; j < acts.length; j++) {
        if (acts[j].isMe && acts[j].street === 'River' && acts[j].type === 'check') {
          heroCheckedRiver = true; break;
        }
      }
      if (heroCheckedRiver) { riverCheckWins++; if (examples.length < 10) examples.push(h); }
    }
    if (sdHands < 20) {
      leaks.push({ cost: 0, html: ins('n', 'Value Betting', 'Need ' + (20 - sdHands) + ' more showdown hands to assess missed value.', [{ v: sdHands + '/20 hands' }]) });
      return;
    }
    var rate = pct(riverCheckWins, sdHands);
    if (rate > 40) {
      var est = Math.round(riverCheckWins * 2);
      leaks.push({ cost: est, html: insWithExample('r', 'Missed Value Bets', 'You check the river and win at showdown ' + rate + '% of the time. You\'re leaving money on the table by not betting.', [{ v: rate + '% check-win' }, { v: '~' + est + ' BB cost' }], examples, 'You won this hand at showdown after checking river — a bet could have extracted more value.') });
    }
  })();

  // ── 9. Wet Board Passivity ─────────────────────────────────────────────
  (function() {
    var wetFlops = 0, passiveWet = 0;
    var examples = [];
    for (var i = 0; i < hands.length; i++) {
      var h = hands[i];
      if (!h.board || h.board.length < 3) continue;
      var tex = classifyBoardTexture(h.board.slice(0, 3).map(normCard));
      if (!tex || tex.wetness === 'dry') continue;
      var heroActs = getHeroActions(h);
      var flopAct = null;
      for (var j = 0; j < heroActs.length; j++) {
        if (heroActs[j].street === 'Flop') { flopAct = heroActs[j]; break; }
      }
      if (!flopAct) continue;
      wetFlops++;
      if (flopAct.type === 'check' || flopAct.type === 'call') {
        // Only count if hero had reasonable equity (won the hand or had strong hole cards)
        if (h.outcome && h.outcome.result === 'won') {
          passiveWet++;
          if (examples.length < 10) examples.push(h);
        }
      }
    }
    if (wetFlops < 15) {
      leaks.push({ cost: 0, html: ins('n', 'Wet Board Play', 'Need ' + (15 - wetFlops) + ' more coordinated flop hands to assess.', [{ v: wetFlops + '/15 hands' }]) });
      return;
    }
    var rate = pct(passiveWet, wetFlops);
    if (rate > 30) {
      var est = Math.round(passiveWet * 1.5);
      leaks.push({ cost: est, html: insWithExample('a', 'Passive on Wet Boards', 'You play passively on ' + rate + '% of wet flops where you had a winning hand. Bet to protect your equity and charge draws.', [{ v: rate + '% passive-wet' }, { v: '~' + est + ' BB cost' }], examples, 'Wet board where you checked/called but won — a bet could have charged draws or built a bigger pot.') });
    }
  })();

  // ── 10. Donk Betting ───────────────────────────────────────────────────
  (function() {
    var donkOpps = 0, donkDone = 0;
    var examples = [];
    for (var i = 0; i < hands.length; i++) {
      var acts = parseActions(hands[i].actions);
      // Did someone else raise preflop?
      var pfRaiser = null;
      for (var j = 0; j < acts.length; j++) {
        if (acts[j].street === 'Preflop' && !acts[j].isMe && acts[j].type === 'raise') { pfRaiser = acts[j].author; break; }
      }
      if (!pfRaiser) continue;
      // Did hero see the flop?
      var heroOnFlop = false;
      for (var j = 0; j < acts.length; j++) {
        if (acts[j].isMe && acts[j].street === 'Flop') { heroOnFlop = true; break; }
      }
      if (!heroOnFlop) continue;
      // First action on flop by hero — if it's a bet before pfRaiser acts, it's a donk
      for (var j = 0; j < acts.length; j++) {
        if (acts[j].street !== 'Flop') continue;
        if (acts[j].isMe && (acts[j].type === 'bet' || acts[j].type === 'raise')) {
          donkOpps++;
          donkDone++;
          if (examples.length < 10) examples.push(hands[i]);
          break;
        }
        if (acts[j].isMe) { donkOpps++; break; }
        if (acts[j].author === pfRaiser) break; // PFR acted first, not a donk opp
      }
    }
    if (donkOpps < 8) return;
    var rate = pct(donkDone, donkOpps);
    if (rate > 30) {
      var est = Math.round(donkDone * 1.5);
      leaks.push({ cost: est, html: insWithExample('a', 'Donk Betting', 'You donk-bet ' + rate + '% of flops against the preflop raiser. This usually gives up your range advantage — let the aggressor c-bet, then decide.', [{ v: 'Donk: ' + rate + '%' }, { v: '~' + est + ' BB cost' }], examples, 'You bet into the preflop raiser here — usually better to check and let them continuation bet.') });
    }
  })();

  // ── 11. Blind Losses ───────────────────────────────────────────────────
  (function() {
    var blindHands = 0, blindLoss = 0;
    for (var i = 0; i < hands.length; i++) {
      var pos = (hands[i].position || '').toUpperCase();
      if (pos !== 'SB' && pos !== 'BB') continue;
      blindHands++;
      var pnl = getHandPnl(hands[i]);
      if (pnl.cls === 'l') {
        var amt = parseFloat(pnl.text.replace(/[^0-9.]/g, '')) || 0;
        blindLoss += amt;
      }
    }
    if (blindHands < 30) return;
    var bb = getHandBB(hands[0]);
    if (!bb) return;
    var lossPerHand = blindLoss / blindHands;
    var baseline = bb * 0.8; // Expected blind loss baseline
    if (lossPerHand > baseline * 1.5) {
      var excessBB = Math.round((lossPerHand - baseline) * blindHands / bb);
      var examples = [];
      for (var i = 0; i < hands.length && examples.length < 10; i++) {
        var bpos = (hands[i].position || '').toUpperCase();
        if (bpos !== 'SB' && bpos !== 'BB') continue;
        var bpnl = getHandPnl(hands[i]);
        if (bpnl.cls === 'l') examples.push(hands[i]);
      }
      leaks.push({ cost: excessBB, html: insWithExample('a', 'Blind Losses', 'You\'re losing ' + fmt(Math.round(lossPerHand)) + ' per hand from the blinds, well above the ' + fmt(Math.round(baseline)) + ' baseline. Tighten blind defense or play more aggressively.', [{ v: fmt(Math.round(blindLoss)) + ' total blind losses' }, { v: '~' + excessBB + ' BB excess' }], examples, 'You lost from the blinds here — consider if a tighter fold or more aggressive play would have been better.') });
    }
  })();

  // ── 12. Not Adjusting to Villains ──────────────────────────────────────
  (function() {
    for (var name in _opponentCache) {
      var prof = _opponentCache[name];
      if (prof.hands < 20) continue;
      if (prof.adjustments.length === 0) continue;
      // Check if hero is exploiting — look at hero's actions vs this opponent
      var handsVs = 0;
      var heroFoldsToRaise = 0, heroRaisesVs = 0, heroTotalVs = 0;
      for (var i = 0; i < hands.length; i++) {
        var acts = parseActions(hands[i].actions);
        var involved = false;
        for (var j = 0; j < acts.length; j++) {
          if (acts[j].author === name) { involved = true; break; }
        }
        if (!involved) continue;
        handsVs++;
        for (var j = 0; j < acts.length; j++) {
          if (!acts[j].isMe || acts[j].type === 'sb' || acts[j].type === 'bb' || acts[j].type === 'won') continue;
          heroTotalVs++;
          if (acts[j].type === 'raise' || acts[j].type === 'bet') heroRaisesVs++;
          if (acts[j].type === 'fold') heroFoldsToRaise++;
        }
      }
      if (handsVs < 20 || heroTotalVs < 10) continue;
      var heroAgg = pct(heroRaisesVs, heroTotalVs);
      // Flag if villain folds a lot but hero isn't raising enough
      if (prof.foldToRaise !== null && prof.foldToRaise >= 60 && heroAgg !== null && heroAgg < 30) {
        leaks.push({ cost: Math.round(handsVs * 0.5), html: ins('a', 'Not Exploiting ' + name, name + ' folds to raises ' + prof.foldToRaise + '% but you only raise ' + heroAgg + '% against them. Increase aggression to exploit this tendency.', [{ v: 'vs ' + name + ' (' + handsVs + ' hands)' }]) });
      }
      // Flag if villain is loose but hero isn't value-betting
      if (prof.vpip !== null && prof.vpip >= 55 && prof.foldToRaise !== null && prof.foldToRaise < 30 && heroAgg !== null && heroAgg < 25) {
        leaks.push({ cost: Math.round(handsVs * 0.5), html: ins('a', 'Not Exploiting ' + name, name + ' plays ' + prof.vpip + '% of hands and rarely folds. Value bet relentlessly — don\'t bluff, just bet your good hands.', [{ v: 'vs ' + name + ' (' + handsVs + ' hands)' }]) });
      }
    }
  })();

  // ── Sort by cost and render ─────────────────────────────────────────────
  leaks.sort(function(a, b) { return b.cost - a.cost; });

  var totalCost = 0;
  var leakCount = 0;
  for (var i = 0; i < leaks.length; i++) {
    if (leaks[i].cost > 0) { totalCost += leaks[i].cost; leakCount++; }
  }

  var html = '<div class="section-title">Leak Finder</div>';
  html += '<div class="desc-text mb-24">Automated analysis of your play patterns. Identifies areas where you may be losing value, sorted by estimated cost.</div>';

  if (leakCount > 0) {
    var bb = getHandBB(hands[0]);
    var costStr = '~' + totalCost + ' BB estimated cost';
    if (bb && bb > 0) costStr += ' (' + fmt(Math.round(totalCost * bb)) + ')';
    html += '<div class="leak-summary">';
    html += '<span class="leak-summary-count">' + leakCount + ' leak' + (leakCount > 1 ? 's' : '') + ' found</span>';
    html += '<span class="leak-summary-cost">' + costStr + '</span>';
    html += '</div>';
  } else {
    html += '<div class="leak-summary"><span class="leak-summary-count">No significant leaks detected</span></div>';
  }

  html += '<div class="ins-grid">';
  for (var i = 0; i < leaks.length; i++) {
    html += leaks[i].html;
  }
  html += '</div>';

  container.innerHTML = html;
}
