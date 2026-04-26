// ── HEADS-UP COMPARISON PANEL ─────────────────────────────────────────────────

function renderCompare(container, d, hands) {
  var heroName = State.meta.player;

  // Build player list from all actions
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
      '<div class="panel-desc">Compare two players side by side.</div>' +
      '<div class="p-row"><div class="desc-text">Need at least two players in the data to compare.</div></div>';
    return;
  }

  // Default selections: hero vs most-played opponent
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
    '<div class="panel-desc">Compare two players side by side.</div>' +
    '<div class="p-row">' +
    '<div class="compare-selectors">' +
    '<select id="compare-p1" class="table-filter">' + buildOptions(p1Default) + '</select>' +
    '<span class="compare-vs">vs</span>' +
    '<select id="compare-p2" class="table-filter">' + buildOptions(p2Default) + '</select>' +
    '</div>' +
    '</div>' +
    '<div id="compare-body"></div>';

  function getHeroStats() {
    return {
      hands: d.n,
      vpip: pct(d.vpip, d.n),
      pfr: pct(d.pfr, d.n),
      agg: calcAggression(d.raises, d.calls, d.checks),
      cbet: pct(d.cbetDone, d.cbetOpps),
      foldToRaise: pct(d.foldToRaise, d.facedRaise),
      wtsd: pct(d.wentToShowdown, d.sawFlop),
      limp: pct(d.limpHands, d.n),
      wr: pct(d.handsWon, d.handsWithOutcome),
      netPnl: d.totalWonAmount - d.totalInvested
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
    // Sample-scaled trigger gap: small samples need a wider gap before the
    // edge surfaces.
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
      body.innerHTML = '<div class="p-row"><div class="desc-text">Select two different players to compare.</div></div>';
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
        '<td class="dim-label">' + tipWrap(sr.label) + '</td>' +
        '<td class="' + (better1 ? 'compare-better' : '') + '">' + fmtStat(v1, sr.suffix) + (better1 && Math.abs(v1 - v2) >= 3 ? ' &#9664;' : '') + '</td>' +
        '<td class="' + (better2 ? 'compare-better' : '') + '">' + fmtStat(v2, sr.suffix) + (better2 && Math.abs(v1 - v2) >= 3 ? ' &#9664;' : '') + '</td>' +
        '<td class="compare-edge">' + edge + '</td>' +
        '</tr>';
    }
    tableHtml += '</tbody></table>';

    // Head-to-head record: find shared hands
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

    var h2hHtml = '<div class="p-row"><div class="dim-label">Head-to-Head Record</div>';
    if (sharedHands.length === 0) {
      h2hHtml += '<div class="desc-text">No shared hands found between these players.</div>';
    } else {
      var p1WinPct = Math.round(p1Wins / sharedHands.length * 100);
      h2hHtml += '<div class="compare-h2h">' +
        '<span>' + sharedHands.length + ' shared hands</span>' +
        '<span class="compare-h2h-record">' + p1Name + ' won ' + p1Wins + ' (' + p1WinPct + '%) · ' + p2Name + ' won ' + p2Wins + '</span>' +
        '</div>';
      h2hHtml += '<button class="example-hand-btn" id="compare-shared-btn">View ' + sharedHands.length + ' shared hands</button>';
    }
    h2hHtml += '</div>';

    // ── Exploit tips ────────────────────────────────────────────────────
    var exploits = [];
    var targetName = (p2Name !== heroName) ? p2Name : p1Name;
    var targetStats = (targetName === p1Name) ? s1 : s2;

    // Dominant seat-count for the table mix where these two players overlap;
    // drives the exploit thresholds (HU expects different numbers from
    // 6-max).
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
    // Pull what we know about the opponent's positional tendencies from the
    // shared opponent cache. Used to qualify the "from late position" tips.
    var _oppProf = (typeof _opponentCache !== 'undefined' && targetName)
      ? _opponentCache[targetName] : null;
    var _oppLatePosBias = _oppProf && _oppProf.raw && typeof _oppProf.raw.latePos === 'number'
      ? _oppProf.raw.latePos : null;

    // Dynamic thresholds: HU/3-handed compress everything (defenders fold
    // less, openers play wider), so adjust gates by table size.
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
      exploits.push(targetName + ' folds to raises ' + targetStats.foldToRaise + '% - raise wide against them.' + lateNote);
    }
    if (targetStats.cbet !== null && targetStats.cbet <= _cbetGate) {
      exploits.push(targetName + ' c-bets only ' + targetStats.cbet + '% - float their checks on the flop and bet when they show weakness.');
    }
    if (targetStats.wtsd !== null && targetStats.wtsd >= _wtsdGate) {
      exploits.push(targetName + ' goes to showdown ' + targetStats.wtsd + '% - value bet thin, they call down.');
    }
    if (targetStats.limp !== null && targetStats.limp >= _limpGate) {
      exploits.push(targetName + ' limps ' + targetStats.limp + '% - raise their limps with a wide range.');
    }
    if (targetStats.agg !== null && targetStats.agg <= _aggGate) {
      exploits.push(targetName + ' is passive (' + targetStats.agg + '% agg) - their bets mean strength, fold more to them.');
    }
    if (targetStats.vpip !== null && targetStats.vpip >= _vpipGate) {
      exploits.push(targetName + ' plays ' + targetStats.vpip + '% of hands at this table size - tighten up and value bet relentlessly.');
    }

    var exploitHtml = '';
    if (exploits.length > 0) {
      exploitHtml = '<div class="p-row"><div class="dim-label">Exploit Tips</div><div class="compare-exploits">';
      for (var i = 0; i < exploits.length; i++) {
        exploitHtml += '<div class="compare-exploit-item">' + exploits[i] + '</div>';
      }
      exploitHtml += '</div></div>';
    }

    // Insufficient data warning
    var warnHtml = '';
    if (s1.hands < 10 || s2.hands < 10) {
      var lowName = s1.hands < 10 ? p1Name : p2Name;
      var lowCount = s1.hands < 10 ? s1.hands : s2.hands;
      warnHtml = '<div class="p-row"><div class="ins"><div class="ins-badge a"><div class="ins-dot"></div><div class="ins-word">Warning</div></div><div class="ins-label">Small Sample</div><div class="ins-text">' + lowName + ' only has ' + lowCount + ' hands. Stats may be unreliable until 20+ hands are available.</div></div></div>';
    }

    body.innerHTML = warnHtml + '<div class="p-row">' + tableHtml + '</div>' + h2hHtml + exploitHtml;

    // Wire shared hands button
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
