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
    subTab:   stored.subTab   || 'overall',
    hero:     HERO_SEATS.indexOf(stored.hero) !== -1 ? stored.hero : 'BTN',
    scenario: stored.scenario || 'RFI',
  };
  if (state.subTab !== 'overall' && state.subTab !== 'spot') state.subTab = 'overall';

  function persist() { saveRangeState(state); }

  container.innerHTML =
    panelHeader('Range', 'Overall shows your play and win rate by hand type. By Spot compares what GTO does with what you did, position by position.') +
    `<div class="subtabs" id="range-subtabs">${subTabBtn('overall', 'Overall', state)}${subTabBtn('spot', 'By Spot', state)}</div>
    <div id="range-subtab-body"></div>`;

  var subtabs = document.getElementById('range-subtabs');
  subtabs.addEventListener('click', function(e) {
    var btn = e.target.closest('.subtab');
    if (!btn) return;
    var t = btn.getAttribute('data-subtab');
    if (!t || t === state.subTab) return;
    state.subTab = t;
    persist();
    refreshSubTabButtons();
    renderBody();
  });

  function refreshSubTabButtons() {
    subtabs.querySelectorAll('.subtab').forEach(function(b) {
      b.classList.toggle('active', b.getAttribute('data-subtab') === state.subTab);
    });
  }

  function renderBody() {
    var body = document.getElementById('range-subtab-body');
    if (!body) return;
    if (state.subTab === 'overall') {
      renderOverall(body);
      return;
    }
    body.innerHTML = '<div class="text-meta">Loading GTO chart &hellip;</div>';
    getRangeData().then(function(data) {
      renderSpot(body, data);
    }).catch(function() {
      body.innerHTML = '<div class="text-body c-neg">Failed to load GTO chart data. Reload the page to try again.</div>';
    });
  }

  function renderOverall(body) {
    body.innerHTML = section('Your range',
      '<div class="text-meta">How wide you play and which combos carry your results. The 13x13 chart, position by position, lives under By Spot.</div>' +
      Sections.findingsBlock(Sections.findingsForPanel(Sections.evaluateSections(d, {}, hands), 'Range'), 'Range data is still building.'));
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
      section('',
        `<div class="row wrap center">
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

  function bindCellClicks(scope) {
    if (scope._cellHandlerBound) return;
    scope._cellHandlerBound = true;
    scope.addEventListener('click', function(e) {
      var cell = e.target.closest('.rc[data-key]');
      if (!cell) return;
      var key = cell.getAttribute('data-key');
      if (!key) return;
      // Re-derive the spot's hands at click time so the modal reflects the
      // current Position/Scenario selection.
      var active = filterHandsForScenario(hands, state.hero, state.scenario);
      // Open only YOUR hands of this combo in the current spot. A GTO-reference
      // cell (or any combo) you were never dealt here has no matching hands and
      // so does nothing, on either grid.
      var matched = active.filter(function(h) { return parseHoleKey(h.hole) === key; });
      if (!matched.length) return;
      showExampleHandListModal(key, matched);
    });
  }

  refreshSubTabButtons();
  renderBody();
}

function subTabBtn(id, label, state) {
  return `<button class="subtab${state.subTab === id ? ' active' : ''}" data-subtab="${id}">${label}</button>`;
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
