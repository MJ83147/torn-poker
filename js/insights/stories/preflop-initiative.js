// ── STORY: Preflop initiative ─────────────────────────────────────────────────
// Reads PFR: how often the player raises preflop. Cells: per position and per
// seat count. Lives in the Betting panel.

(function() {
  function buildPositionCells(d) {
    var cells = [];
    if (!d || !d.byPosition) return cells;
    for (var pos in d.byPosition) {
      var pd = d.byPosition[pos];
      if (!pd || pd.gated || !pd.n || pd.n < 10) continue;
      var seats = (typeof dominantSeats === 'function') ? dominantSeats(d) : null;
      var target = null;
      if (typeof matrixTarget === 'function' && seats) {
        target = matrixTarget('pfr', pos, seats, (typeof getUserStyle === 'function') ? getUserStyle() : 'TAG');
      }
      cells.push({
        scope: 'position',
        key: pos,
        value: pct(pd.pfrHands, pd.n),
        n: pd.n,
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
      if (!sd || sd.gated || !sd.n || sd.n < 10) continue;
      var seats = parseInt(sb, 10);
      var defaultPos = seats === 2 ? 'BTN' : seats === 3 ? 'BTN' : 'CO';
      var target = null;
      if (typeof matrixTarget === 'function') {
        target = matrixTarget('pfr', defaultPos, seats, (typeof getUserStyle === 'function') ? getUserStyle() : 'TAG');
      }
      cells.push({
        scope: 'seats',
        key: sb,
        value: pct(sd.pfrHands, sd.n),
        n: sd.n,
        target: target,
        winRate: sd.core ? sd.core.wr : null
      });
    }
    return cells;
  }

  Insights.defineStory({
    id: 'preflop-initiative',
    name: 'PFR',
    panel: 'Betting',
    category: 'preflop-initiative',
    minSample: 30,
    strengthSide: 'high',

    measure: function(d) {
      if (!d || !d.n || d.n < 30) return null;
      return {
        value: pct(d.pfrHands, d.n),
        n: d.n,
        cells: buildPositionCells(d).concat(buildSeatCells(d))
      };
    },

    band: function(d) {
      return (typeof bandFor === 'function') ? bandFor('pfr', d) : null;
    },

    implications: {
      high: 'You raise a lot preflop. That is usually a strength as long as your fold-to-3-bet is reasonable.',
      low: 'You enter pots without raising too often, giving opponents free flops and easier postflop decisions.'
    },
    advice: {
      high: 'Watch you are not over-opening unprofitable hands from early seats.',
      low: 'When you decide to play a hand, raise rather than call. Initiative wins pots that go to the flop.'
    }
  });
})();
