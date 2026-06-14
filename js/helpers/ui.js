// The seat-code entries below (BTN, SB, BB, UTG, ...) overlap with the short
// display names in SEAT_NAMES (constants.js), but these are longer-form help
// text shown on hover, so they are intentionally kept separate.
const TIPS = {
  'Pocket Pairs': 'Two cards of the same rank (e.g. 9♠ 9♥). Strong preflop, vulnerable to overcards.',
  'Broadway': 'Any two of T, J, Q, K, A. High-card hands that connect on high boards.',
  'Ace-Rag': 'An ace paired with a weak kicker (2 to 9). Looks strong, but often loses to a better ace.',
  'Suited Connectors': 'Consecutive ranks of the same suit (e.g. 7♥ 8♥). Play well as draws.',
  'Suited': 'Same suit, non-connecting. Backdoor flush potential only.',
  'Connectors': 'Consecutive ranks, different suits. Straight draw potential.',
  'Offsuit Trash': 'Non-connected, non-suited weak cards. Fold almost always.',
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
  'BTN': 'Button (Dealer). Best position at the table. Acts last on every street after the flop.',
  'SB': 'Small Blind. Forced half-bet posted before cards are dealt. Acts second-to-last preflop, first post-flop.',
  'BB': 'Big Blind. Forced full bet posted before cards are dealt. Defends the widest range preflop.',
  'UTG': 'Under The Gun. First to act preflop. Worst position, play tight here.',
  'UTG+1': 'One seat after UTG. Still early position with poor information.',
  'MP': 'Middle Position. Moderate positional advantage, can widen range slightly.',
  'LJ': 'Lojack. Three seats before the button. Early-middle position, start of the steal zone.',
  'HJ': 'Hijack. Two seats before the button. Late-middle position with decent steal opportunity.',
  'CO': 'Cutoff. One seat before the button. Strong stealing position, second best seat.',
  'Preflop': 'The betting round before any community cards are dealt. Each player has only their two hole cards.',
  'Flop': 'The first three community cards dealt face up. This is where hand strength becomes clearer.',
  'Turn': 'The fourth community card. Bets typically double here.',
  'River': 'The fifth and final community card. Last chance to bet or bluff.',
  'Fold': 'Discard your hand and forfeit any chips already in the pot.',
  'Check': 'Pass the action without betting, only available if nobody has bet in the current round.',
  'Bet': 'Place the first wager in a betting round. Distinct from a raise, which increases an existing bet.',
  'Call': 'Match the current bet to stay in the hand.',
  'Raise': 'Increase the current bet, forcing others to put in more to continue.',
  'Bluff': 'Betting or raising with a weak hand to make opponents fold better hands.',
  'Semi-Bluff': 'Betting with a drawing hand that could improve. You win if they fold now or if you hit your draw.',
  'Value Bet': 'Betting a strong hand to extract chips from weaker hands that will call.',
  'Showdown': 'When remaining players reveal their cards after the final betting round to determine the winner.',
  'Equity': 'Your share of the pot based on the probability of winning. 50% equity in a $100 pot means $50 expected value.',
  'EV Diff': 'The difference between your actual result and your expected value. Positive means you ran above expectation.',
  'Fair Share': 'The portion of the pot you "deserve" based on your equity at the time of an all-in.',
};

function switchTab(tabId) {
  document.querySelectorAll('.panel').forEach(function(p) { p.classList.remove('on'); });
  var panel = document.getElementById('p-' + tabId);
  if (panel) panel.classList.add('on');
  document.querySelectorAll('.tab-item').forEach(function(t) { t.classList.remove('active'); });
  document.querySelectorAll('.tab-menu-btn').forEach(function(b) { b.classList.remove('active'); });
  var item = document.querySelector('.tab-item[data-tab="' + tabId + '"]');
  if (item) {
    item.classList.add('active');
    var menu = item.closest('.tab-menu');
    if (menu) menu.querySelector('.tab-menu-btn').classList.add('active');
  } else {
    var directBtn = document.querySelector('.tab-menu-btn[data-tab="' + tabId + '"]');
    if (directBtn) directBtn.classList.add('active');
  }
  document.querySelectorAll('.tab-menu').forEach(function(m) { m.classList.remove('open'); });
  var pw = document.getElementById('panels-wrap');
  if (pw) pw.classList.remove('blurred');
}

function _toggleBackdrop(show) {
  var pw = document.getElementById('panels-wrap');
  if (pw) pw.classList.toggle('blurred', show);
}

(function() {
  document.addEventListener('click', function(e) {
    var btn = e.target.closest('.tab-menu-btn');
    if (btn) {
      e.stopPropagation();
      if (btn.dataset.tab) {
        document.querySelectorAll('.tab-menu').forEach(function(m) { m.classList.remove('open'); });
        _toggleBackdrop(false);
        switchTab(btn.dataset.tab);
        return;
      }
      var menu = btn.closest('.tab-menu');
      var wasOpen = menu.classList.contains('open');
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
    document.querySelectorAll('.tab-menu').forEach(function(m) { m.classList.remove('open'); });
    _toggleBackdrop(false);
  });
})();

function renderMiniRow(items, opts) {
  opts = opts || {};
  var rowAttrs = '';
  if (opts.columns) rowAttrs += ' style="grid-template-columns:' + opts.columns + ';"';
  else if (opts.dim) rowAttrs += ' style="opacity:0.45"';
  if (opts.columns && opts.dim) rowAttrs = ' style="grid-template-columns:' + opts.columns + ';opacity:0.45;"';
  return '<div class="mini-row"' + rowAttrs + '>' + items.map(function(m) {
    var color = m.c === 'g' ? 'green' : m.c === 'r' ? 'red' : m.c === 'a' ? 'amber' : m.c || 'text';
    var dot = m.dot ? '<span class="line-dot ' + m.dot + '"></span> ' : '';
    return '<div class="mini"><div class="mini-l label">' + dot + m.l + '</div><div class="value" style="color:var(--' + color + ')">' + m.v + '</div></div>';
  }).join('') + '</div>';
}

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

function tipWrap(label) {
  const def = TIPS[label];
  if (!def) return label;
  return '<span class="tooltip">' + label + ' <span class="text-micro tip-q">?</span><span class="tip-box">' + def + '</span></span>';
}

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
    ? '<div class="ins-coaching"><div class="label gold ins-coaching-head">Coaching</div><div class="text-body">' + coaching + '</div></div>'
    : '';
  return '<div class="card card-s2 card-flat ins"><div class="ins-badge ' + sev + '"><div class="dot"></div><div class="ins-word">' + words[sev] + '</div></div><div class="ins-title">' + label + '</div><div class="text-body ins-text">' + text + '</div>' + chipHtml + coachingHtml + '</div>';
}

function insWithExample(sev, label, text, chips, exampleHands, coachingNote, coaching) {
  const base = ins(sev, label, text, chips, coaching);
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

function renderInsights(insArr, fallbackLabel, fallbackText) {
  if (!insArr.length) {
    insArr.push(ins('n', fallbackLabel, fallbackText || 'More hands needed for ' + fallbackLabel.toLowerCase() + ' patterns.', []));
  }
  return '<div class="grid-auto ins-grid">' + insArr.join('') + '</div>';
}

function renderResult(h, tag, baseClass) {
  var pnl = getHandPnl(h);
  return '<' + tag + ' class="' + baseClass + ' ' + pnl.cls + '">' + pnl.text + '</' + tag + '>';
}

function handTagsHtml(h) {
  if (!h || !h.seatBucket) return '';
  var parts = [];
  parts.push('<span class="ht-tag ht-seat">' + h.seatBucket + '</span>');
  if (h.flopBucket) {
    parts.push('<span class="ht-tag ht-flop ht-flop-' + h.flopBucket.replace('-', '_') + '">' + h.flopBucket + '</span>');
  }
  return '<span class="ht-tags">' + parts.join('') + '</span>';
}

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

function renderPagination(page, totalItems, pageSize, prevId, nextId) {
  var totalPages = Math.ceil(totalItems / pageSize);
  if (totalPages <= 1) return '';
  return '<button class="btn btn-ghost" id="' + prevId + '" ' + (page === 0 ? 'disabled' : '') + '>&laquo; Prev</button>' +
    '<span class="text-meta">Page ' + (page + 1) + '/' + totalPages + '</span>' +
    '<button class="btn btn-ghost" id="' + nextId + '" ' + (page >= totalPages - 1 ? 'disabled' : '') + '>Next &raquo;</button>';
}

function barRow(label, val, max, cls, valStr, val2Str) {
  const w = max > 0 ? clamp(Math.round(val / max * 100), 0, 100) : 0;
  return '<div class="bar-row ' + (val2Str ? 'bw3' : 'bw2') + '">' +
    '<div class="gold-heading bar-name">' + label + '</div>' +
    '<div class="bar-track"><div class="bar-fill ' + cls + '" style="width:' + w + '%"></div></div>' +
    '<div class="text-meta bar-val">' + valStr + '</div>' +
    (val2Str ? '<div class="text-micro bar-val2">' + val2Str + '</div>' : '') +
    '</div>';
}


/* ===== merged from panel-shared.js ===== */
function panelTitle(text) {
  return '<div class="panel-title">' + text + '</div>';
}

function panelDesc(text) {
  return '<div class="text-body panel-desc">' + text + '</div>';
}

function panelHeader(title, desc) {
  return panelTitle(title) + (desc ? panelDesc(desc) : '');
}

function dimLabel(text) {
  return '<div class="label">' + text + '</div>';
}

function descText(text) {
  return '<div class="text-body">' + text + '</div>';
}

function pRow(body, label) {
  var html = '<div class="p-row">';
  if (label) html += dimLabel(label);
  html += (body || '');
  html += '</div>';
  return html;
}

function insGrid(items, label) {
  if (!items || !items.length) return '';
  var inner = '<div class="grid-auto ins-grid">' + items.join('') + '</div>';
  return label ? pRow(inner, label) : inner;
}

function mountPanel(container, html) {
  if (!container) return;
  container.innerHTML = html;
}

function mountTemplate(container, name) {
  if (!container) return;
  var TPL = (typeof window !== 'undefined' && window.__TPL) || {};
  var html = TPL[name];
  if (html == null) {
    console.warn('[panel-shared] missing template for "' + name + '"');
    container.innerHTML = '';
    return;
  }
  container.innerHTML = html;
}

function bind(root, data) {
  if (!root || !data) return;
  var nodes = root.querySelectorAll('[data-bind]');
  for (var i = 0; i < nodes.length; i++) {
    var key = nodes[i].getAttribute('data-bind');
    if (key in data) nodes[i].textContent = (data[key] == null ? '' : String(data[key]));
  }
}

// innerHTML variant: only pass markup the caller controls, never user strings.
function bindHtml(root, data) {
  if (!root || !data) return;
  var nodes = root.querySelectorAll('[data-bind-html]');
  for (var i = 0; i < nodes.length; i++) {
    var key = nodes[i].getAttribute('data-bind-html');
    if (key in data) nodes[i].innerHTML = (data[key] == null ? '' : String(data[key]));
  }
}

function setSlot(root, name, html) {
  if (!root) return null;
  var el = root.querySelector('[data-slot="' + name + '"]');
  if (!el) return null;
  el.innerHTML = html || '';
  return el;
}

// Classify a value against a [lo, hi] band. Returns { cls, label } using the
// shared v-* color classes. null value -> no-data.
function bandVerdict(value, lo, hi) {
  if (value == null) return { cls: 'v-na', label: 'no data' };
  if (value < lo) return { cls: 'v-low', label: 'too low' };
  if (value > hi) return { cls: 'v-high', label: 'too high' };
  return { cls: 'v-ok', label: 'on target' };
}

// Format a {tight, loose} band as "X-Y%". '-' when absent.
function fmtBandRange(band) {
  if (!band) return '-';
  return Math.round(band.tight) + '-' + Math.round(band.loose) + '%';
}

// Build a <tr> of <th> from column specs. Each spec is one of:
//   '' / null            -> empty <th></th>
//   'Plain'              -> <th>Plain</th> (raw HTML allowed)
//   { tip: 'Win Rate' }  -> <th> with tipWrap(label)
//   { html: '...' }      -> <th> with custom inner HTML
//   { label/tip, sort: 'key' } -> sortable <th data-sort-col="key"> with arrow
// sortState is { col, dir } and drives the active-column arrow.
function renderTableHead(cols, sortState) {
  function arrow(key) {
    if (!sortState || sortState.col !== key) return '';
    return sortState.dir === 'asc' ? ' &#9650;' : ' &#9660;';
  }
  var ths = cols.map(function(c) {
    if (c == null || c === '') return '<th></th>';
    if (typeof c === 'string') return '<th>' + c + '</th>';
    var label = c.tip ? tipWrap(c.tip) : (c.html != null ? c.html : c.label);
    if (c.sort) return '<th class="sortable" data-sort-col="' + c.sort + '">' + label + arrow(c.sort) + '</th>';
    return '<th>' + label + '</th>';
  });
  return '<tr>' + ths.join('') + '</tr>';
}

// Templates must provide a `verdict` slot and a `findings` slot.
function mountFindings(root, panelName, d, hands, fallback) {
  if (typeof Sections === 'undefined' || typeof Sections.evaluateSections !== 'function') {
    return [];
  }
  var findings = Sections.findingsForPanel(Sections.evaluateSections(d, {}, hands), panelName);
  setSlot(root, 'verdict', Sections.renderVerdict(findings, fallback));
  var slot = root.querySelector('[data-slot="findings"]');
  if (slot) {
    if (findings.length) {
      slot.innerHTML = Sections.renderFindings(findings);
      slot.removeAttribute('hidden');
    } else {
      slot.innerHTML = '';
      slot.setAttribute('hidden', '');
    }
  }
  return findings;
}

// Clone `<template data-row>` inside `[data-fill="key"]` once per item.
// onClone(rowEl, item, index) wires per-row events the template cannot express.
function fillRows(root, key, items, onClone) {
  if (!root || !items) return [];
  var holder = root.querySelector('[data-fill="' + key + '"]');
  if (!holder) return [];
  var tpl = holder.querySelector('template[data-row]');
  if (!tpl) return [];
  while (holder.lastChild && holder.lastChild !== tpl) {
    holder.removeChild(holder.lastChild);
  }
  var appended = [];
  for (var i = 0; i < items.length; i++) {
    var frag = tpl.content.cloneNode(true);
    bind(frag, items[i]);
    bindHtml(frag, items[i]);
    var firstEl = null;
    for (var c = 0; c < frag.childNodes.length; c++) {
      if (frag.childNodes[c].nodeType === 1) { firstEl = frag.childNodes[c]; break; }
    }
    if (onClone && firstEl) onClone(firstEl, items[i], i);
    holder.appendChild(frag);
    if (firstEl) appended.push(firstEl);
  }
  return appended;
}


/* ===== merged from ui-bindings.js ===== */
(function() {
  function bind() {
    var pageMeta = document.getElementById('page-meta');
    if (pageMeta) {
      pageMeta.addEventListener('click', function() {
        if (typeof switchTab === 'function') switchTab('mygame');
      });
    }

    var tourBtn = document.getElementById('tour-btn');
    if (tourBtn) {
      tourBtn.addEventListener('click', function() {
        if (typeof startGuidedTour === 'function') startGuidedTour();
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }
})();
