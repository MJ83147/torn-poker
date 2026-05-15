// ── INSIGHT FRAMEWORK ─────────────────────────────────────────────────────────
//
// Severity classifier shared by the Sections layer (see story-engine.js, which
// calls Insights.classifySeverity for each section's measurement). The wider
// story-registry API that used to live here (defineStory, evaluateStories,
// findingsForPanel) was retired together with js/insights/stories/ and the
// test harness.

(function() {
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

  window.Insights = {
    classifySeverity: classifySeverity
  };
})();
