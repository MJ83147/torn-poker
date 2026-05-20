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
