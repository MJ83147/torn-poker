// Tables panel logic: group hands by table and compute per-table stats.
// No DOM, no markup — the view lives in js/panels/views/tables.js.
function tablesModel(allHands) {
  var groups = {};
  for (var i = 0; i < allHands.length; i++) {
    var key = inferTable(allHands[i]) || 'unknown';
    if (!groups[key]) groups[key] = [];
    groups[key].push(allHands[i]);
  }

  // Numbered tables by stake (big blind, descending), unknown last.
  var ids = Object.keys(groups)
    .filter(function(k) { return k !== 'unknown'; })
    .map(Number)
    .sort(function(a, b) { return (TABLE_META[b] ? TABLE_META[b].bb : 0) - (TABLE_META[a] ? TABLE_META[a].bb : 0); });
  if (groups['unknown']) ids.push('unknown');

  var multiTable = Object.keys(groups).length > 1;

  // Single table -> the view shows the empty state; skip the per-table stats.
  var rows = !multiTable ? [] : ids.map(function(tid) {
    var tD = analyse(groups[tid]);
    return {
      tid: tid,
      label: tid === 'unknown' ? 'Unknown' : getTableLabel(tid),
      blinds: tid !== 'unknown' && TABLE_META[tid] ? fmt(TABLE_META[tid].sb) + '/' + fmt(TABLE_META[tid].bb) : '',
      n: tD.n,
      wr: pct(tD.handsWon, tD.handsWithOutcome),
      net: tD.totalWonAmount - tD.totalInvested,
      vpipP: pct(tD.vpip, tD.n),
      aggP: calcAggression(tD.raises, tD.calls, tD.checks),
      avgPot: tD.handsWithOutcome > 0 ? Math.round((tD.totalWonAmount + tD.totalInvested) / tD.handsWithOutcome) : 0,
    };
  });

  return {
    groups: groups,
    ids: ids,
    rows: rows,
    maxHands: Math.max.apply(null, rows.map(function(r) { return r.n; }).concat([1])),
    multiTable: multiTable,
  };
}
