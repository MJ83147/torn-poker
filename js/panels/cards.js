// ── CARDS PANEL ───────────────────────────────────────────────────────────────

function renderCards(container, d, hands) {
  var htOrder = ['Pocket Pairs', 'Broadway', 'Ace-Rag', 'Suited Connectors', 'Suited', 'Connectors', 'Offsuit Trash'];
  var htData = htOrder.filter(function(ht) { return d.htMap[ht]; });
  var maxDealt = htData.length ? Math.max.apply(null, htData.map(function(ht) { return d.htMap[ht].dealt; })) : 1;
  var cardsHtml = '<div>';
  cardsHtml += '<div>';
  // Legend
  cardsHtml += '<div class="ht-stack-legend">' +
    '<div class="ht-leg-item"><div class="ht-leg-sw" style="background:var(--green);"></div>Won</div>' +
    '<div class="ht-leg-item"><div class="ht-leg-sw" style="background:var(--amber);opacity:0.75;"></div>Played, not won</div>' +
    '<div class="ht-leg-item"><div class="ht-leg-sw" style="background:#2e3e2e;"></div>Dealt, not played</div>' +
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
      '<span style="color:' + wrCol + ';">' + (wrPct !== null ? wrPct + '% win' : '—') + '</span>' +
      '</span>' +
      '</div>' +
      '<div class="ht-stack-track" style="width:' + outerPct + '%;">' +
      '<div class="ht-stack-inner" style="width:100%;">' +
      '<div class="ht-seg-won" style="width:' + wonPct + '%;"></div>' +
      '<div class="ht-seg-played" style="width:' + playedNotWonPct + '%;"></div>' +
      '<div class="ht-seg-unplayed" style="width:' + unplayedPct + '%;"></div>' +
      '</div>' +
      '</div>' +
      '</div>';
  }).join('');
  cardsHtml += '</div>';

  // Insights
  var cIns = [];
  var ps = d.htMap['Pocket Pairs'];
  var as2 = d.htMap['Ace-Rag'];
  var ts = d.htMap['Offsuit Trash'];
  var scs = d.htMap['Suited Connectors'];
  var bw = d.htMap['Broadway'];
  if (ps && ps.dealt >= 2) {
    var w = pct(ps.won, ps.played || 1);
    var exPair = findExampleHand(function(h) {
      var key = parseHoleKey(h.hole);
      return key && classifyKey(key) === 'Pocket Pairs' && h.outcome && h.outcome.result === (w < 45 ? 'lost' : 'won');
    });
    cIns.push(insWithExample(w < 45 ? 'r' : 'g', 'Pocket Pairs', w < 45 ? 'Winning only ' + w + '% with pairs (' + ps.played + ' played of ' + ps.dealt + ' dealt). Bet hard preflop and charge draws — don\'t slow play.' : 'Good ' + w + '% win rate with pairs (' + ps.played + ' played of ' + ps.dealt + ' dealt). Keep betting them aggressively.', [{
      v: w + '% win',
    }, {
      v: ps.dealt + ' dealt · ' + ps.played + ' played',
    }], exPair, w < 45 ? 'This pocket pair hand was lost. With pairs, aggression preflop builds the pot and charges draws. Slow playing lets opponents catch up cheaply.' : 'This pocket pair hand was won. Pairs are strong — keep betting them aggressively and charging draws.'));
  }
  if (bw && bw.dealt >= 3) {
    var w2 = pct(bw.won, bw.played || 1);
    var exBw = findExampleHand(function(h) {
      var key = parseHoleKey(h.hole);
      return key && classifyKey(key) === 'Broadway' && h.outcome && h.outcome.result === (w2 < 45 ? 'lost' : 'won');
    });
    cIns.push(insWithExample(w2 < 45 ? 'a' : 'g', 'Broadway', w2 + '% win rate across ' + bw.played + ' played broadway hands (' + bw.dealt + ' dealt). These are premium hands — if you\'re losing with them, check your postflop bet sizing.', [{
      v: bw.dealt + ' dealt · ' + bw.played + ' played',
      hi: true,
    }, {
      v: w2 + '% win',
    }], exBw, w2 < 45 ? 'This broadway hand was lost. Broadway hands are premium — ensure you are betting for value and not letting opponents draw cheaply.' : 'This broadway hand was won. Premium hands like these should be your bread and butter.'));
  }
  if (as2 && as2.dealt >= 3) {
    var w3 = pct(as2.won, as2.played || 1);
    var exAceRag = findExampleHand(function(h) {
      var key = parseHoleKey(h.hole);
      return key && classifyKey(key) === 'Ace-Rag' && h.outcome && h.outcome.result === 'lost';
    });
    cIns.push(insWithExample('a', 'Ace-Rag', 'Dealt ' + as2.dealt + ' times, played ' + as2.played + '. An ace with a weak kicker loses to any better ace — be careful calling raises.', [{
      v: w3 !== null ? w3 + '% win' : '?',
    }, {
      v: as2.dealt + ' dealt · ' + as2.played + ' played',
    }], exAceRag, 'This ace-rag hand was lost. Ace with a weak kicker is dominated by any better ace. Avoid calling raises with these unless you have strong position.'));
  }
  if (ts && ts.dealt >= 3) {
    var exTrash = findExampleHand(function(h) {
      var key = parseHoleKey(h.hole);
      if (!key || classifyKey(key) !== 'Offsuit Trash') return false;
      if (!h.outcome || h.outcome.result !== 'lost') return false;
      var ma = parseActions(h.actions).filter(function(a) { return a.isMe; });
      return ma.some(function(a) { return a.type === 'call' || a.type === 'raise'; });
    });
    cIns.push(insWithExample(ts.played > 0 ? 'r' : 'n', 'Offsuit Trash', 'Dealt ' + ts.dealt + ' offsuit trash hands, played ' + ts.played + '. These are almost always folds preflop.', [{
      v: ts.dealt + ' dealt',
    }, {
      v: ts.played + ' played',
    }], exTrash, 'This offsuit trash hand was played and lost. These hands cost chips over time — fold them preflop.'));
  }
  if (scs && scs.dealt >= 3) {
    var w4 = pct(scs.won, scs.played || 1);
    var exSC = findExampleHand(function(h) {
      var key = parseHoleKey(h.hole);
      return key && classifyKey(key) === 'Suited Connectors';
    });
    cIns.push(insWithExample(w4 >= 50 ? 'g' : 'a', 'Suited Connectors', w4 + '% win rate (' + scs.played + ' played of ' + scs.dealt + ' dealt). Play these in position where you have the most ways to win.', [{
      v: scs.dealt + ' dealt · ' + scs.played + ' played',
    }], exSC, 'Suited connectors play best in position with implied odds. They are drawing hands — you want to see flops cheaply and hit straights or flushes.'));
  }
  // Hand Type Performance
  var htWinRates = htOrder.filter(function(ht) { return d.htMap[ht] && d.htMap[ht].played >= 3; }).map(function(ht) {
    return { ht: ht, wr: pct(d.htMap[ht].won, d.htMap[ht].played), played: d.htMap[ht].played };
  }).sort(function(a, b) { return (b.wr || 0) - (a.wr || 0); });
  if (htWinRates.length >= 2) {
    var bestHT = htWinRates[0];
    var worstHT = htWinRates[htWinRates.length - 1];
    cIns.push(ins('o', 'Hand Type Performance', 'Best category: ' + bestHT.ht + ' at ' + bestHT.wr + '% win rate (' + bestHT.played + ' played). Worst: ' + worstHT.ht + ' at ' + worstHT.wr + '% (' + worstHT.played + ' played).', [
      { v: bestHT.ht + ': ' + bestHT.wr + '%', hi: true },
      { v: worstHT.ht + ': ' + worstHT.wr + '%' },
    ]));
  }
  if (!cIns.length) {
    cIns.push(ins('n', 'Cards', 'More hands needed for card-type breakdowns.', [{
      v: 'Keep playing',
    }]));
  }
  cardsHtml += '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:9px;margin-top:20px;">' + cIns.join('') + '</div>';
  cardsHtml += '</div>';
  container.innerHTML = cardsHtml;
}
