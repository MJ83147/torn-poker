// ── INITIAL LOADER (cards only, no counter) ─────────────────────────────────
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
      // After the intro animation, check for a saved session to restore
      if (typeof checkSavedSession === 'function') {
        checkSavedSession();
      }
    }, 800);
  }

  setTimeout(deal, 220);
})();

// ── IMPORT LOADER (real count, shown after analyse click) ───────────────────
function showImportLoader(count, callback) {
  const loader = document.getElementById('loader');
  const num = document.getElementById('lnum');
  const prog = document.getElementById('lprog');
  const app = document.getElementById('app');
  const cs = document.querySelectorAll('.lc');
  if (!loader || !num || !prog || !app) {
    if (typeof callback === 'function') callback();
    return;
  }

  // Reset state
  num.textContent = '0';
  prog.style.width = '0%';
  cs.forEach(c => c.classList.remove(CSS.SHOW));
  loader.style.display = 'flex';
  loader.classList.remove(CSS.OUT);
  app.classList.remove(CSS.ON);
  let i = 0;

  function deal() {
    if (i < cs.length) {
      cs[i].classList.add(CSS.SHOW);
      i++;
      setTimeout(deal, 120);
    } else {
      runCount();
    }
  }

  function runCount() {
    const steps = 50;
    const dur = 1000;
    let s = 0;
    const iv = setInterval(() => {
      s++;
      num.textContent = Math.round(count * s / steps);
      prog.style.width = (s / steps * 100) + '%';
      if (s >= steps) {
        clearInterval(iv);
        num.textContent = count;
        prog.style.width = '100%';
        setTimeout(() => {
          loader.classList.add(CSS.OUT);
          setTimeout(() => {
            loader.style.display = 'none';
            app.classList.add(CSS.ON);
            if (typeof callback === 'function') {
              callback();
            }
          }, 800);
        }, 500);
      }
    }, dur / steps);
  }

  setTimeout(deal, 100);
}

// ── LAZY CDN LOADERS ────────────────────────────────────────────────────────
// Chart.js and intro.js are heavy and not needed for the paste screen, so they
// load on demand instead of blocking the initial page render.
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
