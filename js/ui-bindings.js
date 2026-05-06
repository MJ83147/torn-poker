// ── UI BINDINGS ─────────────────────────────────────────────────────────────
// Wire up the small set of header controls that used to live as inline
// onclick / onmouseover handlers in index.html. Functions referenced below
// (switchTab, startGuidedTour) are defined elsewhere in the bundle and are
// available globally once the page is parsed.

(function() {
  function bind() {
    var pageMeta = document.getElementById('page-meta');
    if (pageMeta) {
      pageMeta.addEventListener('click', function() {
        if (typeof switchTab === 'function') switchTab('mygame');
      });
    }

    var tourBtn = document.getElementById('tour-btn');
    if (tourBtn) {
      tourBtn.addEventListener('click', function() {
        if (typeof startGuidedTour === 'function') startGuidedTour();
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }
})();
