// ── HELPERS (pure utilities, no app boot) ─────────────────────────────────────

// Ranks in ascending order for hand key parsing/classification
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
const SUITS = ['\u2660', '\u2665', '\u2666', '\u2663'];

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
  'PFR': 'Pre-Flop Raise. How often a player raises before the flop. High PFR means an aggressive opener.',
  'Limp': 'Entering the pot by just calling the big blind instead of raising. Usually a passive, weak play.',
  'Fold to Raise': 'How often a player folds when facing a raise. High values mean they give up easily under pressure.',
  'WTSD': 'Went To ShowDown. How often a player reaches showdown after seeing a flop. High WTSD means they rarely fold post-flop.',
  'WSD': 'Won at ShowDown. How often a player wins when they reach showdown. Low WSD suggests they call too much with weak hands.',
  'Fold Pre': 'How often you fold before the flop. High fold rates from early position are normal.',
  '3-Bet': 'A re-raise over an opening raise. The "third" bet in a preflop sequence (blinds, open, 3-bet).',
  'All-In': 'Betting all remaining chips on a single action. Forces a showdown if called.',
  'C-Bet': 'Continuation bet. Betting the flop after raising preflop, continuing aggression regardless of whether the flop helped.',
  'Delayed C-Bet': 'Betting the turn after checking the flop as the preflop raiser. A delayed continuation bet.',
  'Donk Bet': 'Betting into the preflop raiser on the flop when you were not the raiser. Usually indicates a strong hand or a blocker bet.',
  'Fold to C-Bet': 'How often you fold when the preflop raiser bets the flop. High fold rates may indicate exploitability.',
  'Fold to 3-Bet': 'How often you fold when your opening raise is re-raised (3-bet). Very high fold rates let opponents steal your opens cheaply.',
  'Fold to 4-Bet': 'How often you fold when your 3-bet is re-raised (4-bet). Folding is often correct here unless you have a premium hand.',
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

// Map of big blind amount -> table entries with max seats (for blind-based inference)
const BB_TO_TABLES = (() => {
  const map = {};
  for (const [id, t] of Object.entries(TABLE_META)) {
    if (t.tournament) continue; // only map cash tables for blind inference
    if (!map[t.bb]) map[t.bb] = [];
    map[t.bb].push({ id: Number(id), max: t.max });
  }
  return map;
})();

// BB display toggle state
let _displayBB = false;

// ── STARRED HANDS ────────────────────────────────────────────────────────────
function getHandKey(h) {
  var hole = (h.hole || []).join('');
  var board = (h.board || []).join('');
  var pos = h.position || '';
  var res = h.outcome ? h.outcome.result : '';
  var amt = h.outcome ? (h.outcome.amount || 0) : 0;
  var inv = h.invested || 0;
  var actLen = (h.actions || []).length;
  return hole + '|' + board + '|' + pos + '|' + res + '|' + amt + '|' + inv + '|' + actLen;
}

function getStarredHands() {
  try { return JSON.parse(localStorage.getItem('tc_starred_hands') || '{}'); } catch(e) { return {}; }
}

function setStarredHands(map) {
  try {
    localStorage.setItem('tc_starred_hands', JSON.stringify(map));
  } catch(e) {
    console.warn('[starred] localStorage write failed:', e);
  }
}

// Store only the fields needed to display/replay a hand (skip raw actions bloat)
function compactHand(h) {
  return {
    hole: h.hole,
    board: h.board,
    position: h.position,
    outcome: h.outcome,
    invested: getInvested(h),
    pot: h.pot,
    actions: h.actions,
    tableId: h.tableId,
    table: h.table,
    bigBlind: h.bigBlind,
    tableSize: h.tableSize,
    player: h.player
  };
}

function isHandStarred(h) {
  return !!getStarredHands()[getHandKey(h)];
}

function toggleStarHand(h) {
  var map = getStarredHands();
  var key = getHandKey(h);
  if (map[key]) {
    delete map[key];
  } else {
    map[key] = { hand: compactHand(h), note: '', savedAt: new Date().toISOString() };
  }
  setStarredHands(map);
  return !!map[key];
}

function getHandNote(h) {
  var entry = getStarredHands()[getHandKey(h)];
  return entry ? entry.note : '';
}

function setHandNote(h, note) {
  var map = getStarredHands();
  var key = getHandKey(h);
  if (map[key]) {
    map[key].note = note;
    setStarredHands(map);
  }
}

// ── SHARED HELPERS (reduce duplication across panels) ─────────────────────────

// Get the amount the hero invested in a hand
function getInvested(h) {
  return h.invested || calcInvestmentFromActions(h.actions || []);
}

// Get hero actions from a hand (parsed + filtered)
function getHeroActions(h) {
  return parseActions(h.actions).filter(function(a) { return a.isMe; });
}

// Get a short summary string of hero actions ("call · raise · fold")
function getActsSummary(h) {
  return getHeroActions(h).map(function(a) { return a.type; }).join(' · ');
}

// Compute the real profit/loss for a hand.
// In multi-pot scenarios, a "won" hand can have negative profit (excess returned).
function getHandPnl(h) {
  if (!h.outcome) return { cls: 'u', text: '?' };
  var invested = getInvested(h);
  if (h.outcome.result === 'won') {
    var profit = (h.outcome.amount || 0) - invested;
    if (profit >= 0) return { cls: 'w', text: '+' + fmt(profit) };
    // Multi-pot: won but net negative (excess returned, lost side pot)
    return { cls: 'l', text: '-' + fmt(Math.abs(profit)) };
  }
  if (h.outcome.result === 'folded') {
    return { cls: 'l', text: invested > 0 ? '-' + fmt(invested) : 'folded' };
  }
  // lost
  return { cls: 'l', text: '-' + fmt(invested) };
}

// Render a result element: <tag class="baseClass cls">text</tag>
function renderResult(h, tag, baseClass) {
  var pnl = getHandPnl(h);
  return '<' + tag + ' class="' + baseClass + ' ' + pnl.cls + '">' + pnl.text + '</' + tag + '>';
}

// Render a single hand row (used in log and player hand lists)
// opts.starHtml: optional star column HTML (for log panel)
function renderHandRow(h, idx, opts) {
  var myActs = getActsSummary(h);
  var res = renderResult(h, 'td', 'hrow-res');
  var starCol = opts && opts.starHtml ? '<td class="hrow-star-col">' + opts.starHtml + '</td>' : '';
  return '<tr class="hrow row-hover" data-hand-idx="' + idx + '">' +
    starCol +
    '<td class="hrow-pos">' + (h.position || '?') + '</td>' +
    '<td class="hrow-cards">' + (h.hole && h.hole.length ? h.hole.join(' ') : '?? ??') + '</td>' +
    '<td class="hrow-board">' + (h.board && h.board.length ? h.board.join(' ') : '—') + '</td>' +
    '<td class="hrow-acts">' + myActs + '</td>' +
    res + '</tr>';
}

// Render prev/next pagination controls
function renderPagination(page, totalItems, pageSize, prevId, nextId) {
  var totalPages = Math.ceil(totalItems / pageSize);
  if (totalPages <= 1) return '';
  return '<button class="log-nav-btn" id="' + prevId + '" ' + (page === 0 ? 'disabled' : '') + '>&laquo; Prev</button>' +
    '<span class="meta-text">Page ' + (page + 1) + '/' + totalPages + '</span>' +
    '<button class="log-nav-btn" id="' + nextId + '" ' + (page >= totalPages - 1 ? 'disabled' : '') + '>Next &raquo;</button>';
}

// Wrap insight array: join them, add a fallback "needs more data" if empty
function renderInsights(insArr, fallbackLabel, fallbackText) {
  if (!insArr.length) {
    insArr.push(ins('n', fallbackLabel, fallbackText || 'More hands needed for ' + fallbackLabel.toLowerCase() + ' patterns.', []));
  }
  return '<div class="ins-grid">' + insArr.join('') + '</div>';
}

// Map a win rate percentage to a CSS color variable
function wrColor(w) {
  if (w === null) return 'var(--dim)';
  if (w >= 55) return 'var(--green)';
  if (w <= 38) return 'var(--red)';
  return 'var(--amber)';
}

// Basic formatting helpers
function fmt(n) {
  const a = Math.abs(Number(n) || 0);
  const s = a >= 1e9
    ? '$' + (a / 1e9).toFixed(1) + 'B'
    : a >= 1e6
      ? '$' + (a / 1e6).toFixed(1) + 'M'
      : a >= 1000
        ? '$' + Math.round(a / 1000) + 'K'
        : '$' + a;
  return Number(n) < 0 ? '-' + s : s;
}

function fmtBB(amount, bb) {
  if (!_displayBB || !bb || bb <= 0) return fmt(amount);
  var bbs = amount / bb;
  if (Math.abs(bbs) >= 100) return Math.round(bbs) + ' BB';
  if (Math.abs(bbs) >= 10) return bbs.toFixed(1) + ' BB';
  return bbs.toFixed(2) + ' BB';
}

function pct(a, b) {
  return b > 0 ? Math.round(a / b * 100) : null;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

// ── SHARED FORMATTING HELPERS (reduce duplication across panels) ─────────

// Average of numeric array (returns raw float, callers round if needed)
function avg(arr) {
  if (!arr || !arr.length) return 0;
  var s = 0;
  for (var i = 0; i < arr.length; i++) s += arr[i];
  return s / arr.length;
}

// Format P&L with +/- prefix
function fmtPnl(val) {
  return (val >= 0 ? '+' : '') + fmt(val);
}

// CSS class for P&L (table cells)
function pnlCls(val) {
  return val >= 0 ? 'pnl-pos' : 'pnl-neg';
}

// CSS color variable for P&L (inline styles)
function pnlColor(val) {
  return val >= 0 ? 'var(--green)' : 'var(--red)';
}

// CSS class for win rate (table cells)
function wrCls(wr) {
  if (wr === null) return '';
  return wr >= 50 ? 'wr-good' : 'wr-bad';
}

// Display amount as BB or dollar depending on toggle
function fmtAvgAmount(chipArr, bbArr) {
  if (_displayBB && bbArr && bbArr.length) return avg(bbArr).toFixed(1) + ' BB';
  return fmt(Math.round(avg(chipArr)));
}

// Switch active tab and panel
function switchTab(tabId) {
  document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
  document.querySelectorAll('.panel').forEach(function(p) { p.classList.remove('on'); });
  var tabBtn = document.querySelector('[data-tab="' + tabId + '"]');
  if (tabBtn) tabBtn.classList.add('active');
  var panel = document.getElementById('p-' + tabId);
  if (panel) panel.classList.add('on');
}

// Render a row of mini stat boxes
function renderMiniRow(items) {
  return '<div class="mini-row">' + items.map(function(m) {
    var color = m.c === 'g' ? 'green' : m.c === 'r' ? 'red' : m.c === 'a' ? 'amber' : m.c || 'text';
    return '<div class="mini"><div class="mini-l dim-label">' + m.l + '</div><div class="serif-value" style="color:var(--' + color + ')">' + m.v + '</div></div>';
  }).join('') + '</div>';
}

function tipWrap(label) {
  const def = TIPS[label];
  if (!def) return label;
  return '<span class="tooltip">' + label + ' <span class="tip-q">?</span><span class="tip-box">' + def + '</span></span>';
}

function ins(sev, label, text, chips) {
  const words = { g: 'Good', r: 'Leak', a: 'Warning', n: 'Note', o: 'Info' };
  const chipHtml = chips && chips.length
    ? '<div class="ins-chips">' + chips.map(c =>
      '<span class="chip' + (c.hi ? ' hi' : '') + '">' + c.v + '</span>'
    ).join('') + '</div>'
    : '';
  return '<div class="ins"><div class="ins-badge ' + sev + '"><div class="ins-dot"></div><div class="ins-word">' + words[sev] + '</div></div><div class="ins-label dim-label">' + label + '</div><div class="ins-text">' + text + '</div>' + chipHtml + '</div>';
}

// Insight helper that injects a "See example hands" button and wires its click.
// exampleHands can be a single hand or an array of hands.
function insWithExample(sev, label, text, chips, exampleHands, coachingNote) {
  const base = ins(sev, label, text, chips);
  // Normalise to array
  var handsList = !exampleHands ? [] : Array.isArray(exampleHands) ? exampleHands : [exampleHands];
  if (!handsList.length) return base;
  const btnId = 'ex-' + Math.random().toString(36).slice(2, 8);
  var count = handsList.length;
  const btn = '<button class="example-hand-btn" id="' + btnId + '">' +
    (count === 1 ? 'See example hand' : 'See ' + count + ' example hands') + '</button>';
  const insertPoint = base.lastIndexOf('</div>');
  const result = base.slice(0, insertPoint) + btn + base.slice(insertPoint);
  setTimeout(function() {
    const el = document.getElementById(btnId);
    if (!el) return;
    el.onclick = function() {
      if (count === 1) {
        showExampleHandModal(handsList[0], coachingNote);
      } else {
        showExampleHandListModal(label, handsList, coachingNote);
      }
    };
  }, 50);
  return result;
}

// Hand-list modal: shows a scrollable list of hands, click any to open detail.
// Same visual pattern as the range grid cell click modal.
function showExampleHandListModal(title, handsList, coachingNote) {
  var existing = document.getElementById('example-hand-modal');
  if (existing) existing.remove();

  var overlay = document.createElement('div');
  overlay.id = 'example-hand-modal';
  overlay.className = 'modal-overlay';
  overlay.onclick = function(e) { if (e.target === overlay) closeModal(); };

  var box = document.createElement('div');
  box.className = 'modal-box';
  box.style.position = 'relative';
  box.style.maxHeight = '80vh';
  box.style.overflowY = 'auto';

  var header = '<div class="modal-title">' + title + '</div>' +
    '<div class="mb-16">' + handsList.length + ' example hand' + (handsList.length !== 1 ? 's' : '') + '</div>';

  if (coachingNote) {
    header += '<div class="modal-coaching"><div class="modal-coaching-label dim-label">What to look for</div>' + coachingNote + '</div>';
  }

  var rows = handsList.map(function(h, idx) {
    var myActs = getActsSummary(h);
    var res = renderResult(h, 'span', 'saved-res');
    return '<div class="range-hand-row" data-ridx="' + idx + '">' +
      '<div class="range-hand-row-side">' +
      '<span class="meta-text">' + (h.position || '?') + '</span>' +
      '<span>' + (h.hole ? h.hole.join(' ') : '??') + '</span>' +
      '<span class="meta-text">' + (h.board && h.board.length ? h.board.join(' ') : '—') + '</span>' +
      '</div>' +
      '<div class="range-hand-row-side">' +
      '<span class="meta-text">' + myActs + '</span>' +
      res + '</div></div>';
  }).join('');

  box.innerHTML = '<button class="modal-close" id="modal-close-btn">&times;</button>' +
    header + '<div class="mt-12">' + rows + '</div>';

  overlay.appendChild(box);
  document.body.appendChild(overlay);
  requestAnimationFrame(function() { overlay.classList.add('show'); });
  document.getElementById('modal-close-btn').onclick = closeModal;

  box.querySelectorAll('.range-hand-row').forEach(function(row) {
    row.onclick = function() {
      var idx = parseInt(row.getAttribute('data-ridx'));
      if (!isNaN(idx) && handsList[idx]) showExampleHandModal(handsList[idx], coachingNote);
    };
  });
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

// Infer TC table id from hand metadata and blind sizes
function inferTable(hand) {
  // Use the tableId field from TM script (e.g. "holdem21")
  if (hand.tableId) {
    const num = String(hand.tableId).replace(/\D/g, '');
    if (num && TABLE_META[num]) return Number(num);
  }
  // Fall back to hand.table if present
  if (hand.table) {
    const num = String(hand.table).replace(/\D/g, '');
    if (num && TABLE_META[num]) return Number(num);
  }
  // Fall back to bigBlind field if present
  if (hand.bigBlind) {
    const candidates = BB_TO_TABLES[hand.bigBlind];
    if (candidates && candidates.length === 1) return candidates[0].id;
    if (candidates && candidates.length > 1 && hand.tableSize) {
      const match = candidates.find(c => c.max >= hand.tableSize);
      if (match) return match.id;
    }
  }
  // Last resort: parse blind from action text
  if (hand.actions && hand.actions.length) {
    let bb = 0;
    const players = new Set();
    for (let i = 0; i < hand.actions.length; i++) {
      const line = hand.actions[i];
      // Extract big blind amount
      const bbMatch = line.match(/posted big blind \$([0-9,]+)/);
      if (bbMatch) bb = parseInt(bbMatch[1].replace(/,/g, ''), 10);
      // Count unique players from action lines (name is word chars, spaces, underscores before first colon)
      const authorMatch = line.match(/^\s*(?:>> )?([A-Za-z0-9_ -]+?):\s/);
      if (authorMatch && !authorMatch[1].startsWith('The ')) {
        players.add(authorMatch[1]);
      }
    }
    if (bb && BB_TO_TABLES[bb]) {
      const candidates = BB_TO_TABLES[bb];
      if (candidates.length === 1) return candidates[0].id;
      // Disambiguate by player count — pick smallest max that fits
      const playerCount = players.size;
      const sorted = candidates.slice().sort((a, b) => a.max - b.max);
      const match = sorted.find(c => c.max >= playerCount);
      if (match) return match.id;
      // If player count exceeds all candidates, use the largest table
      return sorted[sorted.length - 1].id;
    }
  }
  return null;
}

// Count unique players in a hand from action lines
function countHandPlayers(hand) {
  if (hand.tableSize) return hand.tableSize;
  if (!hand.actions || !hand.actions.length) return 0;
  var seen = {};
  var count = 0;
  for (var i = 0; i < hand.actions.length; i++) {
    var line = hand.actions[i].replace(/^(>>|&gt;&gt;)\s*/, '').replace(/^\s+/, '').trim();
    var ci = line.indexOf(': ');
    if (ci === -1) continue;
    var author = line.slice(0, ci);
    if (author === 'Game') continue;
    if (!seen[author]) { seen[author] = true; count++; }
  }
  return count;
}

// True if a hand should be treated as cash game rather than tournament
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

// Backfill missing board, pot, and outcome from action lines.
// Some TC Poker exports omit these structured fields even though the
// full hand history is present in the actions array.
function backfillHandData(hands) {
  var SUIT_MAP = {
    'diamonds': '♦', 'hearts': '♥', 'spades': '♠', 'clubs': '♣',
    'diamond': '♦', 'heart': '♥', 'spade': '♠', 'club': '♣'
  };
  var CARD_RE = /(\d{1,2}|[AKQJT])([a-z]+)/gi;

  function parseCardsFromStreet(line) {
    var cards = [];
    var m;
    while ((m = CARD_RE.exec(line)) !== null) {
      var rank = m[1];
      if (rank === '10') rank = 'T';
      var suit = SUIT_MAP[(m[2] || '').toLowerCase()];
      if (suit) cards.push(rank + suit);
    }
    CARD_RE.lastIndex = 0;
    return cards;
  }

  for (var i = 0; i < hands.length; i++) {
    var h = hands[i];
    var actions = h.actions || [];
    if (!actions.length) continue;

    var needBoard = !h.board || !h.board.length;
    var needPot = !h.pot;
    var needOutcome = !h.outcome;

    if (!needBoard && !needPot && !needOutcome) continue;

    var board = [];
    var totalPot = 0;
    var wonAmount = 0;
    var heroWon = false;
    var heroFolded = false;
    var heroLost = false;

    for (var j = 0; j < actions.length; j++) {
      var raw = (actions[j] || '').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&');
      var isMe = raw.indexOf('>>') === 0;
      var line = raw.replace(/^>>\s*/, '').replace(/^\s+/, '').trim();

      // Extract board cards from street headers
      if (needBoard) {
        if (line.indexOf('The flop') === 0 || line.indexOf('The turn') === 0 || line.indexOf('The river') === 0) {
          var streetCards = parseCardsFromStreet(line);
          for (var k = 0; k < streetCards.length; k++) board.push(streetCards[k]);
        }
      }

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
        if (author === 'Game') continue;
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

