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
  var sCore = sessionData.core || {};
  var oCore = overallData.core || {};
  var sVpip = sCore.vpipPct, oVpip = oCore.vpipPct;
  var sAgg  = sCore.agg,     oAgg  = oCore.agg;
  var sLimp = sCore.limpPct, oLimp = oCore.limpPct;
  var sPfr  = sCore.pfrPct,  oPfr  = oCore.pfrPct;
  var sCbet = sCore.cbetPct, oCbet = oCore.cbetPct;
  var sWtsd = sCore.wtsdPct, oWtsd = oCore.wtsdPct;

  var sEpGroup = calcPositionGroupVpip(sessionData.posMap, EARLY_POSITIONS);
  var sEpVpip = sEpGroup.vpip;
  var sEarlyHands = sEpGroup.hands;
  var oEpVpip = calcPositionGroupVpip(overallData.posMap, EARLY_POSITIONS).vpip;

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

  var html = '<div class="section">';
  html += '<div class="section-head">Best &amp; Worst Sessions</div>';
  html += '<div class="row">';

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
    var pnlCellCls = isTourney ? '' : (typeof pnlValCls === 'function' ? pnlValCls(s.pnl) : '');

    var sessStart = s.startTs ? new Date(s.startTs).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
    var lastHand = s.hands[s.hands.length - 1];
    var sessEnd = (lastHand && lastHand.timestamp) ? new Date(lastHand.timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
    var dateLabel = sessStart ? (sessStart === sessEnd ? sessStart : sessStart + ' - ' + sessEnd) : '';

    html += '<div class="container">';
    html += '<div class="eyebrow">' + sess.label + '</div>';
    html += '<div class="list">';
    if (dateLabel) html += '<div class="text-body">' + dateLabel + '</div>';
    html += '<div class="text-body">' + tableName + ' &middot; ' + s.hands.length + ' hands &middot; <span class="value ' + pnlCellCls + '">' + pnlDisplay + '</span></div>';

    var sessionData = analyse(s.hands);
    var patterns = detectSessionPatterns(sessionData, overallData);

    if (patterns.length) {
      var frameWord = sess.frame === 'right' ? 'what went right' : 'what went wrong';
      html += '<div class="text-body">Patterns: ' + frameWord + ':</div>';
      html += '<ul class="text-body">';
      for (var pi2 = 0; pi2 < patterns.length; pi2++) {
        html += '<li>' + patterns[pi2].text + '</li>';
      }
      html += '</ul>';
    } else if (sess.frame === 'wrong') {
      html += '<div class="text-body">No clear pattern detected. Review the hands below for specific spots.</div>';
    }

    var seeHandsBtnId = 'see-sess-' + Math.random().toString(36).slice(2, 8);
    var sessTitle = sess.label + ' Hands';
    html += '<button class="btn btn-ghost example-hand-btn" id="' + seeHandsBtnId + '">Show hands played</button>';
    setTimeout((function(id, title, h2) {
      return function() {
        var el = document.getElementById(id);
        if (el) el.onclick = function() { showExampleHandListModal(title, h2); };
      };
    })(seeHandsBtnId, sessTitle, s.hands), 50);

    html += '</div>';
    html += '</div>';
  }
  html += '</div>';
  html += '</div>';
  return html;
}

// TODO(discuss): minSession session-splitting logic needs a rewrite. Do not change until reviewed.
// Sessions shorter than minSession are skipped because halving them is noise.
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


/* ===== merged from pnl-slice.js ===== */
(function() {
  function classifyHand(params) {
    if (!params) return 'skip';
    var inside = params.insideRange;
    var pnl = params.pnl;
    var n = params.sample;
    var min = (params.opts && params.opts.minSample != null)
      ? params.opts.minSample
      : (typeof MIN_CELL === 'number' ? MIN_CELL : 10);

    if (inside == null) return 'skip';
    if (n == null || n < min) return 'skip';
    if (pnl == null || !isFinite(pnl)) return 'skip';

    var losing = pnl < 0;
    if (inside && losing) return 'play-problem';
    if (!inside && losing) return 'selection-problem';
    if (!inside && !losing) return 'monitor';
    return 'on-target';
  }

  function rollUp(rangeMap, predicate) {
    var totalPlayed = 0, totalPnl = 0, hands = [];
    if (!rangeMap) return { played: 0, pnl: 0, hands: hands };
    for (var k in rangeMap) {
      var rm = rangeMap[k];
      if (!rm || !rm.played) continue;
      if (predicate && !predicate(k, rm)) continue;
      totalPlayed += rm.played;
      totalPnl += rm.pnl || 0;
      hands.push({ key: k, played: rm.played, won: rm.won || 0, pnl: rm.pnl || 0, dealt: rm.dealt || 0 });
    }
    return { played: totalPlayed, pnl: totalPnl, hands: hands };
  }

  window.PnlSlice = {
    classifyHand: classifyHand,
    rollUp: rollUp
  };
})();
