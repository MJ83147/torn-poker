// ── P&L SLICE ─────────────────────────────────────────────────────────────────
//
// Hand-level P&L classification used by Winning Hands and similar stories that
// label each hand (or hand combo) by what kind of leak or strength it is. The
// cell-level P&L gate (leak / monitor / play-problem / silent across a pillar)
// lives in story-engine.js as Sections.classifyPnlGate.
//
// classifyHand returns one of:
//   'play-problem'      inside the target range, P&L negative.
//                       Selection is correct, execution is leaking.
//   'selection-problem' outside the target range, P&L negative.
//                       The hand should not be in the player's range.
//   'monitor'           outside the target range, P&L positive.
//                       Working for now but watch as sample grows.
//   'on-target'         inside the target range, P&L non-negative.
//                       Nothing to flag.
//   'skip'              sample below the minimum cell size or band missing.

(function() {
  // Inputs:
  //   insideRange   boolean | null     null when no recommendation available
  //   pnl           number              negative = loss, positive = profit
  //   sample        integer             count of hands (or played count)
  //   opts          { minSample }       defaults to MIN_CELL=10
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

  // Convenience: total played count and total P&L across a list of hand combos
  // from a rangeMap. Filters by an optional predicate.
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
