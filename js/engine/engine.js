// ── INSIGHT ENGINE: ORCHESTRATOR ─────────────────────────────────────────────

var InsightEngine = {
  _ruleResults: null,
  _patterns: null,
  _cacheKey: null,

  // Run the full engine. Called once per render, after analyse().
  run: function(d, hands) {
    var key = d.n + ':' + d.handsWon + ':' + d.totalInvested + ':' + hands.length;
    if (this._cacheKey === key) return;
    this._cacheKey = key;

    this._ruleResults = evaluateRules(d, hands);
    this._patterns = d.n >= 40 ? detectPatterns(d, hands) : [];
  },

  // Get combined insights (rules + patterns) for a panel
  forPanel: function(panelName, maxCount) {
    var ruleIns = getInsightsForPanel(this._ruleResults || [], panelName, null);
    var patternIns = getInsightsForPanel(this._patterns || [], panelName, null);

    // Merge metric findings: collapse multi-axis verdicts on the same metric
    // into a single primary card with secondary findings attached.
    ruleIns = mergeMetricFindings(ruleIns);

    var all = ruleIns.concat(patternIns);
    all.sort(function(a, b) { return b.score - a.score; });

    if (maxCount && all.length > maxCount) {
      all = all.slice(0, maxCount);
    }
    return all;
  }
};

// ── METRIC INSIGHT MERGE ─────────────────────────────────────────────────────
// Layered verdict-tree insights are tagged with a `metric` tag plus a primary
// metric tag (vpip/pfr/af/cbet/foldToRaise). When several agree on the same
// direction (both leaks of the same severity), collapse them into a single
// primary card with the others tucked onto _secondaryFindings. Bespoke
// rule-based insights (no `metric` tag) pass through untouched.
function mergeMetricFindings(insights) {
  if (!insights || !insights.length) return insights || [];

  var METRIC_TAGS = ['vpip', 'pfr', 'af', 'cbet', 'foldToRaise'];

  function _hasTag(ins, tag) {
    return ins && ins.tags && ins.tags.indexOf(tag) >= 0;
  }
  function _primaryMetricTag(ins) {
    for (var k = 0; k < METRIC_TAGS.length; k++) {
      if (_hasTag(ins, METRIC_TAGS[k])) return METRIC_TAGS[k];
    }
    return null;
  }
  function _verdictTag(ins) {
    if (_hasTag(ins, 'verdict-significant-leak')) return 'verdict-significant-leak';
    if (_hasTag(ins, 'verdict-slight-leak')) return 'verdict-slight-leak';
    if (_hasTag(ins, 'verdict-strength')) return 'verdict-strength';
    if (_hasTag(ins, 'verdict-on-target')) return 'verdict-on-target';
    return null;
  }
  function _secondaryRecord(ins) {
    var v = ins.ctx && ins.ctx.verdict;
    if (!v) return null;
    return {
      level: v.level,
      position: v.position || null,
      seats: v.seats || null,
      rate: Math.round((v.actual || 0) * 10) / 10,
      target: v.target ? {
        tight: Math.round(v.target.tight),
        ideal: Math.round(v.target.ideal),
        loose: Math.round(v.target.loose)
      } : null,
      hands: v.hands || null
    };
  }

  // Group only metric-tree insights; non-metric pass straight through.
  var metricGroups = {};
  var passthrough = [];

  for (var i = 0; i < insights.length; i++) {
    var ins = insights[i];
    if (!_hasTag(ins, 'metric')) { passthrough.push(ins); continue; }
    var metric = _primaryMetricTag(ins);
    var verdict = _verdictTag(ins);
    if (!metric || !verdict) { passthrough.push(ins); continue; }

    var groupKey = metric + '|' + verdict;
    if (!metricGroups[groupKey]) metricGroups[groupKey] = [];
    metricGroups[groupKey].push(ins);
  }

  var merged = [];
  for (var key in metricGroups) {
    var group = metricGroups[key];
    if (group.length === 1) {
      merged.push(group[0]);
      continue;
    }
    // Pick highest score as primary; others become _secondaryFindings.
    group.sort(function(a, b) { return b.score - a.score; });
    var primary = group[0];
    var secondaries = [];
    for (var s = 1; s < group.length; s++) {
      var rec = _secondaryRecord(group[s]);
      if (rec) secondaries.push(rec);
    }
    primary._secondaryFindings = secondaries;
    merged.push(primary);
  }

  return passthrough.concat(merged);
}
