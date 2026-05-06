// ── TABLES PANEL ──────────────────────────────────────────────────────────────

function renderTables(container, hands, allHands, excludedTables, onRerender) {
  var allTableGroups = {};
  for (var i = 0; i < allHands.length; i++) {
    var h = allHands[i];
    var tid = inferTable(h);
    var key = tid || 'unknown';
    if (!allTableGroups[key]) allTableGroups[key] = [];
    allTableGroups[key].push(h);
  }

  // Populate the header table-filter dropdown
  var filterEl = document.getElementById('table-filter');
  var prevVal = filterEl.value || 'all';
  filterEl.innerHTML = '<option value="all">All Tables (' + allHands.length + ')</option>';
  var sortedTables = Object.keys(allTableGroups)
    .filter(function(k) { return k !== 'unknown'; })
    .map(Number)
    .sort(function(a, b) { return (TABLE_META[b] ? TABLE_META[b].bb : 0) - (TABLE_META[a] ? TABLE_META[a].bb : 0); });
  for (var ti = 0; ti < sortedTables.length; ti++) {
    var tid2 = sortedTables[ti];
    var label = getTableLabel(tid2);
    var count = allTableGroups[tid2].length;
    filterEl.innerHTML += '<option value="' + tid2 + '">' + label + ' (' + count + ')</option>';
  }
  if (allTableGroups['unknown'] && allTableGroups['unknown'].length) {
    filterEl.innerHTML += '<option value="unknown">Unknown (' + allTableGroups['unknown'].length + ')</option>';
  }
  filterEl.classList.toggle('hidden', Object.keys(allTableGroups).length <= 1);
  filterEl.value = prevVal;

  var tablesHtml = '';
  if (Object.keys(allTableGroups).length <= 1) {
    tablesHtml = ins('n', 'Single Table', 'All hands are from a single table. Play across multiple tables to see comparisons.', []);
  } else {
    var tableRows = [];
    var allTableIds = sortedTables.slice();
    if (allTableGroups['unknown']) allTableIds.push('unknown');
    for (var ai = 0; ai < allTableIds.length; ai++) {
      var tid3 = allTableIds[ai];
      var tHands = allTableGroups[tid3];
      var tD = analyse(tHands);
      var tWr = pct(tD.handsWon, tD.handsWithOutcome);
      var tNet = tD.totalWonAmount - tD.totalInvested;
      var tVpip = pct(tD.vpip, tD.n);
      var tAgg = calcAggression(tD.raises, tD.calls, tD.checks);
      var tLabel = tid3 === 'unknown' ? 'Unknown' : getTableLabel(tid3);
      var blinds = tid3 !== 'unknown' && TABLE_META[tid3] ? fmt(TABLE_META[tid3].sb) + '/' + fmt(TABLE_META[tid3].bb) : '';
      tableRows.push({
        tid: tid3, label: tLabel, blinds: blinds, n: tD.n, wr: tWr, net: tNet,
        vpipP: tVpip, aggP: tAgg,
        avgPot: tD.handsWithOutcome > 0 ? Math.round((tD.totalWonAmount + tD.totalInvested) / tD.handsWithOutcome) : 0,
      });
    }
    var maxHands = Math.max.apply(null, tableRows.map(function(r) { return r.n; }).concat([1]));
    tablesHtml += '<div class="panel-title">Tables</div>';
    tablesHtml += '<div class="panel-desc">Compare stats across different stakes.</div>';
    tablesHtml += '<div class="p-row"><div class="sec-subtitle mt-0">Performance by Table</div>';
    tablesHtml += '<div class="overflow-x"><table class="tbl"><thead><tr>';
    tablesHtml += '<th>Table</th><th>Blinds</th><th>Hands</th><th></th><th>' + tipWrap('Win Rate') + '</th><th>' + tipWrap('Net P&L') + '</th><th>' + tipWrap('VPIP') + '</th><th>' + tipWrap('Aggression') + '</th><th>' + tipWrap('Avg Pot') + '</th><th></th>';
    tablesHtml += '</tr></thead><tbody>';
    for (var ri = 0; ri < tableRows.length; ri++) {
      var r = tableRows[ri];
      var barW = Math.round(r.n / maxHands * 100);
      var isExcluded = excludedTables.has(String(r.tid));
      tablesHtml += '<tr' + (isExcluded ? ' style="opacity:0.35;"' : '') + '><td>' + r.label + '</td><td class="text-dim" style="font-size:10px;">' + r.blinds + '</td><td>' + r.n + '</td>';
      tablesHtml += '<td style="width:80px;"><span class="tbl-spark" style="width:' + barW + '%;background:var(--gold2);"></span></td>';
      tablesHtml += '<td class="' + wrCls(r.wr) + '">' + (r.wr !== null ? r.wr + '%' : '-') + '</td>';
      tablesHtml += '<td class="' + pnlCls(r.net) + '">' + fmtPnl(r.net) + '</td>';
      tablesHtml += '<td>' + (r.vpipP !== null ? r.vpipP + '%' : '-') + '</td>';
      tablesHtml += '<td>' + (r.aggP !== null ? r.aggP + '%' : '-') + '</td>';
      var tblAvgPotDisp = r.tid !== 'unknown' && TABLE_META[r.tid]
        ? fmtBB(r.avgPot, TABLE_META[r.tid].bb)
        : fmt(r.avgPot);
      tablesHtml += '<td class="text-dim">' + (r.avgPot > 0 ? tblAvgPotDisp : '-') + '</td>';
      tablesHtml += '<td><button class="log-nav-btn exclude-btn exclude-table-btn" data-tid="' + r.tid + '">' + (isExcluded ? 'Include' : 'Exclude') + '</button></td></tr>';
    }
    tablesHtml += '</tbody></table></div></div>';

    var tIns2 = [];
    if (tableRows.length >= 2) {
      var best = tableRows.filter(function(r2) { return r2.wr !== null; }).sort(function(a, b) { return b.wr - a.wr; })[0];
      var worst = tableRows.filter(function(r2) { return r2.wr !== null && r2.n >= 5; }).sort(function(a, b) { return a.wr - b.wr; })[0];
      var mostProfit = tableRows.slice().sort(function(a, b) { return b.net - a.net; })[0];
      if (best && best.wr >= 40) {
        var exBestTable = findExampleHand(function(h) { return String(inferTable(h) || 'unknown') === String(best.tid) && h.outcome && h.outcome.result === 'won'; });
        tIns2.push(insWithExample(best.wr >= 50 ? 'g' : 'n', 'Best Win Rate', best.label + ' at ' + best.wr + '% across ' + best.n + ' hands.', [{ v: best.wr + '%', hi: true }, { v: best.n + ' hands' }], exBestTable, 'A winning hand from ' + best.label + ', your highest win-rate table. Consider whether the player pool or stakes here suit your style particularly well.'));
      }
      if (worst && worst.wr < 40 && worst.n >= 5) {
        var exWorstTable = findExampleHand(function(h) { return String(inferTable(h) || 'unknown') === String(worst.tid) && h.outcome && h.outcome.result !== 'won'; });
        tIns2.push(insWithExample('r', 'Lowest Win Rate', worst.label + ' at ' + worst.wr + '% across ' + worst.n + ' hands. Consider whether the stakes or player pool suit your style.', [{ v: worst.wr + '%', hi: true }, { v: worst.n + ' hands' }], exWorstTable, 'A losing hand from ' + worst.label + '. Review whether you are adjusting your strategy for this table\'s stakes and player tendencies.'));
      }
      if (mostProfit && mostProfit.net > 0) {
        var exProfitTable = findExampleHand(function(h) { return String(inferTable(h) || 'unknown') === String(mostProfit.tid) && h.outcome && h.outcome.result === 'won'; });
        tIns2.push(insWithExample('g', 'Most Profitable', mostProfit.label + ' with a net of ' + fmtPnl(mostProfit.net) + '.', [{ v: fmtPnl(mostProfit.net), hi: true }], exProfitTable, 'A winning hand from your most profitable table. The combination of stakes, player pool, and your strategy is working well here.'));
      }
      var bigLoss = tableRows.filter(function(r2) { return r2.net < 0; }).sort(function(a, b) { return a.net - b.net; })[0];
      if (bigLoss) {
        var exLossTable = findExampleHand(function(h) { return String(inferTable(h) || 'unknown') === String(bigLoss.tid) && h.outcome && h.outcome.result !== 'won'; });
        tIns2.push(insWithExample('a', 'Biggest Loss', bigLoss.label + ' at ' + fmtPnl(bigLoss.net) + '. Review whether leaks are table-specific or general.', [{ v: fmtPnl(bigLoss.net), hi: true }], exLossTable, 'A losing hand from ' + bigLoss.label + '. Check if you are playing too loose or calling too much at these stakes.'));
      }
    }
    // Append engine insights to legacy
    var engineTblIns = InsightEngine.forPanel('tables', 4);
    for (var etbi = 0; etbi < engineTblIns.length; etbi++) {
      var dupTbl = false;
      for (var ti3 = 0; ti3 < tIns2.length; ti3++) {
        if (tIns2[ti3].indexOf(engineTblIns[etbi].label) !== -1) { dupTbl = true; break; }
      }
      if (!dupTbl) tIns2.push(renderRuleInsight(engineTblIns[etbi]));
    }
    tablesHtml += '<div class="p-row">' + renderInsights(tIns2, 'Tables', 'More data needed for table-level insights.') + '</div>';
  }
  container.innerHTML = tablesHtml;

  // Wire exclude/include buttons
  container.querySelectorAll('.exclude-table-btn').forEach(function(btn) {
    btn.onclick = function(e) {
      e.stopPropagation();
      var btnTid = this.getAttribute('data-tid');
      if (excludedTables.has(btnTid)) {
        excludedTables.delete(btnTid);
      } else {
        excludedTables.add(btnTid);
      }
      if (!onRerender()) {
        excludedTables.delete(btnTid);
        return;
      }
      // Switch back to tables tab
      switchTab('tables');
    };
  });
}
