// ── MY GAME PANEL ────────────────────────────────────────────────────────────

function renderMyGame(container, d, hands) {
  function sev(v, rLo, rHi, aLo, aHi) {
    if (v === null) return 'text';
    if (v <= rLo || v >= rHi) return 'red';
    if (v <= aLo || v >= aHi) return 'amber';
    return 'green';
  }

  var playerName = State.meta.player || detectPlayerFromActions(hands) || 'Unknown';
  var exportDate = State.meta.exportedAt
    ? new Date(State.meta.exportedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';

  var html = '<div class="mygame-wrap">';

  // ── Section 1: Header ──
  html += '<div class="profile-header">';
  html += '<div class="dim-label mb-12">MY GAME</div>';
  html += '<div class="profile-name">' + playerName + '</div>';
  html += '<div class="meta-text">';
  if (exportDate) html += 'Last session: ' + exportDate + ' &middot; ';
  html += d.n + ' hands</div>';
  html += '</div>';

  // ── Section 2: Stat line ──
  var vpipVal   = pct(d.vpip, d.n);
  var pfrVal    = pct(d.pfrHands, d.n);
  var limpVal   = pct(d.limpHands, d.n);
  var aggVal    = pct(d.raises, d.raises + d.calls + d.checks);
  var ftrVal    = pct(d.foldedToRaise, d.facedRaise);
  var cbetVal   = pct(d.cbetDone, d.cbetOpps);
  var wtsdVal   = pct(d.wentToShowdown, d.sawFlop);

  var statItems = [
    { l: tipWrap('VPIP'),          v: vpipVal !== null ? vpipVal + '%' : '—',  c: sev(vpipVal, 15, 60, 20, 50) },
    { l: tipWrap('PFR'),           v: pfrVal !== null ? pfrVal + '%' : '—',    c: sev(pfrVal, 5, 50, 10, 40) },
    { l: 'Limp',                   v: limpVal !== null ? limpVal + '%' : '—',  c: sev(limpVal, -1, 25, -1, 15) },
    { l: tipWrap('Aggression'),    v: aggVal !== null ? aggVal + '%' : '—',    c: sev(aggVal, 12, 60, 15, 45) },
    { l: 'Fold to Raise',         v: ftrVal !== null ? ftrVal + '%' : '—',    c: sev(ftrVal, 20, 70, 25, 60) },
    { l: tipWrap('C-Bet'),         v: cbetVal !== null ? cbetVal + '%' : '—',  c: sev(cbetVal, 30, 90, 40, 75) },
    { l: 'WTSD',                   v: wtsdVal !== null ? wtsdVal + '%' : '—',  c: sev(wtsdVal, 20, 50, 25, 40) },
  ];

  var smallSample = d.n < 30;
  var dimStyle = smallSample ? ' style="opacity:0.45"' : '';

  html += '<div class="sec-subtitle mt-20">Stat Line</div>';
  if (smallSample) {
    html += '<div class="meta-text mb-12">Stats from ' + d.n + ' hands. These become reliable around 100+ hands.</div>';
  }
  html += '<div class="mini-row"' + dimStyle + '>' + statItems.map(function(m) {
    var color = m.c;
    return '<div class="mini"><div class="mini-l dim-label">' + m.l + '</div><div class="serif-value" style="color:var(--' + color + ')">' + m.v + '</div></div>';
  }).join('') + '</div>';

  // ── Section 3: Player type badge ──
  html += '<div class="sec-subtitle mt-20">Player Type</div>';
  if (d.n < 30) {
    html += '<div class="meta-text">Not enough data</div>';
  } else {
    var typeLabel, typeDesc;
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
    html += '<div style="margin:8px 0 12px;display:flex;align-items:baseline;flex-wrap:wrap;gap:6px 12px;">';
    html += '<div style="font-family:\'Cormorant Garamond\',serif;font-size:28px;font-weight:700;color:var(--gold);line-height:1;">' + typeLabel + '</div>';
    html += '<div class="meta-text" style="flex:1;min-width:180px;">' + typeDesc + '</div>';
    html += '<div>';
    html += '<span class="chip">VPIP: ' + (vpipVal !== null ? vpipVal + '%' : '—') + '</span> ';
    html += '<span class="chip">Agg: ' + (aggVal !== null ? aggVal + '%' : '—') + '</span>';
    html += '</div>';
    html += '</div>';
  }

  // Skip strengths/leaks/sessions for small samples
  if (!smallSample) {

    // ── Helper: early/late position VPIP ──
    var earlyPos = ['UTG', 'UTG+1', 'MP'];
    var latePos = ['CO', 'BTN'];
    var earlyVpip = 0, earlyHands = 0, lateVpip = 0, lateHands = 0;
    for (var ep = 0; ep < earlyPos.length; ep++) {
      var p = earlyPos[ep];
      if (d.posMap[p]) { earlyVpip += d.posMap[p].vpip; earlyHands += d.posMap[p].hands; }
    }
    for (var lp = 0; lp < latePos.length; lp++) {
      var p2 = latePos[lp];
      if (d.posMap[p2]) { lateVpip += d.posMap[p2].vpip; lateHands += d.posMap[p2].hands; }
    }
    var epVpip = pct(earlyVpip, earlyHands);
    var lpVpip = pct(lateVpip, lateHands);

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

    // ── Section 4: Strengths ──
    var strengths = [];
    if (bestPos && bestPosPnl > 0) {
      strengths.push({ score: bestPosPnl, html: ins('g', 'Best seat: ' + bestPos, 'Your ' + bestPos + ' play is profitable at ' + fmtPnl(bestPosPnl) + '. You win ' + (bestPosWr !== null ? bestPosWr : '?') + '% from this seat.', [{ v: bestPos + ': ' + fmtPnl(bestPosPnl) }]) });
    }
    if (aggVal !== null && aggVal >= 15 && aggVal <= 40) {
      strengths.push({ score: 40 - Math.abs(27.5 - aggVal), html: ins('g', 'Balanced aggression', aggVal + '% aggression is solid. You bet for value without overbluffing.', [{ v: 'Agg: ' + aggVal + '%' }]) });
    }
    if (cbetVal !== null && cbetVal >= 50 && cbetVal <= 75) {
      strengths.push({ score: 75 - Math.abs(62.5 - cbetVal), html: ins('g', 'Good c-bet rate', 'You continuation bet ' + cbetVal + '% of the time. Enough to maintain initiative without being auto-pilot.', [{ v: 'C-Bet: ' + cbetVal + '%' }]) });
    }
    if (f3b !== null && f3b < 55 && d.foldTo3betOpps >= 5) {
      strengths.push({ score: 55 - f3b, html: ins('g', 'Handles 3-bets', 'You fold to 3-bets ' + f3b + '% of the time. Not giving up opens too cheaply.', [{ v: 'F3B: ' + f3b + '%' }]) });
    }
    if (wtsdVal !== null && wtsdVal >= 25 && wtsdVal <= 35) {
      strengths.push({ score: 35 - Math.abs(30 - wtsdVal), html: ins('g', 'Selective showdowns', 'You reach showdown ' + wtsdVal + '% after seeing a flop. Picking spots well.', [{ v: 'WTSD: ' + wtsdVal + '%' }]) });
    }
    if (epVpip !== null && epVpip < 30 && earlyHands >= 10) {
      strengths.push({ score: 30 - epVpip, html: ins('g', 'Tight early', 'Only ' + epVpip + '% VPIP from early position. Good discipline where you act first.', [{ v: 'EP VPIP: ' + epVpip + '%' }]) });
    }
    if (lpVpip !== null && lpVpip > 40 && lateHands >= 10) {
      strengths.push({ score: lpVpip - 40, html: ins('g', 'Active late', 'Playing ' + lpVpip + '% from CO/BTN. Using positional advantage.', [{ v: 'LP VPIP: ' + lpVpip + '%' }]) });
    }
    if (limpVal !== null && limpVal < 10) {
      strengths.push({ score: 10 - limpVal, html: ins('g', 'Rarely limps', 'Only ' + limpVal + '% limp rate. You enter pots with initiative.', [{ v: 'Limp: ' + limpVal + '%' }]) });
    }
    if (pfrVal !== null && pfrVal > 15) {
      strengths.push({ score: pfrVal - 15, html: ins('g', 'Opens with raises', 'PFR of ' + pfrVal + '%. You raise when you play, putting opponents on the defensive.', [{ v: 'PFR: ' + pfrVal + '%' }]) });
    }

    strengths.sort(function(a, b) { return b.score - a.score; });
    if (strengths.length > 4) strengths = strengths.slice(0, 4);

    if (strengths.length) {
      html += '<div class="sec-subtitle mt-20">Strengths</div>';
      html += '<div class="ins-grid">' + strengths.map(function(s) { return s.html; }).join('') + '</div>';
    }

    // ── Section 5: Exploitable leaks ──
    var leaks = [];
    if (limpVal !== null && limpVal > 15) {
      var lSev = limpVal > 25 ? 'r' : 'a';
      leaks.push({ score: limpVal - 15, sev: lSev, label: 'Limping too much', html: ins(lSev, 'Limping too much', 'You limp ' + limpVal + '% of hands. Limping gives up initiative and lets opponents see cheap flops with position.', [{ v: 'Limp: ' + limpVal + '%' }]) });
    }
    if (ftrVal !== null && ftrVal > 60 && d.facedRaise >= 5) {
      var fSev = ftrVal > 70 ? 'r' : 'a';
      leaks.push({ score: ftrVal - 60, sev: fSev, label: 'Folding to pressure', html: ins(fSev, 'Folding to pressure', 'You fold ' + ftrVal + '% when raised. Opponents can push you off hands cheaply.', [{ v: 'FTR: ' + ftrVal + '%' }]) });
    }
    if (cbetVal !== null && cbetVal < 40 && d.cbetOpps >= 5) {
      var cSev = cbetVal < 25 ? 'r' : 'a';
      leaks.push({ score: 40 - cbetVal, sev: cSev, label: 'Low c-bet', html: ins(cSev, 'Low c-bet', 'You only c-bet ' + cbetVal + '%. After raising preflop, follow through on the flop or opponents learn you give up easily.', [{ v: 'C-Bet: ' + cbetVal + '%' }]) });
    }
    if (wtsdVal !== null && wtsdVal > 40) {
      var wSev = wtsdVal > 50 ? 'r' : 'a';
      leaks.push({ score: wtsdVal - 40, sev: wSev, label: 'Paying off too much', html: ins(wSev, 'Paying off too much', 'You go to showdown ' + wtsdVal + '% of the time. Folding more on later streets saves money against strong hands.', [{ v: 'WTSD: ' + wtsdVal + '%' }]) });
    }
    if (epVpip !== null && epVpip > 45 && earlyHands >= 10) {
      var eSev = epVpip > 55 ? 'r' : 'a';
      leaks.push({ score: epVpip - 45, sev: eSev, label: 'Too loose early', html: ins(eSev, 'Too loose early', 'Playing ' + epVpip + '% from early position. These seats act first on every street; tighten up.', [{ v: 'EP VPIP: ' + epVpip + '%' }]) });
    }
    if (aggVal !== null && aggVal < 15) {
      leaks.push({ score: 15 - aggVal, sev: 'r', label: 'Too passive', html: ins('r', 'Too passive', 'Only ' + aggVal + '% aggression. You check and call when you should be betting for value.', [{ v: 'Agg: ' + aggVal + '%' }]) });
    }
    if (aggVal !== null && aggVal > 50) {
      leaks.push({ score: aggVal - 50, sev: 'a', label: 'Over-aggressive', html: ins('a', 'Over-aggressive', 'Aggression at ' + aggVal + '%. In TC where players call wide, excessive raising gets called down.', [{ v: 'Agg: ' + aggVal + '%' }]) });
    }
    if (fcbet !== null && fcbet > 65 && d.foldToCbetOpps >= 5) {
      var fcSev = fcbet > 75 ? 'r' : 'a';
      leaks.push({ score: fcbet - 65, sev: fcSev, label: 'Overfolds to c-bets', html: ins(fcSev, 'Overfolds to c-bets', 'You fold to c-bets ' + fcbet + '% of the time. Opponents can bluff you off the flop profitably.', [{ v: 'FCB: ' + fcbet + '%' }]) });
    }
    if (pfrVal !== null && pfrVal < 8) {
      leaks.push({ score: 8 - pfrVal, sev: 'r', label: 'Passive opener', html: ins('r', 'Passive opener', 'PFR of only ' + pfrVal + '%. You play hands but rarely raise, entering pots without initiative.', [{ v: 'PFR: ' + pfrVal + '%' }]) });
    }

    leaks.sort(function(a, b) { return b.score - a.score; });
    var allLeaks = leaks.slice();
    if (leaks.length > 4) leaks = leaks.slice(0, 4);

    if (leaks.length) {
      html += '<div class="sec-subtitle mt-20">Exploitable Leaks</div>';
      html += '<div class="ins-grid">' + leaks.map(function(l) { return l.html; }).join('') + '</div>';
    }

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

        html += '<div style="margin:12px 0;padding:12px 16px;border:1px solid var(--border);border-radius:8px;">';
        html += '<div class="dim-label mb-12">' + sess.label + '</div>';
        html += '<div style="display:flex;gap:12px;align-items:baseline;flex-wrap:wrap;">';
        html += '<span class="meta-text">' + tableName + '</span>';
        html += '<span class="meta-text">' + s.hands.length + ' hands</span>';
        html += '<span class="serif-value" style="font-size:16px;color:' + pnlCol + ';">' + pnlDisplay + '</span>';
        html += '</div>';

        // Pattern detection
        var sessionData = analyse(s.hands);
        var patterns = detectSessionPatterns(sessionData, d);

        if (patterns.length) {
          var frameWord = sess.frame === 'right' ? 'what went right' : 'what went wrong';
          html += '<div class="meta-text" style="margin-top:8px;font-style:italic;">Patterns — ' + frameWord + ':</div>';
          html += '<ul style="margin:4px 0 0 16px;padding:0;">';
          for (var pi2 = 0; pi2 < patterns.length; pi2++) {
            html += '<li class="meta-text" style="margin-bottom:4px;">' + patterns[pi2].text + '</li>';
          }
          html += '</ul>';
        } else if (sess.frame === 'wrong') {
          html += '<div class="meta-text" style="margin-top:8px;">No clear pattern detected. Review the hands below for specific spots.</div>';
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
    } else if (sessions.length > 0) {
      html += '<div class="sec-subtitle mt-20">Sessions</div>';
      html += '<div class="meta-text">Not enough separate table sessions to compare patterns. Keep playing.</div>';
    }

  } // end !smallSample

  html += '</div>';
  container.innerHTML = html;
}

// ── Session helpers ────────────────────────────────────────────────────────

function buildSessions(hands) {
  if (!hands.length) return [];

  var sorted = hands.slice().sort(function(a, b) {
    return (a.timestamp || 0) - (b.timestamp || 0);
  });

  var TWO_HOURS = 2 * 60 * 60 * 1000;
  var TWO_DAYS  = 2 * 24 * 60 * 60 * 1000;

  var sessions = [];
  var current = { tableId: inferTable(sorted[0]), hands: [sorted[0]], startTs: sorted[0].timestamp || 0 };

  for (var i = 1; i < sorted.length; i++) {
    var tid = inferTable(sorted[i]);
    var ts  = sorted[i].timestamp || 0;
    var prevTs = sorted[i - 1].timestamp || 0;
    var gap = ts - prevTs;
    var span = ts - current.startTs;

    if (tid !== current.tableId || gap > TWO_HOURS || span > TWO_DAYS) {
      sessions.push(current);
      current = { tableId: tid, hands: [sorted[i]], startTs: ts };
    } else {
      current.hands.push(sorted[i]);
    }
  }
  sessions.push(current);

  return sessions.filter(function(s) {
    return s.hands.length >= 5 && s.hands.some(function(h) { return isCashHand(h); });
  });
}

function sessionPnl(session) {
  var pnl = 0;
  for (var i = 0; i < session.hands.length; i++) {
    var h = session.hands[i];
    if (!isCashHand(h) || !h.outcome) continue;
    var inv = getInvested(h);
    if (h.outcome.result === 'won') {
      pnl += (h.outcome.amount || 0) - inv;
    } else {
      pnl -= inv;
    }
  }
  return pnl;
}

function detectSessionPatterns(sessionData, overallData) {
  var patterns = [];
  var sVpip = pct(sessionData.vpip, sessionData.n);
  var oVpip = pct(overallData.vpip, overallData.n);
  var sAgg = pct(sessionData.raises, sessionData.raises + sessionData.calls + sessionData.checks);
  var oAgg = pct(overallData.raises, overallData.raises + overallData.calls + overallData.checks);
  var sLimp = pct(sessionData.limpHands, sessionData.n);
  var oLimp = pct(overallData.limpHands, overallData.n);
  var sPfr = pct(sessionData.pfrHands, sessionData.n);
  var oPfr = pct(overallData.pfrHands, overallData.n);
  var sCbet = pct(sessionData.cbetDone, sessionData.cbetOpps);
  var oCbet = pct(overallData.cbetDone, overallData.cbetOpps);
  var sWtsd = pct(sessionData.wentToShowdown, sessionData.sawFlop);
  var oWtsd = pct(overallData.wentToShowdown, overallData.sawFlop);

  var earlyPos = ['UTG', 'UTG+1', 'MP'];
  var sEarlyVpip = 0, sEarlyHands = 0;
  for (var ep = 0; ep < earlyPos.length; ep++) {
    var p = earlyPos[ep];
    if (sessionData.posMap[p]) {
      sEarlyVpip += sessionData.posMap[p].vpip;
      sEarlyHands += sessionData.posMap[p].hands;
    }
  }
  var sEpVpip = pct(sEarlyVpip, sEarlyHands);
  var oEarlyVpip = 0, oEarlyHands = 0;
  for (var ep2 = 0; ep2 < earlyPos.length; ep2++) {
    var p2 = earlyPos[ep2];
    if (overallData.posMap[p2]) {
      oEarlyVpip += overallData.posMap[p2].vpip;
      oEarlyHands += overallData.posMap[p2].hands;
    }
  }
  var oEpVpip = pct(oEarlyVpip, oEarlyHands);

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
