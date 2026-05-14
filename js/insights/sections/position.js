// ── POSITION SECTION ──────────────────────────────────────────────────────────
//
// One story per seat (UTG, UTG+1, MP, LJ, HJ, CO, BTN, SB, BB). Each story
// runs three pillars against the same shared engine and produces one finding:
//
//   Pillar 1: play frequency at the seat
//     VPIP at this position vs the matrix band for (position, seats). Drives
//     the "too wide" / "too tight" reading.
//
//   Pillar 2: hand composition at the seat
//     Distribution of played hands by hand-type bucket. Flags when the seat's
//     range is dominated by weak hand types relative to a sensible mix for
//     that seat.
//
//   Pillar 3: P&L at the seat
//     Per-hand P&L at this seat compared to the player's overall per-hand
//     P&L. Directional (no target band).
//
// The seat-level finding pulls the worst pillar's severity, lists each fired
// pillar as a branch sentence, and templates impact and so what from which
// pillars fired. Example hands surface from whichever pillar dominates.

(function() {
  var SEAT_ORDER = ['UTG', 'UTG+1', 'MP', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'];

  // Weight by which hand types are "weak openers" per seat group.
  // Early seats: anything outside premium pairs + broadway is suspect.
  // Late seats: only offsuit trash is suspect.
  var WEAK_TYPES_EARLY = ['Ace-Rag', 'Suited Connectors', 'Suited', 'Connectors', 'Offsuit Trash'];
  var WEAK_TYPES_MIDDLE = ['Ace-Rag', 'Connectors', 'Offsuit Trash'];
  var WEAK_TYPES_LATE = ['Offsuit Trash'];

  // Story titles (used as the card headline).
  var SEAT_TITLES = {
    'UTG': 'Under the Gun',
    'UTG+1': 'UTG+1',
    'MP': 'Middle Position',
    'LJ': 'Lojack',
    'HJ': 'Hijack',
    'CO': 'Cutoff',
    'BTN': 'Button',
    'SB': 'Small Blind',
    'BB': 'The Big Blind Problem'
  };

  // Plain seat names used inside narrative copy. BB's full title is the story
  // title, but in the opening sentence we say "Big Blind" to keep it readable.
  var SEAT_NARRATIVE = {
    'UTG': 'Under the Gun',
    'UTG+1': 'UTG+1',
    'MP': 'Middle Position',
    'LJ': 'Lojack',
    'HJ': 'Hijack',
    'CO': 'Cutoff',
    'BTN': 'Button',
    'SB': 'Small Blind',
    'BB': 'Big Blind'
  };

  // Seat group used to pick the "weak types" threshold and tailor copy.
  function seatGroup(pos) {
    if (pos === 'UTG' || pos === 'UTG+1') return 'early';
    if (pos === 'MP' || pos === 'LJ') return 'middle';
    if (pos === 'HJ' || pos === 'CO' || pos === 'BTN') return 'late';
    return 'blind';
  }

  function weakTypesFor(pos) {
    var g = seatGroup(pos);
    if (g === 'early') return WEAK_TYPES_EARLY;
    if (g === 'middle') return WEAK_TYPES_MIDDLE;
    return WEAK_TYPES_LATE;
  }

  // True if hero called or bet or raised at any point. Mirrors the helper in
  // sections/range.js so the file is self-contained; tiny so dedupe later if
  // it becomes a pattern.
  function heroPlayed(h) {
    if (!h || !h.actions) return false;
    var acts = (typeof parseActions === 'function') ? parseActions(h.actions) : [];
    for (var i = 0; i < acts.length; i++) {
      var a = acts[i];
      if (!a.isMe) continue;
      if (a.type === 'call' || a.type === 'bet' || a.type === 'raise') return true;
    }
    return false;
  }

  function heroFoldedPreflop(h) {
    if (!h || !h.actions) return false;
    var acts = (typeof parseActions === 'function') ? parseActions(h.actions) : [];
    for (var i = 0; i < acts.length; i++) {
      var a = acts[i];
      if (!a.isMe || a.street !== 'Preflop') continue;
      if (a.type === 'sb' || a.type === 'bb') continue;
      return a.type === 'fold';
    }
    return false;
  }

  function pickHands(hands, predicate, cap) {
    var out = [];
    if (!hands) return out;
    for (var i = hands.length - 1; i >= 0 && out.length < cap; i--) {
      if (predicate(hands[i])) out.push(hands[i]);
    }
    return out;
  }

  // True when the hand was a net loss for hero. Folded preflop counts only when
  // there was real investment (blind posts cost chips even when folding).
  function heroLost(h) {
    if (!h || !h.outcome) return false;
    if (h.outcome.result === 'won') return false;
    var inv = (typeof getInvested === 'function') ? getInvested(h) : 0;
    return inv > 0;
  }

  function heroWon(h) {
    if (!h || !h.outcome) return false;
    if (h.outcome.result !== 'won') return false;
    var amt = h.outcome.amount || 0;
    var inv = (typeof getInvested === 'function') ? getInvested(h) : 0;
    return amt - inv > 0;
  }

  // Pull the right per-seat sub-d. Prefer the seat-count cell (most precise),
  // fall back to the position slice when the cell sample is below MIN_CELL.
  // The seat-count label is only attached when that bucket represents a strong
  // majority of the player's hands at this seat. Otherwise it would mislead
  // anyone who plays mixed table sizes.
  // Returns { source, label, n }.
  function cellFor(d, position, seats) {
    var posOverall = (d.byPosition && d.byPosition[position]) ? d.byPosition[position] : null;
    if (seats && d.byPosSeat) {
      var key = position + '|' + seats + 'p';
      var cell = d.byPosSeat[key];
      if (cell && !cell.gated && cell.n >= 10) {
        var dominant = posOverall && posOverall.n > 0 ? (cell.n / posOverall.n) >= 0.6 : true;
        return { source: cell, label: dominant ? seats + '-handed' : null, n: cell.n };
      }
    }
    if (posOverall && !posOverall.gated) {
      return { source: posOverall, label: null, n: posOverall.n };
    }
    return null;
  }

  // ── PILLAR 1: PLAY FREQUENCY ───────────────────────────────────────────────

  function buildFrequencyPillar(d, hands, position, seats, cell) {
    if (!cell || !cell.source.n) return null;
    var vpip = (cell.source.vpip / cell.source.n) * 100;
    var band = (typeof TargetBands !== 'undefined') ? TargetBands.bandFor('vpip', position, seats || 6) : null;
    var sev = Sections.classify(vpip, band, null);
    if (!sev) return null;

    var branchText = null;
    var examples = null;

    if (sev.severity === 'r' || sev.severity === 'a') {
      var dirWord = sev.direction === 'high' ? 'above' : 'below';
      branchText = 'You play ' + Math.round(vpip) + '% from ' + position +
        ', ' + dirWord + ' the ' + Sections.fmtBand(band) + ' target' +
        (cell.label ? ' for ' + cell.label : '') + '.';

      // Examples: when too wide we surface hands the player PLAYED from this
      // seat that LOST money (the marginal combos to drop). When too tight we
      // surface hands they folded that look like missed opens.
      if (sev.direction === 'high') {
        var losingPlays = pickHands(hands, function(h) {
          return (h.position || '?') === position && heroPlayed(h) && heroLost(h);
        }, 12);
        if (losingPlays.length) {
          examples = {
            id: 'pos-losing-plays-' + position,
            label: 'Losing hands you played from ' + position,
            hands: losingPlays,
            coachingNote: 'Your ' + position + ' play rate is ' + Math.round(vpip) +
              '%, above the ' + Sections.fmtBand(band) + ' target. ' +
              'These are the hands that lost from this seat. Look for the marginal combos to drop.'
          };
        }
      } else {
        var folded = pickHands(hands, function(h) {
          return (h.position || '?') === position && heroFoldedPreflop(h);
        }, 12);
        if (folded.length) {
          examples = {
            id: 'pos-folded-' + position,
            label: 'Hands folded from ' + position,
            hands: folded,
            coachingNote: 'Your ' + position + ' play rate is ' + Math.round(vpip) +
              '%, below the ' + Sections.fmtBand(band) + ' target. ' +
              'These are hands you folded at this seat that could be opens.'
          };
        }
      }
    }

    return {
      id: 'frequency',
      severity: sev.severity,
      direction: sev.direction,
      deltaUnits: sev.deltaUnits,
      value: vpip,
      band: band,
      branchText: branchText,
      examples: examples
    };
  }

  // ── PILLAR 2: HAND COMPOSITION ─────────────────────────────────────────────

  function buildCompositionPillar(d, hands, position, seats, cell) {
    if (!cell || !cell.source.htMap) return null;
    var ht = cell.source.htMap;
    var totalPlayed = 0;
    for (var k in ht) totalPlayed += ht[k].played || 0;
    if (totalPlayed < 10) return null;

    var weak = weakTypesFor(position);
    var weakPlayed = 0;
    var weakBuckets = [];
    for (var i = 0; i < weak.length; i++) {
      var bucket = ht[weak[i]];
      if (!bucket || !bucket.played) continue;
      weakPlayed += bucket.played;
      weakBuckets.push({ key: weak[i], played: bucket.played });
    }
    var weakPct = totalPlayed > 0 ? (weakPlayed / totalPlayed) * 100 : 0;

    // Thresholds tuned by seat group.
    var group = seatGroup(position);
    var threshold = group === 'early' ? 35 : group === 'middle' ? 45 : 65;
    var severity = 'g';
    if (weakPct >= threshold + 15) severity = 'r';
    else if (weakPct >= threshold) severity = 'a';

    if (severity === 'g') {
      return { id: 'composition', severity: 'g', value: weakPct, totalPlayed: totalPlayed };
    }

    // Sort weak buckets by share to name the loudest two.
    weakBuckets.sort(function(a, b) { return b.played - a.played; });
    var top = weakBuckets.slice(0, 2).map(function(b) {
      return b.key + ' (' + Math.round((b.played / totalPlayed) * 100) + '%)';
    }).join(' and ');
    var branchText = 'At ' + position + ', ' + Math.round(weakPct) + '% of the hands you play are ' +
      (group === 'early' ? 'outside the premium and broadway range' :
       group === 'middle' ? 'marginal hand types' : 'offsuit trash') +
      '. The biggest contributors are ' + top + '.';

    return {
      id: 'composition',
      severity: severity,
      direction: 'high',
      deltaUnits: (weakPct - threshold) / 15,
      value: weakPct,
      branchText: branchText,
      composition: weakBuckets
    };
  }

  // ── PILLAR 3: P&L ──────────────────────────────────────────────────────────

  function buildPnlPillar(d, hands, position, seats, cell) {
    if (!cell || !cell.source.n) return null;
    var s = d.posMap && d.posMap[position];
    if (!s || !s.hands) return null;
    var seatPnlPerHand = s.pnl / s.hands;
    var overallPnl = d.core ? d.core.netPnl : 0;
    var overallPerHand = d.n > 0 ? overallPnl / d.n : 0;

    // Directional: no band. Fire as a leak when the seat is meaningfully worse
    // than the player's overall per-hand rate, and the seat itself is losing.
    var gap = seatPnlPerHand - overallPerHand;
    var ratio = Math.abs(gap) / (Math.abs(overallPerHand) + 1);

    if (seatPnlPerHand >= 0 && gap >= 0) {
      return { id: 'pnl', severity: 'g', value: seatPnlPerHand, gap: gap };
    }

    var severity;
    if (seatPnlPerHand < 0 && gap < 0 && ratio > 0.5) severity = 'r';
    else if (seatPnlPerHand < 0) severity = 'a';
    else severity = 'g';

    if (severity === 'g') {
      return { id: 'pnl', severity: 'g', value: seatPnlPerHand, gap: gap };
    }

    var fmtFn = (typeof fmtPnl === 'function') ? fmtPnl : function(v) { return String(Math.round(v)); };
    var branchText = position + ' is your worst position by P&L: ' + fmtFn(s.pnl) +
      ' across ' + s.hands + ' hands' +
      (overallPerHand > 0 ? ', against your overall rate of ' + fmtFn(overallPerHand) + ' per hand' : '') + '.';

    return {
      id: 'pnl',
      severity: severity,
      direction: 'low',
      deltaUnits: ratio,
      value: seatPnlPerHand,
      gap: gap,
      branchText: branchText,
      total: s.pnl,
      hands: s.hands
    };
  }

  // ── COMPOSE SEAT STORY ─────────────────────────────────────────────────────

  function buildSeatStory(d, extras, hands, position, seats) {
    var cell = cellFor(d, position, seats);
    if (!cell) return null;

    var freq = buildFrequencyPillar(d, hands, position, seats, cell);
    var comp = buildCompositionPillar(d, hands, position, seats, cell);
    var pnl  = buildPnlPillar(d, hands, position, seats, cell);

    var pillars = [freq, comp, pnl].filter(Boolean);
    if (!pillars.length) return null;

    var firedLeak = pillars.filter(function(p) { return p.severity === 'r' || p.severity === 'a'; });
    var severity = Sections.combineSeverity(pillars.map(function(p) { return p.severity; }));

    // Display gate: only render if at least one pillar fired a leak or the
    // seat has a notable P&L story. Quiet seats stay silent.
    if (!firedLeak.length) return null;

    var seatTitle = SEAT_TITLES[position] || position;
    var seatNarrative = SEAT_NARRATIVE[position] || position;
    // Avoid duplication when the narrative name matches the position code
    // (e.g. UTG+1, MP) and trim "you played" copy to read naturally.
    var heading = (seatNarrative === position)
      ? 'At ' + position
      : 'At ' + seatNarrative + ' (' + position + ')';
    var openingText = heading + ' you played ' + cell.n + ' hands' +
      (cell.label ? ' across ' + cell.label + ' games' : '') + '. ';
    if (d.posMap && d.posMap[position]) {
      var fmtFn = (typeof fmtPnl === 'function') ? fmtPnl : function(v) { return String(Math.round(v)); };
      openingText += 'Net P&L at this seat: ' + fmtFn(d.posMap[position].pnl) + '.';
    }

    var branchTexts = [];
    for (var i = 0; i < pillars.length; i++) {
      if (pillars[i].branchText) branchTexts.push(pillars[i].branchText);
    }

    // Impact and so-what templated by which pillars fired.
    var impactText = null;
    var soWhatText = null;
    var freqFired = freq && (freq.severity === 'r' || freq.severity === 'a');
    var compFired = comp && (comp.severity === 'r' || comp.severity === 'a');
    var pnlFired  = pnl  && (pnl.severity  === 'r' || pnl.severity  === 'a');

    var g = seatGroup(position);

    if (freqFired && compFired && freq.direction === 'high') {
      impactText = 'Wide opens combined with weak hand selection at ' + position +
        ' cost chips on every street. The full field acts behind, and the only edge is range strength, which is going the wrong way.';
      soWhatText = 'Tighten ' + position + ' to pairs, premium broadways, and suited aces only. Drop the weak hand types pulling the average up.';
    } else if (freqFired && freq.direction === 'high') {
      impactText = 'Playing wide from ' + position + ' commits chips with hands that struggle once the action starts.';
      soWhatText = 'Cut the marginal combos in your ' + position + ' opening range.';
    } else if (freqFired && freq.direction === 'low') {
      if (g === 'late') {
        impactText = 'Folding too often from ' + position + ' surrenders the positional advantage this seat is built to exploit.';
        soWhatText = 'Open wider from ' + position + '. Any pair, any suited ace, any broadway, suited connectors.';
      } else if (g === 'blind') {
        impactText = 'Defending too rarely from ' + position + ' lets opponents steal cheap and barrel cheaply.';
        soWhatText = 'Widen the ' + position + ' continuing range, with more 3-bets in the mix.';
      } else {
        impactText = 'Tight ' + position + ' play is fine in isolation but the seat returns more when the right hands are added.';
        soWhatText = 'Widen ' + position + ' to include the late additions that fit a wider range here.';
      }
    } else if (compFired) {
      impactText = 'The seats around ' + position + ' have learned what your range looks like. Weak hand types compound the positional disadvantage.';
      soWhatText = 'Remove the weakest hand types from your ' + position + ' opens and keep the rest.';
    } else if (pnlFired) {
      impactText = position + ' is leaking chips at a rate higher than the rest of your game.';
      soWhatText = 'Filter the hand log to ' + position + ' and look for the postflop pattern that is unique to this seat.';
    }

    // Merge examples from whichever pillar produced them.
    var examples = [];
    for (var p = 0; p < pillars.length; p++) {
      if (pillars[p].examples) examples.push(pillars[p].examples);
    }

    var score = Sections.score(severity, freq ? freq.deltaUnits : 0);

    return {
      id: 'position-' + position.toLowerCase().replace(/\W+/g, '-'),
      name: seatTitle,
      panel: 'Position',
      sectionId: 'position',
      severity: severity,
      score: score,
      openingText: openingText,
      branchTexts: branchTexts,
      impactText: impactText,
      soWhatText: soWhatText,
      examples: examples,
      meta: {
        position: position,
        seats: seats,
        cellLabel: cell.label,
        pillars: pillars
      }
    };
  }

  // ── REGISTER ───────────────────────────────────────────────────────────────

  Sections.defineSection({
    id: 'position',
    panel: 'Position',
    run: function(d, extras, hands) {
      if (!d || !d.n) return [];
      var seats = (typeof dominantSeats === 'function') ? dominantSeats(d) : null;
      var out = [];
      for (var i = 0; i < SEAT_ORDER.length; i++) {
        var story = buildSeatStory(d, extras, hands, SEAT_ORDER[i], seats);
        if (story) out.push(story);
      }
      return out;
    }
  });
})();
