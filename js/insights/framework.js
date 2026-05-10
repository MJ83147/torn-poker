// ── INSIGHT FRAMEWORK ─────────────────────────────────────────────────────────
//
// One central registry of stories. Each story is registered via defineStory.
// When the runner evaluates them, each story produces (or stays silent based on
// four conditional gates) a finding with the four-clause text:
//   1. Behaviour: what the player does, with the number.
//   2. Implication: what that means in plain English.
//   3. Context: where the leak shows up most (cell drill-down).
//   4. Advice: what to do about it.
//   5. Win-rate trailer (optional): on-target vs off-target win rate gap.
//
// Severity (red, amber, green, neutral) is derived from the measurement value
// against the story's band. There is no 'leak' or 'strength' tag. Severity is
// the only label.

(function() {
  // Story registry. defineStory pushes here; evaluateStories iterates here.
  var STORIES = [];

  // ── REGISTRATION ─────────────────────────────────────────────────────────────

  // Register a story. The spec shape:
  //   {
  //     id: 'fold-to-raise',                 // unique
  //     name: 'Fold to Raise',               // human label for headline
  //     panel: 'Betting',                    // single home panel
  //     category: 'postflop-defence',        // free-form grouping label
  //     minSample: 30,                       // optional, defaults to 30
  //     strengthSide: 'low',                 // 'high' | 'low' | null
  //     measure: function(d, extras, hands), // returns {value, n, cells, winRate} or null
  //     band: function(d, extras),           // returns band or null
  //     implications: { high: '...', low: '...' },
  //     advice: { high: '...', low: '...' },
  //     renderOnTarget: false,               // optional, render even when on-target
  //     trailerOnly: false                   // optional, suppress advice clause
  //   }
  // Cells in measurement have shape:
  //   { scope: 'position'|'seats'|'street'|'opponent'|'texture'|...,
  //     key: string, value: number, n: number, target?: band, winRate?: number }
  function defineStory(spec) {
    if (!spec || !spec.id) throw new Error('defineStory: id required');
    STORIES.push(spec);
  }

  // ── SEVERITY CLASSIFIER ──────────────────────────────────────────────────────

  // Given a value, an optional band, and an optional strength side, return
  // { severity, direction, deltaUnits }.
  //
  // Severity:
  //   'r' - significant leak (more than 1 band-width past the boundary)
  //   'a' - slight leak (less than 1 band-width past the boundary)
  //   'g' - on-target or strength
  //   'n' - no band, no opinion (commentary mode)
  // Direction: 'high' | 'low' | 'mid' (mid means inside the band)
  function classifySeverity(value, band, strengthSide) {
    if (value == null) return null;
    if (!band) return { severity: 'n', direction: 'mid', deltaUnits: 0 };

    var lo, hi;
    if (band.tight != null && band.loose != null) { lo = band.tight; hi = band.loose; }
    else if (band.floor != null && band.ceiling != null) { lo = band.floor; hi = band.ceiling; }
    else return { severity: 'n', direction: 'mid', deltaUnits: 0 };

    var bandWidth = Math.max(1, hi - lo);
    if (value >= lo && value <= hi) {
      return { severity: 'g', direction: 'mid', deltaUnits: 0 };
    }
    var direction = value < lo ? 'low' : 'high';
    var deltaUnits = direction === 'low' ? (lo - value) / bandWidth : (value - hi) / bandWidth;

    if (strengthSide && direction === strengthSide && deltaUnits < 1) {
      return { severity: 'g', direction: direction, deltaUnits: deltaUnits };
    }
    if (deltaUnits >= 1) return { severity: 'r', direction: direction, deltaUnits: deltaUnits };
    return { severity: 'a', direction: direction, deltaUnits: deltaUnits };
  }

  // ── CELL DIVERGENCE ──────────────────────────────────────────────────────────

  // Returns true when cell values span at least 15 percentage points.
  function hasCellDivergence(measurement) {
    if (!measurement || !measurement.cells || measurement.cells.length < 2) return false;
    var values = [];
    for (var i = 0; i < measurement.cells.length; i++) {
      var v = measurement.cells[i].value;
      if (v != null) values.push(v);
    }
    if (values.length < 2) return false;
    var min = values[0], max = values[0];
    for (var j = 1; j < values.length; j++) {
      if (values[j] < min) min = values[j];
      if (values[j] > max) max = values[j];
    }
    return (max - min) >= 15;
  }

  // Across cells, which direction (high or low) dominates the leak side?
  function dominantCellDirection(measurement, strengthSide) {
    if (!measurement || !measurement.cells) return null;
    var high = 0, low = 0;
    for (var i = 0; i < measurement.cells.length; i++) {
      var c = measurement.cells[i];
      if (!c.target || c.value == null) continue;
      var sev = classifySeverity(c.value, c.target, strengthSide);
      if (!sev || sev.severity !== 'r' && sev.severity !== 'a') continue;
      var weight = (sev.deltaUnits || 0) + 0.5;
      if (sev.direction === 'high') high += weight;
      else if (sev.direction === 'low') low += weight;
    }
    if (!high && !low) return null;
    return high >= low ? 'high' : 'low';
  }

  // ── FOUR CONDITIONAL GATES ───────────────────────────────────────────────────

  function passesGates(story, measurement, severityResult) {
    // Gate 1: sample-size.
    var minSample = story.minSample || 30;
    if (!measurement || !measurement.n || measurement.n < minSample) return false;

    // Gate 2: behaviour-present.
    if (measurement.value == null) return false;

    if (!severityResult) return false;

    // Gate 3: significance, gate 4: cell-divergence.
    // - red and amber always render.
    // - green inside the band only renders when explicitly opted-in or cells diverge.
    // - neutral (no band) only renders when cells diverge.
    if (severityResult.severity === 'g' && severityResult.direction === 'mid') {
      if (!story.renderOnTarget && !hasCellDivergence(measurement)) return false;
    }
    if (severityResult.severity === 'n') {
      if (!hasCellDivergence(measurement)) return false;
    }
    return true;
  }

  // ── WORST AND BEST CELLS ─────────────────────────────────────────────────────

  // Pick up to N cells where the value is on the leak side (red or amber).
  // Sorted by deltaUnits descending so the worst gap leads.
  function worstCells(measurement, strengthSide, limit) {
    if (!measurement || !measurement.cells) return [];
    var out = [];
    for (var i = 0; i < measurement.cells.length; i++) {
      var c = measurement.cells[i];
      if (!c.target || c.value == null) continue;
      var sev = classifySeverity(c.value, c.target, strengthSide);
      if (!sev || (sev.severity !== 'r' && sev.severity !== 'a')) continue;
      out.push({ cell: c, severity: sev });
    }
    out.sort(function(a, b) { return (b.severity.deltaUnits || 0) - (a.severity.deltaUnits || 0); });
    return out.slice(0, limit || 2);
  }

  // ── TEXT COMPOSITION ─────────────────────────────────────────────────────────

  function fmtPctOneDp(n) {
    return Math.round(n * 10) / 10 + '%';
  }

  function fmtBand(band) {
    if (!band) return '';
    if (band.tight != null && band.loose != null) {
      return Math.round(band.tight) + ' to ' + Math.round(band.loose) + '%';
    }
    if (band.floor != null && band.ceiling != null) {
      return Math.round(band.floor) + ' to ' + Math.round(band.ceiling) + '%';
    }
    return '';
  }

  function verdictWord(severity, direction) {
    if (severity === 'g' && direction === 'mid') return 'on target';
    if (severity === 'g') return 'a strength';
    if (severity === 'r') return direction === 'high' ? 'too high above' : 'too low below';
    if (severity === 'a') return direction === 'high' ? 'slightly above' : 'slightly below';
    return '';
  }

  function composeBehaviourClause(story, measurement, band, sev) {
    var actual = fmtPctOneDp(measurement.value);
    var bandStr = fmtBand(band);
    var name = story.name;

    if (sev.severity === 'r' || sev.severity === 'a') {
      var word = verdictWord(sev.severity, sev.direction);
      if (bandStr) {
        return 'Your ' + name + ' is ' + actual + ', ' + word + ' the ' + bandStr + ' target for the games you play.';
      }
      return 'Your ' + name + ' is ' + actual + ', ' + word + '.';
    }
    if (sev.severity === 'g' && sev.direction === 'mid') {
      return bandStr
        ? 'Your overall ' + name + ' is healthy at ' + actual + ' (target ' + bandStr + ').'
        : 'Your ' + name + ' is ' + actual + '.';
    }
    if (sev.severity === 'g') {
      return 'Your ' + name + ' is ' + actual + ', sitting on the strong side of the ' + bandStr + ' target.';
    }
    return 'Your ' + name + ' is ' + actual + '.';
  }

  function placeLabel(cell) {
    if (cell.scope === 'position') return 'from ' + cell.key;
    if (cell.scope === 'seats') return 'in ' + parseInt(cell.key, 10) + '-handed games';
    if (cell.scope === 'street') return 'on the ' + cell.key.toLowerCase();
    if (cell.scope === 'opponent') return 'versus ' + cell.key;
    if (cell.scope === 'texture') return 'on ' + cell.key + ' boards';
    if (cell.scope === 'handClass') return 'with ' + cell.key;
    return cell.scope + ' ' + cell.key;
  }

  function composeContextClause(worst, aggIsLeak) {
    var parts = worst.map(function(w) {
      return placeLabel(w.cell) + ' (' + fmtPctOneDp(w.cell.value) + ')';
    });
    var lead = aggIsLeak ? 'It is worst ' : 'It happens most ';
    return lead + parts.join(' and ') + '.';
  }

  function composeWinRateTrailer(measurement, strengthSide, name) {
    if (!measurement.cells) return null;
    var onSum = 0, onN = 0, offSum = 0, offN = 0;
    for (var i = 0; i < measurement.cells.length; i++) {
      var c = measurement.cells[i];
      if (c.winRate == null || !c.target || !c.n) continue;
      var sev = classifySeverity(c.value, c.target, strengthSide);
      if (!sev) continue;
      var w = c.n;
      if (sev.severity === 'r' || sev.severity === 'a') { offSum += c.winRate * w; offN += w; }
      else { onSum += c.winRate * w; onN += w; }
    }
    if (!onN || !offN) return null;
    var on = onSum / onN, off = offSum / offN;
    var diff = Math.round(on - off);
    if (Math.abs(diff) < 4) return null;
    if (diff > 0) {
      return 'Your win rate where ' + name + ' is on target is ' + Math.round(on) + '%, versus ' + Math.round(off) + '% where it is off, a ' + diff + ' point gap that is likely costing you money.';
    }
    return 'Win rate is actually higher in the off-target cells (' + Math.round(off) + '% versus ' + Math.round(on) + '%), which suggests the matrix targets may not fit how you play these spots yet.';
  }

  function composeStoryText(story, measurement, band, sev) {
    var aggIsLeak = sev.severity === 'r' || sev.severity === 'a';
    var direction = aggIsLeak ? sev.direction : (dominantCellDirection(measurement, story.strengthSide) || sev.direction);
    var sentences = [];

    sentences.push(composeBehaviourClause(story, measurement, band, sev));
    if (direction && story.implications && story.implications[direction]) {
      sentences.push(story.implications[direction]);
    }
    var worst = worstCells(measurement, story.strengthSide, 2);
    if (worst.length) {
      sentences.push(composeContextClause(worst, aggIsLeak));
    }
    if (direction && (aggIsLeak || worst.length) && !story.trailerOnly && story.advice && story.advice[direction]) {
      sentences.push(story.advice[direction]);
    }
    var trailer = composeWinRateTrailer(measurement, story.strengthSide, story.name);
    if (trailer) sentences.push(trailer);
    return sentences.join(' ');
  }

  // ── SCORE (for ranking findings) ─────────────────────────────────────────────

  function scoreFinding(severity, deltaUnits) {
    var base;
    if (severity === 'r') base = 30;
    else if (severity === 'a') base = 15;
    else if (severity === 'g') base = 10;
    else base = 5;
    return base + Math.min(10, Math.round((deltaUnits || 0) * 4));
  }

  // ── EVALUATION ──────────────────────────────────────────────────────────────

  // Run all stories against the given d, extras, and hands. Returns an array
  // of findings, each shaped:
  //   {
  //     id, name, panel, category,
  //     measurement, band, severity, direction, deltaUnits,
  //     isLeak, isStrength,
  //     text, score
  //   }
  function evaluateStories(d, extras, hands) {
    var findings = [];
    extras = extras || {};
    for (var i = 0; i < STORIES.length; i++) {
      var story = STORIES[i];
      var measurement = null;
      try { measurement = story.measure(d, extras, hands); } catch (e) { measurement = null; }
      if (!measurement) continue;

      var band = null;
      if (story.band) {
        try { band = story.band(d, extras); } catch (e) { band = null; }
      }

      var sev = classifySeverity(measurement.value, band, story.strengthSide);
      if (!sev) continue;
      if (!passesGates(story, measurement, sev)) continue;

      var text = composeStoryText(story, measurement, band, sev);
      var isLeak = sev.severity === 'r' || sev.severity === 'a';
      var isStrength = sev.severity === 'g' && (story.strengthSide
        ? sev.direction === story.strengthSide || sev.direction === 'mid'
        : sev.direction === 'mid');

      findings.push({
        id: story.id,
        name: story.name,
        panel: story.panel,
        category: story.category || null,
        measurement: measurement,
        band: band,
        severity: sev.severity,
        direction: sev.direction,
        deltaUnits: sev.deltaUnits,
        isLeak: isLeak,
        isStrength: isStrength,
        text: text,
        score: scoreFinding(sev.severity, sev.deltaUnits)
      });
    }
    findings.sort(function(a, b) { return b.score - a.score; });
    return findings;
  }

  // Filter findings down to those whose home panel matches the given panel.
  function findingsForPanel(findings, panelName) {
    var out = [];
    for (var i = 0; i < findings.length; i++) {
      if (findings[i].panel === panelName) out.push(findings[i]);
    }
    return out;
  }

  // ── PUBLIC API ───────────────────────────────────────────────────────────────

  // Expose under a global namespace so the test harness and (later) the panels
  // can call into it without conflicting with the existing engine.
  window.Insights = {
    defineStory: defineStory,
    evaluateStories: evaluateStories,
    findingsForPanel: findingsForPanel,
    classifySeverity: classifySeverity,
    _stories: STORIES // exposed for debugging only
  };
})();
