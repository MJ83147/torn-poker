// Position panel logic. No DOM, no markup — the view is
// js/panels/views/position.js.

function positionModel(d) {
  var order = POSITION_ORDER.filter(function(p) { return d.posMap[p] && d.posMap[p].hands > 0; });
  var ctx = getGameContext(d);

  var rows = order.map(function(p) {
    var s = d.posMap[p];
    var vp = pct(s.vpip, s.hands);
    var band = ctx.band('vpip', p);
    var delta = null, bandLo = null, bandHi = null;
    if (band && vp !== null) {
      bandLo = Math.round(band.tight);
      bandHi = Math.round(band.loose);
      delta = vp < bandLo ? vp - bandLo : (vp > bandHi ? vp - bandHi : 0);
    }
    return {
      pos: p,
      hands: s.hands,
      foldPrePct: pct(s.foldPre, s.hands),
      delta: delta,
      bandLo: bandLo,
      bandHi: bandHi,
      pnl: s.pnl,
      avgPotDisplay: _displayBB && s.potBBCount > 0
        ? fmtBBRaw(s.potBB / s.potBBCount)
        : fmt(Math.round(s.pot / s.hands)),
    };
  });

  return {
    rows: rows,
    chart: {
      labels: order,
      pnl: order.map(function(p) { return d.posMap[p].pnl; }),
      handCounts: order.map(function(p) { return d.posMap[p].hands; }),
    },
  };
}
