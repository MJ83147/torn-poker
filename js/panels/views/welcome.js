// Home page (welcome tab), the three hub pages, and the first-run style
// picker. Areas taxonomy and content live in js/panels/welcome.js.

var _homeTipTimer = null;

function renderWelcome(container, d, hands, meta) {
  var sessionCount = buildSessions(hands || []).length;

  var hubCards = AREAS.map(function(a) {
    var pages = a.groups.reduce(function(acc, g) { return acc.concat(g.pages); }, []);
    return `<button class="card card-s1 card-link hub-card" data-hub-go="${a.id}">
      <h2>${a.label}</h2>
      <div class="text-body">${a.blurb}</div>
      <div class="hub-pages">${pages.map(function(p) { return p.name; }).join(' · ')}</div>
      <div class="go">Open ${a.label} &rarr;</div>
    </button>`;
  }).join('');

  var wnSlides = WHATS_NEW.map(function(w, i) {
    var inner = `<div class="badge badge-gold">${w.badge}</div>
      <h3 class="c-gold">${w.title}</h3>
      ${w.paras.map(function(t) { return `<div class="text-body">${t}</div>`; }).join('')}
      ${w.cta ? `<div class="c-gold fw-semibold">${w.cta}</div>` : ''}`;
    return w.goto
      ? `<button type="button" class="card card-s1 card-link wn-slide${i === 0 ? ' on' : ''}" data-goto="${w.goto}">${inner}</button>`
      : `<div class="card card-s1 wn-slide${i === 0 ? ' on' : ''}">${inner}</div>`;
  }).join('');

  container.innerHTML =
    `<div class="home-hero row between start">
      <div class="min-w-0">
        <div class="eyebrow">Welcome back, ${meta.player}</div>
        <h1>Know your game.</h1>
        <div class="lead">${d.n} hands across ${sessionCount} session${sessionCount === 1 ? '' : 's'}, ready to dig into.</div>
      </div>
      <button class="btn btn-primary home-tour-btn">Take a Tour</button>
    </div>

    <div class="section-head areas-head">Areas</div>
    <div class="hub-grid">${hubCards}</div>

    <div class="home-foot">
      <div class="whatsnew">
        <div class="wn-head row between center">
          <div class="section-head">What&rsquo;s new</div>
          <div class="row center wn-controls">
            <button class="btn btn-icon" id="wn-prev">&#8249;</button>
            <div class="wn-dots" id="wn-dots"></div>
            <button class="btn btn-icon" id="wn-next">&#8250;</button>
          </div>
        </div>
        ${wnSlides}
      </div>

      <div class="tip-panel">
        <span class="tip-label">Tip</span>
        <span class="tip-text" id="home-tip-text">${HOME_TIPS[0]}</span>
      </div>
    </div>`;

  container.querySelectorAll('[data-hub-go]').forEach(function(card) {
    card.onclick = function() { switchTab('hub-' + this.getAttribute('data-hub-go')); };
  });
  container.querySelectorAll('[data-goto]').forEach(function(el) {
    el.onclick = function() { switchTab(this.getAttribute('data-goto')); };
  });
  var tourBtn = container.querySelector('.home-tour-btn');
  if (tourBtn) tourBtn.onclick = function() {
    if (typeof startWelcomeTour === 'function') startWelcomeTour();
  };

  // What's-new carousel.
  var slides = container.querySelectorAll('.wn-slide');
  var dots = container.querySelector('#wn-dots');
  var wnI = 0;
  slides.forEach(function(_, i) {
    var dot = document.createElement('button');
    dot.className = 'wn-dot' + (i === 0 ? ' on' : '');
    dot.onclick = function() { wnShow(i); };
    dots.appendChild(dot);
  });
  function wnShow(i) {
    wnI = (i + slides.length) % slides.length;
    slides.forEach(function(s, j) { s.classList.toggle('on', j === wnI); });
    dots.querySelectorAll('.wn-dot').forEach(function(dd, j) { dd.classList.toggle('on', j === wnI); });
  }
  container.querySelector('#wn-prev').onclick = function() { wnShow(wnI - 1); };
  container.querySelector('#wn-next').onclick = function() { wnShow(wnI + 1); };

  // Rotating tip. One timer app-wide; re-rendering home restarts it.
  if (_homeTipTimer) { clearInterval(_homeTipTimer); _homeTipTimer = null; }
  var tipI = 0;
  _homeTipTimer = setInterval(function() {
    var el = document.getElementById('home-tip-text');
    if (!el) { clearInterval(_homeTipTimer); _homeTipTimer = null; return; }
    el.style.opacity = 0;
    setTimeout(function() {
      tipI = (tipI + 1) % HOME_TIPS.length;
      el.innerHTML = HOME_TIPS[tipI];
      el.style.opacity = 1;
    }, 300);
  }, 5000);
}

function renderHub(container, areaId) {
  var area = areaById(areaId);
  if (!area) { container.innerHTML = ''; return; }

  var body = area.groups.map(function(g) {
    var cards = g.pages.map(function(p) {
      return `<button class="card card-s1 card-link page-card" data-goto="${p.tab}">
        <h3>${p.name}</h3>
        <div class="text-body">${p.desc}</div>
        <div class="go">Open ${p.name} &rarr;</div>
      </button>`;
    }).join('');
    return (g.label ? `<div class="subgroup-head">${g.label}</div>` : '') +
      `<div class="page-grid">${cards}</div>`;
  }).join('');

  container.innerHTML =
    `<div class="crumb" data-goto="welcome">&larr; Home</div>
    <div class="hub-head">
      <h1>${area.label}</h1>
      <div class="lead">${area.lead}</div>
    </div>` + body;

  container.querySelectorAll('[data-goto]').forEach(function(el) {
    el.onclick = function() { switchTab(this.getAttribute('data-goto')); };
  });
}

function renderStyleWelcome(container, d, hands, meta, onPicked) {
  if (!container) return;
  var greeting = (meta && meta.player) ? ('Welcome, ' + meta.player) : 'Welcome';
  container.innerHTML =
    `<div class="style-welcome"><div class="style-welcome-inner">
      <div class="eyebrow">${greeting}</div>
      <div class="title title-xl">Pick the style you want to target.</div>
      <div class="style-welcome-cards">${STYLE_TARGET_CARDS.map(function(c) {
        return `<button type="button" class="card card-s1 card-link text-left" data-style="${c.key}">
          <div class="title title-lg c-gold">${c.name}</div>
          <div class="text-body">${c.desc}</div>
        </button>`;
      }).join('')}</div>
    </div></div>`;

  container.querySelectorAll('[data-style]').forEach(function(card) {
    card.addEventListener('click', function() {
      var key = this.getAttribute('data-style');
      if (typeof setUserStyle === 'function') setUserStyle(key);
      if (typeof onPicked === 'function') onPicked(key);
    });
  });
}
