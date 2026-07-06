// Verdict + findings block for a panel, as a plain HTML string. Thin wrapper
// over the shared Sections engine (renderFindings/renderFindingsGrouped
// self-wire their example buttons and card toggles after insertion).
// opts.group(findings, d) -> [{ label, findings, emptyNote }] renders grouped.
function panelFindings(panelName, d, hands, fallback, opts) {
  if (typeof Sections === 'undefined' || typeof Sections.evaluateSections !== 'function') return '';
  opts = opts || {};
  var findings = Sections.findingsForPanel(Sections.evaluateSections(d, {}, hands), panelName);
  if (opts.group) {
    return Sections.renderVerdict(findings, fallback) +
      Sections.renderFindingsGrouped(opts.group(findings, d));
  }
  return Sections.findingsBlock(findings, fallback);
}
