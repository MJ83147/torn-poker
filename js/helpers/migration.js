// ── DATA MIGRATION & BACKFILL ─────────────────────────────────────────────────

// Backfill missing board, pot, and outcome from action lines.
// Some TC Poker exports omit these structured fields even though the
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

    // Normalize existing hole/board cards (API may send "3hearts" format)
    if (h.hole && h.hole.length) {
      for (var n = 0; n < h.hole.length; n++) h.hole[n] = normCard(h.hole[n]);
    }
    if (h.board && h.board.length) {
      for (var n = 0; n < h.board.length; n++) h.board[n] = normCard(h.board[n]);
    }

    var actions = h.actions || [];
    if (!actions.length) continue;

    // Deduplicate consecutive identical action lines (TM script sometimes logs twice)
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

    // Extract board cards BEFORE normalizing action strings,
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

    // Normalize card names in action strings: "10spades" → "T♠"
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

      // Track pot from all dollar amounts in betting actions
      if (needPot) {
        var wonMatch = line.match(/won \$([0-9,]+)/);
        if (wonMatch) {
          var amt = parseInt(wonMatch[1].replace(/,/g, ''), 10);
          if (amt > totalPot) totalPot = amt;
          if (isMe) { heroWon = true; wonAmount = amt; }
        }
      }

      // Track hero outcome
      if (needOutcome && isMe) {
        if (line.indexOf('folded') !== -1) heroFolded = true;
        if (line.match(/won \$([0-9,]+)/)) { heroWon = true; wonAmount = parseInt(line.match(/\$([0-9,]+)/)[1].replace(/,/g, ''), 10); }
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
}

// Fix positions assigned by the old fixed-array lookup that didn't
// account for table size. Uses tableSize (or player count from actions
// as fallback) to detect invalid positions and remap them.
function migratePositions(hands) {
  var posMap = {
    2: ['BTN','BB'],
    3: ['BTN','SB','BB'],
    4: ['BTN','SB','BB','CO'],
    5: ['BTN','SB','BB','UTG','CO'],
    6: ['BTN','SB','BB','UTG','HJ','CO'],
    7: ['BTN','SB','BB','UTG','MP','HJ','CO'],
    8: ['BTN','SB','BB','UTG','UTG+1','MP','HJ','CO'],
    9: ['BTN','SB','BB','UTG','UTG+1','MP','LJ','HJ','CO'],
  };
  // The old TM script used this fixed array for all table sizes
  var OLD_POSITIONS = ['BTN','SB','BB','UTG','UTG+1','MP','HJ','CO','LJ'];

  var stats = { total: hands.length, noPos: 0, noTs: 0, alreadyValid: 0, remapped: 0, cantRemap: 0 };
  var remapLog = [];

  for (var i = 0; i < hands.length; i++) {
    var h = hands[i];
    var pos = h.position;
    if (!pos) { stats.noPos++; continue; }

    // Determine table size: use tableSize field, or count players from actions
    var ts = h.tableSize;
    var tsSource = ts ? 'field' : 'none';
    if (!ts && h.actions && h.actions.length) {
      var seen = {};
      var count = 0;
      for (var j = 0; j < h.actions.length; j++) {
        var line = h.actions[j].replace(/^(>>|&gt;&gt;)\s*/, '').replace(/^\s+/, '').trim();
        var ci = line.indexOf(': ');
        if (ci === -1) continue;
        var author = line.slice(0, ci);
        if (author === 'Game' || author === 'The preflop' || author === 'The flop' || author === 'The turn' || author === 'The river') continue;
        if (!seen[author]) { seen[author] = true; count++; }
      }
      if (count >= 2 && count <= 9) { ts = count; tsSource = 'actions(' + count + ')'; }
    }

    if (!ts || !posMap[ts]) { stats.noTs++; continue; }

    // Already valid for this table size — skip
    if (posMap[ts].indexOf(pos) >= 0) { stats.alreadyValid++; continue; }

    // Invalid position — remap using old array index
    var oldRel = OLD_POSITIONS.indexOf(pos);
    if (oldRel >= 0 && oldRel < ts) {
      var newPos = posMap[ts][oldRel] || pos;
      if (remapLog.length < 20) {
        remapLog.push(pos + ' → ' + newPos + ' (ts=' + ts + ', src=' + tsSource + ')');
      }
      h.position = newPos;
      stats.remapped++;
    } else {
      stats.cantRemap++;
      if (stats.cantRemap <= 5) {
        console.log('[migratePositions] cant remap: pos=' + pos + ' oldRel=' + oldRel + ' ts=' + ts);
      }
    }
  }

  console.log('[migratePositions] ' + JSON.stringify(stats));
  if (remapLog.length) console.log('[migratePositions] samples: ' + remapLog.join(', '));

  // Log first 3 hands for debugging data shape
  for (var d = 0; d < Math.min(3, hands.length); d++) {
    var dh = hands[d];
    console.log('[migratePositions] hand[' + d + ']: pos=' + (dh.position||'?') + ' tableSize=' + (dh.tableSize||'?') + ' actionsLen=' + (dh.actions ? dh.actions.length : 0));
  }
}
