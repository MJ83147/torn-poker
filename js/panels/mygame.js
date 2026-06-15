function renderMyGame(container, d, hands) {
  var playerName = State.meta.player || detectPlayerFromActions(hands) || 'Unknown';
  var exportDate = State.meta.exportedAt
    ? new Date(State.meta.exportedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';

  var html = '';

  var vpipVal   = pct(d.vpip, d.n);
  var pfrVal    = pct(d.pfrHands, d.n);
  var limpVal   = pct(d.limpHands, d.n);
  var aggVal    = calcAggression(d.raises, d.calls, d.checks);
  var ftrVal    = pct(d.foldedToRaise, d.facedRaise);
  var cbetVal   = pct(d.cbetDone, d.cbetOpps);
  var wtsdVal   = pct(d.wentToShowdown, d.sawFlop);

  var smallSample = d.n < 30;

  // Classification thresholds track table size: a 50% VPIP at 6-max is loose, at HU it's tight.
  var ctx = getGameContext(d);
  var _domSeatsMG = ctx.seats;
  var _vpipBandMG = ctx.band('vpip');
  var _afBandMG = ctx.band('af');

  var typeLabel = '', typeDesc = '';
  if (!smallSample && typeof detectCurrentStyle === 'function') {
    var detected = detectCurrentStyle(d);
    typeLabel = detected.name;
    typeDesc = (typeof styleDescription === 'function') ? styleDescription(typeLabel) : '';
  }

  html += '<div class="profile-row">';
  html += '<div>';
  html += '<div class="label mb-12">MY GAME</div>';
  html += '<div class="profile-name">' + playerName + '</div>';
  html += '<div class="text-body profile-meta">';
  if (exportDate) html += exportDate + ' &middot; ';
  html += d.n + ' hands';
  html += '</div>';
  html += '</div>';
  if (typeLabel) {
    html += '<div class="profile-type-block">';
    html += '<div class="label mb-12">PLAYER TYPE</div>';
    html += '<div class="profile-type-name">' + typeLabel + '</div>';
    html += '<div class="text-body profile-type-desc">' + typeDesc + '</div>';
    html += '</div>';
  }
  html += '</div>';

  var _ftrBandMG = ctx.band('foldToRaise');
  var _cbetBandMG = ctx.band('cbet');
  if (smallSample) {
    html += '<div class="text-meta mt-8 mb-12">Stats from ' + d.n + ' hands. These become reliable around 100+ hands.</div>';
  }

  if (!smallSample) {

    var earlyGroup = calcPositionGroupVpip(d.posMap, EARLY_POSITIONS);
    var lateGroup = calcPositionGroupVpip(d.posMap, LATE_POSITIONS);
    var epVpip = earlyGroup.vpip, earlyHands = earlyGroup.hands;
    var lpVpip = lateGroup.vpip, lateHands = lateGroup.hands;

    var bestPos = null, bestPosPnl = -Infinity, bestPosWr = null;
    var posKeys = Object.keys(d.posMap);
    for (var pi = 0; pi < posKeys.length; pi++) {
      var pk = posKeys[pi];
      var pm = d.posMap[pk];
      if (pm.hands >= 20 && pm.pnl > bestPosPnl) {
        bestPosPnl = pm.pnl;
        bestPos = pk;
        bestPosWr = pct(pm.won, pm.hands);
      }
    }

    var f3b = pct(d.foldTo3betDone, d.foldTo3betOpps);
    var fcbet = pct(d.foldToCbetDone, d.foldToCbetOpps);

    var allLeaks = (typeof Sections !== 'undefined' && typeof Sections.evaluateSections === 'function')
      ? Sections.evaluateSections(d, {}, hands).filter(function(f) {
          return f.severity === 'r' || f.severity === 'a';
        })
      : [];

    html += '<div class="label sec-subtitle mt-20">Work On Next</div>';
    var workOn = null;
    var _workAggFloor = _afBandMG ? _afBandMG.tight - 3 : 15;
    var _workLimpCeil = _domSeatsMG && _domSeatsMG <= 2 ? 70 : _domSeatsMG && _domSeatsMG <= 3 ? 45 : 22;
    var _workFtrCeil = _ftrBandMG ? _ftrBandMG.loose + 15 : 70;
    var _workCbetFloor = _cbetBandMG ? _cbetBandMG.tight - 10 : 25;
    var _workWtsdCeil = _domSeatsMG && _domSeatsMG <= 2 ? 55 : 50;
    var _workEpCeil = (function() {
      if (!_domSeatsMG || _domSeatsMG <= 3) return null;
      var b = (typeof matrixTarget === 'function')
        ? matrixTarget('vpip', 'UTG', _domSeatsMG, getUserStyle()) : null;
      return b ? b.loose + 5 : 35;
    })();
    if (!workOn && aggVal !== null && aggVal < _workAggFloor) workOn = { sev: 'r', label: 'Too Passive', desc: 'Only ' + aggVal + '% aggression. Expected floor around ' + Math.round(_workAggFloor) + '%. You check and call when you should be betting for value.', action: 'Next 20 hands: when you have a strong hand, raise instead of calling. Track whether your aggression % moves above ' + Math.round(_workAggFloor + 5) + '%.' };
    if (!workOn && limpVal !== null && limpVal > _workLimpCeil) workOn = { sev: 'r', label: 'Limping Too Much', desc: 'You limp ' + limpVal + '% of hands at ' + (_domSeatsMG || '?') + '-max (ceiling around ' + _workLimpCeil + '%). Limping gives up initiative.', action: 'Next 20 hands: every time you want to limp, either raise or fold instead. No flat calls preflop without a raise in front.' };
    if (!workOn && ftrVal !== null && ftrVal > _workFtrCeil && d.facedRaise >= 5) workOn = { sev: 'r', label: 'Folding To Pressure', desc: 'You fold ' + ftrVal + '% when raised. Ceiling around ' + Math.round(_workFtrCeil) + '%.', action: 'Next session: when raised, pause and consider if your hand is strong enough to continue. Look for spots to call or re-raise instead of auto-folding.' };
    if (!workOn && cbetVal !== null && cbetVal < _workCbetFloor && d.cbetOpps >= 5) workOn = { sev: 'r', label: 'Low C-Bet', desc: 'You only c-bet ' + cbetVal + '%. Expected floor around ' + Math.round(_workCbetFloor) + '%.', action: 'Next session: when you raised preflop and the flop comes, bet at least half the time regardless of whether you connected. Maintaining aggression wins pots.' };
    if (!workOn && wtsdVal !== null && wtsdVal > _workWtsdCeil) workOn = { sev: 'r', label: 'Paying Off Too Much', desc: 'WTSD at ' + wtsdVal + '%. Ceiling around ' + _workWtsdCeil + '%.', action: 'Next session: on the river facing a big bet, ask whether your hand beats their value range. If not, fold. Saving one big call per session adds up.' };
    if (!workOn && _workEpCeil && epVpip !== null && epVpip > _workEpCeil && earlyHands >= 10) workOn = { sev: 'r', label: 'Too Loose Early', desc: 'EP VPIP at ' + epVpip + '%. Ceiling around ' + _workEpCeil + '%.', action: 'Next session: from UTG/MP, only play top 25% of hands. Fold marginal suited connectors and weak aces from these seats.' };
    if (!workOn && allLeaks.length) workOn = { sev: allLeaks[0].severity, label: allLeaks[0].name, desc: '', action: 'Focus on this pattern in your next session and track whether the stat improves.' };

    if (workOn) {
      html += '<div class="box work-on-block work-on-' + workOn.sev + '">';
      html += '<div class="work-on-title">' + workOn.label + '</div>';
      if (workOn.desc) html += '<div class="text-body work-on-desc">' + workOn.desc + '</div>';
      html += '<div class="text-body work-on-action">' + workOn.action + '</div>';
      html += '</div>';
    } else {
      html += '<div class="box work-on-block work-on-g">';
      html += '<div class="work-on-title">Solid game</div>';
      html += '<div class="text-body work-on-desc">No major leaks detected from ' + d.n + ' hands. Keep playing to refine the picture.</div>';
      html += '</div>';
    }

  }

  html += renderTableDynamicsReference(hands, d);

  mountTemplate(container, 'mygame');
  setSlot(container, 'body', html);

  var smHost = container.querySelector('#mygame-stylemap');
  if (smHost && typeof renderStyleMap === 'function') {
    renderStyleMap(smHost, d, hands);
  }
}

function _parsePctRange(s) {
  if (!s) return null;
  var m = s.match(/(\d+)\s*-\s*(\d+)/);
  if (!m) return null;
  return [parseInt(m[1], 10), parseInt(m[2], 10)];
}

function _vsRow(label, actualPct, actualDenom, targetText) {
  var rng = _parsePctRange(targetText);
  var actualStr = (actualPct == null) ? '-' : actualPct + '%';
  var sampleStr = actualDenom != null ? ' <span class="label">(' + actualDenom + ' spots)</span>' : '';
  var v = rng ? bandVerdict(actualPct, rng[0], rng[1]) : { cls: 'v-na', label: '' };
  var labelHtml = label ? '<div class="dynamics-vs-stat label">' + label + '</div>' : '';
  return '<div class="dynamics-vs ' + v.cls + '">' +
    labelHtml +
    '<div class="flex-between text-meta dynamics-vs-top"><span>You: <strong>' + actualStr + '</strong>' + sampleStr + '</span>' +
    '<span class="label">Target: ' + targetText + '</span></div>' +
    (v.label ? '<div class="label dynamics-vs-verdict">' + v.label + '</div>' : '') +
    '</div>';
}

// Targets must come from matrixTarget so the user's style offset (TAG/LAG/Nit/etc)
// is applied — reading SEAT_MATRIX / FLOP_MATRIX directly would skip the offset.
function renderTableDynamicsReference(hands, d) {
  var h = '<div class="label sec-subtitle mt-20">Table Dynamics: You vs Target</div>';
  h += '<div class="text-body mb-16">Your actual play at each table size and flop multiplicity, compared to the recommended benchmarks for your target style. <span class="v-ok">Green = on target</span>, <span class="v-low">amber = too low / too tight</span>, <span class="v-high">red = too high / too loose</span>.</div>';

  var styleKey = (typeof getUserStyle === 'function') ? getUserStyle() : 'TAG';
  var seatKeys = Object.keys(SEAT_MATRIX).map(Number).sort(function(a, b) { return a - b; });

  // SEAT_MATRIX.notes are written as deltas from the previous seat count
  // ("Adds UTG+1") so they read as nonsense in isolation. These stand alone.
  var seatCoaching = {
    2: 'Heads-up: defend the BB very wide and open 80%+ from the button. Postflop is about fold equity. C-bet often, double-barrel turns where you have equity.',
    3: '3-handed plays like heads-up with one extra seat. BTN opens 60-70%. SB defends wide vs BTN steals. Aggression and position dominate.',
    4: '4-max: the cutoff joins late position. BTN still opens 50-60%. SB and BB need wider defends than full-ring: calling 3-bets light is fine in position.',
    5: '5-max: the hijack starts to feel early. Late position is still where you make most of your money. BTN opens 45-55%, CO opens 30-40%.',
    6: '6-max: UTG is the only true early seat. CO and BTN should be your most-played positions for opens, 3-bets, and steals. Tighten UTG to premiums only.',
    7: '7-handed adds UTG+1. Early position needs to be tight (premiums and broadway). Late position keeps attacking the blinds aggressively.',
    8: 'Full-ring 8-max. Tighten UTG and UTG+1 to premiums only. Widen CO/BTN to attack the blinds when folded to.',
    9: 'Full-ring 9-max. Very disciplined early position: JJ+, AKs/AKo, AQs only from UTG. Exploit weak limps and small opens from the blinds when folded to.'
  };

  h += '<div class="label sec-subtitle mt-12">By Table Size</div>';
  h += '<div class="grid-auto dynamics-cards">';
  for (var si = 0; si < seatKeys.length; si++) {
    var seats = seatKeys[si];
    var entry = SEAT_MATRIX[seats];
    if (!entry) continue;
    var seatBucket = seats + 'p';
    var subD = d && d.bySeatBucket ? d.bySeatBucket[seatBucket] : null;
    var nHands = subD ? subD.n : 0;

    h += '<div class="card dynamics-card">';
    h += '<div class="gold-heading dynamics-card-head">' + seats + '-handed <span class="label">(' + nHands + ' hands)</span></div>';
    if (!nHands) {
      h += '<div class="dynamics-card-note label">No hands at this table size yet.</div>';
      h += '</div>';
      continue;
    }

    h += '<div class="label gold dynamics-zone-head">Your play: VPIP by position</div>';
    h += '<table class="tbl dynamics-pos-tbl"><thead><tr><th>Pos</th><th>Your VPIP</th><th>Target</th><th>Hands</th></tr></thead><tbody>';
    for (var pi = 0; pi < entry.positions.length; pi++) {
      var p = entry.positions[pi];
      if (!entry.guideByPos[p]) continue;
      var pm = subD.posMap[p];
      var actPct = (pm && pm.hands > 0) ? pct(pm.vpip, pm.hands) : null;
      var band = matrixTarget('vpip', p, seats, styleKey);
      var cls = band ? bandVerdict(actPct, Math.round(band.tight), Math.round(band.loose)).cls : 'v-na';
      h += '<tr class="' + cls + '"><td>' + p + '</td><td>' + (actPct != null ? actPct + '%' : '-') + '</td><td class="label">' + fmtBandRange(band) + '</td><td class="label">' + (pm ? pm.hands : 0) + '</td></tr>';
    }
    h += '</tbody></table>';

    if (seatCoaching[seats]) {
      h += '<div class="label gold dynamics-zone-head dynamics-coaching-head">Coaching</div>';
      h += '<div class="text-body dynamics-coaching">' + seatCoaching[seats] + '</div>';
    }
    h += '</div>';
  }
  h += '</div>';

  h += '<div class="label sec-subtitle mt-20">By Flop Players</div>';
  h += '<div class="grid-auto dynamics-cards">';
  var flopKeys = ['HU', '3-way', 'multiway'];
  var flopLabels = { HU: 'Heads-up flop', '3-way': '3-way flop', multiway: 'Multiway flop (4+)' };
  var flopCbetMod = { HU: 5, '3-way': 0, multiway: -10 };
  var ctx = getGameContext(d);
  var domSeats = ctx.seats;
  var domPos = ctx.defaultPos;
  for (var fk = 0; fk < flopKeys.length; fk++) {
    var bk = flopKeys[fk];
    var fe = FLOP_MATRIX[bk];
    var subF = d && d.byFlopBucket ? d.byFlopBucket[bk] : null;
    var nF = subF ? subF.n : 0;

    h += '<div class="card dynamics-card">';
    h += '<div class="gold-heading dynamics-card-head">' + flopLabels[bk] + ' <span class="label">(' + nF + ' hands)</span></div>';
    if (!nF) {
      h += '<div class="dynamics-card-note label">No flops with this many players yet.</div>';
      h += '</div>';
      continue;
    }

    h += '<div class="label gold dynamics-zone-head">Your play</div>';
    var cbetActual = subF.cbetOpps > 0 ? pct(subF.cbetDone, subF.cbetOpps) : null;
    var cbetSeatBand = matrixTarget('cbet', domPos, domSeats, styleKey);
    var cbetMod = flopCbetMod[bk] || 0;
    var cbetBand = cbetSeatBand ? {
      tight: Math.max(0, cbetSeatBand.tight + cbetMod),
      ideal: Math.max(0, cbetSeatBand.ideal + cbetMod),
      loose: Math.max(0, cbetSeatBand.loose + cbetMod)
    } : null;
    h += _vsRow('C-bet', cbetActual, subF.cbetOpps, fmtBandRange(cbetBand));

    h += '<div class="label gold dynamics-zone-head dynamics-coaching-head">Coaching</div>';
    h += '<div class="text-body dynamics-coaching">' + fe.notes + '</div>';
    h += '<div class="text-meta dynamics-card-kv"><span>Bet sizing</span><span>' + fe.cbetSizing + '</span></div>';
    h += '<div class="text-meta dynamics-card-kv"><span>Continue with</span><span>' + fe.continueRange + '</span></div>';
    h += '</div>';
  }
  h += '</div>';

  return h;
}

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

  var titleSentence = '';
  if (detected) {
    titleSentence = 'You play like a ' + detected.name + '. Your target is ' + targetStyleName + '. ' + _smGapPhrase(detected, targetStyleName);
  } else {
    titleSentence = 'Your target style is ' + targetStyleName + '.';
  }

  var html = '';
  html += '<div class="text-body mb-16">' + titleSentence + '</div>';

  html += '<div class="style-map-wrap">';
  html += '<div class="style-map-canvas-wrap"><canvas id="style-map-chart"></canvas></div>';

  html += '<div class="text-meta style-map-legend">';
  html += '<div class="sm-legend-item"><span class="dot dot-lg dot-g sm-dot-you"></span><span>You (overall)</span></div>';
  html += '<div class="sm-legend-item"><span class="dot dot-lg dot-cat-pos"></span><span>By position</span></div>';
  html += '<div class="sm-legend-item"><span class="dot dot-lg dot-cat-seat"></span><span>By table size</span></div>';
  html += '<div class="sm-legend-item"><span class="dot dot-lg dot-cat-tag sm-dot-tag"></span><span>TAG reference</span></div>';
  html += '<div class="sm-legend-item"><span class="dot dot-lg dot-gold"></span><span>Target: ' + targetStyleName + '</span></div>';
  html += '</div>';
  html += '</div>';

  container.innerHTML = html;

  var canvas = document.getElementById('style-map-chart');
  if (!canvas || typeof Chart === 'undefined') return;

  var colors = (typeof getChartColors === 'function') ? getChartColors() : {
    dim: '#666', border: '#333', green: '#2ecc71', gold: '#f1c40f', red: '#e74c3c', amber: '#e67e22'
  };

  var youAgg = null;
  var aggVpip = (typeof pct === 'function') ? pct(d.vpip, d.n) : null;
  var aggAf = (typeof calcAggression === 'function') ? calcAggression(d.raises, d.calls, d.checks) : null;
  if (aggVpip != null && aggAf != null) youAgg = { vpip: aggVpip, af: aggAf, n: d.n };

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

  function _radiusForN(n, base, max) {
    base = base || 4;
    max = max || 14;
    var r = base + Math.sqrt(Math.max(1, n)) / 4;
    return Math.min(max, r);
  }

  var datasets = [];

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

  datasets.push({
    type: 'scatter',
    label: 'TAG',
    data: [{ x: tagAnchor.vpip, y: tagAnchor.af, _label: 'TAG' }],
    backgroundColor: 'rgba(160, 160, 160, 0.7)',
    borderColor: 'rgba(200, 200, 200, 0.9)',
    pointRadius: 9,
    pointStyle: 'rectRot'
  });

  datasets.push({
    type: 'scatter',
    label: 'Target: ' + targetStyleName,
    data: [{ x: targetAnchor.vpip, y: targetAnchor.af, _label: targetStyleName }],
    backgroundColor: colors.gold,
    borderColor: colors.gold,
    pointRadius: 11,
    pointStyle: 'star'
  });

  // Drawn last so it sits on top.
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
