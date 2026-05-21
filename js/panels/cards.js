// ── CARDS PANEL ───────────────────────────────────────────────────────────────

var CARD_HT_ORDER = ['Pocket Pairs', 'Broadway', 'Ace-Rag', 'Suited Connectors', 'Suited', 'Connectors', 'Offsuit Trash'];

function renderCards(container, d, hands) {
  if (!container) return;
  mountTemplate(container, 'cards');

  // Verdict + section stories. Story cards classify by postflop hand strength;
  // the stacked bars below describe preflop hole-card type.
  mountFindings(container, 'Cards', d, hands, 'Not enough hands yet to call out a hand-strength leak.');

  var htData = CARD_HT_ORDER.filter(function(ht) { return d.htMap[ht]; });
  var maxDealt = htData.length ? Math.max.apply(null, htData.map(function(ht) { return d.htMap[ht].dealt; })) : 1;

  fillRows(container, 'bars', htData, function(row, ht) {
    var s = d.htMap[ht];
    var outerPct = pct(s.dealt, maxDealt) || 0;
    var wonPct = pct(s.won, s.dealt) || 0;
    var playedNotWonPct = pct(s.played - s.won, s.dealt) || 0;
    var unplayedPct = 100 - wonPct - playedNotWonPct;
    var wrPct = s.played > 0 ? pct(s.won, s.played) : null;
    var wrCol = wrPct === null ? 'var(--dim)' : wrPct >= 55 ? 'var(--green)' : wrPct <= 38 ? 'var(--red)' : 'var(--amber)';

    row.querySelector('.ht-stack-name').innerHTML = tipWrap(ht);
    row.querySelector('.ht-stack-meta').innerHTML = s.dealt + ' dealt · ' + s.played + ' played · ' +
      '<span style="color:' + wrCol + ';">' + (wrPct !== null ? wrPct + '% win' : '-') + '</span>';
    row.querySelector('.ht-stack-track').style.width = outerPct + '%';
    row.querySelector('.ht-seg-won').style.width = wonPct + '%';
    row.querySelector('.ht-seg-played').style.width = playedNotWonPct + '%';
    row.querySelector('.ht-seg-unplayed').style.width = unplayedPct + '%';
  });
}
