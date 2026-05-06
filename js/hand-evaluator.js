// ── HAND EVALUATOR ──────────────────────────────────────────────────────────
// 5-card hand scoring, best-5-from-N picker, and made-hand classifier.
// Used by the equity simulator and any future hand-strength insights.
// Depends on RANKS / SUITS / normCard from js/helpers/cards.js.

function buildDeck() {
  var deck = [];
  for (var r = 0; r < RANKS.length; r++) {
    for (var s = 0; s < SUITS.length; s++) {
      deck.push(RANKS[r] + SUITS[s]);
    }
  }
  return deck;
}

// normCard is now shared from helpers.js

function rankIndex(card) {
  var r = card.slice(0, -1);
  return RANKS.indexOf(r);
}

function suitOf(card) {
  return card.slice(-1);
}

// ── 5-card hand evaluator ─────────────────────────────────────────────────
function evaluate5(cards) {
  var ranks = [];
  var suits = [];
  for (var i = 0; i < 5; i++) {
    ranks.push(rankIndex(cards[i]));
    suits.push(suitOf(cards[i]));
  }
  ranks.sort(function (a, b) { return b - a; }); // descending

  var isFlush = suits[0] === suits[1] && suits[1] === suits[2] && suits[2] === suits[3] && suits[3] === suits[4];

  // Check straight
  var isStraight = false;
  var straightHigh = 0;
  if (ranks[0] - ranks[4] === 4 &&
    ranks[0] !== ranks[1] && ranks[1] !== ranks[2] && ranks[2] !== ranks[3] && ranks[3] !== ranks[4]) {
    isStraight = true;
    straightHigh = ranks[0];
  }
  // Ace-low straight: A-2-3-4-5 → ranks sorted desc = [12,3,2,1,0]
  if (!isStraight && ranks[0] === 12 && ranks[1] === 3 && ranks[2] === 2 && ranks[3] === 1 && ranks[4] === 0) {
    isStraight = true;
    straightHigh = 3; // 5-high straight
  }

  // Count rank frequencies
  var freq = {};
  for (var j = 0; j < 5; j++) {
    freq[ranks[j]] = (freq[ranks[j]] || 0) + 1;
  }
  var groups = [];
  for (var rk in freq) {
    groups.push({ rank: Number(rk), count: freq[rk] });
  }
  // Sort by count desc, then rank desc
  groups.sort(function (a, b) { return b.count - a.count || b.rank - a.rank; });

  var M = 1e10;

  // Straight flush
  if (isFlush && isStraight) {
    return 8 * M + straightHigh;
  }
  // Four of a kind
  if (groups[0].count === 4) {
    return 7 * M + groups[0].rank * 100 + groups[1].rank;
  }
  // Full house
  if (groups[0].count === 3 && groups[1].count === 2) {
    return 6 * M + groups[0].rank * 100 + groups[1].rank;
  }
  // Flush
  if (isFlush) {
    return 5 * M + ranks[0] * 28561 + ranks[1] * 2197 + ranks[2] * 169 + ranks[3] * 13 + ranks[4];
  }
  // Straight
  if (isStraight) {
    return 4 * M + straightHigh;
  }
  // Three of a kind
  if (groups[0].count === 3) {
    var kickers3 = [];
    for (var k = 1; k < groups.length; k++) kickers3.push(groups[k].rank);
    kickers3.sort(function (a, b) { return b - a; });
    return 3 * M + groups[0].rank * 10000 + kickers3[0] * 100 + kickers3[1];
  }
  // Two pair
  if (groups[0].count === 2 && groups[1].count === 2) {
    var hiPair = Math.max(groups[0].rank, groups[1].rank);
    var loPair = Math.min(groups[0].rank, groups[1].rank);
    return 2 * M + hiPair * 10000 + loPair * 100 + groups[2].rank;
  }
  // One pair
  if (groups[0].count === 2) {
    var kickers1 = [];
    for (var p = 1; p < groups.length; p++) kickers1.push(groups[p].rank);
    kickers1.sort(function (a, b) { return b - a; });
    return 1 * M + groups[0].rank * 1000000 + kickers1[0] * 10000 + kickers1[1] * 100 + kickers1[2];
  }
  // High card
  return ranks[0] * 28561 + ranks[1] * 2197 + ranks[2] * 169 + ranks[3] * 13 + ranks[4];
}

// ── Best 5 from N cards (N >= 5) ──────────────────────────────────────────
function combinations(arr, k) {
  var result = [];
  function combo(start, chosen) {
    if (chosen.length === k) { result.push(chosen.slice()); return; }
    for (var i = start; i <= arr.length - (k - chosen.length); i++) {
      chosen.push(arr[i]);
      combo(i + 1, chosen);
      chosen.pop();
    }
  }
  combo(0, []);
  return result;
}

function bestHand(cards) {
  if (cards.length < 5) return 0;
  if (cards.length === 5) return evaluate5(cards);
  var combos = combinations(cards, 5);
  var best = 0;
  for (var i = 0; i < combos.length; i++) {
    var score = evaluate5(combos[i]);
    if (score > best) best = score;
  }
  return best;
}

// ── Made Hand + Draw Classification ──────────────────────────────────────
function classifyMadeHand(holeCards, boardCards) {
  if (!holeCards || holeCards.length < 2 || !boardCards || boardCards.length < 3) return null;
  var hero = holeCards.map(normCard);
  var board = boardCards.map(normCard);
  var all = hero.concat(board);
  var score = bestHand(all);
  var M = 1e10;
  var tier = Math.floor(score / M);

  var labels = ['High Card', 'Pair', 'Two Pair', 'Three of a Kind', 'Straight',
    'Flush', 'Full House', 'Four of a Kind', 'Straight Flush'];
  var label = labels[tier] || 'High Card';

  // Refine pair/trips/quads labels using hole card context
  var heroRanks = hero.map(function (c) { return RANKS.indexOf(c.slice(0, -1)); });
  var boardRanks = board.map(function (c) { return RANKS.indexOf(c.slice(0, -1)); });
  var boardRankCounts = {};
  for (var bi = 0; bi < boardRanks.length; bi++) {
    boardRankCounts[boardRanks[bi]] = (boardRankCounts[boardRanks[bi]] || 0) + 1;
  }

  // Helper: readable rank name for labels
  var _rankNames = {
    '2': 'Deuce', '3': 'Three', '4': 'Four', '5': 'Five', '6': 'Six', '7': 'Seven',
    '8': 'Eight', '9': 'Nine', 'T': 'Ten', 'J': 'Jack', 'Q': 'Queen', 'K': 'King', 'A': 'Ace'
  };
  var heroHighRank = Math.max(heroRanks[0], heroRanks[1]);
  var heroHighName = _rankNames[RANKS[heroHighRank]] || RANKS[heroHighRank];

  if (tier === 0) {
    label = heroHighName + ' High';
  } else if (tier === 1) {
    // Pair - check if hero actually pairs with the board, or if it's just a board pair
    var boardSorted = boardRanks.slice().sort(function (a, b) { return b - a; });
    if (heroRanks[0] === heroRanks[1]) {
      if (heroRanks[0] > boardSorted[0]) label = 'Overpair';
      else label = 'Pocket Pair';
    } else {
      // Check if either hole card pairs with a board card
      var pairedRank = -1;
      for (var hi = 0; hi < heroRanks.length; hi++) {
        if (boardRanks.indexOf(heroRanks[hi]) !== -1) { pairedRank = heroRanks[hi]; break; }
      }
      if (pairedRank === -1) {
        // Hero doesn't pair the board - board has its own pair, hero just has high cards
        label = heroHighName + ' High';
      } else if (pairedRank === boardSorted[0]) label = 'Top Pair';
      else if (pairedRank === boardSorted[boardSorted.length - 1]) label = 'Bottom Pair';
      else label = 'Middle Pair';
    }
  } else if (tier === 2) {
    // Two Pair - check if hero contributes to either pair or both are board pairs
    var heroPairsBoard = false;
    for (var tpi = 0; tpi < heroRanks.length; tpi++) {
      if (boardRanks.indexOf(heroRanks[tpi]) !== -1) { heroPairsBoard = true; break; }
    }
    // Check if board itself has two pairs (e.g. 6-3-6-3)
    var boardPairCount = 0;
    for (var bpc in boardRankCounts) {
      if (boardRankCounts[bpc] >= 2) boardPairCount++;
    }
    if (!heroPairsBoard && boardPairCount >= 2) {
      // Both pairs are on the board - hero just has kickers
      label = heroHighName + ' High (board two pair)';
    } else if (!heroPairsBoard && boardPairCount === 1) {
      // One board pair + hero doesn't pair = hero effectively has high cards
      label = heroHighName + ' High (board pair)';
    } else {
      label = 'Two Pair';
    }
  } else if (tier === 3) {
    // Three of a kind - set (pocket pair hit board) vs trips (board pair + one hole card)
    if (heroRanks[0] === heroRanks[1] && boardRanks.indexOf(heroRanks[0]) !== -1) {
      label = 'Set';
    } else {
      label = 'Trips';
    }
  } else if (tier === 6) {
    label = 'Full House';
  } else if (tier === 7) {
    label = 'Quads';
  } else if (tier === 8) {
    label = 'Straight Flush';
  }

  // Draw detection
  var draws = [];
  var allRanks = all.map(function (c) { return RANKS.indexOf(c.slice(0, -1)); });
  var allSuits = all.map(function (c) { return c.slice(-1); });

  // Flush draw: 4 of one suit (only if not already a flush)
  if (tier < 5) {
    var suitCounts = {};
    for (var si = 0; si < allSuits.length; si++) {
      suitCounts[allSuits[si]] = (suitCounts[allSuits[si]] || 0) + 1;
    }
    for (var suit in suitCounts) {
      if (suitCounts[suit] === 4) {
        // Verify at least one hole card contributes
        var heroHasSuit = hero.some(function (c) { return c.slice(-1) === suit; });
        if (heroHasSuit) draws.push('Flush draw (9 outs)');
      }
    }
  }

  // Straight draws: OESD and gutshot (only if not already a straight+)
  if (tier < 4) {
    var uniqueRanks = [];
    for (var ui = 0; ui < allRanks.length; ui++) {
      if (uniqueRanks.indexOf(allRanks[ui]) === -1) uniqueRanks.push(allRanks[ui]);
    }
    uniqueRanks.sort(function (a, b) { return a - b; });
    // Also consider ace-low (A as 0-ish) by adding -1 if ace present
    if (uniqueRanks.indexOf(12) !== -1) uniqueRanks.unshift(-1);

    var bestStraightDraw = 0; // 0=none, 4=gutshot, 8=oesd
    for (var sw = 0; sw <= 12; sw++) {
      var inWindow = 0;
      var windowRanks = [];
      for (var swi = 0; swi < uniqueRanks.length; swi++) {
        var r = uniqueRanks[swi] === -1 ? -1 : uniqueRanks[swi];
        if (r >= sw - 1 && r <= sw + 3) { inWindow++; windowRanks.push(r); }
      }
      if (inWindow === 4) {
        // Check if it's open-ended (both ends open) or gutshot (gap in middle)
        var span = windowRanks[windowRanks.length - 1] - windowRanks[0];
        if (span === 3) bestStraightDraw = Math.max(bestStraightDraw, 8); // OESD
        else bestStraightDraw = Math.max(bestStraightDraw, 4); // Gutshot
      }
    }
    if (bestStraightDraw === 8) draws.push('OESD (8 outs)');
    else if (bestStraightDraw === 4) draws.push('Gutshot (4 outs)');
  }

  return { tier: tier, label: label, draws: draws };
}
