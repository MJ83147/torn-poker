// Loads after analysis.js (getInvested) and hand-parsing.js (parseActions).

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

function heroLost(h) {
  if (!h || !h.outcome) return false;
  if (h.outcome.result === 'won') return false;
  return getInvested(h) > 0;
}

function heroWon(h) {
  if (!h || !h.outcome || h.outcome.result !== 'won') return false;
  return (h.outcome.amount || 0) - getInvested(h) > 0;
}

// Capped example-hand pool, most-recent first.
function pickHands(hands, predicate, cap) {
  var out = [];
  if (!hands) return out;
  for (var i = hands.length - 1; i >= 0 && out.length < cap; i--) {
    var h = hands[i];
    if (predicate(h)) out.push(h);
  }
  return out;
}
