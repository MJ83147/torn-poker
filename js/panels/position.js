// ── POSITION PANEL ────────────────────────────────────────────────────────────

var _positionChart = null;

function renderPosition(container, d, hands) {
  if (_positionChart) { _positionChart.destroy(); _positionChart = null; }

  var posOrder = ['UTG', 'UTG+1', 'MP', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
  var activePosOrder = posOrder.filter(function(p) { return d.posMap[p] && d.posMap[p].hands > 0; });

  var ctx = getGameContext(d);

  var posHtml = '<div class="panel-title">Position</div>';
  posHtml += '<div class="panel-desc">Which seats make and lose you money.</div>';
  posHtml += '<div class="p-row"><div class="overflow-x"><table class="tbl"><thead><tr><th>Position</th><th>Hands</th><th>' + tipWrap('Fold Pre') + '</th><th>VPIP &Delta; vs target</th><th>' + tipWrap('Net P&L') + '</th><th>' + tipWrap('Avg Pot') + '</th></tr></thead><tbody>';
  posHtml += activePosOrder.map(function(p) {
    var s = d.posMap[p];
    var fp2 = pct(s.foldPre, s.hands);
    var vp2 = pct(s.vpip, s.hands);
    var avgPot = Math.round(s.pot / s.hands);
    var avgPotDisplay = _displayBB && s.potBBCount > 0
      ? (s.potBB / s.potBBCount).toFixed(1) + ' BB'
      : fmt(avgPot);
    // Δ vs target VPIP: positive means looser than target band, negative means tighter.
    var band = ctx.band('vpip', p);
    var deltaCell = '-';
    if (band && vp2 !== null) {
      var lo = Math.round(band.tight);
      var hi = Math.round(band.loose);
      var delta = vp2 < lo ? vp2 - lo : (vp2 > hi ? vp2 - hi : 0);
      var deltaStr = delta === 0
        ? '<span style="color:var(--green)">on target</span>'
        : (delta > 0
          ? '<span style="color:var(--amber)">+' + delta + '%</span>'
          : '<span style="color:var(--amber)">' + delta + '%</span>');
      deltaCell = deltaStr + ' <span class="dim-label">(' + lo + '-' + hi + '%)</span>';
    }
    return '<tr><td>' + tipWrap(p) + '</td><td>' + s.hands + '</td><td>' + (fp2 !== null ? fp2 + '%' : '-') + '</td><td>' + deltaCell + '</td><td style="color:' + pnlColor(s.pnl) + '">' + fmtPnl(s.pnl) + '</td><td>' + avgPotDisplay + '</td></tr>';
  }).join('');
  posHtml += '</tbody></table></div></div>';

  // Chart: Net P&L by Position - this panel's job is "which seats make money"
  if (activePosOrder.length >= 2) {
    posHtml += '<div class="p-row"><div class="sec-subtitle mt-0">Net P&L by Position</div>';
    posHtml += '<div class="chart-wrap-full"><canvas id="position-chart"></canvas></div></div>';
  }

  var pIns = [];
  var earlyH = ['UTG', 'UTG+1', 'MP'];
  var lateH = ['CO', 'BTN'];
  var earlyGroup = calcPositionGroupVpip(d.posMap, earlyH);
  var evp = earlyGroup.vpip, ev = earlyGroup.vpipCount, eh = earlyGroup.hands;
  var lateGroup = calcPositionGroupVpip(d.posMap, lateH);
  var lvp = lateGroup.vpip, lv = lateGroup.vpipCount, lh = lateGroup.hands;

  // Pull matrix bands per zone using the shared game context.
  var _domSeats = ctx.seats;
  var _epBand = ctx.band('vpip', ctx.domPos(earlyH));
  var _lpBand = ctx.band('vpip', ctx.domPos(lateH));
  var _btnBand = ctx.band('vpip', 'BTN');

  // Skip the EP rule entirely for HU/3-handed - those tables don't have EP.
  var hasEarly = !_domSeats || _domSeats > 3;

  if (hasEarly && evp !== null && _epBand && evp > _epBand.loose + 5) {
    var exEarlyWide = findExampleHand(function(h) {
      return earlyH.indexOf(h.position) >= 0 && parseActions(h.actions).some(function(a) { return a.isMe && (a.type === 'call' || a.type === 'raise') && a.street === 'Preflop'; }) && h.outcome && h.outcome.result !== 'won';
    });
    pIns.push(insWithExample('r', 'Early Position VPIP',
      'You play ' + evp + '% from UTG/MP at ' + _domSeats + '-max. Target band is ' + Math.round(_epBand.tight) + '-' + Math.round(_epBand.loose) + '%.',
      [{ v: ev + '/' + eh + ' hands played' }],
      exEarlyWide,
      'This hand was played from early position and lost. From UTG/MP you act first on every street - only play premium hands here.',
      'From UTG/MP you act first on every street with no information. Tighten up to premium pairs, broadway, and AKs/AQs only.'));
  } else if (hasEarly && evp !== null) {
    pIns.push(ins('g', 'Early Position VPIP',
      evp + '% from early position.',
      [{ v: ev + '/' + eh + ' hands' }],
      'Good discipline. Early position has the worst information so a tight range here is correct.'));
  }
  if (lvp !== null && _lpBand && lvp < _lpBand.tight - 2) {
    var exLateTight = findExampleHand(function(h) {
      return lateH.indexOf(h.position) >= 0 && parseActions(h.actions).some(function(a) { return a.isMe && a.type === 'fold' && a.street === 'Preflop'; });
    });
    pIns.push(insWithExample('a', 'Late Position VPIP',
      'You play ' + lvp + '% from CO/BTN. Target band is ' + Math.round(_lpBand.tight) + '-' + Math.round(_lpBand.loose) + '%.',
      [{ v: lv + '/' + lh + ' hands' }],
      exLateTight,
      'This hand was folded from late position. From CO/BTN you have positional advantage - widen your range to attack the blinds.',
      'CO and BTN are your highest-EV seats. Open wider here to attack the blinds and play more pots in position.'));
  } else if (lvp !== null) {
    pIns.push(ins('g', 'Late Position VPIP',
      lvp + '% from late position.',
      [{ v: lv + '/' + lh + ' hands' }],
      'Good use of positional advantage. Late position lets you see how others act before you commit chips.'));
  }

  // BTN VPIP - sample-aware threshold, matrix-aware floor.
  var btnP = d.posMap['BTN'];
  var minBtnHands = Math.max(5, Math.round(5 * Math.max(1, Math.sqrt(40 / Math.max(1, d.n)))));
  if (btnP && btnP.hands >= minBtnHands && _btnBand) {
    var btnVp = pct(btnP.vpip, btnP.hands);
    if (btnVp !== null && btnVp < _btnBand.tight - 2) {
      var exBtnFold = findExampleHand(function(h) {
        return h.position === 'BTN' && parseActions(h.actions).some(function(a) { return a.isMe && a.type === 'fold' && a.street === 'Preflop'; });
      });
      pIns.push(insWithExample('a', 'Button Range',
        'You play ' + btnVp + '% from the button. Target band is ' + Math.round(_btnBand.tight) + '-' + Math.round(_btnBand.loose) + '%.',
        [{ v: 'BTN VPIP: ' + btnVp + '%' }],
        exBtnFold,
        'This hand was folded from the button. You have the best position at the table here - widen your range to exploit positional advantage.',
        'The button is the best seat at the table. Open the widest range here - any pair, any suited ace or king, any broadway, all suited connectors and most one-gappers.'));
    }
  }

  // Position Win Rate Spread
  var posWinRates = posOrder.filter(function(p) { return d.posMap[p] && d.posMap[p].hands >= 3; }).map(function(p) {
    return { pos: p, wr: pct(d.posMap[p].won, d.posMap[p].hands), hands: d.posMap[p].hands, pnl: d.posMap[p].pnl };
  }).sort(function(a, b) { return (b.wr || 0) - (a.wr || 0); });
  if (posWinRates.length >= 2) {
    var bestPos = posWinRates[0];
    var worstPos = posWinRates[posWinRates.length - 1];
    if (bestPos.wr !== null && worstPos.wr !== null && bestPos.wr - worstPos.wr > 15) {
      pIns.push(ins('o', 'Win Rate Spread',
        'Your best position is ' + bestPos.pos + ' (' + bestPos.wr + '% win) and worst is ' + worstPos.pos + ' (' + worstPos.wr + '% win). A ' + (bestPos.wr - worstPos.wr) + ' point gap.',
        [
          { v: bestPos.pos + ': ' + bestPos.wr + '%', hi: true },
          { v: worstPos.pos + ': ' + worstPos.wr + '%' },
        ],
        'A spread this wide usually means a leak in the worse seat - too loose, too passive, or too fold-heavy. Drill into your hand log filtered to ' + worstPos.pos + ' to see the pattern.'));
    }
  }

  // Position P&L
  var posPnlSorted = posOrder.filter(function(p) { return d.posMap[p] && d.posMap[p].hands >= 3; }).map(function(p) {
    return { pos: p, pnl: d.posMap[p].pnl, hands: d.posMap[p].hands };
  }).sort(function(a, b) { return b.pnl - a.pnl; });
  if (posPnlSorted.length >= 2) {
    var mostProfit = posPnlSorted[0];
    var mostLoss = posPnlSorted[posPnlSorted.length - 1];
    if (mostProfit.pnl > 0 && mostLoss.pnl < 0) {
      pIns.push(ins('o', 'Position P&L',
        'Most profitable: ' + mostProfit.pos + ' (' + fmtPnl(mostProfit.pnl) + ' over ' + mostProfit.hands + ' hands). Biggest loss: ' + mostLoss.pos + ' (' + fmtPnl(mostLoss.pnl) + ' over ' + mostLoss.hands + ' hands).',
        [
          { v: mostProfit.pos + ': ' + fmtPnl(mostProfit.pnl), hi: true },
          { v: mostLoss.pos + ': ' + fmtPnl(mostLoss.pnl) },
        ],
        'Play more pots from ' + mostProfit.pos + ' and tighten up from ' + mostLoss.pos + '. Position drives win rate more than starting hand selection at most stakes.'));
    }
  }
  // Append engine insights (patterns + multi-factor) to legacy insights
  appendEngineInsights('position', pIns, { limit: 4 });
  posHtml += '<div class="p-row">' + renderInsights(pIns, 'Position', 'More hands needed for positional patterns.') + '</div>';
  container.innerHTML = posHtml;

  // ── Render Chart.js chart: Net P&L by position ──
  var canvas = document.getElementById('position-chart');
  if (!canvas || activePosOrder.length < 2) return;

  var colors = getChartColors();

  var pnlData = activePosOrder.map(function(p) { return d.posMap[p].pnl; });
  var handCounts = activePosOrder.map(function(p) { return d.posMap[p].hands; });
  var bgColors = pnlData.map(function(v) { return (v >= 0 ? colors.green : colors.red) + '99'; });
  var borderColors = pnlData.map(function(v) { return v >= 0 ? colors.green : colors.red; });

  _positionChart = createChart(canvas, 'bar', {
    labels: activePosOrder,
    datasets: [
      {
        label: 'Net P&L',
        data: pnlData,
        backgroundColor: bgColors,
        borderColor: borderColors,
        borderWidth: 1,
        borderRadius: 4,
      },
    ],
  }, {
    legend: chartLegend(colors, false),
    tooltip: chartTooltip(colors, {
      label: function(c) {
        return ' Net P&L: ' + fmtPnl(c.parsed.y) + ' (' + handCounts[c.dataIndex] + ' hands)';
      },
    }),
    scales: {
      x: chartXScale(colors),
      y: chartYScale(colors, { tickCallback: function(val) { return fmtPnl(val); } }),
    },
  });
}
