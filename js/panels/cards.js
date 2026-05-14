// ── CARDS PANEL ───────────────────────────────────────────────────────────────

function renderCards(container, d, hands) {
  var htOrder = ['Pocket Pairs', 'Broadway', 'Ace-Rag', 'Suited Connectors', 'Suited', 'Connectors', 'Offsuit Trash'];
  var htData = htOrder.filter(function(ht) { return d.htMap[ht]; });
  var maxDealt = htData.length ? Math.max.apply(null, htData.map(function(ht) { return d.htMap[ht].dealt; })) : 1;
  var cardsHtml = '<div class="panel-title">Cards</div>';
  cardsHtml += '<div class="panel-desc">Win rates by hand type: pairs, broadway, suited connectors, and more.</div>';

  // Section stories (postflop hand strength buckets) render above the per-
  // hole-type stacked bars. The new stories classify by what the player held
  // at the moment of postflop decision (premium, strong, marginal, air);
  // the legacy bars below still describe preflop hole-card type.
  var sectionFindingsHtml = '';
  if (typeof Sections !== 'undefined' && typeof Sections.evaluateSections === 'function') {
    var cardsFindings = Sections.findingsForPanel(Sections.evaluateSections(d, {}, hands), 'Cards');
    if (cardsFindings.length) sectionFindingsHtml = Sections.renderFindings(cardsFindings);
  }
  if (sectionFindingsHtml) cardsHtml += '<div class="p-row">' + sectionFindingsHtml + '</div>';

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

  // ── Insights ────────────────────────────────────────────────────────────
  // Sample-aware minimums: a hand-type insight needs at least 5 dealt of the
  // type, scaled up against total hand count so a 30-hand sample can still
  // produce useful early reads.
  var totalN = d && typeof d.n === 'number' ? d.n : 0;
  function _minDealt(base) {
    if (!totalN) return base;
    return Math.max(base, Math.round(base * Math.max(1, Math.sqrt(40 / totalN))));
  }
  var minPair  = _minDealt(5);
  var minBw    = _minDealt(5);
  var minAR    = _minDealt(5);
  var minTrash = _minDealt(8);    // Trash insight needs more before firing.
  var minSC    = _minDealt(10);   // Suited connectors flag widest sample.

  var cIns = [];
  var ps = d.htMap['Pocket Pairs'];
  var as2 = d.htMap['Ace-Rag'];
  var ts = d.htMap['Offsuit Trash'];
  var scs = d.htMap['Suited Connectors'];
  var bw = d.htMap['Broadway'];
  if (ps && ps.dealt >= minPair) {
    var w = pct(ps.won, ps.played || 1);
    var exPair = findExampleHand(function(h) {
      var key = parseHoleKey(h.hole);
      return key && classifyKey(key) === 'Pocket Pairs' && h.outcome && h.outcome.result === (w < 45 ? 'lost' : 'won');
    });
    cIns.push(insWithExample(w < 45 ? 'r' : 'g', 'Pocket Pairs',
      'You win ' + w + '% with pairs (' + ps.played + ' played of ' + ps.dealt + ' dealt).',
      [{ v: w + '% win' }, { v: ps.dealt + ' dealt · ' + ps.played + ' played' }],
      exPair,
      w < 45 ? 'This pocket pair hand was lost. With pairs, aggression preflop builds the pot and charges draws. Slow playing lets opponents catch up cheaply.' : 'This pocket pair hand was won. Pairs are strong - keep betting them aggressively and charging draws.',
      'Pocket pairs flop a set roughly 1 in 8 times. Set-mine cheaply with small pairs in position; play big pairs aggressively preflop and bet hard postflop to charge draws.'));
  }
  if (bw && bw.dealt >= minBw) {
    var w2 = pct(bw.won, bw.played || 1);
    var exBw = findExampleHand(function(h) {
      var key = parseHoleKey(h.hole);
      return key && classifyKey(key) === 'Broadway' && h.outcome && h.outcome.result === (w2 < 45 ? 'lost' : 'won');
    });
    cIns.push(insWithExample(w2 < 45 ? 'a' : 'g', 'Broadway',
      'You win ' + w2 + '% across ' + bw.played + ' played broadway hands (' + bw.dealt + ' dealt).',
      [{ v: bw.dealt + ' dealt · ' + bw.played + ' played', hi: true }, { v: w2 + '% win' }],
      exBw,
      w2 < 45 ? 'This broadway hand was lost. Broadway hands are premium - ensure you are betting for value and not letting opponents draw cheaply.' : 'This broadway hand was won. Premium hands like these should be your bread and butter.',
      'Broadway hands (TJ-AK, suited or off) are premiums. Open them, 3-bet them in position, and value-bet relentlessly when you flop top pair or better.'));
  }
  if (as2 && as2.dealt >= minAR) {
    var w3 = pct(as2.won, as2.played || 1);
    var exAceRag = findExampleHand(function(h) {
      var key = parseHoleKey(h.hole);
      return key && classifyKey(key) === 'Ace-Rag' && h.outcome && h.outcome.result === 'lost';
    });
    cIns.push(insWithExample('a', 'Ace-Rag',
      'Dealt ' + as2.dealt + ' times, played ' + as2.played + '. Win rate: ' + (w3 !== null ? w3 + '%' : '?') + '.',
      [{ v: w3 !== null ? w3 + '% win' : '?' }, { v: as2.dealt + ' dealt · ' + as2.played + ' played' }],
      exAceRag,
      'This ace-rag hand was lost. Ace with a weak side card is dominated by any better ace. Avoid calling raises with these unless you have strong position.',
      'An ace with a weak kicker (A2-A9 offsuit) is dominated by any better ace. Fold to opens and 3-bets; only play these from late position when nobody has shown strength.'));
  }
  if (ts && ts.dealt >= minTrash) {
    var exTrash = findExampleHand(function(h) {
      var key = parseHoleKey(h.hole);
      if (!key || classifyKey(key) !== 'Offsuit Trash') return false;
      if (!h.outcome || h.outcome.result !== 'lost') return false;
      var ma = getHeroActions(h);
      return ma.some(function(a) { return a.type === 'call' || a.type === 'raise' || a.type === 'bet'; });
    });
    cIns.push(insWithExample(ts.played > 0 ? 'r' : 'n', 'Offsuit Trash',
      'Dealt ' + ts.dealt + ' offsuit trash hands, played ' + ts.played + '.',
      [{ v: ts.dealt + ' dealt' }, { v: ts.played + ' played' }],
      exTrash,
      'This offsuit trash hand was played and lost. These hands cost chips over time - fold them preflop.',
      'Non-connected, non-suited weak cards (like 92o or 73o) almost never win enough to justify the chips. Fold preflop unless checking from the big blind.'));
  }
  if (scs && scs.dealt >= minSC) {
    var w4 = pct(scs.won, scs.played || 1);
    var exSC = findExampleHand(function(h) {
      var key = parseHoleKey(h.hole);
      return key && classifyKey(key) === 'Suited Connectors';
    });
    cIns.push(insWithExample(w4 >= 50 ? 'g' : 'a', 'Suited Connectors',
      'You win ' + w4 + '% (' + scs.played + ' played of ' + scs.dealt + ' dealt).',
      [{ v: scs.dealt + ' dealt · ' + scs.played + ' played' }],
      exSC,
      'Suited connectors play best in position with implied odds. They are drawing hands - you want to see flops cheaply and hit straights or flushes.',
      'Suited connectors are implied-odds hands. Play them in position, see cheap flops, and only continue when you flop a strong draw or pair-plus-draw.'));
  }
  // Hand Type Performance summary card removed - it just recapped the per-bucket
  // insights above (Pocket Pairs / Broadway / Suited Connectors etc.), which
  // already tell the user which buckets they crush vs bleed.

  // Append engine insights (patterns: hand-strength) to legacy
  appendEngineInsights('cards', cIns, { limit: 4 });
  cardsHtml += '</div>';
  cardsHtml += '<div class="p-row">' + renderInsights(cIns, 'Cards', 'More hands needed for card-type breakdowns.') + '</div>';
  container.innerHTML = cardsHtml;
}
