// ── INSIGHT ENGINE: ORCHESTRATOR ─────────────────────────────────────────────

var InsightEngine = {
  _ruleResults: null,
  _patterns: null,
  _narratives: {},
  _cacheKey: null,

  // Run the full engine. Called once per render, after analyse().
  run: function(d, hands) {
    var key = d.n + ':' + d.handsWon + ':' + d.totalInvested + ':' + hands.length;
    if (this._cacheKey === key) return;
    this._cacheKey = key;

    // Layer 1: evaluate rules
    this._ruleResults = evaluateRules(d, hands);

    // Layer 2: detect patterns (only if enough hands)
    this._patterns = d.n >= 40 ? detectPatterns(d, hands) : [];

    // Clear narrative cache for fresh build
    this._narratives = {};
  },

  // Get combined insights (rules + patterns) for a panel
  forPanel: function(panelName, maxCount) {
    var ruleIns = getInsightsForPanel(this._ruleResults || [], panelName, null);
    var patternIns = getInsightsForPanel(this._patterns || [], panelName, null);

    // Merge and re-sort
    var all = ruleIns.concat(patternIns);
    all.sort(function(a, b) { return b.score - a.score; });

    if (maxCount && all.length > maxCount) {
      all = all.slice(0, maxCount);
    }
    return all;
  },

  // Get narrative for a panel (builds on first call, caches)
  narrativeFor: function(panelName, maxInsights) {
    if (this._narratives[panelName]) return this._narratives[panelName];
    var insights = this.forPanel(panelName, maxInsights || 8);
    var narrative = buildNarrative(insights, panelName);
    this._narratives[panelName] = narrative;
    return narrative;
  },

  // Render engine insights as HTML for a panel
  renderForPanel: function(panelName, maxCount) {
    var insights = this.forPanel(panelName, maxCount || 6);
    if (!insights.length) return '';

    var html = '';

    // Narrative paragraph (if enough insights to be useful)
    var narr = this.narrativeFor(panelName);
    if (narr && narr.narrative && insights.length >= 2) {
      html += '<div class="engine-narrative">' + narr.narrative + '</div>';
    }

    // Individual insight cards
    html += '<div class="ins-grid">';
    for (var i = 0; i < insights.length; i++) {
      html += renderRuleInsight(insights[i]);
    }
    html += '</div>';

    return html;
  }
};
