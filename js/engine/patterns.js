// ── INSIGHT ENGINE: LAYER 2 - PATTERN DETECTOR ──────────────────────────────

var PATTERN_DIMENSIONS = [
  {
    id: 'position',
    label: 'Position',
    split: function(h) {
      var cat = getPositionCategory(h.position);
      return (cat === 'EP' || cat === 'MP') ? 'early' : (cat === 'LP') ? 'late' : null;
    },
    labels: { early: 'Early Position', late: 'Late Position' },
    panels: ['position', 'mygame']
  },
  {
    id: 'hand-strength',
    label: 'Hand Strength',
    split: function(h) {
      var key = parseHoleKey(h.hole);
      if (!key) return null;
      var cls = classifyKey(key);
      return (cls === 'Pocket Pairs' || cls === 'Broadway') ? 'premium' : 'marginal';
    },
    labels: { premium: 'Premium Hands', marginal: 'Marginal Hands' },
    panels: ['cards', 'mygame']
  },
  {
    id: 'session-half',
    label: 'Session Progress',
    preSegment: function(hands) {
      return splitSessionHalves(hands, 20).handToHalf;
    },
    split: function(h, idx, total, hands, preComputed) {
      return preComputed ? (preComputed.get(h) || null) : null;
    },
    labels: { first: 'First Half of Session', second: 'Second Half of Session' },
    panels: ['trends', 'mygame']
  },
  {
    id: 'after-big-loss',
    label: 'Tilt Detection',
    split: function(h, idx, total, hands) {
      if (idx < 1) return 'normal';
      var prev = hands[idx - 1];
      var prevPnl = getHandPnlValue(prev);
      var bb = getHandBB(prev);
      // Big loss = more than 10 BB
      if (bb && bb > 0 && prevPnl < -bb * 10) return 'after-loss';
      return 'normal';
    },
    labels: { 'after-loss': 'After Big Loss', normal: 'Normal Play' },
    panels: ['trends', 'mygame']
  },
  {
    id: 'won-vs-lost',
    label: 'Outcome',
    split: function(h) {
      if (!h.outcome) return null;
      return h.outcome.result === 'won' ? 'won' : 'lost';
    },
    labels: { won: 'Winning Hands', lost: 'Losing Hands' },
    panels: ['actions', 'showdown']
  }
];

// Each metric carries a baseline threshold (used as the floor) and a hard
// minimum-N gate. The actual trigger threshold is scaled up when the smaller
// segment is below 40 hands so noisy splits don't fire spurious patterns.
var PATTERN_METRICS = [
  {
    id: 'win-rate',
    label: 'win rate',
    extract: function(d) { return pct(d.handsWon, d.handsWithOutcome); },
    unit: '%',
    baseThreshold: 12,
    minN: 30,
    implication: function(higher, lower, sign) {
      return 'You\'re winning more often in ' + higher + ' than in ' + lower + ' - keep doing what works there and look for what changes between segments.';
    }
  },
  {
    id: 'vpip',
    label: 'VPIP',
    extract: function(d) { return pct(d.vpip, d.n); },
    unit: '%',
    baseThreshold: 10,
    minN: 20,
    implication: function(higher, lower, sign) {
      return 'You enter more pots in ' + higher + ' - make sure the wider range isn\'t bleeding chips on missed flops.';
    }
  },
  {
    id: 'aggression',
    label: 'aggression',
    extract: function(d) { return calcAggression(d.raises, d.calls, d.checks); },
    unit: '%',
    baseThreshold: 8,
    minN: 20,
    implication: function(higher, lower, sign) {
      return 'You bet and raise more in ' + higher + ' - match that initiative in ' + lower + ' if the spots warrant it.';
    }
  },
  {
    id: 'pfr',
    label: 'PFR',
    extract: function(d) { return pct(d.pfrHands, d.n); },
    unit: '%',
    baseThreshold: 8,
    minN: 20,
    implication: function(higher, lower, sign) {
      return 'You raise preflop more often in ' + higher + ' - your initiative shifts between segments.';
    }
  },
  {
    id: 'cbet',
    label: 'c-bet rate',
    extract: function(d) { return pct(d.cbetDone, d.cbetOpps); },
    unit: '%',
    baseThreshold: 12,
    minN: 15,
    implication: function(higher, lower, sign) {
      return 'You follow up the flop more often in ' + higher + ' - failing to fire in ' + lower + ' gives up initiative.';
    }
  },
  {
    id: 'fold-to-raise',
    label: 'fold-to-raise',
    extract: function(d) { return pct(d.foldedToRaise, d.facedRaise); },
    unit: '%',
    baseThreshold: 12,
    minN: 10,
    implication: function(higher, lower, sign) {
      return 'You fold to raises more in ' + higher + ' - opponents who notice can press you off pots cheaply there.';
    }
  }
];

function detectPatterns(d, hands) {
  var patterns = [];

  // Sort hands by timestamp for session-order dimensions
  var sorted = hands.slice().sort(function(a, b) {
    return (a.timestamp || 0) - (b.timestamp || 0);
  });

  for (var di = 0; di < PATTERN_DIMENSIONS.length; di++) {
    var dim = PATTERN_DIMENSIONS[di];

    // Segment hands
    var preComputed = typeof dim.preSegment === 'function' ? dim.preSegment(sorted) : null;
    var buckets = {};
    for (var hi = 0; hi < sorted.length; hi++) {
      var seg = dim.split(sorted[hi], hi, sorted.length, sorted, preComputed);
      if (seg === null) continue;
      if (!buckets[seg]) buckets[seg] = [];
      buckets[seg].push(sorted[hi]);
    }

    var segKeys = Object.keys(buckets);
    if (segKeys.length < 2) continue;

    // Compare each pair of segments
    for (var si = 0; si < segKeys.length; si++) {
      for (var sj = si + 1; sj < segKeys.length; sj++) {
        var segA = segKeys[si];
        var segB = segKeys[sj];
        var handsA = buckets[segA];
        var handsB = buckets[segB];

        var dA = analyse(handsA);
        var dB = analyse(handsB);

        for (var mi = 0; mi < PATTERN_METRICS.length; mi++) {
          var metric = PATTERN_METRICS[mi];

          // Hard minimum-N gate per metric - both segments must clear it.
          if (dA.n < metric.minN || dB.n < metric.minN) continue;

          var valA = metric.extract(dA);
          var valB = metric.extract(dB);

          if (valA === null || valB === null) continue;

          var diff = valA - valB;
          var absDiff = Math.abs(diff);

          // Dynamic trigger: scale the base threshold up when the smaller
          // segment is small. Floor at base so big samples never relax.
          var smallerN = Math.min(dA.n, dB.n);
          var dynamicThresh = scaleThresh(metric.baseThreshold, smallerN);

          if (absDiff < dynamicThresh) continue;

          var overall = metric.extract(d);
          var significance = overall !== null && overall !== 0
            ? absDiff / Math.max(Math.abs(overall), 1)
            : absDiff / 100;

          var higherSeg = diff > 0 ? segA : segB;
          var lowerSeg = diff > 0 ? segB : segA;
          var higherLabel = dim.labels[higherSeg] || higherSeg;
          var lowerLabel = dim.labels[lowerSeg] || lowerSeg;
          var higherVal = diff > 0 ? valA : valB;
          var lowerVal = diff > 0 ? valB : valA;
          var higherN = diff > 0 ? dA.n : dB.n;
          var lowerN = diff > 0 ? dB.n : dA.n;

          var patSev = absDiff > dynamicThresh * 2 ? 'r' : 'a';
          var patScore = absDiff * significance * Math.min(higherN, lowerN) / 20;

          var implication = typeof metric.implication === 'function'
            ? metric.implication(higherLabel, lowerLabel, diff > 0 ? 1 : -1)
            : '';

          patterns.push({
            id: 'pat-' + dim.id + '-' + metric.id,
            dimension: dim.id,
            metric: metric.id,
            panels: dim.panels,
            tags: [dim.id, metric.id, 'pattern', 'auto-detected'],
            sev: patSev,
            score: patScore,
            label: _titleCase(metric.label) + ' Gap: ' + higherLabel + ' Vs ' + lowerLabel,
            text: 'Your ' + metric.label + ' is ' + higherVal + metric.unit +
                  ' in ' + higherLabel + ' (' + higherN + ' hands) vs ' +
                  lowerVal + metric.unit + ' in ' + lowerLabel +
                  ' (' + lowerN + ' hands). ' + implication,
            chips: [
              { v: higherLabel + ': ' + higherVal + metric.unit, hi: true },
              { v: lowerLabel + ': ' + lowerVal + metric.unit }
            ],
            costBB: null
          });
        }
      }
    }
  }

  // Sort by score
  patterns.sort(function(a, b) { return b.score - a.score; });

  // Deduplicate: keep highest-scoring per dimension+metric
  var seen = {};
  var deduped = [];
  for (var i = 0; i < patterns.length; i++) {
    var key = patterns[i].dimension + ':' + patterns[i].metric;
    if (!seen[key]) {
      seen[key] = true;
      deduped.push(patterns[i]);
    }
  }

  return deduped;
}

// Title-case a multi-word label, preserving hyphens. "fold-to-raise" →
// "Fold-To-Raise"; "win rate" → "Win Rate".
function _titleCase(s) {
  if (!s) return s;
  return String(s).split(' ').map(function(word) {
    return word.split('-').map(function(part) {
      if (!part) return part;
      return part.charAt(0).toUpperCase() + part.slice(1);
    }).join('-');
  }).join(' ');
}
