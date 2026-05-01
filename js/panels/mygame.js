// ── MY GAME PANEL ────────────────────────────────────────────────────────────

function renderMyGame(container, d, hands) {
  var playerName = State.meta.player || detectPlayerFromActions(hands) || 'Unknown';
  var exportDate = State.meta.exportedAt
    ? new Date(State.meta.exportedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';

  var html = '<div class="mygame-wrap">';

  // ── Section 1: Header + Player Type (single row) ──
  var vpipVal   = pct(d.vpip, d.n);
  var pfrVal    = pct(d.pfrHands, d.n);
  var limpVal   = pct(d.limpHands, d.n);
  var aggVal    = calcAggression(d.raises, d.calls, d.checks);
  var ftrVal    = pct(d.foldedToRaise, d.facedRaise);
  var cbetVal   = pct(d.cbetDone, d.cbetOpps);
  var wtsdVal   = pct(d.wentToShowdown, d.sawFlop);

  var smallSample = d.n < 30;

  // Resolve table-mix context once. Classification thresholds track table size:
  // a 50% VPIP at 6-max is loose, but at HU it's tight.
  var ctx = getGameContext(d);
  var _domSeatsMG = ctx.seats;
  var _vpipBandMG = ctx.band('vpip');
  var _afBandMG = ctx.band('af');
  var _vpipTightCap = _vpipBandMG ? _vpipBandMG.ideal : 30;
  var _aggCap = _afBandMG ? _afBandMG.tight : 25;

  var typeLabel = '', typeDesc = '';
  if (!smallSample) {
    if (vpipVal <= _vpipTightCap && aggVal >= _aggCap) {
      typeLabel = 'Shark';
      typeDesc = 'Tight and aggressive. Picks spots well and applies pressure.';
    } else if (vpipVal <= _vpipTightCap && aggVal < _aggCap) {
      typeLabel = 'Rock';
      typeDesc = 'Tight and passive. Only plays premiums, rarely bets without the goods.';
    } else if (vpipVal > _vpipTightCap && aggVal >= _aggCap) {
      typeLabel = 'Cannon';
      typeDesc = 'Loose and aggressive. Plays lots of hands and fires often.';
    } else {
      typeLabel = 'Station';
      typeDesc = 'Loose and passive. Calls too much, folds too little, rarely raises.';
    }
  }

  html += '<div style="display:flex;flex-wrap:wrap;gap:16px 40px;margin-bottom:20px;align-items:flex-start;">';
  // Left: identity
  html += '<div>';
  html += '<div class="dim-label mb-12">MY GAME</div>';
  html += '<div class="profile-name" style="margin:0;">' + playerName + '</div>';
  html += '<div style="font-size:14px;color:var(--dim);margin-top:4px;">';
  if (exportDate) html += exportDate + ' &middot; ';
  html += d.n + ' hands';
  html += '</div>';
  html += '</div>';
  // Right: player type
  if (typeLabel) {
    html += '<div style="flex:1;min-width:220px;">';
    html += '<div class="dim-label mb-12">PLAYER TYPE</div>';
    html += '<div style="font-family:\'Cormorant Garamond\',serif;font-size:28px;font-weight:700;color:var(--gold);line-height:1;">' + typeLabel + '</div>';
    html += '<div style="font-size:13px;color:var(--dim);margin-top:6px;">' + typeDesc + '</div>';
    html += '</div>';
  }
  html += '</div>';

  // Stat values still computed below for the leak/work-on rules. The raw
  // stat-line mini-row was removed - the Table Dynamics block further down
  // shows the same numbers WITH a verdict (on target / too low / too high),
  // and the header hero strip already shows the headline numbers.
  var _ftrBandMG = ctx.band('foldToRaise');
  var _cbetBandMG = ctx.band('cbet');
  if (smallSample) {
    html += '<div class="meta-text mt-8 mb-12">Stats from ' + d.n + ' hands. These become reliable around 100+ hands.</div>';
  }

  // Skip strengths/leaks/sessions for small samples
  if (!smallSample) {

    // ── Helper: early/late position VPIP ──
    var earlyPos = ['UTG', 'UTG+1', 'MP'];
    var latePos = ['CO', 'BTN'];
    var earlyGroup = calcPositionGroupVpip(d.posMap, earlyPos);
    var lateGroup = calcPositionGroupVpip(d.posMap, latePos);
    var epVpip = earlyGroup.vpip, earlyHands = earlyGroup.hands;
    var lpVpip = lateGroup.vpip, lateHands = lateGroup.hands;

    // Best position by P&L
    var bestPos = null, bestPosPnl = -Infinity, bestPosWr = null;
    var posKeys = Object.keys(d.posMap);
    for (var pi = 0; pi < posKeys.length; pi++) {
      var pk = posKeys[pi];
      var pm = d.posMap[pk];
      if (pm.hands >= 20 && pm.pnl > bestPosPnl) {
        bestPosPnl = pm.pnl;
        bestPos = pk;
        bestPosWr = pct(pm.won, pm.hands);
      }
    }

    var f3b = pct(d.foldTo3betDone, d.foldTo3betOpps);
    var fcbet = pct(d.foldToCbetDone, d.foldToCbetOpps);

    // ── Section 4: Strengths (via Insight Engine) ──
    var engineStrengths = InsightEngine.forPanel('mygame', 12).filter(function(i) { return i.sev === 'g'; });
    if (engineStrengths.length > 4) engineStrengths = engineStrengths.slice(0, 4);
    if (engineStrengths.length) {
      html += '<div class="sec-subtitle mt-20">Strengths</div>';
      html += '<div class="ins-grid">' + engineStrengths.map(function(i) { return renderRuleInsight(i); }).join('') + '</div>';
    }

    // ── Section 5: Exploitable leaks (via Insight Engine) ──
    var engineLeaks = InsightEngine.forPanel('mygame', 12).filter(function(i) { return i.sev === 'r' || i.sev === 'a'; });
    var allLeaks = engineLeaks.slice();
    if (engineLeaks.length > 6) engineLeaks = engineLeaks.slice(0, 6);

    if (engineLeaks.length) {
      // Narrative summary
      var narr = InsightEngine.narrativeFor('mygame');
      if (narr && narr.narrative) {
        html += '<div class="sec-subtitle mt-20">Analysis</div>';
        html += '<div class="engine-narrative">' + narr.narrative + '</div>';
      }
      html += '<div class="sec-subtitle mt-20">Exploitable Leaks</div>';
      html += '<div class="ins-grid">' + engineLeaks.map(function(i) { return renderRuleInsight(i); }).join('') + '</div>';
    }

    // ── Section 5b: Leak Finder (merged from Leak Finder panel) ──
    html += '<div class="sec-subtitle mt-20">Leak Finder</div>';
    var _lkEl = document.createElement('div');
    renderLeaks(_lkEl, d, hands);
    html += _lkEl.innerHTML.replace(/<div class="section-title">[^<]*<\/div>/, '').replace(/<div class="desc-text mb-24">[^<]*<\/div>/, '');

    // ── Section 6: Work on next ──
    html += '<div class="sec-subtitle mt-20">Work On Next</div>';
    var workOn = null;
    // Sample-aware thresholds for the work-on selector. Pull matrix bands so
    // each leak fires only when the player is actually outside the expected
    // range for their table mix.
    var _workAggFloor = _afBandMG ? _afBandMG.tight - 3 : 15;
    var _workLimpCeil = _domSeatsMG && _domSeatsMG <= 2 ? 70 : _domSeatsMG && _domSeatsMG <= 3 ? 45 : 22;
    var _workFtrCeil = _ftrBandMG ? _ftrBandMG.loose + 15 : 70;
    var _workCbetFloor = _cbetBandMG ? _cbetBandMG.tight - 10 : 25;
    var _workWtsdCeil = _domSeatsMG && _domSeatsMG <= 2 ? 55 : 50;
    var _workEpCeil = (function() {
      if (!_domSeatsMG || _domSeatsMG <= 3) return null; // No EP at HU/3-handed.
      var b = (typeof matrixTarget === 'function')
        ? matrixTarget('vpip', 'UTG', _domSeatsMG, getUserStyle()) : null;
      return b ? b.loose + 5 : 35;
    })();
    if (!workOn && aggVal !== null && aggVal < _workAggFloor) workOn = { sev: 'r', label: 'Too Passive', desc: 'Only ' + aggVal + '% aggression - expected floor around ' + Math.round(_workAggFloor) + '%. You check and call when you should be betting for value.', action: 'Next 20 hands: when you have a strong hand, raise instead of calling. Track whether your aggression % moves above ' + Math.round(_workAggFloor + 5) + '%.' };
    if (!workOn && limpVal !== null && limpVal > _workLimpCeil) workOn = { sev: 'r', label: 'Limping Too Much', desc: 'You limp ' + limpVal + '% of hands at ' + (_domSeatsMG || '?') + '-max (ceiling around ' + _workLimpCeil + '%). Limping gives up initiative.', action: 'Next 20 hands: every time you want to limp, either raise or fold instead. No flat calls preflop without a raise in front.' };
    if (!workOn && ftrVal !== null && ftrVal > _workFtrCeil && d.facedRaise >= 5) workOn = { sev: 'r', label: 'Folding To Pressure', desc: 'You fold ' + ftrVal + '% when raised - ceiling around ' + Math.round(_workFtrCeil) + '%.', action: 'Next session: when raised, pause and consider if your hand is strong enough to continue. Look for spots to call or re-raise instead of auto-folding.' };
    if (!workOn && cbetVal !== null && cbetVal < _workCbetFloor && d.cbetOpps >= 5) workOn = { sev: 'r', label: 'Low C-Bet', desc: 'You only c-bet ' + cbetVal + '% - expected floor around ' + Math.round(_workCbetFloor) + '%.', action: 'Next session: when you raised preflop and the flop comes, bet at least half the time regardless of whether you connected. Maintaining aggression wins pots.' };
    if (!workOn && wtsdVal !== null && wtsdVal > _workWtsdCeil) workOn = { sev: 'r', label: 'Paying Off Too Much', desc: 'WTSD at ' + wtsdVal + '% - ceiling around ' + _workWtsdCeil + '%.', action: 'Next session: on the river facing a big bet, ask whether your hand beats their value range. If not, fold. Saving one big call per session adds up.' };
    if (!workOn && _workEpCeil && epVpip !== null && epVpip > _workEpCeil && earlyHands >= 10) workOn = { sev: 'r', label: 'Too Loose Early', desc: 'EP VPIP at ' + epVpip + '% - ceiling around ' + _workEpCeil + '%.', action: 'Next session: from UTG/MP, only play top 25% of hands. Fold marginal suited connectors and weak aces from these seats.' };
    if (!workOn && allLeaks.length) workOn = { sev: allLeaks[0].sev, label: allLeaks[0].label, desc: '', action: 'Focus on this pattern in your next session and track whether the stat improves.' };

    if (workOn) {
      var badgeColor = workOn.sev === 'r' ? 'red' : 'amber';
      html += '<div class="ins" style="border-left:3px solid var(--' + badgeColor + ');padding-left:16px;margin:12px 0;">';
      html += '<div class="ins-badge ' + workOn.sev + '"><div class="ins-dot"></div><div class="ins-word">Work on this</div></div>';
      html += '<div class="ins-label dim-label">' + workOn.label + '</div>';
      if (workOn.desc) html += '<div class="ins-text">' + workOn.desc + '</div>';
      html += '<div class="ins-text" style="margin-top:8px;color:var(--text);">' + workOn.action + '</div>';
      html += '</div>';
    } else {
      html += '<div class="ins" style="border-left:3px solid var(--green);padding-left:16px;margin:12px 0;">';
      html += '<div class="ins-badge g"><div class="ins-dot"></div><div class="ins-word">Solid Game</div></div>';
      html += '<div class="ins-text">No major leaks detected from ' + d.n + ' hands. Keep playing to refine the picture.</div>';
      html += '</div>';
    }

    // Best & Worst Sessions used to live here. It now lives in Trends, which
    // is the natural home for "session over time" content.

  } // end !smallSample

  // ── Table Dynamics reference ──
  html += renderTableDynamicsReference(hands, d);

  html += '</div>';
  container.innerHTML = html;
}

// Parse a target range like "65-75%" or "40-50%" into [lo, hi] numbers.
function _parsePctRange(s) {
  if (!s) return null;
  var m = s.match(/(\d+)\s*-\s*(\d+)/);
  if (!m) return null;
  return [parseInt(m[1], 10), parseInt(m[2], 10)];
}

// Return { cls, label } verdict for an actual pct against a target range.
function _verdict(actual, lo, hi) {
  if (actual == null) return { cls: 'v-na', label: 'no data' };
  if (actual < lo) return { cls: 'v-low', label: 'too low' };
  if (actual > hi) return { cls: 'v-high', label: 'too high' };
  return { cls: 'v-ok', label: 'on target' };
}

// Render a "your X% vs target Y-Z% → verdict" row. The label tells the user
// WHICH stat they are looking at (e.g. "C-bet") - without it the value is
// just a naked percentage with no context.
function _vsRow(label, actualPct, actualDenom, targetText) {
  var rng = _parsePctRange(targetText);
  var actualStr = (actualPct == null) ? '-' : actualPct + '%';
  var sampleStr = actualDenom != null ? ' <span class="dim-label">(' + actualDenom + ' spots)</span>' : '';
  var v = rng ? _verdict(actualPct, rng[0], rng[1]) : { cls: 'v-na', label: '' };
  var labelHtml = label ? '<div class="dynamics-vs-stat dim-label">' + label + '</div>' : '';
  return '<div class="dynamics-vs ' + v.cls + '">' +
    labelHtml +
    '<div class="dynamics-vs-top"><span>You: <strong>' + actualStr + '</strong>' + sampleStr + '</span>' +
    '<span class="dim-label">Target: ' + targetText + '</span></div>' +
    (v.label ? '<div class="dynamics-vs-verdict">' + v.label + '</div>' : '') +
    '</div>';
}

// Format a {tight, ideal, loose} matrix band as "X-Y%". Used to render target
// bands sourced from matrixTarget so the user's chosen style offset is applied.
function _fmtBand(band) {
  if (!band) return '-';
  return Math.round(band.tight) + '-' + Math.round(band.loose) + '%';
}

// Table Dynamics: compares YOUR actual play (c-bet %, VPIP per position) against
// the recommended targets for each bucket. Each card carries a clear verdict.
//
// Targets come from matrixTarget(metric, position, seats) so the user's chosen
// style (TAG/LAG/Nit/etc) is applied via STYLE_OFFSETS - reading the static
// SEAT_MATRIX / FLOP_MATRIX entries directly would skip the style offset.
//
// Each card has three explicit zones, in this order:
//   1. ANALYSIS    - your numbers vs target band, with a verdict
//   2. CONTEXT     - one-line description of the regime (general advice)
//   3. COACHING    - what to actually do (general advice)
function renderTableDynamicsReference(hands, d) {
  var h = '<div class="sec-subtitle mt-20">Table Dynamics - You vs Target</div>';
  h += '<div class="desc-text mb-16">Your actual play at each table size and flop multiplicity, compared to the recommended benchmarks for your target style. <span class="v-ok">Green = on target</span>, <span class="v-low">amber = too low / too tight</span>, <span class="v-high">red = too high / too loose</span>.</div>';

  var styleKey = (typeof getUserStyle === 'function') ? getUserStyle() : 'TAG';
  var seatKeys = Object.keys(SEAT_MATRIX).map(Number).sort(function(a, b) { return a - b; });

  // ── Seat-size cards: per-position VPIP vs target ──
  h += '<div class="sec-subtitle mt-12">By Table Size</div>';
  h += '<div class="dynamics-cards">';
  for (var si = 0; si < seatKeys.length; si++) {
    var seats = seatKeys[si];
    var entry = SEAT_MATRIX[seats];
    if (!entry) continue;
    var seatBucket = seats + 'p';
    var subD = d && d.bySeatBucket ? d.bySeatBucket[seatBucket] : null;
    var nHands = subD ? subD.n : 0;

    h += '<div class="dynamics-card">';
    h += '<div class="dynamics-card-head">' + seats + '-handed <span class="dim-label">(' + nHands + ' hands)</span></div>';
    if (!nHands) {
      h += '<div class="dynamics-card-note dim-label">No hands at this table size yet.</div>';
      h += '</div>';
      continue;
    }

    // ANALYSIS zone: per-position VPIP vs style-adjusted matrix target
    h += '<div class="dynamics-zone-label dim-label">Your play</div>';
    h += '<table class="tbl dynamics-pos-tbl"><thead><tr><th>Pos</th><th>You</th><th>Target</th><th>Hands</th></tr></thead><tbody>';
    for (var pi = 0; pi < entry.positions.length; pi++) {
      var p = entry.positions[pi];
      if (!entry.guideByPos[p]) continue;
      var pm = subD.posMap[p];
      var actPct = (pm && pm.hands > 0) ? pct(pm.vpip, pm.hands) : null;
      // Use matrixTarget so the user's style offset (TAG/LAG/Nit/etc) is applied
      var band = matrixTarget('vpip', p, seats, styleKey);
      var cls = band ? _verdict(actPct, Math.round(band.tight), Math.round(band.loose)).cls : 'v-na';
      h += '<tr class="' + cls + '"><td>' + p + '</td><td>' + (actPct != null ? actPct + '%' : '-') + '</td><td class="dim-label">' + _fmtBand(band) + '</td><td class="dim-label">' + (pm ? pm.hands : 0) + '</td></tr>';
    }
    h += '</tbody></table>';

    h += '</div>';
  }
  h += '</div>';

  // ── Flop multiplicity cards: c-bet % vs target ──
  h += '<div class="sec-subtitle mt-20">By Flop Players</div>';
  h += '<div class="dynamics-cards">';
  var flopKeys = ['HU', '3-way', 'multiway'];
  var flopLabels = { HU: 'Heads-up flop', '3-way': '3-way flop', multiway: 'Multiway flop (4+)' };
  // Flop bucket modifies the seat-based c-bet target: HU rewards more c-betting,
  // multiway demands less. Mirrors the Betting panel's situational-stat logic.
  var flopCbetMod = { HU: 5, '3-way': 0, multiway: -10 };
  var ctx = getGameContext(d);
  var domSeats = ctx.seats;
  var domPos = ctx.defaultPos;
  for (var fk = 0; fk < flopKeys.length; fk++) {
    var bk = flopKeys[fk];
    var fe = FLOP_MATRIX[bk];
    var subF = d && d.byFlopBucket ? d.byFlopBucket[bk] : null;
    var nF = subF ? subF.n : 0;

    h += '<div class="dynamics-card">';
    h += '<div class="dynamics-card-head">' + flopLabels[bk] + ' <span class="dim-label">(' + nF + ' hands)</span></div>';
    if (!nF) {
      h += '<div class="dynamics-card-note dim-label">No flops with this many players yet.</div>';
      h += '</div>';
      continue;
    }

    // ANALYSIS zone: c-bet vs style-adjusted matrix target with bucket modifier
    h += '<div class="dynamics-zone-label dim-label">Your play</div>';
    var cbetActual = subF.cbetOpps > 0 ? pct(subF.cbetDone, subF.cbetOpps) : null;
    var cbetSeatBand = matrixTarget('cbet', domPos, domSeats, styleKey);
    var cbetMod = flopCbetMod[bk] || 0;
    var cbetBand = cbetSeatBand ? {
      tight: Math.max(0, cbetSeatBand.tight + cbetMod),
      ideal: Math.max(0, cbetSeatBand.ideal + cbetMod),
      loose: Math.max(0, cbetSeatBand.loose + cbetMod)
    } : null;
    h += _vsRow('C-bet', cbetActual, subF.cbetOpps, _fmtBand(cbetBand));

    // CONTEXT + COACHING zone
    h += '<div class="dynamics-zone-label dim-label dynamics-coaching-head">Coaching</div>';
    h += '<div class="dynamics-coaching">' + fe.notes + '</div>';
    h += '<div class="dynamics-card-kv"><span>Bet sizing</span><span>' + fe.cbetSizing + '</span></div>';
    h += '<div class="dynamics-card-kv"><span>Continue with</span><span>' + fe.continueRange + '</span></div>';
    h += '</div>';
  }
  h += '</div>';

  return h;
}

// sessionPnl, detectSessionPatterns, renderBestWorstSessions all live in
// js/helpers/sessions.js so Trends and the insight engine can share them.
