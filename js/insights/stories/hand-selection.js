// ── STORY: Hand selection ─────────────────────────────────────────────────────
// Reads VPIP: how widely the player enters pots. Cells: per position and per
// seat count. Lives in the Range panel.

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
        target = matrixTarget('vpip', pos, seats, (typeof getUserStyle === 'function') ? getUserStyle() : 'TAG');
      }
      cells.push({
        scope: 'position',
        key: pos,
        value: pct(pd.vpip, pd.n),
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
        target = matrixTarget('vpip', defaultPos, seats, (typeof getUserStyle === 'function') ? getUserStyle() : 'TAG');
      }
      cells.push({
        scope: 'seats',
        key: sb,
        value: pct(sd.vpip, sd.n),
        n: sd.n,
        target: target,
        winRate: sd.core ? sd.core.wr : null
      });
    }
    return cells;
  }

  Insights.defineStory({
    id: 'hand-selection',
    name: 'VPIP',
    panel: 'Range',
    category: 'preflop-selection',
    minSample: 30,
    strengthSide: null,

    measure: function(d) {
      if (!d || !d.n || d.n < 30) return null;
      return {
        value: pct(d.vpip, d.n),
        n: d.n,
        cells: buildPositionCells(d).concat(buildSeatCells(d))
      };
    },

    band: function(d) {
      return (typeof bandFor === 'function') ? bandFor('vpip', d) : null;
    },

    implications: {
      high: 'You play too many hands. Wider ranges out of position cost you when you miss the flop, which is most of the time.',
      low: 'You fold too many hands preflop. You miss profitable spots from late position and the blinds where wider ranges are correct.'
    },
    advice: {
      high: 'Tighten the seats that are pulling the average up. UTG and MP should be your tightest opens.',
      low: 'Open more from the cutoff and button when the action folds to you. Stealing blinds adds up.'
    }
  });
})();
