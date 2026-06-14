function createExampleModal() {
  var existing = document.getElementById('example-hand-modal');
  if (existing) existing.remove();

  var overlay = document.createElement('div');
  overlay.id = 'example-hand-modal';
  overlay.className = 'modal-overlay';
  overlay.onclick = function(e) { if (e.target === overlay) closeModal(); };

  var box = document.createElement('div');
  box.className = 'modal-box';
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
  var title = '<div class="modal-title value">' + (hand.hole ? hand.hole.join(' ') : '??') + '</div>';
  var tagStrip = handTagsHtml(hand);
  var subtitle = '<div class="label mb-16">Example hand · ' + (hand.position || '?') + ' position' + (tagStrip ? ' · ' + tagStrip : '') + '</div>';

  var metaHtml = '<div class="modal-hand-meta">' +
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

  var actionsHtml = '';
  var actions = hand.actions || [];
  var prevNorm = '';
  for (var i = 0; i < actions.length; i++) {
    var raw = (actions[i] || '');
    var norm = raw.replace(/\s+/g, ' ').trim();
    if (norm === prevNorm) continue;
    prevNorm = norm;
    var decoded = raw.replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&');
    var isMe = decoded.indexOf('>>') === 0;
    var clean = decoded.replace(/^>>\s*/, '').replace(/^\s+/, '').trim();

    if (
      clean.indexOf('The flop') === 0 ||
      clean.indexOf('The turn') === 0 ||
      clean.indexOf('The river') === 0 ||
      clean.indexOf('The preflop') === 0
    ) {
      actionsHtml += '<div class="modal-action-line street-label">' +
        clean.replace(/: :/, ':').replace(/: $/, '') +
        '</div>';
    } else if (clean.indexOf(': ') > 0) {
      actionsHtml += '<div class="modal-action-line' + (isMe ? ' me' : '') + '">' +
        (isMe ? '▸ ' : '  ') + clean + '</div>';
    }
  }

  var coaching = coachingNote
    ? '<div class="modal-coaching"><div class="modal-coaching-head label">What to improve</div>' + coachingNote + '</div>'
    : '';

  var starred = isHandStarred(hand);
  var starBtn = '<button class="modal-star-btn' + (starred ? ' starred' : '') + '" id="modal-star-btn" title="' + (starred ? 'Unsave hand' : 'Save hand') + '">' + (starred ? '&#9733;' : '&#9734;') + '</button>';

  var noteVal = getHandNote(hand).replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  var notesSection = '<div class="modal-notes' + (starred ? ' show' : '') + '" id="modal-notes">' +
    '<div class="modal-notes-header">' +
      '<div class="label mb-0">Your Notes</div>' +
      '<div class="modal-notes-status" id="modal-notes-status">Saves automatically</div>' +
    '</div>' +
    '<textarea class="modal-notes-input" id="modal-notes-input" placeholder="Add notes about this hand...">' + noteVal + '</textarea>' +
    '</div>';

  var equitySlot = '<div id="equity-slot"></div>';
  box.innerHTML = closeBtn + starBtn + title + subtitle + metaHtml + equitySlot + actionsHtml + coaching + notesSection;
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
    '<div class="range-hand-row-top">' +
      '<div class="range-hand-row-side">' +
        '<span class="label range-hand-row-pos">' + (h.position || '?') + '</span>' +
        '<span class="range-hand-row-hole">' + (h.hole ? h.hole.join(' ') : '??') + '</span>' +
        '<span class="text-meta range-hand-row-board">' + (h.board && h.board.length ? h.board.join(' ') : '-') + '</span>' +
      '</div>' +
      '<div class="range-hand-row-side">' + res + '</div>' +
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

  var header = '<div class="modal-title">' + title + '</div>' +
    '<div class="mb-16">' + handsList.length + ' example hand' + (handsList.length !== 1 ? 's' : '') + '</div>';

  if (coachingNote) {
    header += '<div class="modal-coaching"><div class="modal-coaching-head label">What to look for</div>' + coachingNote + '</div>';
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
      btn.className = 'example-hand-btn';
      btn.style.marginTop = '12px';
      btn.textContent = 'Load more (' + remaining + ' remaining)';
      btn.onclick = loadBatch;
      rowsContainer.parentNode.appendChild(btn);
    }
  }

  mountExampleModal(overlay, box);

  loadBatch();
}
