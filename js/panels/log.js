// Hand Log panel logic. No DOM, no markup — the view is js/panels/views/log.js.

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

// One page of the (sorted) log.
function logModel(hands, sort, page, pageSize) {
  var sorted = sortHands(hands, sort.col, sort.dir);
  var start = page * pageSize;
  var end = Math.min(start + pageSize, sorted.length);
  return { sorted: sorted, pageHands: sorted.slice(start, end), start: start, end: end, total: sorted.length };
}

// Saved (starred) hands as a list, newest save first. Entries whose hand is
// missing are dropped.
function savedHandsModel() {
  var map = getStarredHands();
  return Object.keys(map)
    .sort(function(a, b) { return (map[b].savedAt || '') > (map[a].savedAt || '') ? 1 : -1; })
    .map(function(key) { return { key: key, entry: map[key] }; })
    .filter(function(x) { return x.entry.hand; });
}
