// Render a structured action (v2 object) or legacy-parsed action into readable
// text. parseActions() normalises both formats to the same {type, amount, ...}
// shape, so this single path covers v1 strings and v2 objects alike.
function describeAction(a, hand) {
  function amt(v) { return fmtBB(v || 0, getHandBB(hand)); }
  switch (a.type) {
    case 'sb': return 'posted small blind ' + amt(a.amount);
    case 'bb': return 'posted big blind ' + amt(a.amount);
    case 'fold': return 'folded';
    case 'check': return 'checked';
    case 'call': return 'called ' + amt(a.amount);
    case 'bet': return 'bet ' + amt(a.amount) + (a.allIn ? ' (all in)' : '');
    case 'raise':
      if (typeof a.raiseTo === 'number' && a.raiseTo) {
        return 'raised to ' + amt(a.raiseTo) + (a.allIn ? ' (all in)' : '');
      }
      return 'raised ' + amt(a.amount) + (a.allIn ? ' (all in)' : '');
    case 'won': return 'won ' + amt(a.amount);
    default: return a.msg || a.type || '';
  }
}

// Action replay: each street is its own .section headed by a .section-head
// ("Turn 3♥" — street name plus the dealt card(s) as coloured suit symbols),
// with that street's action lines grouped in a single list block below it.
function buildModalActionLines(hand) {
  var acts = parseActions(hand.actions) || [];
  var board = (hand.board || []).map(normCard);
  var streetBoard = { Flop: board.slice(0, 3), Turn: board.slice(3, 4), River: board.slice(4, 5) };
  var html = '';
  var lastStreet = null;
  var open = false;
  for (var i = 0; i < acts.length; i++) {
    var a = acts[i];
    if (!a || !a.type) continue;
    if (a.street && a.street !== lastStreet) {
      lastStreet = a.street;
      if (open) html += '</div></div>';
      var bc = streetBoard[a.street] || [];
      html += '<div class="section">' +
        '<div class="section-head">' + a.street + (bc.length ? ' ' + displayCards(bc) : '') + '</div>' +
        '<div class="list">';
      open = true;
    } else if (!open) {
      // Actions with no street marker before the first street: headerless section.
      html += '<div class="section"><div class="list">';
      open = true;
    }
    var isMe = !!a.isMe;
    html += '<div class="text-meta' + (isMe ? ' c-gold' : '') + '">' +
      (isMe ? '▸ ' : '  ') + (a.author || '?') + ': ' + describeAction(a, hand) + '</div>';
  }
  if (open) html += '</div></div>';
  return html;
}

// Per-player "stack before -> after" block for the hand-replay modal.
// Renders only when hand.stacks has entries. Every value is guarded: absent
// stacks show as an em dash, never as 0. Hero is listed first, then others in
// their given order.
function buildStacksBlock(hand) {
  if (!hand || !hand.stacks || !hand.stacks.length) return '';
  var bb = getHandBB(hand);
  var players = hand.stacks.slice();
  players.sort(function(a, b) {
    return (b && b.isHero ? 1 : 0) - (a && a.isHero ? 1 : 0);
  });
  var rows = players.map(function(p) {
    if (!p) return '';
    var name = p.name || (p.isHero ? 'You' : '?');
    if (p.isHero) name = 'You';
    var start = p.startStack != null ? fmtBB(p.startStack, bb) : '—';
    var end = p.endStack != null ? fmtBB(p.endStack, bb) : '—';
    var netHtml = '';
    if (p.profit != null) {
      netHtml = '<span class="' + pnlValCls(p.profit) + '">' + fmtPnl(p.profit) + '</span>';
    }
    return '<div class="row between center">' +
      '<span class="text-meta' + (p.isHero ? ' c-gold' : '') + '">' + name + '</span>' +
      '<span class="text-meta">' + start + ' &rarr; ' + end + '</span>' +
      '<span class="text-meta">' + netHtml + '</span>' +
      '</div>';
  }).join('');
  return '<div class="section">' +
    '<div class="section-head">Stacks (before &rarr; after)</div>' +
    '<div class="list">' + rows + '</div>' +
    '</div>';
}

function createExampleModal() {
  var existing = document.getElementById('example-hand-modal');
  if (existing) existing.remove();

  var overlay = document.createElement('div');
  overlay.id = 'example-hand-modal';
  overlay.className = 'overlay';
  overlay.onclick = function(e) { if (e.target === overlay) closeModal(); };

  var box = document.createElement('div');
  box.className = 'modal';

  return { overlay: overlay, box: box };
}

function mountExampleModal(overlay, box) {
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  requestAnimationFrame(function() { overlay.classList.add(CSS.SHOW); });
  document.getElementById('modal-close-btn').onclick = closeModal;
}

function showExampleHandModal(hand, coachingNote) {
  var modal = createExampleModal();
  var overlay = modal.overlay;
  var box = modal.box;

  if (typeof annotateHandDynamics === 'function') annotateHandDynamics(hand);

  var closeBtn = '<button class="modal-close" id="modal-close-btn">&times;</button>';
  var tagStrip = handTagsHtml(hand);
  var header = '<div class="panel-header">' +
    '<div class="title title-lg c-gold">' + (hand.hole && hand.hole.length ? displayCards(hand.hole.map(normCard)) : '??') + '</div>' +
    '<div class="eyebrow">Example hand · ' + (hand.position || '?') + ' position' + (tagStrip ? ' · ' + tagStrip : '') + '</div>' +
    '</div>';

  var metaHtml = '<div class="section"><div class="row center">' +
    '<span class="text-meta">Board: ' + (hand.board && hand.board.length ? displayCards(hand.board.map(normCard)) : 'none') + '</span>' +
    '<span class="text-meta">Pot: <strong class="c-gold">' + fmtBB(hand.pot || 0, getHandBB(hand)) + '</strong></span>' +
    (function() {
      var pnl = getHandPnl(hand);
      var res = hand.outcome ? hand.outcome.result : '?';
      var label = res;
      if (res === 'folded' && pnl.text !== 'folded') label = 'folded ' + pnl.text;
      else if (res === 'won') label = 'won ' + pnl.text;
      else if (res === 'lost') label = 'lost ' + pnl.text;
      return '<span class="text-meta">Result: <strong class="' + pnl.cls + '">' + label + '</strong></span>';
    })() +
    '</div></div>';

  var stacksHtml = buildStacksBlock(hand);

  var actionsHtml = buildModalActionLines(hand);

  var coaching = coachingNote
    ? '<div class="section">' +
        '<div class="section-head c-warn">What to improve</div>' +
        '<div class="card card-s2"><div class="text-body">' + coachingNote + '</div></div>' +
      '</div>'
    : '';

  var starred = isHandStarred(hand);
  var starBtn = '<button class="btn btn-icon modal-star-btn' + (starred ? ' starred' : '') + '" id="modal-star-btn" title="' + (starred ? 'Unsave hand' : 'Save hand') + '">' + (starred ? '&#9733;' : '&#9734;') + '</button>';

  var noteVal = getHandNote(hand).replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  var notesSection = '<div class="modal-notes' + (starred ? ' show' : '') + '" id="modal-notes">' +
    '<div class="row between modal-notes-header">' +
      '<div class="eyebrow">Your Notes</div>' +
      '<div class="text-micro modal-notes-status" id="modal-notes-status">Saves automatically</div>' +
    '</div>' +
    '<textarea id="modal-notes-input" placeholder="Add notes about this hand...">' + noteVal + '</textarea>' +
    '</div>';

  var equitySlot = '<div class="eq-slot" id="equity-slot"></div>';
  box.innerHTML = closeBtn + starBtn + header + metaHtml + stacksHtml + equitySlot + actionsHtml + coaching + notesSection;
  mountExampleModal(overlay, box);

  if (typeof injectEquityButton === 'function') {
    injectEquityButton(box, hand);
  }

  document.getElementById('modal-star-btn').onclick = function() {
    var nowStarred = toggleStarHand(hand);
    this.innerHTML = nowStarred ? '&#9733;' : '&#9734;';
    this.classList.toggle(CSS.STARRED, nowStarred);
    this.title = nowStarred ? 'Unsave hand' : 'Save hand';
    var notesEl = document.getElementById('modal-notes');
    if (notesEl) notesEl.classList.toggle(CSS.SHOW, nowStarred);
    renderSavedHands();
  };

  var notesInput = document.getElementById('modal-notes-input');
  if (notesInput) {
    var debounceTimer;
    notesInput.oninput = function() {
      var val = this.value;
      var statusEl = document.getElementById('modal-notes-status');
      if (statusEl) { statusEl.textContent = 'Saving...'; statusEl.style.color = 'var(--dim)'; }
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function() {
        setHandNote(hand, val);
        if (statusEl) { statusEl.textContent = 'Saved'; statusEl.style.color = 'var(--green)'; }
        setTimeout(function() { if (statusEl) { statusEl.textContent = 'Saves automatically'; statusEl.style.color = 'var(--muted)'; } }, 1500);
        renderSavedHands();
      }, 300);
    };
  }
}

function closeModal() {
  var m = document.getElementById('example-hand-modal');
  if (m) {
    m.classList.remove(CSS.SHOW);
    setTimeout(function() { m.remove(); }, 200);
  }
}

function findExampleHand(filterFn) {
  var results = [];
  for (var i = State.modalHands.length - 1; i >= 0; i--) {
    if (filterFn(State.modalHands[i])) results.push(State.modalHands[i]);
  }
  return results;
}

function buildHandRow(h, idx) {
  var myActs = getActsSummary(h);
  var res = renderResult(h, 'span', 'saved-res range-hand-row-result');
  return '<div class="range-hand-row" data-ridx="' + idx + '">' +
    '<div class="row between">' +
      '<div class="row center">' +
        '<span class="eyebrow range-hand-row-pos">' + (h.position || '?') + '</span>' +
        '<span class="range-hand-row-hole">' + (h.hole && h.hole.length ? displayCards(h.hole.map(normCard)) : '??') + '</span>' +
        '<span class="text-meta range-hand-row-board">' + (h.board && h.board.length ? displayCards(h.board.map(normCard)) : '-') + '</span>' +
      '</div>' +
      '<div class="row center">' + res + '</div>' +
    '</div>' +
    '<div class="text-meta range-hand-row-actions">' + myActs + '</div>' +
    '</div>';
}

function showExampleHandListModal(title, handsList, coachingNote) {
  var BATCH = 10;
  var shown = 0;

  var modal = createExampleModal();
  var overlay = modal.overlay;
  var box = modal.box;

  var header = '<div class="panel-header">' +
    '<div class="title title-lg c-gold">' + title + '</div>' +
    '<div class="text-meta">' + handsList.length + ' example hand' + (handsList.length !== 1 ? 's' : '') + '</div>' +
    '</div>';

  if (coachingNote) {
    header += '<div class="section">' +
      '<div class="section-head c-warn">What to look for</div>' +
      '<div class="card card-s2"><div class="text-body">' + coachingNote + '</div></div>' +
      '</div>';
  }

  box.innerHTML = '<button class="modal-close" id="modal-close-btn">&times;</button>' +
    header + '<div id="hand-list-rows"></div>';

  var rowsContainer = box.querySelector('#hand-list-rows');

  function wireRow(row) {
    row.onclick = function() {
      var idx = parseInt(row.getAttribute('data-ridx'));
      if (!isNaN(idx) && handsList[idx]) showExampleHandModal(handsList[idx], coachingNote);
    };
  }

  function loadBatch() {
    var end = Math.min(shown + BATCH, handsList.length);
    for (var i = shown; i < end; i++) {
      var tmp = document.createElement('div');
      tmp.innerHTML = buildHandRow(handsList[i], i);
      var row = tmp.firstChild;
      wireRow(row);
      rowsContainer.appendChild(row);
    }
    shown = end;
    updateLoadMore();
  }

  function updateLoadMore() {
    var existing = box.querySelector('#load-more-btn');
    if (existing) existing.remove();
    var remaining = handsList.length - shown;
    if (remaining > 0) {
      var btn = document.createElement('button');
      btn.id = 'load-more-btn';
      btn.className = 'btn btn-ghost';
      btn.textContent = 'Load more (' + remaining + ' remaining)';
      btn.onclick = loadBatch;
      rowsContainer.parentNode.appendChild(btn);
    }
  }

  mountExampleModal(overlay, box);

  loadBatch();
}
