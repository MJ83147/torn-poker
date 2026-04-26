// ── PANEL OVERVIEW REGISTRY ──────────────────────────────────────────────────
// Per-panel composer functions. Each one reads the top insights routed to its
// panel and returns a 2-3 sentence overview block that sits above the
// narrative paragraph and insight cards.
//
// Format guideline:
//   1. What the player does (most important pattern).
//   2. Where to be careful (highest-cost leak or context the user might miss).
//   3. Optional strength worth keeping.
//
// No template phrases. Each composer is bespoke.

// ── helpers ────────────────────────────────────────────────────────────────

function _ovHasTag(ins, tag) {
  return ins && ins.tags && ins.tags.indexOf(tag) >= 0;
}
function _ovTopWith(insights, predicate) {
  for (var i = 0; i < insights.length; i++) {
    if (predicate(insights[i])) return insights[i];
  }
  return null;
}
function _ovLeaks(insights) {
  return insights.filter(function(i) { return i.sev === 'r' || i.sev === 'a'; });
}
function _ovStrengths(insights) {
  return insights.filter(function(i) { return i.sev === 'g' && _ovHasTag(i, 'metric'); });
}
function _ovRate(ins) {
  var v = ins && ins.ctx && ins.ctx.verdict;
  if (!v) return null;
  return Math.round((v.actual || 0) * 10) / 10;
}
function _ovTargetStr(ins) {
  var v = ins && ins.ctx && ins.ctx.verdict;
  if (!v || !v.target) return null;
  return Math.round(v.target.tight) + '-' + Math.round(v.target.loose) + '%';
}
function _ovDirection(ins) {
  var v = ins && ins.ctx && ins.ctx.verdict;
  return v ? v.direction : null;
}
function _ovMetric(ins) {
  if (!ins || !ins.tags) return null;
  var tags = ['vpip', 'pfr', 'af', 'cbet', 'foldToRaise'];
  for (var k = 0; k < tags.length; k++) {
    if (ins.tags.indexOf(tags[k]) >= 0) return tags[k];
  }
  return null;
}
function _ovTopLeak(insights) {
  return _ovLeaks(insights)[0] || null;
}
function _ovTopMetricLeak(insights, metric) {
  return _ovTopWith(insights, function(i) {
    return _ovHasTag(i, 'metric') && _ovHasTag(i, metric) && (i.sev === 'r' || i.sev === 'a');
  });
}

// ── PER-PANEL COMPOSERS ────────────────────────────────────────────────────

var PANEL_OVERVIEWS = {

  mygame: function(insights, d) {
    var vpipLeak = _ovTopMetricLeak(insights, 'vpip');
    var afLeak = _ovTopMetricLeak(insights, 'af');
    var pfrLeak = _ovTopMetricLeak(insights, 'pfr');
    var topStrength = _ovStrengths(insights)[0];

    var parts = [];
    if (vpipLeak) {
      var v = _ovRate(vpipLeak), t = _ovTargetStr(vpipLeak);
      parts.push('Across ' + (d && d.n ? d.n + ' hands ' : '') + 'your VPIP is ' + v + '%, ' + (_ovDirection(vpipLeak) === 'high' ? 'wider than' : 'tighter than') + ' the ' + t + ' target for the games you play.');
    } else if (afLeak) {
      var av = _ovRate(afLeak), at = _ovTargetStr(afLeak);
      parts.push('Aggression sits at ' + av + '% over your sample, ' + (_ovDirection(afLeak) === 'high' ? 'above' : 'below') + ' the ' + at + ' band.');
    }
    if (pfrLeak && pfrLeak !== vpipLeak) {
      parts.push('Watch your PFR too: ' + _ovRate(pfrLeak) + '% reads as ' + (_ovDirection(pfrLeak) === 'high' ? 'over-raising' : 'under-raising') + ' against the ' + _ovTargetStr(pfrLeak) + ' target.');
    } else if (afLeak && afLeak !== vpipLeak && vpipLeak) {
      parts.push('Aggression at ' + _ovRate(afLeak) + '% is the second thing to watch.');
    }
    if (topStrength) {
      parts.push('Keep what works: ' + (topStrength.label || 'the verdict above') + ' is in good shape.');
    }
    return parts.length ? parts.join(' ') : null;
  },

  position: function(insights, d) {
    var perPos = insights.filter(function(i) { return _ovHasTag(i, 'level-position') && (i.sev === 'r' || i.sev === 'a'); });
    if (!perPos.length) {
      var aggLeak = _ovTopWith(insights, function(i) { return _ovHasTag(i, 'level-aggregate') && (i.sev === 'r' || i.sev === 'a'); });
      if (aggLeak) {
        return 'Position-by-position your numbers track your overall play. The biggest gap is ' + (aggLeak.label || aggLeak.text) + '.';
      }
      return null;
    }
    var worst = perPos[0];
    var v = worst.ctx && worst.ctx.verdict;
    var pos = v && v.position ? v.position : 'one seat';
    var lines = [
      pos + ' is the seat that pulls your stats furthest from target: ' + (worst.label || '').toLowerCase() + '.'
    ];
    if (perPos.length > 1) {
      var second = perPos[1];
      var sv = second.ctx && second.ctx.verdict;
      lines.push((sv && sv.position ? sv.position : 'Another seat') + ' shows the same pattern at ' + _ovRate(second) + '% vs the ' + _ovTargetStr(second) + ' target.');
    } else {
      lines.push('Other seats are inside their bands - the leak is concentrated, not global.');
    }
    return lines.join(' ');
  },

  actions: function(insights, d) {
    var afL = _ovTopMetricLeak(insights, 'af');
    var cbetL = _ovTopMetricLeak(insights, 'cbet');
    var ftrL = _ovTopMetricLeak(insights, 'foldToRaise');
    var parts = [];

    if (afL) {
      parts.push('Aggression factor of ' + _ovRate(afL) + '% sits ' + (_ovDirection(afL) === 'high' ? 'above' : 'below') + ' the ' + _ovTargetStr(afL) + ' band - your bet/raise vs check/call mix needs adjusting.');
    } else if (cbetL) {
      parts.push('Your c-bet rate is ' + _ovRate(cbetL) + '% against a target of ' + _ovTargetStr(cbetL) + '.');
    }
    if (ftrL) {
      parts.push('When facing a raise you fold ' + _ovRate(ftrL) + '% of the time, ' + (_ovDirection(ftrL) === 'high' ? 'too eager to give up' : 'sticky against pressure') + '.');
    } else if (cbetL && afL) {
      parts.push('C-bet at ' + _ovRate(cbetL) + '% is the next thing to bring in line.');
    }
    var strength = _ovStrengths(insights)[0];
    if (strength) parts.push((strength.label || 'One action stat') + ' is on the right side of the band.');
    return parts.length ? parts.join(' ') : null;
  },

  cards: function(insights, d) {
    // Cards panel insights are usually pattern-tagged or hand-class specific.
    var topLeak = _ovTopLeak(insights);
    var topPattern = _ovTopWith(insights, function(i) { return _ovHasTag(i, 'pattern'); });
    var parts = [];
    if (topLeak) parts.push((topLeak.label || 'A hand-class leak') + ' is the headline: ' + (topLeak.text || '').split('.')[0] + '.');
    if (topPattern && topPattern !== topLeak) parts.push((topPattern.label || 'A pattern') + ' shows up across hand types.');
    if (!parts.length) return null;
    parts.push('Use the grid below to see exactly which combos drive these numbers.');
    return parts.join(' ');
  },

  street: function(insights, d) {
    var cbetL = _ovTopMetricLeak(insights, 'cbet');
    var topLeak = _ovTopLeak(insights);
    var parts = [];
    if (cbetL) {
      parts.push('On the flop your c-bet runs at ' + _ovRate(cbetL) + '% - target is ' + _ovTargetStr(cbetL) + '. ' + (_ovDirection(cbetL) === 'high' ? 'You are barreling too often, your range is unbalanced.' : 'You are giving up too easily after raising preflop.'));
    } else if (topLeak) {
      parts.push((topLeak.label || 'Street action') + ': ' + (topLeak.text || '').split('.')[0] + '.');
    }
    var ftrL = _ovTopMetricLeak(insights, 'foldToRaise');
    if (ftrL) {
      parts.push('Facing flop/turn raises you fold ' + _ovRate(ftrL) + '% - the gap to the ' + _ovTargetStr(ftrL) + ' target is where chips disappear.');
    }
    return parts.length ? parts.join(' ') : null;
  },

  range: function(insights, d) {
    var vpipL = _ovTopMetricLeak(insights, 'vpip');
    var pfrL = _ovTopMetricLeak(insights, 'pfr');
    var parts = [];
    if (vpipL) {
      parts.push('Your range opens at ' + _ovRate(vpipL) + '% VPIP versus a ' + _ovTargetStr(vpipL) + ' target - the grid below shows which combos to drop or add.');
    }
    if (pfrL && pfrL !== vpipL) {
      parts.push('PFR ' + _ovRate(pfrL) + '% means the raise/call mix inside your range is ' + (_ovDirection(pfrL) === 'high' ? 'over-raising hands you should flat' : 'flatting hands you should raise') + '.');
    }
    if (!parts.length) return null;
    return parts.join(' ');
  },

  tables: function(insights, d) {
    var perSeat = insights.filter(function(i) { return _ovHasTag(i, 'level-playerCount') && (i.sev === 'r' || i.sev === 'a'); });
    if (!perSeat.length) {
      var generic = _ovTopLeak(insights);
      return generic ? 'Across table sizes, ' + (generic.text || '').split('.')[0] + '.' : null;
    }
    var worst = perSeat[0];
    var v = worst.ctx && worst.ctx.verdict;
    var seats = v && v.seats ? v.seats + '-handed' : 'one table size';
    var lines = [seats + ' is where your numbers move furthest from target.'];
    if (perSeat.length > 1) {
      var second = perSeat[1];
      var sv = second.ctx && second.ctx.verdict;
      lines.push((sv && sv.seats ? sv.seats + '-handed' : 'Another size') + ' looks similar - the issue is broader than one game shape.');
    } else {
      lines.push('Other table sizes look fine - this is a per-shape leak, not a global one.');
    }
    return lines.join(' ');
  },

  trends: function(insights, d) {
    var topLeak = _ovTopLeak(insights);
    var topStrength = _ovStrengths(insights)[0];
    var parts = [];
    if (topLeak) parts.push('Session-over-session, the trend that matters: ' + (topLeak.label || 'a recurring leak').toLowerCase() + '.');
    if (topStrength) parts.push('On the upside, ' + (topStrength.label || 'one stat').toLowerCase() + ' has held up across recent sessions.');
    if (!parts.length) return null;
    parts.push('The line charts below show whether each metric is drifting or steady.');
    return parts.join(' ');
  },

  showdown: function(insights, d) {
    var topLeak = _ovTopLeak(insights);
    var ftrL = _ovTopMetricLeak(insights, 'foldToRaise');
    var parts = [];
    if (topLeak) parts.push('At showdown the standout: ' + (topLeak.label || '').toLowerCase() + '.');
    if (ftrL) parts.push('Fold-to-raise at ' + _ovRate(ftrL) + '% means you ' + (_ovDirection(ftrL) === 'high' ? 'fold off marginal showdowns too readily' : 'pay off too often when you should fold') + '.');
    return parts.length ? parts.join(' ') : null;
  },

  allin: function(insights, d) {
    var topLeak = _ovTopLeak(insights);
    if (!topLeak) return null;
    return 'All-in spots are where variance is loudest. ' + (topLeak.text || '').split('.')[0] + '. The chart compares your equity at all-in to the actual outcomes.';
  },

  players: function(insights, d) {
    var topLeak = _ovTopLeak(insights);
    if (!topLeak) {
      return 'Per-opponent records below. Star players you want to track session-to-session.';
    }
    return 'Against the field your pattern shows up here too: ' + (topLeak.label || '').toLowerCase() + '. Click any opponent row to see the shared hands and how each one played.';
  },

  leaks: function(insights, d) {
    var leaks = _ovLeaks(insights);
    if (!leaks.length) return null;
    var top = leaks[0];
    var second = leaks[1];
    var parts = ['Top leak: ' + (top.label || '').toLowerCase() + '.'];
    if (second) parts.push('Second: ' + (second.label || '').toLowerCase() + '.');
    parts.push('Fix these in order - the cards below show exact cost and example hands.');
    return parts.join(' ');
  },

  compare: function(insights, d) {
    var topLeak = _ovTopLeak(insights);
    if (!topLeak) return 'Side-by-side stats versus benchmark targets. Use this view to see how far each metric sits from where it should be.';
    return 'The biggest gap from target is ' + (topLeak.label || 'a metric leak').toLowerCase() + '. Everything else trails behind that one.';
  }
};

// Public: dispatch to the registered composer for a panel name.
function composeOverview(panelName, insights, d) {
  if (!panelName || !insights) return null;
  var fn = PANEL_OVERVIEWS[panelName];
  if (typeof fn !== 'function') return null;
  try {
    return fn(insights, d) || null;
  } catch (_) {
    return null;
  }
}
