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
      var foldIdx = STREETS.indexOf(heroInfo.foldedOn);
      var curIdx = STREETS.indexOf(sd.name);
      if (curIdx > foldIdx) break;
    }

    var streetInfo = heroInfo.streets[sd.name];
    if (!streetInfo && sd.name !== 'Preflop') continue;

    var sim = simulateStreet(heroHole, streetBoard, sd.iters);

    var texture = streetBoard.length >= 3 ? classifyBoardTexture(streetBoard) : null;
    var madeHand = streetBoard.length >= 3 ? classifyMadeHand(heroHole, streetBoard) : null;
    var villainProfile = getPrimaryVillain(hand);

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
      else if (a.type === 'call') actionDesc = 'You called ' + fmt(a.amount) + '.';
      else if (a.type === 'raise') actionDesc = 'You raised to ' + fmt(a.amount) + '.';
      else if (a.type === 'bet') actionDesc = 'You bet ' + fmt(a.amount) + '.';
      else if (a.type === 'sb') actionDesc = 'Small blind.';
      else if (a.type === 'bb') actionDesc = 'Big blind.';
    }
    if (streetInfo && streetInfo.villainAction) {
      villainActionType = streetInfo.villainAction.type || '';
    }

    var potOddsStr = '';

    var potSize = streetInfo ? (streetInfo.potBefore || 0) : 0;
    if (streetInfo && streetInfo.action && streetInfo.action.amount && streetInfo.action.type !== 'fold') {
      potSize += streetInfo.action.amount;
    }

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

  var villainProfile = getPrimaryVillain(hand);
  var summary = generateHandSummary(results, hand, villainProfile);

  return { streets: results, summary: summary };
}

function renderEquityResults(container, simResult) {
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

  var html = '<div class="card card-s1 eq-sim">';
  html += '<div class="row between eq-sim-header"><span class="card-title c-gold">Equity Simulation</span><span class="text-meta eq-sim-note">' + headerNote + '</span></div>';

  var curvePoints = [];

  for (var r = 0; r < results.length; r++) {
    var res = results[r];
    var eqPct = fmtPct(res.equity * 100);
    var barWidth = Math.round(res.equity * 100);
    var qualClass = res.guidance.quality === 'good' ? 'val-pos' : res.guidance.quality === 'bad' ? 'val-neg' : 'c-gold';

    curvePoints.push({ street: res.street, equity: res.equity });

    html += '<div class="eq-row">';
    html += '<div class="row center">';
    html += '<div class="c-gold fw-semibold eq-street">' + res.street + '</div>';
    if (res.texture) {
      var texCls = res.texture.wetness === 'wet' ? 'tex-wet' : res.texture.wetness === 'dry' ? 'tex-dry' : 'tex-med';
      html += '<span class="badge board-texture-badge ' + texCls + '">' + res.texture.label + '</span>';
    }
    html += '<div class="eq-pct">' + eqPct + '</div>';
    html += '<div class="eq-bar-track"><div class="eq-bar-fill" style="width:' + barWidth + '%"></div></div>';
    html += '</div>';

    var metaParts = [];
    if (res.boardCards && res.boardCards.length > 0) {
      metaParts.push(displayCards(res.boardCards.map(normCard)));
    }
    if (res.potSize > 0) {
      metaParts.push('Pot: ' + fmt(res.potSize));
    }
    if (res.playersActive > 0) {
      metaParts.push(res.playersActive + '-way');
    }
    if (metaParts.length > 0) {
      html += '<div class="text-meta eq-meta-line">' + metaParts.join(' · ') + '</div>';
    }

    var hasBottom = res.madeHand || res.guidance.text;
    if (hasBottom) {
      html += '<div class="eq-row-bottom">';
      if (res.madeHand) {
        html += '<div class="row wrap center">';
        html += '<span class="badge badge-neutral">' + res.madeHand.label + '</span>';
        if (res.madeHand.draws.length) {
          for (var dri = 0; dri < res.madeHand.draws.length; dri++) {
            html += '<span class="badge badge-warn draw-outs">' + res.madeHand.draws[dri] + '</span>';
          }
        }
        html += '</div>';
      }
      html += '<div class="text-micro eq-detail ' + qualClass + '">' + res.actionDesc + ' ' + res.guidance.text + '</div>';
      html += '</div>';
    }
    html += '</div>';
  }

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

  if (summary && summary.text) {
    var sumClass = summary.quality === 'good' ? 'val-pos' : summary.quality === 'bad' ? 'val-neg' : 'c-gold';
    html += '<div class="box eq-summary">';
    html += '<div class="card-title c-gold">Hand Summary</div>';
    html += '<div class="text-body eq-summary-text ' + sumClass + '">' + summary.text + '</div>';
    html += '</div>';
  }

  var hasFlopOrTurn = results.some(function (r) { return r.street === 'Flop' || r.street === 'Turn'; });
  var caveats = '<div class="text-micro eq-caveats">';
  caveats += 'Equity calculated against a single random hand. In multiway pots, true equity may be lower.';
  if (hasFlopOrTurn) {
    caveats += ' Pot odds comparisons use raw equity; implied odds (potential to win more on later streets) are not factored in and may justify calls that appear unprofitable.';
  }
  caveats += '</div>';
  html += caveats;

  html += '</div>';
  container.innerHTML = html;
}

function injectEquityButton(box, hand) {
  var slot = box.querySelector('#equity-slot');
  if (!slot) return;

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
  btn.className = 'btn btn-secondary';
  btn.id = 'mc-sim-btn';
  btn.textContent = 'Run Equity Simulation';
  slot.appendChild(btn);

  btn.onclick = function () {
    slot.innerHTML = '<div class="eq-spinner"><div class="eq-spinner-ring"></div><span class="text-meta eq-spinner-text">Simulating...</span></div>';

    setTimeout(function () {
      var results = runEquitySimulation(hand);
      renderEquityResults(slot, results);
    }, 50);
  };
}