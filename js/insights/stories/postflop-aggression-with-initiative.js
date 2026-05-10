// ── STORY: Postflop aggression with initiative ────────────────────────────────
// Reads c-bet flop: how often you bet the flop after raising preflop. Cells:
// per position and per seat count. Lives in the Betting panel.
//
// This first version reads only c-bet flop. Later waves will add c-bet turn,
// c-bet river, double-barrel, triple-barrel, and sizing-by-texture cells.

(function() {
  function buildPositionCells(d) {
    var cells = [];
    if (!d || !d.byPosition) return cells;
    for (var pos in d.byPosition) {
      var pd = d.byPosition[pos];
      if (!pd || pd.gated) continue;
      if (!pd.cbetOpps || pd.cbetOpps < 6) continue;
      var seats = (typeof dominantSeats === 'function') ? dominantSeats(d) : null;
      var target = null;
      if (typeof matrixTarget === 'function' && seats) {
        target = matrixTarget('cbet', pos, seats, (typeof getUserStyle === 'function') ? getUserStyle() : 'TAG');
      }
      cells.push({
        scope: 'position',
        key: pos,
        value: pct(pd.cbetDone, pd.cbetOpps),
        n: pd.cbetOpps,
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
      if (!sd.cbetOpps || sd.cbetOpps < 6) continue;
      var seats = parseInt(sb, 10);
      var defaultPos = seats === 2 ? 'BTN' : seats === 3 ? 'BTN' : 'CO';
      var target = null;
      if (typeof matrixTarget === 'function') {
        target = matrixTarget('cbet', defaultPos, seats, (typeof getUserStyle === 'function') ? getUserStyle() : 'TAG');
      }
      cells.push({
        scope: 'seats',
        key: sb,
        value: pct(sd.cbetDone, sd.cbetOpps),
        n: sd.cbetOpps,
        target: target,
        winRate: sd.core ? sd.core.wr : null
      });
    }
    return cells;
  }

  Insights.defineStory({
    id: 'postflop-aggression-with-initiative',
    name: 'C-Bet',
    panel: 'Betting',
    category: 'postflop-aggression-with-initiative',
    minSample: 12,
    strengthSide: 'high',

    measure: function(d) {
      if (!d || !d.cbetOpps || d.cbetOpps < 12) return null;
      return {
        value: pct(d.cbetDone, d.cbetOpps),
        n: d.cbetOpps,
        cells: buildPositionCells(d).concat(buildSeatCells(d))
      };
    },

    band: function(d) {
      return (typeof bandFor === 'function') ? bandFor('cbet', d) : null;
    },

    implications: {
      high: 'You c-bet most flops. As long as you are not c-betting boards that miss your range, this is fine.',
      low: 'You are not following up on your preflop raises. Opponents see your c-bet rate is low and can call wide knowing you give up often.'
    },
    advice: {
      high: 'Pick small sizings on wet boards and be willing to give up rather than barrelling into clear range disadvantages.',
      low: 'C-bet at least half the time after raising preflop, especially on dry boards where you have range advantage.'
    }
  });
})();
