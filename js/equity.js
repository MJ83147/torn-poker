// ── EQUITY (Monte Carlo equity simulation) ───────────────────────────────────

// Build full 52-card deck using shared RANKS and SUITS from helpers.js
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
  ranks.sort(function(a, b) { return b - a; }); // descending

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
  groups.sort(function(a, b) { return b.count - a.count || b.rank - a.rank; });

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
    kickers3.sort(function(a, b) { return b - a; });
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
    kickers1.sort(function(a, b) { return b - a; });
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
  var heroRanks = hero.map(function(c) { return RANKS.indexOf(c.slice(0, -1)); });
  var boardRanks = board.map(function(c) { return RANKS.indexOf(c.slice(0, -1)); });
  var boardRankCounts = {};
  for (var bi = 0; bi < boardRanks.length; bi++) {
    boardRankCounts[boardRanks[bi]] = (boardRankCounts[boardRanks[bi]] || 0) + 1;
  }

  if (tier === 1) {
    // Pair — is it pocket pair (overpair/underpair), top pair, middle pair, bottom pair?
    var boardSorted = boardRanks.slice().sort(function(a, b) { return b - a; });
    if (heroRanks[0] === heroRanks[1]) {
      if (heroRanks[0] > boardSorted[0]) label = 'Overpair';
      else label = 'Pocket Pair';
    } else {
      var pairedRank = -1;
      for (var hi = 0; hi < heroRanks.length; hi++) {
        if (boardRanks.indexOf(heroRanks[hi]) !== -1) { pairedRank = heroRanks[hi]; break; }
      }
      if (pairedRank === boardSorted[0]) label = 'Top Pair';
      else if (pairedRank === boardSorted[boardSorted.length - 1]) label = 'Bottom Pair';
      else label = 'Middle Pair';
    }
  } else if (tier === 2) {
    label = 'Two Pair';
  } else if (tier === 3) {
    // Three of a kind — set (pocket pair hit board) vs trips (board pair + one hole card)
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
  var allRanks = all.map(function(c) { return RANKS.indexOf(c.slice(0, -1)); });
  var allSuits = all.map(function(c) { return c.slice(-1); });

  // Flush draw: 4 of one suit (only if not already a flush)
  if (tier < 5) {
    var suitCounts = {};
    for (var si = 0; si < allSuits.length; si++) {
      suitCounts[allSuits[si]] = (suitCounts[allSuits[si]] || 0) + 1;
    }
    for (var suit in suitCounts) {
      if (suitCounts[suit] === 4) {
        // Verify at least one hole card contributes
        var heroHasSuit = hero.some(function(c) { return c.slice(-1) === suit; });
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
    uniqueRanks.sort(function(a, b) { return a - b; });
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

// ── Fisher-Yates shuffle (partial) ────────────────────────────────────────
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

  var remaining = buildDeck().filter(function(c) { return !dead[c]; });
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

// ── Pot odds and guidance ─────────────────────────────────────────────────
function getHeroStreetActions(hand) {
  var parsed = parseActions(hand.actions);
  var streets = {};
  var potRunning = 0;
  var heroFoldedOn = null;

  var streetOrder = ['Preflop', 'Flop', 'Turn', 'River'];
  var streetActions = { Preflop: [], Flop: [], Turn: [], River: [] };

  for (var i = 0; i < parsed.length; i++) {
    var act = parsed[i];
    if (streetActions[act.street]) {
      streetActions[act.street].push(act);
    }
  }

  for (var si = 0; si < streetOrder.length; si++) {
    var st = streetOrder[si];
    var acts = streetActions[st];
    if (!acts || !acts.length) continue;
    if (heroFoldedOn) break;

    var potBefore = potRunning;
    var heroAction = null;
    var amountToCall = 0;
    var potAtHeroAction = potRunning;

    // Track villain action that prompted hero's response
    var villainAction = null;
    var lastVillainBet = null;

    // Count active players on this street
    var activePlayers = {};
    var foldedPlayers = {};

    var allHeroActions = [];
    for (var ai = 0; ai < acts.length; ai++) {
      var a = acts[ai];
      // Track active players (anyone who acts and doesn't fold)
      if (a.type !== 'won') {
        activePlayers[a.author] = true;
      }
      if (a.type === 'fold') {
        foldedPlayers[a.author] = true;
      }
      // Track the last villain bet/raise before hero acts
      if (!a.isMe && (a.type === 'bet' || a.type === 'raise') && a.amount) {
        lastVillainBet = a;
      }
      if (a.isMe && a.type !== 'won' && a.type !== 'sb' && a.type !== 'bb') {
        allHeroActions.push({ action: a, potAtAction: potRunning, facingAction: lastVillainBet });
      }
      if (a.amount && a.type !== 'won') {
        potRunning += a.amount;
      }
      if (a.isMe && a.type === 'fold') {
        heroFoldedOn = st;
      }
    }

    var numActive = 0;
    for (var ap in activePlayers) {
      if (!foldedPlayers[ap]) numActive++;
    }

    // Pick the most significant action: fold > call/raise/bet > check
    if (allHeroActions.length > 0) {
      var picked = allHeroActions[allHeroActions.length - 1];
      for (var hi = 0; hi < allHeroActions.length; hi++) {
        if (allHeroActions[hi].action.type === 'fold') {
          picked = allHeroActions[hi];
          break;
        }
      }
      heroAction = picked.action;
      potAtHeroAction = picked.potAtAction;
      villainAction = picked.facingAction;
    }

    if (!heroAction) {
      for (var bi = 0; bi < acts.length; bi++) {
        if (acts[bi].isMe && (acts[bi].type === 'sb' || acts[bi].type === 'bb')) {
          heroAction = acts[bi];
          potAtHeroAction = potBefore;
          break;
        }
      }
    }

    if (heroAction) {
      if (heroAction.type === 'call') {
        amountToCall = heroAction.amount;
      } else if (heroAction.type === 'raise' || heroAction.type === 'bet') {
        amountToCall = heroAction.amount;
      } else if (heroAction.type === 'fold') {
        // Find the bet/raise the hero was facing when they folded
        for (var fi = acts.length - 1; fi >= 0; fi--) {
          if (!acts[fi].isMe && (acts[fi].type === 'raise' || acts[fi].type === 'bet') && acts[fi].amount) {
            amountToCall = acts[fi].amount;
            villainAction = acts[fi];
            break;
          }
        }
      }

      var potOdds = amountToCall > 0 ? amountToCall / (potAtHeroAction + amountToCall) : 0;

      // Calculate villain bet as % of pot
      var villainBetPct = null;
      if (villainAction && villainAction.amount && potBefore > 0) {
        villainBetPct = Math.round((villainAction.amount / potBefore) * 100);
      }

      // Count callers before hero on this street
      var callersBefore = 0;
      for (var ci = 0; ci < acts.length; ci++) {
        if (acts[ci].isMe) break;
        if (acts[ci].type === 'call') callersBefore++;
      }

      streets[st] = {
        action: heroAction,
        potBefore: potAtHeroAction,
        amountToCall: amountToCall,
        potOdds: potOdds,
        villainAction: villainAction,
        villainBetPct: villainBetPct,
        playersActive: numActive,
        callersBefore: callersBefore
      };
    }
  }

  return { streets: streets, foldedOn: heroFoldedOn };
}

function generateGuidance(equity, streetInfo, texture, madeHand, villainProfile) {
  var eq = equity * 100;
  var act = streetInfo.action;
  var potOdds = streetInfo.potOdds * 100;
  var pot = streetInfo.potBefore || 0;
  var text = '';
  var quality = 'neutral'; // 'good', 'neutral', 'bad'

  // Bet sizing as % of pot (for bets/raises)
  var betPotPct = (act.amount && pot > 0 && (act.type === 'bet' || act.type === 'raise'))
    ? Math.round((act.amount / pot) * 100) : null;

  // Villain action context
  var vAct = streetInfo.villainAction;
  var vBetPct = streetInfo.villainBetPct;
  var playersActive = streetInfo.playersActive || 0;
  var callersBefore = streetInfo.callersBefore || 0;
  var multiway = playersActive > 2;

  // Villain shorthand
  var vName = villainProfile ? villainProfile.name : null;
  var vFolds = villainProfile && villainProfile.foldToRaise !== null ? villainProfile.foldToRaise : null;
  var vLoose = villainProfile && (villainProfile.type === 'LAP' || villainProfile.type === 'LAG');
  var vAgg = villainProfile && (villainProfile.type === 'LAG' || (villainProfile.agg !== null && villainProfile.agg >= 40));
  var vCalls = villainProfile && villainProfile.wtsd !== null && villainProfile.wtsd >= 55;
  var vPassive = villainProfile && villainProfile.agg !== null && villainProfile.agg < 15;

  // Build villain action description
  var facingDesc = '';
  if (vAct) {
    var vSizeDesc = '';
    if (vBetPct !== null) {
      if (vBetPct <= 33) vSizeDesc = ' (small — ' + vBetPct + '% pot)';
      else if (vBetPct <= 75) vSizeDesc = ' (' + vBetPct + '% pot)';
      else if (vBetPct <= 100) vSizeDesc = ' (large — ' + vBetPct + '% pot)';
      else vSizeDesc = ' (overbet — ' + vBetPct + '% pot)';
    }
    facingDesc = 'Facing ' + vAct.author + '\'s ' + fmtDollar(vAct.amount) + ' ' + vAct.type + vSizeDesc + '. ';
  }

  // Multiway context
  var mwDesc = '';
  if (multiway) {
    mwDesc = playersActive + '-way pot' + (callersBefore > 0 ? ' (' + callersBefore + ' caller' + (callersBefore > 1 ? 's' : '') + ' before you)' : '') + '. ';
  }

  // ── Blinds ──
  if (act.type === 'sb' || act.type === 'bb') {
    if (eq > 55) { text = 'Strong starting hand.'; quality = 'good'; }
    else if (eq >= 40) { text = 'Playable hand from the blinds.'; quality = 'neutral'; }
    else { text = 'Weak hand. Defend selectively.'; quality = 'bad'; }

  // ── Check ──
  } else if (act.type === 'check') {
    if (eq > 65 && vFolds !== null && vFolds >= 60) {
      text = facingDesc + Math.round(eq) + '% equity but you checked. ' + vName + ' folds to raises ' + vFolds + '% — missed value opportunity.';
      quality = 'bad';
    } else if (eq > 65 && vCalls) {
      text = facingDesc + Math.round(eq) + '% equity but you checked. ' + vName + ' calls to showdown ' + villainProfile.wtsd + '% — bet big, they\'ll pay you off.';
      quality = 'bad';
    } else if (eq > 65 && vPassive) {
      text = facingDesc + Math.round(eq) + '% equity but you checked. ' + vName + ' is passive — take the lead and bet for value.';
      quality = 'bad';
    } else if (eq > 65) {
      text = facingDesc + 'Strong hand (' + Math.round(eq) + '% equity) but you checked. Betting for value is usually correct here.';
      quality = 'bad';
    } else if (eq >= 40 && multiway) {
      text = mwDesc + 'Decent equity (' + Math.round(eq) + '%) but checking in a multiway pot is fine — you\'re less likely to get folds from multiple opponents.';
      quality = 'neutral';
    } else if (eq >= 40 && vFolds !== null && vFolds >= 60) {
      text = facingDesc + Math.round(eq) + '% equity. ' + vName + ' folds to raises ' + vFolds + '% — a bet could take this down without showdown.';
      quality = 'neutral';
    } else if (eq >= 40) {
      text = 'Decent hand (' + Math.round(eq) + '% equity). A bet could protect your equity or extract thin value.';
      quality = 'neutral';
    } else {
      text = 'Weak hand. Checking is correct — no value in betting here.';
      quality = 'good';
    }

  // ── Call ──
  } else if (act.type === 'call') {
    // Always include what you were facing
    text = facingDesc;
    if (eq > potOdds + 10 && vFolds !== null && vFolds >= 60) {
      text += 'Your ' + Math.round(eq) + '% equity justified a call, but ' + vName + ' folds to raises ' + vFolds + '% — raising could have won the pot outright.';
      quality = 'neutral';
    } else if (eq > potOdds + 10 && vAgg) {
      text += vName + ' is aggressive — calling down with ' + Math.round(eq) + '% equity is correct. Let them keep bluffing into you.';
      quality = 'good';
    } else if (eq > potOdds + 10 && multiway && callersBefore > 0) {
      text += mwDesc + 'Good call with ' + Math.round(eq) + '% equity, but be cautious — ' + callersBefore + ' caller' + (callersBefore > 1 ? 's' : '') + ' already in means someone likely has a real hand.';
      quality = 'good';
    } else if (eq > potOdds + 10) {
      text += 'Good price. Your ' + Math.round(eq) + '% equity comfortably beats the ' + Math.round(potOdds) + '% needed.';
      quality = 'good';
    } else if (eq >= potOdds - 10) {
      text += 'Borderline spot. Your ' + Math.round(eq) + '% equity roughly matches the ' + Math.round(potOdds) + '% needed — implied odds make or break this call.';
      quality = 'neutral';
    } else {
      text += 'Unprofitable call. You had ' + Math.round(eq) + '% equity but needed ' + Math.round(potOdds) + '%.';
      quality = 'bad';
    }
    // Sizing commentary for calls
    if (vBetPct !== null) {
      if (vBetPct <= 33) {
        text += ' Small sizing from villain — you\'re getting a great price to see more cards.';
      } else if (vBetPct > 100) {
        text += ' Villain overbets the pot — this usually polarises their range to nuts or bluffs.';
      }
    }

  // ── Raise ──
  } else if (act.type === 'raise') {
    text = facingDesc;
    if (eq > 55) {
      text += 'Value raise with ' + Math.round(eq) + '% equity.';
      quality = 'good';
    } else if (eq >= 35) {
      text += 'Semi-bluff raise with ' + Math.round(eq) + '% equity — applying pressure while you have outs.';
      quality = 'neutral';
    } else if (vFolds !== null && vFolds >= 60) {
      text += 'Bluff raise targeting ' + vName + ' who folds ' + vFolds + '% to raises — the aggression is justified even with weak equity.';
      quality = 'good';
    } else if (multiway) {
      text += mwDesc + 'Aggressive raise into multiple opponents with ' + Math.round(eq) + '% equity — risky, but isolates weak ranges.';
      quality = 'neutral';
    } else {
      text += 'Bluff raise with ' + Math.round(eq) + '% equity. Applies pressure but you\'re mostly relying on fold equity.';
      quality = 'neutral';
    }
    // Bet sizing for raises
    if (betPotPct !== null) {
      if (vCalls && betPotPct < 60 && eq > 55) {
        text += ' Your ' + betPotPct + '% pot sizing is small — ' + vName + ' goes to showdown ' + villainProfile.wtsd + '% of the time, so size up to extract more.';
      } else if (vFolds !== null && vFolds >= 60 && betPotPct > 80) {
        text += ' Your ' + betPotPct + '% pot sizing is large — ' + vName + ' folds ' + vFolds + '% anyway, a smaller raise risks less for the same fold.';
      } else if (betPotPct !== null) {
        text += ' You sized ' + betPotPct + '% of pot.';
      }
    }

  // ── Bet ──
  } else if (act.type === 'bet') {
    if (eq > 55) {
      text = 'Value bet with ' + Math.round(eq) + '% equity.';
      quality = 'good';
    } else if (eq >= 35) {
      text = 'Thin value or semi-bluff with ' + Math.round(eq) + '% equity.';
      quality = 'neutral';
    } else if (vFolds !== null && vFolds >= 60) {
      text = 'Bluff targeting ' + vName + ' who folds ' + vFolds + '% to raises — good target for aggression.';
      quality = 'good';
    } else if (multiway) {
      text = mwDesc + 'Betting into ' + playersActive + ' opponents with ' + Math.round(eq) + '% equity — someone likely has something. Be sure you have a plan if raised.';
      quality = 'neutral';
    } else {
      text = 'Bluff bet with ' + Math.round(eq) + '% equity. Putting pressure on but you need villain to fold.';
      quality = 'neutral';
    }
    // Bet sizing
    if (betPotPct !== null) {
      if (vCalls && betPotPct < 60 && eq > 55) {
        text += ' Your ' + betPotPct + '% pot sizing is small — ' + vName + ' goes to showdown ' + villainProfile.wtsd + '%, size up to punish them.';
      } else if (vFolds !== null && vFolds >= 60 && betPotPct > 80) {
        text += ' Your ' + betPotPct + '% pot sizing is large — ' + vName + ' folds ' + vFolds + '% anyway, a smaller bet gets the same fold for less risk.';
      } else if (vLoose && betPotPct < 50 && eq > 55) {
        text += ' Your ' + betPotPct + '% pot sizing is small — ' + vName + ' plays loose (VPIP ' + villainProfile.vpip + '%), size up against wide ranges.';
      } else if (betPotPct !== null) {
        text += ' You sized ' + betPotPct + '% of pot.';
      }
    }

  // ── Fold ──
  } else if (act.type === 'fold') {
    text = facingDesc;
    if (eq > 40 && vLoose) {
      text += 'You folded ' + Math.round(eq) + '% equity against ' + vName + ' who plays loose (VPIP ' + villainProfile.vpip + '%). Their range is wide — this fold was likely too tight.';
      quality = 'bad';
    } else if (eq > 40 && vFolds !== null && vFolds >= 60) {
      text += 'You folded ' + Math.round(eq) + '% equity but ' + vName + ' folds to raises ' + vFolds + '% — raising would have been better than folding.';
      quality = 'bad';
    } else if (eq > 40 && multiway) {
      text += mwDesc + 'You folded with ' + Math.round(eq) + '% equity. In a multiway pot the fold is more understandable — more opponents means more chance someone has you beat.';
      quality = 'neutral';
    } else if (eq > 40) {
      text += 'You folded with ' + Math.round(eq) + '% equity. This may have been too tight unless villain\'s range here is very strong.';
      quality = 'bad';
    } else if (eq >= 25) {
      text += 'Marginal fold with ' + Math.round(eq) + '% equity.';
      quality = 'neutral';
      if (vAgg) text += ' ' + vName + ' is aggressive though — calling could be defensible.';
      if (vBetPct !== null && vBetPct <= 33) text += ' The small sizing gave you a good price — consider calling more against small bets.';
    } else {
      text += 'Clean fold. ' + Math.round(eq) + '% equity isn\'t enough to continue.';
      quality = 'good';
    }
  }

  // ── Board texture adjustments (post-flop) ──
  if (texture) {
    if (texture.wetness === 'dry' && act.type === 'fold' && eq > 40) {
      text += ' Dry board makes this fold worse — fewer draws threaten you.';
    }
    if (texture.wetness === 'wet' && act.type === 'check' && eq > 65) {
      text += ' Wet board — you need to charge draws here.';
      if (quality !== 'bad') quality = 'bad';
    }
    if (texture.wetness === 'wet' && (act.type === 'bet' || act.type === 'raise') && eq >= 35 && eq <= 55) {
      text += ' Good aggression on a wet board — fold equity plus draw equity.';
      if (quality === 'neutral') quality = 'good';
    }
  }

  // ── Draw-aware notes ──
  if (madeHand && madeHand.draws.length > 0) {
    if (act.type === 'call' && potOdds > 0) {
      var totalOuts = 0;
      for (var oi = 0; oi < madeHand.draws.length; oi++) {
        var m = madeHand.draws[oi].match(/(\d+) outs/);
        if (m) totalOuts += parseInt(m[1], 10);
      }
      if (totalOuts > 0) {
        var drawEquity = totalOuts * 2; // rough rule of 2
        if (drawEquity >= potOdds) text += ' Your draw odds (' + totalOuts + ' outs ≈ ' + (totalOuts * 2) + '%) justified the call.';
        else text += ' Your draw odds (' + totalOuts + ' outs ≈ ' + (totalOuts * 2) + '%) were thin for this price.';
      }
    }
  }

  // ── Made hand context (post-flop) — only add if it's actionable, not just restating ──
  if (madeHand && texture) {
    if (madeHand.label === 'Top Pair' && texture.wetness === 'wet' && act.type === 'check') {
      text += ' Top pair on a wet board — bet to deny free cards to draws.';
    } else if (madeHand.label === 'Overpair' && texture.wetness === 'dry' && act.type === 'check') {
      text += ' Overpair on dry board — strong, bet for value since villain has few outs.';
    } else if (madeHand.label === 'Set' && (act.type === 'check' || (act.type === 'call' && betPotPct === null))) {
      text += ' Set is disguised — consider raising to build the pot while villain doesn\'t suspect it.';
    } else if ((madeHand.label === 'Full House' || madeHand.label === 'Quads' || madeHand.label === 'Straight Flush') && act.type === 'check') {
      text += ' You\'re at the top of your range — consider trapping if villain is aggressive, or betting small to induce a raise.';
    }
  }

  return { text: text, quality: quality };
}

// ── Main simulation runner ────────────────────────────────────────────────
function runEquitySimulation(hand) {
  var heroHole = hand.hole.map(normCard);
  var board = (hand.board || []).map(normCard);
  var heroInfo = getHeroStreetActions(hand);
  var results = [];

  var streetDefs = [
    { name: 'Preflop', boardSlice: 0, iters: 10000 },
    { name: 'Flop',    boardSlice: 3, iters: 10000 },
    { name: 'Turn',    boardSlice: 4, iters: 5000 },
    { name: 'River',   boardSlice: 5, iters: 0 } // exact
  ];

  for (var i = 0; i < streetDefs.length; i++) {
    var sd = streetDefs[i];
    var streetBoard = board.slice(0, sd.boardSlice);

    if (sd.boardSlice > board.length) break;

    if (heroInfo.foldedOn) {
      var foldIdx = ['Preflop', 'Flop', 'Turn', 'River'].indexOf(heroInfo.foldedOn);
      var curIdx = ['Preflop', 'Flop', 'Turn', 'River'].indexOf(sd.name);
      if (curIdx > foldIdx) break;
    }

    var streetInfo = heroInfo.streets[sd.name];
    if (!streetInfo && sd.name !== 'Preflop') continue;

    var sim = simulateStreet(heroHole, streetBoard, sd.iters);

    // Board texture + made hand + villain (post-flop only)
    var texture = streetBoard.length >= 3 ? classifyBoardTexture(streetBoard) : null;
    var madeHand = streetBoard.length >= 3 ? classifyMadeHand(heroHole, streetBoard) : null;
    var villainProfile = getPrimaryVillain(hand);

    var guidance = streetInfo ? generateGuidance(sim.equity, streetInfo, texture, madeHand, villainProfile) : { text: '', quality: 'neutral' };

    var actionDesc = '';
    if (streetInfo && streetInfo.action) {
      var a = streetInfo.action;
      if (a.type === 'fold') actionDesc = 'You folded.';
      else if (a.type === 'check') actionDesc = 'You checked.';
      else if (a.type === 'call') actionDesc = 'You called ' + fmtDollar(a.amount) + '.';
      else if (a.type === 'raise') actionDesc = 'You raised to ' + fmtDollar(a.amount) + '.';
      else if (a.type === 'bet') actionDesc = 'You bet ' + fmtDollar(a.amount) + '.';
      else if (a.type === 'sb') actionDesc = 'Small blind.';
      else if (a.type === 'bb') actionDesc = 'Big blind.';
    }

    var potOddsStr = '';

    results.push({
      street: sd.name,
      equity: sim.equity,
      iterations: sim.iterations,
      exact: sim.exact,
      actionDesc: actionDesc,
      potOddsStr: potOddsStr,
      guidance: guidance,
      texture: texture,
      madeHand: madeHand,
      villainProfile: villainProfile
    });
  }

  return results;
}

// ── Dollar formatting helper ──────────────────────────────────────────────
function fmtDollar(n) {
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K';
  return '$' + n;
}

// ── UI rendering ──────────────────────────────────────────────────────────
function renderEquityResults(container, results) {
  var hasExact = false;
  var maxIters = 0;
  for (var i = 0; i < results.length; i++) {
    if (results[i].exact) hasExact = true;
    if (!results[i].exact && results[i].iterations > maxIters) maxIters = results[i].iterations;
  }

  var headerNote = '';
  if (maxIters > 0 && hasExact) {
    headerNote = maxIters.toLocaleString() + ' iterations \u00b7 river is exact';
  } else if (maxIters > 0) {
    headerNote = maxIters.toLocaleString() + ' iterations';
  } else if (hasExact) {
    headerNote = 'Exact enumeration';
  }

  var html = '<div class="eq-sim">';
  html += '<div class="eq-sim-header"><span class="eq-sim-title">Equity Simulation</span><span class="eq-sim-note">' + headerNote + '</span></div>';

  var curvePoints = [];

  for (var r = 0; r < results.length; r++) {
    var res = results[r];
    var eqPct = (res.equity * 100).toFixed(1);
    var barWidth = Math.round(res.equity * 100);
    var qualClass = res.guidance.quality === 'good' ? 'eq-good' : res.guidance.quality === 'bad' ? 'eq-bad' : 'eq-neutral';

    curvePoints.push({ street: res.street, equity: res.equity });

    html += '<div class="eq-row">';
    // Top line: street name, texture badge, equity %, bar
    html += '<div class="eq-row-top">';
    html += '<div class="eq-street">' + res.street + '</div>';
    if (res.texture) {
      var texCls = res.texture.wetness === 'wet' ? 'tex-wet' : res.texture.wetness === 'dry' ? 'tex-dry' : 'tex-med';
      html += '<span class="board-texture-badge ' + texCls + '">' + res.texture.label + '</span>';
    }
    html += '<div class="eq-pct">' + eqPct + '%</div>';
    html += '<div class="eq-bar-track"><div class="eq-bar-fill" style="width:' + barWidth + '%"></div></div>';
    html += '</div>';
    // Bottom section: badges + coaching
    var hasBottom = res.madeHand || res.guidance.text || res.villainProfile;
    if (hasBottom) {
      html += '<div class="eq-row-bottom">';
      if (res.madeHand) {
        html += '<div class="eq-badges">';
        html += '<span class="eq-made-hand">' + res.madeHand.label + '</span>';
        if (res.madeHand.draws.length) {
          for (var dri = 0; dri < res.madeHand.draws.length; dri++) {
            html += '<span class="draw-outs">' + res.madeHand.draws[dri] + '</span>';
          }
        }
        html += '</div>';
      }
      html += '<div class="eq-detail ' + qualClass + '">' + res.actionDesc + ' ' + res.potOddsStr + res.guidance.text + '</div>';
      if (res.villainProfile && res.guidance.text.indexOf(res.villainProfile.name) === -1) {
        html += '<div class="villain-profile-line">vs ' + res.villainProfile.type + ' (' + res.villainProfile.name + ' \u00b7 VPIP ' + (res.villainProfile.vpip || '?') + '% \u00b7 Fold to raise ' + (res.villainProfile.foldToRaise || '?') + '%)</div>';
      }
      html += '</div>';
    }
    html += '</div>';
  }

  // Equity curve SVG
  if (curvePoints.length >= 2) {
    var svgW = 240, svgH = 60, pad = 20;
    var plotW = svgW - pad * 2, plotH = svgH - pad;
    html += '<div class="eq-curve">';
    html += '<svg width="' + svgW + '" height="' + svgH + '" viewBox="0 0 ' + svgW + ' ' + svgH + '">';
    var pts = [];
    for (var c = 0; c < curvePoints.length; c++) {
      var x = pad + (plotW / (curvePoints.length - 1)) * c;
      var y = svgH - pad - (curvePoints[c].equity * plotH);
      pts.push(x + ',' + y);
      html += '<text x="' + x + '" y="' + (svgH - 2) + '" text-anchor="middle" fill="var(--dim)" font-size="10" font-family="IBM Plex Mono, monospace">' + curvePoints[c].street.slice(0, 1) + '</text>';
      html += '<circle cx="' + x + '" cy="' + y + '" r="3" fill="var(--gold)"/>';
      html += '<text x="' + x + '" y="' + (y - 7) + '" text-anchor="middle" fill="var(--dim)" font-size="10" font-family="IBM Plex Mono, monospace">' + (curvePoints[c].equity * 100).toFixed(0) + '%</text>';
    }
    html += '<polyline points="' + pts.join(' ') + '" fill="none" stroke="var(--gold)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>';
    html += '</svg></div>';
  }

  // Caveats
  var hasFlopOrTurn = results.some(function(r) { return r.street === 'Flop' || r.street === 'Turn'; });
  var caveats = '<div class="eq-caveats">';
  caveats += 'Equity calculated against a single random hand. In multiway pots, true equity may be lower.';
  if (hasFlopOrTurn) {
    caveats += ' Pot odds comparisons use raw equity; implied odds (potential to win more on later streets) are not factored in and may justify calls that appear unprofitable.';
  }
  caveats += '</div>';
  html += caveats;

  html += '</div>';
  container.innerHTML = html;
}

// ── Button injection ──────────────────────────────────────────────────────
function injectEquityButton(box, hand) {
  var slot = box.querySelector('#equity-slot');
  if (!slot) return;

  // Only show when simulation is meaningful
  if (!hand.hole || hand.hole.length !== 2) return;
  if (!hand.actions || !hand.actions.length) return;

  var parsed = parseActions(hand.actions);
  var heroFoldedPreflop = false;
  for (var i = 0; i < parsed.length; i++) {
    if (parsed[i].isMe && parsed[i].type === 'fold' && parsed[i].street === 'Preflop') {
      heroFoldedPreflop = true;
      break;
    }
  }

  var hasBoard = hand.board && hand.board.length >= 3;
  var heroAllInPreflop = false;
  if (!hasBoard) {
    for (var j = 0; j < parsed.length; j++) {
      if (parsed[j].isMe && parsed[j].street === 'Preflop' && parsed[j].type === 'raise') {
        heroAllInPreflop = true;
      }
    }
  }

  if (heroFoldedPreflop && !hasBoard) return;
  if (!hasBoard && !heroAllInPreflop) return;

  var btn = document.createElement('button');
  btn.className = 'example-hand-btn';
  btn.id = 'mc-sim-btn';
  btn.textContent = 'Run Equity Simulation';
  slot.appendChild(btn);

  btn.onclick = function() {
    slot.innerHTML = '<div class="eq-spinner"><div class="eq-spinner-ring"></div><span class="eq-spinner-text">Simulating...</span></div>';

    setTimeout(function() {
      var results = runEquitySimulation(hand);
      renderEquityResults(slot, results);
    }, 50);
  };
}
