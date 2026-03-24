// ── SAVED HANDS PANEL ────────────────────────────────────────────────────────

function renderSavedHands(container) {
  var map = getStarredHands();
  var keys = Object.keys(map);

  if (!keys.length) {
    container.innerHTML = '<div style="text-align:center;padding:40px 20px;">' +
      '<div style="font-size:28px;color:var(--gold2);margin-bottom:12px;">&#9734;</div>' +
      '<div style="font-size:14px;color:var(--dim);margin-bottom:8px;">No saved hands yet</div>' +
      '<div style="font-size:11px;color:var(--muted);max-width:320px;margin:0 auto;line-height:1.6;">Click any hand in the Hand Log to open it, then click the star to save it. Add notes to remember key decisions or situations.</div>' +
      '</div>';
    return;
  }

  // Sort by savedAt descending
  keys.sort(function(a, b) {
    return (map[b].savedAt || '') > (map[a].savedAt || '') ? 1 : -1;
  });

  var html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">' +
    '<div class="sec-subtitle" style="margin:0;">' + keys.length + ' Saved Hand' + (keys.length !== 1 ? 's' : '') + '</div>' +
    '<div style="font-size:9px;color:var(--dim);">Click to replay · hover note to read</div>' +
    '</div>';

  html += '<div class="saved-hands-list">';
  for (var i = 0; i < keys.length; i++) {
    var entry = map[keys[i]];
    var h = entry.hand;
    if (!h) continue;

    var myActs = getActsSummary(h);
    var res = renderResult(h, 'span', 'saved-res');

    var notePreview = entry.note
      ? '<div class="saved-note-preview">' + entry.note.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, ' ') + '</div>'
      : '';

    var savedDate = entry.savedAt ? new Date(entry.savedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '';

    html += '<div class="saved-card" data-saved-key="' + keys[i].replace(/"/g, '&quot;') + '">' +
      '<div class="saved-card-top">' +
        '<div class="saved-card-hole">' + (h.hole ? h.hole.join(' ') : '??') + '</div>' +
        '<div class="saved-card-meta">' +
          '<span class="saved-pos">' + (h.position || '?') + '</span>' +
          res +
        '</div>' +
        '<button class="saved-unsave" data-unsave-key="' + keys[i].replace(/"/g, '&quot;') + '" title="Remove from saved">&#9733;</button>' +
      '</div>' +
      '<div class="saved-card-board">' + (h.board && h.board.length ? h.board.join(' ') : 'No board') + '</div>' +
      '<div class="saved-card-acts">' + (myActs || 'No actions') + '</div>' +
      (notePreview ? '<div class="saved-card-note-wrap">' + notePreview + '</div>' : '<div class="saved-card-note-empty">No notes</div>') +
      '<div class="saved-card-date">' + savedDate + '</div>' +
      '</div>';
  }
  html += '</div>';

  container.innerHTML = html;

  // Wire click to open modal
  container.querySelectorAll('.saved-card').forEach(function(card) {
    card.onclick = function(e) {
      if (e.target.closest('.saved-unsave')) return;
      var key = this.getAttribute('data-saved-key');
      var entry = map[key];
      if (entry && entry.hand) showExampleHandModal(entry.hand);
    };
  });

  // Wire unsave buttons
  container.querySelectorAll('.saved-unsave').forEach(function(btn) {
    btn.onclick = function(e) {
      e.stopPropagation();
      var key = this.getAttribute('data-unsave-key');
      var m = getStarredHands();
      delete m[key];
      setStarredHands(m);
      renderSavedHands(container);
    };
  });
}
