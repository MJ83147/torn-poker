// Tables panel view: assembles the UI from shared components + tablesModel.
// Entry point keeps the renderTables name so app.js dispatch is unchanged.

function renderTables(container, hands, allHands, excludedTables, onRerender) {
  var m = tablesModel(allHands);
  _tablesFilterOptions(m, allHands.length);

  if (!m.multiTable) {
    container.innerHTML =
      panelHeader('Tables', 'Compare stats across different stakes.') +
      emptyState('All hands are from a single table. Play across multiple tables to see comparisons.');
    return;
  }

  // Reuse the session-stable overall analysis so the insight pass hits the
  // evaluateSections memo. Computing a fresh analysis here forced a full
  // cold findings recompute (~450ms) on every Tables open.
  var sectionInput = allHands.length ? allHands : hands;
  var d = State.overallAnalysis || ((typeof analyse === 'function') ? analyse(sectionInput) : null);

  container.innerHTML =
    panelHeader('Tables', 'Compare stats across different stakes.') +
    (d ? panelFindings('Tables', d, sectionInput, 'Cross-table picture still building.') : '') +
    dataTable({
      head: ['Table', 'Blinds', 'Hands', '', { tip: 'Win Rate' }, { tip: 'Net P&L' }, { tip: 'VPIP' }, { tip: 'Aggression' }, { tip: 'Avg Pot' }, ''],
      rows: m.rows.map(function(r) {
        return _tablesRow(r, excludedTables.has(String(r.tid)), m.maxHands);
      }),
    });

  _wireTablesRows(container, m.groups);
  _wireTablesExclude(container, excludedTables, onRerender);
}

function _tablesRow(r, isExcluded, maxHands) {
  var barW = Math.round(r.n / maxHands * 100);
  var tableBB = r.tid !== 'unknown' && TABLE_META[r.tid] ? TABLE_META[r.tid].bb : null;
  var avgPotDisp = tableBB ? fmtBB(r.avgPot, tableBB) : fmt(r.avgPot);
  return `
    <tr class="link${isExcluded ? ' excluded' : ''}" data-table-cell="${r.tid}">
      <td>${r.label} <span class="c-dim cards-row-cue">&#8250;</span></td>
      <td class="c-dim cell-sm">${r.blinds}</td>
      <td>${r.n}</td>
      <td style="width:80px;"><span class="spark" style="width:${barW}%;background:var(--gold2);"></span></td>
      <td class="${wrCls(r.wr)}">${r.wr !== null ? r.wr + '%' : '-'}</td>
      <td class="${pnlCls(r.net)}">${fmtPnlBB(r.net, tableBB)}</td>
      <td>${r.vpipP !== null ? r.vpipP + '%' : '-'}</td>
      <td>${r.aggP !== null ? r.aggP + '%' : '-'}</td>
      <td class="c-dim">${r.avgPot > 0 ? avgPotDisp : '-'}</td>
      <td><button class="btn btn-ghost exclude-table-btn" data-tid="${r.tid}">${isExcluded ? 'Include' : 'Exclude'}</button></td>
    </tr>`;
}

// The #table-filter <select> lives in the page header, outside the panel.
function _tablesFilterOptions(m, totalHands) {
  var filterEl = document.getElementById('table-filter');
  if (!filterEl) return;
  var prevVal = filterEl.value || 'all';
  var opts = `<option value="all">All Tables (${totalHands})</option>`;
  for (var i = 0; i < m.ids.length; i++) {
    var tid = m.ids[i];
    var label = tid === 'unknown' ? 'Unknown' : getTableLabel(tid);
    opts += `<option value="${tid}">${label} (${m.groups[tid].length})</option>`;
  }
  filterEl.innerHTML = opts;
  filterEl.classList.toggle('hidden', !m.multiTable);
  filterEl.value = prevVal;
}

function _wireTablesRows(container, groups) {
  container.querySelectorAll('[data-table-cell]').forEach(function(cell) {
    cell.onclick = function(e) {
      e.stopPropagation();
      var tid = cell.getAttribute('data-table-cell');
      var group = groups[tid] || [];
      if (!group.length) return;
      var recent = group.slice().sort(function(a, b) {
        return (b.timestamp || 0) - (a.timestamp || 0);
      }).slice(0, 15);
      var net = 0;
      for (var gi = 0; gi < group.length; gi++) net += getHandPnlValue(group[gi]) || 0;
      var label = tid === 'unknown' ? 'Unknown' : getTableLabel(tid);
      var noteBB = tid !== 'unknown' && TABLE_META[tid] ? TABLE_META[tid].bb : null;
      showExampleHandListModal('Hands at ' + label, recent,
        'Recent hands at ' + label + '. Net P&L here is ' + fmtPnlBB(net, noteBB) + ' across ' + group.length +
        ' hands. Look for the pattern that sets this table apart from the others.');
    };
  });
}

function _wireTablesExclude(container, excludedTables, onRerender) {
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
