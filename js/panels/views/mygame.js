// My Game panel view: assembles the UI from shared components +
// mygameProfile/mygameWorkFinding/styleMapModel.

function renderMyGame(container, d, hands) {
  var profile = mygameProfile(d, hands);

  var profileHtml = `<div class="profile-row row">
    <div class="stat">
      <div class="eyebrow">MY GAME</div>
      <div>
        <div class="value value-lg c-gold">${profile.playerName}</div>
        <div class="text-body profile-meta">${profile.exportDate ? profile.exportDate + ' &middot; ' : ''}${d.n} hands</div>
      </div>
    </div>
    ${profile.typeLabel ? `<div class="profile-type-block stat">
      <div class="eyebrow">PLAYER TYPE</div>
      <div>
        <div class="value value-lg c-gold">${profile.typeLabel}</div>
        <div class="text-body profile-type-desc">${profile.typeDesc}</div>
      </div>
    </div>` : ''}
  </div>`;

  var body = section('', profileHtml);

  if (profile.smallSample) {
    body += section('', `<div class="text-meta">Stats from ${d.n} hands. These become reliable around 100+ hands.</div>`);
  } else {
    // The chosen work-on item renders as a shared story card (same component
    // as every other panel's findings).
    var workFinding = mygameWorkFinding(d, hands);
    var workCard = (typeof Sections !== 'undefined' && Sections.renderStoryCard)
      ? Sections.renderStoryCard(workFinding)
      : `<div class="box"><div class="lead fw-semibold">${workFinding.name}</div></div>`;
    body += `<div class="section">
      <div class="section-head">Work On Next</div>
      <div class="row" data-findings>${workCard}</div>
    </div>`;
  }

  body += renderTableDynamicsReference(hands, d);

  container.innerHTML =
    panelHeader('My Game', 'Your scouting report: player type, the one leak to work on next, and how your play stacks up against target benchmarks by table size and flop.') +
    body +
    section('Style Map', '<div id="mygame-stylemap" class="list"></div>');

  if (typeof Sections !== 'undefined' && Sections.wireFindings) Sections.wireFindings(container);

  var smHost = container.querySelector('#mygame-stylemap');
  if (smHost && typeof renderStyleMap === 'function') {
    renderStyleMap(smHost, d, hands);
  }
}

function _vsRow(label, actualPct, actualDenom, targetText) {
  var rng = _parsePctRange(targetText);
  var actualStr = (actualPct == null) ? '-' : actualPct + '%';
  var sampleStr = actualDenom != null ? ` <span class="c-dim">(${actualDenom} spots)</span>` : '';
  var v = rng ? bandVerdict(actualPct, rng[0], rng[1]) : { cls: 'v-na', label: '' };
  return `<div class="dynamics-vs ${v.cls}">
    ${label ? `<div class="dynamics-vs-stat eyebrow">${label}</div>` : ''}
    <div class="row between text-meta dynamics-vs-top"><span>You: <strong>${actualStr}</strong>${sampleStr}</span>
    <span class="c-dim">Target: ${targetText}</span></div>
    ${v.label ? `<div class="eyebrow dynamics-vs-verdict">${v.label}</div>` : ''}
  </div>`;
}

// Targets must come from matrixTarget so the user's style offset (TAG/LAG/Nit/etc)
// is applied — reading SEAT_MATRIX / FLOP_MATRIX directly would skip the offset.
function renderTableDynamicsReference(hands, d) {
  var h = section('Table Dynamics: You vs Target',
    '<div class="text-body">Your actual play at each table size and flop multiplicity, compared to the recommended benchmarks for your target style. <span class="c-pos">Green = on target</span>, <span class="c-warn">amber = too low / too tight</span>, <span class="c-neg">red = too high / too loose</span>.</div>');

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

  var seatCards = '';
  for (var si = 0; si < seatKeys.length; si++) {
    var seats = seatKeys[si];
    var entry = SEAT_MATRIX[seats];
    if (!entry) continue;
    var subD = d && d.bySeatBucket ? d.bySeatBucket[seats + 'p'] : null;
    var nHands = subD ? subD.n : 0;

    var cardBody = '';
    if (!nHands || !subD.posMap) {
      cardBody = `<div class="text-body c-dim">${nHands ? 'Not enough hands at this table size yet.' : 'No hands at this table size yet.'}</div>`;
    } else {
      var posRows = '';
      for (var pi = 0; pi < entry.positions.length; pi++) {
        var p = entry.positions[pi];
        if (!entry.guideByPos[p]) continue;
        var pm = subD.posMap[p];
        var actPct = (pm && pm.hands > 0) ? pct(pm.vpip, pm.hands) : null;
        var band = matrixTarget('vpip', p, seats, styleKey);
        var v = band ? bandVerdict(actPct, Math.round(band.tight), Math.round(band.loose)).cls : 'v-na';
        var vpipCls = v === 'v-ok' ? 'c-pos fw-semibold' : v === 'v-low' ? 'c-warn fw-semibold' : v === 'v-high' ? 'c-neg fw-semibold' : '';
        posRows += `<tr><td>${p}</td><td class="${vpipCls}">${actPct != null ? actPct + '%' : '-'}</td><td class="c-dim">${fmtBandRange(band)}</td><td class="c-dim">${pm ? pm.hands : 0}</td></tr>`;
      }
      cardBody = `<div class="stat">
        <div class="eyebrow c-gold">Your play: VPIP by position</div>
        <table class="table"><thead><tr><th>Pos</th><th>Your VPIP</th><th>Target</th><th>Hands</th></tr></thead><tbody>${posRows}</tbody></table>
      </div>` +
      (seatCoaching[seats] ? `<div class="insight-coaching">
        <div class="eyebrow c-warn">Coaching</div>
        <div class="text-body">${seatCoaching[seats]}</div>
      </div>` : '');
    }

    seatCards += `<div class="card dynamics-card">
      <div class="card-title c-gold">${seats}-handed <span class="c-dim">(${nHands} hands)</span></div>
      ${cardBody}
    </div>`;
  }
  h += section('By Table Size', `<div class="dynamics-cards">${seatCards}</div>`);

  var flopKeys = ['HU', '3-way', 'multiway'];
  var flopLabels = { HU: 'Heads-up flop', '3-way': '3-way flop', multiway: 'Multiway flop (4+)' };
  var flopCbetMod = { HU: 5, '3-way': 0, multiway: -10 };
  var ctx = getGameContext(d);
  var flopCards = '';
  for (var fk = 0; fk < flopKeys.length; fk++) {
    var bk = flopKeys[fk];
    var fe = FLOP_MATRIX[bk];
    var subF = d && d.byFlopBucket ? d.byFlopBucket[bk] : null;
    var nF = subF ? subF.n : 0;

    var flopBody = '';
    if (!nF) {
      flopBody = '<div class="text-body c-dim">No flops with this many players yet.</div>';
    } else {
      var cbetActual = subF.cbetOpps > 0 ? pct(subF.cbetDone, subF.cbetOpps) : null;
      var cbetSeatBand = matrixTarget('cbet', ctx.defaultPos, ctx.seats, styleKey);
      var cbetMod = flopCbetMod[bk] || 0;
      var cbetBand = cbetSeatBand ? {
        tight: Math.max(0, cbetSeatBand.tight + cbetMod),
        ideal: Math.max(0, cbetSeatBand.ideal + cbetMod),
        loose: Math.max(0, cbetSeatBand.loose + cbetMod)
      } : null;
      flopBody = `<div class="stat">
        <div class="eyebrow c-gold">Your play</div>
        ${_vsRow('C-bet', cbetActual, subF.cbetOpps, fmtBandRange(cbetBand))}
      </div>
      <div class="insight-coaching">
        <div class="eyebrow c-warn">Coaching</div>
        <div class="text-body">${fe.notes}</div>
        <div class="text-meta dynamics-card-kv row between"><span class="eyebrow c-muted">Bet sizing</span><span>${fe.cbetSizing}</span></div>
        <div class="text-meta dynamics-card-kv row between"><span class="eyebrow c-muted">Continue with</span><span>${fe.continueRange}</span></div>
      </div>`;
    }

    flopCards += `<div class="card dynamics-card">
      <div class="card-title c-gold">${flopLabels[bk]} <span class="c-dim">(${nF} hands)</span></div>
      ${flopBody}
    </div>`;
  }
  h += section('By Flop Players', `<div class="dynamics-cards">${flopCards}</div>`);

  return h;
}

function renderStyleMap(container, d, hands) {
  if (!container) return;

  var m = styleMapModel(d);

  container.innerHTML =
    `<div class="text-body">${m.titleSentence}</div>
    <div class="style-map-canvas-wrap"><canvas id="style-map-chart"></canvas></div>
    <div class="legend">
      <div class="legend-item"><span class="dot dot-lg bg-pos sm-dot-you"></span><span>You (overall)</span></div>
      <div class="legend-item"><span class="dot dot-lg dot-cat-pos"></span><span>By position</span></div>
      <div class="legend-item"><span class="dot dot-lg dot-cat-seat"></span><span>By table size</span></div>
      <div class="legend-item"><span class="dot dot-lg dot-cat-tag sm-dot-tag"></span><span>TAG reference</span></div>
      <div class="legend-item"><span class="dot dot-lg bg-gold"></span><span>Target: ${m.targetStyleName}</span></div>
    </div>`;

  var canvas = document.getElementById('style-map-chart');
  if (!canvas || typeof Chart === 'undefined') return;

  var colors = (typeof getChartColors === 'function') ? getChartColors() : {
    dim: '#666', border: '#333', green: '#2ecc71', gold: '#f1c40f', red: '#e74c3c', amber: '#e67e22'
  };

  function _radiusForN(n, base, max) {
    base = base || 4;
    max = max || 14;
    var r = base + Math.sqrt(Math.max(1, n)) / 4;
    return Math.min(max, r);
  }

  var datasets = [];

  if (m.youAgg) {
    datasets.push({
      type: 'line',
      label: 'Gap to target',
      data: [
        { x: m.youAgg.vpip, y: m.youAgg.af },
        { x: m.targetAnchor.vpip, y: m.targetAnchor.af }
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

  if (m.posPoints.length) {
    datasets.push({
      type: 'scatter',
      label: 'By position',
      data: m.posPoints.map(function(p) { return { x: p.x, y: p.y, _label: p.label, _n: p.n }; }),
      backgroundColor: 'rgba(160, 200, 240, 0.55)',
      borderColor: 'rgba(160, 200, 240, 0.9)',
      pointRadius: m.posPoints.map(function(p) { return _radiusForN(p.n, 4, 11); }),
      pointHoverRadius: m.posPoints.map(function(p) { return _radiusForN(p.n, 4, 11) + 2; })
    });
  }

  if (m.seatPoints.length) {
    datasets.push({
      type: 'scatter',
      label: 'By table size',
      data: m.seatPoints.map(function(p) { return { x: p.x, y: p.y, _label: p.label, _n: p.n }; }),
      backgroundColor: 'rgba(200, 160, 220, 0.55)',
      borderColor: 'rgba(200, 160, 220, 0.9)',
      pointRadius: m.seatPoints.map(function(p) { return _radiusForN(p.n, 4, 11); }),
      pointHoverRadius: m.seatPoints.map(function(p) { return _radiusForN(p.n, 4, 11) + 2; })
    });
  }

  datasets.push({
    type: 'scatter',
    label: 'TAG',
    data: [{ x: m.tagAnchor.vpip, y: m.tagAnchor.af, _label: 'TAG' }],
    backgroundColor: 'rgba(160, 160, 160, 0.7)',
    borderColor: 'rgba(200, 200, 200, 0.9)',
    pointRadius: 9,
    pointStyle: 'rectRot'
  });

  datasets.push({
    type: 'scatter',
    label: 'Target: ' + m.targetStyleName,
    data: [{ x: m.targetAnchor.vpip, y: m.targetAnchor.af, _label: m.targetStyleName }],
    backgroundColor: colors.gold,
    borderColor: colors.gold,
    pointRadius: 11,
    pointStyle: 'star'
  });

  // Drawn last so it sits on top.
  if (m.youAgg) {
    datasets.push({
      type: 'scatter',
      label: 'You',
      data: [{ x: m.youAgg.vpip, y: m.youAgg.af, _label: 'You', _n: m.youAgg.n }],
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
