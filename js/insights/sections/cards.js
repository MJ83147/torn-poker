// ── CARDS SECTION ─────────────────────────────────────────────────────────────
//
// Six stories cover postflop performance by hand strength held at the moment
// of decision.
//
//   Premium Made   Set or better.
//   Strong Made    Overpair, Top Pair, Two Pair.
//   Marginal Made  Middle Pair, Bottom Pair, Pocket Pair below the board.
//   Strong Draws   Flush draw, open-ended straight draw, or combo of both
//                  (held on the flop or turn before the river).
//   Weak Draws     Gutshot straight draw only.
//   Air            High card hands with no significant draw.
//
// Hand strength is computed once per hand using classifyMadeHand on the last
// street the hand actually reached. Hands that fold preflop without a flop
// are skipped here. The result is one bucket per hand; pillars aggregate
// over the bucket.

(function() {
  var MIN_AGG  = (typeof MIN_AGGREGATE === 'number') ? MIN_AGGREGATE : 30;
  var MIN_AX   = (typeof MIN_AXIS === 'number') ? MIN_AXIS : 20;
  var MIN_CL   = (typeof MIN_CELL === 'number') ? MIN_CELL : 10;

  // ── HELPERS ────────────────────────────────────────────────────────────────

  // "Won the pot" (matches showdown.js wonShowdown). Different from the
  // global heroWon, which requires net P&L > 0. Used when we want to count
  // pots scooped rather than money made.
  function wonPot(h) {
    return !!(h && h.outcome && h.outcome.result === 'won');
  }

  function pnlOf(h) {
    return getHandPnlValue(h);
  }

  // Return the deepest street the hand actually reached: 'Flop', 'Turn',
  // 'River', or null when no postflop action exists.
  function lastStreetReached(h) {
    if (!h || !h.actions) return null;
    var acts = parseActions(h.actions);
    var sawFlop = false, sawTurn = false, sawRiver = false;
    for (var i = 0; i < acts.length; i++) {
      var s = acts[i].street;
      if (s === 'Flop') sawFlop = true;
      else if (s === 'Turn') sawTurn = true;
      else if (s === 'River') sawRiver = true;
    }
    if (sawRiver) return 'River';
    if (sawTurn) return 'Turn';
    if (sawFlop) return 'Flop';
    return null;
  }

  // Detect cases where hero is "playing the board" - the board contains the
  // strong hand on its own and hero contributes only kickers. These hands
  // must NOT classify as premium even when classifyMadeHand returns Set,
  // Trips, Straight, Flush, etc. Returns true when the strength belongs to
  // the board.
  function heroPlaysBoard(hole, boardSlice, made) {
    if (!hole || hole.length < 2) return false;
    if (!boardSlice || boardSlice.length < 3) return false;
    if (!made) return false;

    var holeRanks = hole.map(function(c) { return c.slice(0, -1); });
    var holeSuits = hole.map(function(c) { return c.slice(-1); });
    var boardRanks = boardSlice.map(function(c) { return c.slice(0, -1); });
    var boardSuits = boardSlice.map(function(c) { return c.slice(-1); });

    // Trips on board: any board rank appears 3+ times AND hero has no card of
    // that rank. The made label will be 'Trips' (not 'Set' which is hero's
    // pocket pair hitting the board).
    if (made.tier === 3 && made.label === 'Trips') {
      var boardCounts = {};
      for (var i = 0; i < boardRanks.length; i++) {
        boardCounts[boardRanks[i]] = (boardCounts[boardRanks[i]] || 0) + 1;
      }
      for (var rk in boardCounts) {
        if (boardCounts[rk] >= 3 && holeRanks.indexOf(rk) === -1) return true;
      }
    }

    // Full house on board (rare but possible: e.g. AAA22 with hero KQ).
    if (made.tier === 6) {
      var bc6 = {};
      for (var j = 0; j < boardRanks.length; j++) {
        bc6[boardRanks[j]] = (bc6[boardRanks[j]] || 0) + 1;
      }
      var trips = null, pair = null;
      for (var rk6 in bc6) {
        if (bc6[rk6] >= 3) trips = rk6;
        else if (bc6[rk6] === 2) pair = rk6;
      }
      if (trips && pair && holeRanks.indexOf(trips) === -1 && holeRanks.indexOf(pair) === -1) return true;
    }

    // Straight: board itself has 5 in a row, hero contributes nothing.
    if (made.tier === 4 && boardRanks.length >= 5) {
      // Build sorted unique board rank indexes.
      var bIdx = boardRanks.map(function(r) { return RANKS.indexOf(r); });
      var uniq = [];
      for (var u = 0; u < bIdx.length; u++) {
        if (uniq.indexOf(bIdx[u]) === -1) uniq.push(bIdx[u]);
      }
      uniq.sort(function(a, b) { return a - b; });
      // Ace-low wheel.
      if (uniq.indexOf(12) !== -1) uniq.unshift(-1);
      // Scan windows of 5 consecutive ranks.
      for (var w = 0; w <= uniq.length - 5; w++) {
        if (uniq[w + 4] - uniq[w] === 4 &&
            uniq[w + 1] === uniq[w] + 1 &&
            uniq[w + 2] === uniq[w] + 2 &&
            uniq[w + 3] === uniq[w] + 3) {
          return true; // board straight
        }
      }
    }

    // Flush: 5+ cards of one suit on board AND hero has no card of that suit
    // higher than the lowest board card of that suit. The simple test: hero
    // has no card of that suit at all.
    if (made.tier === 5) {
      var suitCount = {};
      for (var s = 0; s < boardSuits.length; s++) {
        suitCount[boardSuits[s]] = (suitCount[boardSuits[s]] || 0) + 1;
      }
      for (var ssuit in suitCount) {
        if (suitCount[ssuit] >= 5 && holeSuits.indexOf(ssuit) === -1) return true;
      }
    }

    // Two pair on the board with hero having neither rank.
    if (made.tier === 2) {
      var bc2 = {};
      for (var k = 0; k < boardRanks.length; k++) {
        bc2[boardRanks[k]] = (bc2[boardRanks[k]] || 0) + 1;
      }
      var pairs = [];
      for (var rk2 in bc2) if (bc2[rk2] >= 2) pairs.push(rk2);
      if (pairs.length >= 2 &&
          holeRanks.indexOf(pairs[0]) === -1 &&
          holeRanks.indexOf(pairs[1]) === -1) {
        return true;
      }
    }

    return false;
  }

  // Map the made-hand draws array onto strong-draw / weak-draw buckets.
  // classifyMadeHand emits strings like 'Flush draw (9 outs)', 'OESD (8 outs)',
  // and 'Gutshot (4 outs)'. The river has no draws (last street). Returns
  // 'strong-draw' for flush draw or OESD (or combo), 'weak-draw' for gutshot
  // only, or null when there is nothing to classify.
  function classifyDrawBucket(made, lastStreet) {
    if (!made || !made.draws || !made.draws.length) return null;
    if (lastStreet === 'River') return null; // draws are not live on the river
    var hasFlush = false, hasOESD = false, hasGutshot = false;
    for (var i = 0; i < made.draws.length; i++) {
      var dStr = made.draws[i] || '';
      if (dStr.indexOf('Flush draw') === 0) hasFlush = true;
      else if (dStr.indexOf('OESD') === 0) hasOESD = true;
      else if (dStr.indexOf('Gutshot') === 0) hasGutshot = true;
    }
    if (hasFlush || hasOESD) return 'strongDraw';
    if (hasGutshot) return 'weakDraw';
    return null;
  }

  // Classify a single board slice (flop, turn, or river) into one of the six
  // buckets. Returns null when the slice is too short or classifyMadeHand
  // declines to return a label.
  function classifyOnSlice(hole, boardSlice, streetName) {
    if (boardSlice.length < 3) return null;
    var made = (typeof classifyMadeHand === 'function') ? classifyMadeHand(hole, boardSlice) : null;
    if (!made || !made.label) return null;

    var label = made.label;
    var madeBucket = null;

    // If the board does all the work (board trips with hero kickers, board
    // straight, board flush, board full house, board two pair), strength
    // belongs to the board not hero. Treat as air - hero is on a kicker
    // hand and the made-hand label overstates the holding. Exception: a
    // pocket pair is never air; route it to overpair/marginal so the
    // pocket-pair-below-the-board hands don't show up in "Air".
    if (heroPlaysBoard(hole, boardSlice, made)) {
      var hr0 = hole[0].slice(0, -1);
      var hr1 = hole[1].slice(0, -1);
      if (hr0 === hr1) {
        var pairIdx = RANKS.indexOf(hr0);
        var topBoardIdx = -1;
        for (var bi = 0; bi < boardSlice.length; bi++) {
          var bIdx = RANKS.indexOf(boardSlice[bi].slice(0, -1));
          if (bIdx > topBoardIdx) topBoardIdx = bIdx;
        }
        madeBucket = (pairIdx > topBoardIdx) ? 'strong' : 'marginal';
      } else {
        madeBucket = 'air';
      }
    }
    else if (made.tier != null) {
      if (made.tier >= 5) madeBucket = 'premium';
      else if (made.tier === 4) madeBucket = 'premium';
      else if (made.tier === 3) madeBucket = (label === 'Set') ? 'premium' : 'strong';
      else if (made.tier === 2) madeBucket = 'strong';
      else if (made.tier === 1) {
        if (label === 'Overpair' || label === 'Top Pair') madeBucket = 'strong';
        else if (label === 'Middle Pair' || label === 'Bottom Pair' || label === 'Pocket Pair') madeBucket = 'marginal';
        else if (label.indexOf('High') !== -1) madeBucket = 'air';
        else madeBucket = 'marginal';
      } else if (made.tier === 0) madeBucket = 'air';
    } else {
      if (/^(Flush|Full House|Quads|Straight Flush)$/.test(label)) madeBucket = 'premium';
      else if (label === 'Straight') madeBucket = 'premium';
      else if (label === 'Set') madeBucket = 'premium';
      else if (label === 'Trips') madeBucket = 'strong';
      else if (label === 'Overpair' || label === 'Top Pair' || label === 'Two Pair') madeBucket = 'strong';
      else if (label === 'Middle Pair' || label === 'Bottom Pair' || label === 'Pocket Pair') madeBucket = 'marginal';
      else madeBucket = 'air';
    }

    // Promote air to a draw bucket when a live draw is present on this street.
    if (madeBucket === 'air') {
      var drawBucket = classifyDrawBucket(made, streetName);
      if (drawBucket) return drawBucket;
    }
    return madeBucket;
  }

  // Bucket priority, best to worst. Used to pick the strongest classification
  // hero held at any postflop decision point.
  var BUCKET_PRIORITY = ['premium', 'strong', 'marginal', 'strongDraw', 'weakDraw', 'air'];

  // Classify a hand by the BEST strength hero held on any postflop street they
  // reached. Evaluating only the last street misclassifies hands like 99 on a
  // Q-A-A flop that then runs out QAAQ3: AA99 two pair on the flop becomes
  // "playing the board" by the river, but hero's flop call was made with a
  // real hand. Returns null if hero never reached the flop.
  function classifyHandBucket(h) {
    if (!h || !h.hole || h.hole.length < 2) return null;
    if (!h.board || h.board.length < 3) return null;
    var last = lastStreetReached(h);
    if (!last) return null;

    var slices = [{ slice: h.board.slice(0, 3), street: 'Flop' }];
    if ((last === 'Turn' || last === 'River') && h.board.length >= 4) {
      slices.push({ slice: h.board.slice(0, 4), street: 'Turn' });
    }
    if (last === 'River' && h.board.length >= 5) {
      slices.push({ slice: h.board.slice(0, 5), street: 'River' });
    }

    var bestBucket = null;
    var bestRank = BUCKET_PRIORITY.length;
    for (var s = 0; s < slices.length; s++) {
      var bucket = classifyOnSlice(h.hole, slices[s].slice, slices[s].street);
      if (!bucket) continue;
      var rank = BUCKET_PRIORITY.indexOf(bucket);
      if (rank < bestRank) {
        bestRank = rank;
        bestBucket = bucket;
      }
    }
    return bestBucket;
  }

  // Hero's aggregate postflop action profile in a hand: counts of bets/raises,
  // checks, calls, folds across flop/turn/river. Returns null when no postflop
  // action.
  function heroPostflopProfile(h) {
    if (!h || !h.actions) return null;
    var acts = parseActions(h.actions);
    var p = { bet: 0, raise: 0, check: 0, call: 0, fold: 0, riverCall: 0, riverFold: 0, riverBet: 0, postflopActions: 0 };
    for (var i = 0; i < acts.length; i++) {
      var a = acts[i];
      if (!a.isMe) continue;
      if (a.street === 'Preflop') continue;
      p.postflopActions++;
      if (a.type === 'bet') p.bet++;
      else if (a.type === 'raise') p.raise++;
      else if (a.type === 'check') p.check++;
      else if (a.type === 'call') p.call++;
      else if (a.type === 'fold') p.fold++;
      if (a.street === 'River') {
        if (a.type === 'call') p.riverCall++;
        else if (a.type === 'fold') p.riverFold++;
        else if (a.type === 'bet' || a.type === 'raise') p.riverBet++;
      }
    }
    if (!p.postflopActions) return null;
    return p;
  }

  // True when hero called at least one river bet in this hand.
  function heroCalledRiver(h) {
    var p = heroPostflopProfile(h);
    return !!(p && p.riverCall > 0);
  }

  // True when hero made an aggressive postflop action (bet or raise).
  function heroBetOrRaisedPostflop(h) {
    var p = heroPostflopProfile(h);
    return !!(p && (p.bet + p.raise) > 0);
  }

  // True when hero only ever checked or called postflop (no bets, no raises).
  function heroOnlyPassive(h) {
    var p = heroPostflopProfile(h);
    if (!p) return false;
    return (p.bet + p.raise) === 0;
  }

  // ── BUCKET ROLL-UP ─────────────────────────────────────────────────────────
  //
  // Walk all hands once and produce per-bucket aggregates plus the hand list
  // so each story can filter without re-running classification.

  function buildBuckets(hands) {
    var buckets = {
      premium:    { id: 'premium',    hands: [], n: 0, pnl: 0, won: 0, aggressive: 0, passive: 0, riverCall: 0, riverCallLost: 0, riverCallPnl: 0 },
      strong:     { id: 'strong',     hands: [], n: 0, pnl: 0, won: 0, aggressive: 0, passive: 0, riverCall: 0, riverCallLost: 0, riverCallPnl: 0 },
      marginal:   { id: 'marginal',   hands: [], n: 0, pnl: 0, won: 0, aggressive: 0, passive: 0, riverCall: 0, riverCallLost: 0, riverCallPnl: 0 },
      strongDraw: { id: 'strongDraw', hands: [], n: 0, pnl: 0, won: 0, aggressive: 0, passive: 0, called: 0, calledLost: 0, calledPnl: 0, semibluffed: 0, semibluffPnl: 0 },
      weakDraw:   { id: 'weakDraw',   hands: [], n: 0, pnl: 0, won: 0, aggressive: 0, passive: 0, called: 0, calledLost: 0, calledPnl: 0 },
      air:        { id: 'air',        hands: [], n: 0, pnl: 0, won: 0, aggressive: 0, passive: 0, called: 0, calledLost: 0, calledPnl: 0 }
    };
    if (!hands) return buckets;
    for (var i = 0; i < hands.length; i++) {
      var h = hands[i];
      var id = classifyHandBucket(h);
      if (!id || !buckets[id]) continue;
      var b = buckets[id];
      b.hands.push(h);
      b.n++;
      var pnl = pnlOf(h);
      b.pnl += pnl;
      if (wonPot(h)) b.won++;
      var prof = heroPostflopProfile(h);
      if (prof) {
        if ((prof.bet + prof.raise) > 0) b.aggressive++;
        else b.passive++;
      }
      if (id === 'air' || id === 'weakDraw') {
        // For these, "called" tracks any postflop call (the leak: paying off
        // with no equity or thin equity).
        if (prof && prof.call > 0) {
          b.called++;
          if (heroLost(h)) { b.calledLost++; b.calledPnl += pnl; }
        }
      } else if (id === 'strongDraw') {
        // Strong draws also track call-down losses but the headline pillar is
        // semi-bluff frequency (bet/raise on the draw street).
        if (prof && prof.call > 0) {
          b.called++;
          if (heroLost(h)) { b.calledLost++; b.calledPnl += pnl; }
        }
        if (prof && (prof.bet + prof.raise) > 0) {
          b.semibluffed++;
          b.semibluffPnl += pnl;
        }
      } else {
        // Made hands: river-call frequency is the "going too far" probe.
        if (prof && prof.riverCall > 0) {
          b.riverCall++;
          if (heroLost(h)) { b.riverCallLost++; b.riverCallPnl += pnl; }
        }
      }
    }
    return buckets;
  }

  // ── PILLAR HELPERS ────────────────────────────────────────────────────────

  // Per-hand rate as a small currency number with sign.
  function perHandRate(total, n) {
    if (!n) return 0;
    return total / n;
  }

  // Severity rule for aggression-when-strong (premium/strong):
  //   aggressive < 50% with n >= MIN_CELL  : 'r'
  //   aggressive < 65% with n >= MIN_CELL  : 'a'
  //   otherwise                            : 'g' (silent unless P&L is bad)
  function classifyAggression(aggressive, total) {
    if (!total || total < MIN_CL) return null;
    var pctAgg = (aggressive / total) * 100;
    if (pctAgg < 50) return { severity: 'r', direction: 'low', deltaUnits: (65 - pctAgg) / 15, value: pctAgg };
    if (pctAgg < 65) return { severity: 'a', direction: 'low', deltaUnits: (65 - pctAgg) / 15, value: pctAgg };
    return { severity: 'g', direction: 'mid', deltaUnits: 0, value: pctAgg };
  }

  // Severity for "going too far" with a bucket: river-call losing rate.
  //   riverCallLost / riverCall >= 70% : 'r'
  //   riverCallLost / riverCall >= 55% : 'a'
  function classifyGoingTooFar(riverCall, riverCallLost) {
    if (!riverCall || riverCall < MIN_CL) return null;
    var lossPct = (riverCallLost / riverCall) * 100;
    if (lossPct >= 70) return { severity: 'r', direction: 'high', deltaUnits: (lossPct - 55) / 15, value: lossPct };
    if (lossPct >= 55) return { severity: 'a', direction: 'high', deltaUnits: (lossPct - 55) / 15, value: lossPct };
    return { severity: 'g', direction: 'mid', deltaUnits: 0, value: lossPct };
  }

  // Severity for the air-call leak: how often hero called postflop with air,
  // and did those calls lose money.
  function classifyAirCall(called, calledLost, calledPnl) {
    if (!called || called < MIN_CL) return null;
    var lossPct = (calledLost / called) * 100;
    if (lossPct >= 65 && calledPnl < 0) return { severity: 'r', direction: 'high', deltaUnits: (lossPct - 50) / 15, value: lossPct };
    if (lossPct >= 50 && calledPnl < 0) return { severity: 'a', direction: 'high', deltaUnits: (lossPct - 50) / 15, value: lossPct };
    return { severity: 'g', direction: 'mid', deltaUnits: 0, value: lossPct };
  }

  // Per-hand P&L direction vs overall. Returns 'leak' / 'lift' / 'flat'.
  function comparePnl(bucketPerHand, overallPerHand) {
    var gap = bucketPerHand - overallPerHand;
    if (bucketPerHand < 0 && gap < 0) return 'leak';
    if (bucketPerHand > 0 && gap > 0) return 'lift';
    return 'flat';
  }

  // ── STORY 1: PREMIUM MADE HANDS ───────────────────────────────────────────

  function buildPremium(d, bucket, overallPerHand) {
    if (!bucket || bucket.n < MIN_AX) return null;

    var perHand = perHandRate(bucket.pnl, bucket.n);
    var winRate = pct(bucket.won, bucket.n) || 0;

    var openingText = 'You hold a premium made hand (set, straight, flush, full house, or better) on ' +
      bucket.n + ' postflop hands. Net P&L is ' + fmtPnl(bucket.pnl) +
      ', a win rate of ' + winRate + '%.';

    var branchTexts = [];
    var pillarSeverities = [];

    // Pillar 1: aggression on premiums. Strong hands should bet or raise.
    var aggressivePct = bucket.n > 0 ? (bucket.aggressive / bucket.n) * 100 : 0;
    var aggSev = classifyAggression(bucket.aggressive, bucket.n);
    if (aggSev) {
      if (aggSev.severity === 'r' || aggSev.severity === 'a') {
        branchTexts.push(
          'You played ' + Math.round(aggressivePct) + '% of premium hands aggressively. ' +
          'The rest were checks and calls, which limits the size of the pots your biggest hands build.'
        );
        pillarSeverities.push(aggSev.severity);
      } else {
        pillarSeverities.push('g');
      }
    }

    // Pillar 2: P&L direction on the bucket vs overall.
    var pnlVerdict = comparePnl(perHand, overallPerHand);
    if (pnlVerdict === 'leak') {
      branchTexts.push(
        'Premium hands are losing money on net: ' + fmtPnl(bucket.pnl) + ' across ' + bucket.n +
        ' hands. This is the bucket that should carry your win rate, not drag on it.'
      );
      pillarSeverities.push('r');
    } else if (pnlVerdict === 'lift') {
      branchTexts.push(
        'Premium hands lift your win rate as expected: ' + fmtPnl(bucket.pnl) +
        ' across ' + bucket.n + ' hands, well above your per-hand average.'
      );
      pillarSeverities.push('g');
    }

    // Impact and so-what.
    var severity = pillarSeverities.length ? Sections.combineSeverity(pillarSeverities) : 'g';
    var impactText = null;
    var soWhatText = null;

    if (aggSev && (aggSev.severity === 'r' || aggSev.severity === 'a')) {
      impactText = 'Premium made hands have to pay for the times you miss. Slowplaying them leaves the section\'s biggest pots smaller than they should be.';
      soWhatText = 'Bet your premium hands more often, on every street. Sets and flushes need protection on wet boards, and the value left on the table compounds across the sample.';
    } else if (pnlVerdict === 'leak') {
      impactText = 'When the strongest hands you can hold are net negative, the leak is in how the pots get built and finished, not in the cards themselves.';
      soWhatText = 'Review the example hands below. Look for spots where a check-back let opponents see free cards, or where a smaller bet failed to charge a draw that got there.';
    }

    var fired = branchTexts.length > 0 || severity === 'r' || severity === 'a';
    if (!fired) return null;

    // Example hands: premium hands where hero stayed passive AND failed to win,
    // or premium hands that lost outright. Filtered to the verdict above.
    var examples = [];
    if (bucket.hands.length) {
      var passiveLost = pickHands(bucket.hands, function(h) {
        return heroOnlyPassive(h) && !wonPot(h);
      }, 12);
      if (passiveLost.length) {
        examples.push({
          id: 'cards-premium-passive-lost',
          label: 'Premium hands you played passively and did not win',
          hands: passiveLost,
          coachingNote: 'These are sets, straights, flushes, or better where you only checked and called and the hand did not win. Either you missed a value bet that would have been called, or you let an opponent realise equity for free and they caught up. Bigger sizing on wet boards is the fix.'
        });
      }
      var brokeEvenOrLost = pickHands(bucket.hands, function(h) {
        if (wonPot(h)) return false;
        return pnlOf(h) <= 0;
      }, 12);
      if (brokeEvenOrLost.length) {
        examples.push({
          id: 'cards-premium-losing',
          label: 'Premium hands that lost or broke even',
          hands: brokeEvenOrLost,
          coachingNote: 'Premium hands that did not finish in your favour. Look for the streets where money went the wrong direction: were you outdrawn, did you check a turn that the opponent then improved on, or did you fail to bet for value on the river?'
        });
      }
    }

    return {
      id: 'cards-premium',
      name: 'Premium Made Hands',
      panel: 'Cards',
      sectionId: 'cards',
      severity: severity,
      score: Sections.score(severity, aggSev ? aggSev.deltaUnits : 0),
      openingText: openingText,
      branchTexts: branchTexts,
      impactText: impactText,
      soWhatText: soWhatText,
      examples: examples,
      meta: {
        n: bucket.n, pnl: bucket.pnl, won: bucket.won,
        aggressive: bucket.aggressive, passive: bucket.passive,
        perHand: perHand, overallPerHand: overallPerHand
      }
    };
  }

  // ── STORY 2: STRONG MADE HANDS ────────────────────────────────────────────

  function buildStrong(d, bucket, overallPerHand) {
    if (!bucket || bucket.n < MIN_AX) return null;

    var perHand = perHandRate(bucket.pnl, bucket.n);
    var winRate = pct(bucket.won, bucket.n) || 0;

    var openingText = 'You hold a strong made hand (overpair, top pair, or two pair) on ' +
      bucket.n + ' postflop hands. Net P&L is ' + fmtPnl(bucket.pnl) +
      ', a win rate of ' + winRate + '%.';

    var branchTexts = [];
    var pillarSeverities = [];

    // Pillar 1: aggression. Strong made hands need to bet for value and
    // protection.
    var aggressivePct = bucket.n > 0 ? (bucket.aggressive / bucket.n) * 100 : 0;
    var aggSev = classifyAggression(bucket.aggressive, bucket.n);
    if (aggSev) {
      if (aggSev.severity === 'r' || aggSev.severity === 'a') {
        branchTexts.push(
          'You played ' + Math.round(aggressivePct) + '% of strong made hands aggressively. ' +
          'Top pair and overpair need to charge draws; checking too often gives opponents free cards.'
        );
        pillarSeverities.push(aggSev.severity);
      } else {
        pillarSeverities.push('g');
      }
    }

    // Pillar 2: going too far. River-call losses with one pair are the
    // central leak for this bucket.
    var goingSev = classifyGoingTooFar(bucket.riverCall, bucket.riverCallLost);
    if (goingSev) {
      if (goingSev.severity === 'r' || goingSev.severity === 'a') {
        var lossPct = pct(bucket.riverCallLost, bucket.riverCall) || 0;
        branchTexts.push(
          'When you called a river bet with a strong made hand, you lost ' + lossPct + '% of the time' +
          ' (' + bucket.riverCallLost + ' of ' + bucket.riverCall + '). Total cost on those river calls: ' +
          fmtPnl(bucket.riverCallPnl) + '. Top pair is rarely the best hand by the river when stacks go in.'
        );
        pillarSeverities.push(goingSev.severity);
      } else {
        pillarSeverities.push('g');
      }
    }

    // Pillar 3: P&L direction vs overall.
    var pnlVerdict = comparePnl(perHand, overallPerHand);
    if (pnlVerdict === 'leak') {
      branchTexts.push(
        'Strong made hands are net negative: ' + fmtPnl(bucket.pnl) +
        ' across ' + bucket.n + ' hands. The category that should hold its own is leaking.'
      );
      pillarSeverities.push('r');
    }

    var severity = pillarSeverities.length ? Sections.combineSeverity(pillarSeverities) : 'g';

    var impactText = null;
    var soWhatText = null;
    var aggFired = aggSev && (aggSev.severity === 'r' || aggSev.severity === 'a');
    var goingFired = goingSev && (goingSev.severity === 'r' || goingSev.severity === 'a');

    if (aggFired && goingFired) {
      impactText = 'Strong made hands need bet, bet, evaluate. You are doing the opposite: too cautious early, too committed late. Both lose chips for the same reason, failing to read where one pair stops being good.';
      soWhatText = 'Bet more on flop and turn with one pair. Fold more to turn raises and river bets. The frequencies need to flip: aggressive when the hand is likely best, disciplined when it is likely not.';
    } else if (goingFired) {
      impactText = 'Top pair and overpair lose value fast against river aggression. Opponents who bet the river with two streets behind them rarely bluff.';
      soWhatText = 'Tighten river call-downs with top pair good kicker. The pots you save by folding fund the next strong hand.';
    } else if (aggFired) {
      impactText = 'Strong made hands need to build pots. Checking flops and turns with top pair concedes the chance to charge draws and price out bluffs.';
      soWhatText = 'Bet flop and barrel turn more often with top pair and overpair. Pick sizes that price draws out on wet boards.';
    } else if (pnlVerdict === 'leak') {
      impactText = 'The bucket reads in shape on aggression and discipline, but the P&L is still negative. The leak is probably sizing or board texture rather than frequency.';
      soWhatText = 'Review the losing examples below. Look for repeated sizing patterns on wet boards or hands where you stacked off with one pair against a turn raise.';
    }

    var fired = branchTexts.length > 0 || severity === 'r' || severity === 'a';
    if (!fired) return null;

    // Example hands: river-call losses are the strongest "going too far" signal.
    var examples = [];
    var riverCallLosses = pickHands(bucket.hands, function(h) {
      return heroCalledRiver(h) && heroLost(h);
    }, 15);
    if (riverCallLosses.length) {
      examples.push({
        id: 'cards-strong-river-call-lost',
        label: 'Strong hands you called the river with and lost',
        hands: riverCallLosses,
        coachingNote: 'Top pair, overpair, or two pair where you called a river bet and lost. The pattern is opponents value-betting a better one pair or two pair against your one pair. The fix is folding more rivers when the action says you are beat.'
      });
    }
    if (aggFired) {
      var passiveLost = pickHands(bucket.hands, function(h) {
        return heroOnlyPassive(h) && !wonPot(h);
      }, 12);
      if (passiveLost.length) {
        examples.push({
          id: 'cards-strong-passive-lost',
          label: 'Strong hands you played passively and did not win',
          hands: passiveLost,
          coachingNote: 'Top pair or overpair where you only checked and called, and the hand did not win. Most of these were spots to bet the flop or turn for value and protection.'
        });
      }
    }

    return {
      id: 'cards-strong',
      name: 'Strong Made Hands',
      panel: 'Cards',
      sectionId: 'cards',
      severity: severity,
      score: Sections.score(severity, goingSev ? goingSev.deltaUnits : (aggSev ? aggSev.deltaUnits : 0)),
      openingText: openingText,
      branchTexts: branchTexts,
      impactText: impactText,
      soWhatText: soWhatText,
      examples: examples,
      meta: {
        n: bucket.n, pnl: bucket.pnl, won: bucket.won,
        aggressive: bucket.aggressive, riverCall: bucket.riverCall,
        riverCallLost: bucket.riverCallLost, riverCallPnl: bucket.riverCallPnl,
        perHand: perHand, overallPerHand: overallPerHand
      }
    };
  }

  // ── STORY 3: MARGINAL MADE HANDS ──────────────────────────────────────────

  function buildMarginal(d, bucket, overallPerHand) {
    if (!bucket || bucket.n < MIN_AX) return null;

    var perHand = perHandRate(bucket.pnl, bucket.n);
    var winRate = pct(bucket.won, bucket.n) || 0;

    var openingText = 'You hold a marginal made hand (second pair, bottom pair, or a small pocket pair below the board) on ' +
      bucket.n + ' postflop hands. Net P&L is ' + fmtPnl(bucket.pnl) +
      ', a win rate of ' + winRate + '%.';

    var branchTexts = [];
    var pillarSeverities = [];

    // Pillar 1: going too far. Bluff-catching with marginal hands.
    var goingSev = classifyGoingTooFar(bucket.riverCall, bucket.riverCallLost);
    if (goingSev) {
      if (goingSev.severity === 'r' || goingSev.severity === 'a') {
        var lossPct = pct(bucket.riverCallLost, bucket.riverCall) || 0;
        branchTexts.push(
          'When you called river bets with a marginal made hand you lost ' + lossPct +
          '% of the time (' + bucket.riverCallLost + ' of ' + bucket.riverCall + '). Total cost on those river calls: ' +
          fmtPnl(bucket.riverCallPnl) + '. Bluff catching with second pair works only when opponents are bluffing.'
        );
        pillarSeverities.push(goingSev.severity);
      } else {
        pillarSeverities.push('g');
      }
    }

    // Pillar 2: pot building with marginals (the trap). Counter-intuitive
    // aggression: leading too often with weak made hands.
    var leadPct = bucket.n > 0 ? (bucket.aggressive / bucket.n) * 100 : 0;
    var leadSev = null;
    if (bucket.n >= MIN_CL) {
      if (leadPct >= 50) leadSev = { severity: 'a', deltaUnits: (leadPct - 35) / 15 };
      if (leadPct >= 65) leadSev = { severity: 'r', deltaUnits: (leadPct - 35) / 15 };
    }
    if (leadSev) {
      branchTexts.push(
        'You bet or raised on ' + Math.round(leadPct) + '% of marginal made hands. Building pots with second pair invites being raised off the hand or paying off when an opponent has it crushed.'
      );
      pillarSeverities.push(leadSev.severity);
    }

    // Pillar 3: P&L direction vs overall.
    var pnlVerdict = comparePnl(perHand, overallPerHand);
    if (pnlVerdict === 'leak') {
      branchTexts.push(
        'Marginal made hands are net negative: ' + fmtPnl(bucket.pnl) +
        ' across ' + bucket.n + ' hands. This category is the most expensive when discipline slips.'
      );
      pillarSeverities.push('r');
    }

    var severity = pillarSeverities.length ? Sections.combineSeverity(pillarSeverities) : 'g';

    var impactText = null;
    var soWhatText = null;
    var goingFired = goingSev && (goingSev.severity === 'r' || goingSev.severity === 'a');
    var leadFired = leadSev && (leadSev.severity === 'r' || leadSev.severity === 'a');

    if (goingFired && leadFired) {
      impactText = 'Marginal hands need pot control, not pot building. You are bluff-catching when behind and leading when you should check. Each pillar compounds the other.';
      soWhatText = 'Check marginal made hands more often, and fold more rivers. The hand has showdown value against bluffs only; pay the bare minimum to see it down.';
    } else if (goingFired) {
      impactText = 'Bluff-catching with second pair only works when opponents are bluffing. In this sample they are betting for value.';
      soWhatText = 'Tighten river call-downs with marginal hands. Save the chips for spots where the showdown value matters more.';
    } else if (leadFired) {
      impactText = 'Leading the flop with second pair turns the hand into a bluff with weak equity behind it.';
      soWhatText = 'Check marginal made hands and let the preflop raiser bet. You can call cheaply when the price is right and fold when it is not.';
    } else if (pnlVerdict === 'leak') {
      impactText = 'Marginal hands are leaking on net even without an obvious frequency problem. The pattern is usually a small number of large losses on misread rivers.';
      soWhatText = 'Filter the example hands for the biggest losses and look for the action that committed you. Avoiding two or three of those would flip the bucket.';
    }

    var fired = branchTexts.length > 0 || severity === 'r' || severity === 'a';
    if (!fired) return null;

    // Example hands: hero called a river with a marginal hand and lost. Falls
    // back to losing marginal hands overall when river-call sample is thin.
    var examples = [];
    var riverCallLosses = pickHands(bucket.hands, function(h) {
      return heroCalledRiver(h) && heroLost(h);
    }, 15);
    if (riverCallLosses.length) {
      examples.push({
        id: 'cards-marginal-river-call-lost',
        label: 'Marginal hands you called the river with and lost',
        hands: riverCallLosses,
        coachingNote: 'Second pair or worse where you called a river bet and lost. Bluff catching only works when the bettor is bluffing. The P&L here says they were value-betting.'
      });
    } else {
      var anyLosses = pickHands(bucket.hands, heroLost, 15);
      if (anyLosses.length) {
        examples.push({
          id: 'cards-marginal-lost',
          label: 'Marginal hands that lost',
          hands: anyLosses,
          coachingNote: 'Losing hands where you held second pair, bottom pair, or a pocket pair below the board. Look for the moment money went in: most leaks here are streets where a check-fold would have saved chips.'
        });
      }
    }
    if (leadFired) {
      var aggrLost = pickHands(bucket.hands, function(h) {
        return heroBetOrRaisedPostflop(h) && heroLost(h);
      }, 12);
      if (aggrLost.length) {
        examples.push({
          id: 'cards-marginal-led-lost',
          label: 'Marginal hands you bet or raised with and lost',
          hands: aggrLost,
          coachingNote: 'Marginal made hands where you took an aggressive line and lost. These are the ones to check next time so the pot stays small.'
        });
      }
    }

    return {
      id: 'cards-marginal',
      name: 'Marginal Made Hands',
      panel: 'Cards',
      sectionId: 'cards',
      severity: severity,
      score: Sections.score(severity, goingSev ? goingSev.deltaUnits : 0),
      openingText: openingText,
      branchTexts: branchTexts,
      impactText: impactText,
      soWhatText: soWhatText,
      examples: examples,
      meta: {
        n: bucket.n, pnl: bucket.pnl, won: bucket.won,
        riverCall: bucket.riverCall, riverCallLost: bucket.riverCallLost,
        riverCallPnl: bucket.riverCallPnl,
        aggressive: bucket.aggressive,
        perHand: perHand, overallPerHand: overallPerHand
      }
    };
  }

  // ── STORY 4: AIR OR OVERCARDS ─────────────────────────────────────────────

  function buildAir(d, bucket, overallPerHand) {
    if (!bucket || bucket.n < MIN_AX) return null;

    var perHand = perHandRate(bucket.pnl, bucket.n);
    var winRate = pct(bucket.won, bucket.n) || 0;

    var openingText = 'You arrive at a postflop decision with air or overcards (no pair, no detected draw) on ' +
      bucket.n + ' hands. Net P&L is ' + fmtPnl(bucket.pnl) +
      ', a win rate of ' + winRate + '%.';

    var branchTexts = [];
    var pillarSeverities = [];

    // Pillar 1: calling with air.
    var airSev = classifyAirCall(bucket.called, bucket.calledLost, bucket.calledPnl);
    if (airSev) {
      if (airSev.severity === 'r' || airSev.severity === 'a') {
        var lossPct = pct(bucket.calledLost, bucket.called) || 0;
        branchTexts.push(
          'When you called a postflop bet holding air you lost ' + lossPct + '% of the time' +
          ' (' + bucket.calledLost + ' of ' + bucket.called + '). Total cost on those calls: ' +
          fmtPnl(bucket.calledPnl) + '. Air has no showdown value; the only profitable lines are fold or bluff.'
        );
        pillarSeverities.push(airSev.severity);
      } else {
        pillarSeverities.push('g');
      }
    }

    // Pillar 2: P&L direction.
    var pnlVerdict = comparePnl(perHand, overallPerHand);
    if (pnlVerdict === 'leak') {
      branchTexts.push(
        'Air hands are net negative: ' + fmtPnl(bucket.pnl) +
        ' across ' + bucket.n + ' hands. Every chip in past the flop with no equity is paying for the chance to get lucky.'
      );
      pillarSeverities.push('r');
    }

    var severity = pillarSeverities.length ? Sections.combineSeverity(pillarSeverities) : 'g';

    var impactText = null;
    var soWhatText = null;
    var airFired = airSev && (airSev.severity === 'r' || airSev.severity === 'a');

    if (airFired) {
      impactText = 'Air should be folded or bluffed, never called. Calling with no pair and no draw is paying to see if you got lucky.';
      soWhatText = 'Stop calling with air. The only profitable lines are folding when the price is bad and bluffing when fold equity is high. Choose between them and commit.';
    } else if (pnlVerdict === 'leak') {
      impactText = 'Even without a clear calling leak, air hands are losing money. Some of those chips are bluffs that should have been folds, and some are floats that did not pay off.';
      soWhatText = 'Tighten the spots you continue postflop without a pair or a draw. Look at the example hands below for the pattern: stickier when the price is wrong, less sticky when fold equity is missing.';
    }

    var fired = branchTexts.length > 0 || severity === 'r' || severity === 'a';
    if (!fired) return null;

    // Example hands: air hands where hero called and lost. The "paying off
    // with no equity" leak.
    var examples = [];
    var calledLost = pickHands(bucket.hands, function(h) {
      var p = heroPostflopProfile(h);
      return !!(p && p.call > 0 && heroLost(h));
    }, 15);
    if (calledLost.length) {
      examples.push({
        id: 'cards-air-called-lost',
        label: 'Air hands you called postflop and lost',
        hands: calledLost,
        coachingNote: 'Hands with no pair and no draw where you called a bet and lost. There is no realistic story where these are profitable. Fold them on the flop, or pick the spot to bluff-raise instead.'
      });
    }

    return {
      id: 'cards-air',
      name: 'Air or Overcards',
      panel: 'Cards',
      sectionId: 'cards',
      severity: severity,
      score: Sections.score(severity, airSev ? airSev.deltaUnits : 0),
      openingText: openingText,
      branchTexts: branchTexts,
      impactText: impactText,
      soWhatText: soWhatText,
      examples: examples,
      meta: {
        n: bucket.n, pnl: bucket.pnl, won: bucket.won,
        called: bucket.called, calledLost: bucket.calledLost,
        calledPnl: bucket.calledPnl,
        perHand: perHand, overallPerHand: overallPerHand
      }
    };
  }

  // ── STORY 5: STRONG DRAWS ────────────────────────────────────────────────

  function buildStrongDraws(d, bucket, overallPerHand) {
    if (!bucket || bucket.n < MIN_AX) return null;

    var perHand = perHandRate(bucket.pnl, bucket.n);
    var winRate = pct(bucket.won, bucket.n) || 0;
    var aggressivePct = bucket.n > 0 ? (bucket.aggressive / bucket.n) * 100 : 0;
    var passivePct = 100 - aggressivePct;

    var openingText = 'You hold a strong draw (flush draw, open-ended straight, or combo) on ' +
      bucket.n + ' postflop hands. Net P&L is ' + fmtPnl(bucket.pnl) +
      ', a win rate of ' + winRate + '%.';

    var branchTexts = [];
    var pillarSeverities = [];

    // Pillar 1: semi-bluffing. Strong draws are the best semi-bluffing hands
    // because they have equity when called. Below 30% aggression frequency
    // means too many passive calls with these draws.
    var semibluffSev = null;
    if (bucket.n >= MIN_CL) {
      if (aggressivePct < 20) semibluffSev = { severity: 'r', deltaUnits: (30 - aggressivePct) / 15 };
      else if (aggressivePct < 30) semibluffSev = { severity: 'a', deltaUnits: (30 - aggressivePct) / 15 };
    }
    if (semibluffSev) {
      branchTexts.push(
        'You raised or bet only ' + Math.round(aggressivePct) + '% of strong draws. ' +
        'These hands have the equity to play aggressively and the fold equity to make it work; passive calls leave the easiest money on the table.'
      );
      pillarSeverities.push(semibluffSev.severity);
    } else if (bucket.n >= MIN_CL) {
      pillarSeverities.push('g');
    }

    // Pillar 2: paying off when the draw bricks. If called frequently and the
    // P&L on those call lines is negative, that is realising equity poorly.
    var callLossPct = bucket.called > 0 ? (bucket.calledLost / bucket.called) * 100 : 0;
    if (bucket.called >= MIN_CL && callLossPct >= 65 && bucket.calledPnl < 0) {
      branchTexts.push(
        'When you only called with strong draws you lost ' + Math.round(callLossPct) +
        '% of those hands (' + fmtPnl(bucket.calledPnl) + ' across ' + bucket.called + ' hands). ' +
        'Strong draws miss roughly two-thirds of the time; passive call lines turn that into a chip drain.'
      );
      pillarSeverities.push('a');
    }

    // Pillar 3: P&L direction vs overall.
    var pnlVerdict = comparePnl(perHand, overallPerHand);
    if (pnlVerdict === 'leak') {
      branchTexts.push(
        'Strong draws are net negative: ' + fmtPnl(bucket.pnl) + ' across ' + bucket.n +
        ' hands. Even at fair pricing the bucket should not be losing money.'
      );
      pillarSeverities.push('r');
    } else if (pnlVerdict === 'lift') {
      branchTexts.push(
        'Strong draws lift your win rate: ' + fmtPnl(bucket.pnl) + ' across ' + bucket.n +
        ' hands, above your per-hand average.'
      );
    }

    var severity = pillarSeverities.length ? Sections.combineSeverity(pillarSeverities) : 'g';

    var impactText = null;
    var soWhatText = null;
    if (semibluffSev) {
      impactText = 'Strong draws need to be played aggressively. Calling passively gets the worst of both worlds: no fold equity, no price discipline, just paying to see the next card.';
      soWhatText = 'Raise more with flush draws and OESDs facing a flop bet. The equity plus fold equity makes raising the highest-EV line on most boards.';
    } else if (pnlVerdict === 'leak') {
      impactText = 'When strong draws lose money on net, the leak is usually in the streets after they miss. Calling turn bricks with no plan is the most common culprit.';
      soWhatText = 'When the draw misses on the turn, fold to a bet unless you have backed it up with a barrel of your own. Free cards are not worth chasing.';
    }

    var fired = branchTexts.length > 0 || severity === 'r' || severity === 'a';
    if (!fired) return null;

    // Examples: strong draws where hero only called and lost (passive equity
    // realisation gone wrong). Filtered to the verdict.
    var examples = [];
    var passiveLosses = pickHands(bucket.hands, function(h) {
      return heroOnlyPassive(h) && heroLost(h);
    }, 12);
    if (passiveLosses.length) {
      examples.push({
        id: 'cards-strong-draws-passive-lost',
        label: 'Strong draws you called with and lost',
        hands: passiveLosses,
        coachingNote: 'These are flush draws or OESDs where you only called and the draw missed. Look for spots that could have been semi-bluff raises on the flop or turn instead.'
      });
    }

    return {
      id: 'cards-strong-draws',
      name: 'Strong Draws',
      panel: 'Cards',
      sectionId: 'cards',
      severity: severity,
      score: Sections.score(severity, semibluffSev ? semibluffSev.deltaUnits : 0),
      openingText: openingText,
      branchTexts: branchTexts,
      impactText: impactText,
      soWhatText: soWhatText,
      examples: examples,
      meta: {
        n: bucket.n, pnl: bucket.pnl, won: bucket.won,
        aggressive: bucket.aggressive, called: bucket.called,
        calledLost: bucket.calledLost, calledPnl: bucket.calledPnl,
        semibluffed: bucket.semibluffed, semibluffPnl: bucket.semibluffPnl,
        perHand: perHand, overallPerHand: overallPerHand
      }
    };
  }

  // ── STORY 6: WEAK DRAWS ──────────────────────────────────────────────────

  function buildWeakDraws(d, bucket, overallPerHand) {
    if (!bucket || bucket.n < MIN_AX) return null;

    var perHand = perHandRate(bucket.pnl, bucket.n);
    var winRate = pct(bucket.won, bucket.n) || 0;
    var callPct = bucket.n > 0 ? (bucket.called / bucket.n) * 100 : 0;

    var openingText = 'You hold a weak draw (gutshot straight) on ' + bucket.n +
      ' postflop hands. Net P&L is ' + fmtPnl(bucket.pnl) + ', a win rate of ' + winRate + '%.';

    var branchTexts = [];
    var pillarSeverities = [];

    // Pillar 1: pricing discipline. Gutshots are about 8 percent per street.
    // Calling them often without the right price is the central leak.
    var pricingSev = null;
    if (bucket.called >= MIN_CL) {
      var callLossPct = (bucket.calledLost / bucket.called) * 100;
      if (callPct >= 50 && bucket.calledPnl < 0) {
        pricingSev = { severity: 'r', deltaUnits: (callPct - 35) / 15 };
        branchTexts.push(
          'You called bets with weak draws on ' + Math.round(callPct) + '% of these hands. ' +
          'Those calls have lost ' + fmtPnl(bucket.calledPnl) + ' across ' + bucket.called +
          ' hands. Gutshots need a 10 to 1 price plus implied odds to be profitable; most of these spots do not have that.'
        );
        pillarSeverities.push('r');
      } else if (callPct >= 35 && bucket.calledPnl < 0) {
        pricingSev = { severity: 'a', deltaUnits: (callPct - 25) / 15 };
        branchTexts.push(
          'You called with weak draws on ' + Math.round(callPct) + '% of these hands. ' +
          'Those calls have cost ' + fmtPnl(bucket.calledPnl) + '. Gutshots are the most price-sensitive draws in poker.'
        );
        pillarSeverities.push('a');
      } else {
        pillarSeverities.push('g');
      }
    }

    // Pillar 2: P&L direction.
    var pnlVerdict = comparePnl(perHand, overallPerHand);
    if (pnlVerdict === 'leak') {
      branchTexts.push(
        'Weak draws are net negative: ' + fmtPnl(bucket.pnl) + ' across ' + bucket.n + ' hands. ' +
        'The category that should be the most disciplined in your game is leaking.'
      );
      pillarSeverities.push('r');
    }

    var severity = pillarSeverities.length ? Sections.combineSeverity(pillarSeverities) : 'g';

    var impactText = null;
    var soWhatText = null;
    if (pricingSev) {
      impactText = 'Weak draws are the most expensive hands to call without discipline. They win rarely, and when they do not win, they cost you a bet on every street.';
      soWhatText = 'Fold gutshots when the price is not right. The math is unforgiving: 8% equity needs roughly 11 to 1 odds plus implied. Without both you are giving chips away.';
    } else if (pnlVerdict === 'leak') {
      impactText = 'Even at correct prices, weak draws cumulate small losses across many hands. The discipline is the difference between a small leak and a big one.';
      soWhatText = 'Tighten the conditions where you continue with a weak draw. Deep stacks, position, and a clean board texture are the spots; anything else folds.';
    }

    var fired = branchTexts.length > 0 || severity === 'r' || severity === 'a';
    if (!fired) return null;

    // Examples: weak draws called and lost.
    var examples = [];
    var calledLost = pickHands(bucket.hands, function(h) {
      var prof = heroPostflopProfile(h);
      return !!(prof && prof.call > 0 && heroLost(h));
    }, 12);
    if (calledLost.length) {
      examples.push({
        id: 'cards-weak-draws-called-lost',
        label: 'Weak draws you called with and lost',
        hands: calledLost,
        coachingNote: 'Gutshot calls that did not connect. Look at the price you were getting; most of these are folds unless the stack-to-pot ratio is generous and position is yours.'
      });
    }

    return {
      id: 'cards-weak-draws',
      name: 'Weak Draws',
      panel: 'Cards',
      sectionId: 'cards',
      severity: severity,
      score: Sections.score(severity, pricingSev ? pricingSev.deltaUnits : 0),
      openingText: openingText,
      branchTexts: branchTexts,
      impactText: impactText,
      soWhatText: soWhatText,
      examples: examples,
      meta: {
        n: bucket.n, pnl: bucket.pnl, won: bucket.won,
        called: bucket.called, calledLost: bucket.calledLost, calledPnl: bucket.calledPnl,
        perHand: perHand, overallPerHand: overallPerHand
      }
    };
  }

  // ── REGISTER ──────────────────────────────────────────────────────────────

  Sections.defineSection({
    id: 'cards',
    panel: 'Cards',
    run: function(d, extras, hands) {
      if (!d || !d.n || d.n < MIN_AGG) return [];
      if (!hands || !hands.length) return [];

      var buckets = buildBuckets(hands);
      var overallPnl = (d.core && typeof d.core.netPnl === 'number') ? d.core.netPnl : 0;
      var overallPerHand = d.n > 0 ? overallPnl / d.n : 0;

      var out = [];
      var p = buildPremium(d, buckets.premium, overallPerHand);            if (p) out.push(p);
      var s = buildStrong(d, buckets.strong, overallPerHand);              if (s) out.push(s);
      var m = buildMarginal(d, buckets.marginal, overallPerHand);          if (m) out.push(m);
      var sd = buildStrongDraws(d, buckets.strongDraw, overallPerHand);    if (sd) out.push(sd);
      var wd = buildWeakDraws(d, buckets.weakDraw, overallPerHand);        if (wd) out.push(wd);
      var a = buildAir(d, buckets.air, overallPerHand);                    if (a) out.push(a);
      return out;
    }
  });
})();
