// ── SESSIONS ──────────────────────────────────────────────────────────────────
//
// Group raw hand records into sessions plus the helpers built on top:
//   buildSessions          group by table id, 15-minute gap, 2-day span.
//   sessionPnl             P&L for one session (cash hands only).
//   detectSessionPatterns  compare a session's stats against the player's
//                          overall and return human-readable patterns.
//   renderBestWorstSessions HTML block for the Trends panel showing the
//                          best and worst sessions side by side.
//   splitSessionHalves     split each session at its own midpoint and
//                          aggregate across sessions for within-session
//                          decline analysis (engine/patterns.js and the
//                          new Trends section both call this).

function buildSessions(hands) {
  if (!hands.length) return [];

  var sorted = hands.slice().sort(function(a, b) {
    return (a.timestamp || 0) - (b.timestamp || 0);
  });

  var GAP_LIMIT = 15 * 60 * 1000;       // 15 min gap starts a new session
  var TWO_DAYS  = 2 * 24 * 60 * 60 * 1000;

  var sessions = [];
  var current = { tableId: inferTable(sorted[0]), hands: [sorted[0]], startTs: sorted[0].timestamp || 0 };

  for (var i = 1; i < sorted.length; i++) {
    var tid = inferTable(sorted[i]);
    var ts  = sorted[i].timestamp || 0;
    var prevTs = sorted[i - 1].timestamp || 0;
    var gap = ts - prevTs;
    var span = ts - current.startTs;

    if (tid !== current.tableId || gap > GAP_LIMIT || span > TWO_DAYS) {
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

// P&L for a single session (cash hands only). Tournament hands ignored.
function sessionPnl(session) {
  var pnl = 0;
  for (var i = 0; i < session.hands.length; i++) {
    var h = session.hands[i];
    if (!isCashHand(h) || !h.outcome) continue;
    pnl += getHandPnlValue(h);
  }
  return pnl;
}

// Compare a single session's stats against the player's overall numbers and
// return a list of human-readable patterns.
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
  var sEpGroup = (typeof calcPositionGroupVpip === 'function') ? calcPositionGroupVpip(sessionData.posMap, earlyPos) : { vpip: null, hands: 0 };
  var sEpVpip = sEpGroup.vpip;
  var sEarlyHands = sEpGroup.hands;
  var oEpVpip = (typeof calcPositionGroupVpip === 'function') ? calcPositionGroupVpip(overallData.posMap, earlyPos).vpip : null;

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

// Best & Worst Sessions block for the Trends panel.
function renderBestWorstSessions(hands, overallData) {
  var sessions = buildSessions(hands);
  if (sessions.length < 3) return '';

  for (var si = 0; si < sessions.length; si++) {
    sessions[si].pnl = sessionPnl(sessions[si]);
  }
  sessions.sort(function(a, b) { return b.pnl - a.pnl; });

  var best = sessions[0];
  var worst = sessions[sessions.length - 1];
  for (var bi = 1; bi < sessions.length; bi++) {
    if (sessions[bi].pnl === best.pnl && sessions[bi].hands.length > best.hands.length) best = sessions[bi];
  }
  for (var wi = sessions.length - 2; wi >= 0; wi--) {
    if (sessions[wi].pnl === worst.pnl && sessions[wi].hands.length > worst.hands.length) worst = sessions[wi];
  }

  var html = '<div class="sec-subtitle mt-20">Best &amp; Worst Sessions</div>';
  html += '<div class="best-worst-grid">';

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
    var pnlCol = isTourney ? 'var(--text)' : (typeof pnlColor === 'function' ? pnlColor(s.pnl) : 'var(--text)');

    var sessStart = s.startTs ? new Date(s.startTs).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
    var lastHand = s.hands[s.hands.length - 1];
    var sessEnd = (lastHand && lastHand.timestamp) ? new Date(lastHand.timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
    var dateLabel = sessStart ? (sessStart === sessEnd ? sessStart : sessStart + ' - ' + sessEnd) : '';

    html += '<div class="best-worst-card">';
    html += '<div class="dim-label mb-12">' + sess.label + '</div>';
    if (dateLabel) html += '<div class="best-worst-meta">' + dateLabel + '</div>';
    html += '<div class="best-worst-meta">' + tableName + ' &middot; ' + s.hands.length + ' hands &middot; <span class="serif-value best-worst-pnl" style="color:' + pnlCol + ';">' + pnlDisplay + '</span></div>';

    var sessionData = analyse(s.hands);
    var patterns = detectSessionPatterns(sessionData, overallData);

    if (patterns.length) {
      var frameWord = sess.frame === 'right' ? 'what went right' : 'what went wrong';
      html += '<div class="best-worst-patterns-head">Patterns: ' + frameWord + ':</div>';
      html += '<ul class="best-worst-patterns">';
      for (var pi2 = 0; pi2 < patterns.length; pi2++) {
        html += '<li>' + patterns[pi2].text + '</li>';
      }
      html += '</ul>';
    } else if (sess.frame === 'wrong') {
      html += '<div class="best-worst-meta">No clear pattern detected. Review the hands below for specific spots.</div>';
    }

    var seeHandsBtnId = 'see-sess-' + Math.random().toString(36).slice(2, 8);
    var sessTitle = sess.label + ' Hands';
    html += '<button class="example-hand-btn best-worst-btn" id="' + seeHandsBtnId + '">Show hands played</button>';
    setTimeout((function(id, title, h2) {
      return function() {
        var el = document.getElementById(id);
        if (el) el.onclick = function() { showExampleHandListModal(title, h2); };
      };
    })(seeHandsBtnId, sessTitle, s.hands), 50);

    html += '</div>';
  }
  html += '</div>';
  return html;
}

// Split each session at its own midpoint, aggregating across sessions.
// Sessions shorter than minSession are skipped because halving them is noise.
// Used by engine/patterns.js (session-half dimension) and engine/ruleset.js
// (second-half-decline rule) and the Trends section.
function splitSessionHalves(hands, minSession) {
  var MIN = minSession || 20;
  var sessions = buildSessions(hands);
  var firstHalf = [];
  var secondHalf = [];
  var map = new Map();
  for (var si = 0; si < sessions.length; si++) {
    var sHands = sessions[si].hands;
    if (sHands.length < MIN) continue;
    var mid = Math.floor(sHands.length / 2);
    for (var i = 0; i < sHands.length; i++) {
      if (i < mid) { firstHalf.push(sHands[i]); map.set(sHands[i], 'first'); }
      else         { secondHalf.push(sHands[i]); map.set(sHands[i], 'second'); }
    }
  }
  return { firstHalf: firstHalf, secondHalf: secondHalf, handToHalf: map };
}
