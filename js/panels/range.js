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

// App position string -> ranges.json position key for the RFI chart set.
var POS_TO_RANGE_KEY = {
  'UTG':   'UTG',
  'UTG+1': 'UTG+1',
  'MP':    'UTG+2',
  'EP':    'UTG+2',
  'LJ':    'Lojack',
  'HJ':    'Hijack',
  'CO':    'Cutoff',
  'BTN':   'Button',
  'SB':    'Small Blind',
};

// Hero seat selector (Facing RFI) -> "Facing RFI: X" data key.
var FACING_HERO_TO_BUCKET = {
  'BB':    'Big Blind',
  'SB':    'Small Blind',
  'BTN':   'Button',
  'CO':    'CO',
  'EP-MP': 'EP/MP',
};

// Opener bucket selector (RFI vs 3bet) -> "X RFI vs 3bet" data key.
var VS3_OPENER_TO_BUCKET = {
  'UTG':    'UTG RFI vs 3bet',
  'UTG+1':  'UTG+1 RFI vs 3bet',
  'UTG+2':  'UTG+2 RFI vs 3bet',
  'LJ':     'LJ RFI vs 3bet',
  'HJ/CO':  'HJ/CO RFI vs 3bet',
  'BTN/SB': 'BTN/SB RFI vs 3bet',
};

// Map a hero position (app value) to the vs-3bet opener bucket key.
function vs3OpenerForPosition(pos) {
  if (pos === 'UTG') return 'UTG';
  if (pos === 'UTG+1') return 'UTG+1';
  if (pos === 'MP' || pos === 'EP') return 'UTG+2';
  if (pos === 'LJ') return 'LJ';
  if (pos === 'HJ' || pos === 'CO') return 'HJ/CO';
  if (pos === 'BTN' || pos === 'SB') return 'BTN/SB';
  return null;
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

// Look up a chart for the active sub-tab + selectors. Returns the chart array
// (an array of {hand, color}) or null when no reference exists for the spot.
function lookupChart(data, subTab, selectors) {
  if (!data) return null;
  if (subTab === 'rfi') {
    var key = POS_TO_RANGE_KEY[selectors.rfiPosition];
    if (!key) return null;
    return (data.RFI && data.RFI[key]) || null;
  }
  if (subTab === 'facing-rfi') {
    var heroLabel = FACING_HERO_TO_BUCKET[selectors.facingHeroSeat];
    if (!heroLabel) return null;
    var bucket = data['Facing RFI: ' + heroLabel];
    if (!bucket) return null;
    var matchKey = facingMatchupKey(selectors.facingHeroSeat, selectors.facingOpener);
    return bucket[matchKey] || null;
  }
  if (subTab === 'rfi-vs-3bet') {
    var bucketName = VS3_OPENER_TO_BUCKET[selectors.vs3betOpener];
    if (!bucketName) return null;
    var bucket2 = data[bucketName];
    if (!bucket2) return null;
    return bucket2[selectors.vs3betMatchup] || null;
  }
  return null;
}

function facingMatchupKey(heroSeat, opener) {
  if (!heroSeat || !opener) return null;
  var hero;
  switch (heroSeat) {
    case 'BB':    hero = 'BB';    break;
    case 'SB':    hero = 'SB';    break;
    case 'BTN':   hero = 'BTN';   break;
    case 'CO':    hero = 'CO';    break;
    case 'EP-MP': hero = 'EP/MP'; break;
    default:      hero = heroSeat;
  }
  // Openers in the data use combined keys for early seats.
  var openerKey;
  switch (opener) {
    case 'UTG':
    case 'UTG+1': openerKey = 'UTG/UTG+1'; break;
    case 'MP':
    case 'EP':    openerKey = 'UTG+2';     break;
    case 'LJ':    openerKey = 'LJ';        break;
    case 'HJ':    openerKey = 'HJ';        break;
    case 'CO':    openerKey = 'CO';        break;
    case 'BTN':   openerKey = 'BTN';       break;
    case 'SB':    openerKey = 'SB';        break;
    default:      openerKey = opener;
  }
  return hero + ' vs ' + openerKey;
}

// Filter hands to those matching the active sub-tab semantics.
function filterHandsForSubTab(hands, subTab, selectors) {
  if (subTab === 'overall') return hands;
  var out = [];
  for (var i = 0; i < hands.length; i++) {
    var h = hands[i];
    var act = classifyPreflopAction(h);
    if (!act) continue;
    var pos = h.position || null;
    if (subTab === 'rfi') {
      // Include hands where hero was first-to-act at the chosen seat: opens
      // (rfi), limps (limp-open), and folds with no prior raiser/limper.
      if (act !== 'rfi' && act !== 'limp-open' && act !== 'folded-pre') continue;
      if (selectors.rfiPosition && pos !== selectors.rfiPosition) continue;
      if (act === 'folded-pre' && heroHadPriorActionPre(h)) continue;
      out.push(h);
    } else if (subTab === 'facing-rfi') {
      // All hands where hero faced an open from the selected seat. Includes
      // hands hero folded (which look like leaks against the call-side chart).
      if (act !== 'vs-rfi-call' && act !== 'vs-rfi-3bet' && act !== 'folded-pre' && act !== 'squeeze') continue;
      var seatMatch = selectors.facingHeroSeat;
      if (seatMatch === 'EP-MP') {
        if (pos !== 'EP' && pos !== 'MP') continue;
      } else if (pos !== seatMatch) continue;
      // Verify the hand actually had a raise before hero acted; folded-pre may
      // include hands hero folded with no raise (rare in BB scenarios but
      // possible in others). Skip those.
      if (act === 'folded-pre' && !heroFacedRaisePre(h)) continue;
      out.push(h);
    } else if (subTab === 'rfi-vs-3bet') {
      if (act !== 'rfi-vs-3bet-fold' && act !== 'rfi-vs-3bet-call' && act !== 'rfi-vs-3bet-4bet') continue;
      var heroBucket = vs3OpenerForPosition(pos);
      if (heroBucket !== selectors.vs3betOpener) continue;
      out.push(h);
    }
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

// Per-combo tally for the filtered hand set. `subTab` shapes what "played"
// means in this view:
//   overall      - any voluntary action (called/bet/raised at any point)
//   rfi          - hero opened (rfi) or limped-open
//   facing-rfi   - hero called/3-bet/squeezed (did not fold to the open)
//   rfi-vs-3bet  - hero called or 4-bet the 3-bet (did not fold to it)
function tallyByCombo(filtered, subTab) {
  var played = {}, folded = {}, dealt = {}, won = {}, pnl = {};
  for (var i = 0; i < filtered.length; i++) {
    var h = filtered[i];
    var k = parseHoleKey(h.hole);
    if (!k) continue;
    dealt[k] = (dealt[k] || 0) + 1;
    var didPlay;
    if (subTab === 'rfi') {
      var actR = classifyPreflopAction(h);
      didPlay = actR === 'rfi' || actR === 'limp-open';
    } else if (subTab === 'facing-rfi') {
      var actF = classifyPreflopAction(h);
      didPlay = actF === 'vs-rfi-call' || actF === 'vs-rfi-3bet' || actF === 'squeeze';
    } else if (subTab === 'rfi-vs-3bet') {
      var act3 = classifyPreflopAction(h);
      didPlay = act3 === 'rfi-vs-3bet-call' || act3 === 'rfi-vs-3bet-4bet';
    } else {
      var acts = parseActions(h.actions).filter(function(a) { return a.isMe; });
      didPlay = acts.some(function(a) { return a.type === 'call' || a.type === 'raise' || a.type === 'bet'; });
    }
    if (didPlay) {
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

// GTO chart grid. Each cell:
//   data-gto = chart color (red, green, blue, grey, white) or 'none'
//   class rc-played | rc-folded | rc-undealt
//   data-freq = freq overlay step (Overall sub-tab only)
function buildGridHtml(chart, tallies, opts) {
  var colors = chartToColorMap(chart);
  var html = '<div class="range-grid-sm">';
  var maxPlayed = 0;
  for (var k in tallies.played) if (tallies.played[k] > maxPlayed) maxPlayed = tallies.played[k];
  for (var r = 0; r < 13; r++) {
    for (var c = 0; c < 13; c++) {
      var key = rangeBuildKey(r, c);
      var gto = colors[key] || 'none';
      var dealt = tallies.dealt[key] || 0;
      var played = tallies.played[key] || 0;
      var folded = tallies.folded[key] || 0;
      var won = tallies.won[key] || 0;
      var status, cls;
      if (dealt === 0) { status = 'undealt'; cls = 'rc-undealt'; }
      else if (played > 0) { status = 'played'; cls = 'rc-played'; }
      else { status = 'folded'; cls = 'rc-folded'; }
      var tip;
      if (status === 'played') {
        var wr = played > 0 ? Math.round((won / played) * 100) + '%' : '-';
        tip = key + ' | played ' + played + '/' + dealt + ' · win ' + wr;
      } else if (status === 'folded') {
        tip = key + ' | folded ' + folded + '/' + dealt;
      } else {
        tip = key + ' | not dealt';
      }
      var freqAttr = '';
      if (opts && opts.frequencyOverlay && played > 0 && maxPlayed > 0) {
        var ratio = played / maxPlayed;
        var step = 'low';
        if (ratio > 0.8) step = 'high';
        else if (ratio > 0.5) step = 'med-high';
        else if (ratio > 0.25) step = 'med';
        freqAttr = ' data-freq="' + step + '"';
      }
      html += '<div class="rc ' + cls + '" data-gto="' + gto + '" data-key="' + key + '"' + freqAttr + ' data-tip="' + tip + '"><span>' + key + '</span></div>';
    }
  }
  html += '</div>';
  return html;
}

// "Your range" grid showing hero's actual choice on this sub-tab:
//   red  = raised (open / 3-bet / 4-bet, depending on the sub-tab semantics)
//   green = called
//   grey = folded after seeing the combo
//   none = never dealt
function buildHeroGridHtml(filtered, subTab) {
  var byKey = {};
  for (var i = 0; i < filtered.length; i++) {
    var h = filtered[i];
    var k = parseHoleKey(h.hole);
    if (!k) continue;
    var bucket = heroActionBucket(h, subTab);
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
        color = best === 'raise' ? 'red' : best === 'call' ? 'green' : 'grey';
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

// Hero's single dominant action on a hand for the active sub-tab. Returns
// 'raise', 'call', or 'fold'.
function heroActionBucket(h, subTab) {
  var act = classifyPreflopAction(h);
  if (subTab === 'rfi') {
    if (act === 'rfi') return 'raise';
    if (act === 'limp-open') return 'call';
    return 'fold';
  }
  if (subTab === 'facing-rfi') {
    if (act === 'vs-rfi-3bet' || act === 'squeeze') return 'raise';
    if (act === 'vs-rfi-call') return 'call';
    return 'fold';
  }
  if (subTab === 'rfi-vs-3bet') {
    if (act === 'rfi-vs-3bet-4bet') return 'raise';
    if (act === 'rfi-vs-3bet-call') return 'call';
    return 'fold';
  }
  // overall (and any fallback): collapse to raise/call/fold based on hero's
  // first voluntary action.
  if (act === 'rfi' || act === 'vs-rfi-3bet' || act === 'squeeze' || act === 'rfi-vs-3bet-4bet') return 'raise';
  if (act === 'limp-open' || act === 'limp-behind' || act === 'vs-rfi-call' || act === 'rfi-vs-3bet-call') return 'call';
  return 'fold';
}

// Wrap two grids (GTO + your range) in a side-by-side layout with titles.
function twoGridHtml(chart, tallies, filtered, subTab) {
  return '<div class="range-compare">' +
    '<div class="range-compare-col">' +
      '<div class="sec-subtitle mt-0">GTO chart</div>' +
      buildGridHtml(chart, tallies, {}) +
    '</div>' +
    '<div class="range-compare-col">' +
      '<div class="sec-subtitle mt-0">Your range</div>' +
      buildHeroGridHtml(filtered, subTab) +
    '</div>' +
  '</div>';
}

function gtoLegendHtml() {
  return '<div class="range-legend">' +
    '<div class="leg"><div class="leg-sw leg-sw-gto-red"></div>Raise for value</div>' +
    '<div class="leg"><div class="leg-sw leg-sw-gto-blue"></div>Raise for bluff</div>' +
    '<div class="leg"><div class="leg-sw leg-sw-gto-green"></div>Call</div>' +
    '<div class="leg"><div class="leg-sw leg-sw-gto-grey"></div>Mixed / occasional</div>' +
    '<div class="leg"><div class="leg-sw leg-sw-gto-white"></div>Fold</div>' +
    '</div>';
}

function heroLegendHtml() {
  return '<div class="range-legend">' +
    '<div class="leg"><div class="leg-sw leg-sw-gto-red"></div>You raised</div>' +
    '<div class="leg"><div class="leg-sw leg-sw-gto-green"></div>You called</div>' +
    '<div class="leg"><div class="leg-sw leg-sw-gto-grey"></div>You folded</div>' +
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
    subTab:           stored.subTab           || 'overall',
    rfiPosition:      stored.rfiPosition      || 'BTN',
    facingHeroSeat:   stored.facingHeroSeat   || 'BB',
    facingOpener:     stored.facingOpener     || 'BTN',
    vs3betOpener:     stored.vs3betOpener     || 'BTN/SB',
    vs3betMatchup:    stored.vs3betMatchup    || 'BTN vs SB/BB 3bet',
  };
  var validSubTabs = { overall: 1, rfi: 1, 'facing-rfi': 1, 'rfi-vs-3bet': 1 };
  if (!validSubTabs[state.subTab]) state.subTab = 'overall';

  function persist() { saveRangeState(state); }

  container.innerHTML =
    '<div class="panel-title">Range</div>' +
    '<div class="panel-desc">GTO chart on the left, what you actually did on the right.</div>' +
    '<div class="range-subtabs" id="range-subtabs">' +
      subTabBtn('overall', 'Overall', state) +
      subTabBtn('rfi', 'RFI', state) +
      subTabBtn('facing-rfi', 'Facing RFI', state) +
      subTabBtn('rfi-vs-3bet', 'RFI vs 3bet', state) +
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
      if (state.subTab === 'rfi') renderRfi(body, data);
      else if (state.subTab === 'facing-rfi') renderFacingRfi(body, data);
      else if (state.subTab === 'rfi-vs-3bet') renderVs3bet(body, data);
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
      buildGridHtml(null, tallies, { frequencyOverlay: true });
    bindCellClicks(body, hands);
    renderRangeStories();
  }

  function renderRfi(body, data) {
    var positions = ['UTG', 'UTG+1', 'MP', 'EP', 'LJ', 'HJ', 'CO', 'BTN', 'SB'];
    var selector = positionSelector('range-rfi-pos', positions, state.rfiPosition);
    var chart = lookupChart(data, 'rfi', state);
    var filtered = filterHandsForSubTab(hands, 'rfi', state);
    var tallies = tallyByCombo(filtered, 'rfi');
    var headerStats = renderHeaderStats(filtered, 'opens');
    var note = chart ? '' : emptyChartNote(state.rfiPosition);
    body.innerHTML =
      '<div class="range-controls">' +
      '<label class="range-control-label">Position</label>' + selector +
      '</div>' +
      headerStats +
      note +
      '<div class="range-legends"><div class="range-legend-col">' + gtoLegendHtml() + '</div><div class="range-legend-col">' + heroLegendHtml() + '</div></div>' +
      twoGridHtml(chart, tallies, filtered, 'rfi');
    bindSelector(body, 'range-rfi-pos', function(v) { state.rfiPosition = v; persist(); renderRfi(body, data); });
    bindCellClicks(body, filtered);
  }

  function renderFacingRfi(body, data) {
    var heroSeats = ['BB', 'SB', 'BTN', 'CO', 'EP-MP'];
    var openers   = ['UTG', 'UTG+1', 'MP', 'EP', 'LJ', 'HJ', 'CO', 'BTN', 'SB'];
    var validOpeners = filterValidOpeners(state.facingHeroSeat, openers);
    if (validOpeners.indexOf(state.facingOpener) === -1 && validOpeners.length) {
      state.facingOpener = validOpeners[0];
      persist();
    }
    var heroSelector = positionSelector('range-facing-hero', heroSeats, state.facingHeroSeat);
    var openerSelector = positionSelector('range-facing-opener', validOpeners, state.facingOpener);
    var chart = lookupChart(data, 'facing-rfi', state);
    var filtered = filterHandsForSubTab(hands, 'facing-rfi', state);
    var tallies = tallyByCombo(filtered, 'facing-rfi');
    var headerStats = renderHeaderStats(filtered, 'defending spots');
    var note = chart ? '<div class="meta-text mb-12">GTO target: ' + facingMatchupKey(state.facingHeroSeat, state.facingOpener) + '. Played data shows every hand you faced an open from ' + state.facingHeroSeat + ', not just from the selected opener.</div>' : '<div class="range-empty">No GTO reference for ' + state.facingHeroSeat + ' vs ' + state.facingOpener + '.</div>';
    body.innerHTML =
      '<div class="range-controls">' +
      '<label class="range-control-label">Hero seat</label>' + heroSelector +
      '<label class="range-control-label">Opener</label>' + openerSelector +
      '</div>' +
      headerStats +
      note +
      '<div class="range-legends"><div class="range-legend-col">' + gtoLegendHtml() + '</div><div class="range-legend-col">' + heroLegendHtml() + '</div></div>' +
      twoGridHtml(chart, tallies, filtered, 'facing-rfi');
    bindSelector(body, 'range-facing-hero', function(v) { state.facingHeroSeat = v; persist(); renderFacingRfi(body, data); });
    bindSelector(body, 'range-facing-opener', function(v) { state.facingOpener = v; persist(); renderFacingRfi(body, data); });
    bindCellClicks(body, filtered);
  }

  function renderVs3bet(body, data) {
    var openers = Object.keys(VS3_OPENER_TO_BUCKET);
    if (openers.indexOf(state.vs3betOpener) === -1) state.vs3betOpener = openers[0];
    var openerSelector = positionSelector('range-vs3-opener', openers, state.vs3betOpener);
    var bucketName = VS3_OPENER_TO_BUCKET[state.vs3betOpener];
    var bucket = data[bucketName] || {};
    var matchups = Object.keys(bucket);
    if (matchups.indexOf(state.vs3betMatchup) === -1) {
      state.vs3betMatchup = matchups[0] || '';
      persist();
    }
    var matchupSelector = positionSelector('range-vs3-matchup', matchups, state.vs3betMatchup);
    var chart = lookupChart(data, 'rfi-vs-3bet', state);
    var filtered = filterHandsForSubTab(hands, 'rfi-vs-3bet', state);
    var tallies = tallyByCombo(filtered, 'rfi-vs-3bet');
    var headerStats = renderHeaderStats(filtered, 'hands where you opened and got 3-bet');
    var note = chart ? '<div class="meta-text mb-12">GTO target: ' + state.vs3betMatchup + '. Played data shows every hand you opened from this seat range and faced a 3-bet, not just from the selected 3-bettor.</div>' : '<div class="range-empty">No GTO reference for ' + state.vs3betMatchup + '.</div>';
    body.innerHTML =
      '<div class="range-controls">' +
      '<label class="range-control-label">Your opener seat</label>' + openerSelector +
      '<label class="range-control-label">3-bettor</label>' + matchupSelector +
      '</div>' +
      headerStats +
      note +
      '<div class="range-legends"><div class="range-legend-col">' + gtoLegendHtml() + '</div><div class="range-legend-col">' + heroLegendHtml() + '</div></div>' +
      twoGridHtml(chart, tallies, filtered, 'rfi-vs-3bet');
    bindSelector(body, 'range-vs3-opener', function(v) { state.vs3betOpener = v; state.vs3betMatchup = ''; persist(); renderVs3bet(body, data); });
    bindSelector(body, 'range-vs3-matchup', function(v) { state.vs3betMatchup = v; persist(); renderVs3bet(body, data); });
    bindCellClicks(body, filtered);
  }

  function emptyChartNote(label) {
    return '<div class="range-empty">No GTO reference for ' + label + '.</div>';
  }

  function renderHeaderStats(filtered, label) {
    if (!filtered.length) {
      return '<div class="range-stats range-stats-empty">No ' + label + ' in this dataset yet.</div>';
    }
    return '<div class="range-stats">' + filtered.length + ' ' + label + ' on record.</div>';
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
      else active = filterHandsForSubTab(hands, state.subTab, state);
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

// Restrict opener choices for "Facing RFI" to seats acting before hero.
function filterValidOpeners(heroSeat, openers) {
  var order = ['UTG', 'UTG+1', 'MP', 'EP', 'LJ', 'HJ', 'CO', 'BTN', 'SB'];
  if (heroSeat === 'BB') return order.slice();
  if (heroSeat === 'SB') return order.filter(function(p) { return p !== 'SB'; });
  if (heroSeat === 'BTN') return ['UTG', 'UTG+1', 'MP', 'EP', 'LJ', 'HJ', 'CO'];
  if (heroSeat === 'CO')  return ['UTG', 'UTG+1', 'MP', 'EP', 'LJ', 'HJ'];
  if (heroSeat === 'EP-MP') return ['UTG', 'UTG+1'];
  return order.slice();
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
