function renderPlayers(container, d, hands) {
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
        if (h.outcome.result === 'won') oppMap[a.author].won++;
        else if (h.outcome.result === 'folded') oppMap[a.author].folded++;
        else oppMap[a.author].lost++;
        oppMap[a.author].profit += getHandPnlValue(h);
      }
    }
  }

  var opponents = Object.keys(oppMap).map(function(k) { return oppMap[k]; });
  opponents.sort(function(a, b) { return b.hands - a.hands; });
  var filtered = opponents.filter(function(o) { return o.hands >= 2; });

  function getWatchedPlayers() {
    return getJSON('tc_watched_players', []);
  }
  function setWatchedPlayers(list) {
    setJSON('tc_watched_players', list);
  }
  function toggleWatch(name) {
    var list = getWatchedPlayers();
    var idx = list.indexOf(name);
    if (idx >= 0) list.splice(idx, 1); else list.push(name);
    setWatchedPlayers(list);
    renderPlayerList();
  }

  var _playerSearch = '';
  var _playerSort = { col: 'hands', dir: 'desc' };

  function sortOpponents(list, col, dir) {
    return list.slice().sort(function(a, b) {
      var va, vb;
      if (col === 'name') { va = a.name.toLowerCase(); vb = b.name.toLowerCase(); return dir === 'asc' ? (va < vb ? -1 : va > vb ? 1 : 0) : (va > vb ? -1 : va < vb ? 1 : 0); }
      if (col === 'hands') { va = a.hands; vb = b.hands; }
      else if (col === 'wr') { va = pct(a.won, a.won + a.lost) || 0; vb = pct(b.won, b.won + b.lost) || 0; }
      else if (col === 'pnl') { va = a.profit; vb = b.profit; }
      else { va = a.hands; vb = b.hands; }
      return dir === 'asc' ? va - vb : vb - va;
    });
  }


  function renderPlayerList() {
    if (!filtered.length) {
      container.innerHTML = '<div class="panel-title">Players</div>' +
        '<div class="text-body panel-desc">Opponent records, head-to-head stats, and watch list.</div>' +
        '<div class="card card-s2 card-flat panel-verdict">Not enough shared hands to show opponent stats. Keep playing to build data.</div>';
      return;
    }
    var watched = getWatchedPlayers();
    var searchFiltered = filtered;
    if (_playerSearch) {
      var q = _playerSearch.toLowerCase();
      searchFiltered = filtered.filter(function(o) { return o.name.toLowerCase().indexOf(q) !== -1; });
    }
    var maxH = Math.max.apply(null, filtered.map(function(o) { return o.hands; }));
    var watchedOpps = filtered.filter(function(o) { return watched.indexOf(o.name) >= 0; });

    mountTemplate(container, 'players');
    mountFindings(container, 'Players', d, hands, 'Opponent pool is still forming.');

    if (watchedOpps.length) {
      var watchedSection = container.querySelector('[data-slot="watchedSection"]');
      if (watchedSection) watchedSection.removeAttribute('hidden');
      setSlot(container, 'watchedHead', renderTableHead(['', 'Player', 'Hands', '', { tip: 'Win Rate' }, 'Net P&L']));
      var watchedRowsHtml = '';
      for (var w = 0; w < watchedOpps.length; w++) {
        var o = watchedOpps[w];
        var wr = pct(o.won, o.won + o.lost);
        var barW = Math.round(o.hands / maxH * 100);
        watchedRowsHtml += '<tr class="player-row row-hover" data-player="' + o.name + '">';
        watchedRowsHtml += '<td class="watch-star watched" data-watch="' + o.name + '" title="Unwatch player">&#9733;</td>';
        watchedRowsHtml += '<td>' + o.name + '</td><td>' + o.hands + '</td>';
        watchedRowsHtml += '<td class="spark-cell"><span class="tbl-spark" style="width:' + barW + '%;background:var(--gold2);"></span></td>';
        watchedRowsHtml += '<td class="' + wrCls(wr) + '">' + (wr !== null ? wr + '%' : '-') + '</td>';
        watchedRowsHtml += '<td class="' + pnlCls(o.profit) + '">' + fmtPnl(o.profit) + '</td></tr>';
      }
      setSlot(container, 'watchedRows', watchedRowsHtml);
    }

    var searchEl = document.getElementById('player-search');
    if (searchEl) searchEl.value = _playerSearch || '';
    setSlot(container, 'allMeta', searchFiltered.length + ' opponents' + (_playerSearch ? ' matching "' + _playerSearch.replace(/</g, '&lt;') + '"' : ' with 2+ shared hands') + ' · click star to watch · click row to view hands');

    var sortedOpps = sortOpponents(searchFiltered, _playerSort.col, _playerSort.dir);
    setSlot(container, 'allHead', renderTableHead(['', { label: 'Player', sort: 'name' }, { label: 'Hands', sort: 'hands' }, '', { tip: 'Win Rate', sort: 'wr' }, { label: 'Net P&L', sort: 'pnl' }], _playerSort));
    var allRowsHtml = '';
    for (var k = 0; k < sortedOpps.length; k++) {
      var o2 = sortedOpps[k];
      var wr2 = pct(o2.won, o2.won + o2.lost);
      var barW2 = Math.round(o2.hands / maxH * 100);
      var isWatched = watched.indexOf(o2.name) >= 0;
      allRowsHtml += '<tr class="player-row row-hover" data-player="' + o2.name + '">';
      allRowsHtml += '<td class="watch-star' + (isWatched ? ' watched' : '') + '" data-watch="' + o2.name + '" title="' + (isWatched ? 'Unwatch' : 'Watch') + ' player">' + (isWatched ? '&#9733;' : '&#9734;') + '</td>';
      allRowsHtml += '<td>' + o2.name + '</td><td>' + o2.hands + '</td>';
      allRowsHtml += '<td class="spark-cell"><span class="tbl-spark" style="width:' + barW2 + '%;background:var(--gold2);"></span></td>';
      allRowsHtml += '<td class="' + wrCls(wr2) + '">' + (wr2 !== null ? wr2 + '%' : '-') + '</td>';
      allRowsHtml += '<td class="' + pnlCls(o2.profit) + '">' + fmtPnl(o2.profit) + '</td></tr>';
    }
    setSlot(container, 'allRows', allRowsHtml);

    container.querySelectorAll('.watch-star').forEach(function(star) {
      star.onclick = function(e) { e.stopPropagation(); toggleWatch(this.getAttribute('data-watch')); };
    });
    container.querySelectorAll('.player-row').forEach(function(row) {
      row.onclick = function() { renderPlayerHands(this.getAttribute('data-player')); };
    });
    var searchInput = document.getElementById('player-search');
    if (searchInput) {
      searchInput.oninput = function() {
        _playerSearch = this.value;
        renderPlayerList();
        var si = document.getElementById('player-search');
        if (si) { si.focus(); si.selectionStart = si.selectionEnd = si.value.length; }
      };
    }
    container.querySelectorAll('.sortable[data-sort-col]').forEach(function(th) {
      th.onclick = function() {
        var col = this.getAttribute('data-sort-col');
        if (_playerSort.col === col) {
          _playerSort.dir = _playerSort.dir === 'asc' ? 'desc' : 'asc';
        } else {
          _playerSort.col = col;
          _playerSort.dir = col === 'name' ? 'asc' : 'desc';
        }
        renderPlayerList();
      };
    });

    var cmpBtn = document.getElementById('open-compare-btn');
    if (cmpBtn) {
      cmpBtn.onclick = function() {
        var overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        var box = document.createElement('div');
        box.className = 'modal-box modal-box-compare';
        var closeBtn = document.createElement('button');
        closeBtn.className = 'modal-close';
        closeBtn.innerHTML = '&times;';
        closeBtn.onclick = function() { overlay.classList.remove(CSS.SHOW); setTimeout(function() { overlay.remove(); }, 200); };
        overlay.onclick = function(e) { if (e.target === overlay) { overlay.classList.remove(CSS.SHOW); setTimeout(function() { overlay.remove(); }, 200); } };
        box.appendChild(closeBtn);
        var cmpContent = document.createElement('div');
        renderCompare(cmpContent, d, hands);
        box.appendChild(cmpContent);
        overlay.appendChild(box);
        document.body.appendChild(overlay);
        requestAnimationFrame(function() { overlay.classList.add(CSS.SHOW); });
      };
    }
  }

  function renderPlayerHands(playerName) {
    var opp = oppMap[playerName];
    if (!opp) return;
    var playerHands = opp.handRefs.map(function(idx) { return hands[idx]; });
    var phPage = 0;
    var PH_SIZE = 50;

    var oppStats = computeOpponentStats(hands, playerName);

    function renderPage() {
      var start = phPage * PH_SIZE;
      var end = Math.min(start + PH_SIZE, playerHands.length);
      var page = playerHands.slice(start, end);
      var totalPages = Math.ceil(playerHands.length / PH_SIZE);
      var wr = pct(opp.won, opp.won + opp.lost);
      var ph = '<div class="flex-between mb-16">';
      ph += '<div><button class="btn btn-ghost mr-12" id="players-back">&laquo; All Players</button>';
      ph += '<span class="gold-heading">' + playerName + '</span></div>';
      ph += '<div class="text-meta">' + opp.hands + ' hands · ' + (wr !== null ? wr + '% win' : '-') + ' · ' + fmtPnl(opp.profit) + '</div></div>';

      var vpip = pct(oppStats.vpipHands, oppStats.hands);
      var pfr = pct(oppStats.pfrHands, oppStats.hands);
      var limp = pct(oppStats.limpHands, oppStats.hands);
      var aggPct = calcAggression(oppStats.totalRaises, oppStats.totalCalls, oppStats.totalChecks);
      var ftr = pct(oppStats.foldedToRaise, oppStats.facedRaise);
      var cbet = pct(oppStats.cbetDone, oppStats.cbetOpps);
      var wtsd = pct(oppStats.wentToShowdown, oppStats.sawFlop);
      var wsd = pct(oppStats.wonAtShowdown, oppStats.wentToShowdown);

      if (oppStats.hands >= 5) {
        var minis = [
          { l: tipWrap('VPIP'),       v: vpip !== null ? vpip + '%' : '-',     c: sev(vpip, -1, 55, 18, 40) },
          { l: tipWrap('PFR'),          v: pfr !== null ? pfr + '%' : '-',       c: sev(pfr, 8, 999, 8, 35) },
          { l: tipWrap('Limp'),         v: limp !== null ? limp + '%' : '-',     c: sev(limp, -1, 30, -1, 20) },
          { l: tipWrap('Aggression'),   v: aggPct !== null ? aggPct + '%' : '-', c: sev(aggPct, 15, 999, 15, 50) },
          { l: tipWrap('Fold to Raise'),v: ftr !== null ? ftr + '%' : '-',       c: sev(ftr, 25, 65, 25, 65) },
          { l: tipWrap('C-Bet'),        v: cbet !== null ? cbet + '%' : '-',     c: sev(cbet, -1, 999, -1, 75) },
          { l: tipWrap('WTSD'),         v: wtsd !== null ? wtsd + '%' : '-',     c: sev(wtsd, 25, 55, 25, 55) },
          { l: tipWrap('WSD'),          v: wsd !== null ? wsd + '%' : '-',       c: sev(wsd, 35, 999, 35, 60) },
        ];

        ph += '<div class="label sec-subtitle mt-0">Tendencies</div>';
        ph += renderMiniRow(minis);

        var exploitIns = generateExploitInsights(oppStats, playerName, hands);
        if (exploitIns.length) {
          ph += '<div class="grid-auto ins-grid mb-16">' + exploitIns.join('') + '</div>';
        }
      } else {
        ph += '<div class="card card-s2 card-flat panel-verdict">Need ' + Math.max(0, 5 - oppStats.hands) + ' more shared hands to show tendency stats (' + oppStats.hands + '/5 hands).</div>';
      }

      ph += '<div class="label sec-subtitle">Shared Hands</div>';
      if (totalPages > 1) {
        ph += '<div class="flex-gap-6 mb-8 flex-end">' +
          renderPagination(phPage, playerHands.length, PH_SIZE, 'ph-prev', 'ph-next') + '</div>';
      }
      ph += '<div class="overflow-x"><table class="tbl hlog-tbl"><thead><tr><th>Pos</th><th>Cards</th><th>Board</th><th>Pot</th><th>Actions</th><th>Result</th></tr></thead><tbody>';
      ph += page.map(function(h, pi) {
        return renderHandRow(h, start + pi, null).replace('data-hand-idx', 'data-ph-idx');
      }).join('') + '</tbody></table></div>';
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

function renderCompare(container, d, hands) {
  var heroName = State.meta.player;

  var playerSet = {};
  for (var i = 0; i < hands.length; i++) {
    var acts = parseActions(hands[i].actions);
    for (var j = 0; j < acts.length; j++) {
      var author = acts[j].author;
      if (author && author !== '?') playerSet[author] = (playerSet[author] || 0) + 1;
    }
  }
  var playerNames = Object.keys(playerSet).sort(function(a, b) {
    if (a === heroName) return -1;
    if (b === heroName) return 1;
    return playerSet[b] - playerSet[a];
  });

  if (playerNames.length < 2) {
    container.innerHTML =
      '<div class="panel-title">Head to Head</div>' +
      '<div class="text-body panel-desc">Compare two players side by side.</div>' +
      '<div class="p-row"><div class="text-body">Need at least two players in the data to compare.</div></div>';
    return;
  }

  var p1Default = heroName;
  var p2Default = playerNames[0] === heroName ? playerNames[1] : playerNames[0];

  function buildOptions(selectedName) {
    return playerNames.map(function(n) {
      var label = n + ' (' + playerSet[n] + ')';
      return '<option value="' + n + '"' + (n === selectedName ? ' selected' : '') + '>' + label + '</option>';
    }).join('');
  }

  container.innerHTML =
    '<div class="panel-title">Head to Head</div>' +
    '<div class="text-body panel-desc">Compare two players side by side.</div>' +
    '<div class="p-row">' +
    '<div class="compare-selectors">' +
    '<select id="compare-p1" class="table-filter">' + buildOptions(p1Default) + '</select>' +
    '<span class="text-body compare-vs">vs</span>' +
    '<select id="compare-p2" class="table-filter">' + buildOptions(p2Default) + '</select>' +
    '</div>' +
    '</div>' +
    '<div id="compare-body"></div>';

  function getHeroStats() {
    var c = d.core || {};
    return {
      hands: d.n,
      vpip: c.vpipPct,
      pfr: c.pfrPct,
      agg: c.agg,
      cbet: c.cbetPct,
      foldToRaise: c.ftrPct,
      wtsd: c.wtsdPct,
      limp: c.limpPct,
      wr: c.wr,
      netPnl: c.netPnl
    };
  }

  function getOpponentStatsMapped(name) {
    var s = computeOpponentStats(hands, name);
    return {
      hands: s.hands,
      vpip: pct(s.vpipHands, s.hands),
      pfr: pct(s.pfrHands, s.hands),
      agg: calcAggression(s.totalRaises, s.totalCalls, s.totalChecks),
      cbet: pct(s.cbetDone, s.cbetOpps),
      foldToRaise: pct(s.foldedToRaise, s.facedRaise),
      wtsd: pct(s.wentToShowdown, s.sawFlop),
      limp: pct(s.limpHands, s.hands),
      wr: pct(s.wonAtShowdown, s.wentToShowdown),
      netPnl: null
    };
  }

  function getStats(name) {
    if (name === heroName) return getHeroStats();
    return getOpponentStatsMapped(name);
  }

  function fmtStat(val, suffix) {
    if (val === null) return '-';
    return val + (suffix || '');
  }

  function edgeText(stat, v1, v2, n1, n2) {
    if (v1 === null || v2 === null) return '';
    var diff = v1 - v2;
    var smaller = Math.min(n1 || 0, n2 || 0);
    var gate = 3 * Math.max(1, Math.sqrt(40 / Math.max(1, smaller)));
    if (Math.abs(diff) < gate) return '';
    switch (stat) {
      case 'vpip': return (v1 > v2 ? 'P1' : 'P2') + ' is looser';
      case 'pfr': return (v1 > v2 ? 'P1' : 'P2') + ' more aggressive pre';
      case 'agg': return (v1 > v2 ? 'P1' : 'P2') + ' pressures more';
      case 'cbet': return (v1 > v2 ? 'P1' : 'P2') + ' follows up more';
      case 'foldToRaise': return (v1 > v2 ? 'P1' : 'P2') + ' more exploitable';
      case 'wtsd': return (v1 > v2 ? 'P1' : 'P2') + ' calls down more';
      case 'limp': return (v1 > v2 ? 'P1' : 'P2') + ' limps more';
      default: return '';
    }
  }

  function renderComparison() {
    var p1Name = container.querySelector('#compare-p1').value;
    var p2Name = container.querySelector('#compare-p2').value;
    var body = container.querySelector('#compare-body');
    if (!body) return;

    if (p1Name === p2Name) {
      body.innerHTML = '<div class="p-row"><div class="text-body">Select two different players to compare.</div></div>';
      return;
    }

    var s1 = getStats(p1Name);
    var s2 = getStats(p2Name);

    var statRows = [
      { key: 'hands', label: 'Hands', suffix: '' },
      { key: 'vpip', label: 'VPIP', suffix: '%' },
      { key: 'pfr', label: 'PFR', suffix: '%' },
      { key: 'agg', label: 'Aggression', suffix: '%' },
      { key: 'cbet', label: 'C-Bet', suffix: '%' },
      { key: 'foldToRaise', label: 'Fold to Raise', suffix: '%' },
      { key: 'wtsd', label: 'WTSD', suffix: '%' },
      { key: 'limp', label: 'Limp', suffix: '%' },
      { key: 'wr', label: 'Win Rate', suffix: '%' },
    ];

    var tableHtml = '<table class="compare-table">' +
      '<thead><tr><th>Stat</th><th>' + p1Name + '</th><th>' + p2Name + '</th><th>Edge</th></tr></thead><tbody>';

    for (var i = 0; i < statRows.length; i++) {
      var sr = statRows[i];
      var v1 = s1[sr.key];
      var v2 = s2[sr.key];
      var edge = edgeText(sr.key, v1, v2, s1.hands, s2.hands);
      var better1 = (v1 !== null && v2 !== null && v1 > v2 && sr.key !== 'foldToRaise' && sr.key !== 'limp') ||
                    (sr.key === 'foldToRaise' && v1 !== null && v2 !== null && v1 < v2) ||
                    (sr.key === 'limp' && v1 !== null && v2 !== null && v1 < v2);
      var better2 = !better1 && v1 !== null && v2 !== null && v1 !== v2;
      tableHtml += '<tr>' +
        '<td class="label">' + tipWrap(sr.label) + '</td>' +
        '<td class="' + (better1 ? 'compare-better' : '') + '">' + fmtStat(v1, sr.suffix) + (better1 && Math.abs(v1 - v2) >= 3 ? ' &#9664;' : '') + '</td>' +
        '<td class="' + (better2 ? 'compare-better' : '') + '">' + fmtStat(v2, sr.suffix) + (better2 && Math.abs(v1 - v2) >= 3 ? ' &#9664;' : '') + '</td>' +
        '<td class="text-meta">' + edge + '</td>' +
        '</tr>';
    }
    tableHtml += '</tbody></table>';

    var sharedHands = [];
    var p1Wins = 0;
    var p2Wins = 0;
    for (var i = 0; i < hands.length; i++) {
      var h = hands[i];
      var acts = parseActions(h.actions);
      var hasP1 = false, hasP2 = false;
      for (var j = 0; j < acts.length; j++) {
        if (acts[j].author === p1Name) hasP1 = true;
        if (acts[j].author === p2Name) hasP2 = true;
      }
      if (hasP1 && hasP2) {
        sharedHands.push(h);
        for (var j = 0; j < acts.length; j++) {
          if (acts[j].type === 'won') {
            if (acts[j].author === p1Name) p1Wins++;
            if (acts[j].author === p2Name) p2Wins++;
            break;
          }
        }
      }
    }

    var h2hHtml = '<div class="p-row"><div class="label">Head-to-Head Record</div>';
    if (sharedHands.length === 0) {
      h2hHtml += '<div class="text-body">No shared hands found between these players.</div>';
    } else {
      var p1WinPct = Math.round(p1Wins / sharedHands.length * 100);
      h2hHtml += '<div class="text-meta compare-h2h">' +
        '<span>' + sharedHands.length + ' shared hands</span>' +
        '<span class="compare-h2h-record">' + p1Name + ' won ' + p1Wins + ' (' + p1WinPct + '%) · ' + p2Name + ' won ' + p2Wins + '</span>' +
        '</div>';
      h2hHtml += '<button class="example-hand-btn" id="compare-shared-btn">View ' + sharedHands.length + ' shared hands</button>';
    }
    h2hHtml += '</div>';

    var exploits = [];
    var targetName = (p2Name !== heroName) ? p2Name : p1Name;
    var targetStats = (targetName === p1Name) ? s1 : s2;

    var _seatsCmp = (function() {
      if (!d || !d.bySeatBucket) return null;
      var best = null, bestN = 0;
      for (var sb in d.bySeatBucket) {
        var sd = d.bySeatBucket[sb];
        if (!sd || (sd.n || 0) <= bestN) continue;
        bestN = sd.n;
        best = parseInt(sb, 10);
      }
      return best ? Math.max(2, Math.min(9, best)) : null;
    })();
    var _oppProf = (typeof _opponentCache !== 'undefined' && targetName)
      ? _opponentCache[targetName] : null;
    var _oppLatePosBias = _oppProf && _oppProf.raw && typeof _oppProf.raw.latePos === 'number'
      ? _oppProf.raw.latePos : null;

    var _ftrGate = _seatsCmp && _seatsCmp <= 2 ? 50 : _seatsCmp && _seatsCmp <= 4 ? 55 : 60;
    var _cbetGate = _seatsCmp && _seatsCmp <= 2 ? 55 : _seatsCmp && _seatsCmp <= 4 ? 45 : 35;
    var _wtsdGate = _seatsCmp && _seatsCmp <= 2 ? 45 : 40;
    var _limpGate = _seatsCmp && _seatsCmp <= 3 ? 35 : 20;
    var _aggGate = 15;
    var _vpipGate = _seatsCmp && _seatsCmp <= 2 ? 75 : _seatsCmp && _seatsCmp <= 3 ? 60 : 50;

    if (targetStats.foldToRaise !== null && targetStats.foldToRaise >= _ftrGate) {
      var lateNote = _oppLatePosBias && _oppLatePosBias > 0.55
        ? ' Especially in late position where they open even wider.'
        : '';
      exploits.push(targetName + ' folds to raises ' + targetStats.foldToRaise + '%: raise wide against them.' + lateNote);
    }
    if (targetStats.cbet !== null && targetStats.cbet <= _cbetGate) {
      exploits.push(targetName + ' c-bets only ' + targetStats.cbet + '%: float their checks on the flop and bet when they show weakness.');
    }
    if (targetStats.wtsd !== null && targetStats.wtsd >= _wtsdGate) {
      exploits.push(targetName + ' goes to showdown ' + targetStats.wtsd + '%: value bet thin, they call down.');
    }
    if (targetStats.limp !== null && targetStats.limp >= _limpGate) {
      exploits.push(targetName + ' limps ' + targetStats.limp + '%: raise their limps with a wide range.');
    }
    if (targetStats.agg !== null && targetStats.agg <= _aggGate) {
      exploits.push(targetName + ' is passive (' + targetStats.agg + '% agg). Their bets mean strength, fold more to them.');
    }
    if (targetStats.vpip !== null && targetStats.vpip >= _vpipGate) {
      exploits.push(targetName + ' plays ' + targetStats.vpip + '% of hands at this table size: tighten up and value bet relentlessly.');
    }

    var exploitHtml = '';
    if (exploits.length > 0) {
      exploitHtml = '<div class="p-row"><div class="label">Exploit Tips</div><div class="compare-exploits">';
      for (var i = 0; i < exploits.length; i++) {
        exploitHtml += '<div class="card card-s2 text-meta compare-exploit-item">' + exploits[i] + '</div>';
      }
      exploitHtml += '</div></div>';
    }

    var warnHtml = '';
    if (s1.hands < 10 || s2.hands < 10) {
      var lowName = s1.hands < 10 ? p1Name : p2Name;
      var lowCount = s1.hands < 10 ? s1.hands : s2.hands;
      warnHtml = '<div class="p-row"><div class="card card-s2 card-flat ins"><div class="ins-badge a"><div class="dot"></div><div class="ins-word">Warning</div></div><div class="ins-title">Small Sample</div><div class="text-body ins-text">' + lowName + ' only has ' + lowCount + ' hands. Stats may be unreliable until 20+ hands are available.</div></div></div>';
    }

    body.innerHTML = warnHtml + '<div class="p-row">' + tableHtml + '</div>' + h2hHtml + exploitHtml;

    if (sharedHands.length > 0) {
      var sharedBtn = container.querySelector('#compare-shared-btn');
      if (sharedBtn) {
        sharedBtn.onclick = function() {
          showExampleHandListModal(p1Name + ' vs ' + p2Name, sharedHands, 'Hands where both players were at the table.');
        };
      }
    }
  }

  renderComparison();
  container.querySelector('#compare-p1').onchange = renderComparison;
  container.querySelector('#compare-p2').onchange = renderComparison;
}
