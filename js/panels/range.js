// ── RANGE PANEL ───────────────────────────────────────────────────────────────
// Four sub-tabs (Overall, RFI, Facing RFI, RFI vs 3bet) map directly onto the
// GTO chart set in js/data/ranges.json. Each sub-tab fetches the chart for the
// active spot, renders a 13x13 grid where every cell shows the GTO color in
// the background and the user's actual play as a border (played) or fade
// (folded). State (sub-tab + selectors) is persisted in localStorage.

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

// Per-hero scenario lists. Each entry carries:
//   label   - dropdown text
//   key     - stable identifier (persists in localStorage)
//   type    - 'rfi' | 'vs-rfi' | 'vs-3bet' | 'limp'  (drives hand filter + tally)
//   bucket  - top-level key in ranges.json
//   matchup - the chart key inside that bucket (omitted for RFI where bucket==='RFI'
//             and we index by hero data label instead)
//   heroDataLabel - data-side label for the hero seat (used for RFI lookup)
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

// Look up an entry from HERO_CHARTS by (hero, key). Falls back to the first
// entry for the hero when key is missing or stale.
function findScenario(hero, key) {
  var list = HERO_CHARTS[hero] || [];
  for (var i = 0; i < list.length; i++) if (list[i].key === key) return list[i];
  return list[0] || null;
}

// Map a hero-seat selector value (UTG, UTG+1, …, BB) to the app's hand-history
// position string(s) so we can filter hero's played hands by seat.
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

// State key in localStorage.
var RANGE_STATE_KEY = 'range.filters';

function loadRangeState() {
  try {
    var raw = localStorage.getItem(RANGE_STATE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) || {};
  } catch (e) { return {}; }
}

function saveRangeState(state) {
  try { localStorage.setItem(RANGE_STATE_KEY, JSON.stringify(state)); } catch (e) {}
}

var GRID_R = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];

function rangeBuildKey(ri, ci) {
  var r1 = GRID_R[Math.min(ri, ci)];
  var r2 = GRID_R[Math.max(ri, ci)];
  if (ri === ci) return r1 + r1;
  return r1 + r2 + (ri < ci ? 's' : 'o');
}

// Convert a chart array of {hand, color} to a key-to-color map.
function chartToColorMap(chart) {
  var map = {};
  if (!chart || !chart.length) return map;
  for (var i = 0; i < chart.length; i++) map[chart[i].hand] = chart[i].color;
  return map;
}

// Look up the chart array for a (hero, scenario-key) pair. Returns null when
// the spot has no reference data.
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

// Filter hands matching (hero seat, scenario). Returns hands where hero was at
// the chosen seat and whose preflop action fits the scenario type.
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
      // First-to-act spot: opens, limps-open, or fold first-in.
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

// True when at least one opponent raised, bet, or called before hero's first
// voluntary action. Used to tell "first-in fold" apart from "fold facing action".
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

// Per-combo tally for the filtered hand set. `scenarioType` shapes what
// "played" means: rfi → hero opened, vs-rfi → hero continued, vs-3bet → hero
// continued vs the 3-bet, limp → hero limped. 'overall' is any voluntary action.
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

// Pristine GTO chart grid — colour only, no overlay for the user's actions.
function buildGtoGridHtml(chart) {
  var colors = chartToColorMap(chart);
  var html = '<div class="range-grid-sm">';
  for (var r = 0; r < 13; r++) {
    for (var c = 0; c < 13; c++) {
      var key = rangeBuildKey(r, c);
      var gto = colors[key] || 'none';
      html += '<div class="rc" data-gto="' + gto + '" data-key="' + key + '" data-tip="' + key + '"><span>' + key + '</span></div>';
    }
  }
  html += '</div>';
  return html;
}

// Overall sub-tab grid: frequency-shaded background driven by hero's play
// volume per combo. Bold border on combos played, faded on combos folded.
function buildOverallGridHtml(tallies) {
  var html = '<div class="range-grid-sm">';
  var maxPlayed = 0;
  for (var k in tallies.played) if (tallies.played[k] > maxPlayed) maxPlayed = tallies.played[k];
  for (var r = 0; r < 13; r++) {
    for (var c = 0; c < 13; c++) {
      var key = rangeBuildKey(r, c);
      var dealt = tallies.dealt[key] || 0;
      var played = tallies.played[key] || 0;
      var folded = tallies.folded[key] || 0;
      var won = tallies.won[key] || 0;
      var cls, tip, freqAttr = '';
      if (dealt === 0) { cls = 'rc-undealt'; tip = key + ' | not dealt'; }
      else if (played > 0) {
        cls = 'rc-played';
        var wr = Math.round((won / played) * 100) + '%';
        tip = key + ' | played ' + played + '/' + dealt + ' · win ' + wr;
        if (maxPlayed > 0) {
          var ratio = played / maxPlayed;
          var step = 'low';
          if (ratio > 0.8) step = 'high';
          else if (ratio > 0.5) step = 'med-high';
          else if (ratio > 0.25) step = 'med';
          freqAttr = ' data-freq="' + step + '"';
        }
      } else {
        cls = 'rc-folded';
        tip = key + ' | folded ' + folded + '/' + dealt;
      }
      html += '<div class="rc ' + cls + '" data-gto="none" data-key="' + key + '"' + freqAttr + ' data-tip="' + tip + '"><span>' + key + '</span></div>';
    }
  }
  html += '</div>';
  return html;
}

// "Your range" grid showing hero's actual choice for the active scenario:
//   red   = raised (open / 3-bet / 4-bet, depending on scenario)
//   green = called
//   white = folded after seeing the combo
//   none  = never dealt
function buildHeroGridHtml(filtered, scenarioType) {
  var byKey = {};
  for (var i = 0; i < filtered.length; i++) {
    var h = filtered[i];
    var k = parseHoleKey(h.hole);
    if (!k) continue;
    var bucket = heroActionBucket(h, scenarioType);
    if (!byKey[k]) byKey[k] = { raise: 0, call: 0, fold: 0, dealt: 0 };
    byKey[k][bucket]++;
    byKey[k].dealt++;
  }
  var html = '<div class="range-grid-sm">';
  for (var r = 0; r < 13; r++) {
    for (var c = 0; c < 13; c++) {
      var key = rangeBuildKey(r, c);
      var t = byKey[key];
      var color = 'none', tip = key + ' | not dealt';
      if (t && t.dealt > 0) {
        // Dominant action wins the cell color.
        var best = 'fold', bestN = t.fold;
        if (t.raise > bestN) { best = 'raise'; bestN = t.raise; }
        if (t.call > bestN) { best = 'call'; bestN = t.call; }
        color = best === 'raise' ? 'red' : best === 'call' ? 'green' : 'white';
        var parts = [];
        if (t.raise) parts.push(t.raise + ' raised');
        if (t.call)  parts.push(t.call + ' called');
        if (t.fold)  parts.push(t.fold + ' folded');
        tip = key + ' | ' + parts.join(', ');
      }
      html += '<div class="rc rc-hero" data-hero="' + color + '" data-key="' + key + '" data-tip="' + tip + '"><span>' + key + '</span></div>';
    }
  }
  html += '</div>';
  return html;
}

// Hero's single dominant action for a hand under the active scenario. Returns
// 'raise', 'call', or 'fold'.
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
  // overall (fallback): collapse to raise/call/fold based on hero's first
  // voluntary action.
  if (act === 'rfi' || act === 'vs-rfi-3bet' || act === 'squeeze' || act === 'rfi-vs-3bet-4bet') return 'raise';
  if (act === 'limp-open' || act === 'limp-behind' || act === 'vs-rfi-call' || act === 'rfi-vs-3bet-call') return 'call';
  return 'fold';
}

// Wrap two grids (GTO + your range) in a side-by-side layout with titles.
function twoGridHtml(chart, filtered, scenarioType) {
  return '<div class="range-compare">' +
    '<div class="range-compare-col">' +
      '<div class="sec-subtitle mt-0">GTO chart</div>' +
      buildGtoGridHtml(chart) +
    '</div>' +
    '<div class="range-compare-col">' +
      '<div class="sec-subtitle mt-0">Your range</div>' +
      buildHeroGridHtml(filtered, scenarioType) +
    '</div>' +
  '</div>';
}

function gtoLegendHtml() {
  return '<div class="range-legend">' +
    '<div class="leg"><div class="leg-sw leg-sw-gto-red"></div>Raise for value</div>' +
    '<div class="leg"><div class="leg-sw leg-sw-gto-blue"></div>Raise for bluff</div>' +
    '<div class="leg"><div class="leg-sw leg-sw-gto-green"></div>Call</div>' +
    '<div class="leg"><div class="leg-sw leg-sw-gto-grey"></div>Fold (you were in this hand)</div>' +
    '<div class="leg"><div class="leg-sw leg-sw-gto-white"></div>Fold</div>' +
    '</div>';
}

function heroLegendHtml() {
  return '<div class="range-legend">' +
    '<div class="leg"><div class="leg-sw leg-sw-gto-red"></div>You raised</div>' +
    '<div class="leg"><div class="leg-sw leg-sw-gto-green"></div>You called</div>' +
    '<div class="leg"><div class="leg-sw leg-sw-gto-white"></div>You folded</div>' +
    '<div class="leg"><div class="rc-unseen leg-sw"></div>Not dealt</div>' +
    '</div>';
}

function frequencyLegendHtml() {
  return '<div class="range-legend">' +
    '<div class="leg"><div class="leg-sw leg-sw-low"></div>Rarely</div>' +
    '<div class="leg"><div class="leg-sw leg-sw-med"></div>Sometimes</div>' +
    '<div class="leg"><div class="leg-sw leg-sw-high"></div>Most played</div>' +
    '<div class="leg"><div class="leg-sw rc-unseen"></div>Not dealt</div>' +
    '</div>';
}

function renderRange(container, d, hands) {
  var stored = loadRangeState();
  var state = {
    subTab:   stored.subTab   || 'overall',
    hero:     HERO_SEATS.indexOf(stored.hero) !== -1 ? stored.hero : 'BTN',
    scenario: stored.scenario || 'RFI',
  };
  if (state.subTab !== 'overall' && state.subTab !== 'spot') state.subTab = 'overall';

  function persist() { saveRangeState(state); }

  container.innerHTML =
    '<div class="panel-title">Range</div>' +
    '<div class="panel-desc">GTO chart on the left, what you actually did on the right.</div>' +
    '<div class="range-subtabs" id="range-subtabs">' +
      subTabBtn('overall', 'Overall', state) +
      subTabBtn('spot', 'By Spot', state) +
    '</div>' +
    '<div id="range-subtab-body" class="p-row"></div>';

  var subtabs = document.getElementById('range-subtabs');
  subtabs.addEventListener('click', function(e) {
    var btn = e.target.closest('.range-subtab');
    if (!btn) return;
    var t = btn.getAttribute('data-subtab');
    if (!t || t === state.subTab) return;
    state.subTab = t;
    persist();
    refreshSubTabButtons();
    renderBody();
  });

  function refreshSubTabButtons() {
    subtabs.querySelectorAll('.range-subtab').forEach(function(b) {
      b.classList.toggle('active', b.getAttribute('data-subtab') === state.subTab);
    });
  }

  function renderBody() {
    var body = document.getElementById('range-subtab-body');
    if (!body) return;
    if (state.subTab === 'overall') {
      renderOverall(body);
      return;
    }
    body.innerHTML = '<div class="range-loading">Loading GTO chart …</div>';
    getRangeData().then(function(data) {
      renderSpot(body, data);
    }).catch(function() {
      body.innerHTML = '<div class="range-error">Failed to load GTO chart data. Reload the page to try again.</div>';
    });
  }

  function renderOverall(body) {
    var tallies = tallyByCombo(hands, 'overall');
    body.innerHTML =
      '<div id="range-stories" class="mb-16"></div>' +
      '<div class="sec-subtitle mt-0">Your Overall Range</div>' +
      '<div class="meta-text mb-12">Every combo you have been dealt. Bold border means you played it; faded means you folded.</div>' +
      frequencyLegendHtml() +
      buildOverallGridHtml(tallies);
    bindCellClicks(body, hands);
    renderRangeStories();
  }

  function renderSpot(body, data) {
    if (HERO_SEATS.indexOf(state.hero) === -1) state.hero = 'BTN';
    var scenarios = HERO_CHARTS[state.hero] || [];
    var keys = scenarios.map(function(s) { return s.key; });
    if (keys.indexOf(state.scenario) === -1) {
      state.scenario = keys[0] || '';
      persist();
    }
    var entry = findScenario(state.hero, state.scenario);
    var chart = lookupChartFor(data, state.hero, state.scenario);
    var filtered = filterHandsForScenario(hands, state.hero, state.scenario);
    var heroSelectorHtml = positionSelector('range-hero', HERO_SEATS, state.hero);
    var scenarioOptions = scenarios.map(function(s) {
      var sel = s.key === state.scenario ? ' selected' : '';
      return '<option value="' + s.key + '"' + sel + '>' + s.label + '</option>';
    }).join('');
    var scenarioSelectorHtml = '<select id="range-scenario" class="table-filter">' + scenarioOptions + '</select>';
    var label = entry ? entry.label : '';
    var headerStats = renderHeaderStats(filtered, state.hero + ' · ' + label);
    var note = chart ? '' : '<div class="range-empty">No GTO reference for ' + state.hero + ' ' + label + '.</div>';
    body.innerHTML =
      '<div class="range-controls">' +
      '<label class="range-control-label">Position</label>' + heroSelectorHtml +
      '<label class="range-control-label">Scenario</label>' + scenarioSelectorHtml +
      '</div>' +
      headerStats +
      note +
      '<div class="range-legends"><div class="range-legend-col">' + gtoLegendHtml() + '</div><div class="range-legend-col">' + heroLegendHtml() + '</div></div>' +
      twoGridHtml(chart, filtered, entry ? entry.type : 'overall');
    bindSelector(body, 'range-hero', function(v) {
      state.hero = v;
      state.scenario = (HERO_CHARTS[v] && HERO_CHARTS[v][0] && HERO_CHARTS[v][0].key) || '';
      persist();
      renderSpot(body, data);
    });
    bindSelector(body, 'range-scenario', function(v) {
      state.scenario = v;
      persist();
      renderSpot(body, data);
    });
    bindCellClicks(body, filtered);
  }

  function renderHeaderStats(filtered, label) {
    if (!filtered.length) {
      return '<div class="range-stats range-stats-empty">No ' + label + ' hands on record yet.</div>';
    }
    return '<div class="range-stats">' + filtered.length + ' ' + label + ' hand' + (filtered.length === 1 ? '' : 's') + ' on record.</div>';
  }

  function renderRangeStories() {
    var el = document.getElementById('range-stories');
    if (!el) return;
    if (typeof Sections === 'undefined' || typeof Sections.evaluateSections !== 'function') {
      el.innerHTML = '';
      return;
    }
    var findings = Sections.evaluateSections(d, {}, hands);
    var rangeFindings = Sections.findingsForPanel(findings, 'Range');
    el.innerHTML = Sections.renderVerdict(rangeFindings, 'Range data is still building.') + Sections.renderFindings(rangeFindings);
  }

  function bindCellClicks(scope, scopedHands) {
    if (scope._cellHandlerBound) return;
    scope._cellHandlerBound = true;
    scope.addEventListener('click', function(e) {
      var cell = e.target.closest('.rc[data-key]');
      if (!cell) return;
      var key = cell.getAttribute('data-key');
      if (!key) return;
      // Re-derive scoped hands from the active state at click time so the
      // modal always reflects whichever sub-tab/selection the user is viewing.
      var active;
      if (state.subTab === 'overall') active = hands;
      else active = filterHandsForScenario(hands, state.hero, state.scenario);
      var matched = active.filter(function(h) { return parseHoleKey(h.hole) === key; });
      if (!matched.length) return;
      openHandModal(key, matched);
    });
  }

  refreshSubTabButtons();
  renderBody();
}

function subTabBtn(id, label, state) {
  var active = state.subTab === id ? ' active' : '';
  return '<button class="range-subtab' + active + '" data-subtab="' + id + '">' + label + '</button>';
}

function positionSelector(id, options, current) {
  if (current && options.indexOf(current) === -1) options = [current].concat(options);
  var opts = options.map(function(p) {
    var sel = p === current ? ' selected' : '';
    return '<option value="' + p + '"' + sel + '>' + p + '</option>';
  }).join('');
  return '<select id="' + id + '" class="table-filter">' + opts + '</select>';
}

function bindSelector(scope, id, cb) {
  var el = scope.querySelector('#' + id);
  if (!el) return;
  el.onchange = function() { cb(el.value); };
}

function openHandModal(key, matched) {
  var existing = document.getElementById('example-hand-modal');
  if (existing) existing.remove();
  var overlay = document.createElement('div');
  overlay.id = 'example-hand-modal';
  overlay.className = 'modal-overlay';
  overlay.onclick = function(ev) { if (ev.target === overlay) closeModal(); };
  var box = document.createElement('div');
  box.className = 'modal-box';
  box.style.position = 'relative';
  box.style.maxHeight = '80vh';
  box.style.overflowY = 'auto';
  var summary = '<div class="modal-title">' + key + '</div>' +
    '<div class="mb-16">' + matched.length + ' hands</div>';
  var rows = matched.map(function(h, idx) {
    var myActs = getActsSummary(h);
    var res = renderResult(h, 'span', 'saved-res');
    return '<div class="range-hand-row" data-ridx="' + idx + '">' +
      '<div class="range-hand-row-top">' +
      '<div class="range-hand-row-side">' +
      '<span class="range-hand-row-pos">' + (h.position || '?') + '</span>' +
      '<span class="range-hand-row-hole">' + (h.hole ? h.hole.join(' ') : '??') + '</span>' +
      '<span class="range-hand-row-board">' + (h.board && h.board.length ? h.board.join(' ') : '-') + '</span>' +
      '</div>' +
      '<div class="range-hand-row-side">' +
      '<span class="range-hand-row-actions">' + myActs + '</span>' +
      res + '</div></div></div>';
  }).join('');
  box.innerHTML = '<button class="modal-close" id="modal-close-btn">&times;</button>' +
    summary + '<div class="mt-12">' + rows + '</div>';
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  requestAnimationFrame(function() { overlay.classList.add(CSS.SHOW); });
  document.getElementById('modal-close-btn').onclick = closeModal;
  box.querySelectorAll('.range-hand-row').forEach(function(row) {
    row.onclick = function() {
      var idx = parseInt(row.getAttribute('data-ridx'));
      if (!isNaN(idx) && matched[idx]) showExampleHandModal(matched[idx]);
    };
  });
}
