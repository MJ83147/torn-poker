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
// Heads-up vs unknown opponent: omit villainHoles (or pass null/[]).
// Multiway with known holes (e.g. all-in showdown): pass villainHoles as an
// array of two-card hands. Tie share splits equity across all tied players.
function simulateStreet(heroHole, knownBoard, iterations, villainHoles) {
  var hasKnownVillains = villainHoles && villainHoles.length > 0;
  var dead = {};
  for (var i = 0; i < heroHole.length; i++) dead[heroHole[i]] = true;
  for (var j = 0; j < knownBoard.length; j++) dead[knownBoard[j]] = true;
  if (hasKnownVillains) {
    for (var v = 0; v < villainHoles.length; v++) {
      for (var vc = 0; vc < villainHoles[v].length; vc++) dead[villainHoles[v][vc]] = true;
    }
  }

  var remaining = buildDeck().filter(function (c) { return !dead[c]; });
  var boardNeed = 5 - knownBoard.length;
  var wins = 0, ties = 0, total = 0;

  // Hero's share of the pot for one settled board (1.0 win, 0.0 loss, fractional tie).
  function shareVsKnown(fullBoard) {
    var heroScore = bestHand(heroHole.concat(fullBoard));
    var tiedCount = 0;
    for (var k = 0; k < villainHoles.length; k++) {
      var oppScore = bestHand(villainHoles[k].concat(fullBoard));
      if (oppScore > heroScore) return 0;
      if (oppScore === heroScore) tiedCount++;
    }
    if (tiedCount === 0) return 1;
    return 1 / (tiedCount + 1);
  }

  if (hasKnownVillains) {
    if (knownBoard.length === 5) {
      var share = shareVsKnown(knownBoard);
      return { equity: share, iterations: 1, exact: true };
    }
    if (knownBoard.length === 4) {
      for (var c = 0; c < remaining.length; c++) {
        var board1 = knownBoard.concat([remaining[c]]);
        var s1 = shareVsKnown(board1);
        if (s1 === 1) wins++;
        else if (s1 > 0) ties += s1;
        total++;
      }
      return { equity: (wins + ties) / total, iterations: total, exact: true };
    }
    for (var nMc = 0; nMc < iterations; nMc++) {
      var deckMc = remaining.slice();
      var drawnMc = shuffleDraw(deckMc, boardNeed);
      var fullBoardMc = knownBoard.concat(drawnMc);
      var sMc = shareVsKnown(fullBoardMc);
      if (sMc === 1) wins++;
      else if (sMc > 0) ties += sMc;
      total++;
    }
    return { equity: (wins + ties) / total, iterations: total, exact: false };
  }

  // Heads-up against one random unknown opponent.
  if (knownBoard.length === 5) {
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

