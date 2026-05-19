// ── ALL-IN EV PANEL (Luck Tracker) ────────────────────────────────────────────

var _allinChart = null;
var _allinHands = null;
// Cache the candidate-detection pass keyed by the filtered hands array. Walking
// 20k+ hands every time the user clicks back into the panel is the freeze.
var _allinCandidatesFor = null;
var _allinCandidates = null;

// ── Parse reveals from action log ────────────────────────────────────────────
function parseReveals(actions) {
  var results = [];
  // Match both normalized (T♠) and raw (10spades) card formats
  var CARD_RE = /(\d{1,2}|[AKQJTakqjt])([♠♥♦♣]|[a-z]+)/g;

  for (var i = 0; i < (actions || []).length; i++) {
    var raw = (actions[i] || '').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&');
    if (raw.indexOf('>>') === 0) continue;
    var line = raw.replace(/^\s+/, '').trim();
    var revealMatch = line.match(/^(.+?):\s+(reveals|won .+ with)\s+\[([^\]]+)\]/);
    if (!revealMatch) continue;

    var playerName = revealMatch[1].trim();
    var cardsStr = revealMatch[3];
    var cards = [];
    var m;
    while ((m = CARD_RE.exec(cardsStr)) !== null) {
      var rank = m[1];
      var suitPart = m[2];
      if (rank === '10') rank = 'T';
      // Already a Unicode suit symbol - use directly
      if (suitPart.length === 1 && '♠♥♦♣'.indexOf(suitPart) !== -1) {
        cards.push(rank + suitPart);
      } else {
        // Raw suit word - convert via SUIT_WORD
        var suit = SUIT_WORD[suitPart.toLowerCase()];
        if (suit) cards.push(rank + suit);
      }
    }
    CARD_RE.lastIndex = 0;

    if (cards.length === 2) {
      var alreadyHave = false;
      for (var j = 0; j < results.length; j++) {
        if (results[j].name === playerName) { alreadyHave = true; break; }
      }
      if (!alreadyHave) results.push({ name: playerName, hole: cards.map(normCardCode) });
    }
  }
  return results;
}

// ── Detect all-in hands (fast - no equity calc) ─────────────────────────────
function detectAllInCandidates(hands) {
  var results = [];

  for (var hi = 0; hi < hands.length; hi++) {
    var h = hands[hi];
    if (!h.hole || h.hole.length !== 2) continue;
    if (!h.actions || !h.actions.length) continue;
    if (!h.outcome) continue;
    if (h.outcome.result === 'folded') continue;

    var acts = parseActions(h.actions);
    var allInStreet = null;
    var allInFound = false;
    var allInCalled = false;

    var heroInAllIn = false;
    for (var ai = 0; ai < acts.length; ai++) {
      if (isAllInAction(acts, ai)) {
        var a = acts[ai];
        allInFound = true;
        allInStreet = a.street;
        if (a.isMe) heroInAllIn = true;
        for (var bi = ai + 1; bi < acts.length; bi++) {
          var b = acts[bi];
          if (b.street !== a.street) break;
          if (b.type === 'call' || b.type === 'raise') {
            allInCalled = true;
            break;
          }
        }
        if (allInCalled) break;
      }
    }

    if (!allInFound || !allInCalled || !heroInAllIn) continue;
    if (allInStreet === 'River') continue;

    var reveals = parseReveals(h.actions);
    if (!reveals.length) continue;

    var heroHole = [normCardCode(h.hole[0]), normCardCode(h.hole[1])];

    // Find hero's name so we can exclude their reveal from opponents
    var heroName = null;
    for (var ni = 0; ni < acts.length; ni++) {
      if (acts[ni].isMe) { heroName = acts[ni].author; break; }
    }

    var opponentHoles = [];
    for (var ri = 0; ri < reveals.length; ri++) {
      if (reveals[ri].name !== heroName) {
        opponentHoles.push(reveals[ri].hole);
      }
    }
    if (!opponentHoles.length) continue;

    var streetIdx = { 'Preflop': 0, 'Flop': 3, 'Turn': 4, 'River': 5 };
    var boardSlice = streetIdx[allInStreet] || 0;
    var fullBoard = (h.board || []).map(normCardCode);
    var boardAtAllIn = fullBoard.slice(0, boardSlice);

    var potAtAllIn = 0;
    var pastAllIn = false;
    for (var pi = 0; pi < acts.length; pi++) {
      var pa = acts[pi];
      if (pa.type === 'won') continue;
      if (pa.amount) potAtAllIn += pa.amount;
      if (pastAllIn && (pa.type === 'call' || pa.type === 'raise')) break;
      if (isAllInAction(acts, pi)) pastAllIn = true;
    }
    if (potAtAllIn === 0) potAtAllIn = h.pot || 0;

    var heroInvested = getInvested(h);
    var actualWon = h.outcome.result === 'won' ? ((h.outcome.amount || 0) - heroInvested) : -heroInvested;

    results.push({
      hand: h,
      street: allInStreet,
      heroHole: heroHole,
      opponents: opponentHoles,
      boardAtAllIn: boardAtAllIn,
      fullBoard: fullBoard,
      potAtAllIn: potAtAllIn,
      heroInvested: heroInvested,
      actualResult: actualWon,
      isCash: isCashHand(h),
      timestamp: h.timestamp || 0,
      equity: null,
      fairShare: null,
      expectedValue: null,
      evDiff: null
    });
  }

  results.sort(function (a, b) { return a.timestamp - b.timestamp; });
  return results;
}

// Multiway equity now flows through simulateStreet in equity-monte-carlo.js.

// ── Card display - uses shared displayCard/displayCards from helpers.js ───────

// ── Render panel (instant - no simulation) ───────────────────────────────────
function renderAllIn(container, d, hands) {
  if (_allinChart) { _allinChart.destroy(); _allinChart = null; }

  // Reuse last detection when the filtered set hasn't changed identity (the
  // upstream cache rebuilds the array only when the filter key changes).
  if (_allinCandidatesFor === hands && _allinCandidates) {
    _allinHands = _allinCandidates;
  } else {
    _allinHands = detectAllInCandidates(hands);
    _allinCandidatesFor = hands;
    _allinCandidates = _allinHands;
  }

  if (!_allinHands.length) {
    container.innerHTML = '<div class="panel-title">All-In EV</div>' +
      '<div class="panel-desc">Tracks every all-in showdown to measure luck vs skill.</div>' +
      '<div class="panel-verdict">No all-in showdown hands found yet. When you go all-in and both players show cards, those hands appear here with equity calculations.</div>';
    return;
  }

  var html = '<div class="panel-title">All-In EV</div>';
  html += '<div class="panel-desc">Compares actual results vs expected value at all-in showdowns to measure variance.</div>';

  // Verdict + section story (All-in Pressure). Reads d.facedAllin / foldAllin
  // / callAllin / wonAllin so it works without running the Monte Carlo step.
  // Reuses the cached d from getFilteredAnalysis() rather than running
  // analyse(hands) again — that second pass was a full 20k-hand walk.
  if (typeof Sections !== 'undefined' && typeof Sections.evaluateSections === 'function' && d) {
    var allinFindings = Sections.findingsForPanel(Sections.evaluateSections(d, {}, hands), 'All-In EV');
    html += Sections.renderVerdict(allinFindings, 'Not enough all-in spots yet to call out a pattern.');
    if (allinFindings.length) html += '<div class="p-row">' + Sections.renderFindings(allinFindings) + '</div>';
  }

  // Pre-simulation: show hand count and button
  html += '<div class="p-row"><div class="p-section cta-block">';
  html += '<div class="cta-count">' + _allinHands.length + '</div>';
  html += '<div class="dim-label mb-16">all-in showdown hands detected</div>';
  html += '<button class="example-hand-btn cta-btn-lg" id="allin-run-btn">Run Equity Simulation</button>';
  html += '<div class="dim-label cta-note">Calculates equity for each hand using Monte Carlo simulation</div>';
  html += '</div></div>';

  // Preview table (without equity columns)
  html += '<div class="p-row"><div class="p-section">';
  html += '<div class="dim-label mb-8">Detected All-In Hands</div>';
  html += '<div class="allin-table-wrap"><table class="allin-table">';
  html += '<thead><tr><th>#</th><th>Hole</th><th>vs</th><th>Board</th><th>Street</th><th>Pot</th><th>Result</th></tr></thead><tbody>';

  for (var ti = 0; ti < _allinHands.length; ti++) {
    var ah = _allinHands[ti];
    var actCls = ah.actualResult >= 0 ? 'pnl-pos' : 'pnl-neg';
    html += '<tr class="allin-row row-hover" data-allin-idx="' + ti + '">' +
      '<td>' + (ti + 1) + '</td>' +
      '<td class="allin-cards">' + displayCards(ah.heroHole) + '</td>' +
      '<td class="allin-cards">' + ah.opponents.map(function (opp) { return displayCards(opp); }).join('<br>') + '</td>' +
      '<td class="allin-cards">' + (ah.fullBoard.length ? displayCards(ah.fullBoard) : '\u2014') + '</td>' +
      '<td>' + ah.street + '</td>' +
      '<td>' + fmt(ah.potAtAllIn) + '</td>' +
      '<td class="' + actCls + '">' + fmtPnl(Math.round(ah.actualResult)) + '</td>' +
      '</tr>';
  }
  html += '</tbody></table></div></div></div>';

  // Placeholder for results after simulation
  html += '<div id="allin-results"></div>';

  container.innerHTML = html;

  // Wire row clicks
  container.querySelectorAll('.allin-row').forEach(function (row) {
    row.onclick = function () {
      var idx = parseInt(row.getAttribute('data-allin-idx'));
      if (!isNaN(idx) && _allinHands[idx]) showExampleHandModal(_allinHands[idx].hand);
    };
  });

  // Wire simulation button
  var runBtn = document.getElementById('allin-run-btn');
  if (runBtn) {
    runBtn.onclick = function () {
      runBtn.disabled = true;
      runBtn.textContent = 'Simulating\u2026 0/' + _allinHands.length;
      var batchSize = 2;
      var idx = 0;

      function processBatch() {
        var end = Math.min(idx + batchSize, _allinHands.length);
        for (var i = idx; i < end; i++) {
          var ah = _allinHands[i];
          ah.equity = simulateStreet(ah.heroHole, ah.boardAtAllIn, 5000, ah.opponents).equity;
          ah.fairShare = ah.equity * ah.potAtAllIn;
          ah.expectedValue = (ah.equity * ah.potAtAllIn) - ah.heroInvested;
          ah.evDiff = ah.actualResult - ah.expectedValue;
        }
        idx = end;
        runBtn.textContent = 'Simulating\u2026 ' + idx + '/' + _allinHands.length;

        if (idx < _allinHands.length) {
          setTimeout(processBatch, 0);
        } else {
          showAllInResults(container);
        }
      }
      setTimeout(processBatch, 50);
    };
  }
}

// ── Show full results after simulation completes ─────────────────────────────
function showAllInResults(container) {
  var allInHands = _allinHands;

  var cashAllIns = [];
  for (var ci = 0; ci < allInHands.length; ci++) {
    if (allInHands[ci].isCash) cashAllIns.push(allInHands[ci]);
  }

  var totalEvDiff = 0, favouriteCount = 0, actualWins = 0;
  for (var si = 0; si < allInHands.length; si++) {
    totalEvDiff += allInHands[si].evDiff;
    if (allInHands[si].equity > 0.5) favouriteCount++;
    if (allInHands[si].actualResult > 0) actualWins++;
  }
  var equityWinRate = pct(favouriteCount, allInHands.length);
  var actualWinRate = pct(actualWins, allInHands.length);

  // Rebuild entire panel with full results
  var html = '<div class="panel-title">All-In EV</div>';
  html += '<div class="panel-desc">Compares actual results vs expected value at all-in showdowns to measure variance.</div>';

  html += renderMiniRow([
    { l: 'All-In Hands', v: allInHands.length, c: 'text' },
    { l: 'EV Diff', v: (totalEvDiff >= 0 ? '+' : '') + fmt(totalEvDiff), c: totalEvDiff >= 0 ? 'g' : 'r' },
    { l: 'Equity Win Rate', v: equityWinRate !== null ? equityWinRate + '%' : '\u2014', c: equityWinRate >= 50 ? 'g' : 'a' },
    { l: 'Actual Win Rate', v: actualWinRate !== null ? actualWinRate + '%' : '\u2014', c: actualWinRate >= 50 ? 'g' : 'r' },
  ]);

  if (cashAllIns.length >= 2) {
    html += '<div class="p-row"><div class="p-section">';
    html += '<div class="dim-label mb-8">Cumulative All-In Results vs Expected Value (Cash Hands)</div>';
    html += '<canvas id="allin-ev-chart"></canvas>';
    html += '</div></div>';
  }

  // Variance verdict (running hot / cold / underdog) rendered as a single
  // sentence above the equity table. Cards retired in favour of the section
  // story rendered earlier in the panel.
  var _aiN = allInHands.length;
  var variance = '';
  if (_aiN >= 10 && totalEvDiff > 1) {
    variance = 'You\'re running ' + fmt(totalEvDiff) + ' above expectation across ' + _aiN + ' all-in hands. Results converge toward the EV line over time.';
  } else if (_aiN >= 10 && totalEvDiff < -1) {
    variance = 'You\'re running ' + fmt(Math.abs(totalEvDiff)) + ' below expectation across ' + _aiN + ' all-in hands. Play has been correct more often than results suggest.';
  } else if (equityWinRate !== null && equityWinRate < 45) {
    variance = 'You\'re frequently all-in as an underdog (' + equityWinRate + '% favourite rate). Check whether the spots are +EV given pot odds, or if tighter selection helps.';
  }
  if (variance) {
    html += '<div class="panel-verdict">' + variance + '</div>';
  }

  // Full table with equity columns
  html += '<div class="p-row"><div class="p-section">';
  html += '<div class="dim-label mb-8">All-In Hand Details</div>';
  if (cashAllIns.length < allInHands.length) {
    html += '<div class="allin-caveat">Side pots are approximated using total pot. Tournament hands are included in the table but excluded from the cumulative graph.</div>';
  }
  html += '<div class="allin-table-wrap"><table class="allin-table">';
  html += '<thead><tr><th>#</th><th>Hole</th><th>vs</th><th>Board</th><th>Street</th><th>Equity</th><th>Fair Share</th><th>Actual</th><th>EV Diff</th></tr></thead><tbody>';

  for (var ti = 0; ti < allInHands.length; ti++) {
    var ah = allInHands[ti];
    var evCls = ah.evDiff >= 0 ? 'pnl-pos' : 'pnl-neg';
    var actCls = ah.actualResult >= 0 ? 'pnl-pos' : 'pnl-neg';
    html += '<tr class="allin-row row-hover" data-allin-idx="' + ti + '">' +
      '<td>' + (ti + 1) + '</td>' +
      '<td class="allin-cards">' + displayCards(ah.heroHole) + '</td>' +
      '<td class="allin-cards">' + ah.opponents.map(function (opp) { return displayCards(opp); }).join('<br>') + '</td>' +
      '<td class="allin-cards">' + (ah.fullBoard.length ? displayCards(ah.fullBoard) : '\u2014') + '</td>' +
      '<td>' + ah.street + '</td>' +
      '<td>' + fmtPct(ah.equity * 100) + '</td>' +
      '<td>' + fmt(Math.round(ah.fairShare)) + '</td>' +
      '<td class="' + actCls + '">' + fmtPnl(Math.round(ah.actualResult)) + '</td>' +
      '<td class="' + evCls + '">' + (ah.evDiff >= 0 ? '+' : '') + fmt(Math.round(ah.evDiff)) + '</td>' +
      '</tr>';
  }
  html += '</tbody></table></div></div></div>';

  container.innerHTML = html;

  // Wire row clicks
  container.querySelectorAll('.allin-row').forEach(function (row) {
    row.onclick = function () {
      var idx = parseInt(row.getAttribute('data-allin-idx'));
      if (!isNaN(idx) && allInHands[idx]) showExampleHandModal(allInHands[idx].hand);
    };
  });

  // Render chart
  if (cashAllIns.length >= 2) {
    var canvas = document.getElementById('allin-ev-chart');
    if (!canvas) return;

    var colors = getChartColors();

    var chartLabels = [], dataActual = [], dataExpected = [];
    var cumActual = 0, cumExpected = 0;
    for (var gi = 0; gi < cashAllIns.length; gi++) {
      cumActual += cashAllIns[gi].actualResult;
      cumExpected += cashAllIns[gi].expectedValue;
      chartLabels.push(gi + 1);
      dataActual.push(cumActual);
      dataExpected.push(cumExpected);
    }

    if (_allinChart) { _allinChart.destroy(); _allinChart = null; }
    _allinChart = createChart(canvas, 'line', {
      labels: chartLabels,
      datasets: [
        {
          label: 'Actual Results',
          data: dataActual,
          borderColor: colors.gold,
          borderWidth: 2,
          pointRadius: 0,
          pointHitRadius: 6,
          tension: 0.3,
          order: 1,
        },
        {
          label: 'Expected (EV)',
          data: dataExpected,
          borderColor: colors.dim,
          borderWidth: 2,
          borderDash: [5, 3],
          pointRadius: 0,
          pointHitRadius: 6,
          tension: 0.3,
          order: 2,
        },
      ],
    }, {
      interaction: { mode: 'index', intersect: false },
      legend: chartLegend(colors),
      tooltip: chartTooltip(colors, {
        title: function (items) { return 'All-In #' + items[0].label; },
        label: function (ctx) { return ' ' + ctx.dataset.label + ': ' + fmtPnl(ctx.parsed.y); },
      }),
      scales: {
        x: chartXScale(colors, { title: 'All-In Hands', tickSize: 9, maxTicksLimit: 8 }),
        y: chartYScaleZeroLine(colors, { tickCallback: function (val) { return fmt(val); } }),
      },
    });
  }
}
