// My Game panel logic. No DOM, no markup — the view is
// js/panels/views/mygame.js.

// Header profile: who, when, how many hands, detected player type.
function mygameProfile(d, hands) {
  var smallSample = d.n < 30;
  var typeLabel = '', typeDesc = '';
  if (!smallSample && typeof detectCurrentStyle === 'function') {
    var detected = detectCurrentStyle(d);
    typeLabel = detected.name;
    typeDesc = (typeof styleDescription === 'function') ? styleDescription(typeLabel) : '';
  }
  return {
    playerName: State.meta.player || detectPlayerFromActions(hands) || 'Unknown',
    exportDate: fmtDate(State.meta.exportedAt),
    smallSample: smallSample,
    typeLabel: typeLabel,
    typeDesc: typeDesc,
  };
}

// The one leak to work on next, as a shared-story-card finding object:
// desc -> openingText, action -> soWhatText. Falls back to the highest
// severity insight finding, then to a green "solid game" card.
function mygameWorkFinding(d, hands) {
  var vpipVal = pct(d.vpip, d.n);
  var limpVal = pct(d.limpHands, d.n);
  var aggVal = calcAggression(d.raises, d.calls, d.checks);
  var ftrVal = pct(d.foldedToRaise, d.facedRaise);
  var cbetVal = pct(d.cbetDone, d.cbetOpps);
  var wtsdVal = pct(d.wentToShowdown, d.sawFlop);

  // Classification thresholds track table size: a 50% VPIP at 6-max is loose, at HU it's tight.
  var ctx = getGameContext(d);
  var seats = ctx.seats;
  var afBand = ctx.band('af');
  var ftrBand = ctx.band('foldToRaise');
  var cbetBand = ctx.band('cbet');

  var earlyGroup = calcPositionGroupVpip(d.posMap, EARLY_POSITIONS);
  var epVpip = earlyGroup.vpip, earlyHands = earlyGroup.hands;

  var allLeaks = (typeof Sections !== 'undefined' && typeof Sections.evaluateSections === 'function')
    ? Sections.evaluateSections(d, {}, hands).filter(function(f) {
        return f.severity === 'r' || f.severity === 'a';
      })
    : [];

  var aggFloor = afBand ? afBand.tight - 3 : 15;
  var limpCeil = seats && seats <= 2 ? 70 : seats && seats <= 3 ? 45 : 22;
  var ftrCeil = ftrBand ? ftrBand.loose + 15 : 70;
  var cbetFloor = cbetBand ? cbetBand.tight - 10 : 25;
  var wtsdCeil = seats && seats <= 2 ? 55 : 50;
  var epCeil = (function() {
    if (!seats || seats <= 3) return null;
    var b = (typeof matrixTarget === 'function')
      ? matrixTarget('vpip', 'UTG', seats, getUserStyle()) : null;
    return b ? b.loose + 5 : 35;
  })();

  var workOn = null;
  if (!workOn && aggVal !== null && aggVal < aggFloor) workOn = { sev: 'r', label: 'Too Passive', desc: 'Only ' + aggVal + '% aggression. Expected floor around ' + Math.round(aggFloor) + '%. You check and call when you should be betting for value.', action: 'Next 20 hands: when you have a strong hand, raise instead of calling. Track whether your aggression % moves above ' + Math.round(aggFloor + 5) + '%.' };
  if (!workOn && limpVal !== null && limpVal > limpCeil) workOn = { sev: 'r', label: 'Limping Too Much', desc: 'You limp ' + limpVal + '% of hands at ' + (seats || '?') + '-max (ceiling around ' + limpCeil + '%). Limping gives up initiative.', action: 'Next 20 hands: every time you want to limp, either raise or fold instead. No flat calls preflop without a raise in front.' };
  if (!workOn && ftrVal !== null && ftrVal > ftrCeil && d.facedRaise >= 5) workOn = { sev: 'r', label: 'Folding To Pressure', desc: 'You fold ' + ftrVal + '% when raised. Ceiling around ' + Math.round(ftrCeil) + '%.', action: 'Next session: when raised, pause and consider if your hand is strong enough to continue. Look for spots to call or re-raise instead of auto-folding.' };
  if (!workOn && cbetVal !== null && cbetVal < cbetFloor && d.cbetOpps >= 5) workOn = { sev: 'r', label: 'Low C-Bet', desc: 'You only c-bet ' + cbetVal + '%. Expected floor around ' + Math.round(cbetFloor) + '%.', action: 'Next session: when you raised preflop and the flop comes, bet at least half the time regardless of whether you connected. Maintaining aggression wins pots.' };
  if (!workOn && wtsdVal !== null && wtsdVal > wtsdCeil) workOn = { sev: 'r', label: 'Paying Off Too Much', desc: 'WTSD at ' + wtsdVal + '%. Ceiling around ' + wtsdCeil + '%.', action: 'Next session: on the river facing a big bet, ask whether your hand beats their value range. If not, fold. Saving one big call per session adds up.' };
  if (!workOn && epCeil && epVpip !== null && epVpip > epCeil && earlyHands >= 10) workOn = { sev: 'r', label: 'Too Loose Early', desc: 'EP VPIP at ' + epVpip + '%. Ceiling around ' + epCeil + '%.', action: 'Next session: from UTG/MP, only play top 25% of hands. Fold marginal suited connectors and weak aces from these seats.' };
  if (!workOn && allLeaks.length) workOn = { sev: allLeaks[0].severity, label: allLeaks[0].name, desc: '', action: 'Focus on this pattern in your next session and track whether the stat improves.' };

  return workOn
    ? { name: workOn.label, severity: workOn.sev, openingText: workOn.desc || '', soWhatText: workOn.action }
    : { name: 'Solid game', severity: 'g', openingText: 'No major leaks detected from ' + d.n + ' hands. Keep playing to refine the picture.' };
}

var _STYLE_ANCHORS = {
  Shark:   { vpip: 20, af: 40 },
  TAG:     { vpip: 22, af: 30 },
  Rock:    { vpip: 20, af: 18 },
  LAG:     { vpip: 32, af: 40 },
  Cannon:  { vpip: 32, af: 25 },
  Nit:     { vpip: 12, af: 30 },
  Station: { vpip: 38, af: 15 },
  Maniac:  { vpip: 50, af: 55 }
};

function _styleAnchor(name) {
  return _STYLE_ANCHORS[name] || _STYLE_ANCHORS.TAG;
}

function _smReadBucket(bucket) {
  if (!bucket || !bucket.n) return null;
  var vpip = (typeof pct === 'function') ? pct(bucket.vpip, bucket.n) : null;
  var af = (typeof calcAggression === 'function') ? calcAggression(bucket.raises, bucket.calls, bucket.checks) : null;
  if (vpip == null || af == null) return null;
  return { vpip: vpip, af: af, n: bucket.n };
}

function _smGapPhrase(detected, target) {
  if (!detected || !target) return '';
  var dV = detected.vpip || 0, dA = detected.af || 0;
  var tA = _styleAnchor(target);
  var dvGap = Math.abs(dV - tA.vpip);
  var daGap = Math.abs(dA - tA.af);
  if (dvGap < 4 && daGap < 6) return 'Your numbers already sit close to the target.';
  if (daGap > dvGap * 1.4) return 'The biggest gap is aggression.';
  if (dvGap > daGap * 1.4) return 'The biggest gap is hand selection.';
  return 'Both VPIP and aggression need work to hit the target.';
}

// Data behind the style-map scatter: you overall, per-position and per-seat
// points, plus the TAG and target anchors.
function styleMapModel(d) {
  var detected = (typeof detectCurrentStyle === 'function') ? detectCurrentStyle(d) : null;
  var targetStyleName = (typeof getTargetStyle === 'function') ? getTargetStyle() : 'TAG';

  var youAgg = null;
  var vpip = (typeof pct === 'function') ? pct(d.vpip, d.n) : null;
  var af = (typeof calcAggression === 'function') ? calcAggression(d.raises, d.calls, d.checks) : null;
  if (vpip != null && af != null) youAgg = { vpip: vpip, af: af, n: d.n };

  var posPoints = [];
  if (d.byPosition) {
    for (var pos in d.byPosition) {
      var pd = d.byPosition[pos];
      if (pd && pd.gated) continue;
      var rd = _smReadBucket(pd);
      if (!rd) continue;
      posPoints.push({ x: rd.vpip, y: rd.af, n: rd.n, label: pos });
    }
  }

  var seatPoints = [];
  if (d.bySeatBucket) {
    for (var sb in d.bySeatBucket) {
      var sd = d.bySeatBucket[sb];
      if (sd && sd.gated) continue;
      var srd = _smReadBucket(sd);
      if (!srd) continue;
      seatPoints.push({ x: srd.vpip, y: srd.af, n: srd.n, label: String(sb).replace(/p$/, '') + '-handed' });
    }
  }

  var titleSentence = detected
    ? 'You play like a ' + detected.name + '. Your target is ' + targetStyleName + '. ' + _smGapPhrase(detected, targetStyleName)
    : 'Your target style is ' + targetStyleName + '.';

  return {
    targetStyleName: targetStyleName,
    targetAnchor: _styleAnchor(targetStyleName),
    tagAnchor: _styleAnchor('TAG'),
    youAgg: youAgg,
    posPoints: posPoints,
    seatPoints: seatPoints,
    titleSentence: titleSentence,
  };
}

function _parsePctRange(s) {
  if (!s) return null;
  var m = s.match(/(\d+)\s*-\s*(\d+)/);
  if (!m) return null;
  return [parseInt(m[1], 10), parseInt(m[2], 10)];
}
