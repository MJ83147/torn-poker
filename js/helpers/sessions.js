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

    var sessStart = fmtDate(s.startTs);
    var lastHand = s.hands[s.hands.length - 1];
    var sessEnd = fmtDate(lastHand && lastHand.timestamp);
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
    html += '<button class="btn btn-ghost" id="' + seeHandsBtnId + '">Show hands played</button>';
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


/* ===== session story engine =====
   Each session is read across several dimensions. A detector runs on the
   session's own analysis and only emits a finding when its pattern is
   present and significant, so a clean session surfaces strengths and a
   messy one surfaces leaks. Findings render as the story cards in the
   Sessions panel. */

function fmtSessionDuration(ms) {
  if (!ms || ms < 0) return '';
  var mins = Math.round(ms / 60000);
  var h = Math.floor(mins / 60);
  var m = mins % 60;
  return h ? (h + 'h ' + (m < 10 ? '0' : '') + m + 'm') : (m + 'm');
}

function _sessHandPnl(h) {
  return (isCashHand(h) && h.outcome) ? getHandPnlValue(h) : 0;
}
function _sessSumPnl(arr) {
  var s = 0;
  for (var i = 0; i < arr.length; i++) s += _sessHandPnl(arr[i]);
  return s;
}
function _sessHole(h) {
  return (typeof displayCards === 'function' && h && h.hole && h.hole.length)
    ? displayCards(h.hole.map(normCard)) : 'your hand';
}
function _sessHeroVoluntary(h) {
  var a = parseActions(h.actions);
  for (var i = 0; i < a.length; i++) {
    if (a[i].isMe && (a[i].type === 'call' || a[i].type === 'bet' || a[i].type === 'raise')) return true;
  }
  return false;
}
function _sessHeroRiverCall(h) {
  var a = parseActions(h.actions);
  for (var i = 0; i < a.length; i++) {
    if (a[i].isMe && String(a[i].street || '').toLowerCase() === 'river' && a[i].type === 'call') return true;
  }
  return false;
}
function _sessReachedShowdown(h) {
  if (!h.board || h.board.length < 5) return false;
  var a = parseActions(h.actions), lastMe = null;
  for (var i = 0; i < a.length; i++) { if (a[i].isMe) lastMe = a[i]; }
  return !!lastMe && lastMe.type !== 'fold';
}
function _sPos(x) { return '<em class="pos">' + x + '</em>'; }
function _sNeg(x) { return '<em class="neg">' + x + '</em>'; }
function _sEm(x)  { return '<em>' + x + '</em>'; }

function buildSessionStoryCtx(session, base) {
  var hands = session.hands.slice().sort(function(a, b) { return (a.timestamp || 0) - (b.timestamp || 0); });
  var sd = analyse(hands);
  var runline = [], cum = 0;
  for (var i = 0; i < hands.length; i++) {
    var p = _sessHandPnl(hands[i]);
    cum += p;
    runline.push({ i: i + 1, cum: cum, pnl: p, hand: hands[i] });
  }
  var n = hands.length, t = Math.max(1, Math.floor(n / 3));
  var phases = {
    early: analyse(hands.slice(0, t)),
    mid:   analyse(hands.slice(t, 2 * t)),
    late:  analyse(hands.slice(2 * t)),
    t: t
  };
  var startTs = hands[0].timestamp || 0;
  var endTs = hands[n - 1].timestamp || 0;
  return {
    session: session, hands: hands, sd: sd, base: base || {},
    runline: runline, phases: phases,
    startTs: startTs, endTs: endTs, durationMs: Math.max(0, endTs - startTs), pnl: cum
  };
}

// The arc — climbed then gave it back. Amber "turning point".
function _sessDetArc(ctx) {
  var r = ctx.runline;
  if (r.length < 12) return null;
  var peak = r[0], peakIdx = 0;
  for (var i = 0; i < r.length; i++) { if (r[i].cum > peak.cum) { peak = r[i]; peakIdx = i; } }
  if (peak.cum <= 0) return null;
  if (peakIdx > r.length * 0.85) return null;
  var finalCum = r[r.length - 1].cum;
  var drop = peak.cum - finalCum;
  if (drop < peak.cum * 0.6) return null;
  var turn = null;
  for (var j = peakIdx; j < r.length; j++) { if (r[j].pnl < 0 && (!turn || r[j].pnl < turn.pnl)) turn = r[j]; }
  var prose = 'Your stack climbed to ' + _sPos(fmtPnl(peak.cum)) + ' by hand ' + peak.i + ', ';
  if (turn) prose += 'then ' + _sEm(_sessHole(turn.hand)) + ' cost you ' + _sNeg(fmtPnl(turn.pnl)) + ' at hand ' + turn.i + ' and the graph slid the rest of the way, closing at ' + _sNeg(fmtPnl(finalCum)) + '.';
  else prose += 'then slid the rest of the way to close at ' + _sNeg(fmtPnl(finalCum)) + '.';
  return {
    id: 'arc', lens: 'The arc', flag: 'watch',
    title: 'Up to ' + fmtPnl(peak.cum) + ', then gave it back',
    prose: prose,
    linkLabel: turn ? 'The turning-point hand ›' : null,
    linkHands: turn ? [turn.hand] : null,
    magnitude: drop
  };
}

// Tilt / gear change — loosened up after the biggest loss.
function _sessDetTilt(ctx) {
  var hands = ctx.hands;
  if (hands.length < 16) return null;
  var pivot = -1, worst = 0;
  for (var i = 0; i < hands.length; i++) {
    var p = _sessHandPnl(hands[i]);
    if (p < worst) { worst = p; pivot = i; }
  }
  if (pivot < 6 || pivot > hands.length - 6) return null;
  var pre = analyse(hands.slice(0, pivot));
  var post = analyse(hands.slice(pivot + 1));
  var preV = pre.core.vpipPct, postV = post.core.vpipPct;
  if (preV == null || postV == null || postV - preV < 10) return null;
  var loosened = hands.slice(pivot + 1).filter(_sessHeroVoluntary);
  return {
    id: 'tilt', lens: 'Tilt / gear change', flag: 'leak',
    title: 'You loosened up after the big hit',
    prose: 'Before the ' + _sNeg(fmtPnl(worst)) + ' pot at hand ' + (pivot + 1) + ' you played ' + _sPos(preV + '% VPIP') + '. After it you jumped to ' + _sNeg(postV + '%') + ' — entering far more pots than usual.',
    linkLabel: loosened.length ? (loosened.length + ' hands you played after the hit ›') : null,
    linkHands: loosened.length ? loosened : null,
    magnitude: (postV - preV) * 100
  };
}

// Fatigue / duration — long session, play decayed late.
function _sessDetFatigue(ctx) {
  if (ctx.durationMs < 90 * 60000 || ctx.pnl >= 0) return null;
  var cutoff = ctx.startTs + Math.min(ctx.durationMs * 0.66, 120 * 60000);
  var late = [];
  for (var i = 0; i < ctx.hands.length; i++) {
    if ((ctx.hands[i].timestamp || 0) >= cutoff) late.push(ctx.hands[i]);
  }
  if (late.length < 6) return null;
  var latePnl = _sessSumPnl(late);
  if (latePnl >= 0) return null;
  var share = Math.round(latePnl / ctx.pnl * 100);
  if (share < 50) return null;
  var mins = Math.round((cutoff - ctx.startTs) / 60000);
  var riverCalls = late.filter(function(h) { return _sessHeroRiverCall(h) && _sessHandPnl(h) < 0; });
  return {
    id: 'fatigue', lens: 'Fatigue / duration', flag: 'leak',
    title: 'The long tail cost you',
    prose: 'You sat for ' + _sEm(fmtSessionDuration(ctx.durationMs)) + '. After the ' + mins + '-minute mark your play cost ' + _sNeg(fmtPnl(latePnl)) + ' — ' + _sNeg(share + '%') + ' of the session’s losses came in that final stretch.',
    linkLabel: riverCalls.length ? (riverCalls.length + ' late river calls that lost ›') : 'The final-stretch hands ›',
    linkHands: riverCalls.length ? riverCalls : late,
    magnitude: -latePnl
  };
}

// Showdown — went to showdown far more than usual.
function _sessDetShowdown(ctx) {
  var s = ctx.sd.core, b = (ctx.base && ctx.base.core) || {};
  if (s.wtsdPct == null || b.wtsdPct == null || s.wtsdPct - b.wtsdPct < 8) return null;
  var lost = ctx.hands.filter(function(h) { return _sessReachedShowdown(h) && _sessHandPnl(h) < 0; });
  return {
    id: 'showdown', lens: 'Showdown', flag: 'leak',
    title: 'You went to showdown too often',
    prose: 'You reached showdown ' + _sNeg(s.wtsdPct + '%') + ' of the time versus your usual ' + _sEm(b.wtsdPct + '%') + ' — calling down lighter than normal and paying it off.',
    linkLabel: lost.length ? (lost.length + ' showdowns you lost ›') : null,
    linkHands: lost.length ? lost : null,
    magnitude: (s.wtsdPct - b.wtsdPct) * 80
  };
}

// Position — the damage was concentrated out of position.
function _sessDetPosition(ctx) {
  var pm = ctx.sd.posMap;
  if (!pm) return null;
  var IP = { CO: 1, BTN: 1 };
  var ip = 0, oop = 0;
  for (var k in pm) { var v = pm[k]; if (IP[k]) ip += (v.pnl || 0); else oop += (v.pnl || 0); }
  if (oop >= 0) return null;
  if (ctx.pnl < 0 && oop > ctx.pnl * 0.4) return null;
  var oopHands = ctx.hands.filter(function(h) { return h.position && !IP[h.position] && _sessHandPnl(h) < 0; });
  var ipPart = ip !== 0 ? (', against ' + (ip >= 0 ? _sPos(fmtPnl(ip)) : _sNeg(fmtPnl(ip))) + ' in position') : '';
  return {
    id: 'position', lens: 'Position', flag: 'leak',
    title: 'Out of position is where you bled',
    prose: 'You lost ' + _sNeg(fmtPnl(oop)) + ' out of position' + ipPart + ' — mostly the blinds, defending too wide and paying off.',
    linkLabel: oopHands.length ? 'Out-of-position losses ›' : null,
    linkHands: oopHands.length ? oopHands : null,
    magnitude: -oop
  };
}

// What went right — the best stretch of the session.
function _sessDetStrength(ctx) {
  var r = ctx.runline;
  if (r.length < 9) return null;
  var t = Math.floor(r.length / 3);
  function seg(a, b) { var s = 0; for (var i = a; i < b; i++) s += r[i].pnl; return s; }
  var thirds = [
    { k: 'early', label: 'opening third', a: 0, b: t, ph: ctx.phases.early },
    { k: 'mid', label: 'middle stretch', a: t, b: 2 * t, ph: ctx.phases.mid },
    { k: 'late', label: 'final third', a: 2 * t, b: r.length, ph: ctx.phases.late }
  ];
  var best = null;
  for (var i = 0; i < thirds.length; i++) { thirds[i].pnl = seg(thirds[i].a, thirds[i].b); if (!best || thirds[i].pnl > best.pnl) best = thirds[i]; }
  if (best.pnl <= 0) return null;
  var c = best.ph && best.ph.core ? best.ph.core : {};
  var prose = 'Across the ' + best.label + ' you made ' + _sPos(fmtPnl(best.pnl)) + '.';
  if (c.vpipPct != null) prose += ' You played ' + _sEm(c.vpipPct + '% VPIP') + (c.agg != null ? (' at ' + _sEm(c.agg + '% aggression')) : '') + ' — disciplined, value-heavy poker worth repeating.';
  return {
    id: 'strength', lens: 'What went right', flag: 'strength',
    title: 'Your ' + best.label + ' was your best poker',
    prose: prose,
    linkLabel: 'The winning stretch ›',
    linkHands: ctx.hands.slice(best.a, best.b),
    magnitude: best.pnl
  };
}

var _SESSION_DETECTORS = [
  _sessDetArc, _sessDetTilt, _sessDetFatigue,
  _sessDetShowdown, _sessDetPosition, _sessDetStrength
];

function buildSessionStories(session, base) {
  var ctx = buildSessionStoryCtx(session, base);
  var out = [];
  for (var i = 0; i < _SESSION_DETECTORS.length; i++) {
    try { var f = _SESSION_DETECTORS[i](ctx); if (f) out.push(f); } catch (e) { /* skip a failed detector */ }
  }
  var rank = { watch: 0, leak: 1, strength: 2 };
  out.sort(function(a, b) {
    if (rank[a.flag] !== rank[b.flag]) return rank[a.flag] - rank[b.flag];
    return (b.magnitude || 0) - (a.magnitude || 0);
  });
  return { ctx: ctx, stories: out };
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
