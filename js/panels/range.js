// Range panel logic. No DOM, no markup — the view is js/panels/views/range.js.

var _rangeData = null;
var _rangeDataPromise = null;

function getRangeData() {
  if (_rangeData) return Promise.resolve(_rangeData);
  if (_rangeDataPromise) return _rangeDataPromise;
  _rangeDataPromise = fetch('js/data/ranges.json')
    .then(function(res) { return res.json(); })
    .then(function(json) { _rangeData = json; return json; });
  return _rangeDataPromise;
}

var HERO_CHARTS = {
  'UTG': [
    { label: 'RFI',             key: 'RFI',              type: 'rfi',     bucket: 'RFI',                heroDataLabel: 'UTG' },
    { label: 'vs UTG+1 3bet',   key: 'vs_3bet_UTG+1',    type: 'vs-3bet', bucket: 'UTG RFI vs 3bet',    matchup: 'UTG vs UTG+1 3bet' },
    { label: 'vs UTG+2 3bet',   key: 'vs_3bet_UTG+2',    type: 'vs-3bet', bucket: 'UTG RFI vs 3bet',    matchup: 'UTG vs UTG+2 3bet' },
    { label: 'vs LJ 3bet',      key: 'vs_3bet_LJ',       type: 'vs-3bet', bucket: 'UTG RFI vs 3bet',    matchup: 'UTG vs LJ 3bet' },
    { label: 'vs HJ 3bet',      key: 'vs_3bet_HJ',       type: 'vs-3bet', bucket: 'UTG RFI vs 3bet',    matchup: 'UTG vs HJ 3bet' },
    { label: 'vs CO/BTN 3bet',  key: 'vs_3bet_CO_BTN',   type: 'vs-3bet', bucket: 'UTG RFI vs 3bet',    matchup: 'UTG vs CO/BTN 3bet' },
    { label: 'vs SB/BB 3bet',   key: 'vs_3bet_SB_BB',    type: 'vs-3bet', bucket: 'UTG RFI vs 3bet',    matchup: 'UTG vs SB/BB 3bet' },
  ],
  'UTG+1': [
    { label: 'RFI',             key: 'RFI',              type: 'rfi',     bucket: 'RFI',                heroDataLabel: 'UTG+1' },
    { label: 'vs UTG',          key: 'vs_RFI_UTG',       type: 'vs-rfi',  bucket: 'Facing RFI: EP/MP',  matchup: 'UTG+1 vs UTG' },
    { label: 'vs UTG+2 3bet',   key: 'vs_3bet_UTG+2',    type: 'vs-3bet', bucket: 'UTG+1 RFI vs 3bet',  matchup: 'UTG+1 vs UTG+2 3bet' },
    { label: 'vs LJ 3bet',      key: 'vs_3bet_LJ',       type: 'vs-3bet', bucket: 'UTG+1 RFI vs 3bet',  matchup: 'UTG+1 vs LJ 3bet' },
    { label: 'vs HJ/CO 3bet',   key: 'vs_3bet_HJ_CO',    type: 'vs-3bet', bucket: 'UTG+1 RFI vs 3bet',  matchup: 'UTG+1 vs HJ/CO 3bet' },
    { label: 'vs BTN 3bet',     key: 'vs_3bet_BTN',      type: 'vs-3bet', bucket: 'UTG+1 RFI vs 3bet',  matchup: 'UTG+1 vs BTN 3bet' },
    { label: 'vs SB/BB 3bet',   key: 'vs_3bet_SB_BB',    type: 'vs-3bet', bucket: 'UTG+1 RFI vs 3bet',  matchup: 'UTG+1 vs SB/BB 3bet' },
  ],
  'UTG+2': [
    { label: 'RFI',             key: 'RFI',              type: 'rfi',     bucket: 'RFI',                heroDataLabel: 'UTG+2' },
    { label: 'vs UTG/UTG+1',    key: 'vs_RFI_UTG_UTG+1', type: 'vs-rfi',  bucket: 'Facing RFI: EP/MP',  matchup: 'UTG+2 vs UTG/UTG+1' },
    { label: 'vs LJ 3bet',      key: 'vs_3bet_LJ',       type: 'vs-3bet', bucket: 'UTG+2 RFI vs 3bet',  matchup: 'UTG+2 vs LJ 3bet' },
    { label: 'vs HJ 3bet',      key: 'vs_3bet_HJ',       type: 'vs-3bet', bucket: 'UTG+2 RFI vs 3bet',  matchup: 'UTG+2 vs HJ 3bet' },
    { label: 'vs CO/BTN 3bet',  key: 'vs_3bet_CO_BTN',   type: 'vs-3bet', bucket: 'UTG+2 RFI vs 3bet',  matchup: 'UTG+2 vs CO/BTN 3bet' },
    { label: 'vs SB/BB 3bet',   key: 'vs_3bet_SB_BB',    type: 'vs-3bet', bucket: 'UTG+2 RFI vs 3bet',  matchup: 'UTG+2 vs SB/BB 3bet' },
  ],
  'LJ': [
    { label: 'RFI',             key: 'RFI',              type: 'rfi',     bucket: 'RFI',                heroDataLabel: 'Lojack' },
    { label: 'vs UTG/UTG+1',    key: 'vs_RFI_UTG_UTG+1', type: 'vs-rfi',  bucket: 'Facing RFI: EP/MP',  matchup: 'LJ vs UTG/UTG+1' },
    { label: 'vs UTG+2',        key: 'vs_RFI_UTG+2',     type: 'vs-rfi',  bucket: 'Facing RFI: EP/MP',  matchup: 'LJ vs UTG+2' },
    { label: 'vs HJ 3bet',      key: 'vs_3bet_HJ',       type: 'vs-3bet', bucket: 'LJ RFI vs 3bet',     matchup: 'LJ vs HJ 3bet' },
    { label: 'vs CO 3bet',      key: 'vs_3bet_CO',       type: 'vs-3bet', bucket: 'LJ RFI vs 3bet',     matchup: 'LJ vs CO 3bet' },
    { label: 'vs BTN 3bet',     key: 'vs_3bet_BTN',      type: 'vs-3bet', bucket: 'LJ RFI vs 3bet',     matchup: 'LJ vs BTN 3bet' },
    { label: 'vs SB 3bet',      key: 'vs_3bet_SB',       type: 'vs-3bet', bucket: 'LJ RFI vs 3bet',     matchup: 'LJ vs SB 3bet' },
    { label: 'vs BB 3bet',      key: 'vs_3bet_BB',       type: 'vs-3bet', bucket: 'LJ RFI vs 3bet',     matchup: 'LJ vs BB 3bet' },
  ],
  'HJ': [
    { label: 'RFI',             key: 'RFI',              type: 'rfi',     bucket: 'RFI',                heroDataLabel: 'Hijack' },
    { label: 'vs UTG',          key: 'vs_RFI_UTG',       type: 'vs-rfi',  bucket: 'Facing RFI: EP/MP',  matchup: 'HJ vs UTG' },
    { label: 'vs UTG+1',        key: 'vs_RFI_UTG+1',     type: 'vs-rfi',  bucket: 'Facing RFI: EP/MP',  matchup: 'HJ vs UTG+1' },
    { label: 'vs UTG+2',        key: 'vs_RFI_UTG+2',     type: 'vs-rfi',  bucket: 'Facing RFI: EP/MP',  matchup: 'HJ vs UTG+2' },
    { label: 'vs LJ',           key: 'vs_RFI_LJ',        type: 'vs-rfi',  bucket: 'Facing RFI: EP/MP',  matchup: 'HJ vs LJ' },
    { label: 'vs CO 3bet',      key: 'vs_3bet_CO',       type: 'vs-3bet', bucket: 'HJ/CO RFI vs 3bet',  matchup: 'HJ vs CO 3bet' },
    { label: 'vs BTN 3bet',     key: 'vs_3bet_BTN',      type: 'vs-3bet', bucket: 'HJ/CO RFI vs 3bet',  matchup: 'HJ vs BTN 3bet' },
    { label: 'vs SB 3bet',      key: 'vs_3bet_SB',       type: 'vs-3bet', bucket: 'HJ/CO RFI vs 3bet',  matchup: 'HJ vs SB 3bet' },
    { label: 'vs BB 3bet',      key: 'vs_3bet_BB',       type: 'vs-3bet', bucket: 'HJ/CO RFI vs 3bet',  matchup: 'HJ vs BB 3bet' },
  ],
  'CO': [
    { label: 'RFI',             key: 'RFI',              type: 'rfi',     bucket: 'RFI',                heroDataLabel: 'Cutoff' },
    { label: 'vs UTG/UTG+1',    key: 'vs_RFI_UTG_UTG+1', type: 'vs-rfi',  bucket: 'Facing RFI: CO',     matchup: 'CO vs UTG/UTG+1' },
    { label: 'vs UTG+2',        key: 'vs_RFI_UTG+2',     type: 'vs-rfi',  bucket: 'Facing RFI: CO',     matchup: 'CO vs UTG+2' },
    { label: 'vs LJ',           key: 'vs_RFI_LJ',        type: 'vs-rfi',  bucket: 'Facing RFI: CO',     matchup: 'CO vs LJ' },
    { label: 'vs HJ',           key: 'vs_RFI_HJ',        type: 'vs-rfi',  bucket: 'Facing RFI: CO',     matchup: 'CO vs HJ' },
    { label: 'vs BTN/SB 3bet',  key: 'vs_3bet_BTN_SB',   type: 'vs-3bet', bucket: 'HJ/CO RFI vs 3bet',  matchup: 'CO vs BTN/SB 3bet' },
    { label: 'vs BB 3bet',      key: 'vs_3bet_BB',       type: 'vs-3bet', bucket: 'HJ/CO RFI vs 3bet',  matchup: 'CO vs BB 3bet' },
  ],
  'BTN': [
    { label: 'RFI',             key: 'RFI',              type: 'rfi',     bucket: 'RFI',                heroDataLabel: 'Button' },
    { label: 'vs UTG',          key: 'vs_RFI_UTG',       type: 'vs-rfi',  bucket: 'Facing RFI: Button', matchup: 'BTN vs UTG' },
    { label: 'vs UTG+1',        key: 'vs_RFI_UTG+1',     type: 'vs-rfi',  bucket: 'Facing RFI: Button', matchup: 'BTN vs UTG+1' },
    { label: 'vs UTG+2',        key: 'vs_RFI_UTG+2',     type: 'vs-rfi',  bucket: 'Facing RFI: Button', matchup: 'BTN vs UTG+2' },
    { label: 'vs LJ',           key: 'vs_RFI_LJ',        type: 'vs-rfi',  bucket: 'Facing RFI: Button', matchup: 'BTN vs LJ' },
    { label: 'vs HJ',           key: 'vs_RFI_HJ',        type: 'vs-rfi',  bucket: 'Facing RFI: Button', matchup: 'BTN vs HJ' },
    { label: 'vs CO',           key: 'vs_RFI_CO',        type: 'vs-rfi',  bucket: 'Facing RFI: Button', matchup: 'BTN vs CO' },
    { label: 'vs SB/BB 3bet',   key: 'vs_3bet_SB_BB',    type: 'vs-3bet', bucket: 'BTN/SB RFI vs 3bet', matchup: 'BTN vs SB/BB 3bet' },
  ],
  'SB': [
    { label: 'RFI',                key: 'RFI',              type: 'rfi',     bucket: 'RFI',                    heroDataLabel: 'Small Blind' },
    { label: 'vs UTG/UTG+1',       key: 'vs_RFI_UTG_UTG+1', type: 'vs-rfi',  bucket: 'Facing RFI: Small Blind',matchup: 'SB vs UTG/UTG+1' },
    { label: 'vs UTG+2',           key: 'vs_RFI_UTG+2',     type: 'vs-rfi',  bucket: 'Facing RFI: Small Blind',matchup: 'SB vs UTG+2' },
    { label: 'vs LJ',              key: 'vs_RFI_LJ',        type: 'vs-rfi',  bucket: 'Facing RFI: Small Blind',matchup: 'SB vs LJ' },
    { label: 'vs HJ',              key: 'vs_RFI_HJ',        type: 'vs-rfi',  bucket: 'Facing RFI: Small Blind',matchup: 'SB vs HJ' },
    { label: 'vs CO',              key: 'vs_RFI_CO',        type: 'vs-rfi',  bucket: 'Facing RFI: Small Blind',matchup: 'SB vs CO' },
    { label: 'vs BTN',             key: 'vs_RFI_BTN',       type: 'vs-rfi',  bucket: 'Facing RFI: Small Blind',matchup: 'SB vs BTN' },
    { label: 'vs BB 3bet',         key: 'vs_3bet_BB',       type: 'vs-3bet', bucket: 'BTN/SB RFI vs 3bet',     matchup: 'SB RFI vs BB 3bet' },
    { label: 'Limp vs BB Raise',   key: 'limp_vs_BB_raise', type: 'limp',    bucket: 'BTN/SB RFI vs 3bet',     matchup: 'SB Limp vs BB Raise' },
  ],
  'BB': [
    { label: 'vs UTG/UTG+1',    key: 'vs_RFI_UTG_UTG+1', type: 'vs-rfi',  bucket: 'Facing RFI: Big Blind', matchup: 'BB vs UTG/UTG+1' },
    { label: 'vs UTG+2',        key: 'vs_RFI_UTG+2',     type: 'vs-rfi',  bucket: 'Facing RFI: Big Blind', matchup: 'BB vs UTG+2' },
    { label: 'vs LJ',           key: 'vs_RFI_LJ',        type: 'vs-rfi',  bucket: 'Facing RFI: Big Blind', matchup: 'BB vs LJ' },
    { label: 'vs HJ',           key: 'vs_RFI_HJ',        type: 'vs-rfi',  bucket: 'Facing RFI: Big Blind', matchup: 'BB vs HJ' },
    { label: 'vs CO',           key: 'vs_RFI_CO',        type: 'vs-rfi',  bucket: 'Facing RFI: Big Blind', matchup: 'BB vs CO' },
    { label: 'vs BTN',          key: 'vs_RFI_BTN',       type: 'vs-rfi',  bucket: 'Facing RFI: Big Blind', matchup: 'BB vs BTN' },
    { label: 'vs SB',           key: 'vs_RFI_SB',        type: 'vs-rfi',  bucket: 'Facing RFI: Big Blind', matchup: 'BB vs SB' },
  ],
};

var HERO_SEATS = Object.keys(HERO_CHARTS);

function findScenario(hero, key) {
  var list = HERO_CHARTS[hero] || [];
  for (var i = 0; i < list.length; i++) if (list[i].key === key) return list[i];
  return list[0] || null;
}

function heroSeatToAppPositions(hero) {
  if (hero === 'UTG')   return ['UTG'];
  if (hero === 'UTG+1') return ['UTG+1'];
  if (hero === 'UTG+2') return ['MP', 'EP'];
  if (hero === 'LJ')    return ['LJ'];
  if (hero === 'HJ')    return ['HJ'];
  if (hero === 'CO')    return ['CO'];
  if (hero === 'BTN')   return ['BTN'];
  if (hero === 'SB')    return ['SB'];
  if (hero === 'BB')    return ['BB'];
  return [];
}

var RANGE_STATE_KEY = 'range.filters';

function loadRangeState() {
  return getJSON(RANGE_STATE_KEY, {}) || {};
}

function saveRangeState(state) {
  setJSON(RANGE_STATE_KEY, state);
}

var GRID_R = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];

function rangeBuildKey(ri, ci) {
  var r1 = GRID_R[Math.min(ri, ci)];
  var r2 = GRID_R[Math.max(ri, ci)];
  if (ri === ci) return r1 + r1;
  return r1 + r2 + (ri < ci ? 's' : 'o');
}

function chartToColorMap(chart) {
  var map = {};
  if (!chart || !chart.length) return map;
  for (var i = 0; i < chart.length; i++) map[chart[i].hand] = chart[i].color;
  return map;
}

function lookupChartFor(data, hero, key) {
  if (!data) return null;
  var entry = findScenario(hero, key);
  if (!entry) return null;
  if (entry.bucket === 'RFI') {
    return (data.RFI && data.RFI[entry.heroDataLabel]) || null;
  }
  var bucket = data[entry.bucket];
  if (!bucket) return null;
  return bucket[entry.matchup] || null;
}

function filterHandsForScenario(hands, hero, key) {
  var entry = findScenario(hero, key);
  if (!entry) return [];
  var allowedSeats = heroSeatToAppPositions(hero);
  if (!allowedSeats.length) return [];
  var out = [];
  for (var i = 0; i < hands.length; i++) {
    var h = hands[i];
    if (allowedSeats.indexOf(h.position) === -1) continue;
    var act = classifyPreflopAction(h);
    if (!act) continue;
    if (entry.type === 'rfi') {
      if (act !== 'rfi' && act !== 'limp-open' && act !== 'folded-pre') continue;
      if (act === 'folded-pre' && heroHadPriorActionPre(h)) continue;
    } else if (entry.type === 'vs-rfi') {
      if (act !== 'vs-rfi-call' && act !== 'vs-rfi-3bet' && act !== 'folded-pre' && act !== 'squeeze') continue;
      if (act === 'folded-pre' && !heroFacedRaisePre(h)) continue;
    } else if (entry.type === 'vs-3bet') {
      if (act !== 'rfi-vs-3bet-fold' && act !== 'rfi-vs-3bet-call' && act !== 'rfi-vs-3bet-4bet') continue;
    } else if (entry.type === 'limp') {
      if (act !== 'limp-open' && act !== 'vs-rfi-call' && act !== 'vs-rfi-3bet' && act !== 'folded-pre') continue;
    }
    out.push(h);
  }
  return out;
}

function heroHadPriorActionPre(h) {
  if (!h || !h.actions) return false;
  var acts = parseActions(h.actions).filter(function(a) { return a.street === 'Preflop'; });
  for (var i = 0; i < acts.length; i++) {
    var a = acts[i];
    if (a.type === 'sb' || a.type === 'bb') continue;
    if (a.isMe) return false;
    if (a.type === 'raise' || a.type === 'bet' || a.type === 'call') return true;
  }
  return false;
}

function heroFacedRaisePre(h) {
  if (!h || !h.actions) return false;
  var acts = parseActions(h.actions).filter(function(a) { return a.street === 'Preflop'; });
  for (var i = 0; i < acts.length; i++) {
    var a = acts[i];
    // Skip blind posts (hero's bb post in particular) — they aren't "acting".
    if (a.type === 'sb' || a.type === 'bb') continue;
    if (a.isMe) return false;
    if (a.type === 'raise' || a.type === 'bet') return true;
  }
  return false;
}

function tallyByCombo(filtered, scenarioType) {
  var played = {}, folded = {}, dealt = {}, won = {}, pnl = {};
  for (var i = 0; i < filtered.length; i++) {
    var h = filtered[i];
    var k = parseHoleKey(h.hole);
    if (!k) continue;
    dealt[k] = (dealt[k] || 0) + 1;
    var bucket = heroActionBucket(h, scenarioType);
    if (bucket === 'raise' || bucket === 'call') {
      played[k] = (played[k] || 0) + 1;
      if (h.outcome && h.outcome.result === 'won') won[k] = (won[k] || 0) + 1;
    } else {
      folded[k] = (folded[k] || 0) + 1;
    }
    if (h.outcome && typeof isCashHand === 'function' && isCashHand(h)) {
      var inv = getInvested(h);
      var p = h.outcome.result === 'won' ? (h.outcome.amount || 0) - inv : -inv;
      pnl[k] = (pnl[k] || 0) + p;
    }
  }
  return { played: played, folded: folded, dealt: dealt, won: won, pnl: pnl };
}

// Lines are joined with \n; the .rc[data-tip]:hover::after CSS rule uses
// white-space: pre-line to render them stacked.
function tipForCombo(key, tallies) {
  var dealt  = (tallies.dealt  && tallies.dealt[key])  || 0;
  var played = (tallies.played && tallies.played[key]) || 0;
  var won    = (tallies.won    && tallies.won[key])    || 0;
  var pnl    = tallies.pnl ? tallies.pnl[key] : undefined;
  if (dealt === 0) return key + '\nNot dealt';
  var lines = [key];
  if (typeof pnl === 'number') lines.push('P/L: ' + fmtPnl(pnl));
  var vpipPct = Math.round((played / dealt) * 100);
  lines.push('Played: ' + played + '/' + dealt + ' (' + vpipPct + '%)');
  if (played > 0) {
    var wrPct = Math.round((won / played) * 100);
    lines.push('Won: ' + won + '/' + played + ' (' + wrPct + '%)');
  }
  return lines.join('\n');
}

// Maps a GTO chart colour to the action it recommends. Anything not in the
// raise/call ranges (white, grey, or absent) is a fold.
function gtoTargetAction(color) {
  if (color === 'red' || color === 'blue') return 'raise';
  if (color === 'green') return 'call';
  return 'fold';
}

function spotHeroAction(rec) {
  if (rec.raise.n >= rec.call.n && rec.raise.n >= rec.fold.n && rec.raise.n) return 'raise';
  if (rec.call.n >= rec.fold.n && rec.call.n) return 'call';
  return 'fold';
}

function fmtComboList(arr) {
  return arr.slice().sort(function(a, b) {
    return b.n - a.n || Math.abs(b.pnl) - Math.abs(a.pnl);
  }).slice(0, 8).map(function(x) { return x.key; }).join(', ');
}

// Buckets each dealt combo for the current spot into on-target vs a specific
// kind of deviation, judged against the GTO chart colour. Mirrors the right
// grid's on/off-target call so the cards and the grid never disagree.
function classifySpotDeviations(byKey, colors, hasChart) {
  var r = { onTarget: [], overplay: [], underplay: [], callNotRaise: [], raiseNotCall: [],
            graded: 0, dealt: 0, pnl: 0, pnlKnown: false };
  for (var key in byKey) {
    var rec = byKey[key];
    if (!rec || !rec.dealt) continue;
    r.dealt++;
    if (rec.pnlKnown) { r.pnl += rec.pnl; r.pnlKnown = true; }
    if (!hasChart) continue;
    var target = gtoTargetAction(colors[key]);
    var onCount = rec[target].n;
    r.graded++;
    var item = { key: key, n: rec.dealt, pnl: rec.pnl };
    if (onCount >= rec.dealt - onCount) { r.onTarget.push(item); continue; }
    var hero = spotHeroAction(rec);
    if (target === 'fold') r.overplay.push(item);
    else if (hero === 'fold') r.underplay.push(item);
    else if (target === 'raise' && hero === 'call') r.callNotRaise.push(item);
    else if (target === 'call' && hero === 'raise') r.raiseNotCall.push(item);
    else r.overplay.push(item);
  }
  return r;
}

// Always returns at least one finding so the spot view never looks empty: a
// green "playing it well" card when on target, deviation cards when not, and a
// neutral note when there's no sample or no GTO chart to grade against.
function buildSpotFindings(seatLabel, byKey, colors, hasChart, handCount, spotHands) {
  var dev = classifySpotDeviations(byKey, colors, hasChart);
  var plText = dev.pnlKnown ? ' Your P/L from this spot is ' + fmtPnl(dev.pnl) + '.' : '';

  // Replay support: turn the dealt combos behind this spot into example hands.
  function exForKeys(arr, label, note) {
    if (!arr || !arr.length || !spotHands || !spotHands.length) return null;
    var keySet = {};
    for (var i = 0; i < arr.length; i++) keySet[arr[i].key] = true;
    var hs = [];
    for (var j = spotHands.length - 1; j >= 0 && hs.length < 15; j--) {
      var h = spotHands[j];
      if (!h || !h.hole) continue;
      var k = (typeof parseHoleKey === 'function') ? parseHoleKey(h.hole) : null;
      if (k && keySet[k]) hs.push(h);
    }
    if (!hs.length) return null;
    return { id: 'range-spot-' + label.replace(/\W+/g, '-').toLowerCase(), label: label, hands: hs, coachingNote: note };
  }
  function allSpotEx() {
    if (!spotHands || !spotHands.length) return null;
    var hs = spotHands.slice(Math.max(0, spotHands.length - 15)).reverse();
    return { id: 'range-spot-all', label: 'Hands from ' + seatLabel, hands: hs,
      coachingNote: 'Recent hands you played from this spot.' };
  }

  if (handCount === 0 || dev.dealt === 0) {
    return [{
      sectionId: 'range-spot', id: 'spot-empty', severity: 'o', name: seatLabel,
      openingText: 'No hands from this spot on record yet. Play some to see how your range here compares to GTO.',
      branchTexts: [], examples: []
    }];
  }

  if (!hasChart) {
    var allEx0 = allSpotEx();
    return [{
      sectionId: 'range-spot', id: 'spot-nochart', severity: 'o', name: seatLabel,
      openingText: 'You have ' + handCount + ' hands from this spot.' + plText,
      branchTexts: ['No GTO reference chart for this spot yet, so your actions cannot be graded against a target.'],
      examples: allEx0 ? [allEx0] : []
    }];
  }

  var wrong = dev.overplay.length + dev.underplay.length + dev.callNotRaise.length + dev.raiseNotCall.length;
  var findings = [];

  if (wrong === 0) {
    var allExWell = allSpotEx();
    findings.push({
      sectionId: 'range-spot', id: 'spot-accuracy', severity: 'g', name: seatLabel,
      openingText: 'You have ' + handCount + ' hands from this spot.' + plText,
      branchTexts: ['You are playing this seat effectively, taking the GTO action on all ' + dev.graded + ' combos you have been dealt here.'],
      examples: allExWell ? [allExWell] : []
    });
  } else {
    var ratio = dev.graded ? wrong / dev.graded : 0;
    var sev = ratio > 0.4 ? 'r' : (ratio > 0.15 ? 'a' : 'g');
    var branches = [];
    if (dev.overplay.length) branches.push('Overplaying: ' + fmtComboList(dev.overplay) + '. GTO folds these from this seat.');
    if (dev.underplay.length) branches.push('Underplaying: ' + fmtComboList(dev.underplay) + '. GTO opens these and you folded.');
    if (dev.callNotRaise.length) branches.push('Calling when GTO raises: ' + fmtComboList(dev.callNotRaise) + '.');
    if (dev.raiseNotCall.length) branches.push('Raising when GTO just calls: ' + fmtComboList(dev.raiseNotCall) + '.');

    var soWhat = null;
    if (dev.overplay.length && dev.overplay.length >= dev.underplay.length) {
      soWhat = 'Tighten up from this seat. The hands GTO folds here bleed chips when you play them.';
    } else if (dev.underplay.length) {
      soWhat = 'Open these up. They are profitable opens from this seat that you are passing on.';
    }
    if (dev.callNotRaise.length) {
      soWhat = (soWhat ? soWhat + ' ' : '') + 'Raise the hands GTO raises rather than flat-calling, you are leaving value and fold equity behind.';
    }

    var devExamples = [];
    var de;
    de = exForKeys(dev.overplay, 'Overplayed hands', 'GTO folds these from this seat. Watch how they played out.'); if (de) devExamples.push(de);
    de = exForKeys(dev.callNotRaise, 'Flat-called when GTO raises', 'Hands you just called where GTO raises. See the value and fold equity left behind.'); if (de) devExamples.push(de);
    de = exForKeys(dev.raiseNotCall, 'Raised when GTO calls', 'Hands you raised where GTO prefers a call.'); if (de) devExamples.push(de);
    de = exForKeys(dev.underplay, 'Folded when GTO opens', 'Hands you folded that GTO opens from this seat.'); if (de) devExamples.push(de);
    if (!devExamples.length) { var allExDev = allSpotEx(); if (allExDev) devExamples.push(allExDev); }
    findings.push({
      sectionId: 'range-spot', id: 'spot-accuracy', severity: sev, name: seatLabel,
      openingText: 'You have ' + handCount + ' hands from this spot, taking the GTO action on ' +
        dev.onTarget.length + ' of ' + dev.graded + ' combos.' + plText,
      branchTexts: branches,
      soWhatText: soWhat,
      examples: devExamples
    });
  }

  if (dev.pnlKnown && dev.pnl > 0 && (dev.callNotRaise.length || dev.underplay.length)) {
    findings.push({
      sectionId: 'range-spot', id: 'spot-value', severity: 'g', name: 'Room for more value here',
      openingText: 'This is a profitable seat for you (' + fmtPnl(dev.pnl) + ').',
      branchTexts: [dev.callNotRaise.length
        ? 'You are flat-calling some hands GTO raises, so there is value you are not taking preflop.'
        : 'You are folding some hands GTO opens, so there is more profit available from this seat.'],
      soWhatText: 'Consider raising more of your strong hands preflop from this seat.',
      examples: []
    });
  }

  return findings;
}

function heroComboBreakdown(filtered, scenarioType) {
  var byKey = {};
  for (var i = 0; i < filtered.length; i++) {
    var h = filtered[i];
    var k = parseHoleKey(h.hole);
    if (!k) continue;
    var bucket = heroActionBucket(h, scenarioType);
    if (!byKey[k]) byKey[k] = {
      raise: { n: 0, pnl: 0 },
      call:  { n: 0, pnl: 0 },
      fold:  { n: 0, pnl: 0 },
      dealt: 0, pnl: 0, pnlKnown: false
    };
    var rec = byKey[k];
    rec[bucket].n++;
    rec.dealt++;
    if (h.outcome && typeof isCashHand === 'function' && isCashHand(h)) {
      var inv = getInvested(h);
      var p = h.outcome.result === 'won' ? (h.outcome.amount || 0) - inv : -inv;
      rec[bucket].pnl += p;
      rec.pnl += p;
      rec.pnlKnown = true;
    }
  }
  return byKey;
}

// Lines: combo, total P/L, then one line per action you took with its share,
// whether it matched GTO, and the P/L booked while taking it.
function heroTipForCombo(key, rec, target) {
  if (!rec || rec.dealt === 0) return key + '\nNot dealt';
  var lines = [key];
  if (rec.pnlKnown) lines.push('P/L: ' + fmtPnl(rec.pnl));
  var order = ['raise', 'call', 'fold'];
  for (var i = 0; i < order.length; i++) {
    var b = order[i];
    var n = rec[b].n;
    if (!n) continue;
    var share = Math.round((n / rec.dealt) * 100);
    var line = share + '% ' + b;
    if (target) line += b === target ? ' (on target)' : ' (off target)';
    if (rec.pnlKnown) line += '  ' + fmtPnl(rec[b].pnl);
    lines.push(line);
  }
  return lines.join('\n');
}

function heroActionBucket(h, scenarioType) {
  var act = classifyPreflopAction(h);
  if (scenarioType === 'rfi') {
    if (act === 'rfi') return 'raise';
    if (act === 'limp-open') return 'call';
    return 'fold';
  }
  if (scenarioType === 'vs-rfi') {
    if (act === 'vs-rfi-3bet' || act === 'squeeze') return 'raise';
    if (act === 'vs-rfi-call') return 'call';
    return 'fold';
  }
  if (scenarioType === 'vs-3bet') {
    if (act === 'rfi-vs-3bet-4bet') return 'raise';
    if (act === 'rfi-vs-3bet-call') return 'call';
    return 'fold';
  }
  if (scenarioType === 'limp') {
    if (act === 'vs-rfi-3bet') return 'raise';
    if (act === 'limp-open' || act === 'vs-rfi-call') return 'call';
    return 'fold';
  }
  if (act === 'rfi' || act === 'vs-rfi-3bet' || act === 'squeeze' || act === 'rfi-vs-3bet-4bet') return 'raise';
  if (act === 'limp-open' || act === 'limp-behind' || act === 'vs-rfi-call' || act === 'rfi-vs-3bet-call') return 'call';
  return 'fold';
}
