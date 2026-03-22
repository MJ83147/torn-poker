// ── TRENDS PANEL ──────────────────────────────────────────────────────────────

function renderTrends(container, hands, meta) {
  var sorted = hands.slice().sort(function(a, b) { return (a.timestamp || 0) - (b.timestamp || 0); });
  if (sorted.length < 5) {
    container.innerHTML = ins('n', 'Trends', 'Need at least 5 hands to show trends. Keep playing and tracking.', []);
    return;
  }
  var sessions = [];
  var dayMap = {};
  for (var i = 0; i < sorted.length; i++) {
    var ts = sorted[i].timestamp || 0;
    var day = new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    if (!dayMap[day]) { dayMap[day] = []; sessions.push(day); }
    dayMap[day].push(sorted[i]);
  }
  var points = [];
  var cumWon = 0, cumOutcome = 0, cumVpip = 0, cumN = 0, cumRaise = 0, cumActs = 0, cumCashWon = 0, cumCashInvested = 0;
  for (var si = 0; si < sessions.length; si++) {
    var dayHands = dayMap[sessions[si]];
    var dStats = analyse(dayHands);
    cumWon += dStats.handsWon;
    cumOutcome += dStats.handsWithOutcome;
    cumVpip += dStats.vpip;
    cumN += dStats.n;
    cumRaise += dStats.raises;
    cumActs += dStats.totalActs;
    cumCashWon += dStats.totalWonAmount;
    cumCashInvested += dStats.totalInvested;
    points.push({
      label: sessions[si],
      hands: dayHands.length,
      cumHands: cumN,
      wr: cumOutcome > 0 ? Math.round(cumWon / cumOutcome * 100) : null,
      vpip: cumN > 0 ? Math.round(cumVpip / cumN * 100) : null,
      agg: cumActs > 0 ? Math.round(cumRaise / cumActs * 100) : null,
      sessionWr: dStats.handsWithOutcome > 0 ? Math.round(dStats.handsWon / dStats.handsWithOutcome * 100) : null,
      netPnl: cumCashWon - cumCashInvested,
    });
  }

  function svgChart(title, dataKey, color, suffix, baselineVal) {
    var vals = points.map(function(p) { return p[dataKey]; }).filter(function(v) { return v !== null; });
    if (vals.length < 2) return '';
    var minV = Math.min.apply(null, vals);
    var maxV = Math.max.apply(null, vals);
    var range = maxV - minV || 1;
    var w = 600, h = 140, pad = 36, padR = 12;
    var chartW = w - pad - padR;
    var chartH = h - 30;
    var step = chartW / (points.length - 1 || 1);
    var pathParts = [], dotParts = [];
    for (var pi = 0; pi < points.length; pi++) {
      var v = points[pi][dataKey];
      if (v === null) continue;
      var x = pad + pi * step;
      var y = 10 + chartH - ((v - minV) / range) * chartH;
      pathParts.push((pathParts.length === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1));
      dotParts.push('<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="3" fill="' + color + '"/>');
    }
    var baseline = '';
    if (baselineVal !== undefined && baselineVal >= minV && baselineVal <= maxV) {
      var by = 10 + chartH - ((baselineVal - minV) / range) * chartH;
      baseline = '<line x1="' + pad + '" y1="' + by.toFixed(1) + '" x2="' + (w - padR) + '" y2="' + by.toFixed(1) + '" stroke="var(--dim)" stroke-width="0.5" stroke-dasharray="4,4"/>';
    }
    var yMax = suffix ? maxV + suffix : fmt(maxV);
    var yMin = suffix ? minV + suffix : fmt(minV);
    var yLabels = '<text x="' + (pad - 4) + '" y="14" text-anchor="end" fill="var(--dim)" font-size="9">' + yMax + '</text>' +
      '<text x="' + (pad - 4) + '" y="' + (10 + chartH) + '" text-anchor="end" fill="var(--dim)" font-size="9">' + yMin + '</text>';
    var xLabels = '<text x="' + pad + '" y="' + (h - 2) + '" text-anchor="start" fill="var(--dim)" font-size="8">' + points[0].label + '</text>' +
      '<text x="' + (w - padR) + '" y="' + (h - 2) + '" text-anchor="end" fill="var(--dim)" font-size="8">' + points[points.length - 1].label + '</text>';
    return '<div><div class="sec-subtitle" style="margin-top:0;">' + title + '</div>' +
      '<svg viewBox="0 0 ' + w + ' ' + h + '" style="width:100%;max-width:' + w + 'px;height:auto;">' +
      baseline + yLabels + xLabels +
      '<path d="' + pathParts.join(' ') + '" fill="none" stroke="' + color + '" stroke-width="1.5"/>' +
      dotParts.join('') + '</svg></div>';
  }

  var tHtml = '<div class="trends-grid">';
  tHtml += svgChart('Cumulative Win Rate', 'wr', 'var(--green)', '%', 50);
  tHtml += svgChart('Cumulative VPIP', 'vpip', 'var(--gold)', '%');
  tHtml += svgChart('Cumulative Aggression', 'agg', 'var(--amber)', '%');
  tHtml += svgChart('Cumulative Net P&L (Cash Only)', 'netPnl', 'var(--green)', '', 0);
  tHtml += '</div>';
  tHtml += '<div class="sec-subtitle">Session Breakdown</div>';
  tHtml += '<div style="overflow-x:auto;"><table class="tbl"><thead><tr><th>Date</th><th>Hands</th><th>Session ' + tipWrap('Win Rate') + '</th><th>Cumulative ' + tipWrap('Win Rate') + '</th><th>' + tipWrap('VPIP') + '</th><th>' + tipWrap('Aggression') + '</th></tr></thead><tbody>';
  for (var pi = points.length - 1; pi >= 0; pi--) {
    var pt = points[pi];
    var wrCol2 = pt.sessionWr !== null && pt.sessionWr >= 50 ? 'var(--green)' : pt.sessionWr !== null ? 'var(--red)' : 'var(--dim)';
    tHtml += '<tr><td>' + pt.label + '</td><td>' + pt.hands + '</td>' +
      '<td style="color:' + wrCol2 + '">' + (pt.sessionWr !== null ? pt.sessionWr + '%' : '—') + '</td>' +
      '<td>' + (pt.wr !== null ? pt.wr + '%' : '—') + '</td>' +
      '<td>' + (pt.vpip !== null ? pt.vpip + '%' : '—') + '</td>' +
      '<td>' + (pt.agg !== null ? pt.agg + '%' : '—') + '</td></tr>';
  }
  tHtml += '</tbody></table></div>';

  var tIns = [];
  if (points.length >= 3) {
    var last = points[points.length - 1];
    var mid = points[Math.floor(points.length / 2)];
    if (last.wr !== null && mid.wr !== null) {
      var diff = last.wr - mid.wr;
      if (diff > 5) {
        var exRecentWin = findExampleHand(function(h) { return h.outcome && h.outcome.result === 'won' && (h.timestamp || 0) >= (sorted[Math.floor(sorted.length / 2)].timestamp || 0); });
        tIns.push(insWithExample('g', 'Win Rate Improving', 'Your cumulative win rate has climbed ' + diff + ' percentage points over the second half of your sessions.', [{ v: mid.wr + '% → ' + last.wr + '%', hi: true }], exRecentWin, 'A recent winning hand from your improving stretch. Whatever adjustments you have made are paying off — keep it up.'));
      } else if (diff < -5) {
        var exRecentLoss = findExampleHand(function(h) { return h.outcome && h.outcome.result !== 'won' && (h.timestamp || 0) >= (sorted[Math.floor(sorted.length / 2)].timestamp || 0); });
        tIns.push(insWithExample('a', 'Win Rate Declining', 'Your cumulative win rate has dropped ' + Math.abs(diff) + ' percentage points. Check for recent leaks or tilt.', [{ v: mid.wr + '% → ' + last.wr + '%', hi: true }], exRecentLoss, 'A recent losing hand during your downswing. Review whether you are tilting, calling too wide, or facing tougher competition.'));
      } else tIns.push(ins('n', 'Win Rate Stable', 'Consistent at around ' + last.wr + '% across sessions.', [{ v: last.wr + '%' }]));
    }
    if (last.vpip !== null && mid.vpip !== null) {
      var vdiff = last.vpip - mid.vpip;
      if (Math.abs(vdiff) > 8) {
        var exVpipShift = findExampleHand(function(h) {
          if (!h.timestamp || h.timestamp < (sorted[Math.floor(sorted.length / 2)].timestamp || 0)) return false;
          var ma = parseActions(h.actions).filter(function(a) { return a.isMe && a.street === 'Preflop'; });
          return vdiff > 0
            ? ma.some(function(a) { return a.type === 'call' || a.type === 'raise'; })
            : ma.some(function(a) { return a.type === 'fold'; });
        });
        tIns.push(insWithExample('a', 'VPIP Shift', 'Your VPIP has moved ' + (vdiff > 0 ? 'up' : 'down') + ' by ' + Math.abs(vdiff) + ' points. Check if your hand selection has changed intentionally.', [{ v: mid.vpip + '% → ' + last.vpip + '%', hi: true }], exVpipShift, vdiff > 0 ? 'A recent hand where you voluntarily entered the pot. Your VPIP has increased — make sure you are not playing too many marginal hands.' : 'A recent hand where you folded preflop. Your VPIP has dropped — make sure you are not being too tight and missing value.'));
      }
    }
  }
  if (!tIns.length) tIns.push(ins('n', 'Trends', 'Keep tracking to build up enough data points for trend insights.', []));
  tHtml += '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:9px;margin-top:24px;">' + tIns.join('') + '</div>';
  container.innerHTML = tHtml;
}
