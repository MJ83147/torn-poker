// ── SHARED HAND PREDICATES ───────────────────────────────────────────────────
// Predicates and small selectors that used to be re-defined inside every
// insight section IIFE. Each section now closes over the global versions.
// Pure: no DOM, no state. Loads after analysis.js (getInvested) and
// hand-parsing.js (parseActions).

// Hero called, bet, or raised at any point in the hand.
function heroPlayed(h) {
  if (!h || !h.actions) return false;
  var acts = parseActions(h.actions);
  for (var i = 0; i < acts.length; i++) {
    var a = acts[i];
    if (!a.isMe) continue;
    if (a.type === 'call' || a.type === 'bet' || a.type === 'raise') return true;
  }
  return false;
}

// Hero's first preflop action was fold.
function heroFoldedPreflop(h) {
  if (!h || !h.actions) return false;
  var acts = parseActions(h.actions);
  for (var i = 0; i < acts.length; i++) {
    var a = acts[i];
    if (!a.isMe || a.street !== 'Preflop') continue;
    if (a.type === 'sb' || a.type === 'bb') continue;
    return a.type === 'fold';
  }
  return false;
}

// Hand where hero invested chips and did not win.
function heroLost(h) {
  if (!h || !h.outcome) return false;
  if (h.outcome.result === 'won') return false;
  return getInvested(h) > 0;
}

// Hand where hero won net of investment.
function heroWon(h) {
  if (!h || !h.outcome || h.outcome.result !== 'won') return false;
  return (h.outcome.amount || 0) - getInvested(h) > 0;
}

// Capped example-hand pool with most-recent first. predicate(hand) -> bool.
function pickHands(hands, predicate, cap) {
  var out = [];
  if (!hands) return out;
  for (var i = hands.length - 1; i >= 0 && out.length < cap; i--) {
    var h = hands[i];
    if (predicate(h)) out.push(h);
  }
  return out;
}
