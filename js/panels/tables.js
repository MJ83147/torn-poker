function renderTables(container, hands, allHands, excludedTables, onRerender) {
  var allTableGroups = {};
  for (var i = 0; i < allHands.length; i++) {
    var h = allHands[i];
    var tid = inferTable(h);
    var key = tid || 'unknown';
    if (!allTableGroups[key]) allTableGroups[key] = [];
    allTableGroups[key].push(h);
  }

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

  if (Object.keys(allTableGroups).length <= 1) {
    container.innerHTML = '<div class="title title-lg c-gold">Tables</div>' +
      '<div class="text-body">Compare stats across different stakes.</div>' +
      '<div class="box lead">All hands are from a single table. Play across multiple tables to see comparisons.</div>';
    return;
  }

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

  mountPanel(container, 'tables', { title: 'Tables', desc: 'Compare stats across different stakes.' });

  var sectionInput = (allHands && allHands.length) ? allHands : hands;
  // Reuse the session-stable overall analysis so the insight pass hits the
  // evaluateSections memo. Computing a fresh analysis here forced a full
  // cold findings recompute (~450ms) on every Tables open.
  var dTables = State.overallAnalysis
    || ((typeof analyse === 'function') ? analyse(sectionInput) : null);
  if (dTables) mountFindings(container, 'Tables', dTables, sectionInput, 'Cross-table picture still building.');

  setSlot(container, 'head', renderTableHead(['Table', 'Blinds', 'Hands', '', { tip: 'Win Rate' }, { tip: 'Net P&L' }, { tip: 'VPIP' }, { tip: 'Aggression' }, { tip: 'Avg Pot' }, '']));

  var rowsHtml = '';
  for (var ri = 0; ri < tableRows.length; ri++) {
    var r = tableRows[ri];
    var barW = Math.round(r.n / maxHands * 100);
    var isExcluded = excludedTables.has(String(r.tid));
    rowsHtml += '<tr' + (isExcluded ? ' class="excluded"' : '') + '><td>' + r.label + '</td><td class="c-dim cell-sm">' + r.blinds + '</td><td>' + r.n + '</td>';
    rowsHtml += '<td style="width:80px;"><span class="spark" style="width:' + barW + '%;background:var(--gold2);"></span></td>';
    rowsHtml += '<td class="' + wrCls(r.wr) + '">' + (r.wr !== null ? r.wr + '%' : '-') + '</td>';
    rowsHtml += '<td class="' + pnlCls(r.net) + '">' + fmtPnl(r.net) + '</td>';
    rowsHtml += '<td>' + (r.vpipP !== null ? r.vpipP + '%' : '-') + '</td>';
    rowsHtml += '<td>' + (r.aggP !== null ? r.aggP + '%' : '-') + '</td>';
    var tblAvgPotDisp = r.tid !== 'unknown' && TABLE_META[r.tid]
      ? fmtBB(r.avgPot, TABLE_META[r.tid].bb)
      : fmt(r.avgPot);
    rowsHtml += '<td class="c-dim">' + (r.avgPot > 0 ? tblAvgPotDisp : '-') + '</td>';
    rowsHtml += '<td><button class="btn btn-ghost exclude-btn exclude-table-btn" data-tid="' + r.tid + '">' + (isExcluded ? 'Include' : 'Exclude') + '</button></td></tr>';
  }
  setSlot(container, 'rows', rowsHtml);

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
      switchTab('tables');
    };
  });
}
