// ── INITIAL LOADER (cards only, no counter) ─────────────────────────────────
(function() {
  const cs = document.querySelectorAll('.lc');
  let i = 0;

  function deal() {
    if (i < cs.length) {
      cs[i].classList.add('show');
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
    loader.classList.add('out');
    setTimeout(() => {
      loader.style.display = 'none';
      app.classList.add('on');
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
  cs.forEach(c => c.classList.remove('show'));
  loader.style.display = 'flex';
  loader.classList.remove('out');
  app.classList.remove('on');
  let i = 0;

  function deal() {
    if (i < cs.length) {
      cs[i].classList.add('show');
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
          loader.classList.add('out');
          setTimeout(() => {
            loader.style.display = 'none';
            app.classList.add('on');
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

