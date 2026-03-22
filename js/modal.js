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
  var title = '<div class="modal-title">' + (hand.hole ? hand.hole.join(' ') : '??') + '</div>';
  var subtitle = '<div class="modal-subtitle">Example hand · ' + (hand.position || '?') + ' position</div>';

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
    ? '<div class="modal-coaching"><div class="modal-coaching-label">What to improve</div>' + coachingNote + '</div>'
    : '';

  box.innerHTML = closeBtn + title + subtitle + metaHtml + actionsHtml + coaching;
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  requestAnimationFrame(function() { overlay.classList.add('show'); });
  document.getElementById('modal-close-btn').onclick = closeModal;
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
