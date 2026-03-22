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
    var totalPages = Math.ceil(allHands.length / PAGE_SIZE);
    var logHtml = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">' +
      '<div style="font-size:9px;color:var(--dim);">' + allHands.length + ' hands total · showing ' + (start + 1) + '-' + end + '</div>' +
      '<div style="display:flex;gap:6px;align-items:center;">';
    if (totalPages > 1) {
      logHtml += '<button class="log-nav-btn" id="log-prev" ' + (_logPage === 0 ? 'disabled' : '') + '>&laquo; Prev</button>' +
        '<span style="font-size:9px;color:var(--dim);">Page ' + (_logPage + 1) + '/' + totalPages + '</span>' +
        '<button class="log-nav-btn" id="log-next" ' + (_logPage >= totalPages - 1 ? 'disabled' : '') + '>Next &raquo;</button>';
    }
    logHtml += '</div></div>';
    logHtml += '<div class="hrow hrow-header"><div class="hrow-pos">Pos</div><div class="hrow-cards">Cards</div><div class="hrow-board">Board</div><div class="hrow-acts">Actions</div><div class="hrow-res">Result</div></div>';
    logHtml += '<div class="hlog">' + pageHands.map(function(h) {
      var myActs = parseActions(h.actions).filter(function(a) { return a.isMe; }).map(function(a) { return a.type; }).join(' · ');
      var invested2 = h.invested || calcInvestmentFromActions(h.actions || []);
      var res;
      if (h.outcome) {
        if (h.outcome.result === 'won') {
          var profit2 = (h.outcome.amount || 0) - invested2;
          res = '<div class="hrow-res w">+' + fmt(profit2 > 0 ? profit2 : h.outcome.amount || h.pot || 0) + '</div>';
        } else if (h.outcome.result === 'folded') {
          res = '<div class="hrow-res l">' + (invested2 > 0 ? '-' + fmt(invested2) : 'folded') + '</div>';
        } else {
          res = '<div class="hrow-res l">-' + fmt(invested2) + '</div>';
        }
      } else {
        res = '<div class="hrow-res u">?</div>';
      }
      return '<div class="hrow" data-hand-idx="' + (start + pageHands.indexOf(h)) + '" style="cursor:pointer;transition:border-color .15s;" onmouseover="this.style.borderColor=\'var(--gold2)\'" onmouseout="this.style.borderColor=\'\'"><div class="hrow-pos">' + (h.position || '?') + '</div><div class="hrow-cards">' + (h.hole && h.hole.length ? h.hole.join(' ') : '?? ??') + '</div><div class="hrow-board">' + (h.board && h.board.length ? h.board.join(' ') : '—') + '</div><div class="hrow-acts">' + myActs + '</div>' + res + '</div>';
    }).join('') + '</div>';
    container.innerHTML = logHtml;

    container.querySelectorAll('.hrow[data-hand-idx]').forEach(function(row) {
      row.onclick = function() {
        var idx = parseInt(this.getAttribute('data-hand-idx'));
        if (!isNaN(idx) && allHands[idx]) showExampleHandModal(allHands[idx]);
      };
    });
    var prevBtn = document.getElementById('log-prev');
    var nextBtn = document.getElementById('log-next');
    if (prevBtn) prevBtn.onclick = function() { _logPage--; renderLogPage(); };
    if (nextBtn) nextBtn.onclick = function() { _logPage++; renderLogPage(); };
  }
  renderLogPage();
}
