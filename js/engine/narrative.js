// ── INSIGHT ENGINE: LAYER 3 — NARRATIVE BUILDER ─────────────────────────────

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
    text: 'Passive play means missed value bets \u2014 you win the hand but leave money on the table.'
  },
  {
    fromTag: 'cbet-fold',
    toTag: 'fold-pressure',
    text: 'Folding to aggression after c-betting lets opponents exploit your one-and-done pattern.'
  },
  {
    fromTag: 'loose-ep',
    toTag: 'flop-fold',
    text: 'Wide early-position opens lead to postflop folds when you miss \u2014 the worst combination for your stack.'
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

function buildNarrative(panelInsights, panelName) {
  if (!panelInsights || !panelInsights.length) return null;

  var topInsights = panelInsights.slice(0, 8);

  // Separate by severity
  var leaks = topInsights.filter(function(i) { return i.sev === 'r' || i.sev === 'a'; });
  var strengths = topInsights.filter(function(i) { return i.sev === 'g'; });
  var patterns = topInsights.filter(function(i) { return i.tags && i.tags.indexOf('pattern') >= 0; });

  var contradictions = findContradictions(topInsights);
  var chains = findChains(topInsights);

  var sentences = [];

  // Lead with the biggest finding
  if (leaks.length > 0) {
    var lead = leaks[0];
    sentences.push(abbreviate(lead.text, 120));
  } else if (strengths.length > 0) {
    sentences.push(abbreviate(strengths[0].text, 120));
  }

  // Add chain if found
  if (chains.length > 0) {
    var chain = chains[0];
    var chainText = chain.text;
    if (chain.costBB > 0) chainText += ' Estimated cost: ~' + chain.costBB + ' BB.';
    sentences.push(chainText);
  }

  // Add contradiction if found
  if (contradictions.length > 0) {
    sentences.push(contradictions[0].explanation);
  }

  // Add a pattern discovery if present and we have room
  if (sentences.length < 3 && patterns.length > 0) {
    sentences.push(abbreviate(patterns[0].text, 100));
  }

  // If only strengths and we have room
  if (sentences.length < 2 && strengths.length > 1) {
    sentences.push(abbreviate(strengths[1].text, 100));
  }

  return {
    narrative: sentences.join(' '),
    cards: topInsights,
    contradictions: contradictions,
    chains: chains
  };
}
