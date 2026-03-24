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
    var logHtml = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">' +
      '<div style="font-size:9px;color:var(--dim);">' + allHands.length + ' hands total · showing ' + (start + 1) + '-' + end + '</div>' +
      '<div style="display:flex;gap:6px;align-items:center;">' +
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
        var savedPanel = document.getElementById('p-saved');
        if (savedPanel) renderSavedHands(savedPanel);
      };
    });
    var prevBtn = document.getElementById('log-prev');
    var nextBtn = document.getElementById('log-next');
    if (prevBtn) prevBtn.onclick = function() { _logPage--; renderLogPage(); };
    if (nextBtn) nextBtn.onclick = function() { _logPage++; renderLogPage(); };
  }
  renderLogPage();
}
