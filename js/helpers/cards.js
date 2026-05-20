const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
const SUITS = ['\u2660', '\u2665', '\u2666', '\u2663'];

var SUIT_WORD = {
  'diamonds': '♦', 'hearts': '♥', 'spades': '♠', 'clubs': '♣',
  'diamond': '♦', 'heart': '♥', 'spade': '♠', 'club': '♣'
};
var SUIT_LETTER  = { h: '\u2665', d: '\u2666', c: '\u2663', s: '\u2660' };
var SUIT_TO_CODE = { '\u2665': 'h', '\u2666': 'd', '\u2663': 'c', '\u2660': 's' };
var SUIT_CLASS   = { h: 'r', d: 'r', c: 'b', s: 'b' };

// Normalise any card format ("3hearts", "10♥", "Ts") → "T♠" style
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
    tags: tags, label: tags.join(' ')
  };
}
