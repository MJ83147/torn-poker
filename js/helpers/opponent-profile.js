// ── OPPONENT PROFILE ─────────────────────────────────────────────────────────
// Type labels, abbreviation expansion, and the per-name opponent profile cache
// shared by the players panel and the insight engine.

// Long-form labels for opponent type abbreviations. Always use these in
// user-visible copy so people don't have to decode "PA" or "LAG".
var OPPONENT_TYPE_LABELS = {
  LAG: 'loose aggressive',
  LAP: 'loose passive',
  TAG: 'tight aggressive',
  TAP: 'tight passive',
  AG:  'aggressive',
  PA:  'passive aggressive',
  Unknown: 'mixed'
};

function expandOpponentType(typeKey) {
  if (!typeKey) return '';
  return OPPONENT_TYPE_LABELS[typeKey] || typeKey;
}

// Replace any opponent-type abbreviation tokens (LAG/LAP/TAG/TAP/PA/AG) in a
// free-text string with their long-form equivalents. Word-boundary safe.
function expandOpponentTypesInText(text) {
  if (!text || typeof text !== 'string') return text;
  return text
    .replace(/\bLAG\b/g, 'loose aggressive')
    .replace(/\bLAP\b/g, 'loose passive')
    .replace(/\bTAG\b/g, 'tight aggressive')
    .replace(/\bTAP\b/g, 'tight passive')
    .replace(/\bPA\b/g,  'passive aggressive')
    .replace(/\bAG\b/g,  'aggressive');
}

// Build a concrete adjustment string from an opponent profile, used to
// replace generic "don't bluff them" copy.
function concreteAdjustment(prof) {
  if (!prof) return '';
  if (prof.foldToRaise !== null && prof.foldToRaise <= 25) {
    return 'they call wide so value-bet thin instead of bluffing';
  }
  if (prof.wtsd !== null && prof.wtsd >= 55) {
    return 'they go to showdown often so bet for value on every street';
  }
  if (prof.foldToRaise !== null && prof.foldToRaise >= 60) {
    return 'they fold to raises ' + prof.foldToRaise + '% of the time so apply pressure';
  }
  if (prof.cbet !== null && prof.cbet >= 75) {
    return 'they auto c-bet so raise their flop bets';
  }
  if (prof.agg !== null && prof.agg < 15) {
    return 'they play passively so take the initiative with bets and raises';
  }
  return 'avoid bluffing thin spots and value-bet your strong hands harder';
}

// Post-process an engine rule insight result before rendering: expands
// opponent-type abbreviations in label/text/chips and rewrites generic
// "don't try to bluff them" copy with a concrete adjustment.
function refineOpponentInsight(result) {
  if (!result) return result;
  var prof = null;
  if (result.ctx && result.ctx.name && _opponentCache[result.ctx.name]) {
    prof = _opponentCache[result.ctx.name];
  }
  // Clone shallowly so we don't mutate engine cache.
  var out = {};
  for (var k in result) out[k] = result[k];

  // Label / text expansion.
  out.label = expandOpponentTypesInText(out.label);
  out.text  = expandOpponentTypesInText(out.text);

  // Replace generic anti-bluff copy with concrete adjustment.
  if (out.text && /Don'?t try to bluff them/i.test(out.text)) {
    var concrete = concreteAdjustment(prof);
    out.text = out.text.replace(/Don'?t try to bluff them\.?/i, concrete.charAt(0).toUpperCase() + concrete.slice(1) + '.');
  }

  // Replace bare "N exploits" chips with the actual list joined inline.
  if (Array.isArray(out.chips)) {
    out.chips = out.chips.map(function(c) {
      if (!c || typeof c.v !== 'string') return c;
      var m = c.v.match(/^(\d+)\s+exploits?$/i);
      if (m && prof && prof.adjustments && prof.adjustments.length) {
        var newChip = {};
        for (var ck in c) newChip[ck] = c[ck];
        newChip.v = prof.adjustments.join(' · ');
        return newChip;
      }
      // Expand any inline abbreviations in chip text too.
      var expanded = expandOpponentTypesInText(c.v);
      if (expanded !== c.v) {
        var nc = {};
        for (var ck2 in c) nc[ck2] = c[ck2];
        nc.v = expanded;
        return nc;
      }
      return c;
    });
  }
  return out;
}

// ── Opponent Profile Cache ─────────────────────────────────────────────────
// Populated by cacheOpponentProfiles(); read by getOpponentProfile() and the
// engine's insight-refining pass. Keyed by player name. Values are profile
// objects shaped:
//   { name, hands, vpip, pfr, agg, cbet, foldToRaise, wtsd, type,
//     adjustments: string[], raw: <stats object> }
var _opponentCache = {};

function cacheOpponentProfiles(hands) {
  _opponentCache = {};
  // Collect unique opponent names
  var names = {};
  for (var i = 0; i < hands.length; i++) {
    var acts = parseActions(hands[i].actions);
    for (var j = 0; j < acts.length; j++) {
      if (!acts[j].isMe && acts[j].author) names[acts[j].author] = true;
    }
  }
  for (var name in names) {
    var s = computeOpponentStats(hands, name);
    if (s.hands < 5) continue;
    var vpip = pct(s.vpipHands, s.hands);
    var pfr = pct(s.pfrHands, s.hands);
    var agg = calcAggression(s.totalRaises, s.totalCalls, s.totalChecks);
    var cbet = pct(s.cbetDone, s.cbetOpps);
    var foldToRaise = pct(s.foldedToRaise, s.facedRaise);
    var wtsd = pct(s.wentToShowdown, s.sawFlop);

    // Classify: loose (VPIP>=40) vs tight, aggressive (agg>=30) vs passive
    var loose = vpip !== null && vpip >= 40;
    var tight = vpip !== null && vpip < 25;
    var aggressive = agg !== null && agg >= 30;
    var type = 'Unknown';
    if (loose && aggressive) type = 'LAG';
    else if (loose && !aggressive) type = 'LAP';
    else if (tight && aggressive) type = 'TAG';
    else if (tight && !aggressive) type = 'TAP';
    else if (aggressive) type = 'AG';
    else type = 'PA';

    // Exploitation adjustments
    var adjustments = [];
    if (foldToRaise !== null && foldToRaise >= 60) adjustments.push('Folds to raises ' + foldToRaise + '% - bluff more');
    if (foldToRaise !== null && foldToRaise <= 25) adjustments.push('Rarely folds to raises - value bet only');
    if (vpip !== null && vpip >= 55) adjustments.push('Plays too many hands - tighten up and value bet');
    if (cbet !== null && cbet >= 75) adjustments.push('Auto c-bets - raise their flop bets');
    if (agg !== null && agg < 15) adjustments.push('Very passive - steal pots with aggression');
    if (wtsd !== null && wtsd >= 55) adjustments.push('Calls to showdown - bet every street for value');

    _opponentCache[name] = {
      name: name, hands: s.hands, vpip: vpip, pfr: pfr, agg: agg,
      cbet: cbet, foldToRaise: foldToRaise, wtsd: wtsd,
      type: type, adjustments: adjustments, raw: s
    };
  }
}

function getOpponentProfile(playerName) {
  return _opponentCache[playerName] || null;
}

// Find the primary villain in a hand (opponent who put most money in).
// Returns the cached profile object or null.
function getPrimaryVillain(hand) {
  var acts = parseActions(hand.actions);
  var invested = {};
  for (var i = 0; i < acts.length; i++) {
    if (!acts[i].isMe && acts[i].author && acts[i].amount) {
      invested[acts[i].author] = (invested[acts[i].author] || 0) + acts[i].amount;
    }
  }
  var best = null, bestAmt = 0;
  for (var name in invested) {
    if (invested[name] > bestAmt) { bestAmt = invested[name]; best = name; }
  }
  return best ? getOpponentProfile(best) : null;
}
