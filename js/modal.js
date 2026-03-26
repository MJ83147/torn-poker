// ── MODAL (example hand modal system) ─────────────────────────────────────────

function showExampleHandModal(hand, coachingNote) {
  var existing = document.getElementById('example-hand-modal');
  if (existing) existing.remove();

  var overlay = document.createElement('div');
  overlay.id = 'example-hand-modal';
  overlay.className = 'modal-overlay';
  overlay.onclick = function(e) { if (e.target === overlay) closeModal(); };

  var box = document.createElement('div');
  box.className = 'modal-box';
  box.style.position = 'relative';

  var closeBtn = '<button class="modal-close" id="modal-close-btn">&times;</button>';
  var title = '<div class="modal-title serif-value">' + (hand.hole ? hand.hole.join(' ') : '??') + '</div>';
  var subtitle = '<div class="modal-subtitle dim-label">Example hand · ' + (hand.position || '?') + ' position</div>';

  var metaHtml = '<div class="modal-hand-meta">' +
    '<span>Board: <strong>' + (hand.board && hand.board.length ? hand.board.join(' ') : 'none') + '</strong></span>' +
    '<span>Pot: <strong>' + fmtBB(hand.pot || 0, getHandBB(hand)) + '</strong></span>' +
    '<span>Result: <strong>' + (hand.outcome ? hand.outcome.result : '?') + '</strong></span>' +
    '</div>';

  var actionsHtml = '';
  var actions = hand.actions || [];
  for (var i = 0; i < actions.length; i++) {
    var raw = (actions[i] || '');
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
    ? '<div class="modal-coaching"><div class="modal-coaching-label dim-label">What to improve</div>' + coachingNote + '</div>'
    : '';

  var starred = isHandStarred(hand);
  var starBtn = '<button class="modal-star-btn' + (starred ? ' starred' : '') + '" id="modal-star-btn" title="' + (starred ? 'Unsave hand' : 'Save hand') + '">' + (starred ? '&#9733;' : '&#9734;') + '</button>';

  var noteVal = getHandNote(hand).replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  var notesSection = '<div class="modal-notes' + (starred ? ' show' : '') + '" id="modal-notes">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">' +
      '<div class="modal-notes-label dim-label" style="margin-bottom:0;">Your Notes</div>' +
      '<div class="modal-notes-status" id="modal-notes-status" style="font-size:9px;color:var(--muted);transition:color .3s;">Saves automatically</div>' +
    '</div>' +
    '<textarea class="modal-notes-input" id="modal-notes-input" placeholder="Add notes about this hand...">' + noteVal + '</textarea>' +
    '</div>';

  var equitySlot = '<div id="equity-slot"></div>';
  box.innerHTML = closeBtn + starBtn + title + subtitle + metaHtml + actionsHtml + coaching + equitySlot + notesSection;
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  requestAnimationFrame(function() { overlay.classList.add('show'); });

  if (typeof injectEquityButton === 'function') {
    injectEquityButton(box, hand);
  }
  document.getElementById('modal-close-btn').onclick = closeModal;

  document.getElementById('modal-star-btn').onclick = function() {
    var nowStarred = toggleStarHand(hand);
    this.innerHTML = nowStarred ? '&#9733;' : '&#9734;';
    this.classList.toggle('starred', nowStarred);
    this.title = nowStarred ? 'Unsave hand' : 'Save hand';
    var notesEl = document.getElementById('modal-notes');
    if (notesEl) notesEl.classList.toggle('show', nowStarred);
    // refresh saved hands section in log panel
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
    m.classList.remove('show');
    setTimeout(function() { m.remove(); }, 200);
  }
}

function findExampleHand(filterFn) {
  for (var i = State.modalHands.length - 1; i >= 0; i--) {
    if (filterFn(State.modalHands[i])) return State.modalHands[i];
  }
  return null;
}
