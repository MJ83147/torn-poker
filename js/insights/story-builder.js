// Section-bound finding factory. Removes the panel/sectionId/score boilerplate
// that every finding object repeated. Each section creates one bound factory:
//   var F = Sections.section('bets', 'Betting');
//   return F({ id, name, severity, magnitude, openingText, branchTexts,
//              impactText, soWhatText, examples, meta });
// panel and sectionId come from the binding; score is derived from severity +
// magnitude (pass an explicit score to override).
(function() {
  if (typeof Sections === 'undefined' || typeof Sections.section !== 'undefined') return;
  Sections.section = function(sectionId, panel) {
    return function(spec) {
      spec.sectionId = sectionId;
      if (spec.panel == null) spec.panel = panel;
      if (spec.score == null) spec.score = Sections.score(spec.severity, spec.magnitude || 0);
      if ('magnitude' in spec) delete spec.magnitude;
      return spec;
    };
  };
})();
