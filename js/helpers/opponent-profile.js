// ── OPPONENT PROFILE ─────────────────────────────────────────────────────────
// Type labels, abbreviation expansion, and the per-name opponent profile cache
// shared by the players panel, the equity modal, and the Sections layer.

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

// ── Opponent Profile Cache ─────────────────────────────────────────────────
// Populated by cacheOpponentProfiles(); read by getOpponentProfile() and
// getPrimaryVillain(). Keyed by player name. Values are profile objects shaped:
//   { name, hands, vpip, pfr, agg, cbet, foldToRaise, wtsd, type,
//     adjustments: string[], raw: <stats object> }
var _opponentCache = {};

function cacheOpponentProfiles(hands) {
  _opponentCache = {};
  // One pass over every hand produces stats for every opponent. The old
  // version walked all hands once per opponent, which became unusable past
  // ~10k hands and ~50 opponents.
  var statsByName = computeAllOpponentStats(hands);
  for (var name in statsByName) {
    var s = statsByName[name];
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
    if (foldToRaise !== null && foldToRaise >= 60) adjustments.push('Folds to raises ' + foldToRaise + '%: bluff more');
    if (foldToRaise !== null && foldToRaise <= 25) adjustments.push('Rarely folds to raises: value bet only');
    if (vpip !== null && vpip >= 55) adjustments.push('Plays too many hands: tighten up and value bet');
    if (cbet !== null && cbet >= 75) adjustments.push('Auto c-bets: raise their flop bets');
    if (agg !== null && agg < 15) adjustments.push('Very passive: steal pots with aggression');
    if (wtsd !== null && wtsd >= 55) adjustments.push('Calls to showdown: bet every street for value');

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
