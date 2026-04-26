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

  // Second pass: annotate each hand with the three table-dynamics axes.
  for (var ii = 0; ii < hands.length; ii++) {
    annotateHandDynamics(hands[ii]);
  }
}

// Attach seats / active-per-street / effStackBB + bucket tags to a hand.
// Idempotent - safe to call multiple times. Call sites: backfillHandData (on
// import) and analyse() (safety net for hands loaded from storage).
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
  hand.stackBucket = stackBucket(effBB);
  hand._dyn = true;
  return hand;
}

