// Custom Report view: the sentence builder, popovers, headline tiles,
// insight cards and charts. Logic lives in js/panels/custom.js.

var _crState = null;
var _crHands = [];
var _crClauseDefs = [];
var _crBaseline = null;
var _crCharts = [];
var _crPopover = null;

function _crDestroyCharts() {
  for (var i = 0; i < _crCharts.length; i++) {
    if (_crCharts[i]) _crCharts[i].destroy();
  }
  _crCharts = [];
}

function _crClausePhrase(clauseId, segment) {
  var def = _crClauseDefs.find(function(c) { return c.id === clauseId; });
  if (!def) return null;
  var value = segment.values[clauseId];
  if (value == null || (Array.isArray(value) && !value.length)) return null;
  return def.phrase(value, def.options);
}

function _crRenderSentence(segment, segLabel) {
  var parts = [];
  for (var i = 0; i < segment.clauses.length; i++) {
    var clauseId = segment.clauses[i];
    var def = _crClauseDefs.find(function(c) { return c.id === clauseId; });
    if (!def) continue;
    var phrase = _crClausePhrase(clauseId, segment);
    var displayPhrase = phrase || '<span class="sentence-empty">Select ' + def.label.toLowerCase() + '</span>';
    parts.push(
      '<span class="sentence-token" data-segment="' + segLabel + '" data-clause="' + clauseId + '">' +
      displayPhrase +
      '</span>'
    );
  }

  var sentence = '';
  if (segLabel === 'A' && _crState.compare) sentence += '<span class="sentence-seg-tag">A:</span> ';
  if (segLabel === 'B') sentence += '<span class="sentence-seg-tag">B:</span> ';
  sentence += '<span class="c-dim">Show me how I play</span> ';
  for (var pi = 0; pi < parts.length; pi++) {
    if (pi > 0) {
      sentence += (pi === parts.length - 1) ? ' <span class="c-dim">and</span> ' : '<span class="c-dim">,</span> ';
    }
    sentence += parts[pi];
  }

  var available = _crClauseDefs.filter(function(c) { return segment.clauses.indexOf(c.id) === -1; });
  var addBtn = available.length
    ? ' <button class="sentence-add" data-segment="' + segLabel + '">+ add clause</button>'
    : '';
  sentence += addBtn;
  return '<div class="sentence">' + sentence + '</div>';
}

function _crClosePopover() {
  if (_crPopover && _crPopover.parentNode) _crPopover.parentNode.removeChild(_crPopover);
  _crPopover = null;
}

function _crOpenAddClausePopover(targetEl, segLabel) {
  _crClosePopover();
  var segment = _crState[segLabel];
  var available = _crClauseDefs.filter(function(c) { return segment.clauses.indexOf(c.id) === -1; });
  if (!available.length) return;

  var hand = available.filter(function(c) { return c.kind === 'hand'; });
  var decision = available.filter(function(c) { return c.kind === 'decision'; });

  var html = '<div class="card-title c-gold">Add a clause</div>';
  if (hand.length) {
    html += '<div class="cr-pop-section eyebrow">Hand-level</div>';
    html += hand.map(function(c) {
      return '<button class="text-meta cr-pop-opt" data-add-clause="' + c.id + '">' + c.label + '</button>';
    }).join('');
  }
  if (decision.length) {
    html += '<div class="cr-pop-section eyebrow">Decision-level</div>';
    html += decision.map(function(c) {
      return '<button class="text-meta cr-pop-opt" data-add-clause="' + c.id + '">' + c.label + '</button>';
    }).join('');
  }

  _crShowPopover(targetEl, html, function(pop) {
    pop.querySelectorAll('[data-add-clause]').forEach(function(btn) {
      btn.onclick = function() {
        var clauseId = this.getAttribute('data-add-clause');
        segment.clauses.push(clauseId);
        // Leave the value unset so the clause reads "Select" until the user
        // picks one. Open the value picker straight away so the next click is
        // choosing a value, not hunting for where to set it.
        var def = _crClauseDefs.find(function(c) { return c.id === clauseId; });
        if (def) segment.values[clauseId] = def.multi ? [] : null;
        _crClosePopover();
        _crSaveState(_crState);
        _crRerender();
        var host = document.getElementById('p-custom');
        var tok = host && host.querySelector('.sentence-token[data-segment="' + segLabel + '"][data-clause="' + clauseId + '"]');
        if (tok) _crOpenClausePopover(tok, segLabel, clauseId);
      };
    });
  });
}

function _crOpenClausePopover(targetEl, segLabel, clauseId) {
  _crClosePopover();
  var def = _crClauseDefs.find(function(c) { return c.id === clauseId; });
  if (!def) return;
  var segment = _crState[segLabel];
  var current = segment.values[clauseId];

  var html = '<div class="card-title c-gold">' + def.label + '</div>';
  if (!def.options.length) {
    html += '<div class="text-body">No options available. None of your hands match this clause yet.</div>';
  } else if (def.multi) {
    current = Array.isArray(current) ? current : [];
    html += def.options.map(function(o) {
      var checked = current.indexOf(o.value) !== -1;
      return '<label class="text-meta cr-pop-opt cr-pop-multi' + (checked ? ' selected' : '') + '">' +
        '<input type="checkbox" data-val="' + o.value + '"' + (checked ? ' checked' : '') + '>' +
        '<span>' + o.label + (o.meta ? ' <span class="text-micro cr-pop-meta">' + o.meta + '</span>' : '') + '</span>' +
        '</label>';
    }).join('');
  } else {
    html += def.options.map(function(o) {
      var sel = current === o.value;
      return '<button class="text-meta cr-pop-opt' + (sel ? ' selected' : '') + '" data-val="' + o.value + '">' +
        o.label + (o.meta ? ' <span class="text-micro cr-pop-meta">' + o.meta + '</span>' : '') +
        '</button>';
    }).join('');
  }
  html += '<button class="cr-pop-remove">Remove this filter</button>';

  _crShowPopover(targetEl, html, function(pop) {
    if (def.multi) {
      pop.querySelectorAll('input[type="checkbox"]').forEach(function(cb) {
        cb.onchange = function() {
          var val = this.getAttribute('data-val');
          var arr = Array.isArray(segment.values[clauseId]) ? segment.values[clauseId] : [];
          var idx = arr.indexOf(val);
          if (this.checked && idx === -1) arr.push(val);
          if (!this.checked && idx !== -1) arr.splice(idx, 1);
          segment.values[clauseId] = arr;
          this.parentNode.classList.toggle('selected', this.checked);
          _crSaveState(_crState);
          _crRerender(true); // re-render content only, keep popover
        };
      });
    } else {
      pop.querySelectorAll('[data-val]').forEach(function(btn) {
        btn.onclick = function() {
          segment.values[clauseId] = this.getAttribute('data-val');
          _crClosePopover();
          _crSaveState(_crState);
          _crRerender();
        };
      });
    }
    pop.querySelector('.cr-pop-remove').onclick = function() {
      segment.clauses = segment.clauses.filter(function(c) { return c !== clauseId; });
      delete segment.values[clauseId];
      _crClosePopover();
      _crSaveState(_crState);
      _crRerender();
    };
  });
}

function _crShowPopover(anchor, html, wire) {
  _crPopover = document.createElement('div');
  _crPopover.className = 'card card-s1 cr-pop';
  _crPopover.innerHTML = html;
  document.body.appendChild(_crPopover);
  var rect = anchor.getBoundingClientRect();
  var top = rect.bottom + window.scrollY + 6;
  var left = rect.left + window.scrollX;
  var popWidth = _crPopover.offsetWidth;
  if (left + popWidth > window.innerWidth - 8) left = window.innerWidth - popWidth - 8;
  _crPopover.style.top = top + 'px';
  _crPopover.style.left = left + 'px';
  if (wire) wire(_crPopover);
}

function _crRenderHeadline(result, compareResult) {
  var m = result.metrics;
  var dim = result.sampleSize < CR_SAMPLE_MIN;

  function tile(label, val, cls) {
    return '<div class="box stat' + (dim ? ' cr-tile-dim' : '') + '">' +
      '<div class="eyebrow">' + label + '</div>' +
      '<div class="value value-lg ' + cls + '">' + val + '</div>' +
      '</div>';
  }

  function tileCompare(label, valA, valB, clsA, clsB, delta, deltaCls) {
    return '<div class="box stat cr-tile-compare">' +
      '<div class="eyebrow">' + label + '</div>' +
      '<div class="cr-tile-trio">' +
      '<div class="stat"><div class="eyebrow">A</div><div class="value ' + clsA + '">' + valA + '</div></div>' +
      '<div class="stat"><div class="eyebrow">Δ</div><div class="value ' + deltaCls + '">' + delta + '</div></div>' +
      '<div class="stat"><div class="eyebrow">B</div><div class="value ' + clsB + '">' + valB + '</div></div>' +
      '</div></div>';
  }

  function pnlCol(v) { return v == null ? 'c-dim' : (v >= 0 ? 'c-pos' : 'c-neg'); }
  function deltaCol(v) { return v == null ? 'c-dim' : (v > 0 ? 'c-pos' : v < 0 ? 'c-neg' : 'text-strong'); }
  function wrCol2(v) {
    if (v == null) return 'c-dim';
    var c = wrColor(v);
    return c === 'var(--green)' ? 'c-pos' : c === 'var(--red)' ? 'c-neg' : 'text-strong';
  }

  var bb100Str = m.bb100 != null ? (m.bb100 > 0 ? '+' : '') + m.bb100 : '-';
  var bb100Cls = pnlCol(m.bb100);
  var wrStr = m.wr != null ? m.wr + '%' : '-';
  var wrCls = wrCol2(m.wr);

  if (!compareResult) {
    return '<div class="cr-headline">' +
      tile('Hands matched', result.sampleSize, 'c-gold') +
      tile('Sessions', result.sessions, 'text-strong') +
      tile('bb/100', bb100Str, bb100Cls) +
      tile('Win rate', wrStr, wrCls) +
      tile('VPIP', m.vpip != null ? m.vpip + '%' : '-', 'text-strong') +
      tile('PFR', m.pfr != null ? m.pfr + '%' : '-', 'text-strong') +
      '</div>';
  }

  var mB = compareResult.metrics;
  var bb100B = mB.bb100 != null ? (mB.bb100 > 0 ? '+' : '') + mB.bb100 : '-';
  var bb100BCls = pnlCol(mB.bb100);
  var bb100Delta = (m.bb100 != null && mB.bb100 != null) ? Math.round((m.bb100 - mB.bb100) * 10) / 10 : null;
  var bb100DeltaStr = bb100Delta == null ? '-' : (bb100Delta > 0 ? '+' : '') + bb100Delta;
  var bb100DeltaCls = deltaCol(bb100Delta);

  var wrDelta = (m.wr != null && mB.wr != null) ? m.wr - mB.wr : null;
  var wrBCls = wrCol2(mB.wr);

  return '<div class="cr-headline cr-headline-compare">' +
    tileCompare('Hands matched', result.sampleSize, compareResult.sampleSize, 'c-gold', 'c-gold', (result.sampleSize - compareResult.sampleSize), 'c-dim') +
    tileCompare('bb/100', bb100Str, bb100B, bb100Cls, bb100BCls, bb100DeltaStr, bb100DeltaCls) +
    tileCompare('Win rate', wrStr, mB.wr != null ? mB.wr + '%' : '-', wrCls, wrBCls, wrDelta != null ? (wrDelta > 0 ? '+' : '') + wrDelta + '%' : '-', 'c-dim') +
    tileCompare('VPIP', m.vpip != null ? m.vpip + '%' : '-', mB.vpip != null ? mB.vpip + '%' : '-', 'text-strong', 'text-strong', (m.vpip != null && mB.vpip != null) ? (m.vpip - mB.vpip > 0 ? '+' : '') + (m.vpip - mB.vpip) + '%' : '-', 'c-dim') +
    '</div>';
}

function _crRenderInsightCards(cards) {
  if (!cards.length) return '';
  return '<div class="ins-grid">' + cards.map(function(c) {
    return ins(c.sev, c.title, c.body, c.chips || []);
  }).join('') + '</div>';
}

function _crRerender(keepPopover) {
  if (!keepPopover) _crClosePopover();
  var host = document.getElementById('p-custom');
  if (host) _crRenderInto(host);
}

function _crRenderInto(container) {
  _crDestroyCharts();

  var resultA = runCustomReport(_crHands, _crState.A, _crClauseDefs);
  var resultB = _crState.compare ? runCustomReport(_crHands, _crState.B, _crClauseDefs) : null;

  var sentenceHtml = _crRenderSentence(_crState.A, 'A');
  if (_crState.compare) {
    sentenceHtml += '<div class="sentence-vs">vs</div>';
    sentenceHtml += _crRenderSentence(_crState.B, 'B');
  }

  // Nothing renders until the user has narrowed the report with a clause that
  // actually has a value chosen (an unset clause filters nothing, so showing
  // results for it would just be the whole sample and read as misleading).
  function _crSegmentHasValue(seg) {
    if (!seg || !seg.clauses) return false;
    return seg.clauses.some(function(c) {
      var v = seg.values[c];
      return !(v == null || (Array.isArray(v) && !v.length));
    });
  }
  var hasSelection = _crSegmentHasValue(_crState.A) ||
    (_crState.compare && _crSegmentHasValue(_crState.B));

  var headlineHtml = '';
  var cardsHtml = '';
  var showCharts = false;

  if (!hasSelection) {
    headlineHtml = '<div class="text-body">Add a clause above to build your report.</div>';
  } else {
    headlineHtml = _crRenderHeadline(resultA, resultB);

    var cards = [];
    if (_crState.compare) {
      if (resultA.sampleSize < CR_SAMPLE_MIN || resultB.sampleSize < CR_SAMPLE_MIN) {
        var which = resultA.sampleSize < CR_SAMPLE_MIN ? 'A' : 'B';
        var n = resultA.sampleSize < CR_SAMPLE_MIN ? resultA.sampleSize : resultB.sampleSize;
        cards.push({
          sev: 'n',
          title: 'Not enough hands in segment ' + which,
          body: 'Segment ' + which + ' has ' + n + ' hands. Both segments need at least ' + CR_SAMPLE_MIN + ' to compare meaningfully.',
          chips: [{ v: n + ' / ' + CR_SAMPLE_MIN, hi: true }],
        });
      } else {
        var aCards = _crEvaluateRules(resultA, _crBaseline);
        var bCards = _crEvaluateRules(resultB, _crBaseline);
        aCards.forEach(function(c) { c.title = '[A] ' + c.title; });
        bCards.forEach(function(c) { c.title = '[B] ' + c.title; });
        cards = aCards.slice(0, 2).concat(bCards.slice(0, 2));
        for (var ci = 0; ci < CR_COMPARE_RULES.length; ci++) {
          var card = CR_COMPARE_RULES[ci].eval(resultA.metrics, resultB.metrics);
          if (card) cards.push(card);
        }
      }
    } else {
      cards = _crEvaluateRules(resultA, _crBaseline);
    }
    cardsHtml = _crRenderInsightCards(cards);

    showCharts = resultA.sampleSize >= CR_SAMPLE_MIN || (resultB && resultB.sampleSize >= CR_SAMPLE_MIN);
  }

  var chartsHtml = !showCharts ? '' : `<div class="section">
    <div class="section-head">Charts</div>
    <div class="row">
      <div class="container"><div class="eyebrow">bb/100 over time</div><canvas id="cr-trend"></canvas></div>
      <div class="container"><div class="eyebrow">bb/100 by position</div><canvas id="cr-position"></canvas></div>
    </div>
    <div class="row">
      <div class="container"><div class="eyebrow">Win rate by hand class</div><canvas id="cr-cards"></canvas></div>
      <div class="container"><div class="eyebrow">Action breakdown</div><canvas id="cr-actions"></canvas></div>
    </div>
  </div>`;

  container.innerHTML =
    panelHeader('Custom Report', 'Build your own report. Click any underlined word to change it. Add clauses to narrow further.') +
    section('Report Builder',
      `<div class="row between wrap cr-toolbar">
        <label class="check text-meta">
          <input type="checkbox" id="cr-compare-toggle"${_crState.compare ? ' checked' : ''}>
          <span>Compare two reports</span>
        </label>
        <button class="btn btn-ghost" id="cr-reset-btn">Reset filters</button>
      </div>
      <div class="box">${sentenceHtml}</div>
      ${headlineHtml}
      ${cardsHtml}`) +
    chartsHtml;

  container.querySelectorAll('.sentence-token').forEach(function(tok) {
    tok.onclick = function(e) {
      e.stopPropagation();
      _crOpenClausePopover(this, this.getAttribute('data-segment'), this.getAttribute('data-clause'));
    };
  });
  container.querySelectorAll('.sentence-add').forEach(function(btn) {
    btn.onclick = function(e) {
      e.stopPropagation();
      _crOpenAddClausePopover(this, this.getAttribute('data-segment'));
    };
  });

  var toggle = container.querySelector('#cr-compare-toggle');
  if (toggle) toggle.onchange = function() {
    _crState.compare = this.checked;
    if (_crState.compare && (!_crState.B || !_crState.B.clauses.length)) {
      _crState.B = {
        clauses: _crState.A.clauses.slice(),
        values: JSON.parse(JSON.stringify(_crState.A.values)),
      };
    }
    _crSaveState(_crState);
    _crRerender();
  };

  var reset = container.querySelector('#cr-reset-btn');
  if (reset) reset.onclick = function() {
    _crState = { compare: false, A: _crDefaultSegment(), B: _crDefaultSegment() };
    _crSaveState(_crState);
    _crRerender();
  };

  if (showCharts) _crRenderCharts(resultA, resultB);
}

function _crRenderCharts(resultA, resultB) {
  var colors = getChartColors();
  var dataA = resultA.charts;
  var dataB = resultB ? resultB.charts : null;

  var trendCanvas = document.getElementById('cr-trend');
  if (trendCanvas && dataA.trend.length >= 2) {
    var labelsT = dataA.trend.map(function(p) { return p.label; });
    var datasets = [{
      label: dataB ? 'A' : 'bb/100',
      data: dataA.trend.map(function(p) { return p.bb100; }),
      borderColor: colors.gold,
      backgroundColor: colors.gold + '22',
      borderWidth: 2,
      tension: 0.3,
      pointRadius: dataA.trend.length <= 15 ? 3 : 0,
      fill: true,
    }];
    if (dataB && dataB.trend.length >= 2) {
      var bSet = {};
      dataB.trend.forEach(function(p) { bSet[p.label] = p.bb100; });
      datasets.push({
        label: 'B',
        data: labelsT.map(function(l) { return bSet[l] != null ? bSet[l] : null; }),
        borderColor: colors.green,
        backgroundColor: 'transparent',
        borderWidth: 2,
        tension: 0.3,
        pointRadius: 0,
        spanGaps: true,
      });
    }
    _crCharts.push(createChart(trendCanvas, 'line', { labels: labelsT, datasets: datasets }, {
      legend: chartLegend(colors, !!dataB),
      tooltip: chartTooltip(colors, { label: function(c) { return ' ' + c.parsed.y + ' bb/100'; } }),
      scales: {
        x: chartXScale(colors, { maxTicksLimit: 6, maxRotation: 0 }),
        y: chartYScaleZeroLine(colors, { tickCallback: function(v) { return v + ''; } }),
      },
    }));
  } else if (trendCanvas) {
    trendCanvas.parentNode.innerHTML = '<div class="eyebrow">bb/100 over time</div><div class="text-body">Need at least 2 sessions of cash hands in this report.</div>';
  }

  var posCanvas = document.getElementById('cr-position');
  if (posCanvas) {
    var active = POSITION_ORDER.filter(function(p) { return dataA.byPosition[p] && dataA.byPosition[p].bb100 != null; });
    if (active.length >= 2) {
      var posVals = active.map(function(p) { return dataA.byPosition[p].bb100; });
      var posDatasets = [{
        label: dataB ? 'A' : 'bb/100',
        data: posVals,
        backgroundColor: posVals.map(function(v) { return (v >= 0 ? colors.green : colors.red) + '99'; }),
        borderColor: posVals.map(function(v) { return v >= 0 ? colors.green : colors.red; }),
        borderWidth: 1,
        borderRadius: 4,
      }];
      if (dataB) {
        posDatasets.push({
          label: 'B',
          data: active.map(function(p) { return dataB.byPosition[p] ? dataB.byPosition[p].bb100 : null; }),
          backgroundColor: colors.gold + '99',
          borderColor: colors.gold,
          borderWidth: 1,
          borderRadius: 4,
        });
      }
      _crCharts.push(createChart(posCanvas, 'bar', { labels: active, datasets: posDatasets }, {
        legend: chartLegend(colors, !!dataB),
        tooltip: chartTooltip(colors, { label: function(c) { return ' ' + c.parsed.y + ' bb/100'; } }),
        scales: { x: chartXScale(colors), y: chartYScaleZeroLine(colors, { tickCallback: function(v) { return v + ''; } }) },
      }));
    } else {
      posCanvas.parentNode.innerHTML = '<div class="eyebrow">bb/100 by position</div><div class="text-body">Need at least two positions with cash data in this report.</div>';
    }
  }

  var cardsCanvas = document.getElementById('cr-cards');
  if (cardsCanvas) {
    var classOrder = ['pairs', 'AK', 'broadway', 'suited', 'sc', 'connectors', 'ace-rag', 'junk'];
    var activeCls = classOrder.filter(function(c) { return dataA.byClass[c] && dataA.byClass[c].wr != null; });
    if (activeCls.length >= 2) {
      var labels = activeCls.map(function(c) { return dataA.byClass[c].label; });
      var vals = activeCls.map(function(c) { return dataA.byClass[c].wr; });
      var datasets = [{
        label: dataB ? 'A' : 'Win %',
        data: vals,
        backgroundColor: vals.map(function(v) { return (v >= 50 ? colors.green : colors.red) + '99'; }),
        borderColor: vals.map(function(v) { return v >= 50 ? colors.green : colors.red; }),
        borderWidth: 1,
        borderRadius: 4,
      }];
      if (dataB) {
        datasets.push({
          label: 'B',
          data: activeCls.map(function(c) { return dataB.byClass[c] ? dataB.byClass[c].wr : null; }),
          backgroundColor: colors.gold + '99',
          borderColor: colors.gold,
          borderWidth: 1,
          borderRadius: 4,
        });
      }
      _crCharts.push(createChart(cardsCanvas, 'bar', { labels: labels, datasets: datasets }, {
        legend: chartLegend(colors, !!dataB),
        tooltip: chartTooltip(colors, { label: function(c) { return ' ' + c.parsed.y + '% win rate'; } }),
        scales: { x: chartXScale(colors), y: chartYScale(colors, { max: 100, tickCallback: function(v) { return v + '%'; } }) },
      }));
    } else {
      cardsCanvas.parentNode.innerHTML = '<div class="eyebrow">Win rate by hand class</div><div class="text-body">Need at least two hand classes in this report.</div>';
    }
  }

  var actCanvas = document.getElementById('cr-actions');
  if (actCanvas) {
    if (resultA.metrics.actions) {
      var a = resultA.metrics.actions;
      var labels = ['Fold', 'Check', 'Call', 'Raise'];
      var vals = [a.fold, a.check, a.call, a.raise];
      _crCharts.push(new Chart(actCanvas, {
        type: 'doughnut',
        data: {
          labels: labels,
          datasets: [{
            data: vals,
            backgroundColor: [colors.dim, colors.amber, colors.gold, colors.green],
            borderColor: colors.border,
            borderWidth: 1,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          aspectRatio: 1.6,
          plugins: {
            legend: chartLegend(colors, true),
            tooltip: chartTooltip(colors, { label: function(c) { return ' ' + c.label + ': ' + c.parsed + '%'; } }),
          },
        },
      }));
    } else {
      actCanvas.parentNode.innerHTML = '<div class="eyebrow">Action breakdown</div><div class="text-body">No action data in this report.</div>';
    }
  }
}

// _crBuildClauseDefs and _crComputeBaseline together cost ~half a second at
// 20k+ hands. Cache by State.sessionEpoch so a fresh import or reset bumps the
// epoch and invalidates the cache.
var _crCachedEpoch = null;
function renderCustomReport(container, hands) {
  if (!container) return;
  _crHands = hands || [];
  var epoch = (typeof State !== 'undefined') ? State.sessionEpoch : null;
  if (_crCachedEpoch !== epoch || !_crClauseDefs || !_crBaseline) {
    _crClauseDefs = _crBuildClauseDefs(_crHands);
    _crBaseline = _crComputeBaseline(_crHands);
    _crCachedEpoch = epoch;
  }
  // On a fresh page load the report starts empty: no clauses, no results. We do
  // NOT auto-restore a prior query into a populated view. In-session building is
  // still kept (switching tabs and back keeps _crState), but the very first
  // render of a page load begins from the empty state.
  if (!_crState) _crState = { compare: false, A: _crDefaultSegment(), B: _crDefaultSegment() };
  // Drop saved clauses that no longer exist (defensive against schema changes).
  ['A', 'B'].forEach(function(seg) {
    if (!_crState[seg]) _crState[seg] = _crDefaultSegment();
    _crState[seg].clauses = _crState[seg].clauses.filter(function(c) {
      return _crClauseDefs.some(function(def) { return def.id === c; });
    });
  });

  _crRenderInto(container);
}

document.addEventListener('click', function(e) {
  if (!_crPopover) return;
  if (_crPopover.contains(e.target)) return;
  if (e.target.closest && e.target.closest('.sentence-token, .sentence-add')) return;
  _crClosePopover();
});
