// ── RANGE SECTION ─────────────────────────────────────────────────────────────
//
// Two stories.
//
//   Width of Range  How wide is the player's preflop range? Interrogates the
//                   aggregate VPIP, by seat count, then by position. Target
//                   bands are introduced at the dominant cell.
//
//   Winning Hands   Which specific combos make or lose money? Classifies each
//                   played combo against the recommended range for the
//                   dominant position x seats as play-problem, selection-
//                   problem, monitor, or on-target.
//
// Hand-type interrogation (weak aces overrepresented from EP, etc.) is
// deferred until the parser produces a per-position hand-type slice. Width of
// Range still fires without it.

(function() {
  var MIN_HAND = 10; // floor for any per-cell or per-combo reading

  // ── SHARED ────────────────────────────────────────────────────────────────

  // VPIP for a sub-d (an analyse() result) as a one-decimal percent.
  function vpipOf(sd) {
    if (!sd || !sd.n) return null;
    return (sd.vpip / sd.n) * 100;
  }

  // Sort positions by play count desc.
  function positionsByVolume(d) {
    if (!d || !d.byPosition) return [];
    var rows = [];
    for (var p in d.byPosition) {
      var pd = d.byPosition[p];
      if (!pd || !pd.n) continue;
      rows.push({ position: p, n: pd.n });
    }
    rows.sort(function(a, b) { return b.n - a.n; });
    return rows;
  }

  // ── STORY 1: WIDTH OF RANGE ───────────────────────────────────────────────

  function buildWidthOfRange(d, extras, hands) {
    if (!d || !d.n || d.n < (typeof MIN_AGGREGATE === 'number' ? MIN_AGGREGATE : 30)) return null;

    var seats = dominantSeats(d);
    var dominantPos = (typeof dominantPosition === 'function') ? dominantPosition(d) : null;
    var aggregateVpip = d.core ? d.core.vpipPct : vpipOf(d);
    if (aggregateVpip == null) return null;

    var openingText = 'You play ' + Math.round(aggregateVpip) + '% of hands preflop across ' + d.n + ' hands.';
    var branchTexts = [];
    var notableSeats = [];     // seat buckets that diverge
    var notablePositions = []; // positions that are off target
    var aggregateBand = null;
    var aggregateSeverity = null;
    var aggregateDirection = null;
    var maxDelta = 0;

    // Interrogation: seat count.
    var seatRows = [];
    if (d.bySeatBucket) {
      for (var sb in d.bySeatBucket) {
        var sd = d.bySeatBucket[sb];
        if (!sd || sd.gated || !sd.n) continue;
        var v = vpipOf(sd);
        if (v == null) continue;
        seatRows.push({ key: sb, seats: parseInt(sb, 10), n: sd.n, vpip: v });
      }
    }
    seatRows.sort(function(a, b) { return b.n - a.n; });

    if (seatRows.length >= 2) {
      // Spread between the two largest seat-count buckets.
      var top = seatRows[0], next = seatRows[1];
      var spread = Math.abs(top.vpip - next.vpip);
      if (spread >= 5) {
        branchTexts.push(
          'In ' + top.seats + '-handed games you play ' + Math.round(top.vpip) + '%, ' +
          'compared to ' + Math.round(next.vpip) + '% in ' + next.seats + '-handed games.'
        );
        notableSeats.push(top, next);
      } else {
        branchTexts.push('Your participation is consistent across game sizes.');
      }
    }

    // Interrogation: position. Prefer the per-(position x seats) cross-cut in
    // d.byPosSeat when seats is known; fall back to the position-only slice
    // when it is not. The cross-cut gives precise bands per cell.
    var posSeatsLabel = seats ? seats + '-handed' : null;
    if (typeof TargetBands !== 'undefined') {
      var posReads = [];
      for (var pi = 0; pi < POSITION_ORDER.length; pi++) {
        var p = POSITION_ORDER[pi];
        var pd = null;
        var cellSeats = seats;
        if (seats && d.byPosSeat) {
          var key = p + '|' + seats + 'p';
          pd = d.byPosSeat[key];
          if (!pd || pd.gated || !pd.n) pd = null;
        }
        if (!pd && d.byPosition && d.byPosition[p] && !d.byPosition[p].gated) {
          pd = d.byPosition[p];
          // Without a known seat count, use the dominant overall.
          if (!cellSeats) cellSeats = dominantSeats(d);
        }
        if (!pd) continue;
        var pv = vpipOf(pd);
        if (pv == null) continue;
        var band = cellSeats ? TargetBands.bandFor('vpip', p, cellSeats) : null;
        var sev = Sections.classify(pv, band, null);
        if (!sev) continue;
        posReads.push({ position: p, n: pd.n, vpip: pv, band: band, sev: sev });
      }

      // Find the worst leak by absolute deltaUnits.
      var worst = null;
      for (var wi = 0; wi < posReads.length; wi++) {
        var r = posReads[wi];
        if (r.sev.severity !== 'r' && r.sev.severity !== 'a') continue;
        if (!worst || r.sev.deltaUnits > worst.sev.deltaUnits) worst = r;
      }

      var offPositions = posReads.filter(function(r) {
        return r.sev.severity === 'r' || r.sev.severity === 'a';
      });

      if (offPositions.length === 0 && posReads.length) {
        branchTexts.push('This holds across all positions you play.');
        // Aggregate band reading comes from the dominant cell.
        var dom = posReads.find(function(r) { return r.position === dominantPos; }) || posReads[0];
        aggregateBand = dom.band;
        aggregateSeverity = dom.sev.severity;
        aggregateDirection = dom.sev.direction;
        maxDelta = dom.sev.deltaUnits;
      } else if (offPositions.length >= 2) {
        // Group same-direction misses. Sort worst-first inside each group.
        var highs = offPositions.filter(function(r) { return r.sev.direction === 'high'; })
          .sort(function(a, b) { return b.sev.deltaUnits - a.sev.deltaUnits; });
        var lows  = offPositions.filter(function(r) { return r.sev.direction === 'low'; })
          .sort(function(a, b) { return b.sev.deltaUnits - a.sev.deltaUnits; });
        if (highs.length >= 2) {
          var lbl = joinList(highs.map(function(r) { return r.position + ' (' + Math.round(r.vpip) + '%)'; }));
          branchTexts.push('You play wide from ' + lbl + ', above the ' + Sections.fmtBand(highs[0].band) + ' target for those spots.');
        }
        if (lows.length >= 2) {
          var lblL = joinList(lows.map(function(r) { return r.position + ' (' + Math.round(r.vpip) + '%)'; }));
          branchTexts.push('You play tight from ' + lblL + ', below the ' + Sections.fmtBand(lows[0].band) + ' target for those spots.');
        }
        if (worst) {
          aggregateBand = worst.band;
          aggregateSeverity = worst.sev.severity;
          aggregateDirection = worst.sev.direction;
          maxDelta = worst.sev.deltaUnits;
        }
        notablePositions = offPositions.slice();
      } else if (offPositions.length === 1) {
        var only = offPositions[0];
        var dirWord = only.sev.direction === 'high' ? 'above' : 'below';
        branchTexts.push(
          'From ' + only.position + ' you play ' + Math.round(only.vpip) + '%, ' +
          dirWord + ' the ' + Sections.fmtBand(only.band) + ' target' +
          (posSeatsLabel ? ' for ' + posSeatsLabel : '') + '.'
        );
        aggregateBand = only.band;
        aggregateSeverity = only.sev.severity;
        aggregateDirection = only.sev.direction;
        maxDelta = only.sev.deltaUnits;
        notablePositions = [only];
      }
    }

    // Impact and so-what, keyed by overall direction.
    var impactText = null;
    var soWhatText = null;
    if (aggregateSeverity === 'r' || aggregateSeverity === 'a') {
      if (aggregateDirection === 'high') {
        impactText = 'Playing wide from earlier seats means committing chips before the field acts with hands that cannot stand up to aggression across multiple streets.';
        soWhatText = 'Tighten the seats that are pulling the average up. Pairs, premium broadways, and suited aces only from up front.';
      } else if (aggregateDirection === 'low') {
        impactText = 'Folding too often from late position surrenders the positional advantage those seats are designed to exploit.';
        soWhatText = 'Open wider from the cutoff and button when the action folds to you. Any pair, any suited ace, any broadway, suited connectors.';
      }
    }

    // Severity at the story level.
    var severity = aggregateSeverity || 'g';
    var fired = branchTexts.length > 0 || severity === 'r' || severity === 'a';
    if (!fired) return null;

    // Example hands. Show the worst off-target position's hands so the user
    // can see specifically what to drop (too wide) or what was passed up
    // (too tight).
    var examples = [];
    if (notablePositions && notablePositions.length) {
      var worstPos = notablePositions.slice().sort(function(a, b) {
        return b.sev.deltaUnits - a.sev.deltaUnits;
      })[0];
      if (worstPos && hands) {
        if (worstPos.sev.direction === 'high') {
          var losingPlays = pickHands(hands, function(h) {
            return (h.position || '?') === worstPos.position && heroPlayed(h) && heroLost(h);
          }, 12);
          if (losingPlays.length) {
            examples.push({
              id: 'too-wide-losing-' + worstPos.position,
              label: 'Losing hands you played from ' + worstPos.position,
              hands: losingPlays,
              coachingNote: 'Your ' + worstPos.position + ' play rate is ' + Math.round(worstPos.vpip) +
                '%, above the ' + Sections.fmtBand(worstPos.band) + ' target. ' +
                'These are the hands you played from this seat that lost money. ' +
                'Weak aces, offsuit broadways, and low suited connectors are usually the drops.'
            });
          }
        } else if (worstPos.sev.direction === 'low') {
          var folded = pickHands(hands, function(h) {
            return (h.position || '?') === worstPos.position && heroFoldedPreflop(h);
          }, 12);
          if (folded.length) {
            examples.push({
              id: 'too-tight-' + worstPos.position,
              label: 'Hands folded from ' + worstPos.position,
              hands: folded,
              coachingNote: 'Your ' + worstPos.position + ' play rate is ' + Math.round(worstPos.vpip) +
                '%, below the ' + Sections.fmtBand(worstPos.band) + ' target. These are hands you folded at this seat. ' +
                'Suited connectors, suited aces, and broadways are often the missed opens here.'
            });
          }
        }
      }
    }

    return {
      id: 'width-of-range',
      name: 'Width of Range',
      panel: 'Range',
      sectionId: 'range',
      severity: severity,
      score: Sections.score(severity, maxDelta),
      openingText: openingText,
      branchTexts: branchTexts,
      impactText: impactText,
      soWhatText: soWhatText,
      examples: examples,
      meta: {
        aggregateVpip: aggregateVpip,
        seats: seats,
        dominantPos: dominantPos,
        band: aggregateBand,
        direction: aggregateDirection,
        notableSeats: notableSeats,
        notablePositions: notablePositions
      }
    };
  }

  // ── STORY 2: WINNING HANDS ────────────────────────────────────────────────

  function buildWinningHands(d, extras, hands) {
    if (!d || !d.rangeMap) return null;
    if (!d.n || d.n < (typeof MIN_AGGREGATE === 'number' ? MIN_AGGREGATE : 30)) return null;

    var seats = dominantSeats(d);
    var dominantPos = (typeof dominantPosition === 'function') ? dominantPosition(d) : null;
    var recommended = (seats && dominantPos && typeof TargetBands !== 'undefined')
      ? TargetBands.recommendedHandsFor(dominantPos, seats)
      : null;

    // Best and least profitable hands at any volume (for the opening).
    var bestKey = null, bestPnl = -Infinity, bestPlayed = 0;
    var worstKey = null, worstPnl = Infinity, worstPlayed = 0;
    var classified = { 'play-problem': [], 'selection-problem': [], 'monitor': [], 'on-target': [] };

    for (var k in d.rangeMap) {
      var rm = d.rangeMap[k];
      if (!rm || !rm.played) continue;
      var pnl = rm.pnl || 0;
      if (rm.played >= MIN_HAND) {
        if (pnl > bestPnl) { bestPnl = pnl; bestKey = k; bestPlayed = rm.played; }
        if (pnl < worstPnl) { worstPnl = pnl; worstKey = k; worstPlayed = rm.played; }
      }
      var inside = recommended ? recommended.has(k) : null;
      var bucket = (typeof PnlSlice !== 'undefined')
        ? PnlSlice.classifyHand({ insideRange: inside, pnl: pnl, sample: rm.played, opts: { minSample: MIN_HAND } })
        : 'skip';
      if (bucket === 'skip') continue;
      classified[bucket].push({ key: k, played: rm.played, pnl: pnl, dealt: rm.dealt || 0 });
    }

    var openingText;
    if (bestKey && worstKey && bestKey !== worstKey) {
      openingText = 'Your most profitable combo is ' + bestKey + ' (' + fmtPnl(bestPnl) + ' across ' + bestPlayed + ' hands). ' +
        'Your least profitable is ' + worstKey + ' (' + fmtPnl(worstPnl) + ' across ' + worstPlayed + ' hands).';
    } else if (bestKey) {
      openingText = 'Your most profitable combo so far is ' + bestKey + ' (' + fmtPnl(bestPnl) + ' across ' + bestPlayed + ' hands).';
    } else {
      // Nothing has hit the per-combo floor.
      return null;
    }

    var branchTexts = [];
    var fired = false;

    // Sort each bucket by absolute P&L impact so the loudest combos lead.
    function sortByImpact(arr) {
      return arr.slice().sort(function(a, b) { return Math.abs(b.pnl) - Math.abs(a.pnl); });
    }

    if (classified['play-problem'].length) {
      fired = true;
      var pp = sortByImpact(classified['play-problem']).slice(0, 3);
      var ppText = pp.map(function(h) { return h.key + ' (' + fmtPnl(h.pnl) + ')'; }).join(', ');
      branchTexts.push('Inside your target range but losing: ' + ppText + '. Selection is right; the postflop execution is leaking.');
    }
    if (classified['selection-problem'].length) {
      fired = true;
      var sp = sortByImpact(classified['selection-problem']).slice(0, 3);
      var spText = sp.map(function(h) { return h.key + ' (' + fmtPnl(h.pnl) + ')'; }).join(', ');
      branchTexts.push('Outside your target range and losing: ' + spText + '. These combos have no profitable home in your game.');
    }
    if (classified['monitor'].length) {
      var mn = sortByImpact(classified['monitor']).slice(0, 3);
      var mnText = mn.map(function(h) { return h.key + ' (' + fmtPnl(h.pnl) + ')'; }).join(', ');
      branchTexts.push('Outside your target range but profitable so far: ' + mnText + '. Worth watching as sample grows.');
    }

    if (!recommended) {
      branchTexts.push('No recommended range matched the dominant seat and position, so combos cannot be split into selection vs play problems yet.');
    }

    var severity = 'n';
    if (classified['selection-problem'].length) severity = 'r';
    else if (classified['play-problem'].length) severity = 'a';
    else if (classified['monitor'].length) severity = 'g';

    var impactText = null;
    var soWhatText = null;
    if (classified['selection-problem'].length) {
      impactText = 'Hands you cannot play profitably appear in your range. They cost chips every time they show up.';
      soWhatText = 'Drop the combos flagged as selection problems from the seats where you played them. They have no edge in your spots.';
    } else if (classified['play-problem'].length) {
      impactText = 'The right hands are reaching the flop but losing money. The leak is postflop, not preflop.';
      soWhatText = 'Review the play-problem combos in the Streets and Bets sections. Selection is fine; execution is the fix.';
    }

    if (!fired && severity === 'n') return null;

    // Example hands per problem bucket, plus a "best combo" group for the
    // headline. Each group filters the global hand set by hole-card key.
    var examples = [];
    function comboHands(combos) {
      var keys = {};
      for (var i = 0; i < combos.length; i++) keys[combos[i].key] = true;
      return pickHands(hands, function(h) {
        var hk = (typeof parseHoleKey === 'function') ? parseHoleKey(h.hole) : null;
        return hk && keys[hk] && heroPlayed(h);
      }, 15);
    }
    var pps = sortByImpact(classified['play-problem']).slice(0, 3);
    if (pps.length) {
      var ppHands = comboHands(pps);
      if (ppHands.length) {
        examples.push({
          id: 'wh-play-problem',
          label: 'Losing inside-range combos',
          hands: ppHands,
          coachingNote: 'These are combos inside your target range that are losing. Selection is right; the leak is in how you play them postflop. Watch turn and river decisions.'
        });
      }
    }
    var sps = sortByImpact(classified['selection-problem']).slice(0, 3);
    if (sps.length) {
      var spHands = comboHands(sps);
      if (spHands.length) {
        examples.push({
          id: 'wh-selection-problem',
          label: 'Losing outside-range combos',
          hands: spHands,
          coachingNote: 'These combos are outside your target range and losing. They have no profitable home from the seat you played them. Drop them.'
        });
      }
    }
    if (bestKey) {
      var bestHands = comboHands([{ key: bestKey }]);
      if (bestHands.length) {
        examples.push({
          id: 'wh-best',
          label: 'Hands with ' + bestKey,
          hands: bestHands,
          coachingNote: 'Your most profitable combo so far. Keep playing it confidently; watch the sample size before reading too much into the number.'
        });
      }
    }

    return {
      id: 'winning-hands',
      name: 'Winning Hands',
      panel: 'Range',
      sectionId: 'range',
      severity: severity,
      score: Sections.score(severity, 0),
      openingText: openingText,
      branchTexts: branchTexts,
      impactText: impactText,
      soWhatText: soWhatText,
      examples: examples,
      meta: {
        best: bestKey ? { key: bestKey, pnl: bestPnl, played: bestPlayed } : null,
        worst: worstKey ? { key: worstKey, pnl: worstPnl, played: worstPlayed } : null,
        classified: classified,
        seats: seats,
        dominantPos: dominantPos
      }
    };
  }

  // Join a list of strings as "A", "A and B", or "A, B, and C". The "and" form
  // reads cleanly for 2; the comma list with a final "and" reads cleanly for 3+.
  function joinList(items) {
    if (!items || !items.length) return '';
    if (items.length === 1) return items[0];
    if (items.length === 2) return items[0] + ' and ' + items[1];
    return items.slice(0, -1).join(', ') + ', and ' + items[items.length - 1];
  }

  // ── REGISTER ──────────────────────────────────────────────────────────────

  Sections.defineSection({
    id: 'range',
    panel: 'Range',
    run: function(d, extras, hands) {
      var out = [];
      var w = buildWidthOfRange(d, extras, hands);
      if (w) out.push(w);
      var h = buildWinningHands(d, extras, hands);
      if (h) out.push(h);
      return out;
    }
  });
})();
