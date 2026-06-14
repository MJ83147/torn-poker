const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
const SUITS = ['\u2660', '\u2665', '\u2666', '\u2663'];

var SUIT_WORD = {
  'diamonds': '♦', 'hearts': '♥', 'spades': '♠', 'clubs': '♣',
  'diamond': '♦', 'heart': '♥', 'spade': '♠', 'club': '♣'
};
var SUIT_LETTER  = { h: '\u2665', d: '\u2666', c: '\u2663', s: '\u2660' };
var SUIT_TO_CODE = { '\u2665': 'h', '\u2666': 'd', '\u2663': 'c', '\u2660': 's' };
var SUIT_CLASS   = { h: 'r', d: 'r', c: 'b', s: 'b' };

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
  return '<span class="allin-card ' + (SUIT_CLASS[SUIT_TO_CODE[suit] || suit] || 'b') + '">' + rank + (SUIT_LETTER[SUIT_TO_CODE[suit] || suit] || suit) + '</span>';
}

function displayCards(cards) {
  return cards.map(displayCard).join(' ');
}

function classifyBoardTexture(boardCards) {
  if (!boardCards || boardCards.length < 3) return null;
  var cards = boardCards.map(normCard);
  var ranks = cards.map(function(c) { return RANKS.indexOf(c.slice(0, -1)); });
  var suits = cards.map(function(c) { return c.slice(-1); });

  var suitCounts = {};
  for (var i = 0; i < suits.length; i++) {
    suitCounts[suits[i]] = (suitCounts[suits[i]] || 0) + 1;
  }
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

  var boardRankCounts = {};
  for (var rc = 0; rc < ranks.length; rc++) {
    boardRankCounts[ranks[rc]] = (boardRankCounts[ranks[rc]] || 0) + 1;
  }

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
function parseAmount(str) {
  return parseInt(String(str || '').replace(/,/g, ''), 10);
}

function parseActions(actions) {
  if (actions && actions._parsed) return actions._parsed;
  // Structured fast-path: a schemaVersion 2 payload already ships action
  // objects (not text strings). Pass them through verbatim - no text parsing.
  if (Array.isArray(actions) && actions.length && typeof actions[0] === 'object' && actions[0] !== null) {
    actions._parsed = actions;
    return actions;
  }
  const out = [];
  let street = 'Preflop';
  for (const raw of (actions || [])) {
    const isMe = raw.indexOf('>>') === 0;
    const line = raw.replace(/^>>\s*/, '').replace(/^\s+/, '').trim();
    if (line.startsWith('The flop')) {
      street = 'Flop';
      continue;
    }
    if (line.startsWith('The turn')) {
      street = 'Turn';
      continue;
    }
    if (line.startsWith('The river')) {
      street = 'River';
      continue;
    }
    if (line.startsWith('The preflop')) {
      street = 'Preflop';
      continue;
    }
    const ci = line.indexOf(': ');
    if (ci === -1) continue;
    const author = line.slice(0, ci);
    const msg = line.slice(ci + 2);
    const am = msg.match(/\$([0-9,]+)/);
    const amount = am ? parseAmount(am[1]) : 0;
    let type = null;
    if (msg.startsWith('folded')) type = 'fold';
    else if (msg.startsWith('checked')) type = 'check';
    else if (msg.startsWith('called')) type = 'call';
    else if (msg.startsWith('raised')) type = 'raise';
    else if (msg.startsWith('bet')) type = 'bet';
    else if (msg.startsWith('posted small blind')) type = 'sb';
    else if (msg.startsWith('posted big blind')) type = 'bb';
    else if (msg.includes('won')) type = 'won';
    if (type) {
      out.push({ author, isMe, street, type, amount, msg });
    }
  }
  if (actions) actions._parsed = out;
  return out;
}

// Only raises without " to " indicate shoves (e.g. "raised $5,000,000" vs "raised $2,500,000 to $5,000,000").
// Regular bets ("bet $X") are never detectable as all-in from the log format alone.
function isAllInAction(acts, idx) {
  var a = acts[idx];
  if (!a) return false;
  // Structured hands carry an explicit allIn boolean - trust it.
  if (typeof a.allIn === 'boolean') return a.allIn;
  // Legacy text fallback: only raises without " to " indicate shoves. TODO(v2): remove once all hands are structured.
  if (a.type !== 'raise' || !a.msg) return false;
  if (a.msg.indexOf(' to ') !== -1) return false;
  return true;
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
    // Legacy text fallback: regex the "to $X" total out of the message. TODO(v2): remove once all hands are structured.
    if (a.type === 'raise' && a.msg && a.msg.indexOf(' to ') !== -1) {
      var m = a.msg.match(/to \$?([0-9,]+)/);
      if (m) {
        var total = parseAmount(m[1]);
        if (!committed[a.author] || total > committed[a.author]) committed[a.author] = total;
        continue;
      }
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

function calcInvestmentFromActions(actions) {
  let total = 0;
  for (let i = 0; i < actions.length; i++) {
    if (typeof actions[i] !== 'string') continue; // structured (v2) hands carry their own `invested`
    let line = actions[i].replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&');
    if (line.indexOf('>>') !== 0) continue;
    if (line.indexOf(' won ') !== -1) continue;
    if (line.indexOf(' reveals ') !== -1) continue;
    if (line.indexOf('folded') !== -1) continue;
    if (line.indexOf('checked') !== -1) continue;
    const dm = line.match(/\$([0-9,]+)/);
    if (dm) total += parseAmount(dm[1]);
  }
  return total;
}

function isShowdown(hand) {
  // Structured hands carry an explicit showdown boolean - trust it.
  if (typeof hand.showdown === 'boolean') return hand.showdown;
  if (!hand.outcome) return false;
  if (hand._showdownDone) return hand._showdown;
  var result = false;
  if (hand.outcome.result === 'lost') {
    result = true;
  } else if (hand.outcome.result === 'won') {
    var actions = hand.actions || [];
    for (var i = 0; i < actions.length; i++) {
      if (actions[i].indexOf(' reveals ') !== -1) { result = true; break; }
    }
  }
  hand._showdown = result;
  hand._showdownDone = true;
  return result;
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
