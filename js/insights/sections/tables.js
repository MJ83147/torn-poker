// ── TABLES SECTION ────────────────────────────────────────────────────────────
//
// Two stories.
//
//   Table Selection  Group hands by table and read volume vs P&L. Flag when
//                    most volume sits at losing tables, when a winning table
//                    is under-played, when one table dominates the picture,
//                    or confirms an even spread.
//
//   Time at Table    Bucket sessions by length and compare win rate and P&L
//                    between long and short sessions. Flag when long sessions
//                    are clearly worse than short ones.

(function() {
  var MIN_TABLE_CELL = (typeof MIN_CELL === 'number') ? MIN_CELL : 10;
  var MIN_AGG = (typeof MIN_AGGREGATE === 'number') ? MIN_AGGREGATE : 30;

  // ── SHARED HELPERS ────────────────────────────────────────────────────────

  function safePct(num, den) {
    if (!den) return null;
    return Math.round((num / den) * 1000) / 10;
  }

  function tablePnl(handsList) {
    var total = 0;
    for (var i = 0; i < handsList.length; i++) {
      total += getHandPnlValue(handsList[i]) || 0;
    }
    return total;
  }

  // Win count over hands with an outcome (matches the rest of the codebase).
  function tableWinRate(handsList) {
    var withOutcome = 0;
    var won = 0;
    for (var i = 0; i < handsList.length; i++) {
      var h = handsList[i];
      if (!h.outcome) continue;
      withOutcome++;
      if (h.outcome.result === 'won') won++;
    }
    return safePct(won, withOutcome);
  }

  function joinList(items) {
    if (!items || !items.length) return '';
    if (items.length === 1) return items[0];
    if (items.length === 2) return items[0] + ' and ' + items[1];
    return items.slice(0, -1).join(', ') + ', and ' + items[items.length - 1];
  }

  // ── STORY 1: TABLE SELECTION ──────────────────────────────────────────────

  function buildTableSelection(d, extras, hands) {
    if (!d || !d.n || d.n < MIN_AGG) return null;
    if (!hands || !hands.length) return null;

    // Group hands by inferred table id.
    var groups = {};
    for (var i = 0; i < hands.length; i++) {
      var h = hands[i];
      var tid = inferTable(h);
      var key = tid != null ? String(tid) : 'unknown';
      if (!groups[key]) groups[key] = { tid: tid, key: key, hands: [] };
      groups[key].hands.push(h);
    }

    // Build rows. Keep tables with at least MIN_TABLE_CELL hands for the
    // leak gate; tables below the floor are tracked but excluded from
    // dominance and volume comparisons.
    var allRows = [];
    var rows = [];
    for (var k in groups) {
      var g = groups[k];
      var pnl = tablePnl(g.hands);
      var wr = tableWinRate(g.hands);
      var row = {
        tid: g.tid,
        key: g.key,
        label: g.tid != null ? getTableLabel(g.tid) : 'Unknown',
        n: g.hands.length,
        pnl: pnl,
        wr: wr,
        hands: g.hands
      };
      allRows.push(row);
      if (row.n >= MIN_TABLE_CELL) rows.push(row);
    }

    if (rows.length < 2) return null;

    var totalHands = 0;
    var totalPnl = 0;
    for (var r1 = 0; r1 < rows.length; r1++) {
      totalHands += rows[r1].n;
      totalPnl += rows[r1].pnl;
    }
    if (!totalHands) return null;

    // Sort copies for downstream reads.
    var byPnl = rows.slice().sort(function(a, b) { return b.pnl - a.pnl; });
    var byVolume = rows.slice().sort(function(a, b) { return b.n - a.n; });
    var winners = rows.filter(function(r) { return r.pnl > 0; });
    var losers  = rows.filter(function(r) { return r.pnl < 0; });

    var best = byPnl[0];
    var worst = byPnl[byPnl.length - 1];

    // Volume at losing vs winning tables.
    var volWin = 0;
    var volLose = 0;
    for (var v1 = 0; v1 < rows.length; v1++) {
      if (rows[v1].pnl > 0) volWin += rows[v1].n;
      else if (rows[v1].pnl < 0) volLose += rows[v1].n;
    }
    var loseShare = totalHands > 0 ? (volLose / totalHands) : 0;
    var winShare  = totalHands > 0 ? (volWin / totalHands) : 0;

    // Dominance: one table accounts for > 60% of absolute P&L.
    var absPnlTotal = 0;
    for (var v2 = 0; v2 < rows.length; v2++) absPnlTotal += Math.abs(rows[v2].pnl);
    var dominantTable = null;
    var dominantShare = 0;
    if (absPnlTotal > 0) {
      for (var v3 = 0; v3 < rows.length; v3++) {
        var share = Math.abs(rows[v3].pnl) / absPnlTotal;
        if (share > dominantShare) { dominantShare = share; dominantTable = rows[v3]; }
      }
      if (dominantShare < 0.6) dominantTable = null;
    }

    // Under-played winners: tables in the top quartile by win rate or P&L
    // but in the bottom half by volume.
    var byWr = rows.filter(function(r) { return r.wr != null; })
      .slice()
      .sort(function(a, b) { return b.wr - a.wr; });
    var underplayedWinner = null;
    if (winners.length >= 2 && byVolume.length >= 2) {
      var medianVol = byVolume[Math.floor(byVolume.length / 2)].n;
      for (var u = 0; u < winners.length; u++) {
        var w = winners[u];
        if (w.n < medianVol && (best && w.key === best.key || (w.wr != null && byWr.length && w.key === byWr[0].key))) {
          if (!underplayedWinner || w.pnl > underplayedWinner.pnl) underplayedWinner = w;
        }
      }
    }

    // Build narrative.
    var openingText;
    if (best && worst && best.key !== worst.key) {
      openingText = 'Across ' + rows.length + ' tables with at least ' + MIN_TABLE_CELL + ' hands, ' +
        'your most profitable is ' + best.label + ' (' + fmtPnl(best.pnl) + ' over ' + best.n + ' hands) ' +
        'and your worst is ' + worst.label + ' (' + fmtPnl(worst.pnl) + ' over ' + worst.n + ' hands).';
    } else if (best) {
      openingText = 'Across ' + rows.length + ' tables, your strongest is ' + best.label +
        ' (' + fmtPnl(best.pnl) + ' over ' + best.n + ' hands).';
    } else {
      return null;
    }

    var branchTexts = [];
    var severity = 'g';
    var deltaUnits = 0;
    var fired = false;
    var primaryPattern = null; // 'volume-losing' | 'dominant-loser' | 'dominant-winner' | 'underplayed' | 'even'

    // Branch: most volume at losing tables.
    if (losers.length && loseShare >= 0.6) {
      fired = true;
      severity = 'r';
      deltaUnits = Math.max(deltaUnits, (loseShare - 0.5) * 4);
      primaryPattern = 'volume-losing';
      branchTexts.push(
        Math.round(loseShare * 100) + '% of your hands are at tables where you are down on the count. ' +
        'The bulk of your volume sits at losing tables.'
      );
    } else if (winners.length && winShare >= 0.6) {
      branchTexts.push(
        Math.round(winShare * 100) + '% of your hands are at tables where you are up on the count. ' +
        'Volume is going where you win.'
      );
    }

    // Branch: one table dominates.
    if (dominantTable) {
      fired = true;
      if (dominantTable.pnl < 0) {
        if (severity !== 'r') severity = 'r';
        deltaUnits = Math.max(deltaUnits, (dominantShare - 0.5) * 4);
        if (!primaryPattern) primaryPattern = 'dominant-loser';
        branchTexts.push(
          dominantTable.label + ' accounts for ' + Math.round(dominantShare * 100) +
          '% of your total swing, and it is losing (' + fmtPnl(dominantTable.pnl) + ' over ' +
          dominantTable.n + ' hands). One table is dragging the picture.'
        );
      } else {
        if (severity === 'g') severity = 'a';
        deltaUnits = Math.max(deltaUnits, (dominantShare - 0.5) * 2);
        if (!primaryPattern) primaryPattern = 'dominant-winner';
        branchTexts.push(
          dominantTable.label + ' accounts for ' + Math.round(dominantShare * 100) +
          '% of your total swing, and it is winning (' + fmtPnl(dominantTable.pnl) + ' over ' +
          dominantTable.n + ' hands). One table is carrying the picture.'
        );
      }
    }

    // Branch: under-played winners.
    if (underplayedWinner && (!primaryPattern || primaryPattern === 'volume-losing')) {
      fired = true;
      if (severity === 'g') severity = 'a';
      deltaUnits = Math.max(deltaUnits, 0.5);
      if (!primaryPattern) primaryPattern = 'underplayed';
      branchTexts.push(
        underplayedWinner.label + ' is profitable (' + fmtPnl(underplayedWinner.pnl) + ' over ' +
        underplayedWinner.n + ' hands) but gets less volume than your average table. There is an edge here that you are not using.'
      );
    }

    // Branch: even spread when nothing else fired.
    if (!fired) {
      var pnlRange = Math.abs(best.pnl - worst.pnl);
      var perHandRange = totalHands > 0 ? pnlRange / totalHands : 0;
      branchTexts.push('P&L is spread evenly across the tables you play. No single environment is making or breaking your results.');
      primaryPattern = 'even';
      severity = 'g';
    }

    // Impact and so what.
    var impactText = null;
    var soWhatText = null;
    if (primaryPattern === 'volume-losing') {
      impactText = 'You are spending most of your time at tables where you lose. The selection is upside down: the games that beat you are the ones you keep sitting at.';
      soWhatText = 'Stop sitting at the losing tables and move volume to the ones where you win. Selection is the cheapest fix in poker.';
    } else if (primaryPattern === 'dominant-loser') {
      impactText = 'A single table is dragging your results. Without it, the overall picture would look fine.';
      soWhatText = 'Drop ' + (dominantTable ? dominantTable.label : 'that table') + '. There is no edge to recover at a table this far underwater.';
    } else if (primaryPattern === 'dominant-winner') {
      impactText = 'A single table is carrying your results. The general picture of your game is not as strong as the headline number.';
      soWhatText = 'Understand what makes ' + (dominantTable ? dominantTable.label : 'that table') + ' different and look for similar games. Do not assume the edge transfers.';
    } else if (primaryPattern === 'underplayed') {
      impactText = 'The tables you win at most, you barely play. You have found edges and walked away from them.';
      soWhatText = 'Put more volume at ' + (underplayedWinner ? underplayedWinner.label : 'the winning tables') + '. The data already says where your time is best spent.';
    } else if (primaryPattern === 'even') {
      impactText = 'Selection is not the story. Your game travels evenly across tables.';
      soWhatText = 'The leak, if there is one, is in your play, not your choice of table.';
    }

    // Example hands. Worst-table examples surface LOSING hands at that table;
    // best-table examples surface WINNING hands. The contrast is the point.
    var examples = [];
    function tableMatches(h, id) {
      var t = inferTable(h);
      return String(t != null ? t : 'unknown') === id;
    }
    if (worst && worst.hands && worst.hands.length) {
      var worstId = String(worst.key);
      var worstLosses = pickHands(hands, function(h) { return tableMatches(h, worstId) && heroLost(h); }, 15);
      if (worstLosses.length) {
        examples.push({
          id: 'tbl-worst-losses-' + worstId,
          label: 'Losing hands at ' + worst.label,
          hands: worstLosses,
          coachingNote: 'Your worst table by P&L: ' + fmtPnl(worst.pnl) + ' over ' + worst.n + ' hands. ' +
            'These are the hands you lost at this table. Look for the pattern. If you cannot find one, the answer is simpler: stop sitting here.'
        });
      }
    }
    if (best && best.hands && best.hands.length && best.key !== (worst && worst.key)) {
      var bestId = String(best.key);
      var bestWins = pickHands(hands, function(h) { return tableMatches(h, bestId) && heroWon(h); }, 10);
      if (bestWins.length) {
        examples.push({
          id: 'tbl-best-wins-' + bestId,
          label: 'Winning hands at ' + best.label,
          hands: bestWins,
          coachingNote: 'Your most profitable table: ' + fmtPnl(best.pnl) + ' over ' + best.n + ' hands. ' +
            'These are the wins at this table. Whatever is working here is the model. Look for similar games and put more volume into them.'
        });
      }
    }

    return {
      id: 'tables-selection',
      name: 'Table Selection',
      panel: 'Tables',
      sectionId: 'tables',
      severity: severity,
      score: Sections.score(severity, deltaUnits),
      openingText: openingText,
      branchTexts: branchTexts,
      impactText: impactText,
      soWhatText: soWhatText,
      examples: examples,
      meta: {
        rows: rows,
        best: best,
        worst: worst,
        dominantTable: dominantTable,
        dominantShare: dominantShare,
        loseShare: loseShare,
        winShare: winShare,
        primaryPattern: primaryPattern
      }
    };
  }

  // ── STORY 2: TIME AT TABLE ────────────────────────────────────────────────

  function buildTimeAtTable(d, extras, hands) {
    if (!d || !d.n || d.n < MIN_AGG) return null;
    if (!hands || !hands.length) return null;
    if (typeof buildSessions !== 'function') return null;

    var sessions = buildSessions(hands);
    if (!sessions || sessions.length < 4) return null;

    // Augment each session with P&L and win rate.
    var rows = [];
    for (var i = 0; i < sessions.length; i++) {
      var s = sessions[i];
      var sHands = s.hands || [];
      if (!sHands.length) continue;
      var pnl = tablePnl(sHands);
      var wr = tableWinRate(sHands);
      rows.push({
        tid: s.tableId,
        label: s.tableId != null ? getTableLabel(s.tableId) : 'Unknown',
        n: sHands.length,
        pnl: pnl,
        wr: wr,
        hands: sHands
      });
    }
    if (rows.length < 4) return null;

    // Quartile-bucket sessions by length.
    var byLen = rows.slice().sort(function(a, b) { return a.n - b.n; });
    var q1Idx = Math.max(0, Math.floor(byLen.length * 0.25) - 1);
    var q3Idx = Math.min(byLen.length - 1, Math.ceil(byLen.length * 0.75) - 1);
    var shortCut = byLen[q1Idx].n;
    var longCut = byLen[q3Idx].n;
    // Guard against degenerate buckets when many sessions share a length.
    if (longCut <= shortCut) longCut = shortCut + 1;

    var shortBucket = byLen.filter(function(s) { return s.n <= shortCut; });
    var longBucket  = byLen.filter(function(s) { return s.n >= longCut; });
    if (shortBucket.length < 2 || longBucket.length < 2) return null;

    function bucketStats(bucket) {
      var totalHands = 0;
      var totalPnl = 0;
      var withOutcome = 0;
      var won = 0;
      for (var i = 0; i < bucket.length; i++) {
        var s = bucket[i];
        totalHands += s.n;
        totalPnl += s.pnl;
        for (var j = 0; j < s.hands.length; j++) {
          var h = s.hands[j];
          if (!h.outcome) continue;
          withOutcome++;
          if (h.outcome.result === 'won') won++;
        }
      }
      return {
        sessions: bucket.length,
        hands: totalHands,
        pnl: totalPnl,
        wr: safePct(won, withOutcome),
        perHand: totalHands > 0 ? totalPnl / totalHands : 0,
        perSession: bucket.length > 0 ? totalPnl / bucket.length : 0
      };
    }

    var shortStats = bucketStats(shortBucket);
    var longStats  = bucketStats(longBucket);
    if (shortStats.hands < MIN_TABLE_CELL || longStats.hands < MIN_TABLE_CELL) return null;

    var wrGap = (shortStats.wr != null && longStats.wr != null) ? (shortStats.wr - longStats.wr) : null;
    var perHandGap = shortStats.perHand - longStats.perHand;

    var openingText = 'You played ' + rows.length + ' sessions in this data. ' +
      'Short sessions (' + shortBucket.length + ' sessions, up to ' + shortCut + ' hands each) ran at ' +
      (shortStats.wr != null ? shortStats.wr + '% win rate' : 'no clear win rate') + ' for ' + fmtPnl(shortStats.pnl) + ' total. ' +
      'Long sessions (' + longBucket.length + ' sessions, ' + longCut + ' hands or more) ran at ' +
      (longStats.wr != null ? longStats.wr + '% win rate' : 'no clear win rate') + ' for ' + fmtPnl(longStats.pnl) + ' total.';

    var branchTexts = [];
    var severity = 'g';
    var deltaUnits = 0;
    var fired = false;
    var pattern = null; // 'long-leak' | 'long-soft' | 'even'

    // Win rate gap.
    if (wrGap != null) {
      if (wrGap >= 10) {
        fired = true;
        severity = 'r';
        deltaUnits = Math.max(deltaUnits, wrGap / 10);
        pattern = 'long-leak';
        branchTexts.push(
          'Your long-session win rate is ' + Math.round(wrGap) +
          ' points below your short-session win rate. Stamina or focus drops the longer you sit.'
        );
      } else if (wrGap >= 4) {
        fired = true;
        if (severity === 'g') severity = 'a';
        deltaUnits = Math.max(deltaUnits, wrGap / 10);
        pattern = pattern || 'long-soft';
        branchTexts.push(
          'Long sessions win at a slightly lower rate than short ones (a ' + Math.round(wrGap) +
          ' point gap). The trend is mild but present.'
        );
      }
    }

    // Per-hand P&L gap.
    if (perHandGap > 0 && longStats.perHand < 0 && shortStats.perHand >= 0) {
      fired = true;
      severity = 'r';
      deltaUnits = Math.max(deltaUnits, 1);
      pattern = 'long-leak';
      branchTexts.push(
        'Short sessions are profitable per hand. Long sessions are not. The longer you stay, the worse each hand returns.'
      );
    } else if (perHandGap > 0 && longStats.pnl < 0 && shortStats.pnl >= 0) {
      fired = true;
      if (severity === 'g') severity = 'a';
      deltaUnits = Math.max(deltaUnits, 0.5);
      pattern = pattern || 'long-soft';
      branchTexts.push(
        'Short sessions are net profitable. Long sessions are net losing. Length is correlated with the move from green to red.'
      );
    }

    if (!fired) {
      branchTexts.push('Win rate and P&L are roughly the same in long and short sessions. Session length is not the lever.');
      pattern = 'even';
    }

    var impactText = null;
    var soWhatText = null;
    if (pattern === 'long-leak') {
      impactText = 'Sitting longer is making your game worse, not better. Fatigue and tilt show up in the second half of the sessions you stay in.';
      soWhatText = 'Set a session length cap and stick to it. The data says the marginal hand at the end of a long session is a losing hand on average.';
    } else if (pattern === 'long-soft') {
      impactText = 'The longer you play, the lower the return on each hand. It is not yet a leak but it is a trend.';
      soWhatText = 'Watch how you feel through the second half of long sessions. The slip is small but consistent.';
    } else {
      impactText = 'Session length is not affecting your game. You play roughly the same hand whether you sit for 30 or 300.';
      soWhatText = 'Time at the table is not where to look for the next adjustment.';
    }

    // Example hands: from long losing sessions.
    var examples = [];
    if (pattern === 'long-leak' || pattern === 'long-soft') {
      var longLosingHands = [];
      var longLosingSessions = longBucket.filter(function(s) { return s.pnl < 0; });
      for (var li = 0; li < longLosingSessions.length && longLosingHands.length < 12; li++) {
        var ls = longLosingSessions[li];
        // Pull the back half of each long losing session: that is where the
        // slip shows up in the spec.
        var midpoint = Math.floor(ls.hands.length / 2);
        for (var lh = midpoint; lh < ls.hands.length && longLosingHands.length < 12; lh++) {
          longLosingHands.push(ls.hands[lh]);
        }
      }
      if (longLosingHands.length) {
        examples.push({
          id: 'time-long-losing',
          label: 'Hands from the back half of long losing sessions',
          hands: longLosingHands,
          coachingNote: 'These are hands from the second half of your longer losing sessions. ' +
            'Look for forced calls, tired bluffs, and sticky river decisions. The pattern that hurts long sessions usually shows up here.'
        });
      }
    }

    return {
      id: 'tables-time',
      name: 'Time at Table',
      panel: 'Tables',
      sectionId: 'tables',
      severity: severity,
      score: Sections.score(severity, deltaUnits),
      openingText: openingText,
      branchTexts: branchTexts,
      impactText: impactText,
      soWhatText: soWhatText,
      examples: examples,
      meta: {
        shortCut: shortCut,
        longCut: longCut,
        shortStats: shortStats,
        longStats: longStats,
        wrGap: wrGap,
        perHandGap: perHandGap,
        pattern: pattern
      }
    };
  }

  // ── REGISTER ──────────────────────────────────────────────────────────────

  Sections.defineSection({
    id: 'tables',
    panel: 'Tables',
    run: function(d, extras, hands) {
      var out = [];
      var sel = buildTableSelection(d, extras, hands);
      if (sel) out.push(sel);
      var tat = buildTimeAtTable(d, extras, hands);
      if (tat) out.push(tat);
      return out;
    }
  });
})();
