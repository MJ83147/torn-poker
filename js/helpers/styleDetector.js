// ── STYLE DETECTOR ───────────────────────────────────────────────────────────
// Classify the player's actual play into one of eight archetypal styles based
// on VPIP and aggression factor. Returns {name, confidence, vpip, af, pfr,
// reason}.
//
// Style bands (tunable):
//   Maniac : VPIP >= 45 AND AF >= 40
//   LAG    : VPIP >= 28 AND AF >= 30 (and not Maniac)
//   Cannon : VPIP >= 28 AND AF in [20, 30) (loose mid-aggression)
//   Station: VPIP >= 28 AND AF < 20         (loose passive)
//   Shark  : VPIP in [14, 25] AND AF >= 35  (very aggressive tight player)
//   TAG    : VPIP in [14, 28) AND AF in [25, 35) (default tight-aggressive)
//   Rock   : VPIP in [14, 28) AND AF < 25
//   Nit    : VPIP < 14
//
// Confidence:
//   high   : >= 100 hands
//   medium : >=  40 hands
//   low    : <   40 hands

function _styleConfidence(n) {
  if (!n) return 'low';
  if (n >= 100) return 'high';
  if (n >= 40) return 'medium';
  return 'low';
}

function _styleClassify(vpip, af) {
  if (vpip == null || af == null) return null;
  if (vpip >= 45 && af >= 40) return 'Maniac';
  if (vpip >= 28) {
    if (af >= 30) return 'LAG';
    if (af >= 20) return 'Cannon';
    return 'Station';
  }
  if (vpip < 14) return 'Nit';
  // VPIP in [14, 28) range
  if (af >= 35) return 'Shark';
  if (af >= 25) return 'TAG';
  return 'Rock';
}

// One-line plain-English explanation of why we picked this style.
function _styleReason(name, vpip, af, pfr) {
  var v = (vpip != null) ? Math.round(vpip) + '% VPIP' : 'unknown VPIP';
  var a = (af != null) ? Math.round(af) + '% aggression' : 'unknown aggression';

  if (name === 'Maniac') return v + ' and ' + a + ', firing at everything.';
  if (name === 'LAG') return v + ' and ' + a + ', loose and pushing pots.';
  if (name === 'Cannon') return v + ' and ' + a + ', too many hands without enough follow-through.';
  if (name === 'Station') return v + ' and ' + a + ', calling too much without raising.';
  if (name === 'Shark') return v + ' and ' + a + ', tight and very aggressive.';
  if (name === 'TAG') return v + ' and ' + a + ', tight and aggressive.';
  if (name === 'Rock') return v + ' and ' + a + ', tight but passive.';
  if (name === 'Nit') return v + ', folding most hands preflop.';
  return v + ', ' + a + '.';
}

// Read VPIP / AF / PFR off the analyse() result.
function _readStyleStats(d) {
  if (!d) return { vpip: null, af: null, pfr: null, n: 0 };
  var n = d.n || 0;
  var vpip = (d.n && d.vpip != null && typeof pct === 'function') ? pct(d.vpip, d.n) : null;
  var pfr = (d.n && d.pfrHands != null && typeof pct === 'function') ? pct(d.pfrHands, d.n) : null;
  var af = null;
  if (typeof calcAggression === 'function') {
    af = calcAggression(d.raises, d.calls, d.checks);
  }
  return { vpip: vpip, af: af, pfr: pfr, n: n };
}

// Public: detect the player's current style from analyse() output `d`.
function detectCurrentStyle(d) {
  var stats = _readStyleStats(d);
  var name = _styleClassify(stats.vpip, stats.af) || 'Shark';
  return {
    name: name,
    confidence: _styleConfidence(stats.n),
    vpip: stats.vpip,
    af: stats.af,
    pfr: stats.pfr,
    reason: _styleReason(name, stats.vpip, stats.af, stats.pfr)
  };
}

// Static descriptions for the welcome cards and style map title.
var STYLE_DESCRIPTIONS = {
  Shark:   'Tight and very aggressive. Picks spots well, hammers value, applies pressure.',
  TAG:     'Tight-aggressive. The default winning style. Few hands, played hard.',
  Rock:    'Tight-passive. Selective preflop, rarely takes the lead postflop.',
  LAG:     'Loose-aggressive. Wider ranges with relentless pressure. Exploits weak players.',
  Cannon:  'Loose mid-aggression. Sees plenty of flops without enough follow-through.',
  Nit:     'Extremely tight. Only premium hands, only clear value. Hard to bluff, easy to read.',
  Station: 'Loose-passive. Plays plenty of hands but rarely raises. Pays off too often.',
  Maniac:  'Hyper-aggressive. Raises and re-raises everything. High variance.'
};

function styleDescription(name) {
  return STYLE_DESCRIPTIONS[name] || '';
}
