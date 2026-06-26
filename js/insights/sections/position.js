(function() {
  var F = Sections.section('position', 'Position');

  var WEAK_TYPES_EARLY = ['Ace-Rag', 'Suited Connectors', 'Suited', 'Connectors', 'Offsuit Trash'];
  var WEAK_TYPES_MIDDLE = ['Ace-Rag', 'Connectors', 'Offsuit Trash'];
  var WEAK_TYPES_LATE = ['Offsuit Trash'];

  // Seat display names come from the global SEAT_NAMES (constants.js). The one
  // exception is the BB card title, which keeps its punchier original label.
  var SEAT_TITLE_OVERRIDES = { 'BB': 'The Big Blind Problem' };

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

    var group = seatGroup(position);
    var threshold = group === 'early' ? 35 : group === 'middle' ? 45 : 65;
    var severity = 'g';
    if (weakPct >= threshold + 15) severity = 'r';
    else if (weakPct >= threshold) severity = 'a';

    if (severity === 'g') {
      return { id: 'composition', severity: 'g', value: weakPct, totalPlayed: totalPlayed };
    }

    weakBuckets.sort(function(a, b) { return b.played - a.played; });
    var top = weakBuckets.slice(0, 2).map(function(b) {
      return b.key + ' (' + (pct(b.played, totalPlayed) || 0) + '%)';
    }).join(' and ');
    var branchText = 'At ' + position + ', ' + Math.round(weakPct) + '% of the hands you play are ' +
      (group === 'early' ? 'outside the premium and broadway range' :
       group === 'middle' ? 'marginal hand types' : 'offsuit trash') +
      '. The biggest contributors are ' + top + '.';

    var weakKeys = {};
    for (var wi = 0; wi < weakBuckets.length; wi++) weakKeys[weakBuckets[wi].key] = true;
    var weakHands = pickHands(hands, function(h) {
      if ((h.position || '?') !== position) return false;
      if (!heroPlayed(h)) return false;
      var key = (typeof parseHoleKey === 'function') ? parseHoleKey(h.hole) : null;
      var bucket = (key && typeof classifyKey === 'function') ? classifyKey(key) : null;
      return bucket && weakKeys[bucket];
    }, 12);
    var examples = null;
    if (weakHands.length) {
      examples = {
        id: 'pos-composition-' + position,
        label: 'Weak opens you played from ' + position,
        hands: weakHands,
        coachingNote: 'Hands at the bottom of your ' + position + ' range. Try folding these next time and watch how the seat\'s win rate moves.'
      };
    }

    return {
      id: 'composition',
      severity: severity,
      direction: 'high',
      deltaUnits: (weakPct - threshold) / 15,
      value: weakPct,
      branchText: branchText,
      composition: weakBuckets,
      examples: examples
    };
  }

  function buildPnlPillar(d, hands, position, seats, cell) {
    if (!cell || !cell.source.n) return null;
    var s = d.posMap && d.posMap[position];
    if (!s || !s.hands) return null;
    var seatPnlPerHand = s.pnl / s.hands;
    var overallPnl = d.core ? d.core.netPnl : 0;
    var overallPerHand = d.n > 0 ? overallPnl / d.n : 0;

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
    var branchText = 'This seat runs at a loss: ' + fmtFn(s.pnl) +
      ' over ' + s.hands + ' hands (' + fmtFn(seatPnlPerHand) + ' per hand)' +
      (overallPerHand > 0 ? ', while your overall rate is ' + fmtFn(overallPerHand) + ' per hand' : '') + '.';

    var lostHere = pickHands(hands, function(h) {
      return (h.position || '?') === position && heroLost(h);
    }, 12);
    var examples = null;
    if (lostHere.length) {
      examples = {
        id: 'pos-losses-' + position,
        label: 'Losing hands at ' + position,
        hands: lostHere,
        coachingNote: 'Recent hands at ' + position + ' that lost chips. Look for the postflop pattern that keeps recurring here.'
      };
    }

    return {
      id: 'pnl',
      severity: severity,
      direction: 'low',
      deltaUnits: ratio,
      value: seatPnlPerHand,
      gap: gap,
      branchText: branchText,
      total: s.pnl,
      hands: s.hands,
      examples: examples
    };
  }

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

    if (!firedLeak.length) return null;

    var seatTitle = SEAT_TITLE_OVERRIDES[position] || SEAT_NAMES[position] || position;
    var seatNarrative = SEAT_NAMES[position] || position;
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

    var examples = [];
    for (var p = 0; p < pillars.length; p++) {
      if (pillars[p].examples) examples.push(pillars[p].examples);
    }

    var score = Sections.score(severity, freq ? freq.deltaUnits : 0);

    return F({
      id: 'position-' + position.toLowerCase().replace(/\W+/g, '-'),
      name: seatTitle,
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
    });
  }

  Sections.defineSection({
    id: 'position',
    panel: 'Position',
    run: function(d, extras, hands) {
      if (!d || !d.n) return [];
      var seats = dominantSeats(d);
      var out = [];
      for (var i = 0; i < POSITION_ORDER.length; i++) {
        var story = buildSeatStory(d, extras, hands, POSITION_ORDER[i], seats);
        if (story) out.push(story);
      }
      return out;
    }
  });
})();
