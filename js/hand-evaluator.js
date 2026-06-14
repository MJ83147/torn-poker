var HAND_RANK_BASE = 1e10;

function buildDeck() {
  var deck = [];
  for (var r = 0; r < RANKS.length; r++) {
    for (var s = 0; s < SUITS.length; s++) {
      deck.push(RANKS[r] + SUITS[s]);
    }
  }
  return deck;
}

function rankIndex(card) {
  var r = card.slice(0, -1);
  return RANKS.indexOf(r);
}

function suitOf(card) {
  return card.slice(-1);
}

function evaluate5(cards) {
  var ranks = [];
  var suits = [];
  for (var i = 0; i < 5; i++) {
    ranks.push(rankIndex(cards[i]));
    suits.push(suitOf(cards[i]));
  }
  ranks.sort(function (a, b) { return b - a; });

  var isFlush = suits[0] === suits[1] && suits[1] === suits[2] && suits[2] === suits[3] && suits[3] === suits[4];

  var isStraight = false;
  var straightHigh = 0;
  if (ranks[0] - ranks[4] === 4 &&
    ranks[0] !== ranks[1] && ranks[1] !== ranks[2] && ranks[2] !== ranks[3] && ranks[3] !== ranks[4]) {
    isStraight = true;
    straightHigh = ranks[0];
  }
  // Ace-low straight: A-2-3-4-5 -> ranks sorted desc = [12,3,2,1,0]
  if (!isStraight && ranks[0] === 12 && ranks[1] === 3 && ranks[2] === 2 && ranks[3] === 1 && ranks[4] === 0) {
    isStraight = true;
    straightHigh = 3;
  }

  var freq = {};
  for (var j = 0; j < 5; j++) {
    freq[ranks[j]] = (freq[ranks[j]] || 0) + 1;
  }
  var groups = [];
  for (var rk in freq) {
    groups.push({ rank: Number(rk), count: freq[rk] });
  }
  groups.sort(function (a, b) { return b.count - a.count || b.rank - a.rank; });

  var M = HAND_RANK_BASE;

  if (isFlush && isStraight) {
    return 8 * M + straightHigh;
  }
  if (groups[0].count === 4) {
    return 7 * M + groups[0].rank * 100 + groups[1].rank;
  }
  if (groups[0].count === 3 && groups[1].count === 2) {
    return 6 * M + groups[0].rank * 100 + groups[1].rank;
  }
  if (isFlush) {
    return 5 * M + ranks[0] * 28561 + ranks[1] * 2197 + ranks[2] * 169 + ranks[3] * 13 + ranks[4];
  }
  if (isStraight) {
    return 4 * M + straightHigh;
  }
  if (groups[0].count === 3) {
    var kickers3 = [];
    for (var k = 1; k < groups.length; k++) kickers3.push(groups[k].rank);
    kickers3.sort(function (a, b) { return b - a; });
    return 3 * M + groups[0].rank * 10000 + kickers3[0] * 100 + kickers3[1];
  }
  if (groups[0].count === 2 && groups[1].count === 2) {
    var hiPair = Math.max(groups[0].rank, groups[1].rank);
    var loPair = Math.min(groups[0].rank, groups[1].rank);
    return 2 * M + hiPair * 10000 + loPair * 100 + groups[2].rank;
  }
  if (groups[0].count === 2) {
    var kickers1 = [];
    for (var p = 1; p < groups.length; p++) kickers1.push(groups[p].rank);
    kickers1.sort(function (a, b) { return b - a; });
    return 1 * M + groups[0].rank * 1000000 + kickers1[0] * 10000 + kickers1[1] * 100 + kickers1[2];
  }
  return ranks[0] * 28561 + ranks[1] * 2197 + ranks[2] * 169 + ranks[3] * 13 + ranks[4];
}

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

function classifyMadeHand(holeCards, boardCards) {
  if (!holeCards || holeCards.length < 2 || !boardCards || boardCards.length < 3) return null;
  var hero = holeCards.map(normCard);
  var board = boardCards.map(normCard);
  var all = hero.concat(board);
  var score = bestHand(all);
  var M = HAND_RANK_BASE;
  var tier = Math.floor(score / M);

  var labels = ['High Card', 'Pair', 'Two Pair', 'Three of a Kind', 'Straight',
    'Flush', 'Full House', 'Four of a Kind', 'Straight Flush'];
  var label = labels[tier] || 'High Card';

  var heroRanks = hero.map(function (c) { return RANKS.indexOf(c.slice(0, -1)); });
  var boardRanks = board.map(function (c) { return RANKS.indexOf(c.slice(0, -1)); });
  var boardRankCounts = {};
  for (var bi = 0; bi < boardRanks.length; bi++) {
    boardRankCounts[boardRanks[bi]] = (boardRankCounts[boardRanks[bi]] || 0) + 1;
  }

  var _rankNames = {
    '2': 'Deuce', '3': 'Three', '4': 'Four', '5': 'Five', '6': 'Six', '7': 'Seven',
    '8': 'Eight', '9': 'Nine', 'T': 'Ten', 'J': 'Jack', 'Q': 'Queen', 'K': 'King', 'A': 'Ace'
  };
  var heroHighRank = Math.max(heroRanks[0], heroRanks[1]);
  var heroHighName = _rankNames[RANKS[heroHighRank]] || RANKS[heroHighRank];

  if (tier === 0) {
    label = heroHighName + ' High';
  } else if (tier === 1) {
    var boardSorted = boardRanks.slice().sort(function (a, b) { return b - a; });
    if (heroRanks[0] === heroRanks[1]) {
      if (heroRanks[0] > boardSorted[0]) label = 'Overpair';
      else label = 'Pocket Pair';
    } else {
      var pairedRank = -1;
      for (var hi = 0; hi < heroRanks.length; hi++) {
        if (boardRanks.indexOf(heroRanks[hi]) !== -1) { pairedRank = heroRanks[hi]; break; }
      }
      if (pairedRank === -1) {
        label = heroHighName + ' High';
      } else if (pairedRank === boardSorted[0]) label = 'Top Pair';
      else if (pairedRank === boardSorted[boardSorted.length - 1]) label = 'Bottom Pair';
      else label = 'Middle Pair';
    }
  } else if (tier === 2) {
    var heroPairsBoard = false;
    for (var tpi = 0; tpi < heroRanks.length; tpi++) {
      if (boardRanks.indexOf(heroRanks[tpi]) !== -1) { heroPairsBoard = true; break; }
    }
    var boardPairCount = 0;
    for (var bpc in boardRankCounts) {
      if (boardRankCounts[bpc] >= 2) boardPairCount++;
    }
    if (!heroPairsBoard && boardPairCount >= 2) {
      label = heroHighName + ' High (board two pair)';
    } else if (!heroPairsBoard && boardPairCount === 1) {
      label = heroHighName + ' High (board pair)';
    } else {
      label = 'Two Pair';
    }
  } else if (tier === 3) {
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

  var draws = [];
  var allRanks = all.map(function (c) { return RANKS.indexOf(c.slice(0, -1)); });
  var allSuits = all.map(function (c) { return c.slice(-1); });

  if (tier < 5) {
    var suitCounts = {};
    for (var si = 0; si < allSuits.length; si++) {
      suitCounts[allSuits[si]] = (suitCounts[allSuits[si]] || 0) + 1;
    }
    for (var suit in suitCounts) {
      if (suitCounts[suit] === 4) {
        var heroHasSuit = hero.some(function (c) { return c.slice(-1) === suit; });
        if (heroHasSuit) draws.push('Flush draw (9 outs)');
      }
    }
  }

  if (tier < 4) {
    var uniqueRanks = [];
    for (var ui = 0; ui < allRanks.length; ui++) {
      if (uniqueRanks.indexOf(allRanks[ui]) === -1) uniqueRanks.push(allRanks[ui]);
    }
    uniqueRanks.sort(function (a, b) { return a - b; });
    if (uniqueRanks.indexOf(12) !== -1) uniqueRanks.unshift(-1);

    var bestStraightDraw = 0;
    for (var sw = 0; sw <= 12; sw++) {
      var inWindow = 0;
      var windowRanks = [];
      for (var swi = 0; swi < uniqueRanks.length; swi++) {
        var r = uniqueRanks[swi] === -1 ? -1 : uniqueRanks[swi];
        if (r >= sw - 1 && r <= sw + 3) { inWindow++; windowRanks.push(r); }
      }
      if (inWindow === 4) {
        var span = windowRanks[windowRanks.length - 1] - windowRanks[0];
        if (span === 3) bestStraightDraw = Math.max(bestStraightDraw, 8);
        else bestStraightDraw = Math.max(bestStraightDraw, 4);
      }
    }
    if (bestStraightDraw === 8) draws.push('OESD (8 outs)');
    else if (bestStraightDraw === 4) draws.push('Gutshot (4 outs)');
  }

  return { tier: tier, label: label, draws: draws };
}
