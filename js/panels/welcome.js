// Short blurbs for the target picker. Card list and order come from the
// canonical STYLE_LIST so the welcome picker can never drift from the taxonomy.
var STYLE_TARGET_DESCS = {
  Shark:   'Tight and very aggressive. Picks spots well, hammers value.',
  TAG:     'Tight-aggressive. The default winning style. Few hands, played hard.',
  LAG:     'Loose-aggressive. Wider ranges with relentless pressure.',
  Cannon:  'Loose mid-aggression. Lots of flops, light on follow-through.',
  Rock:    'Tight-passive. Selective preflop, rarely takes the lead postflop.',
  Nit:     'Extremely tight. Premium hands only. Hard to bluff.',
  Station: 'Loose-passive. Plenty of hands but rarely raises.',
  Maniac:  'Hyper-aggressive. Raises everything, high variance.'
};

var STYLE_TARGET_CARDS = STYLE_LIST.map(function(key) {
  return { key: key, name: key, desc: STYLE_TARGET_DESCS[key] || '' };
});

function renderStyleWelcome(container, d, hands, meta, onPicked) {
  if (!container) return;
  mountTemplate(container, 'welcome');
  bind(container, {
    greeting: (meta && meta.player) ? ('Welcome, ' + meta.player) : 'Welcome'
  });
  fillRows(container, 'cards', STYLE_TARGET_CARDS, function(card, item) {
    card.setAttribute('data-style', item.key);
    card.addEventListener('click', function() {
      if (typeof setUserStyle === 'function') setUserStyle(item.key);
      if (typeof onPicked === 'function') onPicked(item.key);
    });
  });
}

function renderWelcome(container, d, hands, meta) {
  var tabDescs = [
    { tab: 'mygame',   name: 'My Game',  desc: 'Scouting report, strengths, leak finder, and what to work on' },
    { tab: 'cards',    name: 'Cards',    desc: 'Win rates by hand type: pairs, broadway, suited connectors, and more' },
    { tab: 'position', name: 'Position', desc: 'How you perform from each seat at the table' },
    { tab: 'street',   name: 'Streets',  desc: 'Action breakdown by preflop, flop, turn, and river' },
    { tab: 'actions',  name: 'Betting',  desc: 'Action frequencies, bet sizing, and situational stats' },
    { tab: 'range',    name: 'Range',    desc: 'Full 13x13 hand grid with win rate for every combo' },
    { tab: 'tables',   name: 'Tables',   desc: 'Compare stats across different stakes' },
    { tab: 'trends',   name: 'Trends',   desc: 'Session-over-session charts for win rate, VPIP, and P&L' },
    { tab: 'log',      name: 'Hand Log', desc: 'Every hand played, click any row to replay' },
    { tab: 'allin',    name: 'All-In EV', desc: 'Luck tracker: equity at all-in vs actual results' },
    { tab: 'players',  name: 'Players',  desc: 'Opponent records, head-to-head comparison, and watch list' },
  ];
  var tips = [
    'Insight cards have a <strong>See example hand</strong> button showing a real hand from your data.',
    'Click any hand on the <strong>Range</strong> grid to see when you played it.',
    'In <strong>Players</strong>, click any row to see shared hands. Star \u2606 a player to watch them.',
    'Use the <strong>table filter</strong> in the header to isolate stats to one table.',
  ];
  var welcomeHtml = '<div class="welcome-wrap">' +
    '<div class="flex-between welcome-intro">' +
    '<div class="welcome-intro-text">' +
    '<div class="welcome-intro-heading">Welcome back, ' + meta.player + '</div>' +
    '<div class="text-body">' + d.n + ' hands loaded. Here\'s what each tab shows.</div>' +
    '</div>' +
    '<button class="take-tour-btn" onclick="startWelcomeTour()">Take a Tour</button>' +
    '</div>' +
    '<div class="grid-2 welcome-body">' +
    '<div class="welcome-toc">' +
    tabDescs.map(function(t) {
      return '<div class="card card-sm card-s1 card-link welcome-toc-row" data-goto="' + t.tab + '">' +
        '<div class="gold-heading">' + t.name + '</div>' +
        '<div class="text-body">' + t.desc + '</div>' +
        '</div>';
    }).join('') +
    '</div>' +
    '<div class="welcome-right">' +
    '<div class="text-body welcome-tips">' +
    '<div class="label mb-12">Tips</div>' +
    '<div class="tips-carousel">' +
    '<button class="tips-arrow tips-arrow-left" id="tip-prev">&#8249;</button>' +
    '<div class="tips-track">' +
    tips.map(function(t, i) {
      return '<div class="text-body welcome-tip' + (i === 0 ? ' active' : '') + '">' + t + '</div>';
    }).join('') +
    '</div>' +
    '<button class="tips-arrow tips-arrow-right" id="tip-next">&#8250;</button>' +
    '</div>' +
    '<div class="tips-dots">' +
    tips.map(function(_, i) {
      return '<span class="dot tips-dot' + (i === 0 ? ' active' : '') + '" data-tip="' + i + '"></span>';
    }).join('') +
    '</div>' +
    '</div>' +
    '<div class="welcome-whatsnew">' +
      '<div class="label welcome-whatsnew-label">What\'s new</div>' +
      '<button type="button" class="card card-s1 whatsnew-card whatsnew-card-hero" data-goto="custom">' +
        '<div class="badge whatsnew-card-tag">New</div>' +
        '<div class="whatsnew-card-name">Custom Report</div>' +
        '<div class="text-body">Build your own report by clicking together clauses like a sentence. Twelve filters across table, position, opponent, stake, time window, pot type and more, with a trend chart, breakdowns and a side-by-side compare mode.</div>' +
        '<div class="gold-heading whatsnew-card-cta">Open the Custom Report &rarr;</div>' +
      '</button>' +
      '<div class="card card-s1 whatsnew-card whatsnew-card-static">' +
        '<div class="badge whatsnew-card-tag">Improved</div>' +
        '<div class="whatsnew-card-name">Detailed insights</div>' +
        '<div class="text-body">Every analysis tab now ships story cards that flag strengths, leaks and patterns in your data, each with a real example hand from your session.</div>' +
      '</div>' +
    '</div>' +
    '</div>' +
    '</div>' +
    '</div>';

  container.innerHTML = welcomeHtml;
  container.querySelectorAll('.welcome-toc-row[data-goto]').forEach(function(row) {
    row.onclick = function() {
      switchTab(this.getAttribute('data-goto'));
    };
  });
  container.querySelectorAll('.whatsnew-card[data-goto]').forEach(function(card) {
    card.onclick = function() {
      switchTab(this.getAttribute('data-goto'));
    };
  });

  var tipSlides = container.querySelectorAll('.welcome-tip');
  var tipDots = container.querySelectorAll('.tips-dot');
  var tipIdx = 0;
  function showTip(i) {
    tipIdx = (i + tips.length) % tips.length;
    tipSlides.forEach(function(s, j) { s.classList.toggle('active', j === tipIdx); });
    tipDots.forEach(function(d, j) { d.classList.toggle('active', j === tipIdx); });
  }
  var prevBtn = container.querySelector('#tip-prev');
  var nextBtn = container.querySelector('#tip-next');
  if (prevBtn) prevBtn.onclick = function() { showTip(tipIdx - 1); };
  if (nextBtn) nextBtn.onclick = function() { showTip(tipIdx + 1); };
  tipDots.forEach(function(dot) {
    dot.onclick = function() { showTip(parseInt(this.getAttribute('data-tip'))); };
  });
}
