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

function buildGtoGridHtml(chart, tallies) {
  var colors = chartToColorMap(chart);
  var html = '<div class="range-grid-sm">';
  for (var r = 0; r < 13; r++) {
    for (var c = 0; c < 13; c++) {
      var key = rangeBuildKey(r, c);
      var gto = colors[key] || 'none';
      var tip = tallies ? tipForCombo(key, tallies) : key;
      html += '<div class="rc" data-gto="' + gto + '" data-key="' + key + '" data-tip="' + tip + '"><span>' + key + '</span></div>';
    }
  }
  html += '</div>';
  return html;
}

function buildOverallGridHtml(tallies) {
  var html = '<div class="range-grid-sm">';
  var maxPlayed = 0;
  for (var k in tallies.played) if (tallies.played[k] > maxPlayed) maxPlayed = tallies.played[k];
  for (var r = 0; r < 13; r++) {
    for (var c = 0; c < 13; c++) {
      var key = rangeBuildKey(r, c);
      var dealt = tallies.dealt[key] || 0;
      var played = tallies.played[key] || 0;
      var cls, freqAttr = '';
      if (dealt === 0) cls = 'rc-undealt';
      else if (played > 0) {
        cls = 'rc-played';
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
      }
      var tip = tipForCombo(key, tallies);
      html += '<div class="rc ' + cls + '" data-gto="none" data-key="' + key + '"' + freqAttr + ' data-tip="' + tip + '"><span>' + key + '</span></div>';
    }
  }
  html += '</div>';
  return html;
}

// Maps a GTO chart colour to the action it recommends. Anything not in the
// raise/call ranges (white, grey, or absent) is a fold.
function gtoTargetAction(color) {
  if (color === 'red' || color === 'blue') return 'raise';
  if (color === 'green') return 'call';
  return 'fold';
}

// Verdict line plus the story cards, spaced off the grid above. Returns '' when
// the insight engine is unavailable so the grids still render on their own.
function storiesHtml(findings, fallback) {
  if (typeof Sections === 'undefined' || typeof Sections.renderFindings !== 'function') return '';
  return '<div class="mt-16">' +
    Sections.renderVerdict(findings, fallback) +
    Sections.renderFindings(findings) +
    '</div>';
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
function buildSpotFindings(seatLabel, byKey, colors, hasChart, handCount) {
  var dev = classifySpotDeviations(byKey, colors, hasChart);
  var plText = dev.pnlKnown ? ' Your P/L from this spot is ' + fmtPnl(dev.pnl) + '.' : '';

  if (handCount === 0 || dev.dealt === 0) {
    return [{
      sectionId: 'range-spot', id: 'spot-empty', severity: 'o', name: seatLabel,
      openingText: 'No hands from this spot on record yet. Play some to see how your range here compares to GTO.',
      branchTexts: [], examples: []
    }];
  }

  if (!hasChart) {
    return [{
      sectionId: 'range-spot', id: 'spot-nochart', severity: 'o', name: seatLabel,
      openingText: 'You have ' + handCount + ' hands from this spot.' + plText,
      branchTexts: ['No GTO reference chart for this spot yet, so your actions cannot be graded against a target.'],
      examples: []
    }];
  }

  var wrong = dev.overplay.length + dev.underplay.length + dev.callNotRaise.length + dev.raiseNotCall.length;
  var findings = [];

  if (wrong === 0) {
    findings.push({
      sectionId: 'range-spot', id: 'spot-accuracy', severity: 'g', name: seatLabel,
      openingText: 'You have ' + handCount + ' hands from this spot.' + plText,
      branchTexts: ['You are playing this seat effectively, taking the GTO action on all ' + dev.graded + ' combos you have been dealt here.'],
      examples: []
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

    findings.push({
      sectionId: 'range-spot', id: 'spot-accuracy', severity: sev, name: seatLabel,
      openingText: 'You have ' + handCount + ' hands from this spot, taking the GTO action on ' +
        dev.onTarget.length + ' of ' + dev.graded + ' combos.' + plText,
      branchTexts: branches,
      soWhatText: soWhat,
      examples: []
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

// Right grid: green = you took the GTO-recommended action most of the time,
// red = you mostly deviated. Judging needs a GTO chart for the spot; without
// one, every dealt combo is shown neutral.
function buildHeroGridHtml(byKey, colors, hasChart) {
  var html = '<div class="range-grid-sm">';
  for (var r = 0; r < 13; r++) {
    for (var c = 0; c < 13; c++) {
      var key = rangeBuildKey(r, c);
      var rec = byKey[key];
      var target = hasChart ? gtoTargetAction(colors[key]) : null;
      var state = 'none';
      if (rec && rec.dealt > 0) {
        if (!target) state = 'unjudged';
        else {
          var on = rec[target].n;
          state = on >= (rec.dealt - on) ? 'ontarget' : 'wrong';
        }
      }
      var tip = heroTipForCombo(key, rec, target);
      html += '<div class="rc rc-hero" data-hero="' + state + '" data-key="' + key + '" data-tip="' + tip + '"><span>' + key + '</span></div>';
    }
  }
  html += '</div>';
  return html;
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

function twoGridHtml(chart, filtered, scenarioType, tallies) {
  var colors = chartToColorMap(chart);
  var byKey = heroComboBreakdown(filtered, scenarioType);
  var hasChart = !!(chart && chart.length);
  return '<div class="grid-2 range-compare">' +
    '<div class="range-compare-col">' +
      '<div class="label sec-subtitle mt-0">GTO chart</div>' +
      buildGtoGridHtml(chart, tallies) +
    '</div>' +
    '<div class="range-compare-col">' +
      '<div class="label sec-subtitle mt-0">Your range</div>' +
      buildHeroGridHtml(byKey, colors, hasChart) +
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
    '<div class="leg"><div class="leg-sw leg-sw-gto-green"></div>On target</div>' +
    '<div class="leg"><div class="leg-sw leg-sw-gto-red"></div>Playing wrong</div>' +
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

  mountTemplate(container, 'range');
  setSlot(container, 'subtabs', subTabBtn('overall', 'Overall', state) + subTabBtn('spot', 'By Spot', state));

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
      body.innerHTML = '<div class="text-body range-error">Failed to load GTO chart data. Reload the page to try again.</div>';
    });
  }

  function renderOverall(body) {
    var tallies = tallyByCombo(hands, 'overall');
    body.innerHTML =
      '<div class="label sec-subtitle mt-0">Your Overall Range</div>' +
      '<div class="text-meta mb-12">Every combo you have been dealt. Bold border means you played it; faded means you folded.</div>' +
      frequencyLegendHtml() +
      buildOverallGridHtml(tallies) +
      storiesHtml(Sections.findingsForPanel(Sections.evaluateSections(d, {}, hands), 'Range'), 'Range data is still building.');
    bindCellClicks(body, hands);
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
    var scenarioType = entry ? entry.type : 'overall';
    var tallies = tallyByCombo(filtered, scenarioType);
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
      '<label class="label">Position</label>' + heroSelectorHtml +
      '<label class="label">Scenario</label>' + scenarioSelectorHtml +
      '</div>' +
      headerStats +
      note +
      '<div class="grid-2 range-legends"><div class="range-legend-col">' + gtoLegendHtml() + '</div><div class="range-legend-col">' + heroLegendHtml() + '</div></div>' +
      twoGridHtml(chart, filtered, scenarioType, tallies) +
      storiesHtml(
        buildSpotFindings(
          state.hero + ' · ' + label,
          heroComboBreakdown(filtered, scenarioType),
          chartToColorMap(chart),
          !!(chart && chart.length),
          filtered.length
        ),
        'Play more hands from this spot to grade it.'
      );
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
      return '<div class="text-meta range-stats range-stats-empty">No ' + label + ' hands on record yet.</div>';
    }
    return '<div class="text-meta range-stats">' + filtered.length + ' ' + label + ' hand' + (filtered.length === 1 ? '' : 's') + ' on record.</div>';
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
  box.className = 'card card-s1 modal-box';
  box.style.position = 'relative';
  box.style.maxHeight = '80vh';
  box.style.overflowY = 'auto';
  var summary = '<div class="modal-title">' + key + '</div>' +
    '<div class="mb-16">' + matched.length + ' hands</div>';
  var rows = matched.map(function(h, idx) {
    var myActs = getActsSummary(h);
    var res = renderResult(h, 'span', 'saved-res');
    return '<div class="range-hand-row" data-ridx="' + idx + '">' +
      '<div class="flex-between range-hand-row-top">' +
      '<div class="range-hand-row-side">' +
      '<span class="label range-hand-row-pos">' + (h.position || '?') + '</span>' +
      '<span class="range-hand-row-hole">' + (h.hole ? h.hole.join(' ') : '??') + '</span>' +
      '<span class="text-meta range-hand-row-board">' + (h.board && h.board.length ? h.board.join(' ') : '-') + '</span>' +
      '</div>' +
      '<div class="range-hand-row-side">' +
      '<span class="text-meta range-hand-row-actions">' + myActs + '</span>' +
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
