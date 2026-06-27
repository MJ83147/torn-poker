(function() {
  var F = Sections.section('trends', 'Tables and Trends');
  var MIN_PARTITION = 30;  // floor for any partitioned sub-d
  var MIN_SESSION_HALF = 20; // floor for the session-half split

  function safe(num) {
    return (num == null || !isFinite(num)) ? null : num;
  }

  function perHandPnl(sd) {
    if (!sd || !sd.n || !sd.core) return null;
    var net = sd.core.netPnl;
    if (net == null) return null;
    return net / sd.n;
  }

  // Hands without timestamp drop to the back.
  function chronological(hands) {
    return hands.slice().sort(function(a, b) {
      return (a.timestamp || 0) - (b.timestamp || 0);
    });
  }

  function moveOf(early, recent, gate) {
    if (early == null || recent == null) return { dir: 'flat', delta: 0, abs: 0 };
    var delta = recent - early;
    var abs = Math.abs(delta);
    if (abs < gate) return { dir: 'flat', delta: delta, abs: abs };
    return { dir: delta > 0 ? 'up' : 'down', delta: delta, abs: abs };
  }

  function buildDirectionOfTravel(d, extras, hands) {
    if (!d || !d.n || d.n < MIN_AGGREGATE) return null;
    if (!hands || !hands.length) return null;

    var sorted = chronological(hands);
    if (sorted.length < MIN_PARTITION * 2) return null;

    var third = Math.floor(sorted.length / 3);
    if (third < MIN_PARTITION) return null;

    var early = sorted.slice(0, third);
    var recent = sorted.slice(sorted.length - third);

    var dE = analyse(early);
    var dR = analyse(recent);
    if (!dE || !dR || !dE.core || !dR.core) return null;

    var moves = {
      vpip: moveOf(safe(dE.core.vpipPct), safe(dR.core.vpipPct), 5),
      pfr:  moveOf(safe(dE.core.pfrPct),  safe(dR.core.pfrPct),  5),
      agg:  moveOf(safe(dE.core.agg),     safe(dR.core.agg),     8),
      wr:   moveOf(safe(dE.core.wr),      safe(dR.core.wr),      5)
    };
    var earlyPerHand = perHandPnl(dE);
    var recentPerHand = perHandPnl(dR);
    moves.pnl = moveOf(earlyPerHand, recentPerHand, 2);

    var openingText = 'Comparing your earliest tracked hands with your most recent. VPIP runs ' +
      Math.round(dE.core.vpipPct || 0) + '% then versus ' +
      Math.round(dR.core.vpipPct || 0) + '% now, with PFR at ' +
      Math.round(dE.core.pfrPct || 0) + '% then versus ' +
      Math.round(dR.core.pfrPct || 0) + '% now.';

    var branchTexts = [];
    var movers = [];
    var keys = ['vpip', 'pfr', 'agg', 'wr', 'pnl'];
    var labels = { vpip: 'VPIP', pfr: 'PFR', agg: 'aggression', wr: 'win rate', pnl: 'per-hand P&L' };
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (moves[k].dir !== 'flat') movers.push({ key: k, move: moves[k] });
    }
    movers.sort(function(a, b) { return b.move.abs - a.move.abs; });

    var wrMove = moves.wr;
    var pnlMove = moves.pnl;

    // Render a single metric's early->recent values in its natural units.
    function metricFromTo(key) {
      var coreKey = key === 'agg' ? 'agg' : key === 'wr' ? 'wr' : key + 'Pct';
      var unit = key === 'pnl' ? '' : '%';
      if (key === 'pnl') {
        return fmtPnl(earlyPerHand) + ' to ' + fmtPnl(recentPerHand) + ' a hand';
      }
      return Math.round(dE.core[coreKey] || 0) + unit + ' to ' + Math.round(dR.core[coreKey] || 0) + unit;
    }

    // Style metrics only (exclude win rate and P&L, which are results, not inputs).
    var styleMovers = movers.filter(function(m) { return m.key !== 'wr' && m.key !== 'pnl'; });
    var sameDirCount = { up: 0, down: 0 };
    for (var mi = 0; mi < styleMovers.length; mi++) {
      sameDirCount[styleMovers[mi].move.dir]++;
    }
    var driftDir = null;
    if (sameDirCount.up >= 2) driftDir = 'up';
    else if (sameDirCount.down >= 2) driftDir = 'down';

    if (driftDir) {
      var drifters = styleMovers.filter(function(m) { return m.move.dir === driftDir; });
      var driftParts = drifters.map(function(m) {
        return labels[m.key] + ' has gone from ' + metricFromTo(m.key);
      });
      var driftSentence = joinList(driftParts) + ' over recent hands, all moving ' + driftDir + ' together.';
      branchTexts.push(driftSentence.charAt(0).toUpperCase() + driftSentence.slice(1));
    } else if (styleMovers.length === 1) {
      var solo = styleMovers[0];
      branchTexts.push(
        'One metric is shifting while the rest hold steady: your ' + labels[solo.key] +
        ' has gone from ' + metricFromTo(solo.key) + '.'
      );
    } else if (styleMovers.length >= 2) {
      // Movers in different directions: name each so the card stays specific.
      var mixedParts = styleMovers.map(function(m) {
        return labels[m.key] + ' has moved from ' + metricFromTo(m.key);
      });
      branchTexts.push('Your ' + joinList(mixedParts) + ' over recent hands.');
    }

    if (wrMove.dir === 'up') {
      branchTexts.push('Your win rate has climbed from ' + metricFromTo('wr') + '.');
    } else if (wrMove.dir === 'down') {
      branchTexts.push('Your win rate has dropped from ' + metricFromTo('wr') + '.');
    } else if (movers.length === 0) {
      return null;
    } else if (styleMovers.length) {
      branchTexts.push('Your win rate has held at ' + Math.round(dR.core.wr || 0) + '%, steady through those style changes.');
    } else if (pnlMove.dir !== 'flat') {
      branchTexts.push('Your win rate has held at ' + Math.round(dR.core.wr || 0) +
        '%, while your per-hand return has moved from ' + metricFromTo('pnl') + '.');
    }

    var severity;
    var direction;
    if (wrMove.dir === 'down' && wrMove.abs >= 5) { severity = 'r'; direction = 'down'; }
    else if (wrMove.dir === 'down') { severity = 'a'; direction = 'down'; }
    else if (driftDir && wrMove.dir === 'flat') { severity = 'a'; direction = driftDir; }
    else if (wrMove.dir === 'up') { severity = 'g'; direction = 'up'; }
    else { severity = 'g'; direction = 'flat'; }

    if (severity === 'g' && direction === 'flat' && !movers.length) return null;

    var impactText = null;
    var soWhatText = null;
    if (severity === 'r' || (severity === 'a' && wrMove.dir === 'down')) {
      impactText = 'Your results are getting worse across your tracked history. Something is moving against you, even if you cannot feel it session to session.';
      if (driftDir) {
        soWhatText = 'Your ' + labels[styleMovers[0].key] + ' has moved the most. Pull it back toward where it sat when your results were better, and check the rest follow.';
      } else {
        soWhatText = 'Look at within-session and across-session play next. The cause is somewhere in how you are running sessions.';
      }
    } else if (severity === 'a' && driftDir) {
      impactText = 'Your style metrics are drifting ' + driftDir + ' while your win rate has not moved yet. The result has not followed, but that is the early warning.';
      soWhatText = 'Pull the biggest drifter back before the win rate catches up. Your ' + labels[styleMovers[0].key] + ' is the one to watch.';
    } else if (severity === 'g' && direction === 'up') {
      impactText = 'Your game is moving in the right direction. Results are following the changes.';
      soWhatText = 'Whatever you are doing differently is working. Keep playing the same way and resist the urge to mix it up while you are in a winning rhythm.';
    }

    var examples = [];
    if (severity === 'r' || (severity === 'a' && wrMove.dir === 'down')) {
      var recentLosses = pickHands(recent, function(h) {
        return h && h.outcome && h.outcome.result !== 'won';
      }, 12);
      if (recentLosses.length) {
        examples.push({
          id: 'trend-recent-losses',
          label: 'Recent losing hands',
          hands: recentLosses,
          coachingNote: 'Losing hands from your recent stretch. Downswings are usually one of three things: variance, a leak that opened up recently, or tougher opposition. Look for patterns before assuming variance.'
        });
      }
    } else if (severity === 'g' && direction === 'up') {
      var recentWins = pickHands(recent, function(h) {
        return h && h.outcome && h.outcome.result === 'won';
      }, 12);
      if (recentWins.length) {
        examples.push({
          id: 'trend-recent-wins',
          label: 'Recent winning hands',
          hands: recentWins,
          coachingNote: 'Winning hands from your improving stretch. Whatever you are doing now is paying off. Keep doing it.'
        });
      }
    } else if (severity === 'a' && driftDir) {
      var recentDrift = pickHands(recent, function(h) { return heroPlayed(h); }, 12);
      if (recentDrift.length) {
        examples.push({
          id: 'trend-recent-drift',
          label: 'Recent hands you played',
          hands: recentDrift,
          coachingNote: 'Hands from your recent stretch where your style is drifting ' + driftDir + '. The win rate has not moved yet, but these are the hands to compare against how you played earlier to spot what changed.'
        });
      }
    }

    // Steady win rate with movement underneath still warrants example hands to compare.
    if (!examples.length) {
      var recentPlayed = pickHands(recent, function(h) { return heroPlayed(h); }, 12);
      if (recentPlayed.length) {
        examples.push({
          id: 'trend-recent-played',
          label: 'Recent hands you played',
          hands: recentPlayed,
          coachingNote: 'Hands from your most recent stretch. Your win rate has held steady, so use these to confirm your recent play still matches the game that has been working.'
        });
      }
    }

    var deltaUnits = Math.max(wrMove.abs / 10, movers.length ? movers[0].move.abs / 20 : 0);

    return F({
      id: 'trends-direction',
      name: 'Direction of Travel',
      severity: severity,
      magnitude: deltaUnits,
      openingText: openingText,
      branchTexts: branchTexts,
      impactText: impactText,
      soWhatText: soWhatText,
      examples: examples,
      meta: {
        early: { n: dE.n, core: dE.core },
        recent: { n: dR.n, core: dR.core },
        moves: moves,
        driftDir: driftDir,
        wrDir: wrMove.dir
      }
    });
  }

  function buildSessionSwings(d, extras, hands) {
    if (!d || !d.n || d.n < MIN_AGGREGATE) return null;
    if (!hands || !hands.length) return null;
    if (typeof buildSessions !== 'function' || typeof splitSessionHalves !== 'function') return null;

    var sessions = buildSessions(hands);
    if (!sessions.length) return null;

    var sessSummaries = sessions.map(function(s) {
      var sHands = s.hands;
      var totalPnl = 0, cashHands = 0, wonCash = 0;
      for (var i = 0; i < sHands.length; i++) {
        var h = sHands[i];
        if (typeof isCashHand === 'function' && !isCashHand(h)) continue;
        cashHands++;
        totalPnl += getHandPnlValue(h);
        if (h.outcome && h.outcome.result === 'won') wonCash++;
      }
      return {
        len: sHands.length,
        pnl: totalPnl,
        cashHands: cashHands,
        wonCash: wonCash,
        wr: cashHands > 0 ? (wonCash / cashHands) * 100 : null,
        hands: sHands
      };
    });

    var bestSession = sessSummaries.slice().sort(function(a, b) { return b.pnl - a.pnl; })[0];
    var worstSession = sessSummaries.slice().sort(function(a, b) { return a.pnl - b.pnl; })[0];

    var openingText = 'You have ' + sessions.length + ' sessions tracked. ' +
      (bestSession && worstSession && bestSession !== worstSession
        ? 'Best session: ' + fmtPnl(bestSession.pnl) + ' across ' + bestSession.cashHands + ' cash hands. ' +
          'Worst: ' + fmtPnl(worstSession.pnl) + ' across ' + worstSession.cashHands + ' cash hands.'
        : 'Not enough variation between sessions to compare yet.');

    var branchTexts = [];
    var pillars = [];

    var halves = splitSessionHalves(hands, MIN_SESSION_HALF);
    var decline = null;
    if (halves.firstHalf.length >= MIN_PARTITION && halves.secondHalf.length >= MIN_PARTITION) {
      var dFirst = analyse(halves.firstHalf);
      var dSecond = analyse(halves.secondHalf);
      if (dFirst && dSecond && dFirst.core && dSecond.core) {
        var wrFirst = safe(dFirst.core.wr);
        var wrSecond = safe(dSecond.core.wr);
        var vpipFirst = safe(dFirst.core.vpipPct);
        var vpipSecond = safe(dSecond.core.vpipPct);
        var aggFirst = safe(dFirst.core.agg);
        var aggSecond = safe(dSecond.core.agg);

        var wrDrop = (wrFirst != null && wrSecond != null) ? wrFirst - wrSecond : 0;
        var aggDrop = (aggFirst != null && aggSecond != null) ? aggFirst - aggSecond : 0;
        var vpipMove = (vpipFirst != null && vpipSecond != null) ? vpipSecond - vpipFirst : 0;

        var declineSev = 'g';
        if (wrDrop >= 8 || aggDrop >= 10) declineSev = 'r';
        else if (wrDrop >= 4 || aggDrop >= 5 || Math.abs(vpipMove) >= 6) declineSev = 'a';

        if (declineSev !== 'g') {
          var pieces = [];
          if (wrDrop >= 4) pieces.push('win rate drops from ' + Math.round(wrFirst) + '% to ' + Math.round(wrSecond) + '%');
          if (aggDrop >= 5) pieces.push('aggression drops from ' + Math.round(aggFirst) + '% to ' + Math.round(aggSecond) + '%');
          if (Math.abs(vpipMove) >= 6) {
            pieces.push('VPIP ' + (vpipMove > 0 ? 'climbs' : 'falls') +
              ' from ' + Math.round(vpipFirst) + '% to ' + Math.round(vpipSecond) + '%');
          }
          if (pieces.length) {
            decline = {
              id: 'within-session',
              severity: declineSev,
              deltaUnits: Math.max(wrDrop, aggDrop) / 10,
              branchText: 'Across the second half of your sessions, ' + joinList(pieces) + '. Your game shifts the longer you sit.',
              examples: null
            };
            var lateHands = halves.secondHalf.slice(-12);
            if (lateHands.length) {
              decline.examples = {
                id: 'sw-late-session',
                label: 'Hands from late in sessions',
                hands: lateHands,
                coachingNote: 'Hands from the second half of your sessions. Look for what is different from your earlier play: looser opens, weaker calls, missed value.'
              };
            }
            pillars.push(decline);
          }
        }
      }
    }

    var losingHands = [];
    var winningHands = [];
    for (var si = 0; si < sessSummaries.length; si++) {
      var ss = sessSummaries[si];
      if (ss.cashHands < 10) continue;
      if (ss.pnl < 0) losingHands = losingHands.concat(ss.hands);
      else if (ss.pnl > 0) winningHands = winningHands.concat(ss.hands);
    }

    if (losingHands.length >= MIN_PARTITION && winningHands.length >= MIN_PARTITION) {
      var dLose = analyse(losingHands);
      var dWin = analyse(winningHands);
      if (dLose && dWin && dLose.core && dWin.core) {
        var vpipLose = safe(dLose.core.vpipPct);
        var vpipWin = safe(dWin.core.vpipPct);
        var aggLose = safe(dLose.core.agg);
        var aggWin = safe(dWin.core.agg);

        if (vpipLose != null && vpipWin != null) {
          var vpipGap = vpipLose - vpipWin;
          var aggGap = (aggLose != null && aggWin != null) ? aggLose - aggWin : 0;

          var swingSev = 'g';
          if (Math.abs(vpipGap) >= 8 || Math.abs(aggGap) >= 12) swingSev = 'a';
          if ((vpipGap >= 8 && aggGap >= 8) || vpipGap >= 12) swingSev = 'r';

          if (swingSev !== 'g') {
            // Lead with the metric that actually drives the gap so the figures match the claim.
            var swingBranch;
            var swingDir;
            if (vpipGap >= 5) {
              swingDir = 'looser';
              swingBranch = 'In losing sessions you play ' + Math.round(vpipLose) + '% of hands, against ' +
                Math.round(vpipWin) + '% in winning sessions. You loosen up when you are down.';
            } else if (vpipGap <= -5) {
              swingDir = 'tighter';
              swingBranch = 'In losing sessions you play ' + Math.round(vpipLose) + '% of hands, against ' +
                Math.round(vpipWin) + '% in winning sessions. You tighten up when you are down.';
            } else if (aggGap >= 5) {
              swingDir = 'aggressive';
              swingBranch = 'In losing sessions your aggression runs ' + Math.round(aggLose) + '%, against ' +
                Math.round(aggWin) + '% in winning sessions. You force the action more when you are down.';
            } else {
              swingDir = 'passive';
              swingBranch = 'In losing sessions your aggression runs ' + Math.round(aggLose) + '%, against ' +
                Math.round(aggWin) + '% in winning sessions. You play more passively when you are down.';
            }

            var swingExamples = null;
            var lostPlayed = pickHands(losingHands, function(h) {
              if (!h || !h.actions) return false;
              var acts = parseActions(h.actions);
              for (var ai = 0; ai < acts.length; ai++) {
                var a = acts[ai];
                if (!a.isMe) continue;
                if (a.type === 'call' || a.type === 'bet' || a.type === 'raise') return true;
              }
              return false;
            }, 12);
            if (lostPlayed.length) {
              var swingNote;
              if (swingDir === 'looser') {
                swingNote = 'Hands you played during losing sessions. Look for the marginal hands you would have passed on in a winning session. The gap between the two ranges is the leak.';
              } else if (swingDir === 'tighter') {
                swingNote = 'Hands you played during losing sessions. You contract your range when you are down, so check whether you are passing up profitable spots out of caution.';
              } else if (swingDir === 'aggressive') {
                swingNote = 'Hands you played during losing sessions. You push harder when you are down, so look for the bets and raises that were chasing rather than value.';
              } else {
                swingNote = 'Hands you played during losing sessions. You ease off when you are down, so look for the value bets and pressure you left on the table.';
              }
              swingExamples = {
                id: 'sw-losing-sessions',
                label: 'Hands played in losing sessions',
                hands: lostPlayed,
                coachingNote: swingNote
              };
            }

            pillars.push({
              id: 'loose-losing',
              severity: swingSev,
              swingDir: swingDir,
              deltaUnits: Math.abs(vpipGap) / 15,
              branchText: swingBranch,
              examples: swingExamples
            });
          }
        }
      }
    }

    if (sessSummaries.length >= 4) {
      var sorted = sessSummaries.slice().sort(function(a, b) { return a.len - b.len; });
      var half = Math.floor(sorted.length / 2);
      var shortSess = sorted.slice(0, half);
      var longSess = sorted.slice(sorted.length - half);

      function aggregate(list) {
        var pnl = 0, hands = 0;
        for (var i = 0; i < list.length; i++) {
          pnl += list[i].pnl;
          hands += list[i].cashHands;
        }
        return { pnl: pnl, hands: hands, perHand: hands > 0 ? pnl / hands : null };
      }
      var sAgg = aggregate(shortSess);
      var lAgg = aggregate(longSess);

      if (sAgg.hands >= MIN_PARTITION && lAgg.hands >= MIN_PARTITION &&
          sAgg.perHand != null && lAgg.perHand != null) {
        var gap = sAgg.perHand - lAgg.perHand;
        var longLeakSev = 'g';
        if (gap > 5 && lAgg.perHand < 0) longLeakSev = 'r';
        else if (gap > 2) longLeakSev = 'a';

        if (longLeakSev !== 'g') {
          var avgShort = shortSess.reduce(function(a, b) { return a + b.len; }, 0) / shortSess.length;
          var avgLong = longSess.reduce(function(a, b) { return a + b.len; }, 0) / longSess.length;
          var longLeakExamples = null;
          var longLeakHands = [];
          for (var lli = 0; lli < longSess.length && longLeakHands.length < 12; lli++) {
            var lsHands = longSess[lli].hands || [];
            var lsMid = Math.floor(lsHands.length / 2);
            for (var lj = lsMid; lj < lsHands.length && longLeakHands.length < 12; lj++) {
              if (lsHands[lj]) longLeakHands.push(lsHands[lj]);
            }
          }
          if (longLeakHands.length) {
            longLeakExamples = {
              id: 'sw-long-session-leak',
              label: 'Hands from the back half of long sessions',
              hands: longLeakHands,
              coachingNote: 'Hands from the second half of your longer sessions. The per-hand return drops the longer you sit, so look here for the looser calls and tired decisions that cost the chips your short sessions earned.'
            };
          }
          pillars.push({
            id: 'long-session-leak',
            severity: longLeakSev,
            deltaUnits: Math.abs(gap) / 10,
            branchText: 'Short sessions (around ' + Math.round(avgShort) + ' hands) run at ' +
              fmtPnl(sAgg.perHand) + ' per hand. Long sessions (around ' + Math.round(avgLong) +
              ' hands) run at ' + fmtPnl(lAgg.perHand) + ' per hand. The longer you play, the worse it gets.',
            examples: longLeakExamples
          });
        }
      }
    }

    if (!pillars.length) return null;

    for (var pi = 0; pi < pillars.length; pi++) {
      if (pillars[pi].branchText) branchTexts.push(pillars[pi].branchText);
    }

    var severity = Sections.combineSeverity(pillars.map(function(p) { return p.severity; }));

    var hasDecline = pillars.some(function(p) { return p.id === 'within-session' && (p.severity === 'r' || p.severity === 'a'); });
    var hasLongLeak = pillars.some(function(p) { return p.id === 'long-session-leak' && (p.severity === 'r' || p.severity === 'a'); });
    var losingPillar = null;
    for (var lp = 0; lp < pillars.length; lp++) {
      if (pillars[lp].id === 'loose-losing' && (pillars[lp].severity === 'r' || pillars[lp].severity === 'a')) {
        losingPillar = pillars[lp];
        break;
      }
    }
    var hasLooseLosing = !!losingPillar;
    var swingDir = losingPillar ? losingPillar.swingDir : null;
    if (hasDecline && hasLongLeak) severity = 'r';

    var impactText = null;
    var soWhatText = null;
    if (hasDecline && hasLongLeak) {
      impactText = 'Your play degrades within sessions and long sessions cost you more per hand than short ones. Session length is the leak.';
      soWhatText = 'Cap your sessions where the curve turns. Take real breaks before the second half starts costing you what the first half earned.';
    } else if (hasLooseLosing && hasDecline) {
      impactText = 'Your play shifts when you are down and your game slips later in sessions. The two compound: a losing session changes how you play and tends to run longer.';
      soWhatText = 'When you notice you are down and have been sitting a while, leave. The fix is at the table exit, not in the technical adjustments.';
    } else if (hasDecline) {
      impactText = 'Your game does not hold up across the length of a session. Concentration, discipline, or both are dropping later on.';
      soWhatText = 'Shorter sessions or scheduled breaks will recover more value than any technical fix.';
    } else if (hasLooseLosing) {
      if (swingDir === 'looser') {
        impactText = 'Your range widens when you are losing. The extra hands you add are not the ones that win pots.';
        soWhatText = 'Recognise the pattern in the moment. When you are down, hold the starting range you opened with, do not widen to chase.';
      } else if (swingDir === 'tighter') {
        impactText = 'Your range narrows when you are losing. Playing scared gives back the edge you hold in winning sessions.';
        soWhatText = 'When you are down, keep opening the same range you trust when you are winning. Do not let the scoreboard shrink your game.';
      } else if (swingDir === 'aggressive') {
        impactText = 'You push harder when you are losing. The extra bets and raises are chasing the deficit rather than betting for value.';
        soWhatText = 'When you are down, bet for the same reasons you do when you are winning. Stop forcing the action to get even.';
      } else {
        impactText = 'You ease off when you are losing. Playing passively leaves value and pressure on the table.';
        soWhatText = 'When you are down, keep applying the pressure you use in winning sessions. Do not retreat into check-call poker.';
      }
    } else if (hasLongLeak) {
      impactText = 'Long sessions perform worse than short ones. The chips you earn early are being given back later.';
      soWhatText = 'Cap session length to roughly the volume of your short sessions. The curve is telling you where to stop.';
    }

    var examples = [];
    for (var p = 0; p < pillars.length; p++) {
      if (pillars[p].examples) examples.push(pillars[p].examples);
    }

    var topDelta = 0;
    for (var pj = 0; pj < pillars.length; pj++) {
      if (pillars[pj].deltaUnits > topDelta) topDelta = pillars[pj].deltaUnits;
    }

    return F({
      id: 'trends-sessions',
      name: 'Session Swings',
      severity: severity,
      magnitude: topDelta,
      openingText: openingText,
      branchTexts: branchTexts,
      impactText: impactText,
      soWhatText: soWhatText,
      examples: examples,
      meta: {
        sessions: sessions.length,
        bestPnl: bestSession ? bestSession.pnl : null,
        worstPnl: worstSession ? worstSession.pnl : null,
        pillars: pillars
      }
    });
  }

  Sections.defineSection({
    id: 'trends',
    panel: 'Tables and Trends',
    run: function(d, extras, hands) {
      var out = [];
      var direction = buildDirectionOfTravel(d, extras, hands);
      if (direction) out.push(direction);
      var swings = buildSessionSwings(d, extras, hands);
      if (swings) out.push(swings);
      return out;
    }
  });
})();
