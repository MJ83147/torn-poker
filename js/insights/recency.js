// Recency context for section stories: what the player is doing lately vs
// their usual game. Trend first (drift across session thirds); if no trend,
// last few sittings vs everything before. Built from cash sessions only
// (buildSessions drops tournament tables), memoised per hands array.
//
// All readers return null when the sample cannot support a claim. Null means
// the story says nothing extra - never filler.
(function() {
  if (typeof Sections === 'undefined') return;

  var _byHands = (typeof WeakMap !== 'undefined') ? new WeakMap() : null;

  var MIN_DENOM = 10;    // per-slice denominator floor for a rate claim
  var MIN_PNL_N = 8;     // hands needed before a money claim about a subset
  var MIN_TREND_SESSIONS = 6;
  var RECENT_MAX = 3;    // "last few sittings"

  // Analyse-backed stats: value + the denominator that makes the value real.
  var STATS = {
    vpip:       { label: 'VPIP', minDelta: 5,
                  read: function(s) { return { value: s.d.core.vpipPct, denom: s.d.n }; } },
    wr:         { label: 'win rate', minDelta: 8,
                  read: function(s) { return { value: s.d.core.wr, denom: s.d.handsWithOutcome }; } },
    cbet:       { label: 'c-bet rate', minDelta: 8,
                  read: function(s) { return { value: s.d.core.cbetPct, denom: s.d.cbetOpps }; } },
    foldToCbet: { label: 'fold-to-c-bet rate', minDelta: 8,
                  read: function(s) { return { value: pct(s.d.foldToCbetDone, s.d.foldToCbetOpps), denom: s.d.foldToCbetOpps }; } },
    foldTo3bet: { label: 'fold-to-3-bet rate', minDelta: 10,
                  read: function(s) { return { value: pct(s.d.foldTo3betDone, s.d.foldTo3betOpps), denom: s.d.foldTo3betOpps }; } },
    wtsd:       { label: 'WTSD', minDelta: 5,
                  read: function(s) { return { value: s.d.core.wtsdPct, denom: s.d.sawFlop }; } },
    wsd:        { label: 'W$SD', minDelta: 8,
                  read: function(s) { return { value: pct(s.sdWon, s.sdCount), denom: s.sdCount }; } },
    limp:       { label: 'limp rate', minDelta: 5,
                  read: function(s) { return { value: s.d.core.limpPct, denom: s.d.n }; } },
  };

  function sliceStats(hands) {
    var d = analyse(hands);
    var sdCount = 0, sdWon = 0;
    for (var i = 0; i < hands.length; i++) {
      var h = hands[i];
      if (!h || !h.outcome || !isShowdown(h)) continue;
      sdCount++;
      if (h.outcome.result === 'won') sdWon++;
    }
    return { d: d, hands: hands, sdCount: sdCount, sdWon: sdWon };
  }

  function slicePnl(hands, predicate) {
    var pnl = 0, n = 0;
    for (var i = 0; i < hands.length; i++) {
      var h = hands[i];
      if (!h || !h.outcome || !isCashHand(h)) continue;
      if (predicate && !predicate(h)) continue;
      pnl += getHandPnlValue(h);
      n++;
    }
    return { pnl: pnl, n: n };
  }

  function flat(sessions) {
    var out = [];
    for (var i = 0; i < sessions.length; i++) {
      out = out.concat(sessions[i].hands);
    }
    return out;
  }

  function buildContext(hands) {
    var sessions = buildSessions(hands);
    if (sessions.length < 3) return null;

    var recentCount = sessions.length >= RECENT_MAX + 2 ? RECENT_MAX : sessions.length - 2;
    var recentSessions = sessions.slice(sessions.length - recentCount);
    var usualSessions = sessions.slice(0, sessions.length - recentCount);

    var ctx = {
      sessionCount: sessions.length,
      recentCount: recentCount,
      _recentHands: flat(recentSessions),
      _usualHands: flat(usualSessions),
      _thirdHands: null,
      _recent: null,
      _usual: null,
      _thirds: null,
    };

    if (sessions.length >= MIN_TREND_SESSIONS) {
      var a = Math.floor(sessions.length / 3);
      var b = Math.floor((2 * sessions.length) / 3);
      ctx._thirdHands = [
        flat(sessions.slice(0, a)),
        flat(sessions.slice(a, b)),
        flat(sessions.slice(b)),
      ];
    }

    ctx.recent = function() {
      if (!ctx._recent) ctx._recent = sliceStats(ctx._recentHands);
      return ctx._recent;
    };
    ctx.usual = function() {
      if (!ctx._usual) ctx._usual = sliceStats(ctx._usualHands);
      return ctx._usual;
    };
    ctx.thirds = function() {
      if (!ctx._thirdHands) return null;
      if (!ctx._thirds) ctx._thirds = ctx._thirdHands.map(sliceStats);
      return ctx._thirds;
    };
    return ctx;
  }

  function recency(hands) {
    if (!hands || !hands.length) return null;
    if (_byHands && _byHands.has(hands)) return _byHands.get(hands);
    var ctx = null;
    try { ctx = buildContext(hands); } catch (e) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('Sections.recency failed', e);
      }
      ctx = null;
    }
    if (_byHands) _byHands.set(hands, ctx);
    return ctx;
  }

  function readSlice(slice, spec) {
    var r = spec.read ? spec.read(slice) : spec.rate(slice.hands);
    if (spec.rate) {
      r = { value: r.opps > 0 ? (r.done / r.opps) * 100 : null, denom: r.opps };
    }
    if (r.value == null || !isFinite(r.value)) return null;
    if (!r.denom || r.denom < (spec.minDenom || MIN_DENOM)) return null;
    return r;
  }

  // A consistent drift across session thirds: monotonic direction, total move
  // of at least minDelta, every third carrying a real sample.
  function trendOf(ctx, spec) {
    var thirds = ctx.thirds();
    if (!thirds) return null;
    var vals = [];
    for (var i = 0; i < 3; i++) {
      var r = readSlice(thirds[i], spec);
      if (!r) return null;
      vals.push(r.value);
    }
    var move = vals[2] - vals[0];
    if (Math.abs(move) < spec.minDelta) return null;
    var lo = Math.min(vals[0], vals[2]) - spec.minDelta / 2;
    var hi = Math.max(vals[0], vals[2]) + spec.minDelta / 2;
    if (vals[1] < lo || vals[1] > hi) return null;
    return { dir: move > 0 ? 'up' : 'down', from: vals[0], mid: vals[1], to: vals[2] };
  }

  function recentVsUsualOf(ctx, spec) {
    var rec = readSlice(ctx.recent(), spec);
    var usu = readSlice(ctx.usual(), spec);
    if (!rec || !usu) return null;
    var delta = rec.value - usu.value;
    if (Math.abs(delta) < spec.minDelta) return null;
    return { recent: rec.value, usual: usu.value, delta: delta, recentSessions: ctx.recentCount };
  }

  function pnlClause(ctx, predicate) {
    if (!predicate) return null;
    var rec = slicePnl(ctx._recentHands, predicate);
    if (rec.n < MIN_PNL_N) return null;
    return rec;
  }

  function sittingsWord(k) {
    return k === 1 ? 'Your last sitting' : 'Your last ' + k + ' sittings';
  }

  // The one-line "what's changed" note a story appends to its branchTexts.
  // spec: { key } or { rate: fn(hands)->{done,opps}, label, minDelta } plus
  // optional { predicate } - the story's own hand subset, used for the money
  // clause. Returns { text, mode, pnl, adverse } or null.
  function recencyNote(hands, spec) {
    var ctx = recency(hands);
    if (!ctx) return null;

    var s = spec.key ? STATS[spec.key] : null;
    var resolved = {
      label: spec.label || (s && s.label) || 'this rate',
      minDelta: spec.minDelta != null ? spec.minDelta : (s ? s.minDelta : 5),
      minDenom: spec.minDenom,
      read: s ? s.read : null,
      rate: spec.rate || null,
    };
    if (!resolved.read && !resolved.rate) return null;

    var cap = function(t) { return t.charAt(0).toUpperCase() + t.slice(1); };
    var pnl = pnlClause(ctx, spec.predicate);
    var money = null;
    if (pnl) {
      money = pnl.pnl < 0
        ? 'Those hands have cost you ' + fmt(Math.abs(pnl.pnl)) + ' in that stretch.'
        : 'Those hands have made you ' + fmt(Math.abs(pnl.pnl)) + ' in that stretch.';
    }

    var t = trendOf(ctx, resolved);
    if (t) {
      var text = cap(resolved.label) + ' is drifting ' + t.dir + ' across your sessions: ' +
        Math.round(t.from) + '% → ' + Math.round(t.mid) + '% → ' + Math.round(t.to) + '%.';
      if (money) text += ' ' + money;
      return { text: text, mode: 'trend', pnl: pnl ? pnl.pnl : null, adverse: !!(pnl && pnl.pnl < 0) };
    }

    var rv = recentVsUsualOf(ctx, resolved);
    if (rv) {
      var text2 = sittingsWord(rv.recentSessions) + ': ' + resolved.label + ' at ' +
        Math.round(rv.recent) + '% vs your usual ' + Math.round(rv.usual) + '%.';
      if (money) text2 += ' ' + money;
      return { text: text2, mode: 'recent', pnl: pnl ? pnl.pnl : null, adverse: !!(pnl && pnl.pnl < 0) };
    }

    return null;
  }

  // Money-only variant for stories with no single frequency (sizing, buckets):
  // how the story's hand subset has been paying lately vs usually.
  function recencyPnlNote(hands, predicate, label) {
    var ctx = recency(hands);
    if (!ctx || !predicate) return null;
    var rec = slicePnl(ctx._recentHands, predicate);
    var usu = slicePnl(ctx._usualHands, predicate);
    if (rec.n < MIN_PNL_N || usu.n < MIN_PNL_N) return null;
    var recPer = rec.pnl / rec.n;
    var usuPer = usu.pnl / usu.n;
    if ((recPer < 0) === (usuPer < 0)) return null; // only speak when the direction flipped
    var noun = label || 'These hands';
    var text = (recPer < 0)
      ? noun + ' used to make money (' + fmtPnl(usu.pnl) + ' across ' + usu.n + ' earlier hands) but ' +
        sittingsWord(ctx.recentCount).toLowerCase() + ' cost you ' + fmt(Math.abs(rec.pnl)) + ' across ' + rec.n + '.'
      : noun + ' were losing (' + fmtPnl(usu.pnl) + ' across ' + usu.n + ' earlier hands) but ' +
        sittingsWord(ctx.recentCount).toLowerCase() + ' made you ' + fmt(Math.abs(rec.pnl)) + ' across ' + rec.n + '.';
    return { text: text, mode: 'pnl-flip', pnl: rec.pnl, adverse: recPer < 0 };
  }

  Sections.recency = recency;
  Sections.recencyNote = recencyNote;
  Sections.recencyPnlNote = recencyPnlNote;
})();
