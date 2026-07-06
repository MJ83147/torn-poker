// Custom Report logic: clause definitions, predicates, filtering, metrics
// and rules. No DOM, no markup — the view is js/panels/views/custom.js.

var CR_SAMPLE_MIN = 80;   // below this, headline metrics greyed, rules skipped
var CR_SAMPLE_OK  = 250;  // above this, win-rate insights are allowed to fire

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

function _crWithinWindow(ts, windowKey) {
  if (windowKey === 'all') return true;
  if (!ts) return false;
  var now = Date.now();
  var ms = { '7d': 7, '30d': 30, 'year': 365 }[windowKey];
  if (!ms) return true;
  return now - ts <= ms * 86400000;
}

function _crHoleClass(hole) {
  var key = parseHoleKey(hole);
  if (!key) return null;
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

function _crBuildClauseDefs(hands) {
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

  var seatCounts = {};
  for (var s = 0; s < hands.length; s++) {
    var n = countHandPlayers(hands[s]);
    if (n >= 2) seatCounts[n] = (seatCounts[n] || 0) + 1;
  }
  var seatOpts = Object.keys(seatCounts).map(Number).sort(function(a, b) { return a - b; }).map(function(n) {
    return { value: String(n), label: n + ' players', meta: seatCounts[n] + ' hands' };
  });

  var stakeCounts = {};
  for (var k = 0; k < hands.length; k++) {
    var key = _crStakeKey(getHandBB(hands[k]));
    if (key) stakeCounts[key] = (stakeCounts[key] || 0) + 1;
  }
  var stakeOpts = CR_STAKE_BANDS.filter(function(b) { return stakeCounts[b.key]; }).map(function(b) {
    return { value: b.key, label: b.label, meta: stakeCounts[b.key] + ' hands' };
  });

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

var CR_STORAGE_KEY = 'tc_poker_custom_report';

function _crDefaultSegment() {
  return { clauses: [], values: {} };
}

function _crLoadState() {
  return getJSON(CR_STORAGE_KEY, { compare: false, A: _crDefaultSegment(), B: _crDefaultSegment() });
}

function _crSaveState(state) {
  setJSON(CR_STORAGE_KEY, state);
}

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

function runCustomReport(hands, segment, clauseDefs) {
  var filtered = _crFilterHands(hands, segment, clauseDefs);
  var n = filtered.length;

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

  var d = filtered.length ? analyse(filtered) : null;

  var byPosition = {};
  for (var pi = 0; pi < POSITION_ORDER.length; pi++) {
    var p = POSITION_ORDER[pi];
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
      label: fmtDateShort(s.startTs),
      hands: s.hands.length,
      bb100: sCount > 0 ? Math.round(sBB / sCount * 100 * 10) / 10 : null,
    };
  }).filter(function(p) { return p.bb100 !== null; });

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
