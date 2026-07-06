// Shared session core: how raw hands split into sessions and what a session
// is worth. Panel-specific session logic lives in js/panels/sessions.js.

function buildSessions(hands) {
  if (!hands.length) return [];

  var sorted = hands.slice().sort(function(a, b) {
    return (a.timestamp || 0) - (b.timestamp || 0);
  });

  var GAP_LIMIT = 15 * 60 * 1000;       // 15 min gap starts a new session
  var TWO_DAYS  = 2 * 24 * 60 * 60 * 1000;

  var sessions = [];
  var current = { tableId: inferTable(sorted[0]), hands: [sorted[0]], startTs: sorted[0].timestamp || 0 };

  for (var i = 1; i < sorted.length; i++) {
    var tid = inferTable(sorted[i]);
    var ts  = sorted[i].timestamp || 0;
    var prevTs = sorted[i - 1].timestamp || 0;
    var gap = ts - prevTs;
    var span = ts - current.startTs;

    if (tid !== current.tableId || gap > GAP_LIMIT || span > TWO_DAYS) {
      sessions.push(current);
      current = { tableId: tid, hands: [sorted[i]], startTs: ts };
    } else {
      current.hands.push(sorted[i]);
    }
  }
  sessions.push(current);

  return sessions.filter(function(s) {
    return s.hands.length >= 5 && s.hands.some(function(h) { return isCashHand(h); });
  });
}

function sessionPnl(session) {
  var pnl = 0;
  for (var i = 0; i < session.hands.length; i++) {
    var h = session.hands[i];
    if (!isCashHand(h) || !h.outcome) continue;
    pnl += getHandPnlValue(h);
  }
  return pnl;
}

// TODO(discuss): minSession session-splitting logic needs a rewrite. Do not change until reviewed.
// Sessions shorter than minSession are skipped because halving them is noise.
function splitSessionHalves(hands, minSession) {
  var MIN = minSession || 20;
  var sessions = buildSessions(hands);
  var firstHalf = [];
  var secondHalf = [];
  var map = new Map();
  for (var si = 0; si < sessions.length; si++) {
    var sHands = sessions[si].hands;
    if (sHands.length < MIN) continue;
    var mid = Math.floor(sHands.length / 2);
    for (var i = 0; i < sHands.length; i++) {
      if (i < mid) { firstHalf.push(sHands[i]); map.set(sHands[i], 'first'); }
      else         { secondHalf.push(sHands[i]); map.set(sHands[i], 'second'); }
    }
  }
  return { firstHalf: firstHalf, secondHalf: secondHalf, handToHalf: map };
}

/* ===== merged from pnl-slice.js ===== */
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
