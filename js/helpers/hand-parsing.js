// ── HAND PARSING ──────────────────────────────────────────────────────────────

// Parse action log lines into structured events for analysis
function parseActions(actions) {
  if (actions && actions._parsed) return actions._parsed;
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
    const amount = am ? parseInt(am[1].replace(/,/g, '')) : 0;
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

// Check if a raise action is truly all-in.
// Only raises without " to " indicate shoves (e.g. "raised $5,000,000" vs "raised $2,500,000 to $5,000,000").
// Regular bets ("bet $X") are never detectable as all-in from the log format alone.
function isAllInAction(acts, idx) {
  var a = acts[idx];
  if (!a) return false;
  if (a.type !== 'raise' || !a.msg) return false;
  if (a.msg.indexOf(' to ') !== -1) return false;
  return true;
}

// Turn a hole card array into a condensed key like "AKs" or "TT"
function parseHoleKey(hole) {
  if (!hole || hole.length < 2) return null;
  var r1 = hole[0].slice(0, -1);
  var r2 = hole[1].slice(0, -1);
  if (r1 === '10') r1 = 'T';
  if (r2 === '10') r2 = 'T';
  const s1 = hole[0].slice(-1);
  const s2 = hole[1].slice(-1);
  const v1 = RANKS.indexOf(r1);
  const v2 = RANKS.indexOf(r2);
  if (v1 < 0 || v2 < 0) return null;
  const hi = Math.max(v1, v2);
  const lo = Math.min(v1, v2);
  if (hi === lo) return RANKS[hi] + RANKS[hi];
  return RANKS[hi] + RANKS[lo] + (s1 === s2 ? 's' : 'o');
}

// Classify a hole key into a high-level hand type bucket
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

// Count unique players in a hand from action lines
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

// Count players active at the start of each street.
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

  // tableSize fallback: if seats came from tableSize but fewer unique authors were seen,
  // trust the action-log count for activeCount baseline.
  var uniqueAuthors = Object.keys(seenAuthors).length;
  if (!reachedFlop && uniqueAuthors && uniqueAuthors < seats) {
    // nothing to adjust - street counts remain null
  }

  return result;
}

// Estimate effective stack at start of hand, in BB.
// Two regimes:
//   (a) If any all-in action happened, player commitments reflect real stacks -
//       effective stack = min of hero's commit and the largest villain commit.
//   (b) Otherwise, commitments are only a lower bound; if they exceed a meaningful
//       threshold (≥ 20 BB) we treat that as the likely effective stack, else null.
// Returns null when the hand log lacks enough signal to infer depth.
function estimateEffStackBB(hand) {
  var bb = (typeof getHandBB === 'function') ? getHandBB(hand) : null;
  if (!bb || bb <= 0) bb = hand.bigBlind || null;
  if (!bb || bb <= 0) return null;

  // Prefer explicit start-stack metadata if the tracker provides it.
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

    // For "raised X to Y", amount is Y (the new total); otherwise it's the delta.
    if (a.type === 'raise' && a.msg && a.msg.indexOf(' to ') !== -1) {
      var m = a.msg.match(/to \$?([0-9,]+)/);
      if (m) {
        var total = parseInt(m[1].replace(/,/g, ''), 10);
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

  // Effective stack is bounded below by min(hero, biggest villain commitment).
  var effFloor = Math.min(heroCommit, villainMax);

  // When no all-in occurred, commitments are only a lower bound. We only report
  // depth if the floor crosses ~20 BB - below that the hand is ambiguous.
  if (!sawAllIn && effFloor < bb * 20) return null;

  return Math.round((effFloor / bb) * 10) / 10;
}

// Calculate how much the player invested in a hand from the action log
function calcInvestmentFromActions(actions) {
  let total = 0;
  for (let i = 0; i < actions.length; i++) {
    let line = (actions[i] || '').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&');
    if (line.indexOf('>>') !== 0) continue;
    if (line.indexOf(' won ') !== -1) continue;
    if (line.indexOf(' reveals ') !== -1) continue;
    if (line.indexOf('folded') !== -1) continue;
    if (line.indexOf('checked') !== -1) continue;
    const dm = line.match(/\$([0-9,]+)/);
    if (dm) total += parseInt(dm[1].replace(/,/g, ''), 10);
  }
  return total;
}

// Determine if a hand went to showdown
function isShowdown(hand) {
  if (!hand.outcome) return false;
  // Lost = stayed in and lost at showdown
  if (hand.outcome.result === 'lost') return true;
  // Won with reveals = showdown win
  if (hand.outcome.result === 'won') {
    var actions = hand.actions || [];
    for (var i = 0; i < actions.length; i++) {
      if (actions[i].indexOf(' reveals ') !== -1) return true;
    }
  }
  return false;
}
