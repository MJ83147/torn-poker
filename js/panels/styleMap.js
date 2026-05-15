// ── STYLE MAP PANEL ──────────────────────────────────────────────────────────
// VPIP x AF scatter plotting:
//   - Aggregate point for the player (large dot)
//   - Per-position points sized by hand count
//   - Per-player-count points sized by hand count
//   - TAG reference point (gray)
//   - Target style point (gold, e.g. LAG/Nit/Maniac/etc)
//   - Vector from aggregate to target
//
// Title block describes the gap between detected style and target style.

// Reference (VPIP, AF) anchors per style for the scatter overlay.
var _STYLE_ANCHORS = {
  Shark:   { vpip: 20, af: 40 },
  TAG:     { vpip: 22, af: 30 },
  Rock:    { vpip: 20, af: 18 },
  LAG:     { vpip: 32, af: 40 },
  Cannon:  { vpip: 32, af: 25 },
  Nit:     { vpip: 12, af: 30 },
  Station: { vpip: 38, af: 15 },
  Maniac:  { vpip: 50, af: 55 }
};

function _styleAnchor(name) {
  return _STYLE_ANCHORS[name] || _STYLE_ANCHORS.TAG;
}

// Read VPIP/AF for a sub-bucket (per-position or per-seat) of analyse() output.
function _smReadBucket(bucket) {
  if (!bucket || !bucket.n) return null;
  var vpip = (typeof pct === 'function') ? pct(bucket.vpip, bucket.n) : null;
  var af = (typeof calcAggression === 'function') ? calcAggression(bucket.raises, bucket.calls, bucket.checks) : null;
  if (vpip == null || af == null) return null;
  return { vpip: vpip, af: af, n: bucket.n };
}

function _smGapPhrase(detected, target) {
  if (!detected || !target) return '';
  var dV = detected.vpip || 0, dA = detected.af || 0;
  var tA = _styleAnchor(target);
  var dvGap = Math.abs(dV - tA.vpip);
  var daGap = Math.abs(dA - tA.af);
  if (dvGap < 4 && daGap < 6) return 'Your numbers already sit close to the target.';
  if (daGap > dvGap * 1.4) return 'The biggest gap is aggression.';
  if (dvGap > daGap * 1.4) return 'The biggest gap is hand selection.';
  return 'Both VPIP and aggression need work to hit the target.';
}

function renderStyleMap(container, d, hands) {
  if (!container) return;

  var detected = (typeof detectCurrentStyle === 'function') ? detectCurrentStyle(d) : null;
  var targetStyleName = (typeof getTargetStyle === 'function') ? getTargetStyle() : 'TAG';
  var targetAnchor = _styleAnchor(targetStyleName);
  var tagAnchor = _styleAnchor('TAG');

  // Title sentence pulled together from the detected style + target style.
  var titleSentence = '';
  if (detected) {
    titleSentence = 'You play like a ' + detected.name + '. Your target is ' + targetStyleName + '. ' + _smGapPhrase(detected, targetStyleName);
  } else {
    titleSentence = 'Your target style is ' + targetStyleName + '.';
  }

  // Title is provided by the host (My Game). Just the descriptive sentence
  // plus the chart and legend below.
  var html = '';
  html += '<div class="desc-text mb-16">' + titleSentence + '</div>';

  html += '<div class="style-map-wrap">';
  html += '<div class="style-map-canvas-wrap"><canvas id="style-map-chart"></canvas></div>';

  // Legend / key
  html += '<div class="style-map-legend">';
  html += '<div class="sm-legend-item"><span class="sm-dot sm-dot-you"></span><span>You (overall)</span></div>';
  html += '<div class="sm-legend-item"><span class="sm-dot sm-dot-pos"></span><span>By position</span></div>';
  html += '<div class="sm-legend-item"><span class="sm-dot sm-dot-seat"></span><span>By table size</span></div>';
  html += '<div class="sm-legend-item"><span class="sm-dot sm-dot-tag"></span><span>TAG reference</span></div>';
  html += '<div class="sm-legend-item"><span class="sm-dot sm-dot-target"></span><span>Target: ' + targetStyleName + '</span></div>';
  html += '</div>';
  html += '</div>';

  container.innerHTML = html;

  // ── chart ──────────────────────────────────────────────────────────────
  var canvas = document.getElementById('style-map-chart');
  if (!canvas || typeof Chart === 'undefined') return;

  var colors = (typeof getChartColors === 'function') ? getChartColors() : {
    dim: '#666', border: '#333', green: '#2ecc71', gold: '#f1c40f', red: '#e74c3c', amber: '#e67e22'
  };

  // Aggregate "you" point
  var youAgg = null;
  var aggVpip = (typeof pct === 'function') ? pct(d.vpip, d.n) : null;
  var aggAf = (typeof calcAggression === 'function') ? calcAggression(d.raises, d.calls, d.checks) : null;
  if (aggVpip != null && aggAf != null) youAgg = { vpip: aggVpip, af: aggAf, n: d.n };

  // Per-position
  var posPoints = [];
  if (d.byPosition) {
    for (var pos in d.byPosition) {
      var pd = d.byPosition[pos];
      if (pd && pd.gated) continue;
      var rd = _smReadBucket(pd);
      if (!rd) continue;
      posPoints.push({ x: rd.vpip, y: rd.af, n: rd.n, label: pos });
    }
  }

  // Per-player-count
  var seatPoints = [];
  if (d.bySeatBucket) {
    for (var sb in d.bySeatBucket) {
      var sd = d.bySeatBucket[sb];
      if (sd && sd.gated) continue;
      var srd = _smReadBucket(sd);
      if (!srd) continue;
      var seatLabel = String(sb).replace(/p$/, '') + '-handed';
      seatPoints.push({ x: srd.vpip, y: srd.af, n: srd.n, label: seatLabel });
    }
  }

  // Scale dot size by hand count (sqrt scale, clamped).
  function _radiusForN(n, base, max) {
    base = base || 4;
    max = max || 14;
    var r = base + Math.sqrt(Math.max(1, n)) / 4;
    return Math.min(max, r);
  }

  var datasets = [];

  // Vector arrow from aggregate to target (drawn as a line dataset).
  if (youAgg) {
    datasets.push({
      type: 'line',
      label: 'Gap to target',
      data: [
        { x: youAgg.vpip, y: youAgg.af },
        { x: targetAnchor.vpip, y: targetAnchor.af }
      ],
      borderColor: colors.gold,
      borderWidth: 2,
      borderDash: [4, 4],
      pointRadius: 0,
      pointHoverRadius: 0,
      fill: false,
      showLine: true,
      tension: 0
    });
  }

  // Per-position dots
  if (posPoints.length) {
    datasets.push({
      type: 'scatter',
      label: 'By position',
      data: posPoints.map(function(p) { return { x: p.x, y: p.y, _label: p.label, _n: p.n }; }),
      backgroundColor: 'rgba(160, 200, 240, 0.55)',
      borderColor: 'rgba(160, 200, 240, 0.9)',
      pointRadius: posPoints.map(function(p) { return _radiusForN(p.n, 4, 11); }),
      pointHoverRadius: posPoints.map(function(p) { return _radiusForN(p.n, 4, 11) + 2; })
    });
  }

  // Per-player-count dots
  if (seatPoints.length) {
    datasets.push({
      type: 'scatter',
      label: 'By table size',
      data: seatPoints.map(function(p) { return { x: p.x, y: p.y, _label: p.label, _n: p.n }; }),
      backgroundColor: 'rgba(200, 160, 220, 0.55)',
      borderColor: 'rgba(200, 160, 220, 0.9)',
      pointRadius: seatPoints.map(function(p) { return _radiusForN(p.n, 4, 11); }),
      pointHoverRadius: seatPoints.map(function(p) { return _radiusForN(p.n, 4, 11) + 2; })
    });
  }

  // TAG reference (gray)
  datasets.push({
    type: 'scatter',
    label: 'TAG',
    data: [{ x: tagAnchor.vpip, y: tagAnchor.af, _label: 'TAG' }],
    backgroundColor: 'rgba(160, 160, 160, 0.7)',
    borderColor: 'rgba(200, 200, 200, 0.9)',
    pointRadius: 9,
    pointStyle: 'rectRot'
  });

  // Target style (gold)
  datasets.push({
    type: 'scatter',
    label: 'Target: ' + targetStyleName,
    data: [{ x: targetAnchor.vpip, y: targetAnchor.af, _label: targetStyleName }],
    backgroundColor: colors.gold,
    borderColor: colors.gold,
    pointRadius: 11,
    pointStyle: 'star'
  });

  // Aggregate "you" point - drawn last so it sits on top
  if (youAgg) {
    datasets.push({
      type: 'scatter',
      label: 'You',
      data: [{ x: youAgg.vpip, y: youAgg.af, _label: 'You', _n: youAgg.n }],
      backgroundColor: colors.green,
      borderColor: '#fff',
      borderWidth: 2,
      pointRadius: 12,
      pointHoverRadius: 14
    });
  }

  new Chart(canvas, {
    type: 'scatter',
    data: { datasets: datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: chartTooltip(colors, {
          label: function(ctx) {
            var raw = ctx.raw || {};
            var lab = raw._label || ctx.dataset.label || '';
            var x = ctx.parsed && ctx.parsed.x != null ? Math.round(ctx.parsed.x * 10) / 10 : '?';
            var y = ctx.parsed && ctx.parsed.y != null ? Math.round(ctx.parsed.y * 10) / 10 : '?';
            var s = lab + ': VPIP ' + x + '%, AF ' + y + '%';
            if (raw._n) s += ' (' + raw._n + ' hands)';
            return s;
          }
        })
      },
      scales: {
        x: {
          type: 'linear',
          min: 0,
          max: 70,
          title: { display: true, text: 'VPIP %', color: colors.dim, font: { family: 'IBM Plex Mono', size: 11 } },
          ticks: { color: colors.dim, font: { family: 'IBM Plex Mono', size: 10 } },
          grid: { color: colors.border }
        },
        y: {
          type: 'linear',
          min: 0,
          max: 70,
          title: { display: true, text: 'Aggression %', color: colors.dim, font: { family: 'IBM Plex Mono', size: 11 } },
          ticks: { color: colors.dim, font: { family: 'IBM Plex Mono', size: 10 } },
          grid: { color: colors.border }
        }
      }
    }
  });
}
