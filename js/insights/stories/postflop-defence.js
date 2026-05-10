// ── STORY: Postflop defence ───────────────────────────────────────────────────
// Reads fold-to-raise: how often the player folds when faced with postflop
// pressure. Cells: per position. Lives in the Betting panel.

(function() {
  function buildPositionCells(d) {
    var cells = [];
    if (!d || !d.byPosition) return cells;
    for (var pos in d.byPosition) {
      var pd = d.byPosition[pos];
      if (!pd || pd.gated) continue;
      if (!pd.facedRaise || pd.facedRaise < 8) continue;
      var seats = (typeof dominantSeats === 'function') ? dominantSeats(d) : null;
      var target = null;
      if (typeof matrixTarget === 'function' && seats) {
        target = matrixTarget('foldToRaise', pos, seats, (typeof getUserStyle === 'function') ? getUserStyle() : 'TAG');
      }
      cells.push({
        scope: 'position',
        key: pos,
        value: pct(pd.foldedToRaise, pd.facedRaise),
        n: pd.facedRaise,
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
      if (!sd.facedRaise || sd.facedRaise < 8) continue;
      var seats = parseInt(sb, 10);
      var defaultPos = seats === 2 ? 'BTN' : seats === 3 ? 'BTN' : 'CO';
      var target = null;
      if (typeof matrixTarget === 'function') {
        target = matrixTarget('foldToRaise', defaultPos, seats, (typeof getUserStyle === 'function') ? getUserStyle() : 'TAG');
      }
      cells.push({
        scope: 'seats',
        key: sb,
        value: pct(sd.foldedToRaise, sd.facedRaise),
        n: sd.facedRaise,
        target: target,
        winRate: sd.core ? sd.core.wr : null
      });
    }
    return cells;
  }

  Insights.defineStory({
    id: 'postflop-defence',
    name: 'Fold to Raise',
    panel: 'Betting',
    category: 'postflop-defence',
    minSample: 30,
    strengthSide: 'low',

    measure: function(d) {
      if (!d || !d.facedRaise || d.facedRaise < 12) return null;
      return {
        value: pct(d.foldedToRaise, d.facedRaise),
        n: d.facedRaise,
        cells: buildPositionCells(d).concat(buildSeatCells(d))
      };
    },

    band: function(d) {
      return (typeof bandFor === 'function') ? bandFor('foldToRaise', d) : null;
    },

    implications: {
      high: 'You fold too often when raised. Opponents can attack you with any two cards because your defending range is thin.',
      low: 'You call too many raises without strong hands. Some raises are pure value and need to go.'
    },
    advice: {
      high: 'Find more spots to call or 3-bet. Suited connectors and broadway hands defend well against light raises.',
      low: 'When facing a raise, ask whether your hand actually beats their value range. If not, fold.'
    }
  });
})();
