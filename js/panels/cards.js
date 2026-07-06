// Cards panel logic. No DOM, no markup — the view is js/panels/views/cards.js.

var CARD_HT_ORDER = ['Pocket Pairs', 'Broadway', 'Ace-Rag', 'Suited Connectors', 'Suited', 'Connectors', 'Offsuit Trash'];

// Per-hand-type stats for the stacked win-rate bars.
function cardsModel(d) {
  var types = CARD_HT_ORDER.filter(function(ht) { return d.htMap[ht]; });
  var maxDealt = types.length ? Math.max.apply(null, types.map(function(ht) { return d.htMap[ht].dealt; })) : 1;
  return types.map(function(ht) {
    var s = d.htMap[ht];
    var wonPct = pct(s.won, s.dealt) || 0;
    var playedNotWonPct = pct(s.played - s.won, s.dealt) || 0;
    var wrPct = s.played > 0 ? pct(s.won, s.played) : null;
    return {
      ht: ht,
      dealt: s.dealt,
      played: s.played,
      outerPct: pct(s.dealt, maxDealt) || 0,
      wonPct: wonPct,
      playedNotWonPct: playedNotWonPct,
      unplayedPct: 100 - wonPct - playedNotWonPct,
      wrPct: wrPct,
      wrCls: wrPct === null ? 'c-dim' : wrPct >= 55 ? 'c-pos' : wrPct <= 38 ? 'c-neg' : 'c-warn',
    };
  });
}

// The actual hands behind one hand-type bucket so a row click can replay
// them. Most-recent first; capped so the list modal stays snappy.
function cardsHandsOfType(hands, ht) {
  var out = [];
  for (var i = hands.length - 1; i >= 0 && out.length < 60; i--) {
    var h = hands[i];
    if (!h || !h.hole) continue;
    var key = parseHoleKey(h.hole);
    if (key && classifyKey(key) === ht) out.push(h);
  }
  return out;
}
