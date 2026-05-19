// ── TRENDS SECTION ────────────────────────────────────────────────────────────
//
// Two stories.
//
//   Direction of Travel  How have the headline metrics moved across the
//                        player's tracked history? Splits hands into an
//                        early third and a recent third by hand count, runs
//                        analyse() on each, and compares VPIP, PFR,
//                        aggression, win rate, and per-hand P&L. Calls out
//                        drift, the loudest mover, and whether results are
//                        following the change.
//
//   Session Swings       How does play vary within and between sessions?
//                        Compares first-half and second-half hands across
//                        sessions (within-session decline), winning vs
//                        losing sessions (loose-when-losing), and long vs
//                        short sessions (fatigue leak).
//
// Both stories work on partitioned hand sets and re-run analyse() on each
// partition. The framework helpers (Sections.classify, etc.) are not used
// here because Trends compares slices against one another rather than
// against fixed target bands.

(function() {
  var MIN_PARTITION = 30;  // floor for any partitioned sub-d
  var MIN_SESSION_HALF = 20; // floor for the session-half split (cap matches sessions.js default)

  // ── SHARED ────────────────────────────────────────────────────────────────

  function safe(num) {
    return (num == null || !isFinite(num)) ? null : num;
  }

  // Per-hand P&L for an analyse() result. d.core.netPnl is the cash net P&L.
  function perHandPnl(sd) {
    if (!sd || !sd.n || !sd.core) return null;
    var net = sd.core.netPnl;
    if (net == null) return null;
    return net / sd.n;
  }

  // Sort hands chronologically. Hands without timestamp drop to the back.
  function chronological(hands) {
    return hands.slice().sort(function(a, b) {
      return (a.timestamp || 0) - (b.timestamp || 0);
    });
  }

  // Compare two metric values and classify the movement.
  // Returns { dir: 'up'|'down'|'flat', delta, abs }.
  function moveOf(early, recent, gate) {
    if (early == null || recent == null) return { dir: 'flat', delta: 0, abs: 0 };
    var delta = recent - early;
    var abs = Math.abs(delta);
    if (abs < gate) return { dir: 'flat', delta: delta, abs: abs };
    return { dir: delta > 0 ? 'up' : 'down', delta: delta, abs: abs };
  }

  // ── STORY 1: DIRECTION OF TRAVEL ──────────────────────────────────────────

  function buildDirectionOfTravel(d, extras, hands) {
    if (!d || !d.n || d.n < (typeof MIN_AGGREGATE === 'number' ? MIN_AGGREGATE : 30)) return null;
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

    // Movement gates. Win rate is in percentage points already; the rest are
    // percentages too. P&L per hand is in chips so gate it relative to
    // typical pot size if we can.
    var moves = {
      vpip: moveOf(safe(dE.core.vpipPct), safe(dR.core.vpipPct), 5),
      pfr:  moveOf(safe(dE.core.pfrPct),  safe(dR.core.pfrPct),  5),
      agg:  moveOf(safe(dE.core.agg),     safe(dR.core.agg),     8),
      wr:   moveOf(safe(dE.core.wr),      safe(dR.core.wr),      5)
    };
    var earlyPerHand = perHandPnl(dE);
    var recentPerHand = perHandPnl(dR);
    moves.pnl = moveOf(earlyPerHand, recentPerHand, 2);

    // Headline opening: state where the player started and where they are.
    var openingText = 'Across your history you have moved from a ' +
      Math.round(dE.core.vpipPct || 0) + '% VPIP early on to ' +
      Math.round(dR.core.vpipPct || 0) + '% in recent hands' +
      (dE.core.wr != null && dR.core.wr != null
        ? ', with a win rate going from ' + Math.round(dE.core.wr) + '% to ' + Math.round(dR.core.wr) + '%.'
        : '.');

    var branchTexts = [];
    var movers = [];
    var keys = ['vpip', 'pfr', 'agg', 'wr', 'pnl'];
    var labels = { vpip: 'VPIP', pfr: 'PFR', agg: 'aggression', wr: 'win rate', pnl: 'per-hand P&L' };
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (moves[k].dir !== 'flat') movers.push({ key: k, move: moves[k] });
    }
    // Sort movers by absolute size of move, biggest first.
    movers.sort(function(a, b) { return b.move.abs - a.move.abs; });

    // Win rate move drives severity.
    var wrMove = moves.wr;
    var pnlMove = moves.pnl;

    // Branch: multiple metrics drifting the same way.
    var sameDirCount = { up: 0, down: 0 };
    for (var mi = 0; mi < movers.length; mi++) {
      if (movers[mi].key === 'wr' || movers[mi].key === 'pnl') continue;
      sameDirCount[movers[mi].move.dir]++;
    }
    var driftDir = null;
    if (sameDirCount.up >= 2) driftDir = 'up';
    else if (sameDirCount.down >= 2) driftDir = 'down';

    if (driftDir) {
      var loud = movers.filter(function(m) {
        return m.key !== 'wr' && m.key !== 'pnl' && m.move.dir === driftDir;
      })[0];
      branchTexts.push(
        'Multiple parts of your game are moving ' + driftDir + ' together. ' +
        'The loudest is ' + labels[loud.key] + ', ' +
        Math.round(dE.core[loud.key === 'pnl' ? 'netPnl' : loud.key === 'wr' ? 'wr' : loud.key === 'agg' ? 'agg' : loud.key + 'Pct'] || 0) +
        (loud.key === 'pnl' ? '' : '%') +
        ' to ' +
        Math.round(dR.core[loud.key === 'pnl' ? 'netPnl' : loud.key === 'wr' ? 'wr' : loud.key === 'agg' ? 'agg' : loud.key + 'Pct'] || 0) +
        (loud.key === 'pnl' ? '' : '%') + '.'
      );
    } else if (movers.filter(function(m) { return m.key !== 'wr' && m.key !== 'pnl'; }).length === 1) {
      // Single metric drift, no others moving.
      var solo = movers.filter(function(m) { return m.key !== 'wr' && m.key !== 'pnl'; })[0];
      branchTexts.push(
        'One metric is shifting while the rest hold steady: ' + labels[solo.key] +
        ' has moved ' + solo.move.dir + ' by ' + Math.round(solo.move.abs) + ' points.'
      );
    }

    // Branch: results following or diverging.
    if (wrMove.dir === 'up') {
      branchTexts.push('Your win rate is climbing, up ' + Math.round(wrMove.abs) + ' points from where you started.');
    } else if (wrMove.dir === 'down') {
      branchTexts.push('Your win rate is dropping, down ' + Math.round(wrMove.abs) + ' points from where you started.');
    } else if (movers.length === 0) {
      // Truly flat. Story stays quiet.
      return null;
    } else {
      branchTexts.push('Your win rate has held steady, even with the changes underneath.');
    }

    // Severity. Red if win rate down meaningfully, amber if drift but win
    // rate flat, green if everything stable.
    var severity;
    var direction;
    if (wrMove.dir === 'down' && wrMove.abs >= 5) { severity = 'r'; direction = 'down'; }
    else if (wrMove.dir === 'down') { severity = 'a'; direction = 'down'; }
    else if (driftDir && wrMove.dir === 'flat') { severity = 'a'; direction = driftDir; }
    else if (wrMove.dir === 'up') { severity = 'g'; direction = 'up'; }
    else { severity = 'g'; direction = 'flat'; }

    // Suppress display for fully green-flat stories.
    if (severity === 'g' && direction === 'flat' && !movers.length) return null;

    // Impact and so-what.
    var impactText = null;
    var soWhatText = null;
    if (severity === 'r' || (severity === 'a' && wrMove.dir === 'down')) {
      impactText = 'Your results are getting worse across your tracked history. Something is moving against you, even if you cannot feel it session to session.';
      if (driftDir) {
        soWhatText = 'Several metrics are drifting at once. Identify what changed in your approach and pull it back to where you were when the results were better.';
      } else {
        soWhatText = 'Look at within-session and across-session play next. The cause is somewhere in how you are running sessions.';
      }
    } else if (severity === 'a' && driftDir) {
      impactText = 'Multiple parts of your game are drifting ' + driftDir + ' without your results moving yet. The win rate has not followed but the early warning is there.';
      soWhatText = 'Pull back the metric that is drifting most before the win rate catches up. ' + labels[movers[0].key] + ' is the one to watch.';
    } else if (severity === 'g' && direction === 'up') {
      impactText = 'Your game is moving in the right direction. Results are following the changes.';
      soWhatText = 'Whatever you are doing differently is working. Keep playing the same way and resist the urge to mix it up while you are in a winning rhythm.';
    }

    // Example hands. Pull from the slice that drives severity.
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
    }

    var deltaUnits = Math.max(wrMove.abs / 10, movers.length ? movers[0].move.abs / 20 : 0);

    return {
      id: 'trends-direction',
      name: 'Direction of Travel',
      panel: 'Tables and Trends',
      sectionId: 'trends',
      severity: severity,
      score: Sections.score(severity, deltaUnits),
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
    };
  }

  // ── STORY 2: SESSION SWINGS ───────────────────────────────────────────────

  function buildSessionSwings(d, extras, hands) {
    if (!d || !d.n || d.n < (typeof MIN_AGGREGATE === 'number' ? MIN_AGGREGATE : 30)) return null;
    if (!hands || !hands.length) return null;
    if (typeof buildSessions !== 'function' || typeof splitSessionHalves !== 'function') return null;

    var sessions = buildSessions(hands);
    if (!sessions.length) return null;

    // Per-session summary: cash hands only for P&L attribution.
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
        ? 'Best session: ' + fmtPnl(bestSession.pnl) + ' across ' + bestSession.len + ' hands. ' +
          'Worst: ' + fmtPnl(worstSession.pnl) + ' across ' + worstSession.len + ' hands.'
        : 'Not enough variation between sessions to compare yet.');

    var branchTexts = [];
    var pillars = []; // { id, severity, deltaUnits, branchText, examples }

    // Pillar A: within-session decline (first half vs second half across sessions).
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
              branchText: 'Across the second half of your sessions, ' + pieces.join(' and ') + '. Your game shifts the longer you sit.',
              examples: null
            };
            // Examples: hands from the second half of sessions.
            var lateHands = halves.secondHalf.slice(-12);
            if (lateHands.length) {
              decline.examples = {
                id: 'sw-late-session',
                label: 'Hands from late in sessions',
                hands: lateHands,
                coachingNote: 'These are hands you played in the second half of long sessions. Look for the patterns that are different from how you played earlier: looser opens, weaker calls, missed value.'
              };
            }
            pillars.push(decline);
          }
        }
      }
    }

    // Pillar B: loose-when-losing pattern (VPIP in losing sessions vs winning).
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
            var direction;
            if (vpipGap >= 5) direction = 'looser';
            else if (vpipGap <= -5) direction = 'tighter';
            else direction = aggGap >= 5 ? 'more aggressive' : 'more passive';

            var swingBranch = 'In losing sessions you play ' + Math.round(vpipLose) + '% of hands, against ' +
              Math.round(vpipWin) + '% in winning sessions. You play ' + direction + ' when you are down.';

            var swingExamples = null;
            // Hands from losing sessions where hero played the pot.
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
              swingExamples = {
                id: 'sw-losing-sessions',
                label: 'Hands played in losing sessions',
                hands: lostPlayed,
                coachingNote: 'Hands you played during losing sessions. Look for the marginal combos you would have folded in a winning session. The gap between the two ranges is the leak.'
              };
            }

            pillars.push({
              id: 'loose-losing',
              severity: swingSev,
              deltaUnits: Math.abs(vpipGap) / 15,
              branchText: swingBranch,
              examples: swingExamples
            });
          }
        }
      }
    }

    // Pillar C: long sessions vs short sessions per-hand P&L.
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
        // Long sessions perform worse: gap > 0 means short are better.
        var longLeakSev = 'g';
        if (gap > 5 && lAgg.perHand < 0) longLeakSev = 'r';
        else if (gap > 2) longLeakSev = 'a';

        if (longLeakSev !== 'g') {
          var avgShort = shortSess.reduce(function(a, b) { return a + b.len; }, 0) / shortSess.length;
          var avgLong = longSess.reduce(function(a, b) { return a + b.len; }, 0) / longSess.length;
          pillars.push({
            id: 'long-session-leak',
            severity: longLeakSev,
            deltaUnits: Math.abs(gap) / 10,
            branchText: 'Short sessions (around ' + Math.round(avgShort) + ' hands) run at ' +
              fmtPnl(sAgg.perHand) + ' per hand. Long sessions (around ' + Math.round(avgLong) +
              ' hands) run at ' + fmtPnl(lAgg.perHand) + ' per hand. The longer you play, the worse it gets.',
            examples: null
          });
        }
      }
    }

    if (!pillars.length) return null;

    for (var pi = 0; pi < pillars.length; pi++) {
      if (pillars[pi].branchText) branchTexts.push(pillars[pi].branchText);
    }

    var severity = Sections.combineSeverity(pillars.map(function(p) { return p.severity; }));

    // Worst case: within-session decline plus long-session leak together.
    var hasDecline = pillars.some(function(p) { return p.id === 'within-session' && (p.severity === 'r' || p.severity === 'a'); });
    var hasLongLeak = pillars.some(function(p) { return p.id === 'long-session-leak' && (p.severity === 'r' || p.severity === 'a'); });
    var hasLooseLosing = pillars.some(function(p) { return p.id === 'loose-losing' && (p.severity === 'r' || p.severity === 'a'); });
    if (hasDecline && hasLongLeak) severity = 'r';

    var impactText = null;
    var soWhatText = null;
    if (hasDecline && hasLongLeak) {
      impactText = 'Your play degrades within sessions and long sessions cost you more per hand than short ones. Session length is the leak.';
      soWhatText = 'Cap your sessions where the curve turns. Take real breaks before the second half starts costing you what the first half earned.';
    } else if (hasLooseLosing && hasDecline) {
      impactText = 'You loosen up when you are down and your game slips later in sessions. The two compound: a losing session widens your range and stretches longer.';
      soWhatText = 'When you notice you are down and have been sitting a while, leave. The fix is at the table exit, not in the technical adjustments.';
    } else if (hasDecline) {
      impactText = 'Your game does not hold up across the length of a session. Concentration, discipline, or both are dropping later on.';
      soWhatText = 'Shorter sessions or scheduled breaks will recover more value than any technical fix.';
    } else if (hasLooseLosing) {
      impactText = 'Your range is shifting with your stack. The hands you add when you are losing are not the hands that win pots.';
      soWhatText = 'Recognise the pattern in the moment. When you are down, hold the starting range you opened with, do not widen to chase.';
    } else if (hasLongLeak) {
      impactText = 'Long sessions perform worse than short ones. The chips you earn early are being given back later.';
      soWhatText = 'Cap session length to roughly the volume of your short sessions. The curve is telling you where to stop.';
    }

    // Merge examples from whichever pillars produced them.
    var examples = [];
    for (var p = 0; p < pillars.length; p++) {
      if (pillars[p].examples) examples.push(pillars[p].examples);
    }

    var topDelta = 0;
    for (var pj = 0; pj < pillars.length; pj++) {
      if (pillars[pj].deltaUnits > topDelta) topDelta = pillars[pj].deltaUnits;
    }

    return {
      id: 'trends-sessions',
      name: 'Session Swings',
      panel: 'Tables and Trends',
      sectionId: 'trends',
      severity: severity,
      score: Sections.score(severity, topDelta),
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
    };
  }

  // ── REGISTER ──────────────────────────────────────────────────────────────

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
