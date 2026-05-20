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
  if (af >= 35) return 'Shark';
  if (af >= 25) return 'TAG';
  return 'Rock';
}

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
