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
    { tab: 'range',    name: 'Range',    desc: 'Your play and win rate by hand type, plus a 13x13 GTO comparison by spot' },
    { tab: 'tables',   name: 'Tables',   desc: 'Compare stats across different stakes' },
    { tab: 'trends',   name: 'Trends',   desc: 'Session-over-session charts for win rate, VPIP, and P&L' },
    { tab: 'sessions', name: 'Sessions', desc: 'Each sitting read as its own story: the stack arc, tilt, fatigue, and leaks' },
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
    '<div class="row between center">' +
    '<div class="min-w-0">' +
    '<div class="title title-xl c-gold">Welcome back, ' + meta.player + '</div>' +
    '<div class="text-body">' + d.n + ' hands loaded. Here\'s what each tab shows.</div>' +
    '</div>' +
    '<button class="btn btn-primary" onclick="startWelcomeTour()">Take a Tour</button>' +
    '</div>' +
    '<div class="welcome-body">' +
    '<div class="welcome-toc">' +
    '<div class="section-head">The tabs</div>' +
    tabDescs.map(function(t) {
      return '<div class="card card-s1 card-link welcome-toc-row" data-goto="' + t.tab + '">' +
        '<div class="c-gold fw-semibold">' + t.name + '</div>' +
        '<div class="text-body">' + t.desc + '</div>' +
        '</div>';
    }).join('') +
    '</div>' +
    '<div class="welcome-aside">' +
    '<div class="section">' +
    '<div class="section-head">Tips</div>' +
    '<div class="carousel">' +
    '<button class="btn btn-icon" id="tip-prev">&#8249;</button>' +
    '<div class="carousel-track">' +
    tips.map(function(t, i) {
      return '<div class="carousel-slide text-body' + (i === 0 ? ' active' : '') + '">' + t + '</div>';
    }).join('') +
    '</div>' +
    '<button class="btn btn-icon" id="tip-next">&#8250;</button>' +
    '</div>' +
    '<div class="carousel-dots">' +
    tips.map(function(_, i) {
      return '<span class="carousel-dot' + (i === 0 ? ' active' : '') + '" data-tip="' + i + '"></span>';
    }).join('') +
    '</div>' +
    '</div>' +
    '<div class="list">' +
      '<div class="section-head">What\'s new</div>' +
      '<button type="button" class="card card-hero card-link list start text-left" data-goto="custom">' +
        '<div class="badge badge-gold">New</div>' +
        '<div class="title title-lg c-gold">Custom Report</div>' +
        '<div class="text-body">Build your own report by clicking together clauses like a sentence. Twelve filters across table, position, opponent, stake, time window, pot type and more, with a trend chart, breakdowns and a side-by-side compare mode.</div>' +
        '<div class="c-gold fw-semibold">Open the Custom Report &rarr;</div>' +
      '</button>' +
      '<div class="card card-s1 list start text-left">' +
        '<div class="badge badge-gold">New</div>' +
        '<div class="title title-lg c-gold">Stack tracking</div>' +
        '<div class="text-body">The tracker now records every player’s starting and ending stack on each hand — the foundation for effective-stack depth, spotting who was short, and stack-aware insights to come.</div>' +
        '<div class="text-body">Applies to hands tracked from now on. Hands already in your history stay exactly as they are — they won’t carry stack data, and any stack-based stats simply skip them rather than counting them as zero.</div>' +
      '</div>' +
      '<div class="card card-s1 list start text-left">' +
        '<div class="badge badge-gold">Improved</div>' +
        '<div class="title title-lg c-gold">Detailed insights</div>' +
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
  container.querySelectorAll('.card-hero[data-goto]').forEach(function(card) {
    card.onclick = function() {
      switchTab(this.getAttribute('data-goto'));
    };
  });

  var tipSlides = container.querySelectorAll('.carousel-slide');
  var tipDots = container.querySelectorAll('.carousel-dot');
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
