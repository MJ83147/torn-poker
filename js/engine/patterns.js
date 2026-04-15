// ── INSIGHT ENGINE: LAYER 2 — PATTERN DETECTOR ──────────────────────────────

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

var PATTERN_METRICS = [
  {
    id: 'win-rate',
    label: 'win rate',
    extract: function(d) { return pct(d.handsWon, d.handsWithOutcome); },
    unit: '%',
    threshold: 15,
    minN: 15
  },
  {
    id: 'vpip',
    label: 'VPIP',
    extract: function(d) { return pct(d.vpip, d.n); },
    unit: '%',
    threshold: 12,
    minN: 15
  },
  {
    id: 'aggression',
    label: 'aggression',
    extract: function(d) { return calcAggression(d.raises, d.calls, d.checks); },
    unit: '%',
    threshold: 10,
    minN: 15
  },
  {
    id: 'cbet',
    label: 'c-bet rate',
    extract: function(d) { return pct(d.cbetDone, d.cbetOpps); },
    unit: '%',
    threshold: 15,
    minN: 8
  },
  {
    id: 'fold-to-raise',
    label: 'fold-to-raise',
    extract: function(d) { return pct(d.foldedToRaise, d.facedRaise); },
    unit: '%',
    threshold: 15,
    minN: 8
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

          if (dA.n < metric.minN || dB.n < metric.minN) continue;

          var valA = metric.extract(dA);
          var valB = metric.extract(dB);

          if (valA === null || valB === null) continue;

          var diff = valA - valB;
          var absDiff = Math.abs(diff);

          if (absDiff < metric.threshold) continue;

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

          var patSev = absDiff > metric.threshold * 2 ? 'r' : 'a';
          var patScore = absDiff * significance * Math.min(higherN, lowerN) / 20;

          patterns.push({
            id: 'pat-' + dim.id + '-' + metric.id,
            dimension: dim.id,
            metric: metric.id,
            panels: dim.panels,
            tags: [dim.id, metric.id, 'pattern', 'auto-detected'],
            sev: patSev,
            score: patScore,
            label: metric.label + ' gap: ' + higherLabel + ' vs ' + lowerLabel,
            text: 'Your ' + metric.label + ' is ' + higherVal + metric.unit +
                  ' in ' + higherLabel + ' (' + higherN + ' hands) vs ' +
                  lowerVal + metric.unit + ' in ' + lowerLabel +
                  ' (' + lowerN + ' hands). A ' + absDiff + '-point gap.',
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
