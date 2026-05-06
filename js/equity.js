// ── EQUITY (orchestrator + rendering) ───────────────────────────────────────
// Wires the evaluator + Monte Carlo + guidance modules into the modal that
// drops in next to a hand. The heavy math lives in:
//   js/hand-evaluator.js       (5-card scoring, best-5-of-N, made-hand classifier)
//   js/equity-monte-carlo.js   (shuffle + simulateStreet)
//   js/equity-guidance.js      (per-street hero summary + coaching copy)

function runEquitySimulation(hand) {
  var heroHole = hand.hole.map(normCard);
  var board = (hand.board || []).map(normCard);
  var heroInfo = getHeroStreetActions(hand);
  var results = [];

  var streetDefs = [
    { name: 'Preflop', boardSlice: 0, iters: 10000 },
    { name: 'Flop', boardSlice: 3, iters: 10000 },
    { name: 'Turn', boardSlice: 4, iters: 5000 },
    { name: 'River', boardSlice: 5, iters: 0 } // exact
  ];

  for (var i = 0; i < streetDefs.length; i++) {
    var sd = streetDefs[i];
    var streetBoard = board.slice(0, sd.boardSlice);

    if (sd.boardSlice > board.length) break;

    if (heroInfo.foldedOn) {
      var foldIdx = ['Preflop', 'Flop', 'Turn', 'River'].indexOf(heroInfo.foldedOn);
      var curIdx = ['Preflop', 'Flop', 'Turn', 'River'].indexOf(sd.name);
      if (curIdx > foldIdx) break;
    }

    var streetInfo = heroInfo.streets[sd.name];
    if (!streetInfo && sd.name !== 'Preflop') continue;

    var sim = simulateStreet(heroHole, streetBoard, sd.iters);

    // Board texture + made hand + villain (post-flop only)
    var texture = streetBoard.length >= 3 ? classifyBoardTexture(streetBoard) : null;
    var madeHand = streetBoard.length >= 3 ? classifyMadeHand(heroHole, streetBoard) : null;
    var villainProfile = getPrimaryVillain(hand);

    // Build priorStreets context for cross-street awareness
    var priorStreets = results.map(function (pr) {
      return {
        street: pr.street,
        equity: pr.equity,
        heroActionType: pr.heroActionType || '',
        villainActionType: pr.villainActionType || '',
        madeHand: pr.madeHand,
        texture: pr.texture
      };
    });

    var guidance = streetInfo ? generateGuidance(sim.equity, streetInfo, texture, madeHand, villainProfile, priorStreets) : { text: '', quality: 'neutral' };

    var actionDesc = '';
    var heroActionType = '';
    var villainActionType = '';
    if (streetInfo && streetInfo.action) {
      var a = streetInfo.action;
      heroActionType = a.type;
      if (a.type === 'fold') actionDesc = 'You folded.';
      else if (a.type === 'check') actionDesc = 'You checked.';
      else if (a.type === 'call') actionDesc = 'You called ' + fmtDollar(a.amount) + '.';
      else if (a.type === 'raise') actionDesc = 'You raised to ' + fmtDollar(a.amount) + '.';
      else if (a.type === 'bet') actionDesc = 'You bet ' + fmtDollar(a.amount) + '.';
      else if (a.type === 'sb') actionDesc = 'Small blind.';
      else if (a.type === 'bb') actionDesc = 'Big blind.';
    }
    if (streetInfo && streetInfo.villainAction) {
      villainActionType = streetInfo.villainAction.type || '';
    }

    var potOddsStr = '';

    // Pot size at this street
    var potSize = streetInfo ? (streetInfo.potBefore || 0) : 0;
    // Add hero's action amount to get pot after action
    if (streetInfo && streetInfo.action && streetInfo.action.amount && streetInfo.action.type !== 'fold') {
      potSize += streetInfo.action.amount;
    }

    // Board cards for this street (original non-normalised for display)
    var boardDisplay = (hand.board || []).slice(0, sd.boardSlice);

    results.push({
      street: sd.name,
      equity: sim.equity,
      iterations: sim.iterations,
      exact: sim.exact,
      actionDesc: actionDesc,
      heroActionType: heroActionType,
      villainActionType: villainActionType,
      potOddsStr: potOddsStr,
      guidance: guidance,
      texture: texture,
      madeHand: madeHand,
      villainProfile: villainProfile,
      potSize: potSize,
      boardCards: boardDisplay,
      playersActive: streetInfo ? (streetInfo.playersActive || 0) : 0
    });
  }

  // Generate hand summary
  var villainProfile = getPrimaryVillain(hand);
  var summary = generateHandSummary(results, hand, villainProfile);

  return { streets: results, summary: summary };
}

// ── Dollar formatting helper ──────────────────────────────────────────────
function fmtDollar(n) {
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K';
  return '$' + n;
}

// ── UI rendering ──────────────────────────────────────────────────────────
function renderEquityResults(container, simResult) {
  // Support both old (array) and new ({streets, summary}) return shapes
  var results = Array.isArray(simResult) ? simResult : simResult.streets;
  var summary = Array.isArray(simResult) ? null : simResult.summary;

  var hasExact = false;
  var maxIters = 0;
  for (var i = 0; i < results.length; i++) {
    if (results[i].exact) hasExact = true;
    if (!results[i].exact && results[i].iterations > maxIters) maxIters = results[i].iterations;
  }

  var headerNote = '';
  if (maxIters > 0 && hasExact) {
    headerNote = maxIters.toLocaleString() + ' iterations \u00b7 river is exact';
  } else if (maxIters > 0) {
    headerNote = maxIters.toLocaleString() + ' iterations';
  } else if (hasExact) {
    headerNote = 'Exact enumeration';
  }

  var html = '<div class="eq-sim">';
  html += '<div class="eq-sim-header"><span class="eq-sim-title">Equity Simulation</span><span class="eq-sim-note">' + headerNote + '</span></div>';

  var curvePoints = [];

  for (var r = 0; r < results.length; r++) {
    var res = results[r];
    var eqPct = (res.equity * 100).toFixed(1);
    var barWidth = Math.round(res.equity * 100);
    var qualClass = res.guidance.quality === 'good' ? 'eq-good' : res.guidance.quality === 'bad' ? 'eq-bad' : 'eq-neutral';

    curvePoints.push({ street: res.street, equity: res.equity });

    html += '<div class="eq-row">';
    // Top line: street name, texture badge, equity %, bar
    html += '<div class="eq-row-top">';
    html += '<div class="eq-street">' + res.street + '</div>';
    if (res.texture) {
      var texCls = res.texture.wetness === 'wet' ? 'tex-wet' : res.texture.wetness === 'dry' ? 'tex-dry' : 'tex-med';
      html += '<span class="board-texture-badge ' + texCls + '">' + res.texture.label + '</span>';
    }
    html += '<div class="eq-pct">' + eqPct + '%</div>';
    html += '<div class="eq-bar-track"><div class="eq-bar-fill" style="width:' + barWidth + '%"></div></div>';
    html += '</div>';

    // Meta line: board cards, pot size, player count
    var metaParts = [];
    if (res.boardCards && res.boardCards.length > 0) {
      metaParts.push(res.boardCards.join(' '));
    }
    if (res.potSize > 0) {
      metaParts.push('Pot: ' + fmtDollar(res.potSize));
    }
    if (res.playersActive > 0) {
      metaParts.push(res.playersActive + '-way');
    }
    if (metaParts.length > 0) {
      html += '<div class="eq-meta-line">' + metaParts.join(' · ') + '</div>';
    }

    // Bottom section: badges + coaching
    var hasBottom = res.madeHand || res.guidance.text || res.villainProfile;
    if (hasBottom) {
      html += '<div class="eq-row-bottom">';
      if (res.madeHand) {
        html += '<div class="eq-badges">';
        html += '<span class="eq-made-hand">' + res.madeHand.label + '</span>';
        if (res.madeHand.draws.length) {
          for (var dri = 0; dri < res.madeHand.draws.length; dri++) {
            html += '<span class="draw-outs">' + res.madeHand.draws[dri] + '</span>';
          }
        }
        html += '</div>';
      }
      html += '<div class="eq-detail ' + qualClass + '">' + res.actionDesc + ' ' + res.guidance.text + '</div>';
      if (res.villainProfile && res.guidance.text.indexOf(res.villainProfile.name) === -1) {
        html += '<div class="villain-profile-line">vs ' + res.villainProfile.type + ' (' + res.villainProfile.name + ' \u00b7 VPIP ' + (res.villainProfile.vpip || '?') + '% \u00b7 Fold to raise ' + (res.villainProfile.foldToRaise || '?') + '%)</div>';
      }
      html += '</div>';
    }
    html += '</div>';
  }

  // Equity curve SVG
  if (curvePoints.length >= 2) {
    var svgW = 240, svgH = 60, pad = 20;
    var plotW = svgW - pad * 2, plotH = svgH - pad;
    html += '<div class="eq-curve">';
    html += '<svg width="' + svgW + '" height="' + svgH + '" viewBox="0 0 ' + svgW + ' ' + svgH + '">';
    var pts = [];
    for (var c = 0; c < curvePoints.length; c++) {
      var x = pad + (plotW / (curvePoints.length - 1)) * c;
      var y = svgH - pad - (curvePoints[c].equity * plotH);
      pts.push(x + ',' + y);
      html += '<text x="' + x + '" y="' + (svgH - 2) + '" text-anchor="middle" fill="var(--dim)" font-size="10" font-family="IBM Plex Mono, monospace">' + curvePoints[c].street.slice(0, 1) + '</text>';
      html += '<circle cx="' + x + '" cy="' + y + '" r="3" fill="var(--gold)"/>';
      html += '<text x="' + x + '" y="' + (y - 7) + '" text-anchor="middle" fill="var(--dim)" font-size="10" font-family="IBM Plex Mono, monospace">' + (curvePoints[c].equity * 100).toFixed(0) + '%</text>';
    }
    html += '<polyline points="' + pts.join(' ') + '" fill="none" stroke="var(--gold)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>';
    html += '</svg></div>';
  }

  // Hand summary
  if (summary && summary.text) {
    var sumClass = summary.quality === 'good' ? 'eq-good' : summary.quality === 'bad' ? 'eq-bad' : 'eq-neutral';
    html += '<div class="eq-summary">';
    html += '<div class="eq-summary-label">Hand Summary</div>';
    html += '<div class="eq-summary-text ' + sumClass + '">' + summary.text + '</div>';
    html += '</div>';
  }

  // Caveats
  var hasFlopOrTurn = results.some(function (r) { return r.street === 'Flop' || r.street === 'Turn'; });
  var caveats = '<div class="eq-caveats">';
  caveats += 'Equity calculated against a single random hand. In multiway pots, true equity may be lower.';
  if (hasFlopOrTurn) {
    caveats += ' Pot odds comparisons use raw equity; implied odds (potential to win more on later streets) are not factored in and may justify calls that appear unprofitable.';
  }
  caveats += '</div>';
  html += caveats;

  html += '</div>';
  container.innerHTML = html;
}

// ── Button injection ──────────────────────────────────────────────────────
function injectEquityButton(box, hand) {
  var slot = box.querySelector('#equity-slot');
  if (!slot) return;

  // Only show when simulation is meaningful
  if (!hand.hole || hand.hole.length !== 2) return;
  if (!hand.actions || !hand.actions.length) return;

  var parsed = parseActions(hand.actions);
  var heroFoldedPreflop = false;
  for (var i = 0; i < parsed.length; i++) {
    if (parsed[i].isMe && parsed[i].type === 'fold' && parsed[i].street === 'Preflop') {
      heroFoldedPreflop = true;
      break;
    }
  }

  var hasBoard = hand.board && hand.board.length >= 3;
  var heroAllInPreflop = false;
  if (!hasBoard) {
    for (var j = 0; j < parsed.length; j++) {
      if (parsed[j].isMe && parsed[j].street === 'Preflop' && parsed[j].type === 'raise') {
        heroAllInPreflop = true;
      }
    }
  }

  if (heroFoldedPreflop && !hasBoard) return;
  if (!hasBoard && !heroAllInPreflop) return;

  var btn = document.createElement('button');
  btn.className = 'example-hand-btn';
  btn.id = 'mc-sim-btn';
  btn.textContent = 'Run Equity Simulation';
  slot.appendChild(btn);

  btn.onclick = function () {
    slot.innerHTML = '<div class="eq-spinner"><div class="eq-spinner-ring"></div><span class="eq-spinner-text">Simulating...</span></div>';

    setTimeout(function () {
      var results = runEquitySimulation(hand);
      renderEquityResults(slot, results);
    }, 50);
  };
}