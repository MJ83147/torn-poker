// ── SHOWDOWN PANEL (Blue Line / Red Line) ────────────────────────────────────

function renderShowdown(container, hands, meta) {
  var sorted = hands.slice().sort(function(a, b) { return (a.timestamp || 0) - (b.timestamp || 0); });

  // Filter to cash hands with outcomes
  var cash = [];
  for (var i = 0; i < sorted.length; i++) {
    if (isCashHand(sorted[i]) && sorted[i].outcome) cash.push(sorted[i]);
  }

  if (cash.length < 5) {
    container.innerHTML = ins('n', 'Showdown', 'Need at least 5 cash hands with outcomes to show showdown graph. Keep playing and tracking.', []);
    return;
  }

  // Build per-hand P&L split by showdown / non-showdown
  var cumSd = 0, cumNsd = 0;
  var sdWon = 0, sdTotal = 0, nsdWon = 0, nsdTotal = 0;
  var points = [];

  for (var i = 0; i < cash.length; i++) {
    var h = cash[i];
    var invested = h.invested || calcInvestmentFromActions(h.actions || []);
    var delta = 0;
    var won = false;

    if (h.outcome.result === 'won') {
      delta = (h.outcome.amount || 0) - invested;
      won = true;
    } else {
      delta = -invested;
    }

    if (isShowdown(h)) {
      cumSd += delta;
      sdTotal++;
      if (won) sdWon++;
    } else {
      cumNsd += delta;
      nsdTotal++;
      if (won) nsdWon++;
    }

    points.push({
      cumSd: cumSd,
      cumNsd: cumNsd,
      cumTotal: cumSd + cumNsd,
    });
  }

  // Downsample if too many points
  var maxPts = 300;
  var sampled = points;
  if (points.length > maxPts) {
    sampled = [];
    var step = (points.length - 1) / (maxPts - 1);
    for (var i = 0; i < maxPts - 1; i++) {
      sampled.push(points[Math.round(i * step)]);
    }
    sampled.push(points[points.length - 1]); // always include last
  }

  // Find min/max across all three lines
  var allVals = [];
  for (var i = 0; i < sampled.length; i++) {
    allVals.push(sampled[i].cumSd, sampled[i].cumNsd, sampled[i].cumTotal);
  }
  var minV = Math.min.apply(null, allVals);
  var maxV = Math.max.apply(null, allVals);
  if (minV === maxV) { minV -= 1; maxV += 1; }
  var range = maxV - minV;

  // SVG dimensions
  var w = 700, h = 240, pad = 48, padR = 16, padTop = 14, padBot = 24;
  var chartW = w - pad - padR;
  var chartH = h - padTop - padBot;
  var stepX = chartW / (sampled.length - 1 || 1);

  function yPos(v) {
    return padTop + chartH - ((v - minV) / range) * chartH;
  }

  // Build paths
  var lines = [
    { key: 'cumTotal', color: 'var(--green)', label: 'Total P&L' },
    { key: 'cumSd',    color: '#4a9eff',      label: 'Showdown' },
    { key: 'cumNsd',   color: '#e74c3c',      label: 'Non-Showdown' },
  ];

  var pathsSvg = '';
  for (var li = 0; li < lines.length; li++) {
    var parts = [];
    for (var pi = 0; pi < sampled.length; pi++) {
      var x = pad + pi * stepX;
      var y = yPos(sampled[pi][lines[li].key]);
      parts.push((parts.length === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1));
    }
    pathsSvg += '<path d="' + parts.join(' ') + '" fill="none" stroke="' + lines[li].color + '" stroke-width="1.5" stroke-opacity="0.9"/>';
  }

  // $0 baseline
  var baselineSvg = '';
  if (0 >= minV && 0 <= maxV) {
    var by = yPos(0);
    baselineSvg = '<line x1="' + pad + '" y1="' + by.toFixed(1) + '" x2="' + (w - padR) + '" y2="' + by.toFixed(1) + '" stroke="var(--dim)" stroke-width="0.5" stroke-dasharray="4,4"/>';
  }

  // Y-axis labels
  var yLabels = '<text x="' + (pad - 4) + '" y="' + (padTop + 4) + '" text-anchor="end" fill="var(--dim)" font-size="9">' + fmt(maxV) + '</text>' +
    '<text x="' + (pad - 4) + '" y="' + (padTop + chartH) + '" text-anchor="end" fill="var(--dim)" font-size="9">' + fmt(minV) + '</text>';

  // X-axis labels
  var xLabels = '<text x="' + pad + '" y="' + (h - 2) + '" text-anchor="start" fill="var(--dim)" font-size="8">Hand 1</text>' +
    '<text x="' + (w - padR) + '" y="' + (h - 2) + '" text-anchor="end" fill="var(--dim)" font-size="8">Hand ' + cash.length + '</text>';

  // Legend
  var legendHtml = '<div style="display:flex;gap:18px;margin-bottom:8px;font-size:12px;">';
  for (var li = 0; li < lines.length; li++) {
    legendHtml += '<div style="display:flex;align-items:center;gap:5px;">' +
      '<span style="display:inline-block;width:12px;height:3px;background:' + lines[li].color + ';border-radius:1px;"></span>' +
      '<span style="color:var(--dim);">' + lines[li].label + '</span></div>';
  }
  legendHtml += '</div>';

  // Summary stats
  var sdWinRate = pct(sdWon, sdTotal);
  var nsdWinRate = pct(nsdWon, nsdTotal);

  var statsHtml = '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-top:20px;">';

  // Showdown stats
  statsHtml += '<div style="padding:14px;background:var(--card);border:1px solid var(--border);border-radius:8px;">';
  statsHtml += '<div style="font-size:11px;color:var(--dim);margin-bottom:6px;display:flex;align-items:center;gap:6px;">' +
    '<span style="display:inline-block;width:10px;height:3px;background:#4a9eff;border-radius:1px;"></span>Showdown</div>';
  statsHtml += '<div style="font-size:20px;font-weight:500;color:' + (cumSd >= 0 ? 'var(--green)' : 'var(--red)') + ';">' + (cumSd >= 0 ? '+' : '') + fmt(cumSd) + '</div>';
  statsHtml += '<div style="font-size:11px;color:var(--dim);margin-top:4px;">' + sdTotal + ' hands · ' + (sdWinRate !== null ? sdWinRate + '% win rate' : 'no data') + '</div>';
  statsHtml += '</div>';

  // Non-showdown stats
  statsHtml += '<div style="padding:14px;background:var(--card);border:1px solid var(--border);border-radius:8px;">';
  statsHtml += '<div style="font-size:11px;color:var(--dim);margin-bottom:6px;display:flex;align-items:center;gap:6px;">' +
    '<span style="display:inline-block;width:10px;height:3px;background:#e74c3c;border-radius:1px;"></span>Non-Showdown</div>';
  statsHtml += '<div style="font-size:20px;font-weight:500;color:' + (cumNsd >= 0 ? 'var(--green)' : 'var(--red)') + ';">' + (cumNsd >= 0 ? '+' : '') + fmt(cumNsd) + '</div>';
  statsHtml += '<div style="font-size:11px;color:var(--dim);margin-top:4px;">' + nsdTotal + ' hands · ' + (nsdWinRate !== null ? nsdWinRate + '% win rate' : 'no data') + '</div>';
  statsHtml += '</div>';

  statsHtml += '</div>';

  // Insights
  var insHtml = '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:9px;margin-top:20px;">';
  var hasInsight = false;

  if (sdTotal >= 10 && nsdTotal >= 10) {
    if (cumSd > 0 && cumNsd < 0 && Math.abs(cumNsd) > cumSd * 0.3) {
      insHtml += ins('a', 'Red Line Leak', 'You win at showdown but bleed chips in non-showdown pots. Opponents may be exploiting your folds — consider defending more or bluffing less.', [
        { v: 'SD: ' + (cumSd >= 0 ? '+' : '') + fmt(cumSd), hi: true },
        { v: 'NSD: ' + fmt(cumNsd), hi: true },
      ]);
      hasInsight = true;
    }
    if (cumNsd > 0) {
      insHtml += ins('g', 'Winning Without Showdown', 'Your non-showdown line is positive — you are taking down pots with aggression and well-timed bets.', [
        { v: 'NSD: +' + fmt(cumNsd), hi: true },
      ]);
      hasInsight = true;
    }
    if (cumSd < 0 && sdTotal >= 15) {
      insHtml += ins('r', 'Showdown Weakness', 'You are losing money at showdown. This may mean you are calling too wide or not value-betting enough with strong hands.', [
        { v: 'SD: ' + fmt(cumSd), hi: true },
        { v: sdWinRate + '% win rate', hi: false },
      ]);
      hasInsight = true;
    }
    if (cumSd > 0 && cumNsd >= 0) {
      insHtml += ins('g', 'Solid Across the Board', 'Both your showdown and non-showdown lines are positive. You are winning with strong hands and also taking down pots without needing to show.', [
        { v: 'SD: +' + fmt(cumSd) },
        { v: 'NSD: +' + fmt(cumNsd) },
      ]);
      hasInsight = true;
    }
  }

  if (!hasInsight) {
    insHtml += ins('n', 'Showdown Breakdown', 'Track more hands to unlock showdown vs non-showdown insights. Aim for 20+ hands in each category.', [
      { v: sdTotal + ' SD hands' },
      { v: nsdTotal + ' NSD hands' },
    ]);
  }

  insHtml += '</div>';

  // Assemble
  var html = '<div class="sec-subtitle" style="margin-top:0;">Showdown vs Non-Showdown P&L</div>';
  html += legendHtml;
  html += '<svg viewBox="0 0 ' + w + ' ' + h + '" style="width:100%;max-width:' + w + 'px;height:auto;">';
  html += baselineSvg + yLabels + xLabels + pathsSvg;
  html += '</svg>';
  html += statsHtml;
  html += insHtml;

  container.innerHTML = html;
}
