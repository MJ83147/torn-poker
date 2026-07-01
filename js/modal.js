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

function buildModalActionLines(hand) {
  var acts = parseActions(hand.actions) || [];
  var board = hand.board || [];
  var streetBoard = { Flop: board.slice(0, 3), Turn: board.slice(3, 4), River: board.slice(4, 5) };
  var html = '';
  var lastStreet = null;
  for (var i = 0; i < acts.length; i++) {
    var a = acts[i];
    if (!a || !a.type) continue;
    if (a.street && a.street !== lastStreet) {
      lastStreet = a.street;
      if (a.street !== 'Preflop') {
        var bc = streetBoard[a.street] || [];
        html += '<div class="eyebrow pt-8">' + a.street +
          (bc.length ? ': ' + bc.join(' ') : '') + '</div>';
      }
    }
    var isMe = !!a.isMe;
    html += '<div class="text-meta modal-action-line' + (isMe ? ' me' : '') + '">' +
      (isMe ? '▸ ' : '  ') + (a.author || '?') + ': ' + describeAction(a, hand) + '</div>';
  }
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
    return '<div class="stack-row">' +
      '<span class="text-meta' + (p.isHero ? ' c-gold' : '') + '">' + name + '</span>' +
      '<span class="text-meta">' + start + ' &rarr; ' + end + '</span>' +
      '<span class="text-meta">' + netHtml + '</span>' +
      '</div>';
  }).join('');
  return '<div class="player-stacks col gap-6">' +
    '<div class="eyebrow">Stacks (before &rarr; after)</div>' +
    '<div>' + rows + '</div></div>';
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
  box.style.position = 'relative';

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
  var title = '<div class="col gap-4 mb-16">' +
    '<div class="title title-md c-gold">' + (hand.hole ? hand.hole.join(' ') : '??') + '</div>' +
    '<div class="eyebrow">Example hand · ' + (hand.position || '?') + ' position' + (tagStrip ? ' · ' + tagStrip : '') + '</div>' +
    '</div>';
  var subtitle = '';

  var metaHtml = '<div class="text-meta modal-hand-meta row gap-16">' +
    '<span>Board: <strong>' + (hand.board && hand.board.length ? hand.board.join(' ') : 'none') + '</strong></span>' +
    '<span>Pot: <strong>' + fmtBB(hand.pot || 0, getHandBB(hand)) + '</strong></span>' +
    (function() {
      var pnl = getHandPnl(hand);
      var res = hand.outcome ? hand.outcome.result : '?';
      var label = res;
      if (res === 'folded' && pnl.text !== 'folded') label = 'folded ' + pnl.text;
      else if (res === 'won') label = 'won ' + pnl.text;
      else if (res === 'lost') label = 'lost ' + pnl.text;
      return '<span>Result: <strong class="' + pnl.cls + '">' + label + '</strong></span>';
    })() +
    '</div>';

  var stacksHtml = buildStacksBlock(hand);

  var actionsHtml = buildModalActionLines(hand);

  var coaching = coachingNote
    ? '<div class="card card-s2 text-body modal-coaching col gap-6"><div class="eyebrow c-warn">What to improve</div>' + coachingNote + '</div>'
    : '';

  var starred = isHandStarred(hand);
  var starBtn = '<button class="icon-btn modal-star-btn' + (starred ? ' starred' : '') + '" id="modal-star-btn" title="' + (starred ? 'Unsave hand' : 'Save hand') + '">' + (starred ? '&#9733;' : '&#9734;') + '</button>';

  var noteVal = getHandNote(hand).replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  var notesSection = '<div class="modal-notes' + (starred ? ' show' : '') + '" id="modal-notes">' +
    '<div class="row between modal-notes-header">' +
      '<div class="eyebrow">Your Notes</div>' +
      '<div class="text-micro modal-notes-status" id="modal-notes-status">Saves automatically</div>' +
    '</div>' +
    '<textarea id="modal-notes-input" placeholder="Add notes about this hand...">' + noteVal + '</textarea>' +
    '</div>';

  var equitySlot = '<div id="equity-slot"></div>';
  box.innerHTML = closeBtn + starBtn + title + subtitle + metaHtml + stacksHtml + equitySlot + actionsHtml + coaching + notesSection;
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
      '<div class="row center gap-12">' +
        '<span class="eyebrow range-hand-row-pos">' + (h.position || '?') + '</span>' +
        '<span class="range-hand-row-hole">' + (h.hole ? h.hole.join(' ') : '??') + '</span>' +
        '<span class="text-meta range-hand-row-board">' + (h.board && h.board.length ? h.board.join(' ') : '-') + '</span>' +
      '</div>' +
      '<div class="row center gap-12">' + res + '</div>' +
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
  box.style.maxHeight = '80vh';
  box.style.overflowY = 'auto';

  var header = '<div class="col gap-4 mb-16">' +
    '<div class="title title-md c-gold">' + title + '</div>' +
    '<div class="text-meta">' + handsList.length + ' example hand' + (handsList.length !== 1 ? 's' : '') + '</div>' +
    '</div>';

  if (coachingNote) {
    header += '<div class="card card-s2 text-body modal-coaching col gap-6"><div class="eyebrow c-warn">What to look for</div>' + coachingNote + '</div>';
  }

  box.innerHTML = '<button class="modal-close" id="modal-close-btn">&times;</button>' +
    header + '<div class="mt-12" id="hand-list-rows"></div>';

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
      btn.className = 'btn btn-ghost example-hand-btn';
      btn.textContent = 'Load more (' + remaining + ' remaining)';
      btn.onclick = loadBatch;
      rowsContainer.parentNode.appendChild(btn);
    }
  }

  mountExampleModal(overlay, box);

  loadBatch();
}
