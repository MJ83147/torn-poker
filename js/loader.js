(function() {
  const cs = document.querySelectorAll('.lc');
  let i = 0;

  function deal() {
    if (i < cs.length) {
      cs[i].classList.add(CSS.SHOW);
      i++;
      setTimeout(deal, 165);
    } else {
      setTimeout(show, 400);
    }
  }

  function show() {
    const loader = document.getElementById('loader');
    const app = document.getElementById('app');
    if (!loader || !app) return;
    loader.classList.add(CSS.OUT);
    setTimeout(() => {
      loader.style.display = 'none';
      app.classList.add(CSS.ON);
      if (typeof checkSavedSession === 'function') {
        checkSavedSession();
      }
    }, 800);
  }

  setTimeout(deal, 220);
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
