// ── CARDS PANEL ───────────────────────────────────────────────────────────────

function renderCards(container, d, hands) {
  var htOrder = ['Pocket Pairs', 'Broadway', 'Ace-Rag', 'Suited Connectors', 'Suited', 'Connectors', 'Offsuit Trash'];
  var htData = htOrder.filter(function(ht) { return d.htMap[ht]; });
  var maxDealt = htData.length ? Math.max.apply(null, htData.map(function(ht) { return d.htMap[ht].dealt; })) : 1;
  var cardsHtml = '<div class="panel-title">Cards</div>';
  cardsHtml += '<div class="panel-desc">Win rates by hand type: pairs, broadway, suited connectors, and more.</div>';

  // Verdict + section stories. Story cards classify by postflop hand strength;
  // the stacked bars below describe preflop hole-card type.
  var cardsFindings = [];
  if (typeof Sections !== 'undefined' && typeof Sections.evaluateSections === 'function') {
    cardsFindings = Sections.findingsForPanel(Sections.evaluateSections(d, {}, hands), 'Cards');
    cardsHtml += Sections.renderVerdict(cardsFindings, 'Not enough hands yet to call out a hand-strength leak.');
    if (cardsFindings.length) cardsHtml += '<div class="p-row">' + Sections.renderFindings(cardsFindings) + '</div>';
  }

  cardsHtml += '<div class="p-row">';
  // Legend
  cardsHtml += '<div class="ht-stack-legend">' +
    '<div class="ht-leg-item"><div class="ht-leg-sw leg-sw-won"></div>Won</div>' +
    '<div class="ht-leg-item"><div class="ht-leg-sw leg-sw-played"></div>Played, not won</div>' +
    '<div class="ht-leg-item"><div class="ht-leg-sw leg-sw-unplayed"></div>Dealt, not played</div>' +
    '</div>';
  cardsHtml += htData.map(function(ht) {
    var s = d.htMap[ht];
    var outerPct = Math.round(s.dealt / maxDealt * 100);
    var wonPct = s.dealt > 0 ? Math.round(s.won / s.dealt * 100) : 0;
    var playedNotWonPct = s.dealt > 0 ? Math.round((s.played - s.won) / s.dealt * 100) : 0;
    var unplayedPct = 100 - wonPct - playedNotWonPct;
    var wrPct = s.played > 0 ? pct(s.won, s.played) : null;
    var wrCol = wrPct === null ? 'var(--dim)' : wrPct >= 55 ? 'var(--green)' : wrPct <= 38 ? 'var(--red)' : 'var(--amber)';
    return '<div class="ht-stack-item">' +
      '<div class="ht-stack-header">' +
      '<span class="ht-stack-name">' + tipWrap(ht) + '</span>' +
      '<span class="ht-stack-meta">' + s.dealt + ' dealt · ' + s.played + ' played · ' +
      '<span style="color:' + wrCol + ';">' + (wrPct !== null ? wrPct + '% win' : '-') + '</span>' +
      '</span>' +
      '</div>' +
      '<div class="ht-stack-track" style="width:' + outerPct + '%;">' +
      '<div class="ht-stack-inner w-100">' +
      '<div class="ht-seg-won" style="width:' + wonPct + '%;"></div>' +
      '<div class="ht-seg-played" style="width:' + playedNotWonPct + '%;"></div>' +
      '<div class="ht-seg-unplayed" style="width:' + unplayedPct + '%;"></div>' +
      '</div>' +
      '</div>' +
      '</div>';
  }).join('');
  cardsHtml += '</div>';

  container.innerHTML = cardsHtml;
}
