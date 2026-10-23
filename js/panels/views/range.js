// Range panel view: subtabs (Overall / By Spot), the two 13x13 grids, and the
// spot findings. Logic lives in js/panels/range.js.

function buildGtoGridHtml(chart, tallies) {
  var colors = chartToColorMap(chart);
  var html = '<div class="range-grid-sm">';
  for (var r = 0; r < 13; r++) {
    for (var c = 0; c < 13; c++) {
      var key = rangeBuildKey(r, c);
      var gto = colors[key] || 'none';
      var tip = tallies ? tipForCombo(key, tallies) : key;
      html += `<div class="rc" data-gto="${gto}" data-key="${key}" data-tip="${tip}"><span>${key}</span></div>`;
    }
  }
  return html + '</div>';
}

// Right grid: each combo you were dealt in this spot is coloured by the action
// you took (same palette as the GTO chart), so the two grids read in the same
// colour language. Combos you were never dealt here stay empty.
function buildHeroGridHtml(byKey, colors, hasChart) {
  var html = '<div class="range-grid-sm">';
  for (var r = 0; r < 13; r++) {
    for (var c = 0; c < 13; c++) {
      var key = rangeBuildKey(r, c);
      var rec = byKey[key];
      var target = hasChart ? gtoTargetAction(colors[key]) : null;
      // Cell colour follows YOUR action, using the same palette as the GTO
      // chart. No right/wrong marking — the colour is the whole story.
      var attr = (rec && rec.dealt > 0) ? `data-act="${spotHeroAction(rec)}"` : 'data-hero="none"';
      var tip = heroTipForCombo(key, rec, target);
      html += `<div class="rc rc-hero" ${attr} data-key="${key}" data-tip="${tip}"><span>${key}</span></div>`;
    }
  }
  return html + '</div>';
}

function twoGridHtml(chart, filtered, scenarioType, tallies, dealtCount) {
  var colors = chartToColorMap(chart);
  var byKey = heroComboBreakdown(filtered, scenarioType);
  var hasChart = !!(chart && chart.length);
  var countLabel = dealtCount === 1 ? '1 hand you were dealt here' : dealtCount + ' hands you were dealt here';
  return `<div class="section">
    <div class="section-head">GTO vs your range</div>
    <div class="row">
      <div class="container">
        <div class="eyebrow">What GTO does</div>
        <div class="list">
          <div class="text-meta">Reference chart for this spot. The whole range is coloured, this is not your data.</div>
          ${buildGtoGridHtml(chart, tallies)}
        </div>
        ${gtoLegendHtml()}
      </div>
      <div class="container">
        <div class="eyebrow">What you did</div>
        <div class="list">
          <div class="text-meta">Only the ${countLabel} are marked. Everything else is a hand you were never dealt in this spot.</div>
          ${buildHeroGridHtml(byKey, colors, hasChart)}
        </div>
        ${heroLegendHtml()}
      </div>
    </div>
  </div>`;
}

// These legends colour swatches straight from the GTO palette variables, so
// they stay as literal markup rather than going through legendRow.
function gtoLegendHtml() {
  return `<div class="legend">
    <div class="legend-item"><span class="swatch" style="background:var(--gto-red)"></span>Raise for value</div>
    <div class="legend-item"><span class="swatch" style="background:var(--gto-blue)"></span>Raise for bluff</div>
    <div class="legend-item"><span class="swatch" style="background:var(--green)"></span>Call</div>
    <div class="legend-item"><span class="swatch" style="background:var(--gto-grey)"></span>Fold (you were in this hand)</div>
    <div class="legend-item"><span class="swatch" style="background:var(--gto-white)"></span>Fold</div>
  </div>`;
}

function heroLegendHtml() {
  return `<div class="legend">
    <div class="legend-item"><span class="swatch" style="background:var(--gto-red)"></span>You raised</div>
    <div class="legend-item"><span class="swatch" style="background:var(--green)"></span>You called</div>
    <div class="legend-item"><span class="swatch" style="background:var(--gto-grey)"></span>You folded</div>
    <div class="legend-item"><span class="swatch" style="background:var(--gto-empty-bg);border:var(--bw) solid var(--border)"></span>Not dealt</div>
  </div>`;
}

function renderRange(container, d, hands) {
  var stored = loadRangeState();
  var state = {
    hero:     HERO_SEATS.indexOf(stored.hero) !== -1 ? stored.hero : 'BTN',
    scenario: stored.scenario || 'RFI',
  };

  function persist() { saveRangeState(state); }

  // One scrolling page: your clickable range grid on top, the GTO-by-spot
  // comparison below. No subtabs — nothing is hidden behind a toggle. Clicking
  // any hand on either grid opens its full breakdown.
  container.innerHTML =
    panelHeader('Range', 'Click any hand to see how you play it: win rate, P&L, preflop actions, and the hands behind it. The GTO-by-spot comparison is further down.') +
    '<div id="range-overall"></div>' +
    '<div id="range-spot-wrap"></div>';

  renderOverall(document.getElementById('range-overall'));
  renderSpotSection(document.getElementById('range-spot-wrap'));

  function renderOverall(body) {
    if (!body) return;
    var counts = overallRangeCounts(hands);
    body.innerHTML = section('Your hands',
      '<div class="text-meta">Every holding you have been dealt, shaded by how often you play it. Click any hand for its full breakdown: win rate, P&amp;L, preflop actions, and the hands behind it.</div>' +
      buildOverallRangeGrid(counts) +
      overallHeatLegend() +
      Sections.findingsBlock(Sections.findingsForPanel(Sections.evaluateSections(d, {}, hands), 'Range'), 'Range data is still building.'));

    var grid = body.querySelector('.cards-ov-grid');
    if (grid) {
      grid.addEventListener('click', function(e) {
        var cell = e.target.closest('.rc[data-key]');
        if (!cell) return;
        var key = cell.getAttribute('data-key');
        if (key) openHandAnalysisModal(key, hands);
      });
    }
  }

  function renderSpotSection(wrap) {
    if (!wrap) return;
    wrap.innerHTML = section('GTO by spot', '<div class="text-meta">Loading GTO chart &hellip;</div>');
    getRangeData().then(function(data) {
      renderSpot(wrap, data);
    }).catch(function() {
      wrap.innerHTML = section('GTO by spot', '<div class="text-body c-neg">Failed to load GTO chart data. Reload the page to try again.</div>');
    });
  }

  function renderSpot(body, data) {
    if (HERO_SEATS.indexOf(state.hero) === -1) state.hero = 'BTN';
    var scenarios = HERO_CHARTS[state.hero] || [];
    var keys = scenarios.map(function(s) { return s.key; });
    if (keys.indexOf(state.scenario) === -1) {
      state.scenario = keys[0] || '';
      persist();
    }
    var entry = findScenario(state.hero, state.scenario);
    var chart = lookupChartFor(data, state.hero, state.scenario);
    var filtered = filterHandsForScenario(hands, state.hero, state.scenario);
    var scenarioType = entry ? entry.type : 'overall';
    var tallies = tallyByCombo(filtered, scenarioType);
    var scenarioOptions = scenarios.map(function(s) {
      return `<option value="${s.key}"${s.key === state.scenario ? ' selected' : ''}>${s.label}</option>`;
    }).join('');
    var label = entry ? entry.label : '';
    // Count only hands whose hole cards parse to a combo, so the headline number
    // matches what the "your range" grid actually marks (tallyByCombo and
    // heroComboBreakdown both skip unparseable holes).
    var dealtCount = 0;
    for (var fi = 0; fi < filtered.length; fi++) {
      if (parseHoleKey(filtered[fi].hole)) dealtCount++;
    }
    body.innerHTML =
      section('GTO by spot',
        '<div class="text-meta">Pick a position and scenario to compare what GTO does with what you actually did. Click any hand for its full breakdown.</div>' +
        `<div class="row center">
          <div class="row center"><label class="eyebrow">Position</label>${positionSelector('range-hero', HERO_SEATS, state.hero)}</div>
          <div class="row center"><label class="eyebrow">Scenario</label><select class="select" id="range-scenario">${scenarioOptions}</select></div>
        </div>` +
        renderHeaderStats(dealtCount, state.hero + ' · ' + label) +
        (chart ? '' : `<div class="text-meta">No GTO reference for ${state.hero} ${label} yet.</div>`)) +
      twoGridHtml(chart, filtered, scenarioType, tallies, dealtCount) +
      Sections.findingsBlock(
        buildSpotFindings(
          state.hero + ' · ' + label,
          heroComboBreakdown(filtered, scenarioType),
          chartToColorMap(chart),
          !!(chart && chart.length),
          dealtCount,
          filtered
        ),
        'Play more hands from this spot to grade it.'
      );
    bindSelector(body, 'range-hero', function(v) {
      state.hero = v;
      state.scenario = (HERO_CHARTS[v] && HERO_CHARTS[v][0] && HERO_CHARTS[v][0].key) || '';
      persist();
      renderSpot(body, data);
    });
    bindSelector(body, 'range-scenario', function(v) {
      state.scenario = v;
      persist();
      renderSpot(body, data);
    });
    bindCellClicks(body);
  }

  function renderHeaderStats(count, label) {
    if (!count) {
      return `<div class="text-meta">No ${label} hands on record yet.</div>`;
    }
    return `<div class="lead">${count} ${label} hand${count === 1 ? '' : 's'} on record</div>`;
  }

  // Clicking any cell on either GTO-by-spot grid opens that holding's full
  // breakdown, the same popup the top grid uses, so the behaviour is consistent
  // wherever you click a hand. The modal handles never-dealt holdings itself.
  function bindCellClicks(scope) {
    if (scope._cellHandlerBound) return;
    scope._cellHandlerBound = true;
    scope.addEventListener('click', function(e) {
      var cell = e.target.closest('.rc[data-key]');
      if (!cell) return;
      var key = cell.getAttribute('data-key');
      if (key) openHandAnalysisModal(key, hands);
    });
  }
}

function positionSelector(id, options, current) {
  if (current && options.indexOf(current) === -1) options = [current].concat(options);
  var opts = options.map(function(p) {
    return `<option value="${p}"${p === current ? ' selected' : ''}>${p}</option>`;
  }).join('');
  return `<select class="select" id="${id}">${opts}</select>`;
}

function bindSelector(scope, id, cb) {
  var el = scope.querySelector('#' + id);
  if (!el) return;
  el.onchange = function() { cb(el.value); };
}

// ---- Overall subtab: all-hands range grid + per-holding analysis modal ----

// Hover tooltip for a grid cell. Lines are joined with "\n" and rendered
// stacked by the .rc[data-tip] white-space:pre-line CSS rule.
function _ovTip(key, rec) {
  if (!rec || !rec.dealt) return key + '\nNot dealt';
  var lines = [key];
  if (rec.pnlKnown) lines.push('P/L: ' + fmtPnl(rec.pnl));
  var vp = Math.round(rec.played / rec.dealt * 100);
  lines.push('Played ' + rec.played + '/' + rec.dealt + ' (' + vp + '%)');
  if (rec.played > 0) lines.push('Won ' + Math.round(rec.won / rec.played * 100) + '%');
  return lines.join('\n');
}

// The clickable 13x13 grid, each cell shaded 0-4 by how often you play it.
function buildOverallRangeGrid(counts) {
  var html = '<div class="range-grid-sm cards-ov-grid">';
  for (var r = 0; r < 13; r++) {
    for (var c = 0; c < 13; c++) {
      var key = rangeBuildKey(r, c);
      var rec = counts.map[key];
      var heat = (!rec || !rec.dealt) ? 0
        : (counts.maxPlayed > 0 ? Math.max(1, Math.ceil(rec.played / counts.maxPlayed * 4)) : 1);
      html += '<div class="rc" data-ov-heat="' + heat + '" data-key="' + key + '" data-tip="' + _ovTip(key, rec) + '"><span>' + key + '</span></div>';
    }
  }
  return html + '</div>';
}

function overallHeatLegend() {
  return '<div class="text-meta cards-ov-legend">Shade shows how often you play each holding: lighter = rarely, solid green = most often. Grey cells were never dealt.</div>';
}

function _ovPct(n, total) {
  return total > 0 ? Math.round(n / total * 100) + '%' : '0%';
}

// The stats/analysis block shown at the top of the hand modal.
function handAnalysisStatsHtml(m) {
  if (!m.dealt) {
    return '<div class="inner-section"><div class="card card-s2"><div class="text-body">You have not been dealt ' + m.key + ' in the current filter.</div></div></div>';
  }

  var mini = renderMiniRow([
    { l: 'Dealt', v: m.dealt, c: 'text' },
    { l: 'Played', v: m.vpipPct == null ? '-' : m.vpipPct + '%', c: 'text' },
    { l: 'Win rate', v: m.wrPct == null ? '-' : m.wrPct + '%', c: m.wrPct == null ? 'text' : (m.wrPct >= 50 ? 'g' : 'r') },
    { l: 'Net P/L', v: m.cashCount ? fmtPnl(m.pnlChips) : '-', c: m.cashCount ? (m.pnlChips >= 0 ? 'g' : 'r') : 'text' },
    { l: 'bb/100', v: m.bb100 == null ? '-' : (m.bb100 > 0 ? '+' : '') + m.bb100, c: m.bb100 == null ? 'text' : (m.bb100 >= 0 ? 'g' : 'r') },
  ]);

  var total = m.dealt;
  var preBar = barStack([
    { p: m.pre.raise / total * 100, bg: 'bg-gold' },
    { p: m.pre.call / total * 100, bg: 'bg-pos' },
    { p: m.pre.fold / total * 100, bg: 'bg-muted' },
    { p: m.pre.other / total * 100, bg: 'bg-dim' },
  ]);
  var preLegendItems = [
    { cls: 'bg-gold', label: 'Raised ' + _ovPct(m.pre.raise, total) },
    { cls: 'bg-pos', label: 'Called ' + _ovPct(m.pre.call, total) },
    { cls: 'bg-muted', label: 'Folded ' + _ovPct(m.pre.fold, total) },
  ];
  if (m.pre.other) preLegendItems.push({ cls: 'bg-dim', label: 'Checked/other ' + _ovPct(m.pre.other, total) });

  var showdown = '';
  if (m.played) {
    showdown = '<div class="inner-section"><div class="section-head">Showdown</div><div class="text-body">Reached showdown ' +
      m.reachedSd + ' of the ' + m.played + ' hand' + (m.played === 1 ? '' : 's') + ' you played' +
      (m.sdWinPct != null ? ', winning ' + m.sdWinPct + '% of them' : '') + '.</div></div>';
  }

  var posRows = [];
  for (var pi = 0; pi < POSITION_ORDER.length; pi++) {
    var p = POSITION_ORDER[pi];
    var b = m.byPos[p];
    if (!b) continue;
    var wr = b.played > 0 ? pct(b.won, b.played) : null;
    posRows.push('<tr><td>' + p + '</td><td>' + b.dealt + '</td><td>' + b.played + '</td><td>' +
      (wr == null ? '-' : wr + '%') + '</td><td class="' + (b.pnlKnown ? pnlCls(b.pnl) : '') + '">' +
      (b.pnlKnown ? fmtPnl(b.pnl) : '-') + '</td></tr>');
  }
  var byPos = posRows.length
    ? '<div class="inner-section"><div class="section-head">By position</div><div class="overflow-x"><table class="table"><thead>' +
      tableHead(['Pos', 'Dealt', 'Played', { tip: 'Win Rate' }, 'P/L']) + '</thead><tbody>' + posRows.join('') + '</tbody></table></div></div>'
    : '';

  return '<div class="inner-section"><div class="section-head">' + m.key + ' · ' + m.cls + '</div>' + mini + '</div>' +
    '<div class="inner-section"><div class="section-head">Preflop action</div>' + preBar + legendRow(preLegendItems) + '</div>' +
    showdown + byPos;
}

function openHandAnalysisModal(key, hands) {
  var m = handAnalysisModel(hands, key);
  var title = m.dealt ? key + ' · ' + m.cls : key;
  showExampleHandListModal(title, m.hands, null, null, handAnalysisStatsHtml(m));
}
