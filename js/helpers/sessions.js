// ── SESSIONS ──────────────────────────────────────────────────────────────────
//
// Group raw hand records into sessions and split each session at its own
// midpoint. Used by the insight engine to find within-session decline
// (patterns.js session-half dimension, ruleset.js second-half-decline rule)
// and by the My Game panel.
//
// Restored after commit cddcbab deleted this file thinking it had no callers.
// engine/patterns.js and engine/ruleset.js still reference splitSessionHalves.

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

// Split each session at its own midpoint, aggregating across sessions.
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
