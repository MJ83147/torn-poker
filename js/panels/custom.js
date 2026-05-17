// ── CUSTOM REPORT PANEL ──────────────────────────────────────────────────────
//
// A user-built analytical query, expressed as a sentence of filters, with a
// headline strip, charts, and opinionated insight cards on the resulting slice.
// Independent of the story engine and catalogue - this is a slicing layer over
// the existing per-hand fields.
//
// Module layout:
//   1. Sample-size constants + bands
//   2. Clause catalogue (filter definitions + value lists)
//   3. State helpers (load/save, segment defaults)
//   4. Filter predicates (hand-level + decision-level)
//   5. Engine (runCustomReport)
//   6. Insight rule library (per-segment) and compare rules
//   7. Renderer: sentence, popover, headline, charts, insight cards
//   8. Public entry: renderCustomReport(container, hands)

// ── 1. SAMPLE-SIZE CONSTANTS ────────────────────────────────────────────────
var CR_SAMPLE_MIN = 80;   // below this, headline metrics greyed, rules skipped
var CR_SAMPLE_OK  = 250;  // above this, win-rate insights are allowed to fire

// Stake bands by big-blind size.
var CR_STAKE_BANDS = [
  { key: 'micro',     label: 'micro',      max: 500 },
  { key: 'low',       label: 'low',        max: 50000 },
  { key: 'mid',       label: 'mid',        max: 1000000 },
  { key: 'high',      label: 'high',       max: 10000000 },
  { key: 'nosebleed', label: 'nosebleed',  max: Infinity },
];

function _crStakeKey(bb) {
  if (bb == null || bb <= 0) return null;
  for (var i = 0; i < CR_STAKE_BANDS.length; i++) {
    if (bb <= CR_STAKE_BANDS[i].max) return CR_STAKE_BANDS[i].key;
  }
  return null;
}

// Stack depth bands live in js/helpers/stack-bands.js (STACK_BANDS + stackBandKey).

// Time-of-day buckets from a timestamp.
function _crTimeBucket(ts) {
  if (!ts) return null;
  var d = new Date(ts);
  var hour = d.getHours();
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 23) return 'evening';
  return 'late';
}

function _crIsWeekend(ts) {
  if (!ts) return null;
  var dow = new Date(ts).getDay();
  return dow === 0 || dow === 6;
}

// Time window (days from now).
function _crWithinWindow(ts, windowKey) {
  if (windowKey === 'all') return true;
  if (!ts) return false;
  var now = Date.now();
  var ms = { '7d': 7, '30d': 30, 'year': 365 }[windowKey];
  if (!ms) return true;
  return now - ts <= ms * 86400000;
}

// Hole-card classes - mapping from existing classifyKey() output plus a few
// derived buckets the spec asks for (AK, suited connectors as their own group).
function _crHoleClass(hole) {
  var key = parseHoleKey(hole);
  if (!key) return null;
  // AK (both suited and offsuit) gets its own bucket.
  if (key === 'AKs' || key === 'AKo') return 'AK';
  var cls = classifyKey(key);
  if (cls === 'Pocket Pairs') return 'pairs';
  if (cls === 'Suited Connectors') return 'sc';
  if (cls === 'Broadway') return 'broadway';
  if (cls === 'Suited') return 'suited';
  if (cls === 'Connectors') return 'connectors';
  if (cls === 'Ace-Rag') return 'ace-rag';
  if (cls === 'Offsuit Trash') return 'junk';
  return null;
}

// ── 2. CLAUSE CATALOGUE ──────────────────────────────────────────────────────
// Each clause owns: id, label, kind (hand|decision), multi flag, options getter,
// phrase template, and (later) a predicate. Predicates live below in section 4
// because they share helpers.

function _crBuildClauseDefs(hands) {
  // Tables the player has actually played at (cash + tournament, keyed by id).
  var tableCounts = {};
  for (var i = 0; i < hands.length; i++) {
    var tid = inferTable(hands[i]);
    if (tid != null) tableCounts[tid] = (tableCounts[tid] || 0) + 1;
  }
  var tableOpts = Object.keys(tableCounts).map(function(id) {
    var meta = TABLE_META[id];
    return {
      value: String(id),
      label: meta ? meta.name : 'Table ' + id,
      meta: tableCounts[id] + ' hands',
    };
  }).sort(function(a, b) { return a.label.localeCompare(b.label); });

  // Seat counts present in the data.
  var seatCounts = {};
  for (var s = 0; s < hands.length; s++) {
    var n = countHandPlayers(hands[s]);
    if (n >= 2) seatCounts[n] = (seatCounts[n] || 0) + 1;
  }
  var seatOpts = Object.keys(seatCounts).map(Number).sort(function(a, b) { return a - b; }).map(function(n) {
    return { value: String(n), label: n + ' players', meta: seatCounts[n] + ' hands' };
  });

  // Stake bands actually represented in the data.
  var stakeCounts = {};
  for (var k = 0; k < hands.length; k++) {
    var key = _crStakeKey(getHandBB(hands[k]));
    if (key) stakeCounts[key] = (stakeCounts[key] || 0) + 1;
  }
  var stakeOpts = CR_STAKE_BANDS.filter(function(b) { return stakeCounts[b.key]; }).map(function(b) {
    return { value: b.key, label: b.label, meta: stakeCounts[b.key] + ' hands' };
  });

  // Opponent names with >= 10 hands shared - mirrors the players panel floor.
  var oppCounts = {};
  for (var oi = 0; oi < hands.length; oi++) {
    var acts = parseActions(hands[oi].actions);
    var seen = {};
    for (var aj = 0; aj < acts.length; aj++) {
      if (acts[aj].isMe || !acts[aj].author || seen[acts[aj].author]) continue;
      seen[acts[aj].author] = true;
      oppCounts[acts[aj].author] = (oppCounts[acts[aj].author] || 0) + 1;
    }
  }
  var oppOpts = Object.keys(oppCounts)
    .filter(function(name) { return oppCounts[name] >= 10; })
    .sort(function(a, b) { return oppCounts[b] - oppCounts[a]; })
    .map(function(name) {
      return { value: name, label: name, meta: oppCounts[name] + ' hands' };
    });

  return [
    {
      id: 'table',
      label: 'Table',
      kind: 'hand',
      multi: false,
      options: tableOpts,
      phrase: function(values, opts) {
        if (!values) return null;
        var opt = opts.find(function(o) { return o.value === values; });
        return 'at ' + (opt ? opt.label : 'this table');
      },
    },
    {
      id: 'stake',
      label: 'Stake level',
      kind: 'hand',
      multi: false,
      options: stakeOpts,
      phrase: function(values) {
        if (!values) return null;
        return 'at ' + values + ' stakes';
      },
    },
    {
      id: 'size',
      label: 'Players at the table',
      kind: 'hand',
      multi: true,
      options: seatOpts,
      phrase: function(values) {
        if (!values || !values.length) return null;
        if (values.length === 1) return 'with ' + values[0] + ' players';
        return 'with ' + values.join(' or ') + ' players';
      },
    },
    {
      id: 'opponent',
      label: 'Opponent at the table',
      kind: 'hand',
      multi: true,
      options: oppOpts,
      phrase: function(values) {
        if (!values || !values.length) return null;
        if (values.length === 1) return 'against ' + values[0];
        return 'against ' + values.slice(0, -1).join(', ') + ' or ' + values[values.length - 1];
      },
    },
    {
      id: 'position',
      label: 'My position',
      kind: 'hand',
      multi: false,
      options: [
        { value: 'BTN', label: 'on the button' },
        { value: 'CO', label: 'in the cutoff' },
        { value: 'HJ', label: 'in the hijack' },
        { value: 'MP', label: 'in middle position' },
        { value: 'EP', label: 'in early position' },
        { value: 'blinds', label: 'in the blinds' },
      ],
      phrase: function(values, opts) {
        if (!values) return null;
        var opt = opts.find(function(o) { return o.value === values; });
        return opt ? opt.label : null;
      },
    },
    {
      id: 'depth',
      label: 'My stack depth',
      kind: 'hand',
      multi: false,
      options: STACK_BANDS.map(function(b) { return { value: b.key, label: b.label }; }),
      phrase: function(values) {
        if (!values) return null;
        return 'with a ' + values.replace('-', ' ') + ' stack';
      },
    },
    {
      id: 'cards',
      label: 'My hole cards',
      kind: 'hand',
      multi: false,
      options: [
        { value: 'pairs', label: 'pocket pairs' },
        { value: 'suited', label: 'any suited' },
        { value: 'broadway', label: 'broadway' },
        { value: 'AK', label: 'AK' },
        { value: 'sc', label: 'suited connectors' },
        { value: 'junk', label: 'offsuit junk' },
      ],
      phrase: function(values, opts) {
        if (!values) return null;
        var opt = opts.find(function(o) { return o.value === values; });
        return 'holding ' + (opt ? opt.label : values);
      },
    },
    {
      id: 'window',
      label: 'Time window',
      kind: 'hand',
      multi: false,
      options: [
        { value: '7d', label: 'the last 7 days' },
        { value: '30d', label: 'the last 30 days' },
        { value: 'year', label: 'the last year' },
        { value: 'all', label: 'all time' },
      ],
      phrase: function(values, opts) {
        if (!values || values === 'all') return null;
        var opt = opts.find(function(o) { return o.value === values; });
        return opt ? 'in ' + opt.label : null;
      },
    },
    {
      id: 'time',
      label: 'Time of day',
      kind: 'hand',
      multi: false,
      options: [
        { value: 'morning', label: 'in the morning' },
        { value: 'afternoon', label: 'in the afternoon' },
        { value: 'evening', label: 'in the evening' },
        { value: 'late', label: 'late at night' },
        { value: 'weekend', label: 'on weekends' },
        { value: 'weekday', label: 'on weekdays' },
      ],
      phrase: function(values, opts) {
        if (!values) return null;
        var opt = opts.find(function(o) { return o.value === values; });
        return opt ? opt.label : null;
      },
    },
    {
      id: 'pottype',
      label: 'Pot type',
      kind: 'decision',
      multi: false,
      options: [
        { value: 'limped',  label: 'limped pots' },
        { value: 'srp',     label: 'single-raised pots' },
        { value: '3bet',    label: '3-bet pots' },
        { value: '4bet',    label: '4-bet pots' },
        { value: 'allin',   label: 'all-in pots' },
      ],
      phrase: function(values, opts) {
        if (!values) return null;
        var opt = opts.find(function(o) { return o.value === values; });
        return opt ? 'in ' + opt.label : null;
      },
    },
    {
      id: 'preact',
      label: 'My pre-flop action',
      kind: 'decision',
      multi: false,
      options: [
        { value: 'opened',   label: 'when I opened' },
        { value: '3bet',     label: 'when I 3-bet' },
        { value: '4bet',     label: 'when I 4-bet or shoved' },
        { value: 'called',   label: 'when I called' },
        { value: 'limped',   label: 'when I limped' },
        { value: 'defended', label: 'when I defended my blind' },
      ],
      phrase: function(values, opts) {
        if (!values) return null;
        var opt = opts.find(function(o) { return o.value === values; });
        return opt ? opt.label : null;
      },
    },
    {
      id: 'result',
      label: 'Hand result',
      kind: 'decision',
      multi: false,
      options: [
        { value: 'won',      label: 'and won' },
        { value: 'lost-sd',  label: 'and lost at showdown' },
        { value: 'fold-pre', label: 'and folded pre-flop' },
        { value: 'fold-post', label: 'and folded post-flop' },
        { value: 'showdown', label: 'and reached showdown' },
      ],
      phrase: function(values, opts) {
        if (!values) return null;
        var opt = opts.find(function(o) { return o.value === values; });
        return opt ? opt.label : null;
      },
    },
  ];
}

// ── 3. STATE ─────────────────────────────────────────────────────────────────
var CR_STORAGE_KEY = 'tc_poker_custom_report';

function _crDefaultSegment() {
  return { clauses: [], values: {} };
}

function _crLoadState() {
  try {
    var raw = localStorage.getItem(CR_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return { compare: false, A: _crDefaultSegment(), B: _crDefaultSegment() };
}

function _crSaveState(state) {
  try { localStorage.setItem(CR_STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
}

// ── 4. FILTER PREDICATES ─────────────────────────────────────────────────────
// Each predicate takes (hand, value) and returns true/false.

var CR_HAND_PREDICATES = {
  table: function(h, v) {
    var tid = inferTable(h);
    return tid != null && String(tid) === v;
  },
  stake: function(h, v) {
    return _crStakeKey(getHandBB(h)) === v;
  },
  size: function(h, v) {
    var seats = countHandPlayers(h);
    return v.indexOf(String(seats)) !== -1;
  },
  opponent: function(h, v) {
    var acts = parseActions(h.actions);
    for (var i = 0; i < acts.length; i++) {
      if (!acts[i].isMe && acts[i].author && v.indexOf(acts[i].author) !== -1) return true;
    }
    return false;
  },
  position: function(h, v) {
    var pos = h.position;
    if (!pos) return false;
    if (v === 'EP') return pos === 'UTG' || pos === 'UTG+1';
    if (v === 'MP') return pos === 'MP' || pos === 'LJ';
    if (v === 'blinds') return pos === 'SB' || pos === 'BB';
    return pos === v;
  },
  depth: function(h, v) {
    return stackBandKey(h.effStackBB) === v;
  },
  cards: function(h, v) {
    return _crHoleClass(h.hole) === v;
  },
  window: function(h, v) {
    return _crWithinWindow(h.timestamp, v);
  },
  time: function(h, v) {
    if (v === 'weekend') return _crIsWeekend(h.timestamp) === true;
    if (v === 'weekday') return _crIsWeekend(h.timestamp) === false;
    return _crTimeBucket(h.timestamp) === v;
  },
};

// Decision-level predicates. The proof-of-concept resolves these against the
// hand as a whole (one DAU per hand for the moment - true DAU substrate is
// scheduled for the later build pass). Returns true if the hand contains a
// matching decision.
var CR_DECISION_PREDICATES = {
  pottype: function(h, v) {
    var acts = parseActions(h.actions);
    var preActs = acts.filter(function(a) { return a.street === 'Preflop'; });
    var raises = preActs.filter(function(a) { return a.type === 'raise'; }).length;
    var heroLimped = preActs.some(function(a) {
      return a.isMe && a.type === 'call' && !preActs.slice(0, preActs.indexOf(a)).some(function(b) {
        return b.type === 'raise';
      });
    });
    var sawAllIn = acts.some(function(a, idx) { return isAllInAction(acts, idx); });
    if (v === 'allin') return sawAllIn;
    if (v === 'limped') return raises === 0 && heroLimped;
    if (v === 'srp') return raises === 1;
    if (v === '3bet') return raises === 2;
    if (v === '4bet') return raises >= 3;
    return false;
  },
  preact: function(h, v) {
    var acts = parseActions(h.actions);
    var preActs = acts.filter(function(a) { return a.street === 'Preflop'; });
    var heroFirstNonBlind = null;
    var heroRaiseLevel = 0; // 1=open, 2=3bet, 3+=4bet
    var raiseCount = 0;
    for (var i = 0; i < preActs.length; i++) {
      var a = preActs[i];
      if (a.type === 'raise') {
        raiseCount++;
        if (a.isMe) heroRaiseLevel = raiseCount;
      }
      if (a.isMe && a.type !== 'sb' && a.type !== 'bb' && !heroFirstNonBlind) {
        heroFirstNonBlind = a;
      }
    }
    var heroOpened = heroRaiseLevel === 1;
    var hero3bet = heroRaiseLevel === 2;
    var hero4plus = heroRaiseLevel >= 3;
    var sawAllIn = acts.some(function(a, idx) { return isAllInAction(acts, idx); });
    var heroShoved = sawAllIn && preActs.some(function(a, i) {
      return a.isMe && isAllInAction(acts, acts.indexOf(a));
    });
    if (v === 'opened') return heroOpened;
    if (v === '3bet') return hero3bet;
    if (v === '4bet') return hero4plus || heroShoved;
    if (v === 'called') {
      return heroFirstNonBlind && heroFirstNonBlind.type === 'call';
    }
    if (v === 'limped') {
      // Hero called, no raise before, hero is not a blind.
      if (!heroFirstNonBlind || heroFirstNonBlind.type !== 'call') return false;
      if (h.position === 'SB' || h.position === 'BB') return false;
      var heroIdx = preActs.indexOf(heroFirstNonBlind);
      return !preActs.slice(0, heroIdx).some(function(b) { return b.type === 'raise'; });
    }
    if (v === 'defended') {
      if (h.position !== 'SB' && h.position !== 'BB') return false;
      return heroFirstNonBlind && (heroFirstNonBlind.type === 'call' || heroFirstNonBlind.type === 'raise');
    }
    return false;
  },
  result: function(h, v) {
    if (!h.outcome) return false;
    var res = h.outcome.result;
    var sd = isShowdown(h);
    if (v === 'won') return res === 'won';
    if (v === 'lost-sd') return res === 'lost' && sd;
    if (v === 'fold-pre') {
      if (res !== 'folded') return false;
      var acts = parseActions(h.actions);
      var heroFold = acts.find(function(a) { return a.isMe && a.type === 'fold'; });
      return heroFold && heroFold.street === 'Preflop';
    }
    if (v === 'fold-post') {
      if (res !== 'folded') return false;
      var acts2 = parseActions(h.actions);
      var heroFold2 = acts2.find(function(a) { return a.isMe && a.type === 'fold'; });
      return heroFold2 && heroFold2.street !== 'Preflop';
    }
    if (v === 'showdown') return sd;
    return false;
  },
};

// Filter the hand list by every clause in the segment's clauses list.
function _crFilterHands(hands, segment, clauseDefs) {
  if (!segment.clauses || !segment.clauses.length) return hands.slice();
  return hands.filter(function(h) {
    for (var i = 0; i < segment.clauses.length; i++) {
      var clauseId = segment.clauses[i];
      var def = clauseDefs.find(function(c) { return c.id === clauseId; });
      if (!def) continue;
      var value = segment.values[clauseId];
      if (value == null || (Array.isArray(value) && !value.length)) continue;
      var pred = def.kind === 'hand' ? CR_HAND_PREDICATES[clauseId] : CR_DECISION_PREDICATES[clauseId];
      if (!pred) continue;
      if (!pred(h, value)) return false;
    }
    return true;
  });
}

// ── 5. ENGINE ────────────────────────────────────────────────────────────────
// Returns { metrics, charts, sampleSize } for the slice. Insight cards are
// evaluated separately so compare mode can mix per-segment and cross-segment
// rules.
function runCustomReport(hands, segment, clauseDefs) {
  var filtered = _crFilterHands(hands, segment, clauseDefs);
  var n = filtered.length;

  // bb/100 calculation - cash hands only, sum BB-normalised P&L.
  var totalBB = 0;
  var cashHands = 0;
  for (var i = 0; i < filtered.length; i++) {
    var h = filtered[i];
    if (!isCashHand(h)) continue;
    var bb = getHandBB(h);
    if (!bb || bb <= 0) continue;
    totalBB += getHandPnlValue(h) / bb;
    cashHands++;
  }
  var bb100 = cashHands > 0 ? Math.round((totalBB / cashHands) * 100 * 10) / 10 : null;

  // Win rate, VPIP, PFR, action breakdown via existing analyse().
  var d = filtered.length ? analyse(filtered) : null;

  // Per-position bb/100.
  var posOrder = ['UTG', 'UTG+1', 'MP', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
  var byPosition = {};
  for (var pi = 0; pi < posOrder.length; pi++) {
    var p = posOrder[pi];
    var posHands = filtered.filter(function(h) { return h.position === p && isCashHand(h); });
    if (!posHands.length) continue;
    var pBB = 0, pCount = 0;
    for (var ph = 0; ph < posHands.length; ph++) {
      var bb2 = getHandBB(posHands[ph]);
      if (!bb2) continue;
      pBB += getHandPnlValue(posHands[ph]) / bb2;
      pCount++;
    }
    byPosition[p] = {
      hands: posHands.length,
      bb100: pCount > 0 ? Math.round(pBB / pCount * 100 * 10) / 10 : null,
    };
  }

  // Per-hole-class win rate.
  var classOrder = ['pairs', 'AK', 'broadway', 'suited', 'sc', 'connectors', 'ace-rag', 'junk'];
  var classLabels = { pairs: 'Pairs', AK: 'AK', broadway: 'Broadway', suited: 'Suited', sc: 'S. Conn', connectors: 'Conn', 'ace-rag': 'Ace-Rag', junk: 'Junk' };
  var byClass = {};
  for (var ci = 0; ci < classOrder.length; ci++) {
    var cls = classOrder[ci];
    var clsHands = filtered.filter(function(h) { return _crHoleClass(h.hole) === cls; });
    if (!clsHands.length) continue;
    var won = clsHands.filter(function(h) { return h.outcome && h.outcome.result === 'won'; }).length;
    var outcomeN = clsHands.filter(function(h) { return h.outcome; }).length;
    byClass[cls] = {
      label: classLabels[cls],
      hands: clsHands.length,
      wr: outcomeN > 0 ? Math.round(won / outcomeN * 100) : null,
    };
  }

  // Per-session bb/100 trend.
  var sessions = buildSessions(filtered);
  var trend = sessions.map(function(s) {
    var sBB = 0, sCount = 0;
    for (var hi = 0; hi < s.hands.length; hi++) {
      var h2 = s.hands[hi];
      if (!isCashHand(h2)) continue;
      var bb3 = getHandBB(h2);
      if (!bb3) continue;
      sBB += getHandPnlValue(h2) / bb3;
      sCount++;
    }
    return {
      label: s.startTs ? new Date(s.startTs).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '',
      hands: s.hands.length,
      bb100: sCount > 0 ? Math.round(sBB / sCount * 100 * 10) / 10 : null,
    };
  }).filter(function(p) { return p.bb100 !== null; });

  // Action breakdown.
  var actionBreakdown = null;
  if (d && (d.folds + d.checks + d.calls + d.raises) > 0) {
    var total = d.folds + d.checks + d.calls + d.raises;
    actionBreakdown = {
      fold: Math.round(d.folds / total * 100),
      check: Math.round(d.checks / total * 100),
      call: Math.round(d.calls / total * 100),
      raise: Math.round(d.raises / total * 100),
    };
  }

  // Sessions touched.
  var sessionIds = {};
  for (var sh = 0; sh < sessions.length; sh++) sessionIds[sh] = true;

  return {
    filtered: filtered,
    sampleSize: n,
    sessions: sessions.length,
    metrics: {
      n: n,
      bb100: bb100,
      wr: d ? d.core.wr : null,
      vpip: d ? d.core.vpipPct : null,
      pfr: d ? d.core.pfrPct : null,
      wtsd: d ? d.core.wtsdPct : null,
      actions: actionBreakdown,
    },
    charts: {
      trend: trend,
      byPosition: byPosition,
      byClass: byClass,
    },
  };
}

// ── 6. INSIGHT RULES ─────────────────────────────────────────────────────────
// Each rule: { id, eval(metrics, baseline, sampleOk): null | { sev, title, body, chips } }
var CR_RULES = [
  {
    id: 'strong-winner',
    requiresSampleOk: true,
    eval: function(m) {
      if (m.bb100 == null || m.bb100 < 6) return null;
      return {
        sev: 'g',
        title: 'Strong winner',
        body: 'This report is running at +' + m.bb100 + ' bb/100 across ' + m.n + ' hands. Healthy chunk of profit comes from here.',
        chips: [{ v: '+' + m.bb100 + ' bb/100', hi: true }, { v: m.n + ' hands' }],
      };
    },
  },
  {
    id: 'strong-loser',
    requiresSampleOk: true,
    eval: function(m) {
      if (m.bb100 == null || m.bb100 > -6) return null;
      return {
        sev: 'r',
        title: 'Strong loser',
        body: 'This report bleeds ' + m.bb100 + ' bb/100 across ' + m.n + ' hands. Worth narrowing the spot to find what is leaking.',
        chips: [{ v: m.bb100 + ' bb/100', hi: true }, { v: m.n + ' hands' }],
      };
    },
  },
  {
    id: 'wide-passive',
    eval: function(m, baseline) {
      if (m.vpip == null || m.pfr == null) return null;
      var gap = m.vpip - m.pfr;
      if (gap < 12) return null;
      return {
        sev: 'a',
        title: 'Wide and passive',
        body: 'VPIP ' + m.vpip + '% vs PFR ' + m.pfr + '% in this report: a ' + gap + '-point gap. Calling more than raising usually leaks chips.',
        chips: [{ v: 'VPIP ' + m.vpip + '%' }, { v: 'PFR ' + m.pfr + '%' }, { v: 'gap ' + gap + ' pts', hi: true }],
      };
    },
  },
  {
    id: 'wide-aggressive',
    requiresSampleOk: true,
    eval: function(m, baseline) {
      if (m.vpip == null || m.pfr == null || m.bb100 == null) return null;
      if (baseline.vpip == null || baseline.pfr == null) return null;
      if (m.vpip <= baseline.vpip + 4) return null;
      if (m.pfr <= baseline.pfr + 4) return null;
      if (m.bb100 <= 0) return null;
      return {
        sev: 'g',
        title: 'Wide and aggressive',
        body: 'Playing wider and more aggressive than your overall game (VPIP ' + m.vpip + '% vs base ' + baseline.vpip + '%) and still winning at +' + m.bb100 + ' bb/100. This is a spot to lean into.',
        chips: [{ v: 'VPIP +' + (m.vpip - baseline.vpip) + ' pts', hi: true }, { v: '+' + m.bb100 + ' bb/100' }],
      };
    },
  },
  {
    id: 'tight-winner',
    requiresSampleOk: true,
    eval: function(m, baseline) {
      if (m.vpip == null || m.bb100 == null || baseline.vpip == null) return null;
      if (m.vpip >= baseline.vpip - 4) return null;
      if (m.bb100 <= 0) return null;
      return {
        sev: 'g',
        title: 'Tight winner',
        body: 'Tighter than your overall game (VPIP ' + m.vpip + '% vs base ' + baseline.vpip + '%) and profitable at +' + m.bb100 + ' bb/100. Selective play is working here.',
        chips: [{ v: 'VPIP -' + (baseline.vpip - m.vpip) + ' pts' }, { v: '+' + m.bb100 + ' bb/100', hi: true }],
      };
    },
  },
  {
    id: 'wtsd-out-of-band',
    eval: function(m) {
      if (m.wtsd == null) return null;
      if (m.wtsd >= 24 && m.wtsd <= 32) return null;
      var dir = m.wtsd > 32 ? 'too often' : 'not enough';
      return {
        sev: 'a',
        title: 'Showdown frequency ' + dir,
        body: 'You reach showdown ' + m.wtsd + '% of the time you see a flop in this report. Healthy range is 24-32%.',
        chips: [{ v: 'WTSD ' + m.wtsd + '%', hi: true }, { v: 'target 24-32%' }],
      };
    },
  },
];

// Comparison rules - run on { A: metrics, B: metrics } when both segments are
// sample-OK. Each returns null or { sev, title, body, chips }.
var CR_COMPARE_RULES = [
  {
    id: 'profit-gap',
    eval: function(A, B) {
      if (A.bb100 == null || B.bb100 == null) return null;
      var gap = A.bb100 - B.bb100;
      if (Math.abs(gap) < 8) return null;
      var winner = gap > 0 ? 'A' : 'B';
      var loser = gap > 0 ? 'B' : 'A';
      return {
        sev: gap > 0 ? 'g' : 'r',
        title: 'Segment ' + winner + ' is meaningfully more profitable',
        body: 'A runs at ' + A.bb100 + ' bb/100, B at ' + B.bb100 + ' bb/100: a ' + Math.abs(gap) + ' bb/100 gap. Worth interrogating what is different about ' + loser + '.',
        chips: [{ v: 'A: ' + A.bb100 + ' bb/100' }, { v: 'B: ' + B.bb100 + ' bb/100' }, { v: 'Δ ' + (gap > 0 ? '+' : '') + gap, hi: true }],
      };
    },
  },
  {
    id: 'vpip-widening',
    eval: function(A, B) {
      if (A.vpip == null || B.vpip == null) return null;
      var gap = A.vpip - B.vpip;
      if (Math.abs(gap) < 8) return null;
      return {
        sev: 'n',
        title: 'VPIP differs noticeably',
        body: 'You enter ' + A.vpip + '% of pots in A vs ' + B.vpip + '% in B. The range you play in these two reports is not the same.',
        chips: [{ v: 'A: VPIP ' + A.vpip + '%' }, { v: 'B: VPIP ' + B.vpip + '%' }],
      };
    },
  },
];

function _crEvaluateRules(result, baseline) {
  var m = result.metrics;
  if (result.sampleSize < CR_SAMPLE_MIN) {
    return [{
      sev: 'n',
      title: 'Not enough hands',
      body: result.sampleSize + ' hands in this report. Below ' + CR_SAMPLE_MIN + ' the numbers are too noisy to trust: widen filters or remove a clause.',
      chips: [{ v: result.sampleSize + ' / ' + CR_SAMPLE_MIN, hi: true }],
    }];
  }
  var sampleOk = result.sampleSize >= CR_SAMPLE_OK;
  var fired = [];
  for (var i = 0; i < CR_RULES.length; i++) {
    var rule = CR_RULES[i];
    if (rule.requiresSampleOk && !sampleOk) continue;
    var card = rule.eval(m, baseline, sampleOk);
    if (card) fired.push(card);
  }
  fired = fired.slice(0, 5);
  if (!fired.length) {
    fired.push({
      sev: 'n',
      title: 'Snapshot',
      body: result.sampleSize + ' hands, ' + result.sessions + ' sessions, ' + (m.bb100 != null ? m.bb100 + ' bb/100' : 'no cash data') + '. VPIP ' + (m.vpip != null ? m.vpip + '%' : '-') + ', PFR ' + (m.pfr != null ? m.pfr + '%' : '-') + '.',
      chips: [],
    });
  }
  return fired;
}

// ── 7. RENDERER ──────────────────────────────────────────────────────────────
// Module-scoped state: the panel keeps a reference to its hand list and state
// so popovers and button clicks can re-render in place without round-tripping
// through the top-level app render.
var _crState = null;
var _crHands = [];
var _crClauseDefs = [];
var _crBaseline = null;
var _crCharts = [];
var _crPopover = null;

function _crDestroyCharts() {
  for (var i = 0; i < _crCharts.length; i++) {
    if (_crCharts[i]) _crCharts[i].destroy();
  }
  _crCharts = [];
}

function _crClausePhrase(clauseId, segment) {
  var def = _crClauseDefs.find(function(c) { return c.id === clauseId; });
  if (!def) return null;
  var value = segment.values[clauseId];
  if (value == null || (Array.isArray(value) && !value.length)) return null;
  return def.phrase(value, def.options);
}

function _crRenderSentence(segment, segLabel) {
  var parts = [];
  for (var i = 0; i < segment.clauses.length; i++) {
    var clauseId = segment.clauses[i];
    var def = _crClauseDefs.find(function(c) { return c.id === clauseId; });
    if (!def) continue;
    var phrase = _crClausePhrase(clauseId, segment);
    var displayPhrase = phrase || '<span class="cr-empty">choose ' + def.label.toLowerCase() + '</span>';
    parts.push(
      '<span class="cr-token" data-segment="' + segLabel + '" data-clause="' + clauseId + '">' +
      displayPhrase +
      '</span>'
    );
  }

  // Build the sentence with commas / "and" joiners.
  var sentence = '';
  if (segLabel === 'A' && _crState.compare) sentence += '<span class="cr-seg-label">A:</span> ';
  if (segLabel === 'B') sentence += '<span class="cr-seg-label">B:</span> ';
  sentence += '<span class="cr-stem">Show me how I play</span> ';
  for (var pi = 0; pi < parts.length; pi++) {
    if (pi > 0) {
      sentence += (pi === parts.length - 1) ? ' <span class="cr-joiner">and</span> ' : '<span class="cr-joiner">,</span> ';
    }
    sentence += parts[pi];
  }

  // The "add clause" button.
  var available = _crClauseDefs.filter(function(c) { return segment.clauses.indexOf(c.id) === -1; });
  var addBtn = available.length
    ? ' <button class="cr-add-btn" data-segment="' + segLabel + '">+ add clause</button>'
    : '';
  sentence += addBtn;
  return '<div class="cr-sentence">' + sentence + '</div>';
}

function _crClosePopover() {
  if (_crPopover && _crPopover.parentNode) _crPopover.parentNode.removeChild(_crPopover);
  _crPopover = null;
}

function _crOpenAddClausePopover(targetEl, segLabel) {
  _crClosePopover();
  var segment = _crState[segLabel];
  var available = _crClauseDefs.filter(function(c) { return segment.clauses.indexOf(c.id) === -1; });
  if (!available.length) return;

  // Group by kind for readability.
  var hand = available.filter(function(c) { return c.kind === 'hand'; });
  var decision = available.filter(function(c) { return c.kind === 'decision'; });

  var html = '<div class="cr-pop-title">Add a clause</div>';
  if (hand.length) {
    html += '<div class="cr-pop-section dim-label">Hand-level</div>';
    html += hand.map(function(c) {
      return '<button class="cr-pop-opt" data-add-clause="' + c.id + '">' + c.label + '</button>';
    }).join('');
  }
  if (decision.length) {
    html += '<div class="cr-pop-section dim-label">Decision-level</div>';
    html += decision.map(function(c) {
      return '<button class="cr-pop-opt" data-add-clause="' + c.id + '">' + c.label + '</button>';
    }).join('');
  }

  _crShowPopover(targetEl, html, function(pop) {
    pop.querySelectorAll('[data-add-clause]').forEach(function(btn) {
      btn.onclick = function() {
        var clauseId = this.getAttribute('data-add-clause');
        segment.clauses.push(clauseId);
        // Initialise: pick first option for single-select, empty array for multi.
        var def = _crClauseDefs.find(function(c) { return c.id === clauseId; });
        if (def) {
          segment.values[clauseId] = def.multi
            ? (def.options[0] ? [def.options[0].value] : [])
            : (def.options[0] ? def.options[0].value : null);
        }
        _crClosePopover();
        _crSaveState(_crState);
        _crRerender();
      };
    });
  });
}

function _crOpenClausePopover(targetEl, segLabel, clauseId) {
  _crClosePopover();
  var def = _crClauseDefs.find(function(c) { return c.id === clauseId; });
  if (!def) return;
  var segment = _crState[segLabel];
  var current = segment.values[clauseId];

  var html = '<div class="cr-pop-title">' + def.label + '</div>';
  if (!def.options.length) {
    html += '<div class="desc-text">No options available. None of your hands match this clause yet.</div>';
  } else if (def.multi) {
    html += '<div class="cr-pop-list">';
    current = Array.isArray(current) ? current : [];
    html += def.options.map(function(o) {
      var checked = current.indexOf(o.value) !== -1;
      return '<label class="cr-pop-opt cr-pop-multi' + (checked ? ' selected' : '') + '">' +
        '<input type="checkbox" data-val="' + o.value + '"' + (checked ? ' checked' : '') + '>' +
        '<span>' + o.label + (o.meta ? ' <span class="cr-pop-meta">' + o.meta + '</span>' : '') + '</span>' +
        '</label>';
    }).join('');
    html += '</div>';
  } else {
    html += '<div class="cr-pop-list">';
    html += def.options.map(function(o) {
      var sel = current === o.value;
      return '<button class="cr-pop-opt' + (sel ? ' selected' : '') + '" data-val="' + o.value + '">' +
        o.label + (o.meta ? ' <span class="cr-pop-meta">' + o.meta + '</span>' : '') +
        '</button>';
    }).join('');
    html += '</div>';
  }
  html += '<button class="cr-pop-remove">Remove this filter</button>';

  _crShowPopover(targetEl, html, function(pop) {
    if (def.multi) {
      pop.querySelectorAll('input[type="checkbox"]').forEach(function(cb) {
        cb.onchange = function() {
          var val = this.getAttribute('data-val');
          var arr = Array.isArray(segment.values[clauseId]) ? segment.values[clauseId] : [];
          var idx = arr.indexOf(val);
          if (this.checked && idx === -1) arr.push(val);
          if (!this.checked && idx !== -1) arr.splice(idx, 1);
          segment.values[clauseId] = arr;
          this.parentNode.classList.toggle('selected', this.checked);
          _crSaveState(_crState);
          _crRerender(true); // re-render content only, keep popover
        };
      });
    } else {
      pop.querySelectorAll('[data-val]').forEach(function(btn) {
        btn.onclick = function() {
          segment.values[clauseId] = this.getAttribute('data-val');
          _crClosePopover();
          _crSaveState(_crState);
          _crRerender();
        };
      });
    }
    pop.querySelector('.cr-pop-remove').onclick = function() {
      segment.clauses = segment.clauses.filter(function(c) { return c !== clauseId; });
      delete segment.values[clauseId];
      _crClosePopover();
      _crSaveState(_crState);
      _crRerender();
    };
  });
}

function _crShowPopover(anchor, html, wire) {
  _crPopover = document.createElement('div');
  _crPopover.className = 'cr-pop';
  _crPopover.innerHTML = html;
  document.body.appendChild(_crPopover);
  var rect = anchor.getBoundingClientRect();
  var top = rect.bottom + window.scrollY + 6;
  var left = rect.left + window.scrollX;
  // Right edge guard.
  var popWidth = _crPopover.offsetWidth;
  if (left + popWidth > window.innerWidth - 8) left = window.innerWidth - popWidth - 8;
  _crPopover.style.top = top + 'px';
  _crPopover.style.left = left + 'px';
  if (wire) wire(_crPopover);
}

// Headline strip - the three big numbers + sample-size pill.
function _crRenderHeadline(result, compareResult) {
  var m = result.metrics;
  var dim = result.sampleSize < CR_SAMPLE_MIN;

  function tile(label, val, color) {
    return '<div class="cr-tile' + (dim ? ' cr-tile-dim' : '') + '">' +
      '<div class="cr-tile-label dim-label">' + label + '</div>' +
      '<div class="cr-tile-value serif-value" style="color:' + color + '">' + val + '</div>' +
      '</div>';
  }

  function tileCompare(label, valA, valB, colorA, colorB, delta, deltaColor) {
    return '<div class="cr-tile cr-tile-compare">' +
      '<div class="cr-tile-label dim-label">' + label + '</div>' +
      '<div class="cr-tile-trio">' +
      '<div><div class="cr-tile-mini-label">A</div><div class="serif-value" style="color:' + colorA + '">' + valA + '</div></div>' +
      '<div><div class="cr-tile-mini-label">Δ</div><div class="serif-value" style="color:' + deltaColor + '">' + delta + '</div></div>' +
      '<div><div class="cr-tile-mini-label">B</div><div class="serif-value" style="color:' + colorB + '">' + valB + '</div></div>' +
      '</div></div>';
  }

  var bb100Str = m.bb100 != null ? (m.bb100 > 0 ? '+' : '') + m.bb100 : '-';
  var bb100Col = m.bb100 == null ? 'var(--dim)' : (m.bb100 >= 0 ? 'var(--green)' : 'var(--red)');
  var wrStr = m.wr != null ? m.wr + '%' : '-';
  var wrCol = m.wr == null ? 'var(--dim)' : wrColor(m.wr);

  if (!compareResult) {
    return '<div class="cr-headline">' +
      tile('Hands matched', result.sampleSize, 'var(--gold)') +
      tile('Sessions', result.sessions, 'var(--text)') +
      tile('bb/100', bb100Str, bb100Col) +
      tile('Win rate', wrStr, wrCol) +
      tile('VPIP', m.vpip != null ? m.vpip + '%' : '-', 'var(--text)') +
      tile('PFR', m.pfr != null ? m.pfr + '%' : '-', 'var(--text)') +
      '</div>';
  }

  var mB = compareResult.metrics;
  var bb100B = mB.bb100 != null ? (mB.bb100 > 0 ? '+' : '') + mB.bb100 : '-';
  var bb100BCol = mB.bb100 == null ? 'var(--dim)' : (mB.bb100 >= 0 ? 'var(--green)' : 'var(--red)');
  var bb100Delta = (m.bb100 != null && mB.bb100 != null) ? Math.round((m.bb100 - mB.bb100) * 10) / 10 : null;
  var bb100DeltaStr = bb100Delta == null ? '-' : (bb100Delta > 0 ? '+' : '') + bb100Delta;
  var bb100DeltaCol = bb100Delta == null ? 'var(--dim)' : (bb100Delta > 0 ? 'var(--green)' : bb100Delta < 0 ? 'var(--red)' : 'var(--text)');

  var wrDelta = (m.wr != null && mB.wr != null) ? m.wr - mB.wr : null;
  var wrBCol = mB.wr == null ? 'var(--dim)' : wrColor(mB.wr);

  return '<div class="cr-headline cr-headline-compare">' +
    tileCompare('Hands matched', result.sampleSize, compareResult.sampleSize, 'var(--gold)', 'var(--gold)', (result.sampleSize - compareResult.sampleSize), 'var(--dim)') +
    tileCompare('bb/100', bb100Str, bb100B, bb100Col, bb100BCol, bb100DeltaStr, bb100DeltaCol) +
    tileCompare('Win rate', wrStr, mB.wr != null ? mB.wr + '%' : '-', wrCol, wrBCol, wrDelta != null ? (wrDelta > 0 ? '+' : '') + wrDelta + '%' : '-', 'var(--dim)') +
    tileCompare('VPIP', m.vpip != null ? m.vpip + '%' : '-', mB.vpip != null ? mB.vpip + '%' : '-', 'var(--text)', 'var(--text)', (m.vpip != null && mB.vpip != null) ? (m.vpip - mB.vpip > 0 ? '+' : '') + (m.vpip - mB.vpip) + '%' : '-', 'var(--dim)') +
    '</div>';
}

function _crRenderInsightCards(cards) {
  if (!cards.length) return '';
  return '<div class="ins-grid">' + cards.map(function(c) {
    return ins(c.sev, c.title, c.body, c.chips || []);
  }).join('') + '</div>';
}

// Compute the player's own all-time aggregate as the baseline for rules.
function _crComputeBaseline(hands) {
  if (!hands.length) return { vpip: null, pfr: null, bb100: null };
  var d = analyse(hands);
  var totalBB = 0, count = 0;
  for (var i = 0; i < hands.length; i++) {
    var h = hands[i];
    if (!isCashHand(h)) continue;
    var bb = getHandBB(h);
    if (!bb) continue;
    totalBB += getHandPnlValue(h) / bb;
    count++;
  }
  return {
    vpip: d.core.vpipPct,
    pfr: d.core.pfrPct,
    bb100: count > 0 ? Math.round(totalBB / count * 100 * 10) / 10 : null,
  };
}

function _crRerender(keepPopover) {
  if (!keepPopover) _crClosePopover();
  var host = document.getElementById('p-custom');
  if (host) _crRenderInto(host);
}

function _crRenderInto(container) {
  _crDestroyCharts();

  var resultA = runCustomReport(_crHands, _crState.A, _crClauseDefs);
  var resultB = _crState.compare ? runCustomReport(_crHands, _crState.B, _crClauseDefs) : null;

  var html = '';
  html += panelTitle('Custom Report');
  html += panelDesc('Build your own report. Click any underlined word to change it. Add clauses to narrow further.');

  // Compare toggle.
  html += '<div class="cr-toolbar">';
  html += '<label class="cr-compare-toggle">';
  html += '<input type="checkbox" id="cr-compare-toggle"' + (_crState.compare ? ' checked' : '') + '>';
  html += '<span>Compare two reports</span></label>';
  html += '<button class="cr-reset-btn" id="cr-reset-btn">Reset filters</button>';
  html += '</div>';

  // Sentence(s).
  html += '<div class="cr-sentence-wrap">';
  html += _crRenderSentence(_crState.A, 'A');
  if (_crState.compare) {
    html += '<div class="cr-vs">vs</div>';
    html += _crRenderSentence(_crState.B, 'B');
  }
  html += '</div>';

  // Headline strip.
  html += '<div class="p-row">';
  html += _crRenderHeadline(resultA, resultB);
  html += '</div>';

  // Insight cards.
  var cards = [];
  if (_crState.compare) {
    if (resultA.sampleSize < CR_SAMPLE_MIN || resultB.sampleSize < CR_SAMPLE_MIN) {
      var which = resultA.sampleSize < CR_SAMPLE_MIN ? 'A' : 'B';
      var n = resultA.sampleSize < CR_SAMPLE_MIN ? resultA.sampleSize : resultB.sampleSize;
      cards.push({
        sev: 'n',
        title: 'Not enough hands in segment ' + which,
        body: 'Segment ' + which + ' has ' + n + ' hands. Both segments need at least ' + CR_SAMPLE_MIN + ' to compare meaningfully.',
        chips: [{ v: n + ' / ' + CR_SAMPLE_MIN, hi: true }],
      });
    } else {
      // Per-segment cards (label them).
      var aCards = _crEvaluateRules(resultA, _crBaseline);
      var bCards = _crEvaluateRules(resultB, _crBaseline);
      aCards.forEach(function(c) { c.title = '[A] ' + c.title; });
      bCards.forEach(function(c) { c.title = '[B] ' + c.title; });
      cards = aCards.slice(0, 2).concat(bCards.slice(0, 2));
      // Compare rules.
      for (var ci = 0; ci < CR_COMPARE_RULES.length; ci++) {
        var card = CR_COMPARE_RULES[ci].eval(resultA.metrics, resultB.metrics);
        if (card) cards.push(card);
      }
    }
  } else {
    cards = _crEvaluateRules(resultA, _crBaseline);
  }
  html += '<div class="p-row">' + _crRenderInsightCards(cards) + '</div>';

  // Charts.
  if (resultA.sampleSize >= CR_SAMPLE_MIN || (resultB && resultB.sampleSize >= CR_SAMPLE_MIN)) {
    html += '<div class="p-row">';
    html += '<div class="cr-charts">';
    html += '<div class="cr-chart-card"><div class="sec-subtitle mt-0">bb/100 over time</div><div class="chart-wrap-full"><canvas id="cr-trend"></canvas></div></div>';
    html += '<div class="cr-chart-card"><div class="sec-subtitle mt-0">bb/100 by position</div><div class="chart-wrap-full"><canvas id="cr-position"></canvas></div></div>';
    html += '<div class="cr-chart-card"><div class="sec-subtitle mt-0">Win rate by hand class</div><div class="chart-wrap-full"><canvas id="cr-cards"></canvas></div></div>';
    html += '<div class="cr-chart-card"><div class="sec-subtitle mt-0">Action breakdown</div><div class="chart-wrap-full"><canvas id="cr-actions"></canvas></div></div>';
    html += '</div></div>';
  }

  container.innerHTML = html;

  // Bind events.
  container.querySelectorAll('.cr-token').forEach(function(tok) {
    tok.onclick = function(e) {
      e.stopPropagation();
      _crOpenClausePopover(this, this.getAttribute('data-segment'), this.getAttribute('data-clause'));
    };
  });
  container.querySelectorAll('.cr-add-btn').forEach(function(btn) {
    btn.onclick = function(e) {
      e.stopPropagation();
      _crOpenAddClausePopover(this, this.getAttribute('data-segment'));
    };
  });

  var toggle = container.querySelector('#cr-compare-toggle');
  if (toggle) toggle.onchange = function() {
    _crState.compare = this.checked;
    if (_crState.compare && (!_crState.B || !_crState.B.clauses.length)) {
      _crState.B = {
        clauses: _crState.A.clauses.slice(),
        values: JSON.parse(JSON.stringify(_crState.A.values)),
      };
    }
    _crSaveState(_crState);
    _crRerender();
  };

  var reset = container.querySelector('#cr-reset-btn');
  if (reset) reset.onclick = function() {
    _crState = { compare: false, A: _crDefaultSegment(), B: _crDefaultSegment() };
    _crSaveState(_crState);
    _crRerender();
  };

  // Render charts.
  _crRenderCharts(resultA, resultB);
}

function _crRenderCharts(resultA, resultB) {
  var colors = getChartColors();
  var dataA = resultA.charts;
  var dataB = resultB ? resultB.charts : null;

  // Trend (line).
  var trendCanvas = document.getElementById('cr-trend');
  if (trendCanvas && dataA.trend.length >= 2) {
    var labelsT = dataA.trend.map(function(p) { return p.label; });
    var datasets = [{
      label: dataB ? 'A' : 'bb/100',
      data: dataA.trend.map(function(p) { return p.bb100; }),
      borderColor: colors.gold,
      backgroundColor: colors.gold + '22',
      borderWidth: 2,
      tension: 0.3,
      pointRadius: dataA.trend.length <= 15 ? 3 : 0,
      fill: true,
    }];
    if (dataB && dataB.trend.length >= 2) {
      // Align by date label - simple zip on shorter list since compare slices may differ.
      var bSet = {};
      dataB.trend.forEach(function(p) { bSet[p.label] = p.bb100; });
      datasets.push({
        label: 'B',
        data: labelsT.map(function(l) { return bSet[l] != null ? bSet[l] : null; }),
        borderColor: colors.green,
        backgroundColor: 'transparent',
        borderWidth: 2,
        tension: 0.3,
        pointRadius: 0,
        spanGaps: true,
      });
    }
    _crCharts.push(createChart(trendCanvas, 'line', { labels: labelsT, datasets: datasets }, {
      legend: chartLegend(colors, !!dataB),
      tooltip: chartTooltip(colors, { label: function(c) { return ' ' + c.parsed.y + ' bb/100'; } }),
      scales: {
        x: chartXScale(colors, { maxTicksLimit: 6, maxRotation: 0 }),
        y: chartYScaleZeroLine(colors, { tickCallback: function(v) { return v + ''; } }),
      },
    }));
  } else if (trendCanvas) {
    trendCanvas.parentNode.parentNode.innerHTML = '<div class="sec-subtitle mt-0">bb/100 over time</div><div class="desc-text">Need at least 2 sessions of cash hands in this report.</div>';
  }

  // Position bars.
  var posCanvas = document.getElementById('cr-position');
  if (posCanvas) {
    var posOrder = ['UTG', 'UTG+1', 'MP', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
    var active = posOrder.filter(function(p) { return dataA.byPosition[p] && dataA.byPosition[p].bb100 != null; });
    if (active.length >= 2) {
      var posVals = active.map(function(p) { return dataA.byPosition[p].bb100; });
      var posDatasets = [{
        label: dataB ? 'A' : 'bb/100',
        data: posVals,
        backgroundColor: posVals.map(function(v) { return (v >= 0 ? colors.green : colors.red) + '99'; }),
        borderColor: posVals.map(function(v) { return v >= 0 ? colors.green : colors.red; }),
        borderWidth: 1,
        borderRadius: 4,
      }];
      if (dataB) {
        posDatasets.push({
          label: 'B',
          data: active.map(function(p) { return dataB.byPosition[p] ? dataB.byPosition[p].bb100 : null; }),
          backgroundColor: colors.gold + '99',
          borderColor: colors.gold,
          borderWidth: 1,
          borderRadius: 4,
        });
      }
      _crCharts.push(createChart(posCanvas, 'bar', { labels: active, datasets: posDatasets }, {
        legend: chartLegend(colors, !!dataB),
        tooltip: chartTooltip(colors, { label: function(c) { return ' ' + c.parsed.y + ' bb/100'; } }),
        scales: { x: chartXScale(colors), y: chartYScaleZeroLine(colors, { tickCallback: function(v) { return v + ''; } }) },
      }));
    } else {
      posCanvas.parentNode.parentNode.innerHTML = '<div class="sec-subtitle mt-0">bb/100 by position</div><div class="desc-text">Need at least two positions with cash data in this report.</div>';
    }
  }

  // Cards bars (win rate by class).
  var cardsCanvas = document.getElementById('cr-cards');
  if (cardsCanvas) {
    var classOrder = ['pairs', 'AK', 'broadway', 'suited', 'sc', 'connectors', 'ace-rag', 'junk'];
    var activeCls = classOrder.filter(function(c) { return dataA.byClass[c] && dataA.byClass[c].wr != null; });
    if (activeCls.length >= 2) {
      var labels = activeCls.map(function(c) { return dataA.byClass[c].label; });
      var vals = activeCls.map(function(c) { return dataA.byClass[c].wr; });
      var datasets = [{
        label: dataB ? 'A' : 'Win %',
        data: vals,
        backgroundColor: vals.map(function(v) { return (v >= 50 ? colors.green : colors.red) + '99'; }),
        borderColor: vals.map(function(v) { return v >= 50 ? colors.green : colors.red; }),
        borderWidth: 1,
        borderRadius: 4,
      }];
      if (dataB) {
        datasets.push({
          label: 'B',
          data: activeCls.map(function(c) { return dataB.byClass[c] ? dataB.byClass[c].wr : null; }),
          backgroundColor: colors.gold + '99',
          borderColor: colors.gold,
          borderWidth: 1,
          borderRadius: 4,
        });
      }
      _crCharts.push(createChart(cardsCanvas, 'bar', { labels: labels, datasets: datasets }, {
        legend: chartLegend(colors, !!dataB),
        tooltip: chartTooltip(colors, { label: function(c) { return ' ' + c.parsed.y + '% win rate'; } }),
        scales: { x: chartXScale(colors), y: chartYScale(colors, { max: 100, tickCallback: function(v) { return v + '%'; } }) },
      }));
    } else {
      cardsCanvas.parentNode.parentNode.innerHTML = '<div class="sec-subtitle mt-0">Win rate by hand class</div><div class="desc-text">Need at least two hand classes in this report.</div>';
    }
  }

  // Action breakdown (donut).
  var actCanvas = document.getElementById('cr-actions');
  if (actCanvas) {
    if (resultA.metrics.actions) {
      var a = resultA.metrics.actions;
      var labels = ['Fold', 'Check', 'Call', 'Raise'];
      var vals = [a.fold, a.check, a.call, a.raise];
      _crCharts.push(new Chart(actCanvas, {
        type: 'doughnut',
        data: {
          labels: labels,
          datasets: [{
            data: vals,
            backgroundColor: [colors.dim, colors.amber, colors.gold, colors.green],
            borderColor: colors.border,
            borderWidth: 1,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          aspectRatio: 1.6,
          plugins: {
            legend: chartLegend(colors, true),
            tooltip: chartTooltip(colors, { label: function(c) { return ' ' + c.label + ': ' + c.parsed + '%'; } }),
          },
        },
      }));
    } else {
      actCanvas.parentNode.parentNode.innerHTML = '<div class="sec-subtitle mt-0">Action breakdown</div><div class="desc-text">No action data in this report.</div>';
    }
  }
}

// ── 8. PUBLIC ENTRY ──────────────────────────────────────────────────────────
function renderCustomReport(container, hands) {
  if (!container) return;
  _crHands = hands || [];
  // Rebuild defs against current hand list - table/opponent options depend on it.
  _crClauseDefs = _crBuildClauseDefs(_crHands);
  _crBaseline = _crComputeBaseline(_crHands);
  if (!_crState) _crState = _crLoadState();
  // Drop any saved clauses that no longer exist (defensive against schema changes
  // or hand-list shrinkage that wipes an opponent / table option).
  ['A', 'B'].forEach(function(seg) {
    if (!_crState[seg]) _crState[seg] = _crDefaultSegment();
    _crState[seg].clauses = _crState[seg].clauses.filter(function(c) {
      return _crClauseDefs.some(function(def) { return def.id === c; });
    });
  });

  _crRenderInto(container);
}

// Document-level click closes the popover (unless the click is inside the popover
// or on a token / add-clause button - those are wired to (re)open it).
document.addEventListener('click', function(e) {
  if (!_crPopover) return;
  if (_crPopover.contains(e.target)) return;
  if (e.target.closest && e.target.closest('.cr-token, .cr-add-btn')) return;
  _crClosePopover();
});
