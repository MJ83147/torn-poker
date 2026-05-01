// ── UI RENDERING HELPERS ──────────────────────────────────────────────────────

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
  'LJ': 'Lojack. Three seats before the button. Early-middle position, start of the steal zone.',
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
  'Bet': 'Place the first wager in a betting round. Distinct from a raise, which increases an existing bet.',
  'Call': 'Match the current bet to stay in the hand.',
  'Raise': 'Increase the current bet, forcing others to put in more to continue.',
  // Betting concepts
  'Bluff': 'Betting or raising with a weak hand to make opponents fold better hands.',
  'Semi-Bluff': 'Betting with a drawing hand that could improve. You win if they fold now or if you hit your draw.',
  'Value Bet': 'Betting a strong hand to extract chips from weaker hands that will call.',
  // Showdown & equity
  'Showdown': 'When remaining players reveal their cards after the final betting round to determine the winner.',
  'Equity': 'Your share of the pot based on the probability of winning. 50% equity in a $100 pot means $50 expected value.',
  'EV Diff': 'The difference between your actual result and your expected value. Positive means you ran above expectation.',
  'Fair Share': 'The portion of the pot you "deserve" based on your equity at the time of an all-in.',
};

// Switch active tab and panel
function switchTab(tabId) {
  // Switch panel
  document.querySelectorAll('.panel').forEach(function(p) { p.classList.remove('on'); });
  var panel = document.getElementById('p-' + tabId);
  if (panel) panel.classList.add('on');
  // Highlight active item and active group button
  document.querySelectorAll('.tab-item').forEach(function(t) { t.classList.remove('active'); });
  document.querySelectorAll('.tab-menu-btn').forEach(function(b) { b.classList.remove('active'); });
  var item = document.querySelector('.tab-item[data-tab="' + tabId + '"]');
  if (item) {
    item.classList.add('active');
    var menu = item.closest('.tab-menu');
    if (menu) menu.querySelector('.tab-menu-btn').classList.add('active');
  }
  // Close any open menus and remove blur
  document.querySelectorAll('.tab-menu').forEach(function(m) { m.classList.remove('open'); });
  var pw = document.getElementById('panels-wrap');
  if (pw) pw.classList.remove('blurred');
}

function _toggleBackdrop(show) {
  var pw = document.getElementById('panels-wrap');
  if (pw) pw.classList.toggle('blurred', show);
}

// Tab menu open/close logic
(function() {
  document.addEventListener('click', function(e) {
    var btn = e.target.closest('.tab-menu-btn');
    if (btn) {
      e.stopPropagation();
      var menu = btn.closest('.tab-menu');
      var wasOpen = menu.classList.contains('open');
      // Close all menus first
      document.querySelectorAll('.tab-menu').forEach(function(m) { m.classList.remove('open'); });
      if (!wasOpen) {
        menu.classList.add('open');
        _toggleBackdrop(true);
      } else {
        _toggleBackdrop(false);
      }
      return;
    }
    var item = e.target.closest('.tab-item');
    if (item) {
      e.stopPropagation();
      switchTab(item.getAttribute('data-tab'));
      return;
    }
    // Click outside closes all menus
    document.querySelectorAll('.tab-menu').forEach(function(m) { m.classList.remove('open'); });
    _toggleBackdrop(false);
  });
})();

// Render a row of mini stat boxes.
//   items: [{ l, v, c, dot }] - label, value, colour key (g/r/a/text/var-name), optional dot class
//   opts:  { columns, dim }   - optional grid-template-columns override; dim=true applies opacity 0.45
function renderMiniRow(items, opts) {
  opts = opts || {};
  var rowAttrs = '';
  if (opts.columns) rowAttrs += ' style="grid-template-columns:' + opts.columns + ';"';
  else if (opts.dim) rowAttrs += ' style="opacity:0.45"';
  if (opts.columns && opts.dim) rowAttrs = ' style="grid-template-columns:' + opts.columns + ';opacity:0.45;"';
  return '<div class="mini-row"' + rowAttrs + '>' + items.map(function(m) {
    var color = m.c === 'g' ? 'green' : m.c === 'r' ? 'red' : m.c === 'a' ? 'amber' : m.c || 'text';
    var dot = m.dot ? '<span class="line-dot ' + m.dot + '"></span> ' : '';
    return '<div class="mini"><div class="mini-l dim-label">' + dot + m.l + '</div><div class="serif-value" style="color:var(--' + color + ')">' + m.v + '</div></div>';
  }).join('') + '</div>';
}

// Render a stats table with consistent header / row structure.
//   columns: [{ key, label, fmt?, cls?, tip? }]
//     key:   the property name on each row OR a function(row, idx) returning the cell value
//     label: header text (passed through tipWrap if tip option set)
//     fmt:   optional function(cellValue, row, idx) returning HTML for the cell
//     cls:   optional cell class
//     tip:   true → wrap header label in a tooltip via tipWrap
//   rows:    array of objects (rendered in order; sort upstream)
//   opts:    { tableClass, wrapClass } - default 'tbl', 'overflow-x'
function renderStatsTable(rows, columns, opts) {
  opts = opts || {};
  var wrapClass = opts.wrapClass || 'overflow-x';
  var tableClass = opts.tableClass || 'tbl';
  var head = '<thead><tr>' + columns.map(function(c) {
    return '<th>' + (c.tip ? tipWrap(c.label) : c.label) + '</th>';
  }).join('') + '</tr></thead>';
  var body = '<tbody>' + rows.map(function(row, idx) {
    return '<tr>' + columns.map(function(c) {
      var val = (typeof c.key === 'function') ? c.key(row, idx) : row[c.key];
      var cell = c.fmt ? c.fmt(val, row, idx) : (val == null ? '-' : val);
      return '<td' + (c.cls ? ' class="' + c.cls + '"' : '') + '>' + cell + '</td>';
    }).join('') + '</tr>';
  }).join('') + '</tbody>';
  return '<div class="' + wrapClass + '"><table class="' + tableClass + '">' + head + body + '</table></div>';
}

// Run the engine for a given panel and append the resulting insight cards to a
// legacy insight-array, deduping by label.
//   panelId:    string passed to InsightEngine.forPanel
//   legacyArr:  array of HTML strings already produced by the panel's hand-rolled rules
//   opts:       { limit, refine, filter }
//     limit:    maximum engine insights to consider (default 4)
//     refine:   function(insight) → insight  - mutate before render (used by Players)
//     filter:   function(insight) → boolean  - drop insights whose category doesn't fit this panel
function appendEngineInsights(panelId, legacyArr, opts) {
  opts = opts || {};
  if (typeof InsightEngine === 'undefined') return legacyArr;
  var limit = opts.limit != null ? opts.limit : 4;
  var engineIns = InsightEngine.forPanel(panelId, limit);
  for (var i = 0; i < engineIns.length; i++) {
    var ins = engineIns[i];
    if (opts.filter && !opts.filter(ins)) continue;
    if (opts.refine) ins = opts.refine(ins) || ins;
    var dup = false;
    for (var j = 0; j < legacyArr.length; j++) {
      if (legacyArr[j].indexOf(ins.label) !== -1) { dup = true; break; }
    }
    if (!dup) legacyArr.push(renderRuleInsight(ins));
  }
  return legacyArr;
}

function tipWrap(label) {
  const def = TIPS[label];
  if (!def) return label;
  return '<span class="tooltip">' + label + ' <span class="tip-q">?</span><span class="tip-box">' + def + '</span></span>';
}

// Render an insight card.
//   sev      - 'g' | 'r' | 'a' | 'n' | 'o'  (good / leak / warning / note / info)
//   label    - title shown under the badge
//   text     - the ANALYSIS line. What the player actually did from their data.
//              Keep this strictly observational ("you fold 60% to 3-bets").
//   chips    - optional [{ v, hi }] chips
//   coaching - optional. The COACHING line. General poker advice independent
//              of the player's specific hands ("defend wider with strong hands
//              against 3-bets"). Renders below the analysis with a clear
//              divider so the user knows which is which.
function ins(sev, label, text, chips, coaching) {
  const words = { g: 'Good', r: 'Leak', a: 'Warning', n: 'Note', o: 'Info' };
  const chipHtml = chips && chips.length
    ? '<div class="ins-chips">' + chips.map(c => {
      var cls = 'chip';
      if (c.hi) cls += ' chip-' + sev;
      return '<span class="' + cls + '">' + c.v + '</span>';
    }).join('') + '</div>'
    : '';
  const coachingHtml = coaching
    ? '<div class="ins-coaching"><div class="ins-coaching-head dim-label">Coaching</div><div class="ins-coaching-text">' + coaching + '</div></div>'
    : '';
  return '<div class="ins"><div class="ins-badge ' + sev + '"><div class="ins-dot"></div><div class="ins-word">' + words[sev] + '</div></div><div class="ins-label">' + label + '</div><div class="ins-text">' + text + '</div>' + chipHtml + coachingHtml + '</div>';
}

// Insight helper that injects a "See example hands" button and wires its click.
// exampleHands can be a single hand or an array of hands.
//   coachingNote - shown in the example-hand modal (can reference "this hand").
//   coaching     - optional general-advice line shown inline on the card
//                  (independent of any specific hand).
function insWithExample(sev, label, text, chips, exampleHands, coachingNote, coaching) {
  const base = ins(sev, label, text, chips, coaching);
  // Normalise to array
  var handsList = !exampleHands ? [] : Array.isArray(exampleHands) ? exampleHands : [exampleHands];
  if (!handsList.length) return base;
  const btnId = 'ex-' + Math.random().toString(36).slice(2, 8);
  const btn = '<button class="example-hand-btn" id="' + btnId + '">See example hands</button>';
  const insertPoint = base.lastIndexOf('</div>');
  const result = base.slice(0, insertPoint) + btn + base.slice(insertPoint);
  setTimeout(function() {
    const el = document.getElementById(btnId);
    if (!el) return;
    el.onclick = function() {
      showExampleHandListModal(label, handsList, coachingNote);
    };
  }, 50);
  return result;
}

// Wrap insight array: join them, add a fallback "needs more data" if empty
function renderInsights(insArr, fallbackLabel, fallbackText) {
  if (!insArr.length) {
    insArr.push(ins('n', fallbackLabel, fallbackText || 'More hands needed for ' + fallbackLabel.toLowerCase() + ' patterns.', []));
  }
  return '<div class="ins-grid">' + insArr.join('') + '</div>';
}

// Render a result element: <tag class="baseClass cls">text</tag>
function renderResult(h, tag, baseClass) {
  var pnl = getHandPnl(h);
  return '<' + tag + ' class="' + baseClass + ' ' + pnl.cls + '">' + pnl.text + '</' + tag + '>';
}

// Render the table-dynamics chips for a hand: seats · flop-bucket.
// Returns '' if the hand hasn't been annotated yet (e.g. called before analyse()).
function handTagsHtml(h) {
  if (!h || !h.seatBucket) return '';
  var parts = [];
  parts.push('<span class="ht-tag ht-seat">' + h.seatBucket + '</span>');
  if (h.flopBucket) {
    parts.push('<span class="ht-tag ht-flop ht-flop-' + h.flopBucket.replace('-', '_') + '">' + h.flopBucket + '</span>');
  }
  return '<span class="ht-tags">' + parts.join('') + '</span>';
}

// Render a single hand row (used in log and player hand lists)
// opts.starHtml: optional star column HTML (for log panel)
function renderHandRow(h, idx, opts) {
  var myActs = getActsSummary(h);
  var res = renderResult(h, 'td', 'hrow-res');
  var starCol = opts && opts.starHtml ? '<td class="hrow-star-col">' + opts.starHtml + '</td>' : '';
  var tags = handTagsHtml(h);
  return '<tr class="hrow row-hover" data-hand-idx="' + idx + '">' +
    starCol +
    '<td class="hrow-pos">' + (h.position || '?') + '</td>' +
    '<td class="hrow-cards">' + (h.hole && h.hole.length ? h.hole.join(' ') : '?? ??') + '</td>' +
    '<td class="hrow-tags">' + tags + '</td>' +
    '<td class="hrow-board">' + (h.board && h.board.length ? h.board.join(' ') : '-') + '</td>' +
    '<td class="hrow-pot">' + fmtBB(h.pot || 0, getHandBB(h)) + '</td>' +
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

function barRow(label, val, max, cls, valStr, val2Str) {
  const w = max > 0 ? clamp(Math.round(val / max * 100), 0, 100) : 0;
  return '<div class="bar-row ' + (val2Str ? 'bw3' : 'bw2') + '">' +
    '<div class="bar-label">' + label + '</div>' +
    '<div class="bar-track"><div class="bar-fill ' + cls + '" style="width:' + w + '%"></div></div>' +
    '<div class="bar-val">' + valStr + '</div>' +
    (val2Str ? '<div class="bar-val2">' + val2Str + '</div>' : '') +
    '</div>';
}
