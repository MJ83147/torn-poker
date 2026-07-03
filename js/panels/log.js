var _logPage = 0;
var _logSort = { col: null, dir: 'desc' };

function sortHands(list, col, dir) {
  if (!col) return list;
  return list.slice().sort(function(a, b) {
    var va, vb;
    if (col === 'pos') { va = a.position || ''; vb = b.position || ''; return dir === 'asc' ? (va < vb ? -1 : va > vb ? 1 : 0) : (va > vb ? -1 : va < vb ? 1 : 0); }
    if (col === 'result') { va = getHandPnlValue(a); vb = getHandPnlValue(b); }
    else return 0;
    return dir === 'asc' ? va - vb : vb - va;
  });
}

function renderLog(container, hands) {
  var PAGE_SIZE = 50;
  _logPage = 0;
  var allHands = hands.slice().reverse();

  function renderLogPage() {
    var sortedHands = sortHands(allHands, _logSort.col, _logSort.dir);
    var start = _logPage * PAGE_SIZE;
    var end = Math.min(start + PAGE_SIZE, sortedHands.length);
    var pageHands = sortedHands.slice(start, end);

    mountPanel(container, 'log', { title: 'Hand Log', desc: 'Every hand played. Click any row to replay.' });
    setSlot(container, 'saved', renderSavedSection());
    setSlot(container, 'meta', sortedHands.length + ' hands total · showing ' + (start + 1) + '-' + end);
    setSlot(container, 'pagination', renderPagination(_logPage, sortedHands.length, PAGE_SIZE, 'log-prev', 'log-next'));
    setSlot(container, 'head', renderTableHead(['', { label: 'Pos', sort: 'pos' }, 'Cards', 'Context', 'Board', 'Pot', 'Actions', { label: 'Result', sort: 'result' }], _logSort));
    setSlot(container, 'rows', pageHands.map(function(h, pi) {
      var globalIdx = start + pi;
      var starred = isHandStarred(h);
      var starHtml = '<span class="btn btn-icon hrow-star' + (starred ? ' starred' : '') + '" data-star-idx="' + globalIdx + '" title="' + (starred ? 'Unsave' : 'Save') + ' hand">' + (starred ? '&#9733;' : '&#9734;') + '</span>';
      return renderHandRow(h, globalIdx, { starHtml: starHtml });
    }).join(''));

    wireSavedSection(container);

    container.querySelectorAll('.hrow[data-hand-idx]').forEach(function(row) {
      row.onclick = function(e) {
        if (e.target.closest('.hrow-star')) return;
        var idx = parseInt(this.getAttribute('data-hand-idx'));
        if (!isNaN(idx) && sortedHands[idx]) showExampleHandModal(sortedHands[idx]);
      };
    });
    container.querySelectorAll('.hrow-star').forEach(function(star) {
      star.onclick = function(e) {
        e.stopPropagation();
        var idx = parseInt(this.getAttribute('data-star-idx'));
        if (isNaN(idx) || !sortedHands[idx]) return;
        var nowStarred = toggleStarHand(sortedHands[idx]);
        this.innerHTML = nowStarred ? '&#9733;' : '&#9734;';
        this.classList.toggle('starred', nowStarred);
        this.title = nowStarred ? 'Unsave' : 'Save hand';
        refreshSavedSection(container);
      };
    });
    container.querySelectorAll('.sortable[data-sort-col]').forEach(function(th) {
      th.onclick = function() {
        var col = this.getAttribute('data-sort-col');
        if (_logSort.col === col) {
          _logSort.dir = _logSort.dir === 'asc' ? 'desc' : 'asc';
        } else {
          _logSort.col = col;
          _logSort.dir = col === 'pos' ? 'asc' : 'desc';
        }
        _logPage = 0;
        renderLogPage();
      };
    });
    var prevBtn = document.getElementById('log-prev');
    var nextBtn = document.getElementById('log-next');
    if (prevBtn) prevBtn.onclick = function() { _logPage--; renderLogPage(); };
    if (nextBtn) nextBtn.onclick = function() { _logPage++; renderLogPage(); };
  }
  renderLogPage();
}

function renderSavedSection() {
  var map = getStarredHands();
  var keys = Object.keys(map);

  if (!keys.length) return '';

  keys.sort(function(a, b) {
    return (map[b].savedAt || '') > (map[a].savedAt || '') ? 1 : -1;
  });

  var expanded = State.savedExpanded !== false;

  var html = '<div class="saved-section saved-section-divider">' +
    '<div class="saved-toggle row center">' +
      '<span class="saved-toggle-arrow" style="transform:rotate(' + (expanded ? '90' : '0') + 'deg);">&#9654;</span>' +
      '<span class="eyebrow">&#9733; Saved Hands</span>' +
      '<span class="text-meta">(' + keys.length + ')</span>' +
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
      ? '<div class="text-micro saved-note-preview">' + entry.note.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, ' ') + '</div>'
      : '';

    var savedDate = fmtDateShort(entry.savedAt);

    html += '<div class="card card-link list saved-card" data-saved-key="' + keys[i].replace(/"/g, '&quot;') + '">' +
      '<div class="row between">' +
        '<div class="saved-card-hole">' + (h.hole ? displayCards(h.hole.map(normCard)) : '??') + '</div>' +
        '<div class="text-meta row center">' +
          '<span class="saved-pos">' + (h.position || '?') + '</span>' +
          res +
        '</div>' +
        '<button class="btn btn-icon saved-unsave" data-unsave-key="' + keys[i].replace(/"/g, '&quot;') + '" title="Remove from saved">&#9733;</button>' +
      '</div>' +
      '<div class="text-meta">' + (h.board && h.board.length ? displayCards(h.board.map(normCard)) : 'No board') + '</div>' +
      '<div class="text-meta saved-card-acts">' + (myActs || 'No actions') + '</div>' +
      (notePreview ? '<div class="card card-s2 saved-card-note-wrap">' + notePreview + '</div>' : '<div class="text-micro saved-card-note-empty">No notes</div>') +
      '<div class="text-micro text-right">' + savedDate + '</div>' +
      '</div>';
  }
  html += '</div></div></div>';
  return html;
}

function wireSavedSection(container) {
  var toggle = container.querySelector('.saved-toggle');
  if (toggle) {
    toggle.onclick = function() {
      var body = container.querySelector('.saved-section-body');
      var arrow = container.querySelector('.saved-toggle-arrow');
      if (!body) return;
      var isVisible = body.style.display !== 'none';
      body.style.display = isVisible ? 'none' : '';
      if (arrow) arrow.style.transform = isVisible ? 'rotate(0deg)' : 'rotate(90deg)';
      State.savedExpanded = !isVisible;
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
  var slot = container.querySelector('[data-slot="saved"]');
  var host = slot || container;
  var oldSection = host.querySelector('.saved-section');
  var newHtml = renderSavedSection();
  if (oldSection) {
    if (newHtml) {
      oldSection.outerHTML = newHtml;
    } else {
      oldSection.remove();
    }
  } else if (newHtml) {
    if (slot) slot.innerHTML = newHtml;
    else container.insertAdjacentHTML('afterbegin', newHtml);
  }
  wireSavedSection(container);
}

function renderSavedHands() {
  var logPanel = document.getElementById('p-log');
  if (logPanel) refreshSavedSection(logPanel);
}
