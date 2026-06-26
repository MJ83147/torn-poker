function isStrongShowdownHand(strength) {
  if (!strength) return false;
  var s = String(strength).toLowerCase();
  return s.indexOf('two pair') !== -1 ||
         s.indexOf('three of a kind') !== -1 ||
         s.indexOf('straight') !== -1 ||
         s.indexOf('flush') !== -1 ||
         s.indexOf('full house') !== -1 ||
         s.indexOf('four of a kind') !== -1;
}

function getInvested(h) {
  if (!h) return 0;
  if (h._investedCached) return h._invested;
  // Structured (v2) hands always carry a numeric `invested` (0 is valid for a
  // fold). Only fall back to the text parser when it's genuinely absent.
  var v = (typeof h.invested === 'number') ? h.invested : calcInvestmentFromActions(h.actions || []);
  h._invested = v;
  h._investedCached = true;
  return v;
}

function getHeroActions(h) {
  return parseActions(h.actions).filter(function(a) { return a.isMe; });
}

function getActsSummary(h) {
  return getHeroActions(h).map(function(a) { return a.type; }).join(' · ');
}

function getHandPnl(h) {
  if (!h.outcome) return { cls: 'val-muted', text: '?' };
  var invested = getInvested(h);
  if (h.outcome.result === 'won') {
    var profit = (h.outcome.amount || 0) - invested;
    if (profit >= 0) return { cls: 'val-pos', text: '+' + fmt(profit) };
    return { cls: 'val-neg', text: '-' + fmt(Math.abs(profit)) };
  }
  if (h.outcome.result === 'folded') {
    return { cls: 'val-neg', text: invested > 0 ? '-' + fmt(invested) : 'folded' };
  }
  return { cls: 'val-neg', text: '-' + fmt(invested) };
}

function getHandPnlValue(h) {
  if (!h.outcome) return 0;
  var invested = getInvested(h);
  if (h.outcome.result === 'won') return (h.outcome.amount || 0) - invested;
  return -invested;
}

function inferTable(hand) {
  if (hand.tableId) {
    const num = String(hand.tableId).replace(/\D/g, '');
    if (num && TABLE_META[num]) return Number(num);
  }
  if (hand.table) {
    const num = String(hand.table).replace(/\D/g, '');
    if (num && TABLE_META[num]) return Number(num);
  }
  if (hand.bigBlind) {
    const candidates = BB_TO_TABLES[hand.bigBlind];
    if (candidates && candidates.length === 1) return candidates[0].id;
    if (candidates && candidates.length > 1 && hand.tableSize) {
      const match = candidates.find(c => c.max >= hand.tableSize);
      if (match) return match.id;
    }
  }
  if (hand.actions && hand.actions.length) {
    let bb = 0;
    const players = new Set();
    for (let i = 0; i < hand.actions.length; i++) {
      const line = hand.actions[i];
      if (typeof line === 'string') {
        const bbMatch = line.match(/posted big blind \$([0-9,]+)/);
        if (bbMatch) bb = parseAmount(bbMatch[1]);
        const authorMatch = line.match(/^\s*(?:>> )?([A-Za-z0-9_ -]+?):\s/);
        if (authorMatch && !authorMatch[1].startsWith('The ')) {
          players.add(authorMatch[1]);
        }
      } else if (line && typeof line === 'object') {
        // structured (v2) action
        if (line.type === 'bb' && line.amount) bb = line.amount;
        if (line.author) players.add(line.author);
      }
    }
    if (bb && BB_TO_TABLES[bb]) {
      const candidates = BB_TO_TABLES[bb];
      if (candidates.length === 1) return candidates[0].id;
      const playerCount = players.size;
      const sorted = candidates.slice().sort((a, b) => a.max - b.max);
      const match = sorted.find(c => c.max >= playerCount);
      if (match) return match.id;
      return sorted[sorted.length - 1].id;
    }
  }
  return null;
}

function isCashHand(hand) {
  const tid = inferTable(hand);
  if (tid === null) return true; // legacy hands without table data, assume cash
  return CASH_TABLE_IDS.has(tid);
}

function getHandBB(hand) {
  var tid = inferTable(hand);
  if (tid !== null && TABLE_META[tid]) return TABLE_META[tid].bb;
  return null;
}

function getTableLabel(tableId) {
  if (!tableId || !TABLE_META[tableId]) return 'Unknown Table';
  const t = TABLE_META[tableId];
  const prefix = t.tournament ? 'T: ' : '';
  return prefix + t.name + ' (' + fmt(t.sb) + '/' + fmt(t.bb) + ')';
}

function getPositionCategory(position) {
  if (!position) return null;
  var p = position.toUpperCase().replace(/[^A-Z0-9+]/g, '');
  if (p === 'UTG' || p === 'UTG+1') return 'EP';
  if (p === 'MP' || p === 'LJ') return 'MP';
  if (p === 'HJ' || p === 'CO' || p === 'BTN') return 'LP';
  if (p === 'SB' || p === 'BB') return 'Blinds';
  return null;
}

function classifyPreflopAction(h) {
  if (!h || !h.actions) return null;
  if (h._preActionDone) return h._preAction;
  var result = _classifyPreflopActionUncached(h);
  h._preAction = result;
  h._preActionDone = true;
  return result;
}

function _classifyPreflopActionUncached(h) {
  var acts = parseActions(h.actions).filter(function(a) { return a.street === 'Preflop'; });
  if (!acts.length) return null;
  var heroAuthor = null;
  for (var i = 0; i < acts.length; i++) { if (acts[i].isMe) { heroAuthor = acts[i].author; break; } }
  var firstHero = null;
  for (var i = 0; i < acts.length; i++) {
    var a = acts[i];
    if (!a.isMe) continue;
    if (a.type === 'sb' || a.type === 'bb' || a.type === 'won') continue;
    firstHero = a;
    break;
  }
  var raisesBefore = 0;
  var callsBefore = 0;
  if (firstHero) {
    for (var i = 0; i < acts.length; i++) {
      var a = acts[i];
      if (a === firstHero) break;
      if (a.isMe) continue;
      if (a.type === 'raise' || a.type === 'bet') raisesBefore++;
      else if (a.type === 'call') callsBefore++;
    }
  }
  if (!firstHero) {
    var heroIsBB = acts.some(function(a) { return a.isMe && a.type === 'bb'; });
    var heroFolded = acts.some(function(a) { return a.isMe && a.type === 'fold'; });
    if (heroIsBB && !heroFolded && raisesBefore === 0) return 'walked';
    return 'folded-pre';
  }
  if (firstHero.type === 'fold') return 'folded-pre';
  if (raisesBefore === 0 && (firstHero.type === 'raise' || firstHero.type === 'bet')) {
    var sawThreeBet = false;
    var heroResponse = null;
    var heroOwn3betCount = 0;
    var startedAfter = false;
    for (var i = 0; i < acts.length; i++) {
      var a = acts[i];
      if (a === firstHero) { startedAfter = true; continue; }
      if (!startedAfter) continue;
      if (!a.isMe && (a.type === 'raise' || a.type === 'bet')) sawThreeBet = true;
      if (sawThreeBet && a.isMe) {
        if (a.type === 'fold') { heroResponse = 'fold'; break; }
        if (a.type === 'call') { heroResponse = 'call'; break; }
        if (a.type === 'raise' || a.type === 'bet') { heroResponse = '4bet'; break; }
      }
    }
    if (sawThreeBet) {
      if (heroResponse === 'fold') return 'rfi-vs-3bet-fold';
      if (heroResponse === 'call') return 'rfi-vs-3bet-call';
      if (heroResponse === '4bet') return 'rfi-vs-3bet-4bet';
      return 'rfi-vs-3bet-fold';
    }
    return 'rfi';
  }
  if (raisesBefore >= 1) {
    if (firstHero.type === 'raise' || firstHero.type === 'bet') {
      if (callsBefore >= 1) return 'squeeze';
      return 'vs-rfi-3bet';
    }
    if (firstHero.type === 'call') return 'vs-rfi-call';
    return 'folded-pre';
  }
  if (firstHero.type === 'call') {
    return callsBefore >= 1 ? 'limp-behind' : 'limp-open';
  }
  return null;
}

function detectPlayerFromActions(hands) {
  for (let i = 0; i < hands.length; i++) {
    if (hands[i].player && hands[i].player !== 'Unknown') {
      return hands[i].player;
    }
  }
  const nameCounts = {};
  for (let i = 0; i < hands.length; i++) {
    const actions = hands[i].actions || [];
    for (let j = 0; j < actions.length; j++) {
      const line = actions[j];
      // Structured (v2) actions are objects: the hero is the `isMe` author.
      if (line && typeof line === 'object') {
        if (line.isMe && line.author) {
          nameCounts[line.author] = (nameCounts[line.author] || 0) + 1;
        }
        continue;
      }
      // Legacy (v1) text lines: the hero is prefixed with `>>`.
      const str = line || '';
      const isMe = str.indexOf('>>') === 0 || str.indexOf('&gt;&gt;') === 0;
      if (isMe) {
        const clean = str.replace(/^(>>|&gt;&gt;)\s*/, '').trim();
        const ci = clean.indexOf(': ');
        if (ci > 0) {
          const name = clean.slice(0, ci);
          nameCounts[name] = (nameCounts[name] || 0) + 1;
        }
      }
    }
  }
  let bestName = null;
  let bestCount = 0;
  for (const name in nameCounts) {
    if (nameCounts[name] > bestCount) {
      bestCount = nameCounts[name];
      bestName = name;
    }
  }
  return bestName;
}


/* ===== merged from migration.js ===== */
// Some TC Poker exports omit board/pot/outcome structured fields even though the
// full hand history is present in the actions array.
function backfillHandData(hands) {
  var CARD_RE = /(\d{1,2}|[AKQJT])([a-z]+|[\u2665\u2666\u2663\u2660])/gi;

  function parseCardsFromStreet(line) {
    var cards = [];
    var m;
    while ((m = CARD_RE.exec(line)) !== null) {
      var rank = m[1];
      if (rank === '10') rank = 'T';
      var suitRaw = m[2] || '';
      var suit = SUIT_TO_CODE[suitRaw] ? suitRaw : SUIT_WORD[suitRaw.toLowerCase()];
      if (suit) cards.push(rank + suit);
    }
    CARD_RE.lastIndex = 0;
    return cards;
  }

  for (var i = 0; i < hands.length; i++) {
    var h = hands[i];
    // Already processed (e.g. restored from storage). Normalisation, dedup and
    // board/pot/outcome fill are idempotent, so re-running them is pure waste.
    if (h._bf) continue;
    h._bf = true;

    if (h.hole && h.hole.length) {
      for (var n = 0; n < h.hole.length; n++) h.hole[n] = normCard(h.hole[n]);
    }
    if (h.board && h.board.length) {
      for (var n = 0; n < h.board.length; n++) h.board[n] = normCard(h.board[n]);
    }

    var actions = h.actions || [];
    if (!actions.length) continue;

    // Structured hands (schemaVersion 2): actions are objects, not text. There
    // is nothing to mine - board/pot/outcome/showdown are already populated by
    // the source. Skip the text line-dedup and all board/pot/outcome text
    // mining (calling .replace on an action object would throw). The cheap card
    // normalisation above still ran, and annotateHandDynamics is still called
    // below for every hand.
    var structured = typeof actions[0] === 'object' && actions[0] !== null;
    if (structured) {
      continue;
    }

    // TM script sometimes logs identical lines twice in a row.
    var deduped = [actions[0]];
    for (var d = 1; d < actions.length; d++) {
      if (actions[d].replace(/\s+/g, ' ').trim() !== actions[d - 1].replace(/\s+/g, ' ').trim()) {
        deduped.push(actions[d]);
      }
    }
    h.actions = deduped;
    actions = deduped;

    var needBoard = !h.board || !h.board.length;
    var needPot = !h.pot;
    var needOutcome = !h.outcome;

    // Must extract board cards BEFORE normalizing action strings,
    // because parseCardsFromStreet expects alphabetic suit names.
    var board = [];
    if (needBoard) {
      for (var j = 0; j < actions.length; j++) {
        var raw = (actions[j] || '').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&');
        var line = raw.replace(/^>>\s*/, '').replace(/^\s+/, '').trim();
        if (line.indexOf('The flop') === 0 || line.indexOf('The turn') === 0 || line.indexOf('The river') === 0) {
          var streetCards = parseCardsFromStreet(line);
          for (var k = 0; k < streetCards.length; k++) board.push(streetCards[k]);
        }
      }
    }

    for (var a = 0; a < actions.length; a++) {
      actions[a] = actions[a].replace(/(\d{1,2}|[AKQJT])([a-z]{4,8})/gi, function(_, r, s) {
        var rank = (r === '10') ? 'T' : r;
        var suit = SUIT_WORD[s.toLowerCase()];
        return suit ? rank + suit : r + s;
      });
    }

    if (!needBoard && !needPot && !needOutcome) continue;

    var totalPot = 0;
    var wonAmount = 0;
    var heroWon = false;
    var heroFolded = false;
    var heroLost = false;

    for (var j = 0; j < actions.length; j++) {
      var raw = (actions[j] || '').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&');
      var isMe = raw.indexOf('>>') === 0;
      var line = raw.replace(/^>>\s*/, '').replace(/^\s+/, '').trim();

      if (needPot) {
        var wonMatch = line.match(/won \$([0-9,]+)/);
        if (wonMatch) {
          var amt = parseAmount(wonMatch[1]);
          if (amt > totalPot) totalPot = amt;
          if (isMe) { heroWon = true; wonAmount = amt; }
        }
      }

      if (needOutcome && isMe) {
        if (line.indexOf('folded') !== -1) heroFolded = true;
        if (line.match(/won \$([0-9,]+)/)) { heroWon = true; wonAmount = parseAmount(line.match(/\$([0-9,]+)/)[1]); }
        if (line.indexOf('lost') !== -1) heroLost = true;
      }
    }

    if (needBoard && board.length) {
      h.board = board;
    }

    if (needPot && totalPot > 0) {
      h.pot = totalPot;
    }

    if (needOutcome && (heroWon || heroFolded || heroLost)) {
      if (heroWon) {
        h.outcome = { result: 'won', amount: wonAmount };
      } else if (heroFolded) {
        h.outcome = { result: 'folded' };
      } else if (heroLost) {
        h.outcome = { result: 'lost' };
      }
    }
  }

  for (var ii = 0; ii < hands.length; ii++) {
    annotateHandDynamics(hands[ii]);
  }
}

// One explicit pass to warm the per-hand caches that lots of helpers lazily fill.
// Without this, the first analyse() call pays the parse cost for all hands at
// once on the main thread (~500ms for 20k hands).
function preparseHands(hands) {
  for (var i = 0; i < hands.length; i++) {
    var h = hands[i];
    if (h && h.actions) parseActions(h.actions);
    if (h && h.hole) parseHoleKey(h.hole);
    if (h) classifyPreflopAction(h);
    if (h) isShowdown(h);
  }
}

// Attach seats / active-per-street / effStackBB + bucket tags to a hand.
// Idempotent - safe to call multiple times.
function annotateHandDynamics(hand) {
  if (hand._dyn) return hand; // already annotated this session

  var seats = countHandPlayers(hand);
  var active = countActivePerStreet(hand);
  var effBB = estimateEffStackBB(hand);

  hand.seats = seats;
  hand.active = active;
  hand.effStackBB = effBB;
  hand.seatBucket = seatBucket(seats);
  hand.flopBucket = flopBucket(active.flop);
  hand.stackBucket = stackBandKey(effBB);
  hand._dyn = true;
  return hand;
}

