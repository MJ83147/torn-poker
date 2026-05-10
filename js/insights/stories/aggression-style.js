// ── STORY: Aggression style ───────────────────────────────────────────────────
// Reads aggression factor: bets-and-raises divided by calls-plus-checks.
// Cells: per position and per seat count. Lives in My Game.

(function() {
  function afOf(sub) {
    if (!sub) return null;
    return calcAggression(sub.raises, sub.calls, sub.checks);
  }

  function buildPositionCells(d) {
    var cells = [];
    if (!d || !d.byPosition) return cells;
    for (var pos in d.byPosition) {
      var pd = d.byPosition[pos];
      if (!pd || pd.gated) continue;
      if (!pd.totalActs || pd.totalActs < 15) continue;
      var seats = (typeof dominantSeats === 'function') ? dominantSeats(d) : null;
      var target = null;
      if (typeof matrixTarget === 'function' && seats) {
        target = matrixTarget('af', pos, seats, (typeof getUserStyle === 'function') ? getUserStyle() : 'TAG');
      }
      cells.push({
        scope: 'position',
        key: pos,
        value: afOf(pd),
        n: pd.totalActs,
        target: target,
        winRate: pd.core ? pd.core.wr : null
      });
    }
    return cells;
  }

  function buildSeatCells(d) {
    var cells = [];
    if (!d || !d.bySeatBucket) return cells;
    for (var sb in d.bySeatBucket) {
      var sd = d.bySeatBucket[sb];
      if (!sd || sd.gated) continue;
      if (!sd.totalActs || sd.totalActs < 15) continue;
      var seats = parseInt(sb, 10);
      var defaultPos = seats === 2 ? 'BTN' : seats === 3 ? 'BTN' : 'CO';
      var target = null;
      if (typeof matrixTarget === 'function') {
        target = matrixTarget('af', defaultPos, seats, (typeof getUserStyle === 'function') ? getUserStyle() : 'TAG');
      }
      cells.push({
        scope: 'seats',
        key: sb,
        value: afOf(sd),
        n: sd.totalActs,
        target: target,
        winRate: sd.core ? sd.core.wr : null
      });
    }
    return cells;
  }

  Insights.defineStory({
    id: 'aggression-style',
    name: 'Aggression',
    panel: 'My Game',
    category: 'aggression-style',
    minSample: 30,
    strengthSide: 'high',

    measure: function(d) {
      if (!d || !d.totalActs || d.totalActs < 15) return null;
      var value = afOf(d);
      if (value == null) return null;
      return {
        value: value,
        n: d.totalActs,
        cells: buildPositionCells(d).concat(buildSeatCells(d))
      };
    },

    band: function(d) {
      return (typeof bandFor === 'function') ? bandFor('af', d) : null;
    },

    implications: {
      high: 'You are firing a lot. Combined with a healthy fold-to-raise this is fine. Combined with a low one you get trapped for value.',
      low: 'You play too passively after the flop. Strong hands need to bet for value and weak hands sometimes need to bluff.'
    },
    advice: {
      high: 'Cross-check your fold-to-raise. If it is low your bluffs are getting paid off.',
      low: 'Lean toward betting when you face postflop decisions. Check-call should not be your default.'
    }
  });
})();
