const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
const SUITS = ['\u2660', '\u2665', '\u2666', '\u2663'];

var SUIT_WORD = {
  'diamonds': '♦', 'hearts': '♥', 'spades': '♠', 'clubs': '♣',
  'diamond': '♦', 'heart': '♥', 'spade': '♠', 'club': '♣'
};
var SUIT_LETTER  = { h: '\u2665', d: '\u2666', c: '\u2663', s: '\u2660' };
var SUIT_TO_CODE = { '\u2665': 'h', '\u2666': 'd', '\u2663': 'c', '\u2660': 's' };
var SUIT_CLASS   = { h: 'r', d: 'r', c: 'b', s: 'b' };

// ---- Card primitives (shared by hand-evaluator, insights, panels) ----
// Accessors on a "rank+suit" card string ("A\u2660", "Ts"): the last char is the
// suit, everything before it is the rank.
function cardRank(card) { return card.slice(0, -1); }
function cardSuit(card) { return card.slice(-1); }
function cardRankIndex(card) { return RANKS.indexOf(card.slice(0, -1)); }

// Frequency map over an array of primitive values: [a,a,b] -> {a:2, b:1}.
// Centralises the counts[k]=(counts[k]||0)+1 idiom used for rank/suit tallies.
function freqMap(values) {
  var counts = {};
  for (var i = 0; i < values.length; i++) {
    counts[values[i]] = (counts[values[i]] || 0) + 1;
  }
  return counts;
}

// Normalise to "rank+suit-symbol": "3hearts"→"3♥", "10spades"→"T♠", "Ts"→"Ts"
function normCard(c) {
  if (!c || typeof c !== 'string') return c;
  var m = c.match(/^(\d{1,2}|[AKQJT])([a-z]+)$/i);
  if (m) {
    var rank = m[1]; if (rank === '10') rank = 'T';
    var suit = SUIT_WORD[m[2].toLowerCase()];
    return suit ? rank + suit : c;
  }
  if (c.length > 2 && c.slice(0, 2) === '10') return 'T' + c.slice(2);
  return c;
}

function normCardCode(c) {
  if (!c) return c;
  var n = normCard(c);
  var sym = n.slice(-1);
  var code = SUIT_TO_CODE[sym];
  return code ? n.slice(0, -1) + code : n;
}

function displayCard(c) {
  if (!c || c.length < 2) return c;
  var rank = c.slice(0, -1);
  var suit = c.slice(-1);
  if (rank === 'T') rank = '10';
  return '<span class="card-glyph ' + (SUIT_CLASS[SUIT_TO_CODE[suit] || suit] || 'b') + '">' + rank + (SUIT_LETTER[SUIT_TO_CODE[suit] || suit] || suit) + '</span>';
}

function displayCards(cards) {
  return cards.map(displayCard).join(' ');
}

function classifyBoardTexture(boardCards) {
  if (!boardCards || boardCards.length < 3) return null;
  var cards = boardCards.map(normCard);
  var ranks = cards.map(cardRankIndex);
  var suits = cards.map(cardSuit);

  var suitCounts = freqMap(suits);
  var maxSuit = 0;
  for (var s in suitCounts) { if (suitCounts[s] > maxSuit) maxSuit = suitCounts[s]; }

  var monotone = maxSuit === cards.length;
  var twoTone = !monotone && maxSuit >= 2;
  var rainbow = Object.keys(suitCounts).length >= 3;
  var flushDraw = !monotone && maxSuit >= 3;

  var sorted = ranks.slice().sort(function(a, b) { return a - b; });
  var paired = false;
  for (var p = 1; p < sorted.length; p++) {
    if (sorted[p] === sorted[p - 1]) { paired = true; break; }
  }

  var connected = false;
  var straightDraw = false;
  var unique = [];
  for (var u = 0; u < sorted.length; u++) {
    if (unique.indexOf(sorted[u]) === -1) unique.push(sorted[u]);
  }
  for (var w = 0; w <= 12; w++) {
    var inWindow = 0;
    for (var wi = 0; wi < unique.length; wi++) {
      if (unique[wi] >= w && unique[wi] <= w + 4) inWindow++;
    }
    if (inWindow >= 3) { connected = true; break; }
  }
  if (connected && cards.length <= 4) straightDraw = true;

  var highCard = RANKS[sorted[sorted.length - 1]];

  var boardRankCounts = freqMap(ranks);

  var score = 0;
  if (monotone) score += 3;
  else if (twoTone) score += 2;
  if (connected) score += 2;
  var straightCombos = 0;
  for (var sc = 0; sc <= 9; sc++) {
    var inSpan = 0;
    for (var sci = 0; sci < unique.length; sci++) {
      if (unique[sci] >= sc && unique[sci] <= sc + 4) inSpan++;
    }
    if (inSpan >= 3) straightCombos++;
  }
  if (straightCombos > 1) score += Math.min(straightCombos - 1, 2);
  if (paired) score -= 2;
  if (sorted[sorted.length - 1] === 12 && !connected) score -= 1;
  score = Math.max(0, Math.min(10, score));

  var wetness = score <= 3 ? 'dry' : score <= 6 ? 'medium' : 'wet';

  var tags = [];
  if (wetness === 'wet') tags.push('Wet');
  else if (wetness === 'dry') tags.push('Dry');
  if (monotone) tags.push('Monotone');
  else if (twoTone) tags.push('Two-tone');
  else if (rainbow) tags.push('Rainbow');
  if (paired) tags.push('Paired');
  if (connected) tags.push('Connected');

  return {
    wetness: wetness, monotone: monotone, twoTone: twoTone, rainbow: rainbow,
    paired: paired, flushDraw: flushDraw, straightDraw: straightDraw,
    connected: connected, highCard: highCard, score: score,
    boardRankCounts: boardRankCounts,
    tags: tags, label: tags.join(' ')
  };
}


/* ===== merged from hand-parsing.js ===== */
function parseActions(actions) {
  // Hands are schemaVersion 2: actions already ship as structured objects
  // ({ author, isMe, street, type, amount, raiseTo, allIn }). Pass them through
  // verbatim. An empty or otherwise unstructured array yields no actions.
  if (!Array.isArray(actions) || !actions.length) return [];
  return (typeof actions[0] === 'object' && actions[0] !== null) ? actions : [];
}

// Structured hands carry an explicit allIn boolean; absent means not all-in.
function isAllInAction(acts, idx) {
  var a = acts[idx];
  return !!(a && a.allIn);
}

function parseHoleKey(hole) {
  if (!hole || hole.length < 2) return null;
  if (hole._keyCached) return hole._key;
  var r1 = hole[0].slice(0, -1);
  var r2 = hole[1].slice(0, -1);
  if (r1 === '10') r1 = 'T';
  if (r2 === '10') r2 = 'T';
  const s1 = hole[0].slice(-1);
  const s2 = hole[1].slice(-1);
  const v1 = RANKS.indexOf(r1);
  const v2 = RANKS.indexOf(r2);
  if (v1 < 0 || v2 < 0) { hole._key = null; hole._keyCached = true; return null; }
  const hi = Math.max(v1, v2);
  const lo = Math.min(v1, v2);
  var key = hi === lo
    ? RANKS[hi] + RANKS[hi]
    : RANKS[hi] + RANKS[lo] + (s1 === s2 ? 's' : 'o');
  hole._key = key;
  hole._keyCached = true;
  return key;
}

function classifyKey(key) {
  if (!key) return 'unknown';
  if (key.length >= 2 && key[0] === key[1] && RANKS.includes(key[0])) return 'Pocket Pairs';
  const suited = key.endsWith('s');
  const r1 = key[0];
  const r2 = key.endsWith('s') || key.endsWith('o') ? key.slice(1, -1) : key.slice(1);
  const v1 = RANKS.indexOf(r1);
  const v2 = RANKS.indexOf(r2);
  const hi = Math.max(v1, v2);
  const lo = Math.min(v1, v2);
  if (hi >= 12 && lo >= 9) return 'Broadway';
  if (hi === 12) return 'Ace-Rag';
  if (suited && hi - lo <= 4) return 'Suited Connectors';
  if (suited) return 'Suited';
  if (!suited && hi - lo <= 4) return 'Connectors';
  return 'Offsuit Trash';
}

function countHandPlayers(hand) {
  var n;
  if (hand.tableSize) {
    n = hand.tableSize;
  } else {
    var parsed = parseActions(hand.actions);
    var seen = {};
    n = 0;
    for (var i = 0; i < parsed.length; i++) {
      var a = parsed[i].author;
      if (!seen[a]) { seen[a] = true; n++; }
    }
  }
  return Math.min(n, 9);
}

// Preflop = seat count. Flop/Turn/River = count who hadn't folded entering that street.
// Streets the hand never reached return null (not 0).
function countActivePerStreet(hand) {
  var acts = parseActions(hand.actions);
  var seats = countHandPlayers(hand);
  var result = { preflop: seats, flop: null, turn: null, river: null };

  var folded = {};
  var activeCount = seats;
  var seenAuthors = {};
  var reachedFlop = false, reachedTurn = false, reachedRiver = false;

  for (var i = 0; i < acts.length; i++) {
    var a = acts[i];
    if (a.street === 'Flop' && !reachedFlop) {
      result.flop = activeCount;
      reachedFlop = true;
    }
    if (a.street === 'Turn' && !reachedTurn) {
      result.turn = activeCount;
      reachedTurn = true;
    }
    if (a.street === 'River' && !reachedRiver) {
      result.river = activeCount;
      reachedRiver = true;
    }
    if (a.author && !seenAuthors[a.author]) seenAuthors[a.author] = true;
    if (a.type === 'fold' && a.author && !folded[a.author]) {
      folded[a.author] = true;
      activeCount--;
    }
  }

  var uniqueAuthors = Object.keys(seenAuthors).length;
  if (!reachedFlop && uniqueAuthors && uniqueAuthors < seats) {
    // nothing to adjust - street counts remain null
  }

  return result;
}

function estimateEffStackBB(hand) {
  var bb = (typeof getHandBB === 'function') ? getHandBB(hand) : null;
  if (!bb || bb <= 0) bb = hand.bigBlind || null;
  if (!bb || bb <= 0) return null;

  if (hand.startStack && hand.startStack > 0) {
    return Math.round((hand.startStack / bb) * 10) / 10;
  }
  if (hand.effStack && hand.effStack > 0) {
    return Math.round((hand.effStack / bb) * 10) / 10;
  }

  var acts = parseActions(hand.actions);
  if (!acts.length) return null;

  var committed = {};
  var folded = {};
  var heroAuthor = null;
  var sawAllIn = false;

  for (var i = 0; i < acts.length; i++) {
    var a = acts[i];
    if (a.isMe) heroAuthor = a.author;
    if (!a.author) continue;
    if (a.type === 'fold') { folded[a.author] = true; continue; }
    if (a.type === 'won') continue;
    if (isAllInAction(acts, i)) sawAllIn = true;

    // Structured hands carry the raise total explicitly as raiseTo; prefer it.
    if (a.type === 'raise' && typeof a.raiseTo === 'number') {
      var totalR = a.raiseTo;
      if (!committed[a.author] || totalR > committed[a.author]) committed[a.author] = totalR;
      continue;
    }
    if (a.amount > 0) {
      committed[a.author] = (committed[a.author] || 0) + a.amount;
    }
  }

  if (!heroAuthor || committed[heroAuthor] == null) return null;
  var heroCommit = committed[heroAuthor];

  var villainCommits = [];
  for (var v in committed) {
    if (v === heroAuthor) continue;
    villainCommits.push(committed[v]);
  }
  if (!villainCommits.length) return null;
  var villainMax = Math.max.apply(null, villainCommits);

  var effFloor = Math.min(heroCommit, villainMax);

  // When no all-in occurred, commitments are only a lower bound. We only report
  // depth if the floor crosses ~20 BB - below that the hand is ambiguous.
  if (!sawAllIn && effFloor < bb * 20) return null;

  return Math.round((effFloor / bb) * 10) / 10;
}

function isShowdown(hand) {
  // Structured hands carry an explicit showdown boolean.
  return typeof hand.showdown === 'boolean' ? hand.showdown : false;
}


/* ===== merged from hand-predicates.js ===== */
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
