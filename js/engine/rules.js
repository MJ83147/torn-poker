// ── INSIGHT ENGINE: LAYER 1 - RULE COMBINATOR ────────────────────────────────
//
// Insight result shape (returned by evaluateRules and consumed by panels and
// renderRuleInsight):
//   {
//     id: string,                          // rule id (e.g. 'cbet-low')
//     panels: string[],                    // panels this insight surfaces in
//     tags: string[],                      // tags (e.g. 'metric', 'pattern')
//     sev: 'r'|'a'|'g'|'o'|'n',            // severity colour
//     score: number,                       // sort weight
//     label: string,                       // short headline
//     text: string,                        // body copy
//     chips: { v: string, hi?: bool }[],   // optional metric chips
//     costBB: number|null,                 // estimated cost in BB
//     ctx: object,                         // rule-specific free-form context
//     _rule: Rule,                         // back-reference to defining rule
//     _hands: Hand[]                       // hands the rule ran against
//   }
// IMPORTANT: insight renderers must guard optional fields. renderRuleInsight
// has had regressions where _rule.examples was assumed to exist on every
// result. Always check before dereferencing.

var INSIGHT_RULES = [];

function defineRule(rule) {
  INSIGHT_RULES.push(rule);
}

// Evaluate all rules against the current data.
// Returns Insight[] (shape documented at the top of this file).
function evaluateRules(d, hands) {
  var results = [];

  for (var i = 0; i < INSIGHT_RULES.length; i++) {
    var rule = INSIGHT_RULES[i];

    // Gate on minimum sample sizes
    var skip = false;
    if (rule.minSample) {
      for (var key in rule.minSample) {
        var val = key.indexOf('.') !== -1
          ? key.split('.').reduce(function(o, k) { return o && o[k]; }, d)
          : d[key];
        if (val === undefined || val === null || val < rule.minSample[key]) {
          skip = true;
          break;
        }
      }
    }
    if (skip) continue;

    // Run the test
    var ctx;
    try { ctx = rule.test(d, hands); } catch (_) { ctx = null; }
    if (ctx === null || ctx === undefined) continue;

    // Compute derived fields
    var severity = typeof rule.sev === 'function' ? rule.sev(ctx) : rule.sev;
    var score = typeof rule.score === 'function' ? rule.score(ctx) : (rule.score || 0);
    var label = typeof rule.label === 'function' ? rule.label(ctx) : rule.label;
    var text = typeof rule.text === 'function' ? rule.text(ctx) : rule.text;
    var chips = typeof rule.chips === 'function' ? rule.chips(ctx) : (rule.chips || []);
    var costBB = rule.costBB ? (typeof rule.costBB === 'function' ? rule.costBB(ctx) : rule.costBB) : null;

    results.push({
      id: rule.id,
      panels: rule.panels,
      tags: rule.tags || [],
      sev: severity,
      score: score,
      label: label,
      text: text,
      chips: chips,
      costBB: costBB,
      ctx: ctx,
      _rule: rule,
      _hands: hands
    });
  }

  // Layered metric rules: each emits one insight per surfaced verdict from
  // the verdict tree. Runs alongside the legacy rules above; existing rules
  // continue to fire during the retrofit transition.
  if (typeof evaluateMetricRules === 'function') {
    var metricInsights = evaluateMetricRules(d, hands);
    for (var mi = 0; mi < metricInsights.length; mi++) {
      results.push(metricInsights[mi]);
    }
  }

  results.sort(function(a, b) { return b.score - a.score; });
  return results;
}

// Get insights for a specific panel, optionally limited
function getInsightsForPanel(results, panelName, maxCount) {
  var filtered = [];
  for (var i = 0; i < results.length; i++) {
    if (results[i].panels.indexOf(panelName) !== -1) {
      filtered.push(results[i]);
    }
  }
  if (maxCount && filtered.length > maxCount) {
    filtered = filtered.slice(0, maxCount);
  }
  return filtered;
}

// Render a rule result into ins() HTML
// Render one Insight as HTML. Defensive about missing fields - if the result
// is malformed (no severity, no label, no text), it skips the card and logs
// a console warning rather than crashing the whole panel.
function renderRuleInsight(result) {
  if (!result || !result.sev || !result.label || typeof result.text !== 'string') {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('renderRuleInsight: skipping malformed insight', result);
    }
    return '';
  }
  var rule = result._rule;
  if (rule && rule.examples && result._hands) {
    var exHands;
    try { exHands = rule.examples(result.ctx, result._hands); } catch (_) { exHands = []; }
    if (exHands && exHands.length) {
      return insWithExample(result.sev, result.label, result.text, result.chips, exHands, rule.coaching || '');
    }
  }
  return ins(result.sev, result.label, result.text, result.chips);
}
