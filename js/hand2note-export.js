// Hand2Note export: converts stored TC Poker hands into PokerStars-format hand
// history text. Hand2Note has no bespoke import format of its own; it natively
// parses the PokerStars text format, which is the de-facto standard every
// third-party converter emits. So "export for Hand2Note" means "emit valid
// PokerStars hand histories".
//
// Money is kept in raw Torn values (a big blind of 250000 stays 250000). A
// uniform scale-down would be prettier but risks fractional chips, and any
// PER-HAND rescale would corrupt Hand2Note's cross-hand winnings graph, so the
// honest, lossless choice is to pass Torn chips straight through. Hand2Note's
// HUD stats are ratio-based off the blind level in each header, so the absolute
// magnitude does not affect them.
//
// This file is intentionally self-contained (it reads hand fields directly and
// does not lean on the app's analysis helpers) so it can be unit-tested under
// Node and so the export path has no hidden coupling to panel state.

(function (root) {
  // Physical clockwise seating starting from the seat left of the button (the
  // small blind) and ending at the button. This is POSITION_ORDER with the two
  // blinds moved to the front. Seat numbers are assigned 1..N along this order,
  // which puts the button at the highest seat and the SB at seat 1 (the seat
  // immediately clockwise from the button), exactly as PokerStars numbers them.
  var CLOCKWISE = ['SB', 'BB', 'UTG', 'UTG+1', 'MP', 'LJ', 'HJ', 'CO', 'BTN'];

  function h2nCard(c) {
    if (!c) return '';
    var s = String(c).trim();
    // Torn already stores "4c"/"Th"; normalise a stray "10x" to "Tx" and keep
    // the suit lowercase, which is what the PokerStars format uses.
    s = s.replace(/^10/, 'T');
    var rank = s.slice(0, -1);
    var suit = s.slice(-1).toLowerCase();
    return rank + suit;
  }

  function cardsList(cs) {
    return (cs || []).map(h2nCard).join(' ');
  }

  // Torn money is denominated in dollars, so hands are written in PokerStars
  // real-money USD format ("$" amounts, "USD" in the header). This matters for
  // compatibility as much as accuracy: trackers (PokerTracker 4, Hand2Note) treat
  // real-money hands as first-class in stats, whereas play-money hands are often
  // filtered out or not imported at all. Torn amounts are whole dollars, so we
  // emit plain integers with a "$" prefix (no forced decimals), which is valid
  // PokerStars for whole amounts.
  function m(v) {
    return '$' + (v || 0);
  }

  // PokerStars screen names never contain spaces or colons, and the parser
  // tokenises action lines on ": ", so a name carrying either would break it.
  // Collapse whitespace to underscores and drop colons; leave everything else.
  function h2nName(name) {
    if (name == null || name === '') return 'Unknown';
    return String(name).replace(/\s+/g, '_').replace(/:/g, '');
  }

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  // PokerStars stamps hands as "YYYY/MM/DD HH:MM:SS ET". The zone label is
  // cosmetic to Hand2Note (it reads the clock for ordering), so UTC with an ET
  // tag is fine and keeps every user's export deterministic.
  function fmtStamp(ts) {
    var d = new Date(ts || 0);
    return d.getUTCFullYear() + '/' + pad2(d.getUTCMonth() + 1) + '/' + pad2(d.getUTCDate()) +
      ' ' + pad2(d.getUTCHours()) + ':' + pad2(d.getUTCMinutes()) + ':' + pad2(d.getUTCSeconds()) + ' ET';
  }

  // Order players into physical seats and work out the button seat number.
  // Returns { seats:[{seat,player}], btnSeat } or null when the hand has no
  // usable player list.
  function seatPlayers(hand) {
    var stacks = (hand && hand.stacks) || [];
    if (!stacks.length) return null;

    var byPos = {};
    var extras = []; // players with no/unknown position get appended at the end
    for (var i = 0; i < stacks.length; i++) {
      var p = stacks[i];
      if (!p) continue;
      var pos = p.position && CLOCKWISE.indexOf(p.position) !== -1 ? p.position : null;
      if (pos && !byPos[pos]) byPos[pos] = p; else extras.push(p);
    }

    var ordered = [];
    for (var c = 0; c < CLOCKWISE.length; c++) {
      if (byPos[CLOCKWISE[c]]) ordered.push(byPos[CLOCKWISE[c]]);
    }
    ordered = ordered.concat(extras);

    var seats = [];
    var btnSeat = null;
    for (var s = 0; s < ordered.length; s++) {
      var seatNo = s + 1;
      seats.push({ seat: seatNo, player: ordered[s] });
      if (ordered[s].isDealer || ordered[s].position === 'BTN') btnSeat = seatNo;
    }

    // No explicit button (heads-up, where the small blind acts as the button, or
    // a data gap): fall back to the small blind's seat, then to seat 1.
    if (btnSeat == null) {
      for (var k = 0; k < seats.length; k++) {
        var pl = seats[k].player;
        if (pl.isSmallBlind || pl.position === 'SB') { btnSeat = seats[k].seat; break; }
      }
    }
    if (btnSeat == null && seats.length) btnSeat = seats[seats.length - 1].seat;

    return { seats: seats, btnSeat: btnSeat };
  }

  function findAction(actions, type) {
    for (var i = 0; i < actions.length; i++) {
      if (actions[i] && actions[i].type === type) return actions[i];
    }
    return null;
  }

  var STREETS = ['Preflop', 'Flop', 'Turn', 'River'];

  // Convert a single hand to a PokerStars hand-history block. Returns null when
  // the hand cannot be represented (no stacks). `id` is the unique hand number.
  function handToPokerStars(hand, id) {
    if (!hand) return null;
    var seated = seatPlayers(hand);
    if (!seated) return null;

    var actions = (hand.actions || []).filter(function (a) { return a && a.type; });
    var board = (hand.board || []).map(h2nCard);
    var bb = hand.bigBlind || 0;
    var sbAct = findAction(actions, 'sb');
    var bbAct = findAction(actions, 'bb');
    var sbAmt = sbAct ? sbAct.amount : Math.floor(bb / 2);
    var bbAmt = bbAct ? bbAct.amount : bb;

    // Hero identity for the "Dealt to" line.
    var hero = null;
    for (var hs = 0; hs < seated.seats.length; hs++) {
      if (seated.seats[hs].player.isHero) { hero = seated.seats[hs].player; break; }
    }

    var L = [];
    // Never fewer than the seats we actually list: Torn's tableSize can trail the
    // true player count when players join or leave around the hand, and a header
    // that claims fewer seats than are printed makes the history unparseable.
    var maxSeats = Math.max(hand.tableSize || 0, seated.seats.length);

    L.push("PokerStars Hand #" + id + ":  Hold'em No Limit (" + m(sbAmt) + "/" + m(bbAmt) + " USD) - " + fmtStamp(hand.timestamp));
    L.push("Table '" + (hand.table || ('Table ' + (hand.tableId != null ? hand.tableId : '?'))) +
      "' " + maxSeats + "-max Seat #" + seated.btnSeat + " is the button");

    for (var si = 0; si < seated.seats.length; si++) {
      var sp = seated.seats[si];
      L.push("Seat " + sp.seat + ": " + h2nName(sp.player.name) +
        " (" + m(sp.player.startStack || 0) + " in chips)");
    }

    // Blind posts sit above HOLE CARDS and are not part of the preflop action
    // stream. Use the actual sb/bb action authors when present, else the seat
    // flags, so the poster names always match the seat list.
    var sbName = sbAct ? sbAct.author : blindName(seated, 'sb');
    var bbName = bbAct ? bbAct.author : blindName(seated, 'bb');
    if (sbName) L.push(h2nName(sbName) + ": posts small blind " + m(sbAmt));
    if (bbName) L.push(h2nName(bbName) + ": posts big blind " + m(bbAmt));

    // Dead-blind posters who then just fold leave no action carrying their
    // chips: a late joiner posts to be dealt in, folds preflop, and Torn records
    // only the fold. Detect them as non-blind players whose sole involvement is
    // folding yet who still have chips invested, and post that as a dead blind so
    // the pot and the winner's collection stay whole. (Post-then-call joiners are
    // already handled inside emitStreet by the shortfall check.)
    var deadSeed = {};
    for (var dp = 0; dp < seated.seats.length; dp++) {
      var dpl = seated.seats[dp].player;
      if (!dpl || !dpl.name) continue;
      if (dpl.name === sbName || dpl.name === bbName) continue;
      if (dpl.isSmallBlind || dpl.isBigBlind || dpl.position === 'SB' || dpl.position === 'BB') continue;
      var voluntary = false;
      for (var ai = 0; ai < actions.length; ai++) {
        if (actions[ai].author === dpl.name && actions[ai].type !== 'fold') { voluntary = true; break; }
      }
      if (!voluntary && (dpl.invested || 0) > 0) {
        deadSeed[dpl.name] = dpl.invested;
        L.push(h2nName(dpl.name) + ": posts big blind " + m(dpl.invested));
      }
    }

    L.push("*** HOLE CARDS ***");
    if (hero && hand.hole && hand.hole.length >= 2) {
      L.push("Dealt to " + h2nName(hero.name) + " [" + cardsList(hand.hole.slice(0, 2)) + "]");
    }

    // Emit each street: header (with the board revealed on that street) followed
    // by its action lines, plus a trailing uncalled-bet return when the round
    // closed on an uncalled wager. Refunds are collected here (keyed by raw name)
    // so the winner's collection and the pot total can be reported net, matching
    // the returned action lines.
    var refunds = {};
    var netPot = 0;
    for (var st = 0; st < STREETS.length; st++) {
      var street = STREETS[st];
      var streetActs = actions.filter(function (a) {
        return a.street === street && a.type !== 'sb' && a.type !== 'bb' && a.type !== 'won';
      });

      if (street === 'Flop') {
        if (board.length < 3) break;
        L.push("*** FLOP *** [" + board.slice(0, 3).join(' ') + "]");
      } else if (street === 'Turn') {
        if (board.length < 4) break;
        L.push("*** TURN *** [" + board.slice(0, 3).join(' ') + "] [" + board[3] + "]");
      } else if (street === 'River') {
        if (board.length < 5) break;
        L.push("*** RIVER *** [" + board.slice(0, 4).join(' ') + "] [" + board[4] + "]");
      }

      // Preflop the blinds are already on the table, so seed them as committed
      // chips at the big-blind level; this lets walks and folded-blind pots emit
      // the correct uncalled-bet refund. Postflop everyone starts at zero.
      var seed = null, startLevel = 0;
      if (street === 'Preflop') {
        seed = {};
        if (sbName) seed[sbName] = sbAmt;
        if (bbName) seed[bbName] = bbAmt;
        for (var ds in deadSeed) {
          if (Object.prototype.hasOwnProperty.call(deadSeed, ds)) seed[ds] = deadSeed[ds];
        }
        // The opening bet level is the largest forced post, not simply the big
        // blind: Torn occasionally records an oversized blind (a straddle-like
        // post) where the small blind seat commits more than the big blind.
        for (var sv in seed) {
          if (Object.prototype.hasOwnProperty.call(seed, sv) && seed[sv] > startLevel) startLevel = seed[sv];
        }
      }
      var res = emitStreet(L, streetActs, startLevel, seed);
      if (res.refund) refunds[res.refund.name] = (refunds[res.refund.name] || 0) + res.refund.amount;
      netPot += res.net;
    }

    // Showdown: reveals then the winners' collection lines.
    var reveals = getReveals(hand);
    var winners = getWinners(hand);
    if (reveals.length) {
      L.push("*** SHOW DOWN ***");
      for (var r = 0; r < reveals.length; r++) {
        var rv = reveals[r];
        L.push(h2nName(rv.name) + ": shows [" + cardsList(rv.hole) + "]" +
          (rv.handName ? " (" + rv.handName + ")" : ""));
      }
    }
    // Torn accounts pots gross: an uncalled bet stays in the pot and its bettor
    // "wins" it back, so stacks[].winnings bundles the returned chips together
    // with the real collection. PokerStars accounts net: the uncalled bet is
    // returned first, then the (smaller) pot is collected. The pot and the
    // collection are therefore taken from netPot (the chips the action lines
    // actually leave in the pot), split across the winners by their net winnings
    // (gross winnings minus any uncalled refund). Deriving both from the same
    // netPot guarantees the action lines, the collected lines, and the pot total
    // always reconcile, even on the handful of hands whose Torn totals are
    // internally inconsistent.
    var weights = {}, weightSum = 0;
    for (var wi = 0; wi < winners.length; wi++) {
      var wnm = winners[wi].name;
      var wgt = winners[wi].winnings - (refunds[wnm] || 0);
      if (wgt > 0) { weights[wnm] = wgt; weightSum += wgt; }
    }
    var netWon = distributePot(netPot, winners, weights, weightSum);
    for (var w = 0; w < winners.length; w++) {
      var col = netWon[winners[w].name] || 0;
      if (col > 0) L.push(h2nName(winners[w].name) + " collected " + m(col) + " from pot");
    }

    // Summary.
    L.push("*** SUMMARY ***");
    L.push("Total pot " + m(netPot) + " | Rake " + m(0));
    if (board.length) L.push("Board [" + board.join(' ') + "]");
    var foldStreet = foldStreets(actions);
    for (var sm = 0; sm < seated.seats.length; sm++) {
      L.push(summaryLine(seated.seats[sm], foldStreet, netWon));
    }

    return L.join('\n');
  }

  function blindName(seated, which) {
    var flag = which === 'sb' ? 'isSmallBlind' : 'isBigBlind';
    var pos = which === 'sb' ? 'SB' : 'BB';
    for (var i = 0; i < seated.seats.length; i++) {
      var p = seated.seats[i].player;
      if (p[flag] || p.position === pos) return p.name;
    }
    return null;
  }

  // Append one street's action lines to L, tracking the running bet level so
  // raises print as "raises X to Y" (X = increase over the prior level) and so a
  // closing uncalled wager is refunded. `startLevel` is the bet already on the
  // table entering the street (the big blind preflop, 0 postflop).
  function emitStreet(L, acts, startLevel, seed) {
    var level = startLevel;          // highest single-player wager this street
    var contrib = {};                // player -> chips committed this street
    if (seed) {
      for (var sk in seed) {
        if (Object.prototype.hasOwnProperty.call(seed, sk)) contrib[sk] = seed[sk];
      }
    }
    for (var i = 0; i < acts.length; i++) {
      var a = acts[i];
      var who = h2nName(a.author);
      var allin = a.allIn ? " and is all-in" : "";
      switch (a.type) {
        case 'fold':
          L.push(who + ": folds");
          break;
        case 'check':
          // A player can only check preflop once they have matched the current
          // bet. If our tally has them short of the level, a dead blind was
          // posted that Torn logged only as a check (a late joiner posting in).
          // Emit that post so the chips are accounted for.
          if (level > 0 && (contrib[a.author] || 0) < level) {
            var shortfall = level - (contrib[a.author] || 0);
            contrib[a.author] = level;
            L.push(who + ": posts big blind " + m(shortfall));
          }
          L.push(who + ": checks");
          break;
        case 'call':
          var priorC = contrib[a.author] || 0;
          var amtC = a.amount || 0;
          // A zero-chip "call" facing a bet is not a real action: the player is
          // already all-in (Torn does not always tag the shove that put them
          // there) and cannot match the wager. Skip it; the uncalled portion of
          // the bet is returned at street end by the refund logic.
          if (amtC <= 0) break;
          // A non-all-in call that still leaves the player short of the level
          // means an unlogged dead blind was posted before it (a late joiner).
          if (!a.allIn && level > 0 && priorC + amtC < level) {
            var postC = level - priorC - amtC;
            priorC += postC;
            contrib[a.author] = priorC;
            L.push(who + ": posts big blind " + m(postC));
          }
          contrib[a.author] = priorC + amtC;
          L.push(who + ": calls " + m(amtC) + allin);
          break;
        case 'bet':
          contrib[a.author] = (contrib[a.author] || 0) + (a.amount || 0);
          if (a.amount > level) level = a.amount;
          L.push(who + ": bets " + m(a.amount || 0) + allin);
          break;
        case 'raise':
          var already = contrib[a.author] || 0;
          // raiseTo is the player's total street wager; when it is missing,
          // reconstruct it from the chips added this action.
          var to = (typeof a.raiseTo === 'number' && a.raiseTo) ? a.raiseTo : already + (a.amount || 0);
          if (to > level) {
            contrib[a.author] = to;
            if (level === 0) {
              // Opening wager on the street (Torn sometimes types an unopened
              // all-in as a "raise"): in PokerStars that is a bet, not a raise.
              level = to;
              L.push(who + ": bets " + m(to) + allin);
            } else {
              var by = to - level;
              level = to;
              L.push(who + ": raises " + m(by) + " to " + m(to) + allin);
            }
          } else {
            // Torn labels a short all-in (a shove that does not reach the current
            // bet) as a "raise". In PokerStars that is a call for less, all-in.
            var add = to - already;
            if (add < 0) add = a.amount || 0;
            contrib[a.author] = already + add;
            L.push(who + ": calls " + m(add) + allin);
          }
          break;
        default:
          break;
      }
    }

    // Uncalled-bet refund: if one player's committed total this street exceeds
    // everyone else's, the excess was never matched and is returned. This covers
    // both "everyone folds to a bet" and "a shove was only partially called".
    var top = null, topName = null, second = 0, tie = false, gross = 0;
    for (var name in contrib) {
      if (!Object.prototype.hasOwnProperty.call(contrib, name)) continue;
      var v = contrib[name];
      gross += v;
      if (top == null || v > top) { second = top == null ? 0 : top; top = v; topName = name; tie = false; }
      else if (v === top) { tie = true; }
      else if (v > second) { second = v; }
    }
    var refund = null;
    if (top != null && !tie && top > second) {
      refund = { name: topName, amount: top - second };
      L.push("Uncalled bet (" + m(refund.amount) + ") returned to " + h2nName(topName));
    }
    // net = chips this street leaves in the pot (gross committed minus refund).
    return { refund: refund, net: gross - (refund ? refund.amount : 0) };
  }

  // Split netPot across winners in proportion to their weights, as integers that
  // sum to exactly netPot (any rounding remainder goes to the largest weight).
  // Returns a name -> collected map. Single-winner hands (the overwhelming
  // majority) just hand the whole pot to that winner.
  function distributePot(netPot, winners, weights, weightSum) {
    var out = {};
    if (netPot <= 0) return out;
    var names = [];
    for (var i = 0; i < winners.length; i++) {
      if (weights[winners[i].name] > 0 && names.indexOf(winners[i].name) === -1) names.push(winners[i].name);
    }
    if (!names.length) {
      // No positive-weight winner (inconsistent source data): give it to whoever
      // Torn marked as a winner first, else drop it.
      if (winners.length) out[winners[0].name] = netPot;
      return out;
    }
    if (names.length === 1) { out[names[0]] = netPot; return out; }
    var assigned = 0, bestName = names[0], bestW = -1;
    for (var n = 0; n < names.length; n++) {
      var share = Math.floor(netPot * weights[names[n]] / weightSum);
      out[names[n]] = share;
      assigned += share;
      if (weights[names[n]] > bestW) { bestW = weights[names[n]]; bestName = names[n]; }
    }
    out[bestName] += netPot - assigned; // remainder to the largest share
    return out;
  }

  // Players who revealed cards, hero first for readability.
  function getReveals(hand) {
    var out = [];
    var stacks = (hand && hand.stacks) || [];
    for (var i = 0; i < stacks.length; i++) {
      var s = stacks[i];
      if (s && s.revealed && s.revealed.length >= 2) {
        out.push({ name: s.name, isHero: !!s.isHero, hole: s.revealed.slice(0, 2), handName: s.handName || '' });
      }
    }
    out.sort(function (a, b) { return (b.isHero ? 1 : 0) - (a.isHero ? 1 : 0); });
    return out;
  }

  function getWinners(hand) {
    var out = [];
    var stacks = (hand && hand.stacks) || [];
    for (var i = 0; i < stacks.length; i++) {
      var s = stacks[i];
      if (s && (s.winnings || 0) > 0) {
        out.push({ name: s.name, winnings: s.winnings, isHero: !!s.isHero });
      }
    }
    return out;
  }

  // Map each player name to the street they folded on (null = never folded).
  function foldStreets(actions) {
    var map = {};
    for (var i = 0; i < actions.length; i++) {
      var a = actions[i];
      if (a.type === 'fold' && map[a.author] == null) map[a.author] = a.street || 'Preflop';
    }
    return map;
  }

  var FOLD_TEXT = {
    'Preflop': 'folded before Flop',
    'Flop': 'folded on the Flop',
    'Turn': 'folded on the Turn',
    'River': 'folded on the River'
  };

  function seatLabel(player) {
    if (player.isDealer || player.position === 'BTN') return ' (button)';
    if (player.isSmallBlind || player.position === 'SB') return ' (small blind)';
    if (player.isBigBlind || player.position === 'BB') return ' (big blind)';
    return '';
  }

  function summaryLine(seat, foldStreet, netWon) {
    var p = seat.player;
    var base = "Seat " + seat.seat + ": " + h2nName(p.name) + seatLabel(p);
    var won = netWon[p.name] || 0;
    var showed = p.revealed && p.revealed.length >= 2;
    var handName = p.handName && p.handName !== 'Folded' ? p.handName : '';

    if (won > 0) {
      if (showed) {
        return base + " showed [" + cardsList(p.revealed.slice(0, 2)) + "] and won (" + m(won) + ")" +
          (handName ? " with " + handName : "");
      }
      return base + " collected (" + m(won) + ")";
    }
    if (showed) {
      return base + " showed [" + cardsList(p.revealed.slice(0, 2)) + "] and lost" +
        (handName ? " with " + handName : "");
    }
    var fs = foldStreet[p.name];
    if (fs) return base + " " + (FOLD_TEXT[fs] || 'folded');
    return base + " mucked";
  }

  // A hand belongs to a tournament table. Tournament hands are left out of the
  // export: their escalating blinds and non-monetary chips cannot be written
  // faithfully in the cash-game PokerStars format, and importing them as cash
  // would corrupt Hand2Note's cash-game stats. TABLE_META is the app's table
  // registry; when it is unavailable (standalone use) nothing is treated as a
  // tournament.
  function isTournamentHand(hand) {
    if (!hand) return false;
    var meta = (typeof TABLE_META !== 'undefined') ? TABLE_META : null;
    if (!meta) return false;
    var tid = hand.tableId;
    return !!(tid != null && meta[tid] && meta[tid].tournament);
  }

  // Convert an array of hands to a full PokerStars-format text file. Tournament
  // hands and otherwise unusable hands are skipped. Hand numbers are made unique
  // across the file. Returns { text, exported, skippedTournament }.
  function exportHands(hands) {
    var blocks = [];
    var used = {};
    var skippedTournament = 0;
    for (var i = 0; i < (hands || []).length; i++) {
      var h = hands[i];
      if (isTournamentHand(h)) { skippedTournament++; continue; }
      var id = (h && h.timestamp) || (i + 1);
      while (used[id]) id++;
      used[id] = true;
      var block = handToPokerStars(h, id);
      if (block) blocks.push(block);
    }
    // A blank line between hands is what the PokerStars format uses as the
    // record separator, and what Hand2Note splits on.
    return { text: blocks.join('\n\n\n'), exported: blocks.length, skippedTournament: skippedTournament };
  }

  // Back-compat/simple entry point: just the text.
  function handsToPokerStars(hands) {
    return exportHands(hands).text;
  }

  var api = {
    handToPokerStars: handToPokerStars,
    handsToPokerStars: handsToPokerStars,
    exportHands: exportHands,
    isTournamentHand: isTournamentHand,
    h2nName: h2nName,
    h2nCard: h2nCard
  };

  root.Hand2Note = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
