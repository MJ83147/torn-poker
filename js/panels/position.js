// ── POSITION PANEL ────────────────────────────────────────────────────────────

var _positionChart = null;

function renderPosition(container, d, hands) {
  if (_positionChart) { _positionChart.destroy(); _positionChart = null; }

  var posOrder = ['UTG', 'UTG+1', 'MP', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
  var activePosOrder = posOrder.filter(function(p) { return d.posMap[p] && d.posMap[p].hands > 0; });

  var posHtml = '<div class="panel-title">Position</div>';
  posHtml += '<div class="panel-desc">How you perform from each seat at the table.</div>';
  posHtml += '<div class="p-row"><div class="overflow-x"><table class="tbl"><thead><tr><th>Position</th><th>Hands</th><th>' + tipWrap('VPIP') + '</th><th>' + tipWrap('Fold Pre') + '</th><th>' + tipWrap('Win Rate') + '</th><th>' + tipWrap('Net P&L') + '</th><th>' + tipWrap('Avg Pot') + '</th></tr></thead><tbody>';
  posHtml += activePosOrder.map(function(p) {
    var s = d.posMap[p];
    var vp2 = pct(s.vpip, s.hands);
    var fp2 = pct(s.foldPre, s.hands);
    var wr2 = pct(s.won, s.hands);
    var avgPot = Math.round(s.pot / s.hands);
    var avgPotDisplay = _displayBB && s.potBBCount > 0
      ? (s.potBB / s.potBBCount).toFixed(1) + ' BB'
      : fmt(avgPot);
    return '<tr><td>' + tipWrap(p) + '</td><td>' + s.hands + '</td><td>' + (vp2 !== null ? vp2 + '%' : '—') + '</td><td>' + (fp2 !== null ? fp2 + '%' : '—') + '</td><td>' + (wr2 !== null ? wr2 + '%' : '—') + '</td><td style="color:' + pnlColor(s.pnl) + '">' + fmtPnl(s.pnl) + '</td><td>' + avgPotDisplay + '</td></tr>';
  }).join('');
  posHtml += '</tbody></table></div></div>';

  // Chart: Win Rate & VPIP by Position
  if (activePosOrder.length >= 2) {
    posHtml += '<div class="p-row"><div class="sec-subtitle mt-0">Win Rate & VPIP by Position</div>';
    posHtml += '<div class="chart-wrap-full"><canvas id="position-chart"></canvas></div></div>';
  }

  var pIns = [];
  var earlyH = ['UTG', 'UTG+1', 'MP'];
  var lateH = ['CO', 'BTN'];
  var earlyGroup = calcPositionGroupVpip(d.posMap, earlyH);
  var evp = earlyGroup.vpip, ev = earlyGroup.vpipCount, eh = earlyGroup.hands;
  var lateGroup = calcPositionGroupVpip(d.posMap, lateH);
  var lvp = lateGroup.vpip, lv = lateGroup.vpipCount, lh = lateGroup.hands;

  if (evp !== null && evp > 55) {
    var exEarlyWide = findExampleHand(function(h) {
      return earlyH.indexOf(h.position) >= 0 && parseActions(h.actions).some(function(a) { return a.isMe && (a.type === 'call' || a.type === 'raise') && a.street === 'Preflop'; }) && h.outcome && h.outcome.result !== 'won';
    });
    pIns.push(insWithExample('r', 'Early Position VPIP', 'Playing ' + evp + '% from UTG/MP. Act first on every street — keep it to top 15–20% of hands here.', [{
      v: ev + '/' + eh + ' hands played',
    }], exEarlyWide, 'This hand was played from early position and lost. From UTG/MP you act first on every street — only play premium hands here.'));
  } else if (evp !== null) {
    pIns.push(ins('g', 'Early Position VPIP', evp + '% from early position. Good discipline where you have the worst information.', [{
      v: ev + '/' + eh + ' hands',
    }]));
  }
  if (lvp !== null && lvp < 40) {
    var exLateTight = findExampleHand(function(h) {
      return lateH.indexOf(h.position) >= 0 && parseActions(h.actions).some(function(a) { return a.isMe && a.type === 'fold' && a.street === 'Preflop'; });
    });
    pIns.push(insWithExample('a', 'Late Position VPIP', 'Only ' + lvp + '% from CO/BTN — you\'re leaving value behind. Attack the blinds, widen your range here.', [{
      v: lv + '/' + lh + ' hands',
    }], exLateTight, 'This hand was folded from late position. From CO/BTN you have positional advantage — widen your range to attack the blinds.'));
  } else if (lvp !== null) {
    pIns.push(ins('g', 'Late Position VPIP', lvp + '% from late position. Good use of positional advantage.', [{
      v: lv + '/' + lh + ' hands',
    }]));
  }

  // BTN VPIP
  var btnP = d.posMap['BTN'];
  if (btnP && btnP.hands >= 3 && pct(btnP.vpip, btnP.hands) < 40) {
    var exBtnFold = findExampleHand(function(h) {
      return h.position === 'BTN' && parseActions(h.actions).some(function(a) { return a.isMe && a.type === 'fold' && a.street === 'Preflop'; });
    });
    pIns.push(insWithExample('a', 'Button Range', 'From the button — best position — you only play ' + pct(btnP.vpip, btnP.hands) + '% of hands. Widen to 40–55% here.', [{
      v: 'BTN VPIP: ' + pct(btnP.vpip, btnP.hands) + '%',
    }], exBtnFold, 'This hand was folded from the button. You have the best position at the table here — widen your range to exploit positional advantage.'));
  }

  // Position Win Rate Spread
  var posWinRates = posOrder.filter(function(p) { return d.posMap[p] && d.posMap[p].hands >= 3; }).map(function(p) {
    return { pos: p, wr: pct(d.posMap[p].won, d.posMap[p].hands), hands: d.posMap[p].hands, pnl: d.posMap[p].pnl };
  }).sort(function(a, b) { return (b.wr || 0) - (a.wr || 0); });
  if (posWinRates.length >= 2) {
    var bestPos = posWinRates[0];
    var worstPos = posWinRates[posWinRates.length - 1];
    if (bestPos.wr !== null && worstPos.wr !== null && bestPos.wr - worstPos.wr > 15) {
      pIns.push(ins('o', 'Win Rate Spread', 'Your best position is ' + bestPos.pos + ' (' + bestPos.wr + '% win) and worst is ' + worstPos.pos + ' (' + worstPos.wr + '% win). A ' + (bestPos.wr - worstPos.wr) + ' point gap suggests position-specific leaks.', [
        { v: bestPos.pos + ': ' + bestPos.wr + '%', hi: true },
        { v: worstPos.pos + ': ' + worstPos.wr + '%' },
      ]));
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
      pIns.push(ins('o', 'Position P&L', 'Most profitable: ' + mostProfit.pos + ' (' + fmtPnl(mostProfit.pnl) + ' over ' + mostProfit.hands + ' hands). Biggest loss: ' + mostLoss.pos + ' (' + fmtPnl(mostLoss.pnl) + ' over ' + mostLoss.hands + ' hands).', [
        { v: mostProfit.pos + ': ' + fmtPnl(mostProfit.pnl), hi: true },
        { v: mostLoss.pos + ': ' + fmtPnl(mostLoss.pnl) },
      ]));
    }
  }
  // Append engine insights (patterns + multi-factor) to legacy insights
  var enginePosIns = InsightEngine.forPanel('position', 4);
  for (var epi = 0; epi < enginePosIns.length; epi++) {
    // Avoid duplicates: skip if engine label matches an existing legacy insight label
    var dupFound = false;
    for (var pi2 = 0; pi2 < pIns.length; pi2++) {
      if (pIns[pi2].indexOf(enginePosIns[epi].label) !== -1) { dupFound = true; break; }
    }
    if (!dupFound) pIns.push(renderRuleInsight(enginePosIns[epi]));
  }
  posHtml += '<div class="p-row">' + renderInsights(pIns, 'Position', 'More hands needed for positional patterns.') + '</div>';
  container.innerHTML = posHtml;

  // ── Render Chart.js chart ──
  var canvas = document.getElementById('position-chart');
  if (!canvas || activePosOrder.length < 2) return;

  var colors = getChartColors();

  var wrData = activePosOrder.map(function(p) { return pct(d.posMap[p].won, d.posMap[p].hands) || 0; });
  var vpipData = activePosOrder.map(function(p) { return pct(d.posMap[p].vpip, d.posMap[p].hands) || 0; });
  var handCounts = activePosOrder.map(function(p) { return d.posMap[p].hands; });

  _positionChart = createChart(canvas, 'bar', {
    labels: activePosOrder,
    datasets: [
      {
        label: 'Win Rate',
        data: wrData,
        backgroundColor: colors.green + '99',
        borderColor: colors.green,
        borderWidth: 1,
        borderRadius: 4,
      },
      {
        label: 'VPIP',
        data: vpipData,
        backgroundColor: colors.gold + '99',
        borderColor: colors.gold,
        borderWidth: 1,
        borderRadius: 4,
      },
    ],
  }, {
    legend: chartLegend(colors),
    tooltip: chartTooltip(colors, {
      label: function(ctx) {
        return ' ' + ctx.dataset.label + ': ' + ctx.parsed.y + '% (' + handCounts[ctx.dataIndex] + ' hands)';
      },
    }),
    scales: {
      x: chartXScale(colors),
      y: chartYScale(colors, { tickCallback: function(val) { return val + '%'; } }),
    },
  });
}
