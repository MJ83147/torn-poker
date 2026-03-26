// ── ALL-IN EV PANEL (Luck Tracker) ────────────────────────────────────────────

var _allinChart = null;

// ── Card normalisation for action log formats ────────────────────────────────
// Action logs use "9hearts", "Kspades", "10diamonds", etc.
// Hero hole cards use "3♥", "J♠", etc.
// Equity engine expects "9h", "Ks", "Td", etc.

var SUIT_LONG = { hearts: 'h', diamonds: 'd', clubs: 'c', spades: 's' };
var SUIT_UNICODE = { '\u2665': 'h', '\u2666': 'd', '\u2663': 'c', '\u2660': 's' };

function normCardAllIn(c) {
  if (!c) return c;
  // Handle long-form suit names from action logs: "10spades" -> "Ts", "Khearts" -> "Kh"
  for (var name in SUIT_LONG) {
    if (c.indexOf(name) !== -1) {
      var rank = c.replace(name, '');
      if (rank === '10') rank = 'T';
      return rank + SUIT_LONG[name];
    }
  }
  // Handle unicode suit symbols from hand.hole: "3♥" -> "3h", "J♠" -> "Js"
  for (var sym in SUIT_UNICODE) {
    if (c.indexOf(sym) !== -1) {
      var rank2 = c.replace(sym, '');
      if (rank2 === '10') rank2 = 'T';
      return rank2 + SUIT_UNICODE[sym];
    }
  }
  // Already normalised or "10x" -> "Tx"
  return normCard(c);
}

// ── Parse reveals from action log ────────────────────────────────────────────
// Returns array of { name, hole: ['Xs', 'Ys'] } for non-hero players
function parseReveals(actions) {
  var results = [];
  var CARD_RE = /(\d{1,2}|[AKQJTakqjt])([a-z]+)/g;

  for (var i = 0; i < (actions || []).length; i++) {
    var raw = (actions[i] || '').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&');
    var isMe = raw.indexOf('>>') === 0;
    if (isMe) continue; // skip hero lines

    var line = raw.replace(/^>>\s*/, '').replace(/^\s+/, '').trim();

    // Match "PlayerName:  reveals [cards] (...)" or "PlayerName:  won $X with [cards] (...)"
    var revealMatch = line.match(/^(.+?):\s+(reveals|won .+ with)\s+\[([^\]]+)\]/);
    if (!revealMatch) continue;

    var playerName = revealMatch[1].trim();
    var cardsStr = revealMatch[3];
    var cards = [];
    var m;
    while ((m = CARD_RE.exec(cardsStr)) !== null) {
      var rank = m[1];
      var suitName = m[2].toLowerCase();
      if (rank === '10') rank = 'T';
      var suit = SUIT_LONG[suitName];
      if (suit) cards.push(rank + suit);
    }
    CARD_RE.lastIndex = 0;

    if (cards.length === 2) {
      // Don't add duplicate player entries
      var alreadyHave = false;
      for (var j = 0; j < results.length; j++) {
        if (results[j].name === playerName) { alreadyHave = true; break; }
      }
      if (!alreadyHave) results.push({ name: playerName, hole: cards });
    }
  }

  return results;
}

// ── Detect all-in hands ──────────────────────────────────────────────────────
function detectAllInHands(hands) {
  var results = [];

  for (var hi = 0; hi < hands.length; hi++) {
    var h = hands[hi];
    if (!h.hole || h.hole.length !== 2) continue;
    if (!h.actions || !h.actions.length) continue;
    if (!h.outcome) continue;

    var acts = parseActions(h.actions);
    var allInStreet = null;
    var allInFound = false;
    var allInCalled = false;
    var heroShoved = false;
    var opponentShoved = false;

    // Scan for all-in raises (raise without "to $Y" in message)
    for (var ai = 0; ai < acts.length; ai++) {
      var a = acts[ai];
      if (a.type === 'raise' && a.msg && a.msg.indexOf(' to ') === -1) {
        // This is an all-in raise
        allInFound = true;
        allInStreet = a.street;
        if (a.isMe) heroShoved = true;
        else opponentShoved = true;

        // Check if it was called (look for a call/raise on the same street after this)
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

    if (!allInFound || !allInCalled) continue;

    // Get opponent hole cards from reveals
    var reveals = parseReveals(h.actions);
    if (!reveals.length) continue;

    // Normalise hero hole cards
    var heroHole = [normCardAllIn(h.hole[0]), normCardAllIn(h.hole[1])];

    // Normalise opponent hole cards (already normalised in parseReveals)
    var opponentHoles = [];
    for (var ri = 0; ri < reveals.length; ri++) {
      opponentHoles.push(reveals[ri].hole);
    }

    // Determine board at all-in moment
    var streetIdx = { 'Preflop': 0, 'Flop': 3, 'Turn': 4, 'River': 5 };
    var boardSlice = streetIdx[allInStreet] || 0;
    var fullBoard = (h.board || []).map(normCardAllIn);
    var boardAtAllIn = fullBoard.slice(0, boardSlice);

    // Calculate pot at all-in: sum all amounts from betting actions up to and including the all-in call
    var potAtAllIn = 0;
    var heroInvested = 0;
    var pastAllIn = false;
    for (var pi = 0; pi < acts.length; pi++) {
      var pa = acts[pi];
      if (pa.type === 'won') continue;
      if (pa.amount) {
        potAtAllIn += pa.amount;
        if (pa.isMe) heroInvested += pa.amount;
      }
      // Stop counting after the all-in call is complete
      if (pastAllIn && (pa.type === 'call' || pa.type === 'raise')) break;
      if (pa.type === 'raise' && pa.msg && pa.msg.indexOf(' to ') === -1) {
        pastAllIn = true;
      }
    }
    // If pot tracking missed, use full pot
    if (potAtAllIn === 0) potAtAllIn = h.pot || 0;
    // Use full hero investment from all actions if we can
    if (heroInvested === 0) heroInvested = getInvested(h);
    else heroInvested = getInvested(h); // always use full investment for accuracy

    // Calculate equity
    var equity = calcMultiwayEquity(heroHole, opponentHoles, boardAtAllIn, fullBoard);

    // Calculate EV diff
    var expectedValue = (equity * potAtAllIn) - heroInvested;
    var actualWon = h.outcome.result === 'won' ? ((h.outcome.amount || 0) - heroInvested) : -heroInvested;
    var evDiff = actualWon - expectedValue;

    results.push({
      hand: h,
      street: allInStreet,
      heroHole: heroHole,
      opponents: opponentHoles,
      boardAtAllIn: boardAtAllIn,
      equity: equity,
      potAtAllIn: potAtAllIn,
      heroInvested: heroInvested,
      fairShare: equity * potAtAllIn,
      expectedValue: expectedValue,
      actualResult: actualWon,
      evDiff: evDiff,
      isCash: isCashHand(h),
      timestamp: h.timestamp || 0
    });
  }

  // Sort by timestamp
  results.sort(function(a, b) { return a.timestamp - b.timestamp; });
  return results;
}

// ── Multiway equity calculation ──────────────────────────────────────────────
function calcMultiwayEquity(heroHole, opponentHoles, boardAtAllIn, fullBoard) {
  // Collect all known cards (dead cards)
  var dead = {};
  for (var i = 0; i < heroHole.length; i++) dead[heroHole[i]] = true;
  for (var j = 0; j < opponentHoles.length; j++) {
    for (var k = 0; k < opponentHoles[j].length; k++) {
      dead[opponentHoles[j][k]] = true;
    }
  }
  for (var b = 0; b < boardAtAllIn.length; b++) dead[boardAtAllIn[b]] = true;

  var remaining = buildDeck().filter(function(c) { return !dead[c]; });
  var boardNeed = 5 - boardAtAllIn.length;

  var wins = 0, ties = 0, total = 0;
  var numOpps = opponentHoles.length;

  if (boardNeed === 0) {
    // River: exact single evaluation
    var heroScore = bestHand(heroHole.concat(boardAtAllIn));
    var heroBeat = true;
    var heroTied = true;
    for (var oi = 0; oi < numOpps; oi++) {
      var oppScore = bestHand(opponentHoles[oi].concat(boardAtAllIn));
      if (oppScore > heroScore) { heroBeat = false; heroTied = false; break; }
      if (oppScore < heroScore) heroTied = false;
    }
    if (heroBeat && !heroTied) return 1.0;
    if (heroTied && heroBeat) {
      // Count how many tied
      var tiedCount = 1; // hero
      for (var ti = 0; ti < numOpps; ti++) {
        if (bestHand(opponentHoles[ti].concat(boardAtAllIn)) === heroScore) tiedCount++;
      }
      return 1.0 / tiedCount;
    }
    return 0.0;

  } else if (boardNeed === 1) {
    // Turn: exact enumeration over remaining cards
    for (var ci = 0; ci < remaining.length; ci++) {
      var board5 = boardAtAllIn.concat([remaining[ci]]);
      var hScore = bestHand(heroHole.concat(board5));
      var beatAll = true;
      var tiedAll = true;
      for (var o = 0; o < numOpps; o++) {
        var oScore = bestHand(opponentHoles[o].concat(board5));
        if (oScore > hScore) { beatAll = false; tiedAll = false; break; }
        if (oScore < hScore) tiedAll = false;
      }
      if (beatAll && !tiedAll) wins++;
      else if (beatAll && tiedAll) {
        var tc = 1;
        for (var t2 = 0; t2 < numOpps; t2++) {
          if (bestHand(opponentHoles[t2].concat(board5)) === hScore) tc++;
        }
        ties += 1.0 / tc;
      }
      total++;
    }
    return total > 0 ? (wins + ties) / total : 0.5;

  } else {
    // Preflop or Flop: Monte Carlo
    var iterations = 10000;
    for (var n = 0; n < iterations; n++) {
      var deck = remaining.slice();
      var drawn = shuffleDraw(deck, boardNeed);
      var simBoard = boardAtAllIn.concat(drawn);
      var hS = bestHand(heroHole.concat(simBoard));
      var bAll = true;
      var tAll = true;
      for (var op = 0; op < numOpps; op++) {
        var oS = bestHand(opponentHoles[op].concat(simBoard));
        if (oS > hS) { bAll = false; tAll = false; break; }
        if (oS < hS) tAll = false;
      }
      if (bAll && !tAll) wins++;
      else if (bAll && tAll) {
        var tc2 = 1;
        for (var t3 = 0; t3 < numOpps; t3++) {
          if (bestHand(opponentHoles[t3].concat(simBoard)) === hS) tc2++;
        }
        ties += 1.0 / tc2;
      }
      total++;
    }
    return total > 0 ? (wins + ties) / total : 0.5;
  }
}

// ── Card display helper ──────────────────────────────────────────────────────
var SUIT_DISPLAY = { h: '♥', d: '♦', c: '♣', s: '♠' };
var SUIT_CLASS = { h: 'r', d: 'r', c: 'b', s: 'b' };

function displayCard(c) {
  if (!c || c.length < 2) return c;
  var rank = c.slice(0, -1);
  var suit = c.slice(-1);
  if (rank === 'T') rank = '10';
  var sym = SUIT_DISPLAY[suit] || suit;
  var cls = SUIT_CLASS[suit] || 'b';
  return '<span class="allin-card ' + cls + '">' + rank + sym + '</span>';
}

function displayCards(cards) {
  return cards.map(displayCard).join(' ');
}

// ── Render All-In EV Panel ───────────────────────────────────────────────────
function renderAllIn(container, hands, meta) {
  if (_allinChart) { _allinChart.destroy(); _allinChart = null; }

  var allInHands = detectAllInHands(hands);

  if (!allInHands.length) {
    container.innerHTML = '<div class="panel-title">All-In EV</div>' +
      '<div class="panel-desc">Tracks every all-in showdown to measure luck vs skill.</div>' +
      '<div class="p-row">' + ins('n', 'No All-In Hands', 'No all-in showdown hands found in this dataset. When you go all-in and both players show cards, those hands will appear here with equity calculations.', []) + '</div>';
    return;
  }

  // Separate cash hands for cumulative graph
  var cashAllIns = [];
  for (var ci = 0; ci < allInHands.length; ci++) {
    if (allInHands[ci].isCash) cashAllIns.push(allInHands[ci]);
  }

  // Summary stats (all hands)
  var totalEvDiff = 0;
  var favouriteCount = 0;
  var actualWins = 0;
  for (var si = 0; si < allInHands.length; si++) {
    totalEvDiff += allInHands[si].evDiff;
    if (allInHands[si].equity > 0.5) favouriteCount++;
    if (allInHands[si].actualResult > 0) actualWins++;
  }
  var equityWinRate = pct(favouriteCount, allInHands.length);
  var actualWinRate = pct(actualWins, allInHands.length);

  var html = '<div class="panel-title">All-In EV</div>';
  html += '<div class="panel-desc">Compares actual results vs expected value at all-in showdowns to measure variance.</div>';

  // Summary stat cards
  html += renderMiniRow([
    { l: 'All-In Hands', v: allInHands.length, c: 'text' },
    { l: 'EV Diff', v: (totalEvDiff >= 0 ? '+' : '') + fmt(totalEvDiff), c: totalEvDiff >= 0 ? 'g' : 'r' },
    { l: 'Equity Win Rate', v: equityWinRate !== null ? equityWinRate + '%' : '—', c: equityWinRate >= 50 ? 'g' : 'a' },
    { l: 'Actual Win Rate', v: actualWinRate !== null ? actualWinRate + '%' : '—', c: actualWinRate >= 50 ? 'g' : 'r' },
  ]);

  // Luck graph (cash hands only)
  if (cashAllIns.length >= 2) {
    html += '<div class="p-row"><div class="p-section">';
    html += '<div class="dim-label mb-8">Cumulative All-In Results vs Expected Value (Cash Hands)</div>';
    html += '<canvas id="allin-ev-chart"></canvas>';
    html += '</div></div>';
  }

  // Insights
  var insArr = [];
  if (allInHands.length >= 3) {
    if (totalEvDiff > 0) {
      insArr.push(ins('o', 'Running Hot', 'You\'re running ' + fmt(totalEvDiff) + ' above expectation across ' + allInHands.length + ' all-in hands. The actual results line will tend to converge toward the EV line over time.', [
        { v: 'EV Diff: +' + fmt(totalEvDiff), hi: true }
      ]));
    } else if (totalEvDiff < 0) {
      insArr.push(ins('n', 'Running Cold', 'You\'re running ' + fmt(Math.abs(totalEvDiff)) + ' below expectation. Your play at the all-in point has been correct more often than results suggest.', [
        { v: 'EV Diff: -' + fmt(Math.abs(totalEvDiff)), hi: true }
      ]));
    }

    if (equityWinRate >= 55 && actualWinRate !== null && actualWinRate < equityWinRate - 10) {
      insArr.push(ins('n', 'Negative Variance', 'You\'re getting your chips in good (favourite ' + equityWinRate + '% of the time) but results haven\'t followed. Classic negative variance.', [
        { v: 'Favourite: ' + equityWinRate + '%' },
        { v: 'Won: ' + actualWinRate + '%' }
      ]));
    }

    if (equityWinRate !== null && equityWinRate < 45) {
      insArr.push(ins('a', 'Underdog All-Ins', 'You\'re frequently all-in as an underdog (' + equityWinRate + '% favourite rate). Review whether these spots are +EV given pot odds, or if tighter selection would help.', [
        { v: 'Favourite rate: ' + equityWinRate + '%', hi: true }
      ]));
    }
  }

  if (insArr.length) {
    html += '<div class="p-row">' + renderInsights(insArr, 'All-In EV', 'More all-in hands needed for patterns.') + '</div>';
  }

  // All-in hand table
  html += '<div class="p-row"><div class="p-section">';
  html += '<div class="dim-label mb-8">All-In Hand Details</div>';
  if (cashAllIns.length < allInHands.length) {
    html += '<div class="allin-caveat">Side pots are approximated using total pot. Tournament hands are included in the table but excluded from the cumulative graph.</div>';
  }
  html += '<div class="allin-table-wrap"><table class="allin-table">';
  html += '<thead><tr>' +
    '<th>#</th>' +
    '<th>Hole</th>' +
    '<th>vs</th>' +
    '<th>Board</th>' +
    '<th>Street</th>' +
    '<th>Equity</th>' +
    '<th>Fair Share</th>' +
    '<th>Actual</th>' +
    '<th>EV Diff</th>' +
    '</tr></thead><tbody>';

  for (var ti = 0; ti < allInHands.length; ti++) {
    var ah = allInHands[ti];
    var evCls = ah.evDiff >= 0 ? 'pnl-pos' : 'pnl-neg';
    var actCls = ah.actualResult >= 0 ? 'pnl-pos' : 'pnl-neg';
    html += '<tr class="allin-row row-hover" data-allin-idx="' + ti + '">' +
      '<td>' + (ti + 1) + '</td>' +
      '<td class="allin-cards">' + displayCards(ah.heroHole) + '</td>' +
      '<td class="allin-cards">' + ah.opponents.map(function(opp) { return displayCards(opp); }).join('<br>') + '</td>' +
      '<td class="allin-cards">' + (ah.boardAtAllIn.length ? displayCards(ah.boardAtAllIn) : '—') + '</td>' +
      '<td>' + ah.street + '</td>' +
      '<td>' + (ah.equity * 100).toFixed(1) + '%</td>' +
      '<td>' + fmt(Math.round(ah.fairShare)) + '</td>' +
      '<td class="' + actCls + '">' + fmtPnl(Math.round(ah.actualResult)) + '</td>' +
      '<td class="' + evCls + '">' + (ah.evDiff >= 0 ? '+' : '') + fmt(Math.round(ah.evDiff)) + '</td>' +
      '</tr>';
  }

  html += '</tbody></table></div>';
  html += '</div></div>';

  container.innerHTML = html;

  // Wire table row clicks to open hand modal
  container.querySelectorAll('.allin-row').forEach(function(row) {
    row.onclick = function() {
      var idx = parseInt(row.getAttribute('data-allin-idx'));
      if (!isNaN(idx) && allInHands[idx]) {
        showExampleHandModal(allInHands[idx].hand);
      }
    };
  });

  // Render Chart.js luck graph
  if (cashAllIns.length >= 2) {
    var canvas = document.getElementById('allin-ev-chart');
    if (!canvas) return;

    var styles = getComputedStyle(document.documentElement);
    var dimColor = styles.getPropertyValue('--dim').trim() || '#666';
    var borderColor = styles.getPropertyValue('--border').trim() || '#333';
    var goldColor = styles.getPropertyValue('--gold').trim() || '#d4842a';
    var greenColor = styles.getPropertyValue('--green').trim() || '#2ecc71';

    var chartLabels = [];
    var dataActual = [];
    var dataExpected = [];
    var cumActual = 0;
    var cumExpected = 0;

    for (var gi = 0; gi < cashAllIns.length; gi++) {
      var g = cashAllIns[gi];
      cumActual += g.actualResult;
      cumExpected += g.expectedValue;
      chartLabels.push(gi + 1);
      dataActual.push(cumActual);
      dataExpected.push(cumExpected);
    }

    _allinChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: chartLabels,
        datasets: [
          {
            label: 'Actual Results',
            data: dataActual,
            borderColor: goldColor,
            borderWidth: 2,
            pointRadius: 0,
            pointHitRadius: 6,
            tension: 0.3,
            order: 1,
          },
          {
            label: 'Expected (EV)',
            data: dataExpected,
            borderColor: dimColor,
            borderWidth: 2,
            borderDash: [5, 3],
            pointRadius: 0,
            pointHitRadius: 6,
            tension: 0.3,
            order: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 2.8,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            align: 'start',
            labels: {
              color: dimColor,
              font: { family: 'IBM Plex Mono', size: 11 },
              boxWidth: 14,
              boxHeight: 2,
              padding: 16,
              usePointStyle: false,
            },
          },
          tooltip: {
            backgroundColor: 'rgba(20,20,28,0.95)',
            titleColor: '#aaa',
            bodyColor: '#eee',
            borderColor: borderColor,
            borderWidth: 1,
            titleFont: { family: 'IBM Plex Mono', size: 11 },
            bodyFont: { family: 'IBM Plex Mono', size: 11 },
            padding: 10,
            callbacks: {
              title: function(items) {
                return 'All-In #' + items[0].label;
              },
              label: function(ctx) {
                return ' ' + ctx.dataset.label + ': ' + fmtPnl(ctx.parsed.y);
              },
            },
          },
        },
        scales: {
          x: {
            display: true,
            title: {
              display: true,
              text: 'All-In Hands',
              color: dimColor,
              font: { family: 'IBM Plex Mono', size: 10 },
            },
            ticks: {
              color: dimColor,
              font: { family: 'IBM Plex Mono', size: 9 },
              maxTicksLimit: 8,
            },
            grid: { color: 'transparent' },
            border: { color: borderColor },
          },
          y: {
            display: true,
            ticks: {
              color: dimColor,
              font: { family: 'IBM Plex Mono', size: 9 },
              callback: function(val) { return fmt(val); },
            },
            grid: {
              color: function(ctx) {
                return ctx.tick.value === 0 ? dimColor : 'rgba(255,255,255,0.04)';
              },
              lineWidth: function(ctx) {
                return ctx.tick.value === 0 ? 1 : 0.5;
              },
            },
            border: { display: false },
          },
        },
      },
    });
  }
}
