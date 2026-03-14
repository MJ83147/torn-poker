// ── HELPERS (pure utilities, no app boot) ─────────────────────────────────────

// Ranks in ascending order for hand key parsing/classification
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

// Human-readable tips used in tooltips throughout the UI
const TIPS = {
  // Hand type categories
  'Pocket Pairs': 'Two cards of the same rank (e.g. 9♠ 9♥). Strong preflop, vulnerable to overcards.',
  'Broadway': 'Any two of T, J, Q, K, A. High-card hands that connect on high boards.',
  'Ace-Rag': 'An ace paired with a weak kicker (2 to 9). Looks strong, but often loses to a better ace.',
  'Suited Connectors': 'Consecutive ranks of the same suit (e.g. 7♥ 8♥). Play well as draws.',
  'Suited': 'Same suit, non-connecting. Backdoor flush potential only.',
  'Connectors': 'Consecutive ranks, different suits. Straight draw potential.',
  'Offsuit Trash': 'Non-connected, non-suited weak cards. Fold almost always.',
  // Stats
  'VPIP': 'Voluntarily Put money In Pot. How often you choose to play a hand (calls and raises, not forced blinds).',
  'Win Rate': 'Percentage of hands won out of all hands that reached a result.',
  'Aggression': 'How often you raise vs call. Higher aggression means you are betting and raising more than calling.',
  'Net P&L': 'Net profit and loss. Total money won minus total money invested across all cash game hands.',
  'Avg Pot': 'Average pot size across hands played.',
  'Fold Pre': 'How often you fold before the flop. High fold rates from early position are normal.',
  '3-Bet': 'A re-raise over an opening raise. The "third" bet in a preflop sequence (blinds, open, 3-bet).',
  'All-In': 'Betting all remaining chips on a single action. Forces a showdown if called.',
  'C-Bet': 'Continuation bet. Betting the flop after raising preflop, continuing aggression regardless of whether the flop helped.',
  // Positions
  'BTN': 'Button (Dealer). Best position at the table. Acts last on every street after the flop.',
  'SB': 'Small Blind. Forced half-bet posted before cards are dealt. Acts second-to-last preflop, first post-flop.',
  'BB': 'Big Blind. Forced full bet posted before cards are dealt. Defends the widest range preflop.',
  'UTG': 'Under The Gun. First to act preflop. Worst position, play tight here.',
  'UTG+1': 'One seat after UTG. Still early position with poor information.',
  'MP': 'Middle Position. Moderate positional advantage, can widen range slightly.',
  'HJ': 'Hijack. Two seats before the button. Late-middle position with decent steal opportunity.',
  'CO': 'Cutoff. One seat before the button. Strong stealing position, second best seat.',
  // Streets
  'Preflop': 'The betting round before any community cards are dealt. Each player has only their two hole cards.',
  'Flop': 'The first three community cards dealt face up. This is where hand strength becomes clearer.',
  'Turn': 'The fourth community card. Bets typically double here.',
  'River': 'The fifth and final community card. Last chance to bet or bluff.',
  // Actions
  'Fold': 'Discard your hand and forfeit any chips already in the pot.',
  'Check': 'Pass the action without betting, only available if nobody has bet in the current round.',
  'Call': 'Match the current bet to stay in the hand.',
  'Raise': 'Increase the current bet, forcing others to put in more to continue.',
};

// Table metadata (blind levels, max seats, tournament flag)
const TABLE_META = {
  2:  { name: 'Newbie Corner',   bb: 10,        sb: 5,        max: 9 },
  3:  { name: 'Hobo Holdem',     bb: 25,        sb: 13,       max: 9 },
  4:  { name: '8-bit',           bb: 100,       sb: 50,       max: 5 },
  5:  { name: 'Sprinkles',       bb: 250,       sb: 125,      max: 9 },
  6:  { name: 'Gatling Gun',     bb: 1000,      sb: 500,      max: 9 },
  7:  { name: 'Quickdraw',       bb: 2500,      sb: 1250,     max: 9 },
  8:  { name: 'Tight Knit',      bb: 5000,      sb: 2500,     max: 6 },
  9:  { name: 'Ballsy',          bb: 25000,     sb: 12500,    max: 9 },
  10: { name: 'Pound It',        bb: 250000,    sb: 125000,   max: 9 },
  11: { name: "Old 'n Slow",     bb: 100000,    sb: 50000,    max: 6 },
  12: { name: 'Tripod',          bb: 1000000,   sb: 500000,   max: 3 },
  13: { name: 'Slow Cooker',     bb: 5000000,   sb: 2500000,  max: 9 },
  14: { name: 'Fire Pit',        bb: 25000000,  sb: 12500000, max: 9 },
  15: { name: 'High Rollers',    bb: 10000000,  sb: 5000000,  max: 9 },
  16: { name: 'Oligarch',        bb: 100000000, sb: 50000000, max: 6 },
  17: { name: 'Fourplay',        bb: 100000,    sb: 50000,    max: 4 },
  18: { name: 'Duel at Dawn',    bb: 100000,    sb: 50000,    max: 2 },
  19: { name: 'Juan on Juan',    bb: 5000000,   sb: 2500000,  max: 2 },
  20: { name: 'Boom or Bust',    bb: 50000,     sb: 25000,    max: 9 },
  21: { name: 'Old Folks Home',  bb: 500000,    sb: 250000,   max: 6 },
  22: { name: 'Comatose Cove',   bb: 1000000,   sb: 500000,   max: 6 },
  23: { name: 'Periodic',        bb: 100000,    sb: 50000,    max: 9 },
  24: { name: 'E-asy Street',    bb: 500,       sb: 250,      max: 9 },
  25: { name: "Cat's Chance",    bb: 2500000,   sb: 1250000,  max: 9 },
  26: { name: 'Broke Jokes',     bb: 50,        sb: 25,       max: 9 },
  27: { name: 'Six of the Best', bb: 10000,     sb: 5000,     max: 6 },
  28: { name: 'River Wizard',    bb: 1000000,   sb: 500000,   max: 9 },
  32: { name: 'Spilled Milk',    bb: 10,        sb: 5,        max: 6, tournament: true },
  33: { name: 'Dive Bar',        bb: 10,        sb: 5,        max: 6, tournament: true },
  34: { name: 'Lost at Sea',     bb: 10,        sb: 5,        max: 6, tournament: true },
  35: { name: 'Jaded',           bb: 10,        sb: 5,        max: 6, tournament: true },
  36: { name: 'Hell For',        bb: 10,        sb: 5,        max: 6, tournament: true },
  37: { name: 'Beach Please',    bb: 10,        sb: 5,        max: 6, tournament: true },
  38: { name: 'Cut the Cord',    bb: 10,        sb: 5,        max: 6, tournament: true },
  39: { name: 'Natural Talent',  bb: 10,        sb: 5,        max: 6, tournament: true },
  40: { name: 'Luxe',            bb: 10,        sb: 5,        max: 6, tournament: true },
  41: { name: 'Bloody Hell',     bb: 10,        sb: 5,        max: 6, tournament: true },
  43: { name: 'tsop test 1',     bb: 500,       sb: 250,      max: 4, tournament: true },
  44: { name: 'tsop test 2',     bb: 500,       sb: 250,      max: 7, tournament: true },
};

// Cash tables used to separate tournaments from cash games
const CASH_TABLE_IDS = new Set([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28]);

// Map of big blind amount -> table ids (for blind-based inference)
const BB_TO_TABLES = (() => {
  const map = {};
  for (const [id, t] of Object.entries(TABLE_META)) {
    if (t.tournament) continue; // only map cash tables for blind inference
    if (!map[t.bb]) map[t.bb] = [];
    map[t.bb].push(Number(id));
  }
  return map;
})();

// Basic formatting helpers
function fmt(n) {
  const a = Math.abs(Number(n) || 0);
  const s = a >= 1000000
    ? '$' + (a / 1e6).toFixed(1) + 'M'
    : a >= 1000
      ? '$' + Math.round(a / 1000) + 'K'
      : '$' + a;
  return Number(n) < 0 ? '-' + s : s;
}

function pct(a, b) {
  return b > 0 ? Math.round(a / b * 100) : null;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function tipWrap(label) {
  const def = TIPS[label];
  if (!def) return label;
  return '<span class="tooltip">' + label + ' <span style="color:var(--dim);font-size:9px;cursor:help;border-bottom:1px dashed var(--dim);">?</span><span class="tip-box">' + def + '</span></span>';
}

function ins(sev, label, text, chips) {
  const words = { g: 'Good', r: 'Leak', a: 'Warning', n: 'Note', o: 'Info' };
  const chipHtml = chips && chips.length
    ? '<div class="ins-chips">' + chips.map(c =>
      '<span class="chip' + (c.hi ? ' hi' : '') + '">' + c.v + '</span>'
    ).join('') + '</div>'
    : '';
  return '<div class="ins"><div class="ins-badge ' + sev + '"><div class="ins-dot"></div><div class="ins-word">' + words[sev] + '</div></div><div class="ins-label">' + label + '</div><div class="ins-text">' + text + '</div>' + chipHtml + '</div>';
}

// Insight helper that injects a "See example hand" button and wires its click
// handler to open the example-hand modal.
function insWithExample(sev, label, text, chips, exampleHand, coachingNote) {
  const base = ins(sev, label, text, chips);
  if (!exampleHand) return base;
  const btnId = 'ex-' + Math.random().toString(36).slice(2, 8);
  const btn = '<button class="example-hand-btn" id="' + btnId + '">See example hand</button>';
  const insertPoint = base.lastIndexOf('</div>');
  const result = base.slice(0, insertPoint) + btn + base.slice(insertPoint);
  setTimeout(function() {
    const el = document.getElementById(btnId);
    if (el) el.onclick = function() { showExampleHandModal(exampleHand, coachingNote); };
  }, 50);
  return result;
}

function barRow(label, val, max, cls, valStr, val2Str) {
  const w = max > 0 ? clamp(Math.round(val / max * 100), 0, 100) : 0;
  return '<div class="bar-row ' + (val2Str ? 'bw3' : 'bw2') + '">' +
    '<div class="bar-label">' + label + '</div>' +
    '<div class="bar-track"><div class="bar-fill ' + cls + '" style="width:' + w + '%"></div></div>' +
    '<div class="bar-val">' + valStr + '</div>' +
    (val2Str ? '<div class="bar-val2">' + val2Str + '</div>' : '') +
    '</div>';
}

// Parse action log lines into structured events for analysis
function parseActions(actions) {
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
    else if (msg.startsWith('raised') || msg.startsWith('bet')) type = 'raise';
    else if (msg.startsWith('posted small blind')) type = 'sb';
    else if (msg.startsWith('posted big blind')) type = 'bb';
    else if (msg.includes('won')) type = 'won';
    if (type) {
      out.push({ author, isMe, street, type, amount, msg });
    }
  }
  return out;
}

// Turn a hole card array into a condensed key like "AKs" or "TT"
function parseHoleKey(hole) {
  if (!hole || hole.length < 2) return null;
  const r1 = hole[0].slice(0, -1);
  const r2 = hole[1].slice(0, -1);
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
  let r1, r2;
  if (key.startsWith('10')) {
    r1 = '10';
    r2 = key.slice(2, -1);
  } else {
    r1 = key[0];
    const rest = key.endsWith('s') || key.endsWith('o') ? key.slice(1, -1) : key.slice(1);
    r2 = rest.startsWith('10') ? '10' : rest[0];
  }
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

// Infer TC table id from hand metadata and blind sizes
function inferTable(hand) {
  // Prefer the tableId field from TM script (e.g. "holdem21")
  if (hand.tableId) {
    const num = String(hand.tableId).replace(/\D/g, '');
    if (num && TABLE_META[num]) return Number(num);
  }
  // Fall back to hand.table if present
  if (hand.table) {
    const num = String(hand.table).replace(/\D/g, '');
    if (num && TABLE_META[num]) return Number(num);
  }
  // Legacy fallback: infer from blind amounts in action log
  const actions = hand.actions || [];
  let bbAmt = null;
  const players = new Set();
  for (const line of actions) {
    const clean = line.replace(/^>>\s*/, '').replace(/^\s+/, '').trim();
    const ci = clean.indexOf(': ');
    if (ci > 0) {
      const author = clean.slice(0, ci);
      if (!author.startsWith('The ')) players.add(author);
    }
    const bbMatch = clean.match(/posted big blind \$?([\d,]+)/);
    if (bbMatch) {
      bbAmt = parseInt(bbMatch[1].replace(/,/g, ''));
      continue;
    }
    const bbChips = clean.match(/posted big blind ([\d,]+) chips/);
    if (bbChips) {
      bbAmt = parseInt(bbChips[1].replace(/,/g, ''));
    }
  }
  const playerCount = players.size;
  if (bbAmt === null) return null;
  const candidates = BB_TO_TABLES[bbAmt];
  if (!candidates || !candidates.length) return null;
  if (candidates.length === 1) return candidates[0];
  if (playerCount > 0) {
    const fits = candidates.filter(id => playerCount <= TABLE_META[id].max);
    if (fits.length === 1) return fits[0];
    if (fits.length > 1) {
      fits.sort((a, b) =>
        Math.abs(TABLE_META[a].max - playerCount) - Math.abs(TABLE_META[b].max - playerCount)
      );
      return fits[0];
    }
  }
  return candidates[0];
}

// True if a hand should be treated as cash game rather than tournament
function isCashHand(hand) {
  const tid = inferTable(hand);
  if (tid === null) return true; // legacy hands without table data, assume cash
  return CASH_TABLE_IDS.has(tid);
}

function getTableLabel(tableId) {
  if (!tableId || !TABLE_META[tableId]) return 'Unknown Table';
  const t = TABLE_META[tableId];
  const prefix = t.tournament ? 'T: ' : '';
  return prefix + t.name + ' (' + fmt(t.sb) + '/' + fmt(t.bb) + ')';
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

// Try to detect player name from action lines (fallback for old exports)
function detectPlayerFromActions(hands) {
  // First check if any hand has an explicit player field
  for (let i = 0; i < hands.length; i++) {
    if (hands[i].player && hands[i].player !== 'Unknown') {
      return hands[i].player;
    }
  }
  // Count occurrences of names from >> prefixed lines to find most common
  const nameCounts = {};
  for (let i = 0; i < hands.length; i++) {
    const actions = hands[i].actions || [];
    for (let j = 0; j < actions.length; j++) {
      const line = (actions[j] || '');
      // Check both >> prefix and HTML-encoded version
      const isMe = line.indexOf('>>') === 0 || line.indexOf('&gt;&gt;') === 0;
      if (isMe) {
        const clean = line.replace(/^(>>|&gt;&gt;)\s*/, '').trim();
        const ci = clean.indexOf(': ');
        if (ci > 0) {
          const name = clean.slice(0, ci);
          nameCounts[name] = (nameCounts[name] || 0) + 1;
        }
      }
    }
  }
  // Return the most frequently occurring name
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

