// ── INSIGHT ENGINE: LAYERED VERDICT TREE ─────────────────────────────────────
// Evaluates each metric at three levels of granularity (aggregate, per-position,
// per-player-count). Per-cell verdicts are computed for downstream context but
// no longer surfaced as their own insights - they fold into the per-position
// narrative instead.

// Direction in which a metric being above target counts as a strength rather
// than a leak. null means there's no strength side - on-target is the goal.
var STRENGTH_SIDE = {
  vpip: null,
  pfr: 'high',
  af: 'high',
  cbet: 'high',
  foldToRaise: 'low'
};

// Per-metric reader: pulls actual rate (number, percent) and hand count from
// an analyse() output `d`. Returns null when the metric isn't applicable
// (e.g. cbet with zero opportunities).
var METRIC_READERS = {
  vpip:        function(d) { return _readPct(d.vpip, d.n); },
  pfr:         function(d) { return _readPct(d.pfrHands, d.n); },
  af:          function(d) {
    var v = calcAggression(d.raises, d.calls, d.checks);
    return v == null ? null : { rate: v, opps: d.totalActs || d.n };
  },
  cbet:        function(d) { return _readPct(d.cbetDone, d.cbetOpps); },
  foldToRaise: function(d) { return _readPct(d.foldedToRaise, d.facedRaise); }
};

function _readPct(num, denom) {
  if (!denom || denom <= 0) return null;
  var v = pct(num, denom);
  if (v == null) return null;
  return { rate: v, opps: denom };
}

// Min opportunities per metric to trust a level's actual rate. Independent of
// the hand-count gate (since e.g. cbet only fires when hero raised preflop).
var METRIC_MIN_OPPS = {
  vpip:        20,
  pfr:         20,
  af:          15,
  cbet:        10,
  foldToRaise: 8
};

// Hand-count-weighted target band across a list of {position, seats, hands}
// cells. Returns null if no cells contribute.
function weightedTarget(metric, cells, style) {
  if (!cells || !cells.length) return null;
  var totalHands = 0, t = 0, i = 0, l = 0, contributing = 0;
  for (var c = 0; c < cells.length; c++) {
    var cell = cells[c];
    var band = matrixTarget(metric, cell.position, cell.seats, style);
    if (!band) continue;
    var w = cell.hands || 0;
    if (w <= 0) continue;
    totalHands += w;
    t += band.tight * w;
    i += band.ideal * w;
    l += band.loose * w;
    contributing++;
  }
  if (!totalHands || !contributing) return null;
  return {
    tight: Math.round(t / totalHands * 10) / 10,
    ideal: Math.round(i / totalHands * 10) / 10,
    loose: Math.round(l / totalHands * 10) / 10
  };
}

// Classify an actual rate against a target band. Returns
//   { verdict, direction, actual, deltaUnits } or null.
//
// verdict ∈ 'strength' | 'on-target' | 'slight-leak' | 'significant-leak'
// direction ∈ 'low' | 'high' | 'mid' (mid = inside the band)
// deltaUnits = how far outside the band, in band-widths (0 if inside)
function classify(actual, target, metric) {
  if (actual == null || target == null) return null;
  var bandWidth = Math.max(1, target.loose - target.tight);
  var strengthSide = STRENGTH_SIDE[metric] || null;

  if (actual >= target.tight && actual <= target.loose) {
    return { verdict: 'on-target', direction: 'mid', actual: actual, deltaUnits: 0 };
  }

  var direction, deltaUnits;
  if (actual < target.tight) {
    direction = 'low';
    deltaUnits = (target.tight - actual) / bandWidth;
  } else {
    direction = 'high';
    deltaUnits = (actual - target.loose) / bandWidth;
  }

  // Modest move past the band on the strength side reads as a strength.
  if (strengthSide && direction === strengthSide && deltaUnits < 1) {
    return { verdict: 'strength', direction: direction, actual: actual, deltaUnits: deltaUnits };
  }

  if (deltaUnits >= 1) {
    return { verdict: 'significant-leak', direction: direction, actual: actual, deltaUnits: deltaUnits };
  }
  return { verdict: 'slight-leak', direction: direction, actual: actual, deltaUnits: deltaUnits };
}

// Surface a child level only when its VERDICT meaningfully differs from its
// parent's. We compare verdict severity (not raw rates), because the same raw
// rate can be on-target at one level and a leak at another - that's the whole
// point of layered evaluation. Filter out edge-flapping by requiring the
// child to be at least 0.3 band-widths past its own band boundary.
var _VERDICT_RANK = { 'strength': 0, 'on-target': 0, 'slight-leak': 1, 'significant-leak': 2 };

function disagrees(parent, child) {
  if (!parent || !child) return false;
  var pRank = _VERDICT_RANK[parent.verdict] || 0;
  var cRank = _VERDICT_RANK[child.verdict] || 0;

  // Child is more concerning than parent and not just at the band edge.
  if (cRank > pRank && (child.deltaUnits || 0) >= 0.3) return true;

  // Child is unexpectedly a strength while parent isn't.
  if (child.verdict === 'strength' && parent.verdict !== 'strength' && (child.deltaUnits || 0) >= 0.2) return true;

  return false;
}

// Build a verdict tree for one metric across the player's hands.
// `d` is the top-level analyse() output, which must already have
// bucketizeAnalysis() applied so byPosition / byPosSeat / mixCells exist.
//
// Returns { metric, aggregate, byPosition, byPlayerCount, byCell, surfaced }
// or null if the aggregate has too few opportunities.
function buildVerdictTree(metric, d, style) {
  if (!d || !d.mixCells) return null;
  var reader = METRIC_READERS[metric];
  if (!reader) return null;
  var minOpps = METRIC_MIN_OPPS[metric] || 10;

  var aggRead = reader(d);
  if (!aggRead || aggRead.opps < minOpps) return null;

  var aggTarget = weightedTarget(metric, d.mixCells, style);
  if (!aggTarget) return null;

  var aggregate = classify(aggRead.rate, aggTarget, metric);
  if (!aggregate) return null;
  aggregate.target = aggTarget;
  aggregate.opps = aggRead.opps;
  aggregate.level = 'aggregate';

  var surfaced = [];

  // Per-position: weight each position's target across its own player-count mix.
  var byPosition = {};
  if (d.byPosition) {
    for (var pos in d.byPosition) {
      var pd = d.byPosition[pos];
      if (pd.gated) continue;
      var pRead = reader(pd);
      if (!pRead || pRead.opps < minOpps) continue;
      var posCells = d.mixCells.filter(function(c) { return c.position === pos; });
      if (!posCells.length) continue;
      var pTarget = weightedTarget(metric, posCells, style);
      if (!pTarget) continue;
      var pVerdict = classify(pRead.rate, pTarget, metric);
      if (!pVerdict) continue;
      pVerdict.target = pTarget;
      pVerdict.opps = pRead.opps;
      pVerdict.hands = pd.n;
      pVerdict.level = 'position';
      pVerdict.position = pos;
      byPosition[pos] = pVerdict;

      if (disagrees(aggregate, pVerdict)) {
        surfaced.push(pVerdict);
      }
    }
  }

  // Per-player-count: weight each seat-count's target across its own position mix.
  var byPlayerCount = {};
  if (d.bySeatBucket) {
    for (var sb in d.bySeatBucket) {
      var sd = d.bySeatBucket[sb];
      if (sd.gated) continue;
      var sRead = reader(sd);
      if (!sRead || sRead.opps < minOpps) continue;
      var seatCells = d.mixCells.filter(function(c) { return c.seatBucket === sb; });
      if (!seatCells.length) continue;
      var sTarget = weightedTarget(metric, seatCells, style);
      if (!sTarget) continue;
      var sVerdict = classify(sRead.rate, sTarget, metric);
      if (!sVerdict) continue;
      sVerdict.target = sTarget;
      sVerdict.opps = sRead.opps;
      sVerdict.hands = sd.n;
      sVerdict.level = 'playerCount';
      sVerdict.seatBucket = sb;
      sVerdict.seats = parseInt(sb, 10);
      byPlayerCount[sb] = sVerdict;

      if (disagrees(aggregate, sVerdict)) {
        surfaced.push(sVerdict);
      }
    }
  }

  // Per-cell: direct matrix lookup, no weighting. Surfaced when the cell
  // disagrees with BOTH its position parent and its player-count parent.
  var byCell = {};
  if (d.byPosSeat) {
    for (var ck in d.byPosSeat) {
      var cd = d.byPosSeat[ck];
      if (cd.gated) continue;
      var cRead = reader(cd);
      if (!cRead || cRead.opps < minOpps) continue;
      var cellParts = ck.split('|');
      var cPos = cellParts[0];
      var cSeatBucket = cellParts[1];
      var cSeats = parseInt(cSeatBucket, 10);
      var cTarget = matrixTarget(metric, cPos, cSeats, style);
      if (!cTarget) continue;
      var cVerdict = classify(cRead.rate, cTarget, metric);
      if (!cVerdict) continue;
      cVerdict.target = cTarget;
      cVerdict.opps = cRead.opps;
      cVerdict.hands = cd.n;
      cVerdict.level = 'cell';
      cVerdict.position = cPos;
      cVerdict.seatBucket = cSeatBucket;
      cVerdict.seats = cSeats;
      byCell[ck] = cVerdict;

      // Cells are computed but no longer surfaced as their own insights;
      // they remain on the tree so panel overviews and tooltips can read
      // the per-cell rate when needed.
    }
  }

  // Aggregate is surfaced unconditionally when it isn't on-target, OR when
  // it's a strength worth highlighting.
  if (aggregate.verdict !== 'on-target') {
    surfaced.unshift(aggregate);
  } else if (surfaced.length > 0) {
    // Aggregate is on-target but children disagree → mention the aggregate
    // anyway as the framing line.
    surfaced.unshift(aggregate);
  }

  return {
    metric: metric,
    aggregate: aggregate,
    byPosition: byPosition,
    byPlayerCount: byPlayerCount,
    byCell: byCell,
    surfaced: surfaced
  };
}

// ── METRIC RULE SPECS ───────────────────────────────────────────────────────
// One spec per matrix-tracked metric. Drives evaluateMetricRules() which
// emits one insight per surfaced verdict.

var METRIC_RULE_SPECS = [
  {
    metric: 'vpip',
    label: 'VPIP',
    panels: ['mygame', 'actions', 'position'],
    tags: ['vpip', 'preflop']
  },
  {
    metric: 'pfr',
    label: 'PFR',
    panels: ['mygame', 'actions', 'position'],
    tags: ['pfr', 'preflop', 'initiative']
  },
  {
    metric: 'af',
    label: 'Aggression',
    panels: ['mygame', 'actions'],
    tags: ['aggression']
  },
  {
    metric: 'cbet',
    label: 'C-Bet',
    panels: ['mygame', 'actions'],
    tags: ['cbet', 'postflop']
  },
  {
    metric: 'foldToRaise',
    label: 'Fold to Raise',
    panels: ['mygame', 'actions'],
    tags: ['fold-pressure', 'postflop']
  }
];

// Map verdict → severity for the existing renderer's color palette.
function _verdictToSev(verdict) {
  if (verdict === 'significant-leak') return 'r';
  if (verdict === 'slight-leak') return 'a';
  if (verdict === 'strength') return 'g';
  return 'g'; // on-target
}

// Phrasing helpers - make verdicts read naturally.
function _verdictWord(verdict, direction) {
  if (verdict === 'on-target') return 'on target';
  if (verdict === 'strength') return 'a strength';
  if (verdict === 'significant-leak') return direction === 'high' ? 'too high' : 'too low';
  if (verdict === 'slight-leak') return direction === 'high' ? 'slightly high' : 'slightly low';
  return verdict;
}

// Headline-style level label. Capitalised where appropriate.
function _levelLabel(v) {
  if (v.level === 'aggregate') return 'Overall';
  if (v.level === 'position') return v.position;
  if (v.level === 'playerCount') return v.seats + '-handed';
  if (v.level === 'cell') return v.position + ' at ' + v.seats + '-handed';
  return v.level;
}

// Title Case-ish descriptive verb form for the headline.
function _verdictHeadlineWord(verdict, direction, metric) {
  if (verdict === 'on-target') return 'On Target';
  if (verdict === 'strength') return 'Strength';
  if (verdict === 'significant-leak' || verdict === 'slight-leak') {
    if (metric === 'vpip' || metric === 'pfr') {
      return direction === 'high' ? 'Loose' : 'Tight';
    }
    if (metric === 'af' || metric === 'cbet') {
      return direction === 'high' ? 'Hyper-Aggressive' : 'Passive';
    }
    if (metric === 'foldToRaise') {
      // STRENGTH_SIDE.foldToRaise is 'low', so a high fold-to-raise rate
      // is the leak (over-folding) and a low rate is the strength side.
      return direction === 'high' ? 'Over-Folds To Pressure' : 'Calls Too Often';
    }
    return direction === 'high' ? 'High' : 'Low';
  }
  return '';
}

function _fmtBand(b) {
  if (!b) return '';
  return Math.round(b.tight) + '-' + Math.round(b.loose) + '%';
}

// Build a headline phrase like "Loose VPIP from UTG" or "Tight PFR Overall".
function _composeLabel(spec, v) {
  var word = _verdictHeadlineWord(v.verdict, v.direction, spec.metric);
  if (v.level === 'aggregate') {
    return word + ' ' + spec.label + ' Overall';
  }
  if (v.level === 'position') {
    return word + ' ' + spec.label + ' from ' + v.position;
  }
  if (v.level === 'playerCount') {
    return word + ' ' + spec.label + ' ' + v.seats + '-handed';
  }
  return word + ' ' + spec.label;
}

function _composeText(spec, v, aggregate) {
  var actual = Math.round(v.actual * 10) / 10;
  var band = _fmtBand(v.target);
  var word = _verdictWord(v.verdict, v.direction);

  if (v.level === 'aggregate') {
    // "Your VPIP is 36%, too high for the games you play (target 18-28%)."
    return 'Your ' + spec.label + ' is ' + actual + '%, ' + word + ' for the games you play (target ' + band + ').';
  }

  if (v.level === 'position') {
    // "From UTG you're at 41% over 552 hands. That's loose against the 15-26% target."
    return 'From ' + v.position + " you're at " + actual + '% over ' + v.hands + ' hands. That\'s ' + word + ' against the ' + band + ' target.';
  }

  if (v.level === 'playerCount') {
    // "At 6-handed tables you're at 32% over 410 hands. That's slightly high against the 22-32% target."
    return 'At ' + v.seats + '-handed tables you\'re at ' + actual + '% over ' + v.hands + ' hands. That\'s ' + word + ' against the ' + band + ' target.';
  }

  // Cell-level no longer produces its own narrative.
  return null;
}

// Score a verdict so the engine can rank insights cross-metric.
function _scoreVerdict(v) {
  var base = 0;
  if (v.verdict === 'significant-leak') base = 30;
  else if (v.verdict === 'slight-leak') base = 15;
  else if (v.verdict === 'strength') base = 10;
  else base = 5;
  // Aggregate matters more than a single cell.
  var levelBoost = v.level === 'aggregate' ? 10 : v.level === 'position' || v.level === 'playerCount' ? 4 : 1;
  // Larger gaps are worth more.
  var gapBoost = Math.min(10, Math.round((v.deltaUnits || 0) * 4));
  return base + levelBoost + gapBoost;
}

// Pull a win rate (percent of hands won) for a level on the verdict tree.
function _winRateForLevel(d, v) {
  if (!d || !v) return null;
  if (v.level === 'aggregate') return d.core ? d.core.wr : null;
  if (v.level === 'position' && d.byPosition && d.byPosition[v.position]) {
    return d.byPosition[v.position].core ? d.byPosition[v.position].core.wr : null;
  }
  if (v.level === 'playerCount' && d.bySeatBucket && d.bySeatBucket[v.seatBucket]) {
    return d.bySeatBucket[v.seatBucket].core ? d.bySeatBucket[v.seatBucket].core.wr : null;
  }
  if (v.level === 'cell' && d.byPosSeat) {
    var key = v.position + '|' + v.seatBucket;
    if (d.byPosSeat[key] && d.byPosSeat[key].core) return d.byPosSeat[key].core.wr;
  }
  return null;
}

// Aggregate win rate across cells where the verdict is on-target / strength,
// vs cells where it's a leak. Returns { onWr, offWr, onN, offN } where
// off-target cells include positions OR seat buckets that disagree.
function _winRateSplit(tree, d) {
  if (!tree) return null;
  var onWr = 0, offWr = 0, onN = 0, offN = 0;
  function classifyAndCount(level, levelMap) {
    if (!levelMap) return;
    for (var k in levelMap) {
      var v = levelMap[k];
      if (!v) continue;
      var subD = level === 'position'
        ? (d.byPosition && d.byPosition[k])
        : (d.bySeatBucket && d.bySeatBucket[k]);
      if (!subD || !subD.core) continue;
      var n = subD.n || 0;
      var wr = subD.core.wr;
      if (wr == null || !n) continue;
      var isOff = v.verdict === 'significant-leak' || v.verdict === 'slight-leak';
      if (isOff) { offWr += wr * n; offN += n; }
      else { onWr += wr * n; onN += n; }
    }
  }
  classifyAndCount('position', tree.byPosition);
  classifyAndCount('playerCount', tree.byPlayerCount);
  return {
    onWr: onN ? onWr / onN : null,
    offWr: offN ? offWr / offN : null,
    onN: onN,
    offN: offN
  };
}

// Compose the multi-clause story for one metric. Threads the aggregate
// position, the per-cell drill-down, and a win-rate cross-reference into one
// short paragraph.
function _composeMetricStory(spec, tree, d) {
  if (!tree) return null;
  var agg = tree.aggregate;
  var aggActual = Math.round(agg.actual * 10) / 10;
  var aggBand = _fmtBand(agg.target);
  var aggWord = _verdictWord(agg.verdict, agg.direction);
  var sentences = [];

  // Sentence 1: the aggregate framing.
  if (agg.verdict === 'on-target') {
    sentences.push('Your overall ' + spec.label + ' is healthy at ' + aggActual + '% (target ' + aggBand + ').');
  } else if (agg.verdict === 'strength') {
    sentences.push('Your overall ' + spec.label + ' is a strength at ' + aggActual + '% (target ' + aggBand + ').');
  } else {
    sentences.push('Your overall ' + spec.label + ' is ' + aggActual + '%, ' + aggWord + ' for the games you play (target ' + aggBand + ').');
  }

  // Sentence 2: drill-down into surfaced child verdicts.
  var children = (tree.surfaced || []).filter(function(v) { return v.level !== 'aggregate'; });
  if (children.length) {
    // Sort by absolute deltaUnits so the worst gap leads.
    children.sort(function(a, b) { return (b.deltaUnits || 0) - (a.deltaUnits || 0); });
    var top = children.slice(0, 2);
    var clause = top.map(function(v) {
      var label = v.level === 'position' ? 'from ' + v.position
        : v.level === 'playerCount' ? 'in ' + v.seats + '-handed games'
        : v.level === 'cell' ? 'from ' + v.position + ' in ' + v.seats + '-handed' : v.level;
      var actual = Math.round(v.actual * 10) / 10;
      var word = _verdictWord(v.verdict, v.direction);
      return label + ' you sit at ' + actual + '% (' + word + ')';
    }).join(', and ');
    var lead = (agg.verdict === 'on-target' || agg.verdict === 'strength') ? 'But ' : 'Specifically, ';
    sentences.push(lead + clause + '.');
  }

  // Sentence 3: win rate cross-reference. Only when we have BOTH a target
  // cell and an off-target cell with hand counts.
  var split = _winRateSplit(tree, d);
  if (split && split.onWr != null && split.offWr != null && Math.abs(split.onWr - split.offWr) >= 4) {
    var diff = Math.round(split.onWr - split.offWr);
    if (diff > 0) {
      sentences.push('Your win rate in cells where ' + spec.label + ' is on target is ' + Math.round(split.onWr) + '%, versus ' + Math.round(split.offWr) + '% where it is off. The gap is roughly ' + diff + ' percentage points.');
    } else if (diff < 0) {
      sentences.push('Your win rate in the off-target cells (' + Math.round(split.offWr) + '%) is actually higher than the on-target ones (' + Math.round(split.onWr) + '%) - worth checking whether the matrix targets fit how you play these spots.');
    }
  }

  return sentences.join(' ');
}

// Build a compact list of cell records to attach to the insight. Consumers
// (panels, future renderers) can use this for tooltips and richer tables.
function _buildCellList(tree, d) {
  var cells = [];
  if (tree.byPosition) {
    for (var pos in tree.byPosition) {
      var pv = tree.byPosition[pos];
      cells.push({
        scope: 'position',
        key: pos,
        value: pv.actual,
        target: pv.target,
        verdict: pv.verdict,
        n: pv.hands,
        winRate: _winRateForLevel(d, pv)
      });
    }
  }
  if (tree.byPlayerCount) {
    for (var sb in tree.byPlayerCount) {
      var sv = tree.byPlayerCount[sb];
      cells.push({
        scope: 'seats',
        key: sb,
        value: sv.actual,
        target: sv.target,
        verdict: sv.verdict,
        n: sv.hands,
        winRate: _winRateForLevel(d, sv)
      });
    }
  }
  return cells;
}

// Aggregate severity for the single-card output. Worst child wins, with the
// aggregate as a floor. Strength is preserved when nothing leaks.
function _overallSev(tree) {
  var ranks = { 'r': 3, 'a': 2, 'g': 1, 'n': 0 };
  var best = _verdictToSev(tree.aggregate.verdict);
  if (tree.byPosition) {
    for (var pos in tree.byPosition) {
      var s = _verdictToSev(tree.byPosition[pos].verdict);
      if ((ranks[s] || 0) > (ranks[best] || 0)) best = s;
    }
  }
  if (tree.byPlayerCount) {
    for (var sb in tree.byPlayerCount) {
      var s2 = _verdictToSev(tree.byPlayerCount[sb].verdict);
      if ((ranks[s2] || 0) > (ranks[best] || 0)) best = s2;
    }
  }
  return best;
}

// Run metric rules and return an array of insight records compatible with the
// existing rule pipeline. Emits ONE insight per metric instead of one per
// surfaced verdict, with multi-clause text covering aggregate, cell drill-down,
// and a win-rate cross-reference.
function evaluateMetricRules(d, hands) {
  var out = [];
  if (!d || !d.mixCells) return out;
  var style = getUserStyle();

  for (var i = 0; i < METRIC_RULE_SPECS.length; i++) {
    var spec = METRIC_RULE_SPECS[i];
    var tree = buildVerdictTree(spec.metric, d, style);
    if (!tree) continue;
    // Skip a metric only when nothing surfaced AND aggregate is on-target.
    var hasChildren = tree.surfaced.some(function(v) { return v.level !== 'aggregate'; });
    if (!hasChildren && tree.aggregate.verdict === 'on-target') continue;

    var sev = _overallSev(tree);
    var story = _composeMetricStory(spec, tree, d);
    if (!story) continue;

    var aggActual = Math.round(tree.aggregate.actual * 10) / 10;
    var label = _composeLabel(spec, tree.aggregate);
    var chips = [{ v: spec.label + ': ' + aggActual + '%', hi: tree.aggregate.verdict !== 'on-target' && tree.aggregate.verdict !== 'strength' }];

    var tags = (spec.tags || []).slice();
    tags.push('metric');
    tags.push('level-aggregate');
    tags.push('verdict-' + tree.aggregate.verdict);
    if (sev === 'r' || sev === 'a') tags.push('leak');
    if (sev === 'g' && tree.aggregate.verdict === 'strength') tags.push('strength');

    var cells = _buildCellList(tree, d);

    out.push({
      id: 'metric-' + spec.metric,
      panels: spec.panels,
      tags: tags,
      sev: sev,
      score: _scoreVerdict(tree.aggregate) + (hasChildren ? 6 : 0),
      label: label,
      text: story,
      chips: chips,
      costBB: null,
      // Finding shape: aggregate + cells + verdict are the new fields. Older
      // consumers ignore them. Newer renderers can use them for cell tables.
      aggregate: {
        value: tree.aggregate.actual,
        target: tree.aggregate.target,
        verdict: tree.aggregate.verdict,
        n: d.n,
        winRate: d.core ? d.core.wr : null
      },
      cells: cells,
      verdict: tree.aggregate.verdict,
      ctx: { metric: spec.metric, tree: tree, style: style },
      _rule: null,
      _hands: hands
    });
  }

  return out;
}
