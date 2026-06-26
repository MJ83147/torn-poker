var CARD_HT_ORDER = ['Pocket Pairs', 'Broadway', 'Ace-Rag', 'Suited Connectors', 'Suited', 'Connectors', 'Offsuit Trash'];

function renderCards(container, d, hands) {
  if (!container) return;
  mountPanel(container, 'cards', { title: 'Cards', desc: 'Win rates by hand type: pairs, broadway, suited connectors, and more.' });
  mountFindings(container, 'Cards', d, hands, 'Not enough hands yet to call out a hand-strength leak.');

  var htData = CARD_HT_ORDER.filter(function(ht) { return d.htMap[ht]; });
  var maxDealt = htData.length ? Math.max.apply(null, htData.map(function(ht) { return d.htMap[ht].dealt; })) : 1;

  // Collect the actual hands behind each hand-type bucket so a row click can
  // replay them. Most-recent first; capped so the list modal stays snappy.
  function handsOfType(ht) {
    var out = [];
    for (var i = hands.length - 1; i >= 0 && out.length < 60; i--) {
      var h = hands[i];
      if (!h || !h.hole) continue;
      var key = parseHoleKey(h.hole);
      if (key && classifyKey(key) === ht) out.push(h);
    }
    return out;
  }

  fillRows(container, 'bars', htData, function(row, ht) {
    var s = d.htMap[ht];
    var outerPct = pct(s.dealt, maxDealt) || 0;
    var wonPct = pct(s.won, s.dealt) || 0;
    var playedNotWonPct = pct(s.played - s.won, s.dealt) || 0;
    var unplayedPct = 100 - wonPct - playedNotWonPct;
    var wrPct = s.played > 0 ? pct(s.won, s.played) : null;
    var wrCls = wrPct === null ? 'c-dim' : wrPct >= 55 ? 'c-pos' : wrPct <= 38 ? 'c-neg' : 'c-warn';

    row.querySelector('[data-name]').innerHTML = tipWrap(ht) +
      '<span class="c-dim cards-row-cue"> · view hands &#8250;</span>';
    row.querySelector('[data-meta]').innerHTML = s.dealt + ' dealt · ' + s.played + ' played · ' +
      '<span class="' + wrCls + '">' + (wrPct !== null ? wrPct + '% win' : '-') + '</span>';
    row.querySelector('[data-track]').style.width = outerPct + '%';
    row.querySelector('[data-seg-won]').style.width = wonPct + '%';
    row.querySelector('[data-seg-played]').style.width = playedNotWonPct + '%';
    row.querySelector('[data-seg-unplayed]').style.width = unplayedPct + '%';

    row.classList.add('cards-bar-row');
    row.onclick = function() {
      var ex = handsOfType(ht);
      if (!ex.length) return;
      var note = ht + ': dealt ' + s.dealt + ', played ' + s.played +
        (wrPct !== null ? ', ' + wrPct + '% win rate when played' : '') + '.';
      showExampleHandListModal(ht + ' hands', ex, note);
    };
  });
}
