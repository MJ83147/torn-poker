// ── GAME CONTEXT HELPER ───────────────────────────────────────────────────────
// Single source of truth for the table-mix lookups every panel reimplements:
//   - dominant seat count (2..9)
//   - dominant flop bucket (HU / 3-way / multiway)
//   - matrix band lookup with current style applied
//   - sample-aware threshold scaler
//   - dominant position picker from a candidate list
//
// Use:  var ctx = getGameContext(d);
//       ctx.seats           // 6
//       ctx.flopBucket      // 'HU'
//       ctx.band('vpip','BTN')        // {tight, ideal, loose}
//       ctx.scaleN(8)       // sample-aware threshold (multiplied by sqrt(40/n))
//       ctx.domPos(['UTG','MP'])      // pick the position you actually played most

function getGameContext(d) {
  var seats = (function() {
    if (!d || !d.bySeatBucket) return null;
    var best = null, bestN = 0;
    for (var sb in d.bySeatBucket) {
      var sd = d.bySeatBucket[sb];
      if (!sd || (sd.n || 0) <= bestN) continue;
      bestN = sd.n;
      best = parseInt(sb, 10);
    }
    return best ? Math.max(2, Math.min(9, best)) : null;
  })();

  var flopBucket = (function() {
    if (!d || !d.byFlopBucket) return null;
    var keys = ['HU', '3-way', 'multiway'];
    var best = null, bestN = 0;
    for (var i = 0; i < keys.length; i++) {
      var sd = d.byFlopBucket[keys[i]];
      if (!sd || (sd.n || 0) <= bestN) continue;
      bestN = sd.n;
      best = keys[i];
    }
    return best;
  })();

  // Default position used by My-Game style stat verdicts when no specific seat
  // is given. Mirrors the expression mygame.js used to inline.
  var defaultPos = seats === 2 ? 'BTN' : seats === 3 ? 'BTN' : 'CO';

  function band(metric, position) {
    if (typeof matrixTarget !== 'function' || !seats) return null;
    return matrixTarget(metric, position || defaultPos, seats, getUserStyle());
  }

  function scaleN(base) {
    var n = (d && d.n) || 1;
    return Math.max(base, Math.round(base * Math.max(1, Math.sqrt(40 / Math.max(1, n)))));
  }

  function domPos(candidates) {
    if (!candidates || !candidates.length) return null;
    if (!d || !d.byPosition) return candidates[0];
    var best = null, bestN = 0;
    for (var p in d.byPosition) {
      if (candidates.indexOf(p) === -1) continue;
      var pd = d.byPosition[p];
      if (!pd || (pd.n || 0) <= bestN) continue;
      bestN = pd.n;
      best = p;
    }
    return best || candidates[0];
  }

  return {
    seats: seats,
    flopBucket: flopBucket,
    defaultPos: defaultPos,
    band: band,
    scaleN: scaleN,
    domPos: domPos,
  };
}
