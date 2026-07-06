// Betting (actions) panel view: assembles the UI from shared components +
// actionsModel.

function renderActions(container, d, hands) {
  if (!container) return;
  var m = actionsModel(d, hands);

  var segs = [
    { p: m.split.fold || 0, bg: 'bg-neg', l: 'Fold ' + m.split.fold + '%' },
    { p: m.split.check || 0, bg: 'bg-muted', l: 'Check ' + m.split.check + '%' },
    { p: m.split.call || 0, bg: 'bg-warn', l: 'Call ' + m.split.call + '%' },
    { p: m.split.raise || 0, bg: 'bg-pos', l: 'Raise ' + m.split.raise + '%' },
  ];

  var sitHtml = m.sit.map(function(s, i) {
    var hasHands = s.hands.length > 0;
    var labelHtml = tipWrap(s.label) +
      (hasHands ? '<span class="c-dim cards-row-cue"> &middot; view hands &#8250;</span>' : '');
    var row = barRow(labelHtml, s.p || 0, 100, s.cls, (s.p !== null ? s.p + '%' : '-'), s.done + '/' + s.opps + ' spots');
    return hasHands ? `<div class="cards-bar-row" data-sit-idx="${i}">${row}</div>` : row;
  }).join('');

  container.innerHTML =
    panelHeader('Betting', 'How you size your bets and choose your actions.') +
    panelFindings('Betting', d, hands, 'Betting profile looks balanced at this sample size.') +
    section('Overview', renderMiniRow([
      { l: 'Total Actions', v: m.actTotal, c: 'o' },
      { l: 'Folds', v: m.counts.folds, c: 'r' },
      { l: 'Checks', v: m.counts.checks, c: 'w' },
      { l: 'Calls', v: m.counts.calls, c: 'a' },
      { l: 'Raises', v: m.counts.raises, c: 'g' },
    ])) +
    section('Action split',
      barStack(segs) +
      legendRow(segs.map(function(s) { return { cls: s.bg, label: s.l }; }))) +
    section('Situational stats', `<div class="list" data-tour="sit-stats">${sitHtml}</div>`) +
    section('Average bet size by street', `<div class="list" data-tour="avg-bets">${m.avgBetRows.map(function(r) {
      return barRow(r.street, r.val, r.max, 'o', r.valStr, r.meta);
    }).join('')}</div>`) +
    section('Bet frequency (when you had the option)', `<div class="list">${m.betFreqRows.map(function(r) {
      return barRow(r.street, r.p || 0, 100, r.cls, (r.p !== null ? r.p + '%' : '-'), r.meta);
    }).join('')}</div>`);

  container.querySelectorAll('[data-sit-idx]').forEach(function(row) {
    row.onclick = function() {
      var entry = m.sit[parseInt(row.getAttribute('data-sit-idx'), 10)];
      if (entry && entry.hands.length) showExampleHandListModal(entry.label + ' hands', entry.hands, entry.note);
    };
  });
}
