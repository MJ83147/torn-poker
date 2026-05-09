// ── INSIGHT ENGINE: LAYER 3 - NARRATIVE BUILDER ─────────────────────────────

var CONTRADICTION_PAIRS = [
  {
    matchA: function(i) { return i.tags.indexOf('aggression') >= 0 && i.sev === 'g'; },
    matchB: function(i) { return i.tags.indexOf('fold-pressure') >= 0 && (i.sev === 'r' || i.sev === 'a'); },
    explanation: 'Your aggression evaporates under pressure. You bet and raise proactively, but fold when opponents push back.'
  },
  {
    matchA: function(i) { return i.tags.indexOf('cbet') >= 0 && i.sev === 'g'; },
    matchB: function(i) { return i.tags.indexOf('cbet-fold') >= 0 && (i.sev === 'r' || i.sev === 'a'); },
    explanation: 'You c-bet frequently but fold when raised. Opponents can raise your c-bets profitably with any two cards.'
  },
  {
    matchA: function(i) { return i.tags.indexOf('tight-ep') >= 0 && i.sev === 'g'; },
    matchB: function(i) { return i.tags.indexOf('loose') >= 0 && (i.sev === 'r' || i.sev === 'a'); },
    explanation: 'You play tight from early position but too loose overall. Check if late position ranges are getting out of hand.'
  },
  {
    matchA: function(i) { return i.tags.indexOf('pfr') >= 0 && i.sev === 'g'; },
    matchB: function(i) { return i.tags.indexOf('passive') >= 0 && (i.sev === 'r' || i.sev === 'a'); },
    explanation: 'You raise preflop but play passively postflop. Following through after the flop is critical.'
  },
  {
    matchA: function(i) { return i.tags.indexOf('vpip') >= 0 && i.sev === 'g'; },
    matchB: function(i) { return i.tags.indexOf('postflop') >= 0 && i.tags.indexOf('passive') >= 0 && (i.sev === 'r' || i.sev === 'a'); },
    explanation: 'Your preflop hand selection is good, but the play loses momentum after the flop. Carry the same intent into postflop streets.'
  },
  {
    matchA: function(i) { return i.tags.indexOf('strength') >= 0 && i.tags.indexOf('preflop') >= 0; },
    matchB: function(i) { return i.tags.indexOf('missed-value') >= 0 && (i.sev === 'r' || i.sev === 'a'); },
    explanation: 'Strong preflop selection paired with passive river play. You are getting to good spots and then not betting them.'
  },
  {
    matchA: function(i) { return i.tags.indexOf('cross-metric') >= 0 && i.id === 'calling-station-pattern'; },
    matchB: function(i) { return i.tags.indexOf('vpip') >= 0 && i.tags.indexOf('strength') >= 0; },
    explanation: 'Your VPIP at table level is in target, but the cross-metric mix still looks like a station. Look at which positions and table sizes are pulling the average up.'
  },
  {
    matchA: function(i) { return i.tags.indexOf('cross-metric') >= 0 && i.id === 'bluff-happy-pattern'; },
    matchB: function(i) { return i.tags.indexOf('aggression') >= 0 && i.tags.indexOf('strength') >= 0; },
    explanation: 'Aggression looks like a strength on its own, but combined with a low fold-to-raise it reads as bluff-happy. The story changes when both metrics are seen together.'
  }
];

var CHAIN_RULES = [
  {
    fromTag: 'limp',
    toTag: 'initiative',
    text: 'Limping too much kills your preflop initiative, which cascades into weaker post-flop play.'
  },
  {
    fromTag: 'loose',
    toTag: 'flop-fold',
    text: 'Playing too many hands preflop forces flop folds, bleeding chips on hands you should never have entered.'
  },
  {
    fromTag: 'passive',
    toTag: 'missed-value',
    text: 'Passive play means missed value bets. You win the hand but leave money on the table.'
  },
  {
    fromTag: 'cbet-fold',
    toTag: 'fold-pressure',
    text: 'Folding to aggression after c-betting lets opponents exploit your one-and-done pattern.'
  },
  {
    fromTag: 'loose-ep',
    toTag: 'flop-fold',
    text: 'Wide early-position opens lead to postflop folds when you miss, the worst combination for your stack.'
  },
  {
    fromTag: 'donk',
    toTag: 'fold-pressure',
    text: 'Donk-betting into the preflop raiser then folding when raised back is the worst combination - you give up your range advantage and pay it off.'
  },
  {
    fromTag: 'wet-board',
    toTag: 'missed-value',
    text: 'Passive play on coordinated boards lets free turns and rivers come for opponents on draws. Bet to charge them.'
  },
  {
    fromTag: '3bet',
    toTag: 'fold-pressure',
    text: 'Folding too often to 3-bets pairs with fold-to-pressure leaks - opponents see they can attack your opens with light 3-bets.'
  }
];

function findContradictions(insights) {
  var contradictions = [];
  for (var ci = 0; ci < CONTRADICTION_PAIRS.length; ci++) {
    var pair = CONTRADICTION_PAIRS[ci];
    var matchA = null, matchB = null;

    for (var i = 0; i < insights.length; i++) {
      if (!matchA && pair.matchA(insights[i])) matchA = insights[i];
      if (!matchB && pair.matchB(insights[i])) matchB = insights[i];
    }

    if (matchA && matchB && matchA !== matchB) {
      contradictions.push({
        a: matchA,
        b: matchB,
        explanation: pair.explanation
      });
    }
  }
  return contradictions;
}

function findChains(insights) {
  var chains = [];
  for (var ci = 0; ci < CHAIN_RULES.length; ci++) {
    var chain = CHAIN_RULES[ci];
    var fromMatch = null, toMatch = null;

    for (var i = 0; i < insights.length; i++) {
      if (!fromMatch && insights[i].tags.indexOf(chain.fromTag) >= 0 && insights[i].sev !== 'g') fromMatch = insights[i];
      if (!toMatch && insights[i].tags.indexOf(chain.toTag) >= 0 && insights[i].sev !== 'g') toMatch = insights[i];
    }

    if (fromMatch && toMatch && fromMatch !== toMatch) {
      chains.push({
        from: fromMatch,
        to: toMatch,
        costBB: (fromMatch.costBB || 0) + (toMatch.costBB || 0),
        text: chain.text
      });
    }
  }
  return chains;
}

function abbreviate(text, maxLen) {
  if (!text || text.length <= maxLen) return text;
  var cut = text.lastIndexOf(' ', maxLen);
  if (cut < maxLen * 0.5) cut = maxLen;
  return text.slice(0, cut) + '\u2026';
}

// Detect metric-rule insights produced by evaluateMetricRules() - they carry
// the 'metric' tag plus a level-* tag.
function _isMetricInsight(i) {
  return i && i.tags && i.tags.indexOf('metric') >= 0;
}

function _hasLevelTag(i, level) {
  return i && i.tags && i.tags.indexOf('level-' + level) >= 0;
}

// Returns null if there are no insights, otherwise:
//   {
//     narrative: string,            // joined sentence string for the panel
//     cards: Insight[],             // top 12 input insights (unchanged)
//     contradictions: object[],     // see findContradictions() output
//     chains: object[]              // see findChains() output
//   }
// Callers must access result.narrative (not result directly). The Betting
// panel had a bug where it printed "[object Object]" because it used the
// whole return value where it meant .narrative.
function buildNarrative(panelInsights, panelName) {
  if (!panelInsights || !panelInsights.length) return null;

  var topInsights = panelInsights.slice(0, 12);

  // Separate by severity
  var leaks = topInsights.filter(function(i) { return i.sev === 'r' || i.sev === 'a'; });
  var strengths = topInsights.filter(function(i) { return i.sev === 'g'; });
  var patterns = topInsights.filter(function(i) { return i.tags && i.tags.indexOf('pattern') >= 0; });

  // Layered metric insights split by level - used to thread mix-aware
  // language through the narrative.
  var metricInsights = topInsights.filter(_isMetricInsight);
  var aggregateMetrics = metricInsights.filter(function(i) { return _hasLevelTag(i, 'aggregate'); });
  var childMetrics = metricInsights.filter(function(i) { return !_hasLevelTag(i, 'aggregate'); });

  var contradictions = findContradictions(topInsights);
  var chains = findChains(topInsights);

  var sentences = [];

  // Lead with the most important aggregate metric verdict if one exists -
  // it sets the framing the disagreement lines hang off of.
  var leadMetric = null;
  if (aggregateMetrics.length > 0) {
    leadMetric = aggregateMetrics[0];
    sentences.push(abbreviate(leadMetric.text, 160));
  } else if (leaks.length > 0) {
    sentences.push(abbreviate(leaks[0].text, 140));
  } else if (strengths.length > 0) {
    sentences.push(abbreviate(strengths[0].text, 140));
  }

  // Drill into the highest-scoring per-axis or per-cell disagreement so the
  // reader sees where the deeper level departs from the broader picture.
  if (childMetrics.length > 0) {
    var lead = childMetrics[0];
    if (lead !== leadMetric) sentences.push(abbreviate(lead.text, 160));
  }

  // Style note when the user has chosen a non-TAG target style.
  if (typeof getUserStyle === 'function') {
    var style = getUserStyle();
    if (style && style !== 'TAG' && metricInsights.length > 0) {
      sentences.push('Targets reflect a ' + style + ' game plan.');
    }
  }

  // Chain finding (causal connective tissue).
  if (chains.length > 0) {
    var chain = chains[0];
    var chainText = chain.text;
    if (chain.costBB > 0) chainText += ' Estimated cost: ~' + chain.costBB + ' BB.';
    sentences.push(chainText);
  }

  // Contradiction finding.
  if (contradictions.length > 0) {
    sentences.push(contradictions[0].explanation);
  }

  // A pattern discovery if there's still room.
  if (sentences.length < 4 && patterns.length > 0) {
    sentences.push(abbreviate(patterns[0].text, 120));
  }

  // Fall back to a non-metric leak if we somehow have no sentences yet.
  if (sentences.length === 0 && leaks.length > 0) {
    sentences.push(abbreviate(leaks[0].text, 140));
  }

  return {
    narrative: sentences.join(' '),
    cards: topInsights,
    contradictions: contradictions,
    chains: chains
  };
}
