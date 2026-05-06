// ── EQUITY MONTE CARLO ──────────────────────────────────────────────────────
// Fisher-Yates partial shuffle and the per-street equity simulation. Calls
// buildDeck() and bestHand() from js/hand-evaluator.js.

function shuffleDraw(deck, n) {
  for (var i = deck.length - 1; i > 0 && i >= deck.length - n; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = deck[i]; deck[i] = deck[j]; deck[j] = tmp;
  }
  return deck.slice(deck.length - n);
}

// ── Monte Carlo simulation ────────────────────────────────────────────────
function simulateStreet(heroHole, knownBoard, iterations) {
  var dead = {};
  for (var i = 0; i < heroHole.length; i++) dead[heroHole[i]] = true;
  for (var j = 0; j < knownBoard.length; j++) dead[knownBoard[j]] = true;

  var remaining = buildDeck().filter(function (c) { return !dead[c]; });
  var boardNeed = 5 - knownBoard.length;
  var wins = 0, ties = 0, total = 0;

  if (knownBoard.length === 5) {
    // River: exact enumeration
    for (var a = 0; a < remaining.length; a++) {
      for (var b = a + 1; b < remaining.length; b++) {
        var oppHole = [remaining[a], remaining[b]];
        var heroScore = bestHand(heroHole.concat(knownBoard));
        var oppScore = bestHand(oppHole.concat(knownBoard));
        if (heroScore > oppScore) wins++;
        else if (heroScore === oppScore) ties++;
        total++;
      }
    }
  } else {
    // Monte Carlo
    for (var n = 0; n < iterations; n++) {
      var deck = remaining.slice();
      var needCards = 2 + boardNeed;
      var drawn = shuffleDraw(deck, needCards);
      var oppH = [drawn[0], drawn[1]];
      var fullBoard = knownBoard.concat(drawn.slice(2));
      var hScore = bestHand(heroHole.concat(fullBoard));
      var oScore = bestHand(oppH.concat(fullBoard));
      if (hScore > oScore) wins++;
      else if (hScore === oScore) ties++;
      total++;
    }
  }

  return {
    equity: (wins + ties * 0.5) / total,
    iterations: total,
    exact: knownBoard.length === 5
  };
}

