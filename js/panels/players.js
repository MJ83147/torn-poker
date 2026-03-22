// ── PLAYERS PANEL ─────────────────────────────────────────────────────────────

function renderPlayers(container, d, hands) {
  // Build opponent map
  var oppMap = {};
  for (var i = 0; i < hands.length; i++) {
    var h = hands[i];
    var acts = parseActions(h.actions);
    var seenInHand = {};
    for (var j = 0; j < acts.length; j++) {
      var a = acts[j];
      if (a.isMe || !a.author || seenInHand[a.author]) continue;
      seenInHand[a.author] = true;
      if (!oppMap[a.author]) {
        oppMap[a.author] = { name: a.author, hands: 0, won: 0, lost: 0, folded: 0, profit: 0, handRefs: [] };
      }
      oppMap[a.author].hands++;
      oppMap[a.author].handRefs.push(i);
      if (h.outcome) {
        if (h.outcome.result === 'won') {
          var inv = h.invested || calcInvestmentFromActions(h.actions || []);
          var pr = (h.outcome.amount || 0) - inv;
          oppMap[a.author].won++;
          oppMap[a.author].profit += pr > 0 ? pr : (h.outcome.amount || 0);
        } else if (h.outcome.result === 'folded') {
          oppMap[a.author].folded++;
          var inv2 = h.invested || calcInvestmentFromActions(h.actions || []);
          oppMap[a.author].profit -= inv2;
        } else {
          oppMap[a.author].lost++;
          var inv3 = h.invested || calcInvestmentFromActions(h.actions || []);
          oppMap[a.author].profit -= inv3;
        }
      }
    }
  }

  var opponents = Object.keys(oppMap).map(function(k) { return oppMap[k]; });
  opponents.sort(function(a, b) { return b.hands - a.hands; });
  var filtered = opponents.filter(function(o) { return o.hands >= 2; });

  function getWatchedPlayers() {
    try { return JSON.parse(localStorage.getItem('tc_watched_players') || '[]'); } catch(e) { return []; }
  }
  function setWatchedPlayers(list) {
    localStorage.setItem('tc_watched_players', JSON.stringify(list));
  }
  function toggleWatch(name) {
    var list = getWatchedPlayers();
    var idx = list.indexOf(name);
    if (idx >= 0) list.splice(idx, 1); else list.push(name);
    setWatchedPlayers(list);
    renderPlayerList();
  }

  function renderPlayerList() {
    if (!filtered.length) {
      container.innerHTML = ins('n', 'Players', 'Not enough shared hands to show opponent stats. Keep playing to build data.', []);
      return;
    }
    var watched = getWatchedPlayers();
    var maxH = Math.max.apply(null, filtered.map(function(o) { return o.hands; }));
    var watchedOpps = filtered.filter(function(o) { return watched.indexOf(o.name) >= 0; });
    var html = '';

    if (watchedOpps.length) {
      html += '<div class="sec-subtitle" style="margin-top:0;">Watched Players</div>';
      html += '<div style="font-size:9px;color:var(--dim);margin-bottom:8px;">Click star to unwatch · click row to view hands</div>';
      html += '<div style="overflow-x:auto;"><table class="tbl-compare"><thead><tr>';
      html += '<th></th><th>Player</th><th>Hands</th><th></th><th>' + tipWrap('Win Rate') + '</th><th>Net P&L</th>';
      html += '</tr></thead><tbody>';
      for (var w = 0; w < watchedOpps.length; w++) {
        var o = watchedOpps[w];
        var wr = pct(o.won, o.won + o.lost);
        var barW = Math.round(o.hands / maxH * 100);
        html += '<tr class="player-row" data-player="' + o.name + '" style="cursor:pointer;transition:border-color .15s;" onmouseover="this.style.borderColor=\'var(--gold2)\'" onmouseout="this.style.borderColor=\'\'">';
        html += '<td class="watch-star watched" data-watch="' + o.name + '" title="Unwatch player" style="cursor:pointer;width:24px;text-align:center;">&#9733;</td>';
        html += '<td>' + o.name + '</td><td>' + o.hands + '</td>';
        html += '<td style="width:80px;"><span class="tbl-spark" style="width:' + barW + '%;background:var(--gold2);"></span></td>';
        html += '<td class="' + (wr !== null && wr >= 50 ? 'wr-good' : wr !== null ? 'wr-bad' : '') + '">' + (wr !== null ? wr + '%' : '—') + '</td>';
        html += '<td class="' + (o.profit >= 0 ? 'pnl-pos' : 'pnl-neg') + '">' + (o.profit >= 0 ? '+' : '') + fmt(o.profit) + '</td></tr>';
      }
      html += '</tbody></table></div>';
    }

    // Insights
    var pIns = [];
    if (filtered.length >= 1) {
      pIns.push(ins('n', 'Most Seen', 'You have played ' + filtered[0].hands + ' hands with ' + filtered[0].name + '.', [{ v: filtered[0].name, hi: true }, { v: filtered[0].hands + ' hands' }]));
    }
    var best = null, worst = null;
    for (var m = 0; m < filtered.length; m++) {
      var ow = filtered[m];
      var owr = pct(ow.won, ow.won + ow.lost);
      if (owr === null || (ow.won + ow.lost) < 5) continue;
      if (!best || owr > pct(best.won, best.won + best.lost)) best = ow;
      if (!worst || owr < pct(worst.won, worst.won + worst.lost)) worst = ow;
    }
    if (best) pIns.push(ins('g', 'Best Record', 'You win ' + pct(best.won, best.won + best.lost) + '% against ' + best.name + ' (' + (best.won + best.lost) + ' contested hands).', [{ v: best.name, hi: true }, { v: pct(best.won, best.won + best.lost) + '% win' }]));
    if (worst && worst !== best) pIns.push(ins('r', 'Toughest Opponent', 'Only ' + pct(worst.won, worst.won + worst.lost) + '% win rate against ' + worst.name + ' (' + (worst.won + worst.lost) + ' contested hands).', [{ v: worst.name, hi: true }, { v: pct(worst.won, worst.won + worst.lost) + '% win' }]));
    if (pIns.length) html += '<div style="margin-top:20px;margin-bottom:20px;">' + pIns.join('') + '</div>';

    // All opponents table
    html += '<div class="sec-subtitle">All Opponents</div>';
    html += '<div style="font-size:9px;color:var(--dim);margin-bottom:8px;">' + filtered.length + ' opponents with 2+ shared hands · click star to watch · click row to view hands</div>';
    html += '<div class="players-table-scroll"><table class="tbl-compare"><thead><tr>';
    html += '<th></th><th>Player</th><th>Hands</th><th></th><th>' + tipWrap('Win Rate') + '</th><th>Net P&L</th>';
    html += '</tr></thead><tbody>';
    for (var k = 0; k < filtered.length; k++) {
      var o2 = filtered[k];
      var wr2 = pct(o2.won, o2.won + o2.lost);
      var barW2 = Math.round(o2.hands / maxH * 100);
      var isWatched = watched.indexOf(o2.name) >= 0;
      html += '<tr class="player-row" data-player="' + o2.name + '" style="cursor:pointer;transition:border-color .15s;" onmouseover="this.style.borderColor=\'var(--gold2)\'" onmouseout="this.style.borderColor=\'\'">';
      html += '<td class="watch-star' + (isWatched ? ' watched' : '') + '" data-watch="' + o2.name + '" title="' + (isWatched ? 'Unwatch' : 'Watch') + ' player" style="cursor:pointer;width:24px;text-align:center;">' + (isWatched ? '&#9733;' : '&#9734;') + '</td>';
      html += '<td>' + o2.name + '</td><td>' + o2.hands + '</td>';
      html += '<td style="width:80px;"><span class="tbl-spark" style="width:' + barW2 + '%;background:var(--gold2);"></span></td>';
      html += '<td class="' + (wr2 !== null && wr2 >= 50 ? 'wr-good' : wr2 !== null ? 'wr-bad' : '') + '">' + (wr2 !== null ? wr2 + '%' : '—') + '</td>';
      html += '<td class="' + (o2.profit >= 0 ? 'pnl-pos' : 'pnl-neg') + '">' + (o2.profit >= 0 ? '+' : '') + fmt(o2.profit) + '</td></tr>';
    }
    html += '</tbody></table></div>';
    container.innerHTML = html;

    container.querySelectorAll('.watch-star').forEach(function(star) {
      star.onclick = function(e) { e.stopPropagation(); toggleWatch(this.getAttribute('data-watch')); };
    });
    container.querySelectorAll('.player-row').forEach(function(row) {
      row.onclick = function() { renderPlayerHands(this.getAttribute('data-player')); };
    });
  }

  function renderPlayerHands(playerName) {
    var opp = oppMap[playerName];
    if (!opp) return;
    var playerHands = opp.handRefs.map(function(idx) { return hands[idx]; });
    var phPage = 0;
    var PH_SIZE = 50;

    function renderPage() {
      var start = phPage * PH_SIZE;
      var end = Math.min(start + PH_SIZE, playerHands.length);
      var page = playerHands.slice(start, end);
      var totalPages = Math.ceil(playerHands.length / PH_SIZE);
      var wr = pct(opp.won, opp.won + opp.lost);
      var ph = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">';
      ph += '<div><button class="log-nav-btn" id="players-back" style="margin-right:12px;">&laquo; All Players</button>';
      ph += '<span style="font-size:14px;font-weight:600;color:var(--gold);">' + playerName + '</span></div>';
      ph += '<div style="font-size:10px;color:var(--dim);">' + opp.hands + ' hands · ' + (wr !== null ? wr + '% win' : '—') + ' · ' + (opp.profit >= 0 ? '+' : '') + fmt(opp.profit) + '</div></div>';
      if (totalPages > 1) {
        ph += '<div style="display:flex;justify-content:flex-end;gap:6px;align-items:center;margin-bottom:8px;">';
        ph += '<button class="log-nav-btn" id="ph-prev" ' + (phPage === 0 ? 'disabled' : '') + '>&laquo; Prev</button>';
        ph += '<span style="font-size:9px;color:var(--dim);">Page ' + (phPage + 1) + '/' + totalPages + '</span>';
        ph += '<button class="log-nav-btn" id="ph-next" ' + (phPage >= totalPages - 1 ? 'disabled' : '') + '>Next &raquo;</button></div>';
      }
      ph += '<div class="hrow hrow-header"><div class="hrow-pos">Pos</div><div class="hrow-cards">Cards</div><div class="hrow-board">Board</div><div class="hrow-acts">Actions</div><div class="hrow-res">Result</div></div>';
      ph += '<div class="hlog">' + page.map(function(h, pi) {
        var myActs = parseActions(h.actions).filter(function(a) { return a.isMe; }).map(function(a) { return a.type; }).join(' · ');
        var invested = h.invested || calcInvestmentFromActions(h.actions || []);
        var res;
        if (h.outcome) {
          if (h.outcome.result === 'won') {
            var profit = (h.outcome.amount || 0) - invested;
            res = '<div class="hrow-res w">+' + fmt(profit > 0 ? profit : h.outcome.amount || h.pot || 0) + '</div>';
          } else if (h.outcome.result === 'folded') {
            res = '<div class="hrow-res l">' + (invested > 0 ? '-' + fmt(invested) : 'folded') + '</div>';
          } else {
            res = '<div class="hrow-res l">-' + fmt(invested) + '</div>';
          }
        } else {
          res = '<div class="hrow-res u">?</div>';
        }
        return '<div class="hrow" data-ph-idx="' + (start + pi) + '" style="cursor:pointer;transition:border-color .15s;" onmouseover="this.style.borderColor=\'var(--gold2)\'" onmouseout="this.style.borderColor=\'\'"><div class="hrow-pos">' + (h.position || '?') + '</div><div class="hrow-cards">' + (h.hole && h.hole.length ? h.hole.join(' ') : '?? ??') + '</div><div class="hrow-board">' + (h.board && h.board.length ? h.board.join(' ') : '—') + '</div><div class="hrow-acts">' + myActs + '</div>' + res + '</div>';
      }).join('') + '</div>';
      container.innerHTML = ph;
      document.getElementById('players-back').onclick = function() { renderPlayerList(); };
      container.querySelectorAll('.hrow[data-ph-idx]').forEach(function(row) {
        row.onclick = function() {
          var idx = parseInt(this.getAttribute('data-ph-idx'));
          if (!isNaN(idx) && playerHands[idx]) showExampleHandModal(playerHands[idx]);
        };
      });
      var prev = document.getElementById('ph-prev');
      var next = document.getElementById('ph-next');
      if (prev) prev.onclick = function() { phPage--; renderPage(); };
      if (next) next.onclick = function() { phPage++; renderPage(); };
    }
    renderPage();
  }

  renderPlayerList();
}
