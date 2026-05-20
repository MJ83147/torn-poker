(function() {
  function classifyHand(params) {
    if (!params) return 'skip';
    var inside = params.insideRange;
    var pnl = params.pnl;
    var n = params.sample;
    var min = (params.opts && params.opts.minSample != null)
      ? params.opts.minSample
      : (typeof MIN_CELL === 'number' ? MIN_CELL : 10);

    if (inside == null) return 'skip';
    if (n == null || n < min) return 'skip';
    if (pnl == null || !isFinite(pnl)) return 'skip';

    var losing = pnl < 0;
    if (inside && losing) return 'play-problem';
    if (!inside && losing) return 'selection-problem';
    if (!inside && !losing) return 'monitor';
    return 'on-target';
  }

  function rollUp(rangeMap, predicate) {
    var totalPlayed = 0, totalPnl = 0, hands = [];
    if (!rangeMap) return { played: 0, pnl: 0, hands: hands };
    for (var k in rangeMap) {
      var rm = rangeMap[k];
      if (!rm || !rm.played) continue;
      if (predicate && !predicate(k, rm)) continue;
      totalPlayed += rm.played;
      totalPnl += rm.pnl || 0;
      hands.push({ key: k, played: rm.played, won: rm.won || 0, pnl: rm.pnl || 0, dealt: rm.dealt || 0 });
    }
    return { played: totalPlayed, pnl: totalPnl, hands: hands };
  }

  window.PnlSlice = {
    classifyHand: classifyHand,
    rollUp: rollUp
  };
})();
