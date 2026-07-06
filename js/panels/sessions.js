// Sessions panel logic: the per-session story engine and list model.
// No DOM, no markup — the view is js/panels/views/sessions.js.
// The shared session core (buildSessions/sessionPnl) stays in js/helpers/sessions.js.

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
// Emphasis wrappers for story prose; rendered inside the shared story card.
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
  var winners = ctx.hands.slice(best.a, best.b)
    .filter(function(h) { return _sessHandPnl(h) > 0; })
    .sort(function(a, b) { return _sessHandPnl(b) - _sessHandPnl(a); });
  return {
    id: 'strength', lens: 'What went right', flag: 'strength',
    title: 'Your ' + best.label + ' was your best poker',
    prose: prose,
    linkLabel: winners.length ? (winners.length + ' pots you won in that stretch ›') : null,
    linkHands: winners.length ? winners : null,
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

/* ===== panel models ===== */

// Sessions newest first, each with sorted hands, start/end and pnl attached.
function sessionsListModel(hands) {
  var sessions = buildSessions(hands || []);
  for (var i = 0; i < sessions.length; i++) {
    var s = sessions[i];
    s._sorted = s.hands.slice().sort(function(a, b) { return (a.timestamp || 0) - (b.timestamp || 0); });
    s.startTs = s._sorted[0].timestamp || 0;
    s.endTs = s._sorted[s._sorted.length - 1].timestamp || 0;
    s.pnl = sessionPnl(s);
  }
  sessions.sort(function(a, b) { return (b.startTs || 0) - (a.startTs || 0); });
  return sessions;
}

function _stripTags(html) {
  return String(html || '').replace(/<[^>]+>/g, '');
}

// Adapt a per-session story to a Sections finding so it renders through the
// shared story-card component. flag->severity; linkHands becomes an example
// button. Prose is stripped to plain text (the shared card escapes its text).
function _sessStoryToFinding(st) {
  var sev = st.flag === 'strength' ? 'g' : st.flag === 'watch' ? 'a' : 'r';
  var note = _stripTags(st.prose);
  var label = st.linkLabel ? st.linkLabel.replace(/\s*›\s*$/, '') : 'View hands';
  return {
    name: st.title,
    severity: sev,
    openingText: note,
    examples: (st.linkHands && st.linkHands.length)
      ? [{ label: label, hands: st.linkHands, coachingNote: note }]
      : []
  };
}
