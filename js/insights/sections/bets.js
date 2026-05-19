// ── BETS SECTION ──────────────────────────────────────────────────────────────
//
// Three stories.
//
//   Bet Sizing Shape       What does the player's bet sizing distribution
//                          look like per street? Scattered, single-size, or
//                          sensibly varied?
//
//   Value vs Bluff Sizing  MVP only: does bet size correlate with eventual
//                          showdown outcome? Without hand-strength-at-decision
//                          data we infer retrospectively from whether the
//                          hand won. If the signal is too noisy we skip.
//
//   Response to Sizing     When the player faces a bet, do their fold/call/
//                          raise frequencies scale sensibly with the size of
//                          the bet faced?
//
// Sizing is normalised to "fraction of pot at bet time" by walking each hand's
// action stream and tracking the running pot. That gives a workable
// approximation without rebuilding the whole pot-tracker pipeline. Bets where
// we cannot recover a pot context (hand's first action, missing amount, etc.)
// are dropped.
//
// Pillars deferred because the data is not aggregated yet:
//   - Bet Sizing Shape:    players-in-pot and board-texture splits.
//   - Value vs Bluff:      hand-strength-at-decision (not derivable without
//                          a board evaluator on every street). Only the
//                          retrospective showdown-outcome MVP fires.
//   - Response to Sizing:  street, position, players-in-pot, board-texture,
//                          and hand-strength splits.

(function() {
  var MIN_AGG = (typeof MIN_AGGREGATE === 'number') ? MIN_AGGREGATE : 30;
  var MIN_CELL_LOCAL = (typeof MIN_CELL === 'number') ? MIN_CELL : 10;

  // ── HELPERS ────────────────────────────────────────────────────────────────

  function mean(arr) {
    if (!arr || !arr.length) return 0;
    var t = 0;
    for (var i = 0; i < arr.length; i++) t += arr[i];
    return t / arr.length;
  }

  // Coefficient of variation (stddev / mean). Used to flag "scattered" sizing.
  function cov(arr) {
    if (!arr || arr.length < 3) return 0;
    var m = mean(arr);
    if (m <= 0) return 0;
    var v = 0;
    for (var i = 0; i < arr.length; i++) {
      var d = arr[i] - m;
      v += d * d;
    }
    var sd = Math.sqrt(v / arr.length);
    return sd / m;
  }

  // Walk a hand's actions and compute, for each hero bet/raise, the bet as a
  // fraction of the pot at the time the bet went in. Also for each bet the
  // hero faced. Returns { heroBets: [...], facedBets: [...] }.
  // Each entry: { street, amount, potBefore, fracOfPot, response? }.
  //
  // Caveat: amounts in raise lines parse as the "to" total (e.g. "raised $200
  // to $500"), but for our purposes - sizing relative to pot - we treat the
  // recorded amount as the chips going in at that step. This is rough but
  // consistent across hands. Hands with no parseable pot context are skipped.
  function walkHandForSizing(h) {
    var out = { heroBets: [], facedBets: [] };
    if (!h || !h.actions) return out;
    var acts = parseActions(h.actions);
    if (!acts.length) return out;

    var pot = 0;
    for (var i = 0; i < acts.length; i++) {
      var a = acts[i];
      // Blinds seed the pot but are not bets we read.
      if (a.type === 'sb' || a.type === 'bb' || a.type === 'won') {
        if (a.amount > 0) pot += a.amount;
        continue;
      }
      if (a.type === 'fold' || a.type === 'check') continue;

      var potBefore = pot;
      if (a.type === 'bet' || a.type === 'raise') {
        if (potBefore > 0 && a.amount > 0) {
          var frac = a.amount / potBefore;
          if (a.isMe) {
            out.heroBets.push({ street: a.street, amount: a.amount, potBefore: potBefore, fracOfPot: frac });
          } else {
            // Look ahead for hero's response on this street to this bet.
            var resp = null;
            for (var j = i + 1; j < acts.length; j++) {
              if (acts[j].street !== a.street) break;
              if (acts[j].isMe) {
                if (acts[j].type === 'fold') resp = 'fold';
                else if (acts[j].type === 'call') resp = 'call';
                else if (acts[j].type === 'raise' || acts[j].type === 'bet') resp = 'raise';
                break;
              }
            }
            if (resp) {
              out.facedBets.push({ street: a.street, amount: a.amount, potBefore: potBefore, fracOfPot: frac, response: resp });
            }
          }
        }
        pot += a.amount;
      } else if (a.type === 'call' && a.amount > 0) {
        pot += a.amount;
      }
    }
    return out;
  }

  // Group hero bets by street.
  function groupByStreet(rows) {
    var g = { Preflop: [], Flop: [], Turn: [], River: [] };
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (g[r.street]) g[r.street].push(r);
    }
    return g;
  }

  // Bucket a fraction-of-pot reading into a size band.
  function sizeBand(frac) {
    if (frac < 0.33) return 'small';      // under 33%
    if (frac < 0.66) return 'medium';     // 33-66%
    if (frac <= 1.0) return 'big';        // 66-100%
    return 'overbet';                     // overbet
  }

  var BAND_LABELS = {
    small: 'small (under 33% pot)',
    medium: 'medium (33-66% pot)',
    big: 'big (66-100% pot)',
    overbet: 'overbet (above pot)'
  };
  var BAND_SHORT = {
    small: 'small bets',
    medium: 'medium bets',
    big: 'big bets',
    overbet: 'overbets'
  };

  // Severity escalation: combine local pillar severities into a worst-wins.
  function worst(severities) {
    var rank = { r: 4, a: 3, n: 2, g: 1 };
    var best = 'g';
    var bestRank = 1;
    for (var i = 0; i < severities.length; i++) {
      var s = severities[i];
      if (!s) continue;
      var r = rank[s] || 0;
      if (r > bestRank) { bestRank = r; best = s; }
    }
    return best;
  }

  // ── STORY 1: BET SIZING SHAPE ──────────────────────────────────────────────

  function buildSizingShape(d, extras, hands) {
    if (!d || !d.n || d.n < MIN_AGG) return null;
    if (!hands || !hands.length) return null;

    // Walk every hand once and collect hero bets with pot context.
    var heroBets = [];
    for (var i = 0; i < hands.length; i++) {
      var w = walkHandForSizing(hands[i]);
      for (var k = 0; k < w.heroBets.length; k++) heroBets.push(w.heroBets[k]);
    }
    if (heroBets.length < MIN_CELL_LOCAL) return null;

    var byStreet = groupByStreet(heroBets);

    // Per-street read: dominant cluster, scatter, single-size.
    var streetReads = [];
    var overallFracs = [];
    for (var s = 1; s < STREETS.length; s++) { // skip Preflop in shape read
      var street = STREETS[s];
      var rows = byStreet[street];
      if (!rows || rows.length < MIN_CELL_LOCAL) continue;
      var fracs = rows.map(function(r) { return r.fracOfPot; });
      for (var fi = 0; fi < fracs.length; fi++) overallFracs.push(fracs[fi]);
      var avg = mean(fracs);
      var spread = cov(fracs);
      // Bucket counts to find a dominant cluster.
      var bandCounts = { small: 0, medium: 0, big: 0, overbet: 0 };
      for (var bi = 0; bi < fracs.length; bi++) bandCounts[sizeBand(fracs[bi])]++;
      var topBand = null, topCount = 0;
      for (var b in bandCounts) {
        if (bandCounts[b] > topCount) { topCount = bandCounts[b]; topBand = b; }
      }
      var topShare = topCount / fracs.length;
      streetReads.push({
        street: street,
        n: rows.length,
        avg: avg,
        cov: spread,
        topBand: topBand,
        topShare: topShare,
        bandCounts: bandCounts
      });
    }

    if (!streetReads.length) return null;

    // Aggregate read across all post-flop streets.
    var overallAvg = mean(overallFracs);
    var openingText = 'Across ' + heroBets.length + ' bets, your average sizing is ' +
      Math.round(overallAvg * 100) + '% of pot.';

    var branchTexts = [];
    var scatteredStreets = [];
    var singleSizeStreets = [];
    var sensibleStreets = [];

    for (var ri = 0; ri < streetReads.length; ri++) {
      var r = streetReads[ri];
      // Scattered: high variance and no dominant band.
      if (r.cov >= 0.6 && r.topShare < 0.5) {
        scatteredStreets.push(r);
      } else if (r.topShare >= 0.8 && r.cov < 0.25) {
        // Single-size: one band dominates and spread is tight.
        singleSizeStreets.push(r);
      } else {
        sensibleStreets.push(r);
      }
    }

    if (scatteredStreets.length) {
      var sl = scatteredStreets.map(function(r) {
        return r.street + ' (' + Math.round(r.avg * 100) + '% pot avg, ' +
          Math.round(r.cov * 100) + '% spread)';
      }).join(', ');
      branchTexts.push('Your sizing is scattered on ' + sl + '. No dominant default, no clear shape.');
    }
    if (singleSizeStreets.length) {
      var sl2 = singleSizeStreets.map(function(r) {
        return r.street + ' (clustered around ' + Math.round(r.avg * 100) + '% pot)';
      }).join(', ');
      branchTexts.push('You use one default size on ' + sl2 + '. Consistent, but the same bet has to do every job.');
    }
    if (sensibleStreets.length && !scatteredStreets.length && !singleSizeStreets.length) {
      branchTexts.push('Per-street sizing shows sensible variation across the post-flop streets you bet.');
    }

    // Cross-street trend: do bets scale up street by street?
    var ordered = STREETS.slice(1).map(function(st) {
      for (var p = 0; p < streetReads.length; p++) if (streetReads[p].street === st) return streetReads[p];
      return null;
    }).filter(Boolean);
    if (ordered.length >= 2) {
      var increasing = true, decreasing = true;
      for (var oi = 1; oi < ordered.length; oi++) {
        if (ordered[oi].avg < ordered[oi - 1].avg - 0.05) increasing = false;
        if (ordered[oi].avg > ordered[oi - 1].avg + 0.05) decreasing = false;
      }
      if (decreasing && ordered.length >= 3) {
        branchTexts.push('Your average sizing shrinks street by street, from ' +
          Math.round(ordered[0].avg * 100) + '% on ' + ordered[0].street.toLowerCase() +
          ' down to ' + Math.round(ordered[ordered.length - 1].avg * 100) + '% on ' +
          ordered[ordered.length - 1].street.toLowerCase() + '.');
      }
    }

    var severity;
    if (scatteredStreets.length >= 2) severity = 'r';
    else if (scatteredStreets.length === 1) severity = 'a';
    else if (singleSizeStreets.length >= 2) severity = 'a';
    else severity = 'g';

    var impactText = null;
    var soWhatText = null;
    if (scatteredStreets.length) {
      impactText = 'Scattered sizing leaks information. When the size changes with the hand rather than with the spot, observant opponents read your strength from your bet.';
      soWhatText = 'Pick a default size per street that fits the typical spot. Vary only when board texture forces it, not when your hand changes.';
    } else if (singleSizeStreets.length >= 2) {
      impactText = 'Using one default size everywhere keeps you simple but the same bet has to extract value, protect against draws, and bluff. It does none of those jobs as well as a fitted size would.';
      soWhatText = 'Once you have a default, start widening it: bigger on wet boards and against multiway, smaller heads-up on dry boards.';
    } else {
      impactText = 'Sizing shape reads sensibly across streets. The defaults are doing strategic work.';
      soWhatText = 'Keep building data on by-position and by-texture splits as the sample grows.';
    }

    // Example hands. When scattered streets exist, prefer hands that bet on
    // those streets. Otherwise fall back to ANY hand where the player bet
    // post-flop so the card always has something to inspect.
    var examples = [];
    if (hands && hands.length) {
      var pulled = pickHands(hands, function(h) {
        var w = walkHandForSizing(h);
        if (!w.heroBets.length) return false;
        if (!scatteredStreets.length) return true;
        for (var hb = 0; hb < w.heroBets.length; hb++) {
          if (w.heroBets[hb].street === 'Preflop') continue;
          for (var ss = 0; ss < scatteredStreets.length; ss++) {
            if (w.heroBets[hb].street === scatteredStreets[ss].street) return true;
          }
        }
        return false;
      }, 12);
      // Fallback: any hand where hero made a post-flop bet.
      if (!pulled.length) {
        pulled = pickHands(hands, function(h) {
          var w = walkHandForSizing(h);
          for (var b = 0; b < w.heroBets.length; b++) {
            if (w.heroBets[b].street !== 'Preflop') return true;
          }
          return false;
        }, 12);
      }
      if (pulled.length) {
        examples.push({
          id: 'bets-sizing-shape-examples',
          label: 'Hands with your post-flop bets',
          hands: pulled,
          coachingNote: scatteredStreets.length
            ? 'Scan the bet sizes in these hands. Are they sized for the spot, or sized to what you happen to be holding? The fix is one default per street, varied for texture not for hand strength.'
            : 'Sizing reads consistent. Use these as reference for what a stable default looks like in your game.'
        });
      }
    }

    return {
      id: 'bets-sizing-shape',
      name: 'Bet Sizing Shape',
      panel: 'Betting',
      sectionId: 'bets',
      severity: severity,
      score: Sections.score(severity, scatteredStreets.length),
      openingText: openingText,
      branchTexts: branchTexts,
      impactText: impactText,
      soWhatText: soWhatText,
      examples: examples,
      meta: {
        totalBets: heroBets.length,
        overallAvg: overallAvg,
        streetReads: streetReads,
        scatteredStreets: scatteredStreets.map(function(r) { return r.street; }),
        singleSizeStreets: singleSizeStreets.map(function(r) { return r.street; })
      }
    };
  }

  // ── STORY 2: VALUE VS BLUFF SIZING (MVP) ───────────────────────────────────
  //
  // Without hand-strength-at-decision, classify each bet retrospectively by
  // hand outcome. For hands that reached showdown: bets in winning hands are
  // "value-loaded" and bets in losing hands are "bluff-loaded" or weak-loaded.
  // Then check whether bet size correlates with outcome in a sensible way.
  // Sensible: bigger bets correlate with winning showdowns (value sized up).
  // Leak: bigger bets correlate with losing showdowns (overbluffing).

  function buildValueVsBluff(d, extras, hands) {
    if (!d || !d.n || d.n < MIN_AGG) return null;
    if (!hands || !hands.length) return null;
    if (typeof isShowdown !== 'function') return null;

    var won = { count: 0, sumFrac: 0, fracs: [] };
    var lost = { count: 0, sumFrac: 0, fracs: [] };

    for (var i = 0; i < hands.length; i++) {
      var h = hands[i];
      if (!h || !h.outcome) continue;
      if (!isShowdown(h)) continue;
      var w = walkHandForSizing(h);
      if (!w.heroBets.length) continue;
      // Use the hand's average sizing (post-flop only) for stability.
      var post = w.heroBets.filter(function(b) { return b.street !== 'Preflop'; });
      if (!post.length) continue;
      var avg = mean(post.map(function(b) { return b.fracOfPot; }));
      var winner = h.outcome.result === 'won';
      if (winner) { won.count++; won.sumFrac += avg; won.fracs.push(avg); }
      else { lost.count++; lost.sumFrac += avg; lost.fracs.push(avg); }
    }

    // Need enough on each side for a meaningful read. When thin, still
    // surface the post-flop bet pool so the user can browse what is there.
    if (won.count < MIN_CELL_LOCAL || lost.count < MIN_CELL_LOCAL) {
      var thinExamples = [];
      var anyBets = pickHands(hands, function(h) {
        var w = walkHandForSizing(h);
        for (var b = 0; b < w.heroBets.length; b++) {
          if (w.heroBets[b].street !== 'Preflop') return true;
        }
        return false;
      }, 12);
      if (anyBets.length) {
        thinExamples.push({
          id: 'bets-value-vs-bluff-thin',
          label: 'Hands where you bet post-flop',
          hands: anyBets,
          coachingNote: 'Browse these hands and ask whether the bet size matched what you held. As the showdown sample grows, this reading will sharpen into a real verdict.'
        });
      }
      return {
        id: 'bets-value-vs-bluff',
        name: 'Value vs Bluff Sizing',
        panel: 'Betting',
        sectionId: 'bets',
        severity: 'n',
        score: Sections.score('n', 0),
        openingText: 'Not enough showdown bets to read whether your sizing tracks hand strength.',
        branchTexts: ['Won showdowns with bets: ' + won.count + '. Lost showdowns with bets: ' + lost.count + '. Need at least ' + MIN_CELL_LOCAL + ' on each side.'],
        impactText: null,
        soWhatText: 'Keep logging hands. This reading sharpens as the showdown sample grows.',
        examples: thinExamples,
        meta: { won: won.count, lost: lost.count }
      };
    }

    var avgWon = won.sumFrac / won.count;
    var avgLost = lost.sumFrac / lost.count;
    var gap = avgWon - avgLost; // positive = sized up on winners (good shape)

    var openingText = 'On showdowns you reached, your average sizing was ' +
      Math.round(avgWon * 100) + '% of pot on winners (' + won.count + ' hands) and ' +
      Math.round(avgLost * 100) + '% on losers (' + lost.count + ' hands).';

    var branchTexts = [];
    var severity = 'g';
    var impactText = null;
    var soWhatText = null;

    if (gap <= -0.10) {
      // Sized bigger on losing hands than winning ones - bluff-loaded sizing.
      severity = 'r';
      branchTexts.push('Your bigger bets cluster on hands that lost at showdown. The sizing tells opponents when you do not have it.');
      impactText = 'Sizing up with weak hands and down with strong ones is the worst possible shape. Observant opponents fold cheap when you go big and call light when you go small. Every bluff is overpriced and every value bet is underpriced.';
      soWhatText = 'Invert the habit. When you have it, size up. When you do not, either size small with a clear plan or check. Stop using bet size as a confidence signal.';
    } else if (gap >= 0.10) {
      severity = 'g';
      branchTexts.push('Bigger bets cluster on winning showdowns and smaller bets on losing ones. The shape reads as value-loaded.');
      impactText = 'Sizing tracks the outcome of the hand, which on this sample is the right direction. Strong hands get the larger sizes, weak hands get smaller or none.';
      soWhatText = 'Hold the pattern. Watch that the small bets on weak hands are not turning into auto-bluffs that get called.';
    } else {
      severity = 'a';
      branchTexts.push('Your sizing on winners and losers is roughly the same.');
      impactText = 'Same size across hand strength is a missed lever. Strong hands could be priced bigger; weak hands could be checked or sized small with intent. Right now the size is doing no work.';
      soWhatText = 'Start scaling up on value-heavy boards and lines, and either give up or size small with a plan on weak holdings.';
    }

    // Examples: showdown losses with bigger-than-average bets.
    var examples = [];
    var threshold = avgWon; // bets sized at or above your value average
    var bigBetLosses = pickHands(hands, function(h) {
      if (!h || !h.outcome || h.outcome.result === 'won') return false;
      if (!isShowdown(h)) return false;
      var w = walkHandForSizing(h);
      var post = w.heroBets.filter(function(b) { return b.street !== 'Preflop'; });
      if (!post.length) return false;
      var avg = mean(post.map(function(b) { return b.fracOfPot; }));
      return avg >= threshold;
    }, 12);
    if (bigBetLosses.length) {
      examples.push({
        id: 'bets-value-vs-bluff-losses',
        label: 'Big-bet showdown losses',
        hands: bigBetLosses,
        coachingNote: 'Hands you sized up on and lost at showdown. The pattern to look for: were you betting strength, or were you betting because the hand "felt big"? Big sizing should track the cards, not the story.'
      });
    }

    return {
      id: 'bets-value-vs-bluff',
      name: 'Value vs Bluff Sizing',
      panel: 'Betting',
      sectionId: 'bets',
      severity: severity,
      score: Sections.score(severity, Math.abs(gap)),
      openingText: openingText,
      branchTexts: branchTexts,
      impactText: impactText,
      soWhatText: soWhatText,
      examples: examples,
      meta: {
        avgWon: avgWon,
        avgLost: avgLost,
        gap: gap,
        wonCount: won.count,
        lostCount: lost.count
      }
    };
  }

  // ── STORY 3: RESPONSE TO SIZING ────────────────────────────────────────────

  function buildResponseToSizing(d, extras, hands) {
    if (!d || !d.n || d.n < MIN_AGG) return null;
    if (!hands || !hands.length) return null;

    // Walk all hands and collect every bet hero faced with a response.
    var faced = [];
    for (var i = 0; i < hands.length; i++) {
      var w = walkHandForSizing(hands[i]);
      for (var k = 0; k < w.facedBets.length; k++) faced.push(w.facedBets[k]);
    }
    if (faced.length < MIN_CELL_LOCAL) return null;

    // Bucket and compute fold/call/raise rates per band.
    var bands = {
      small: { fold: 0, call: 0, raise: 0, n: 0 },
      medium: { fold: 0, call: 0, raise: 0, n: 0 },
      big: { fold: 0, call: 0, raise: 0, n: 0 },
      overbet: { fold: 0, call: 0, raise: 0, n: 0 }
    };
    for (var fi = 0; fi < faced.length; fi++) {
      var f = faced[fi];
      var b = bands[sizeBand(f.fracOfPot)];
      b.n++;
      if (f.response === 'fold') b.fold++;
      else if (f.response === 'call') b.call++;
      else if (f.response === 'raise') b.raise++;
    }

    // Build readable rows for the bands that hit the cell minimum.
    var rows = [];
    var BAND_ORDER = ['small', 'medium', 'big', 'overbet'];
    for (var bi = 0; bi < BAND_ORDER.length; bi++) {
      var key = BAND_ORDER[bi];
      var rec = bands[key];
      if (rec.n < MIN_CELL_LOCAL) continue;
      rows.push({
        key: key,
        n: rec.n,
        foldPct: (rec.fold / rec.n) * 100,
        callPct: (rec.call / rec.n) * 100,
        raisePct: (rec.raise / rec.n) * 100
      });
    }
    if (!rows.length) return null;

    var openingParts = rows.map(function(r) {
      return 'against ' + BAND_LABELS[r.key] + ' you fold ' + Math.round(r.foldPct) +
        '%, call ' + Math.round(r.callPct) + '%, raise ' + Math.round(r.raisePct) +
        '% across ' + r.n + ' spots';
    });
    var openingText = 'When facing bets, ' + openingParts.join('; ') + '.';

    var branchTexts = [];
    var leaks = [];

    // Leak: folds too often to small bets. Threshold: above 60% fold on the
    // small band when sample is enough.
    var smallRow = null, bigRow = null, overbetRow = null, mediumRow = null;
    for (var ri = 0; ri < rows.length; ri++) {
      if (rows[ri].key === 'small') smallRow = rows[ri];
      else if (rows[ri].key === 'medium') mediumRow = rows[ri];
      else if (rows[ri].key === 'big') bigRow = rows[ri];
      else if (rows[ri].key === 'overbet') overbetRow = rows[ri];
    }

    if (smallRow && smallRow.foldPct >= 60) {
      leaks.push('folds-to-small');
      branchTexts.push('You fold ' + Math.round(smallRow.foldPct) + '% to small bets across ' + smallRow.n + ' spots. Small bets are usually cheap probes, and you are folding too often.');
    }

    // Leak: calls too often to big bets / overbets. Threshold: above 50% call.
    if (bigRow && bigRow.callPct >= 50) {
      leaks.push('calls-big');
      branchTexts.push('You call ' + Math.round(bigRow.callPct) + '% against big bets across ' + bigRow.n + ' spots. Big bets are usually value, and the call frequency is high.');
    }
    if (overbetRow && overbetRow.callPct >= 50) {
      leaks.push('calls-overbet');
      branchTexts.push('You call ' + Math.round(overbetRow.callPct) + '% against overbets across ' + overbetRow.n + ' spots. Overbets are almost always polarised; calling that often pays off value.');
    }

    // Leak: sizing-blind response. Fold-rate range across bands within 8 points.
    if (rows.length >= 3) {
      var foldRates = rows.map(function(r) { return r.foldPct; });
      var minF = Math.min.apply(null, foldRates);
      var maxF = Math.max.apply(null, foldRates);
      if (maxF - minF < 8) {
        leaks.push('sizing-blind');
        branchTexts.push('Your fold rate barely moves across sizing bands (range ' + Math.round(minF) + ' to ' + Math.round(maxF) + '%). You are responding the same way to a small probe as to an overbet.');
      } else {
        // Sensible scaling: folds rise as size rises.
        var sorted = rows.slice().sort(function(a, b) {
          return BAND_ORDER.indexOf(a.key) - BAND_ORDER.indexOf(b.key);
        });
        var scaling = true;
        for (var sk = 1; sk < sorted.length; sk++) {
          if (sorted[sk].foldPct + 3 < sorted[sk - 1].foldPct) { scaling = false; break; }
        }
        if (scaling) {
          branchTexts.push('Your fold rate rises as bet size rises. Response scales with the size of the bet faced.');
        }
      }
    }

    // Severity gate.
    var severity;
    var leakCount = leaks.length;
    if (leakCount >= 2) severity = 'r';
    else if (leakCount === 1) severity = 'a';
    else severity = 'g';

    var impactText = null;
    var soWhatText = null;
    if (leaks.indexOf('folds-to-small') !== -1 && (leaks.indexOf('calls-big') !== -1 || leaks.indexOf('calls-overbet') !== -1)) {
      impactText = 'You fold cheap and call expensive. That is the worst response shape: opponents pay nothing to push you off marginal hands and get paid in full when they have it.';
      soWhatText = 'Defend wider against small bets, especially heads-up. Tighten your calling range against big bets and overbets: those sizes are almost always value at this level.';
    } else if (leaks.indexOf('folds-to-small') !== -1) {
      impactText = 'Folding too often to small bets gives opponents free pots. Small sizing is usually a probe or a thin value bet; many of those folds are winning hands.';
      soWhatText = 'Default to calling against small bets when you have any showdown value. The price is cheap and the bet range is wide.';
    } else if (leaks.indexOf('calls-big') !== -1 || leaks.indexOf('calls-overbet') !== -1) {
      impactText = 'Calling too often against big bets pays off value. Big bets at this level are rarely bluffs; the calling range needs to be narrower than it is.';
      soWhatText = 'Trim hero calls against large sizings. Save the chip-ups for hands that beat value, not hands that only beat bluffs.';
    } else if (leaks.indexOf('sizing-blind') !== -1) {
      impactText = 'A flat response across sizing bands is exploitable. Opponents can size up with value and size down to bluff cheaply, and either way gets the same answer from you.';
      soWhatText = 'Build the habit of widening defence against smaller bets and tightening against larger ones. The size in front of you should change the decision.';
    } else {
      impactText = 'Response scales sensibly with the size of bets you face. The defence is sorted by price.';
      soWhatText = 'Hold the shape. Track call frequency against overbets specifically as the sample grows.';
    }

    // Examples per leak, plus a generic fallback so the card always has at
    // least one button to click into.
    var examples = [];
    var anyFaced = pickHands(hands, function(h) {
      var w = walkHandForSizing(h);
      return w.facedBets && w.facedBets.length > 0;
    }, 12);
    if (leaks.indexOf('folds-to-small') !== -1) {
      var foldsToSmall = pickHands(hands, function(h) {
        var w = walkHandForSizing(h);
        for (var x = 0; x < w.facedBets.length; x++) {
          var fb = w.facedBets[x];
          if (fb.response === 'fold' && sizeBand(fb.fracOfPot) === 'small') return true;
        }
        return false;
      }, 12);
      if (foldsToSmall.length) {
        examples.push({
          id: 'bets-response-folds-small',
          label: 'Folds to small bets',
          hands: foldsToSmall,
          coachingNote: 'Hands where you folded to a small bet. Look at what you had and what the action looked like. Many of these are probes you can call cheap with any pair, gutshot, or backdoor.'
        });
      }
    }
    if (leaks.indexOf('calls-big') !== -1 || leaks.indexOf('calls-overbet') !== -1) {
      var callsBig = pickHands(hands, function(h) {
        var w = walkHandForSizing(h);
        for (var x = 0; x < w.facedBets.length; x++) {
          var fb = w.facedBets[x];
          if (fb.response === 'call' && (sizeBand(fb.fracOfPot) === 'big' || sizeBand(fb.fracOfPot) === 'overbet')) return true;
        }
        return false;
      }, 12);
      if (callsBig.length) {
        examples.push({
          id: 'bets-response-calls-big',
          label: 'Calls vs big bets',
          hands: callsBig,
          coachingNote: 'Hands where you called a big bet or overbet. Cross-check the outcomes: how many of these were winners? At your level, big sizes mean strong hands far more often than they mean bluffs.'
        });
      }
    }
    // Fallback: when no leaks fired, surface a general bets-faced pool so
    // the card always has a button to inspect the underlying hands.
    if (!examples.length && anyFaced.length) {
      examples.push({
        id: 'bets-response-faced',
        label: 'Hands where you faced a bet',
        hands: anyFaced,
        coachingNote: 'Browse these and check whether your response shifted with the size of the bet. If your fold rate is identical against small probes and overbets, opponents can size for free information.'
      });
    }

    return {
      id: 'bets-response',
      name: 'Response to Sizing',
      panel: 'Betting',
      sectionId: 'bets',
      severity: severity,
      score: Sections.score(severity, leakCount),
      openingText: openingText,
      branchTexts: branchTexts,
      impactText: impactText,
      soWhatText: soWhatText,
      examples: examples,
      meta: {
        rows: rows,
        leaks: leaks,
        totalFaced: faced.length
      }
    };
  }

  // ── REGISTER ───────────────────────────────────────────────────────────────

  Sections.defineSection({
    id: 'bets',
    panel: 'Betting',
    run: function(d, extras, hands) {
      var out = [];
      var a = buildSizingShape(d, extras, hands);
      if (a) out.push(a);
      var b = buildValueVsBluff(d, extras, hands);
      if (b) out.push(b);
      var c = buildResponseToSizing(d, extras, hands);
      if (c) out.push(c);
      return out;
    }
  });
})();
