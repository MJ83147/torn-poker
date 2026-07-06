function isStrongShowdownHand(strength) {
  if (!strength) return false;
  var s = String(strength).toLowerCase();
  return (
    s.indexOf("two pair") !== -1 ||
    s.indexOf("three of a kind") !== -1 ||
    s.indexOf("straight") !== -1 ||
    s.indexOf("flush") !== -1 ||
    s.indexOf("full house") !== -1 ||
    s.indexOf("four of a kind") !== -1
  );
}

function getInvested(h) {
  if (!h) return 0;
  // Structured (v2) hands always carry a numeric `invested` (0 is valid for a fold).
  return typeof h.invested === "number" ? h.invested : 0;
}

function getHeroActions(h) {
  return parseActions(h.actions).filter(function (a) {
    return a.isMe;
  });
}

function getActsSummary(h) {
  return getHeroActions(h)
    .map(function (a) {
      return a.type;
    })
    .join(" · ");
}

function getHandPnl(h) {
  if (!h.outcome) return { cls: "c-muted", text: "?" };
  var invested = getInvested(h);
  var bb = getHandBB(h);
  // Honours the $/BB toggle: amounts show in this hand's big blinds when on.
  function money(v) {
    return (_displayBB && bb > 0) ? fmtBBRaw(v / bb) : fmt(v);
  }
  if (h.outcome.result === "won") {
    var profit = (h.outcome.amount || 0) - invested;
    if (profit >= 0) return { cls: "c-pos", text: "+" + money(profit) };
    return { cls: "c-neg", text: "-" + money(Math.abs(profit)) };
  }
  if (h.outcome.result === "folded") {
    return { cls: "c-neg", text: invested > 0 ? "-" + money(invested) : "folded" };
  }
  return { cls: "c-neg", text: "-" + money(invested) };
}

function getHandPnlValue(h) {
  if (!h.outcome) return 0;
  var invested = getInvested(h);
  if (h.outcome.result === "won") return (h.outcome.amount || 0) - invested;
  return -invested;
}

function inferTable(hand) {
  if (hand.tableId) {
    const num = String(hand.tableId).replace(/\D/g, "");
    if (num && TABLE_META[num]) return Number(num);
  }
  if (hand.table) {
    const num = String(hand.table).replace(/\D/g, "");
    if (num && TABLE_META[num]) return Number(num);
  }
  if (hand.bigBlind) {
    const candidates = BB_TO_TABLES[hand.bigBlind];
    if (candidates && candidates.length === 1) return candidates[0].id;
    if (candidates && candidates.length > 1 && hand.tableSize) {
      const match = candidates.find((c) => c.max >= hand.tableSize);
      if (match) return match.id;
    }
  }
  if (hand.actions && hand.actions.length) {
    let bb = 0;
    const players = new Set();
    for (let i = 0; i < hand.actions.length; i++) {
      const line = hand.actions[i];
      if (!line || typeof line !== "object") continue;
      if (line.type === "bb" && line.amount) bb = line.amount;
      if (line.author) players.add(line.author);
    }
    if (bb && BB_TO_TABLES[bb]) {
      const candidates = BB_TO_TABLES[bb];
      if (candidates.length === 1) return candidates[0].id;
      const playerCount = players.size;
      const sorted = candidates.slice().sort((a, b) => a.max - b.max);
      const match = sorted.find((c) => c.max >= playerCount);
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
  if (!tableId || !TABLE_META[tableId]) return "Unknown Table";
  const t = TABLE_META[tableId];
  const prefix = t.tournament ? "T: " : "";
  return prefix + t.name + " (" + fmt(t.sb) + "/" + fmt(t.bb) + ")";
}

function getPositionCategory(position) {
  if (!position) return null;
  var p = position.toUpperCase().replace(/[^A-Z0-9+]/g, "");
  if (p === "UTG" || p === "UTG+1") return "EP";
  if (p === "MP" || p === "LJ") return "MP";
  if (p === "HJ" || p === "CO" || p === "BTN") return "LP";
  if (p === "SB" || p === "BB") return "Blinds";
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
  var acts = parseActions(h.actions).filter(function (a) {
    return a.street === "Preflop";
  });
  if (!acts.length) return null;
  var heroAuthor = null;
  for (var i = 0; i < acts.length; i++) {
    if (acts[i].isMe) {
      heroAuthor = acts[i].author;
      break;
    }
  }
  var firstHero = null;
  for (var i = 0; i < acts.length; i++) {
    var a = acts[i];
    if (!a.isMe) continue;
    if (a.type === "sb" || a.type === "bb" || a.type === "won") continue;
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
      if (a.type === "raise" || a.type === "bet") raisesBefore++;
      else if (a.type === "call") callsBefore++;
    }
  }
  if (!firstHero) {
    var heroIsBB = acts.some(function (a) {
      return a.isMe && a.type === "bb";
    });
    var heroFolded = acts.some(function (a) {
      return a.isMe && a.type === "fold";
    });
    if (heroIsBB && !heroFolded && raisesBefore === 0) return "walked";
    return "folded-pre";
  }
  if (firstHero.type === "fold") return "folded-pre";
  if (raisesBefore === 0 && (firstHero.type === "raise" || firstHero.type === "bet")) {
    var sawThreeBet = false;
    var heroResponse = null;
    var heroOwn3betCount = 0;
    var startedAfter = false;
    for (var i = 0; i < acts.length; i++) {
      var a = acts[i];
      if (a === firstHero) {
        startedAfter = true;
        continue;
      }
      if (!startedAfter) continue;
      if (!a.isMe && (a.type === "raise" || a.type === "bet")) sawThreeBet = true;
      if (sawThreeBet && a.isMe) {
        if (a.type === "fold") {
          heroResponse = "fold";
          break;
        }
        if (a.type === "call") {
          heroResponse = "call";
          break;
        }
        if (a.type === "raise" || a.type === "bet") {
          heroResponse = "4bet";
          break;
        }
      }
    }
    if (sawThreeBet) {
      if (heroResponse === "fold") return "rfi-vs-3bet-fold";
      if (heroResponse === "call") return "rfi-vs-3bet-call";
      if (heroResponse === "4bet") return "rfi-vs-3bet-4bet";
      return "rfi-vs-3bet-fold";
    }
    return "rfi";
  }
  if (raisesBefore >= 1) {
    if (firstHero.type === "raise" || firstHero.type === "bet") {
      if (callsBefore >= 1) return "squeeze";
      return "vs-rfi-3bet";
    }
    if (firstHero.type === "call") return "vs-rfi-call";
    return "folded-pre";
  }
  if (firstHero.type === "call") {
    return callsBefore >= 1 ? "limp-behind" : "limp-open";
  }
  return null;
}

function detectPlayerFromActions(hands) {
  for (let i = 0; i < hands.length; i++) {
    if (hands[i].player && hands[i].player !== "Unknown") {
      return hands[i].player;
    }
  }
  const nameCounts = {};
  for (let i = 0; i < hands.length; i++) {
    const actions = hands[i].actions || [];
    for (let j = 0; j < actions.length; j++) {
      const line = actions[j];
      // Structured (v2) actions are objects: the hero is the `isMe` author.
      if (line && typeof line === "object" && line.isMe && line.author) {
        nameCounts[line.author] = (nameCounts[line.author] || 0) + 1;
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

// Structured (v2) hands ship board/pot/outcome/showdown already populated, so
// there is nothing to mine from the actions. Normalise the card strings and
// attach the per-hand dynamics tags.
function backfillHandData(hands) {
  for (var i = 0; i < hands.length; i++) {
    var h = hands[i];
    // Normalisation is idempotent, so skip hands already processed this session.
    if (h._bf) continue;
    h._bf = true;

    if (h.hole && h.hole.length) {
      for (var n = 0; n < h.hole.length; n++) h.hole[n] = normCard(h.hole[n]);
    }
    if (h.board && h.board.length) {
      for (var b = 0; b < h.board.length; b++) h.board[b] = normCard(h.board[b]);
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
