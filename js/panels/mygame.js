// ── MY GAME PANEL ────────────────────────────────────────────────────────────

function renderMyGame(container, d, hands) {
  var playerName = State.meta.player || detectPlayerFromActions(hands) || 'Unknown';
  var exportDate = State.meta.exportedAt
    ? new Date(State.meta.exportedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';

  var html = '<div class="mygame-wrap">';

  // ── Section 1: Header + Player Type (single row) ──
  var vpipVal   = pct(d.vpip, d.n);
  var pfrVal    = pct(d.pfrHands, d.n);
  var limpVal   = pct(d.limpHands, d.n);
  var aggVal    = calcAggression(d.raises, d.calls, d.checks);
  var ftrVal    = pct(d.foldedToRaise, d.facedRaise);
  var cbetVal   = pct(d.cbetDone, d.cbetOpps);
  var wtsdVal   = pct(d.wentToShowdown, d.sawFlop);

  var smallSample = d.n < 30;

  var typeLabel = '', typeDesc = '';
  if (!smallSample) {
    if (vpipVal <= 30 && aggVal >= 25) {
      typeLabel = 'Shark';
      typeDesc = 'Tight and aggressive. Picks spots well and applies pressure.';
    } else if (vpipVal <= 30 && aggVal < 25) {
      typeLabel = 'Rock';
      typeDesc = 'Tight and passive. Only plays premiums, rarely bets without the goods.';
    } else if (vpipVal > 30 && aggVal >= 25) {
      typeLabel = 'Cannon';
      typeDesc = 'Loose and aggressive. Plays lots of hands and fires often.';
    } else {
      typeLabel = 'Station';
      typeDesc = 'Loose and passive. Calls too much, folds too little, rarely raises.';
    }
  }

  html += '<div style="display:flex;flex-wrap:wrap;gap:16px 40px;margin-bottom:20px;align-items:flex-start;">';
  // Left: identity
  html += '<div>';
  html += '<div class="dim-label mb-12">MY GAME</div>';
  html += '<div class="profile-name" style="margin:0;">' + playerName + '</div>';
  html += '<div style="font-size:14px;color:var(--dim);margin-top:4px;">';
  if (exportDate) html += exportDate + ' &middot; ';
  html += d.n + ' hands';
  html += '</div>';
  html += '</div>';
  // Right: player type
  if (typeLabel) {
    html += '<div style="flex:1;min-width:220px;">';
    html += '<div class="dim-label mb-12">PLAYER TYPE</div>';
    html += '<div style="font-family:\'Cormorant Garamond\',serif;font-size:28px;font-weight:700;color:var(--gold);line-height:1;">' + typeLabel + '</div>';
    html += '<div style="font-size:13px;color:var(--dim);margin-top:6px;">' + typeDesc + '</div>';
    html += '</div>';
  }
  html += '</div>';

  // ── Section 2: Stat line ──
  var statItems = [
    { l: tipWrap('VPIP'),          v: vpipVal !== null ? vpipVal + '%' : '—',  c: sev(vpipVal, 15, 60, 20, 50) },
    { l: tipWrap('PFR'),           v: pfrVal !== null ? pfrVal + '%' : '—',    c: sev(pfrVal, 5, 50, 10, 40) },
    { l: 'Limp',                   v: limpVal !== null ? limpVal + '%' : '—',  c: sev(limpVal, -1, 25, -1, 15) },
    { l: tipWrap('Aggression'),    v: aggVal !== null ? aggVal + '%' : '—',    c: sev(aggVal, 12, 60, 15, 45) },
    { l: 'Fold to Raise',         v: ftrVal !== null ? ftrVal + '%' : '—',    c: sev(ftrVal, 20, 70, 25, 60) },
    { l: tipWrap('C-Bet'),         v: cbetVal !== null ? cbetVal + '%' : '—',  c: sev(cbetVal, 30, 90, 40, 75) },
    { l: 'WTSD',                   v: wtsdVal !== null ? wtsdVal + '%' : '—',  c: sev(wtsdVal, 20, 50, 25, 40) },
  ];

  var dimStyle = smallSample ? ' style="opacity:0.45"' : '';

  html += '<div class="sec-subtitle mt-20">Stat Line</div>';
  if (smallSample) {
    html += '<div style="font-size:13px;color:var(--dim);margin-bottom:12px;">Stats from ' + d.n + ' hands. These become reliable around 100+ hands.</div>';
  }
  html += '<div class="mini-row"' + dimStyle + '>' + statItems.map(function(m) {
    var color = m.c;
    return '<div class="mini"><div class="mini-l dim-label">' + m.l + '</div><div class="serif-value" style="color:var(--' + color + ')">' + m.v + '</div></div>';
  }).join('') + '</div>';

  // Skip strengths/leaks/sessions for small samples
  if (!smallSample) {

    // ── Helper: early/late position VPIP ──
    var earlyPos = ['UTG', 'UTG+1', 'MP'];
    var latePos = ['CO', 'BTN'];
    var earlyGroup = calcPositionGroupVpip(d.posMap, earlyPos);
    var lateGroup = calcPositionGroupVpip(d.posMap, latePos);
    var epVpip = earlyGroup.vpip, earlyHands = earlyGroup.hands;
    var lpVpip = lateGroup.vpip, lateHands = lateGroup.hands;

    // Best position by P&L
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

    // ── Section 4: Strengths (via Insight Engine) ──
    var engineStrengths = InsightEngine.forPanel('mygame', 12).filter(function(i) { return i.sev === 'g'; });
    if (engineStrengths.length > 4) engineStrengths = engineStrengths.slice(0, 4);
    if (engineStrengths.length) {
      html += '<div class="sec-subtitle mt-20">Strengths</div>';
      html += '<div class="ins-grid">' + engineStrengths.map(function(i) { return renderRuleInsight(i); }).join('') + '</div>';
    }

    // ── Section 5: Exploitable leaks (via Insight Engine) ──
    var engineLeaks = InsightEngine.forPanel('mygame', 12).filter(function(i) { return i.sev === 'r' || i.sev === 'a'; });
    var allLeaks = engineLeaks.slice();
    if (engineLeaks.length > 6) engineLeaks = engineLeaks.slice(0, 6);

    if (engineLeaks.length) {
      // Narrative summary
      var narr = InsightEngine.narrativeFor('mygame');
      if (narr && narr.narrative) {
        html += '<div class="sec-subtitle mt-20">Analysis</div>';
        html += '<div class="engine-narrative">' + narr.narrative + '</div>';
      }
      html += '<div class="sec-subtitle mt-20">Exploitable Leaks</div>';
      html += '<div class="ins-grid">' + engineLeaks.map(function(i) { return renderRuleInsight(i); }).join('') + '</div>';
    }

    // ── Section 5b: Leak Finder (merged from Leak Finder panel) ──
    html += '<div class="sec-subtitle mt-20">Leak Finder</div>';
    var _lkEl = document.createElement('div');
    renderLeaks(_lkEl, d, hands);
    html += _lkEl.innerHTML.replace(/<div class="section-title">[^<]*<\/div>/, '').replace(/<div class="desc-text mb-24">[^<]*<\/div>/, '');

    // ── Section 6: Work on next ──
    html += '<div class="sec-subtitle mt-20">Work On Next</div>';
    var workOn = null;
    // Priority order
    if (!workOn && aggVal !== null && aggVal < 15) workOn = { sev: 'r', label: 'Too passive', desc: 'Only ' + aggVal + '% aggression. You check and call when you should be betting for value.', action: 'Next 20 hands: when you have a strong hand, raise instead of calling. Track whether your aggression % moves above 20%.' };
    if (!workOn && limpVal !== null && limpVal > 25) workOn = { sev: 'r', label: 'Limping too much', desc: 'You limp ' + limpVal + '% of hands. Limping gives up initiative.', action: 'Next 20 hands: every time you want to limp, either raise or fold instead. No flat calls preflop without a raise in front.' };
    if (!workOn && ftrVal !== null && ftrVal > 70 && d.facedRaise >= 5) workOn = { sev: 'r', label: 'Folding to pressure', desc: 'You fold ' + ftrVal + '% when raised.', action: 'Next session: when raised, pause and consider if your hand is strong enough to continue. Look for spots to call or re-raise instead of auto-folding.' };
    if (!workOn && cbetVal !== null && cbetVal < 25 && d.cbetOpps >= 5) workOn = { sev: 'r', label: 'Low c-bet', desc: 'You only c-bet ' + cbetVal + '%.', action: 'Next session: when you raised preflop and the flop comes, bet at least half the time regardless of whether you connected. Maintaining aggression wins pots.' };
    if (!workOn && wtsdVal !== null && wtsdVal > 50) workOn = { sev: 'r', label: 'Paying off too much', desc: 'WTSD at ' + wtsdVal + '%.', action: 'Next session: on the river facing a big bet, ask yourself if your hand beats their value range. If not, fold. Saving one big call per session adds up.' };
    if (!workOn && epVpip !== null && epVpip > 55 && earlyHands >= 10) workOn = { sev: 'r', label: 'Too loose early', desc: 'EP VPIP at ' + epVpip + '%.', action: 'Next session: from UTG/MP, only play top 25% of hands. Fold marginal suited connectors and weak aces from these seats.' };
    if (!workOn && allLeaks.length) workOn = { sev: allLeaks[0].sev, label: allLeaks[0].label, desc: '', action: 'Focus on this pattern in your next session and track whether the stat improves.' };

    if (workOn) {
      var badgeColor = workOn.sev === 'r' ? 'red' : 'amber';
      html += '<div class="ins" style="border-left:3px solid var(--' + badgeColor + ');padding-left:16px;margin:12px 0;">';
      html += '<div class="ins-badge ' + workOn.sev + '"><div class="ins-dot"></div><div class="ins-word">Work on this</div></div>';
      html += '<div class="ins-label dim-label">' + workOn.label + '</div>';
      if (workOn.desc) html += '<div class="ins-text">' + workOn.desc + '</div>';
      html += '<div class="ins-text" style="margin-top:8px;color:var(--text);">' + workOn.action + '</div>';
      html += '</div>';
    } else {
      html += '<div class="ins" style="border-left:3px solid var(--green);padding-left:16px;margin:12px 0;">';
      html += '<div class="ins-badge g"><div class="ins-dot"></div><div class="ins-word">Solid game</div></div>';
      html += '<div class="ins-text">No major leaks detected from ' + d.n + ' hands. Keep playing to refine the picture.</div>';
      html += '</div>';
    }

    // ── Section 7: Best and worst session ──
    var sessions = buildSessions(hands);
    if (sessions.length >= 3) {
      // Compute P&L for each session
      for (var si = 0; si < sessions.length; si++) {
        sessions[si].pnl = sessionPnl(sessions[si]);
      }
      sessions.sort(function(a, b) { return b.pnl - a.pnl; });

      // Handle ties: prefer more hands
      var best = sessions[0];
      var worst = sessions[sessions.length - 1];
      for (var bi = 1; bi < sessions.length; bi++) {
        if (sessions[bi].pnl === best.pnl && sessions[bi].hands.length > best.hands.length) best = sessions[bi];
      }
      for (var wi = sessions.length - 2; wi >= 0; wi--) {
        if (sessions[wi].pnl === worst.pnl && sessions[wi].hands.length > worst.hands.length) worst = sessions[wi];
      }

      html += '<div class="sec-subtitle mt-20">Best & Worst Sessions</div>';
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px;">';

      var sessionPairs = [
        { session: best, label: 'Best Session', frame: 'right' },
        { session: worst, label: 'Worst Session', frame: 'wrong' },
      ];

      for (var sp = 0; sp < sessionPairs.length; sp++) {
        var sess = sessionPairs[sp];
        var s = sess.session;
        var tableName = s.tableId ? getTableLabel(s.tableId) : 'Unknown Table';
        var isTourney = s.hands.some(function(h) { return !isCashHand(h); });
        var pnlDisplay = isTourney ? 'Tournament' : fmtPnl(s.pnl);
        var pnlCol = isTourney ? 'var(--text)' : pnlColor(s.pnl);

        var sessStart = s.startTs ? new Date(s.startTs).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
        var lastHand = s.hands[s.hands.length - 1];
        var sessEnd = (lastHand && lastHand.timestamp) ? new Date(lastHand.timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
        var dateLabel = sessStart ? (sessStart === sessEnd ? sessStart : sessStart + ' – ' + sessEnd) : '';

        html += '<div style="padding:12px 16px;border:1px solid var(--border);border-radius:8px;">';
        html += '<div class="dim-label mb-12">' + sess.label + '</div>';
        if (dateLabel) html += '<div style="font-size:13px;color:var(--dim);margin-bottom:4px;">' + dateLabel + '</div>';
        html += '<div style="font-size:13px;color:var(--dim);">' + tableName + ' &middot; ' + s.hands.length + ' hands &middot; <span class="serif-value" style="font-size:16px;color:' + pnlCol + ';">' + pnlDisplay + '</span></div>';

        // Pattern detection
        var sessionData = analyse(s.hands);
        var patterns = detectSessionPatterns(sessionData, d);

        if (patterns.length) {
          var frameWord = sess.frame === 'right' ? 'what went right' : 'what went wrong';
          html += '<div style="font-size:13px;color:var(--dim);margin-top:8px;font-style:italic;">Patterns — ' + frameWord + ':</div>';
          html += '<ul style="margin:4px 0 0 16px;padding:0;">';
          for (var pi2 = 0; pi2 < patterns.length; pi2++) {
            html += '<li style="font-size:13px;color:var(--dim);margin-bottom:4px;">' + patterns[pi2].text + '</li>';
          }
          html += '</ul>';
        } else if (sess.frame === 'wrong') {
          html += '<div style="font-size:13px;color:var(--dim);margin-top:8px;">No clear pattern detected. Review the hands below for specific spots.</div>';
        }

        var seeHandsBtnId = 'see-sess-' + Math.random().toString(36).slice(2, 8);
        var sessTitle = sess.label + ' Hands';
        html += '<button class="example-hand-btn" id="' + seeHandsBtnId + '" style="margin-top:8px;">Show hands played</button>';
        setTimeout((function(id, title, h2) {
          return function() {
            var el = document.getElementById(id);
            if (el) el.onclick = function() { showExampleHandListModal(title, h2); };
          };
        })(seeHandsBtnId, sessTitle, s.hands), 50);

        html += '</div>';
      }
      html += '</div>';
    } else if (sessions.length > 0) {
      html += '<div class="sec-subtitle mt-20">Sessions</div>';
      html += '<div class="meta-text">Not enough separate table sessions to compare patterns. Keep playing.</div>';
    }

  } // end !smallSample

  // ── Table Dynamics reference ──
  html += renderTableDynamicsReference(hands, d);

  html += '</div>';
  container.innerHTML = html;
}

// Parse a target range like "65-75%" or "40-50%" into [lo, hi] numbers.
function _parsePctRange(s) {
  if (!s) return null;
  var m = s.match(/(\d+)\s*-\s*(\d+)/);
  if (!m) return null;
  return [parseInt(m[1], 10), parseInt(m[2], 10)];
}

// Return { cls, label } verdict for an actual pct against a target range.
function _verdict(actual, lo, hi) {
  if (actual == null) return { cls: 'v-na', label: 'no data' };
  if (actual < lo) return { cls: 'v-low', label: 'too low' };
  if (actual > hi) return { cls: 'v-high', label: 'too high' };
  return { cls: 'v-ok', label: 'on target' };
}

// Render a "your X% vs target Y-Z% → verdict" row.
function _vsRow(label, actualPct, actualDenom, targetText) {
  var rng = _parsePctRange(targetText);
  var actualStr = (actualPct == null) ? '—' : actualPct + '%';
  var sampleStr = actualDenom != null ? ' <span class="dim-label">(' + actualDenom + ' spots)</span>' : '';
  var v = rng ? _verdict(actualPct, rng[0], rng[1]) : { cls: 'v-na', label: '' };
  return '<div class="dynamics-vs ' + v.cls + '">' +
    '<div class="dynamics-vs-top"><span>You: <strong>' + actualStr + '</strong>' + sampleStr + '</span>' +
    '<span class="dim-label">Target: ' + targetText + '</span></div>' +
    (v.label ? '<div class="dynamics-vs-verdict">' + v.label + '</div>' : '') +
    '</div>';
}

// Table Dynamics: compares YOUR actual play (c-bet %, VPIP per position) against
// the recommended targets for each bucket. Each card carries a clear verdict.
function renderTableDynamicsReference(hands, d) {
  var h = '<div class="sec-subtitle mt-20">Table Dynamics — You vs Target</div>';
  h += '<div class="desc-text mb-16">Your actual play at each table size and flop multiplicity, compared to the recommended benchmarks. <span class="v-ok">Green = on target</span>, <span class="v-low">amber = too low / too tight</span>, <span class="v-high">red = too high / too loose</span>.</div>';

  var seatKeys = Object.keys(SEAT_MATRIX).map(Number).sort(function(a, b) { return a - b; });

  // ── Seat-size cards: per-position VPIP vs target ──
  h += '<div class="sec-subtitle mt-12">By Table Size</div>';
  h += '<div class="dynamics-cards">';
  for (var si = 0; si < seatKeys.length; si++) {
    var seats = seatKeys[si];
    var entry = SEAT_MATRIX[seats];
    if (!entry) continue;
    var seatBucket = seats + 'p';
    var subD = d && d.bySeatBucket ? d.bySeatBucket[seatBucket] : null;
    var nHands = subD ? subD.n : 0;

    h += '<div class="dynamics-card">';
    h += '<div class="dynamics-card-head">' + seats + '-handed <span class="dim-label">(' + nHands + ' hands)</span></div>';
    if (!nHands) {
      h += '<div class="dynamics-card-note dim-label">No hands at this table size yet.</div>';
      h += '</div>';
      continue;
    }
    h += '<div class="dynamics-card-note">' + entry.notes + '</div>';

    // Per-position VPIP comparison
    h += '<table class="tbl mt-8 dynamics-pos-tbl"><thead><tr><th>Pos</th><th>You</th><th>Target</th><th>Hands</th></tr></thead><tbody>';
    for (var pi = 0; pi < entry.positions.length; pi++) {
      var p = entry.positions[pi];
      var g = entry.guideByPos[p];
      if (!g) continue;
      var pm = subD.posMap[p];
      var actPct = (pm && pm.hands > 0) ? pct(pm.vpip, pm.hands) : null;
      var rng = _parsePctRange(g.ideal);
      var cls = rng ? _verdict(actPct, rng[0], rng[1]).cls : 'v-na';
      h += '<tr class="' + cls + '"><td>' + p + '</td><td>' + (actPct != null ? actPct + '%' : '—') + '</td><td class="dim-label">' + g.ideal + '</td><td class="dim-label">' + (pm ? pm.hands : 0) + '</td></tr>';
    }
    h += '</tbody></table>';
    h += '</div>';
  }
  h += '</div>';

  // ── Flop multiplicity cards: c-bet % vs target ──
  h += '<div class="sec-subtitle mt-20">By Flop Players</div>';
  h += '<div class="dynamics-cards">';
  var flopKeys = ['HU', '3-way', 'multiway'];
  var flopLabels = { HU: 'Heads-up flop', '3-way': '3-way flop', multiway: 'Multiway flop (4+)' };
  for (var fk = 0; fk < flopKeys.length; fk++) {
    var bk = flopKeys[fk];
    var fe = FLOP_MATRIX[bk];
    var subF = d && d.byFlopBucket ? d.byFlopBucket[bk] : null;
    var nF = subF ? subF.n : 0;

    h += '<div class="dynamics-card">';
    h += '<div class="dynamics-card-head">' + flopLabels[bk] + ' <span class="dim-label">(' + nF + ' hands)</span></div>';
    if (!nF) {
      h += '<div class="dynamics-card-note dim-label">No flops with this many players yet.</div>';
      h += '</div>';
      continue;
    }
    h += '<div class="dynamics-card-note">' + fe.notes + '</div>';

    var cbetActual = subF.cbetOpps > 0 ? pct(subF.cbetDone, subF.cbetOpps) : null;
    h += _vsRow('C-bet', cbetActual, subF.cbetOpps, fe.cbetFreq);

    h += '<div class="dynamics-card-kv"><span>Target sizing</span><span>' + fe.cbetSizing + '</span></div>';
    h += '<div class="dynamics-card-kv"><span>Continue</span><span>' + fe.continueRange + '</span></div>';
    h += '</div>';
  }
  h += '</div>';

  return h;
}

// ── Session helpers ────────────────────────────────────────────────────────
// buildSessions() lives in js/helpers/sessions.js so the insight engine can use it.

function sessionPnl(session) {
  var pnl = 0;
  for (var i = 0; i < session.hands.length; i++) {
    var h = session.hands[i];
    if (!isCashHand(h) || !h.outcome) continue;
    pnl += getHandPnlValue(h);
  }
  return pnl;
}

function detectSessionPatterns(sessionData, overallData) {
  var patterns = [];
  var sVpip = pct(sessionData.vpip, sessionData.n);
  var oVpip = pct(overallData.vpip, overallData.n);
  var sAgg = calcAggression(sessionData.raises, sessionData.calls, sessionData.checks);
  var oAgg = calcAggression(overallData.raises, overallData.calls, overallData.checks);
  var sLimp = pct(sessionData.limpHands, sessionData.n);
  var oLimp = pct(overallData.limpHands, overallData.n);
  var sPfr = pct(sessionData.pfrHands, sessionData.n);
  var oPfr = pct(overallData.pfrHands, overallData.n);
  var sCbet = pct(sessionData.cbetDone, sessionData.cbetOpps);
  var oCbet = pct(overallData.cbetDone, overallData.cbetOpps);
  var sWtsd = pct(sessionData.wentToShowdown, sessionData.sawFlop);
  var oWtsd = pct(overallData.wentToShowdown, overallData.sawFlop);

  var earlyPos = ['UTG', 'UTG+1', 'MP'];
  var sEpGroup = calcPositionGroupVpip(sessionData.posMap, earlyPos);
  var sEpVpip = sEpGroup.vpip;
  var sEarlyHands = sEpGroup.hands;
  var oEpVpip = calcPositionGroupVpip(overallData.posMap, earlyPos).vpip;

  var THRESH = 10;

  if (sVpip !== null && oVpip !== null && sVpip - oVpip >= THRESH) {
    patterns.push({ stat: 'VPIP', session: sVpip, overall: oVpip, dir: 'up', text: 'Played looser than usual (' + sVpip + '% vs your average ' + oVpip + '%). More hands entered, more exposure.' });
  }
  if (sVpip !== null && oVpip !== null && oVpip - sVpip >= THRESH) {
    patterns.push({ stat: 'VPIP', session: sVpip, overall: oVpip, dir: 'down', text: 'Played tighter than usual (' + sVpip + '% vs your average ' + oVpip + '%). Fewer hands, less risk.' });
  }
  if (sAgg !== null && oAgg !== null && oAgg - sAgg >= THRESH) {
    patterns.push({ stat: 'Aggression', session: sAgg, overall: oAgg, dir: 'down', text: 'Aggression dropped to ' + sAgg + '% (average ' + oAgg + '%). More checking and calling, less betting.' });
  }
  if (sAgg !== null && oAgg !== null && sAgg - oAgg >= THRESH) {
    patterns.push({ stat: 'Aggression', session: sAgg, overall: oAgg, dir: 'up', text: 'Aggression spiked to ' + sAgg + '% (average ' + oAgg + '%). More raising, possibly over-bluffing.' });
  }
  if (sLimp !== null && oLimp !== null && sLimp - oLimp >= THRESH) {
    patterns.push({ stat: 'Limp', session: sLimp, overall: oLimp, dir: 'up', text: 'Limping spiked to ' + sLimp + '% (average ' + oLimp + '%). Entering pots without initiative.' });
  }
  if (sPfr !== null && oPfr !== null && oPfr - sPfr >= THRESH) {
    patterns.push({ stat: 'PFR', session: sPfr, overall: oPfr, dir: 'down', text: 'Preflop raise rate dropped to ' + sPfr + '% (average ' + oPfr + '%). Less initiative preflop.' });
  }
  if (sCbet !== null && oCbet !== null && oCbet - sCbet >= 15) {
    patterns.push({ stat: 'C-Bet', session: sCbet, overall: oCbet, dir: 'down', text: 'C-bet dropped to ' + sCbet + '% (average ' + oCbet + '%). Gave up flop initiative more often.' });
  }
  if (sWtsd !== null && oWtsd !== null && sWtsd - oWtsd >= THRESH) {
    patterns.push({ stat: 'WTSD', session: sWtsd, overall: oWtsd, dir: 'up', text: 'Went to showdown ' + sWtsd + '% (average ' + oWtsd + '%). Called down more often than usual.' });
  }
  if (sEpVpip !== null && oEpVpip !== null && sEpVpip - oEpVpip >= 15 && sEarlyHands >= 3) {
    patterns.push({ stat: 'EP VPIP', session: sEpVpip, overall: oEpVpip, dir: 'up', text: 'Early position VPIP was ' + sEpVpip + '% (average ' + oEpVpip + '%). Played too wide from bad seats.' });
  }

  return patterns;
}
