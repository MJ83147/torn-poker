// Initial page load goes straight to the paste screen. The loader/deal flourish
// is reserved for an actual analysis run (bootSession), so it is never shown
// twice or for an empty screen. checkSavedSession runs from initStorage's
// callback (app.js), once the DB is ready, so it is not called here.
(function() {
  var app = document.getElementById('app');
  var loader = document.getElementById('loader');
  if (loader) loader.style.display = 'none';
  if (app) app.classList.add(CSS.ON);
})();

var _chartJsPromise = null;
function ensureChartJs(callback) {
  if (typeof Chart !== 'undefined') { callback(); return; }
  if (!_chartJsPromise) {
    _chartJsPromise = new Promise(function (resolve) {
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js';
      s.onload = resolve;
      document.head.appendChild(s);
    });
  }
  _chartJsPromise.then(callback);
}

var _introJsPromise = null;
function ensureIntroJs(callback) {
  if (typeof introJs !== 'undefined') { callback(); return; }
  if (!_introJsPromise) {
    _introJsPromise = new Promise(function (resolve) {
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/intro.js@7.2.0/minified/introjs.min.css';
      document.head.appendChild(link);
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/intro.js@7.2.0/minified/intro.min.js';
      s.onload = resolve;
      document.head.appendChild(s);
    });
  }
  _introJsPromise.then(callback);
}
