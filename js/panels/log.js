// ── LOG PANEL ─────────────────────────────────────────────────────────────────

var _logPage = 0;

function renderLog(container, hands) {
  var PAGE_SIZE = 50;
  _logPage = 0;
  var allHands = hands.slice().reverse();

  function renderLogPage() {
    var start = _logPage * PAGE_SIZE;
    var end = Math.min(start + PAGE_SIZE, allHands.length);
    var pageHands = allHands.slice(start, end);

    // ── Saved hands section ──
    var savedHtml = renderSavedSection();

    var logHtml = savedHtml;
    logHtml += '<div class="flex-between mb-12">' +
      '<div class="meta-text">' + allHands.length + ' hands total · showing ' + (start + 1) + '-' + end + '</div>' +
      '<div class="flex-gap-6">' +
      renderPagination(_logPage, allHands.length, PAGE_SIZE, 'log-prev', 'log-next') +
      '</div></div>';
    logHtml += '<div class="hrow hrow-header hrow-with-star"><div class="hrow-star-col"></div><div class="hrow-pos">Pos</div><div class="hrow-cards">Cards</div><div class="hrow-board">Board</div><div class="hrow-acts">Actions</div><div class="hrow-res">Result</div></div>';
    logHtml += '<div class="hlog">' + pageHands.map(function(h, pi) {
      var globalIdx = start + pi;
      var starred = isHandStarred(h);
      var starHtml = '<div class="hrow-star-col"><span class="hrow-star' + (starred ? ' starred' : '') + '" data-star-idx="' + globalIdx + '" title="' + (starred ? 'Unsave' : 'Save') + ' hand">' + (starred ? '&#9733;' : '&#9734;') + '</span></div>';
      return renderHandRow(h, globalIdx, { starHtml: starHtml });
    }).join('') + '</div>';
    container.innerHTML = logHtml;

    // Wire saved section
    wireSavedSection(container);

    container.querySelectorAll('.hrow[data-hand-idx]').forEach(function(row) {
      row.onclick = function(e) {
        if (e.target.closest('.hrow-star')) return;
        var idx = parseInt(this.getAttribute('data-hand-idx'));
        if (!isNaN(idx) && allHands[idx]) showExampleHandModal(allHands[idx]);
      };
    });
    container.querySelectorAll('.hrow-star').forEach(function(star) {
      star.onclick = function(e) {
        e.stopPropagation();
        var idx = parseInt(this.getAttribute('data-star-idx'));
        if (isNaN(idx) || !allHands[idx]) return;
        var nowStarred = toggleStarHand(allHands[idx]);
        this.innerHTML = nowStarred ? '&#9733;' : '&#9734;';
        this.classList.toggle('starred', nowStarred);
        this.title = nowStarred ? 'Unsave' : 'Save hand';
        refreshSavedSection(container);
      };
    });
    var prevBtn = document.getElementById('log-prev');
    var nextBtn = document.getElementById('log-next');
    if (prevBtn) prevBtn.onclick = function() { _logPage--; renderLogPage(); };
    if (nextBtn) nextBtn.onclick = function() { _logPage++; renderLogPage(); };
  }
  renderLogPage();
}

// ── Saved hands section (inside log panel) ────────────────────────────────────

function renderSavedSection() {
  var map = getStarredHands();
  var keys = Object.keys(map);

  if (!keys.length) return '';

  keys.sort(function(a, b) {
    return (map[b].savedAt || '') > (map[a].savedAt || '') ? 1 : -1;
  });

  var expanded = typeof window._savedExpanded !== 'undefined' ? window._savedExpanded : true;

  var html = '<div class="saved-section mb-20">' +
    '<div class="saved-toggle">' +
      '<span class="saved-toggle-arrow" style="transform:rotate(' + (expanded ? '90' : '0') + 'deg);">&#9654;</span>' +
      '<span class="saved-toggle-title">&#9733; Saved Hands</span>' +
      '<span class="saved-toggle-count">(' + keys.length + ')</span>' +
    '</div>' +
    '<div class="saved-section-body"' + (expanded ? '' : ' style="display:none;"') + '>';

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
  html += '</div></div></div>';
  return html;
}

function wireSavedSection(container) {
  var toggle = container.querySelector('.saved-section-toggle');
  if (toggle) {
    toggle.onclick = function() {
      var body = container.querySelector('.saved-section-body');
      var arrow = container.querySelector('.saved-section-arrow');
      if (!body) return;
      var isVisible = body.style.display !== 'none';
      body.style.display = isVisible ? 'none' : '';
      if (arrow) arrow.style.transform = isVisible ? 'rotate(0deg)' : 'rotate(90deg)';
      window._savedExpanded = !isVisible;
    };
  }

  var map = getStarredHands();

  container.querySelectorAll('.saved-card').forEach(function(card) {
    card.onclick = function(e) {
      if (e.target.closest('.saved-unsave')) return;
      var key = this.getAttribute('data-saved-key');
      var entry = map[key];
      if (entry && entry.hand) showExampleHandModal(entry.hand);
    };
  });

  container.querySelectorAll('.saved-unsave').forEach(function(btn) {
    btn.onclick = function(e) {
      e.stopPropagation();
      var key = this.getAttribute('data-unsave-key');
      var m = getStarredHands();
      delete m[key];
      setStarredHands(m);
      refreshSavedSection(container);
    };
  });
}

function refreshSavedSection(container) {
  var oldSection = container.querySelector('.saved-section');
  var newHtml = renderSavedSection();
  if (oldSection) {
    if (newHtml) {
      oldSection.outerHTML = newHtml;
    } else {
      oldSection.remove();
    }
  } else if (newHtml) {
    container.insertAdjacentHTML('afterbegin', newHtml);
  }
  wireSavedSection(container);
}

// Keep renderSavedHands for backward compat (called from modal)
function renderSavedHands() {
  var logPanel = document.getElementById('p-log');
  if (logPanel) refreshSavedSection(logPanel);
}
