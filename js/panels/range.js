// ── RANGE PANEL ───────────────────────────────────────────────────────────────
// Ranges and VPIP guides are sourced from js/engine/matrix.js via adviceFor().
// The panel auto-detects the dominant seat bucket in the viewed hands and
// benchmarks against that; user can pin a specific seat via the selector.

var _rangeVpipChart = null;

// Pick the most common seatBucket across `hands`. Returns { seats, seatBucket, count }.
function detectDominantBucket(hands) {
  var counts = {};
  for (var i = 0; i < hands.length; i++) {
    var h = hands[i];
    if (!h.seatBucket) continue;
    counts[h.seatBucket] = (counts[h.seatBucket] || 0) + 1;
  }
  var best = null, bestN = 0;
  for (var k in counts) {
    if (counts[k] > bestN) { bestN = counts[k]; best = k; }
  }
  if (!best) return { seats: null, seatBucket: null, count: 0 };
  var seats = parseInt(best, 10);
  return { seats: seats, seatBucket: best, count: bestN };
}

function renderRange(container, d, hands) {
  var gridR = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
  var rangePositions = ['All Positions', 'BB', 'SB', 'BTN', 'CO', 'HJ', 'LJ', 'MP', 'UTG', 'UTG+1'];
  var advisorOn = false;

  // Dominant bucket for the current hand set (auto-benchmark context).
  var currentBucket = detectDominantBucket(hands);
  // User-selected overrides (null = auto).
  var pinnedSeats = null;   // integer 2..9 or null

  function activeSeats() { return pinnedSeats || currentBucket.seats || 6; }

  // Return { range: Set|null, guide: {ideal,tight,loose,desc}|null, advice: {...} }
  // for a given position against the active seats benchmark.
  function benchmarkFor(position) {
    return adviceFor({
      seats: activeSeats(),
      position: position
    });
  }

  function buildKey(ri, ci) {
    var r1 = gridR[Math.min(ri, ci)];
    var r2 = gridR[Math.max(ri, ci)];
    if (ri === ci) return r1 + r1;
    return r1 + r2 + (ri < ci ? 's' : 'o');
  }

  function wrColor(w) {
    if (w <= 30) return 'rgb(190, 45, 45)';
    else if (w <= 45) { var t = (w - 30) / 15; return 'rgb(' + Math.round(190 + t * 30) + ',' + Math.round(45 + t * 90) + ',' + Math.round(45) + ')'; }
    else if (w <= 55) { var t2 = (w - 45) / 10; return 'rgb(' + Math.round(220 - t2 * 30) + ',' + Math.round(135 + t2 * 30) + ',' + Math.round(45) + ')'; }
    else if (w <= 70) { var t3 = (w - 55) / 15; return 'rgb(' + Math.round(190 - t3 * 120) + ',' + Math.round(165 - t3 * 10) + ',' + Math.round(45 + t3 * 10) + ')'; }
    return 'rgb(50, 170, 65)';
  }

  function buildRangeContent(filteredHands, posLabel) {
    var rd = analyse(filteredHands);
    var rMap = rd.rangeMap;
    var maxP = 0;
    Object.keys(rMap).forEach(function(k) {
      if (rMap[k].played > maxP) maxP = rMap[k].played;
    });
    function playedColor(played) {
      if (played === 0) return '#111a12';
      var ratio = played / maxP;
      if (ratio <= 0.15) return '#1a2e1e';
      if (ratio <= 0.35) return '#24422a';
      if (ratio <= 0.6) return '#2e5835';
      if (ratio <= 0.8) return '#3a7a42';
      return 'rgb(50, 170, 65)';
    }
    // Advisor: determine recommended set for this position (from matrix, bucketed)
    var recSet = null;
    var activeBench = null;
    if (advisorOn && posLabel && posLabel !== 'all') {
      activeBench = benchmarkFor(posLabel);
      recSet = activeBench.recommendedRange || null;
    }

    // ── Pure data: build the per-cell metadata up front, no DOM strings yet ──
    // Each cell ends up shaped:
    //   { key, status: 'played'|'unplayed-dealt'|'undealt', advCls,
    //     wrBg, freqBg, wrTip, freqTip, played, dealt, won, wrPct }
    function buildCellData() {
      var cells = [];
      var overplayed = [];
      var underplayed = [];
      var matchCount = 0;
      for (var r = 0; r < 13; r++) {
        for (var c = 0; c < 13; c++) {
          var key = buildKey(r, c);
          var data = rMap[key];
          var advCls = '';
          if (recSet) {
            var didPlay = data && data.played > 0;
            var inRec = recSet.has(key);
            if (didPlay && !inRec) { advCls = ' rc-over'; overplayed.push(key); }
            else if (!didPlay && inRec) { advCls = ' rc-under'; underplayed.push(key); }
            else if (didPlay && inRec) { advCls = ' rc-match'; matchCount++; }
          }
          if (data && data.played > 0) {
            var wrPct = pct(data.won, data.played);
            cells.push({
              key: key,
              status: 'played',
              advCls: advCls,
              wrBg: wrPct !== null ? wrColor(wrPct) : '#1e3020',
              freqBg: playedColor(data.played),
              wrTip: key + ' | Win: ' + (wrPct !== null ? wrPct + '%' : 'n/a') + ' (' + data.won + '/' + data.played + ' played, ' + data.dealt + ' dealt) · click to see hands',
              freqTip: key + ' | Played ' + data.played + ' of ' + data.dealt + ' dealt · click to see hands',
            });
          } else if (data && data.dealt > 0) {
            cells.push({
              key: key,
              status: 'unplayed-dealt',
              advCls: advCls,
              wrTip: key + ' | Dealt ' + data.dealt + ' times but never played · click to see hands',
              freqTip: key + ' | Dealt ' + data.dealt + ' times but never played · click to see hands',
            });
          } else {
            var cellLabel = (r === c) ? 'Pair' : (r < c) ? 'Suited' : 'Offsuit';
            cells.push({
              key: key,
              status: 'undealt',
              advCls: advCls,
              wrTip: key + ' | Not yet dealt (' + cellLabel + ')',
              freqTip: key + ' | Not yet dealt (' + cellLabel + ')',
            });
          }
        }
      }
      return {
        cells: cells,
        overplayed: overplayed,
        underplayed: underplayed,
        matchCount: matchCount,
      };
    }

    var cellInfo = buildCellData();
    var overplayed = cellInfo.overplayed;
    var underplayed = cellInfo.underplayed;
    var matchCount = cellInfo.matchCount;

    // ── Render the data into HTML ──
    var wrGrid = '';
    var freqGrid = '';
    for (var ci = 0; ci < cellInfo.cells.length; ci++) {
      var cell = cellInfo.cells[ci];
      if (cell.status === 'played') {
        wrGrid += '<div class="rc' + cell.advCls + '" style="background:' + cell.wrBg + ';cursor:pointer;" data-key="' + cell.key + '" data-tip="' + cell.wrTip + '"><span>' + cell.key + '</span></div>';
        freqGrid += '<div class="rc' + cell.advCls + '" style="background:' + cell.freqBg + ';cursor:pointer;" data-key="' + cell.key + '" data-tip="' + cell.freqTip + '"><span>' + cell.key + '</span></div>';
      } else if (cell.status === 'unplayed-dealt') {
        wrGrid += '<div class="rc rc-unseen' + cell.advCls + '" data-key="' + cell.key + '" data-tip="' + cell.wrTip + '"><span>' + cell.key + '</span></div>';
        freqGrid += '<div class="rc rc-unseen' + cell.advCls + '" data-key="' + cell.key + '" data-tip="' + cell.freqTip + '"><span>' + cell.key + '</span></div>';
      } else {
        wrGrid += '<div class="rc rc-unseen' + cell.advCls + '" data-tip="' + cell.wrTip + '"><span>' + cell.key + '</span></div>';
        freqGrid += '<div class="rc rc-unseen' + cell.advCls + '" data-tip="' + cell.freqTip + '"><span>' + cell.key + '</span></div>';
      }
    }
    var seen = Object.keys(rMap).filter(function(k) { return rMap[k].dealt > 0; }).length;
    var totalCombos = 169;
    var legend1 = '<div class="range-legend">' +
      '<div class="leg"><div class="leg-sw rc-unseen"></div>Not dealt</div>' +
      '<div class="leg"><div class="leg-sw leg-sw-bad"></div>&lt;30% win</div>' +
      '<div class="leg"><div class="leg-sw leg-sw-mid"></div>~50% win</div>' +
      '<div class="leg"><div class="leg-sw leg-sw-good"></div>&gt;70% win</div>' +
      '</div>';
    var legend2 = '<div class="range-legend">' +
      '<div class="leg"><div class="leg-sw rc-unseen"></div>Not played</div>' +
      '<div class="leg"><div class="leg-sw leg-sw-low"></div>Rarely</div>' +
      '<div class="leg"><div class="leg-sw leg-sw-med"></div>Sometimes</div>' +
      '<div class="leg"><div class="leg-sw leg-sw-high"></div>Most played</div>' +
      '</div>';
    var rangeIns = [];
    var bestKey = null, bestWr = -1, worstKey = null, worstWr = 101, mostPlayed = null, mostCount = 0;
    Object.keys(rMap).forEach(function(k) {
      var rm = rMap[k];
      if (rm.played >= 2) {
        var w2 = pct(rm.won, rm.played);
        if (w2 !== null && w2 > bestWr) { bestWr = w2; bestKey = k; }
        if (w2 !== null && w2 < worstWr) { worstWr = w2; worstKey = k; }
      }
      if (rm.dealt > mostCount) { mostCount = rm.dealt; mostPlayed = k; }
    });
    if (bestKey) {
      var exBest = findExampleHand(function(h) { return parseHoleKey(h.hole) === bestKey && h.outcome && h.outcome.result === 'won'; });
      rangeIns.push(insWithExample('g', 'Best Hand', 'Your strongest combo so far is ' + bestKey + ' at ' + bestWr + '% win rate. Sample size matters though.', [{ v: bestKey, hi: true }, { v: bestWr + '% win' }], exBest, 'Here is a hand where you won with ' + bestKey + '. This combo has been your most profitable - keep playing it confidently but watch for sample size.'));
    }
    if (worstKey && worstKey !== bestKey) {
      var exWorst = findExampleHand(function(h) { return parseHoleKey(h.hole) === worstKey && h.outcome && h.outcome.result !== 'won'; });
      rangeIns.push(insWithExample('r', 'Worst Hand', worstKey + ' has been your weakest at ' + worstWr + '% win rate. Consider tightening or adjusting play with this hand.', [{ v: worstKey, hi: true }, { v: worstWr + '% win' }], exWorst, 'This hand with ' + worstKey + ' did not go well. Review whether you are overplaying this combo or getting into bad spots post-flop.'));
    }
    if (mostPlayed) {
      var exMost = findExampleHand(function(h) { return parseHoleKey(h.hole) === mostPlayed; });
      rangeIns.push(insWithExample('n', 'Most Dealt', 'You have been dealt ' + mostPlayed + ' the most (' + mostCount + ' times). ' + (rMap[mostPlayed].played < mostCount / 2 ? 'You fold it more than half the time.' : 'You play it frequently.'), [{ v: mostPlayed, hi: true }, { v: mostCount + ' dealt' }], exMost, 'Here is a hand where you were dealt ' + mostPlayed + '. ' + (rMap[mostPlayed].played < mostCount / 2 ? 'You fold this hand often - make sure you are not being too tight with it in good positions.' : 'You play this hand frequently - make sure you are not overvaluing it from bad positions.')));
    }
    var coveragePct = Math.round(seen / totalCombos * 100);
    rangeIns.push(ins('n', 'Coverage', 'You have seen ' + seen + ' of ' + totalCombos + ' possible hand combos (' + coveragePct + '%). The more hands you play, the more complete this picture becomes.', [{ v: seen + '/' + totalCombos + ' combos' }]));

    // Position-specific coaching cards
    if (posLabel && posLabel !== 'all') {
      var totalDealt = 0, totalPlayedPos = 0, totalWon = 0;
      Object.keys(rMap).forEach(function(k) { totalDealt += rMap[k].dealt; totalPlayedPos += rMap[k].played; totalWon += rMap[k].won; });
      var vpipPctPos = totalDealt > 0 ? Math.round(totalPlayedPos / totalDealt * 100) : 0;
      var wrPctPos = totalPlayedPos > 0 ? Math.round(totalWon / totalPlayedPos * 100) : 0;
      var guide = benchmarkFor(posLabel).vpipGuide;
      if (guide && totalDealt >= 3) {
        var exFolded = findExampleHand(function(h) {
          return (h.position || '?') === posLabel && h.outcome && h.outcome.result === 'folded';
        });
        var exPlayed = findExampleHand(function(h) {
          return (h.position || '?') === posLabel && !(h.outcome && h.outcome.result === 'folded');
        });
        var exPos = findExampleHand(function(h) {
          return (h.position || '?') === posLabel;
        });
        rangeIns.push(ins('n', posLabel + ' Guide', guide.desc, [{ v: 'Ideal VPIP: ' + guide.ideal }]));
        if (vpipPctPos < guide.tight) {
          rangeIns.push(insWithExample('r', 'Too Tight from ' + posLabel, 'You are playing ' + vpipPctPos + '% of hands from ' + posLabel + ', which is below the typical range of ' + guide.ideal + '. You may be folding profitable hands. Consider opening wider with suited connectors and broadways.', [{ v: vpipPctPos + '% VPIP' }, { v: guide.ideal + ' ideal' }], exFolded, 'Here are hands you folded from ' + posLabel + '. Some of these may have been profitable opens given your position.'));
        } else if (vpipPctPos > guide.loose) {
          rangeIns.push(insWithExample('r', 'Too Loose from ' + posLabel, 'You are playing ' + vpipPctPos + '% of hands from ' + posLabel + ', above the typical range of ' + guide.ideal + '. Tighten up to avoid getting into marginal spots out of position or with weak holdings.', [{ v: vpipPctPos + '% VPIP' }, { v: guide.ideal + ' ideal' }], exPlayed, 'Here are hands you played from ' + posLabel + '. Review whether some of these could have been folded pre-flop.'));
        } else {
          rangeIns.push(insWithExample('g', posLabel + ' VPIP on Track', 'You are playing ' + vpipPctPos + '% of hands from ' + posLabel + ', which is within the typical range of ' + guide.ideal + '. Keep it up.', [{ v: vpipPctPos + '% VPIP' }, { v: guide.ideal + ' ideal' }], exPlayed, 'Here are hands you played from ' + posLabel + '. Your range selection looks solid for this position.'));
        }
        if (totalPlayedPos >= 5) {
          rangeIns.push(insWithExample(wrPctPos >= 50 ? 'g' : wrPctPos >= 35 ? 'n' : 'r', posLabel + ' Win Rate', 'You are winning ' + wrPctPos + '% of hands you play from ' + posLabel + ' (' + totalWon + '/' + totalPlayedPos + ').', [{ v: wrPctPos + '% win' }, { v: totalPlayedPos + ' played' }], exPos, 'Here are hands from ' + posLabel + '. Review your play patterns to see what is working and where you can improve.'));
        }
      }
    }

    // Advisor deviation insights
    if (recSet) {
      var totalInRange = recSet.size;
      var fitPct = totalInRange > 0 ? Math.round(matchCount / totalInRange * 100) : 0;
      rangeIns.push(ins(fitPct >= 70 ? 'g' : fitPct >= 40 ? 'a' : 'r', 'Range Fit: ' + fitPct + '%', 'You play ' + matchCount + ' of ' + totalInRange + ' recommended hands for ' + posLabel + '. ' + overplayed.length + ' overplayed, ' + underplayed.length + ' underplayed.', [{ v: matchCount + '/' + totalInRange + ' match', hi: true }, { v: overplayed.length + ' over' }, { v: underplayed.length + ' under' }]));
      if (overplayed.length > 0) {
        var overList = overplayed.slice(0, 8).join(', ') + (overplayed.length > 8 ? ' +' + (overplayed.length - 8) + ' more' : '');
        rangeIns.push(ins('r', 'Overplayed Hands', 'You play these hands from ' + posLabel + ' but they are not in the standard TAG range: ' + overList + '. Consider folding these to tighten up.', [{ v: overplayed.length + ' hands', hi: true }]));
      }
      if (underplayed.length > 0) {
        var underList = underplayed.slice(0, 8).join(', ') + (underplayed.length > 8 ? ' +' + (underplayed.length - 8) + ' more' : '');
        rangeIns.push(ins('a', 'Underplayed Hands', 'These are in the recommended range for ' + posLabel + ' but you are folding them: ' + underList + '. Consider opening these.', [{ v: underplayed.length + ' hands', hi: true }]));
      }
    }

    // Append engine insights for range panel
    var engineRangeIns = InsightEngine.forPanel('range', 3);
    for (var eri = 0; eri < engineRangeIns.length; eri++) {
      rangeIns.push(renderRuleInsight(engineRangeIns[eri]));
    }

    return { seen: seen, totalCombos: totalCombos, wrGrid: wrGrid, freqGrid: freqGrid, legend1: legend1, legend2: legend2, rangeIns: rangeIns, rMap: rMap };
  }

  function renderRangeGrids(rc) {
    var gridContainer = document.getElementById('range-grids');
    if (!gridContainer) return;
    var advLegend = advisorOn ? '<div class="range-legend range-legend-adv">' +
      '<div class="leg"><div class="leg-sw leg-sw-match"></div>Match</div>' +
      '<div class="leg"><div class="leg-sw leg-sw-over"></div>Overplayed</div>' +
      '<div class="leg"><div class="leg-sw leg-sw-under"></div>Underplayed</div>' +
      '</div>' : '';
    gridContainer.innerHTML =
      '<div class="meta-text mb-20">' + rc.seen + ' of ' + rc.totalCombos + ' hand combos seen · hover any cell for detail</div>' +
      '<div class="two-col">' +
      '<div><div class="sec-subtitle mt-0">Win Rate by Hand</div>' + rc.legend1 + advLegend + '<div class="range-grid-sm">' + rc.wrGrid + '</div></div>' +
      '<div><div class="sec-subtitle mt-0">Hands Played</div>' + rc.legend2 + advLegend + '<div class="range-grid-sm">' + rc.freqGrid + '</div></div>' +
      '</div><div class="divider"></div><div class="ins-grid">' + rc.rangeIns.join('') + '</div>';
  }

  // Render a single bar chart: one bar per position showing the user's actual
  // VPIP for that position at the active seat size. Bars are coloured by how
  // far the actual sits from the target band (guide.tight..guide.loose):
  //   green = within band, amber = close (within ~5 pts), red = significantly outside.
  // The target band is drawn as a faint range bar behind each actual bar so the
  // comparison is obvious without needing a separate chart per seat.
  function renderVpipChart(posLabel) {
    if (_rangeVpipChart) { _rangeVpipChart.destroy(); _rangeVpipChart = null; }
    var canvas = document.getElementById('range-vpip-canvas');
    if (!canvas) return;

    var seats = activeSeats();
    var seatEntry = matrixForSeats(seats);
    var positions = seatEntry && seatEntry.positions ? seatEntry.positions.slice() : ['UTG', 'MP', 'CO', 'BTN', 'SB', 'BB'];

    var colors = getChartColors();
    var labels = [];
    var actualData = [];
    var bandData = [];
    var actualColors = [];
    var actualBorders = [];

    for (var pi = 0; pi < positions.length; pi++) {
      var p = positions[pi];
      var guide = seatEntry && seatEntry.guideByPos ? seatEntry.guideByPos[p] : null;
      if (!guide) continue;
      labels.push(p);
      bandData.push([guide.tight, guide.loose]);

      var pm = d.posMap[p];
      var vpip = pm && pm.hands > 0 ? pct(pm.vpip, pm.hands) : null;
      actualData.push(vpip);

      // Colour bands: green inside [tight, loose], amber within 5 pts of either
      // edge, red further out. null = grey (no data).
      var fill, border;
      if (vpip === null) {
        fill = colors.dim + '55';
        border = colors.dim;
      } else if (vpip >= guide.tight && vpip <= guide.loose) {
        fill = colors.green + 'cc';
        border = colors.green;
      } else {
        var dist = vpip < guide.tight ? guide.tight - vpip : vpip - guide.loose;
        if (dist <= 5) {
          fill = colors.amber + 'cc';
          border = colors.amber;
        } else {
          fill = colors.red + 'cc';
          border = colors.red;
        }
      }
      actualColors.push(fill);
      actualBorders.push(border);
    }

    _rangeVpipChart = createChart(canvas, 'bar', {
      labels: labels,
      datasets: [
        {
          label: 'Target Band',
          data: bandData,
          backgroundColor: colors.dim + '33',
          borderColor: colors.border,
          borderWidth: 1,
          barPercentage: 0.9,
          categoryPercentage: 0.8,
          order: 2
        },
        {
          label: 'Your VPIP',
          data: actualData,
          backgroundColor: actualColors,
          borderColor: actualBorders,
          borderWidth: 2,
          barPercentage: 0.5,
          categoryPercentage: 0.8,
          order: 1
        }
      ]
    }, {
      aspectRatio: 2.5,
      legend: chartLegend(colors),
      tooltip: chartTooltip(colors, {
        callbacks: {
          label: function(ctx) {
            if (ctx.datasetIndex === 0) {
              var raw = ctx.raw;
              return 'Target: ' + raw[0] + '-' + raw[1] + '%';
            }
            return 'Your VPIP: ' + (ctx.raw !== null ? ctx.raw + '%' : 'no data');
          }
        }
      }),
      scales: {
        x: chartXScale(colors),
        y: chartYScale(colors, { max: 80, tickCallback: function(v) { return v + '%'; } })
      }
    });
  }

  function refreshRange() {
    var pos = document.getElementById('range-pos-filter').value;
    var filtered = (pos === 'all') ? hands : hands.filter(function(h) { return (h.position || '?') === pos; });
    var newRc = buildRangeContent(filtered, pos);
    renderRangeGrids(newRc);
    renderVpipChart(pos);
    // Update advisor toggle state
    var advBtn = document.getElementById('range-advisor-btn');
    if (advBtn) {
      advBtn.classList.toggle('active', advisorOn);
      advBtn.textContent = advisorOn ? 'Advisor On' : 'Advisor Off';
    }
    // Disable advisor when All Positions selected
    if (advBtn) {
      advBtn.disabled = (pos === 'all');
      if (pos === 'all') advBtn.classList.remove('active');
    }
  }

  var rc = buildRangeContent(hands, 'all');
  var posOpts = rangePositions.map(function(p) {
    return '<option value="' + (p === 'All Positions' ? 'all' : p) + '">' + p + '</option>';
  }).join('');

  // Seat selector for benchmark context.
  var seatBucketCounts = {};
  for (var ri = 0; ri < hands.length; ri++) {
    var rh = hands[ri];
    if (rh.seatBucket) seatBucketCounts[rh.seatBucket] = (seatBucketCounts[rh.seatBucket] || 0) + 1;
  }
  var seatKeys = Object.keys(seatBucketCounts).sort();
  var seatOpts = '<option value="auto">Auto (' + (currentBucket.seatBucket || '-') + ')</option>' +
    seatKeys.map(function(k) { return '<option value="' + k + '">' + k + ' (' + seatBucketCounts[k] + ')</option>'; }).join('');

  container.innerHTML =
    '<div class="panel-title">Range</div>' +
    '<div class="panel-desc">Full 13x13 hand grid with win rate for every combo, benchmarked against table size.</div>' +
    renderBucketBanner() +
    '<div class="p-row"><div class="flex-gap-6 mb-16">' +
    '<select id="range-pos-filter" class="table-filter">' + posOpts + '</select>' +
    '<select id="range-seat-filter" class="table-filter">' + seatOpts + '</select>' +
    '<button id="range-advisor-btn" class="advisor-btn" disabled>Advisor Off</button>' +
    '</div>' +
    '<div id="range-bench-notes"></div>' +
    '<div id="range-vpip-chart-wrap">' +
    '<div class="sec-subtitle mt-0">VPIP by Position vs Target</div>' +
    '<canvas id="range-vpip-canvas" height="160"></canvas></div>' +
    '<div id="range-grids"></div></div>';
  renderRangeGrids(rc);
  renderVpipChart('all');
  renderBenchNotes();

  // Bucket banner (describes the auto-detected benchmark)
  function renderBucketBanner() {
    if (!currentBucket.seatBucket) return '';
    var seatLbl = currentBucket.seatBucket;
    var shareTxt = '';
    if (hands.length > 0) {
      var share = Math.round((currentBucket.count / hands.length) * 100);
      shareTxt = ' · ' + share + '% of viewed hands';
    }
    return '<div class="p-row"><div class="filter-banner" id="range-bucket-banner">Benchmark: ' + seatLbl + shareTxt + '</div></div>';
  }

  // Notes block describing the active (seats, position) advice
  function renderBenchNotes() {
    var notesEl = document.getElementById('range-bench-notes');
    if (!notesEl) return;
    var seats = activeSeats();
    var seatEntry = matrixForSeats(seats);
    if (!seatEntry) { notesEl.innerHTML = ''; return; }
    var parts = [];
    parts.push('<div class="sec-subtitle mt-0">' + seats + '-handed</div>');
    parts.push('<div class="desc-text">' + seatEntry.notes + '</div>');
    parts.push('<div class="desc-text mt-6 text-muted">Open ' + seatEntry.openRaise + ' · 3-bet ' + seatEntry.threeBet + ' · c-bet ' + seatEntry.cbetFreq + '</div>');
    notesEl.innerHTML = '<div class="p-row">' + parts.join('') + '</div>';
  }

  // Advisor toggle
  document.getElementById('range-advisor-btn').onclick = function() {
    var pos = document.getElementById('range-pos-filter').value;
    if (pos === 'all') return;
    advisorOn = !advisorOn;
    refreshRange();
  };

  // Position filter change handler
  document.getElementById('range-pos-filter').onchange = function() {
    refreshRange();
  };

  // Seat bucket selector
  document.getElementById('range-seat-filter').onchange = function() {
    var v = this.value;
    pinnedSeats = (v === 'auto') ? null : parseInt(v, 10);
    refreshRange();
    renderBenchNotes();
  };

  // Range cell click: show hand list for that combo
  container.addEventListener('click', function(e) {
    var cell = e.target.closest('.rc[data-key]');
    if (!cell) return;
    var key = cell.getAttribute('data-key');
    if (!key) return;
    var posFilter = document.getElementById('range-pos-filter').value;
    var baseHands = (posFilter === 'all') ? hands : hands.filter(function(h) { return (h.position || '?') === posFilter; });
    var matched = baseHands.filter(function(h) { return parseHoleKey(h.hole) === key; });
    if (!matched.length) return;
    var currentRc = buildRangeContent(baseHands);
    var rm = currentRc.rMap[key];
    var wr2 = rm && rm.played > 0 ? pct(rm.won, rm.played) : null;

    var existing = document.getElementById('example-hand-modal');
    if (existing) existing.remove();
    var overlay = document.createElement('div');
    overlay.id = 'example-hand-modal';
    overlay.className = 'modal-overlay';
    overlay.onclick = function(ev) { if (ev.target === overlay) closeModal(); };
    var box = document.createElement('div');
    box.className = 'modal-box';
    box.style.position = 'relative';
    box.style.maxHeight = '80vh';
    box.style.overflowY = 'auto';
    var summary = '<div class="modal-title">' + key + '</div>' +
      '<div class="mb-16">' + matched.length + ' hands' +
      (rm ? ' · played ' + rm.played + ' of ' + rm.dealt + ' dealt' : '') +
      (wr2 !== null ? ' · ' + wr2 + '% win rate' : '') + '</div>';
    var rows = matched.map(function(h, idx) {
      var myActs = getActsSummary(h);
      var res = renderResult(h, 'span', 'saved-res');
      return '<div class="range-hand-row" data-ridx="' + idx + '">' +
        '<div class="range-hand-row-top">' +
        '<div class="range-hand-row-side">' +
        '<span class="range-hand-row-pos">' + (h.position || '?') + '</span>' +
        '<span class="range-hand-row-hole">' + (h.hole ? h.hole.join(' ') : '??') + '</span>' +
        '<span class="range-hand-row-board">' + (h.board && h.board.length ? h.board.join(' ') : '-') + '</span>' +
        '</div>' +
        '<div class="range-hand-row-side">' +
        '<span class="range-hand-row-actions">' + myActs + '</span>' +
        res + '</div></div></div>';
    }).join('');
    box.innerHTML = '<button class="modal-close" id="modal-close-btn">&times;</button>' +
      summary + '<div class="mt-12">' + rows + '</div>';
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    requestAnimationFrame(function() { overlay.classList.add(CSS.SHOW); });
    document.getElementById('modal-close-btn').onclick = closeModal;
    box.querySelectorAll('.range-hand-row').forEach(function(row) {
      row.onclick = function() {
        var idx = parseInt(row.getAttribute('data-ridx'));
        if (!isNaN(idx) && matched[idx]) showExampleHandModal(matched[idx]);
      };
    });
  });
}
