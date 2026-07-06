// Cards panel view: assembles the UI from shared components + cardsModel.

function renderCards(container, d, hands) {
  if (!container) return;
  var rows = cardsModel(d);

  var bars = rows.map(function(r, i) {
    var wr = r.wrPct !== null ? r.wrPct + '% win' : '-';
    return `<div class="stat cards-bar-row" data-ht-idx="${i}">
      <div class="row between">
        <span class="text-meta">${tipWrap(r.ht)}<span class="c-dim cards-row-cue"> · view hands &#8250;</span></span>
        <span class="text-meta">${r.dealt} dealt · ${r.played} played · <span class="${r.wrCls}">${wr}</span></span>
      </div>
      <div class="bar-stack" style="width:${r.outerPct}%;">
        <div class="bar-seg bg-pos" style="width:${r.wonPct}%;"></div>
        <div class="bar-seg bg-warn" style="width:${r.playedNotWonPct}%;"></div>
        <div class="bar-seg bg-muted" style="width:${r.unplayedPct}%;"></div>
      </div>
    </div>`;
  }).join('');

  container.innerHTML =
    panelHeader('Cards', 'Win rates by hand type: pairs, broadway, suited connectors, and more.') +
    panelFindings('Cards', d, hands, 'Not enough hands yet to call out a hand-strength leak.') +
    section('Win Rate by Hand Type',
      legendRow([
        { cls: 'bg-pos', label: 'Won' },
        { cls: 'bg-warn', label: 'Played, not won' },
        { cls: 'bg-muted', label: 'Dealt, not played' },
      ], ' data-tour="ht-legend"') +
      `<div class="list">${bars}</div>`);

  container.querySelectorAll('[data-ht-idx]').forEach(function(row) {
    row.onclick = function() {
      var r = rows[parseInt(row.getAttribute('data-ht-idx'), 10)];
      if (!r) return;
      var ex = cardsHandsOfType(hands, r.ht);
      if (!ex.length) return;
      var note = r.ht + ': dealt ' + r.dealt + ', played ' + r.played +
        (r.wrPct !== null ? ', ' + r.wrPct + '% win rate when played' : '') + '.';
      showExampleHandListModal(r.ht + ' hands', ex, note);
    };
  });
}
