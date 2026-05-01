// ── WELCOME PANEL ─────────────────────────────────────────────────────────────

// First-time welcome screen: shown before the user has picked a target style.
// Replaces the dashboard until a target style is chosen.
//
//   container - element to render into (full-screen overlay or panel)
//   d         - analyse() output for the loaded session
//   hands     - hand list
//   meta      - { player, exportedAt }
//   onPicked  - callback(styleName) invoked when the user picks a target style
function renderStyleWelcome(container, d, hands, meta, onPicked) {
  if (!container) return;

  var detected = (typeof detectCurrentStyle === 'function')
    ? detectCurrentStyle(d)
    : { name: 'Shark', reason: '', confidence: 'low' };

  var targetCards = [
    { key: 'TAG',     name: 'TAG',     desc: 'Tight-aggressive. The default winning style. Few hands, played hard.' },
    { key: 'LAG',     name: 'LAG',     desc: 'Loose-aggressive. Wider ranges with relentless pressure.' },
    { key: 'Nit',     name: 'Nit',     desc: 'Extremely tight. Premium hands only. Hard to bluff.' },
    { key: 'Station', name: 'Station', desc: 'Loose-passive. Plenty of hands but rarely raises.' },
    { key: 'Maniac',  name: 'Maniac',  desc: 'Hyper-aggressive. Raises everything, high variance.' }
  ];

  var html = '';
  html += '<div class="style-welcome">';
  html += '<div class="style-welcome-inner">';
  html += '<div class="style-welcome-eyebrow">' + (meta && meta.player ? 'Welcome, ' + meta.player : 'Welcome') + '</div>';
  // Player-type label removed - the header style picker, My Game and Style Map
  // already surface this. Welcome's job is target selection.
  html += '<div class="style-welcome-headline">Pick the style you want to target.</div>';
  html += '<div class="style-welcome-cards">';
  for (var i = 0; i < targetCards.length; i++) {
    var c = targetCards[i];
    html += '<button type="button" class="style-card" data-style="' + c.key + '">';
    html += '<div class="style-card-name">' + c.name + '</div>';
    html += '<div class="style-card-desc">' + c.desc + '</div>';
    html += '</button>';
  }
  html += '</div>';
  html += '</div>';
  html += '</div>';

  container.innerHTML = html;

  var cards = container.querySelectorAll('.style-card');
  cards.forEach(function(card) {
    card.addEventListener('click', function() {
      var style = this.getAttribute('data-style');
      if (typeof setUserStyle === 'function') setUserStyle(style);
      if (typeof onPicked === 'function') onPicked(style);
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
    'Click any cell on the <strong>Range</strong> grid to see hands with that combo.',
    'In <strong>Players</strong>, click any row to see shared hands. Star \u2606 a player to watch them.',
    'Use the <strong>table filter</strong> in the header to isolate stats to one table.',
  ];
  var welcomeHtml = '<div class="welcome-wrap">' +
    '<div class="welcome-intro">' +
    '<div class="welcome-intro-heading">Welcome back, ' + meta.player + '</div>' +
    '<div class="desc-text">' + d.n + ' hands loaded. Here\'s what each tab shows.</div>' +
    '<button class="take-tour-btn" onclick="startWelcomeTour()">Take a Tour</button>' +
    '</div>' +
    '<div class="welcome-body">' +
    '<div class="welcome-toc">' +
    tabDescs.map(function(t) {
      return '<div class="welcome-toc-row" data-goto="' + t.tab + '">' +
        '<div class="gold-label">' + t.name + '</div>' +
        '<div class="desc-text">' + t.desc + '</div>' +
        '</div>';
    }).join('') +
    '</div>' +
    '<div class="welcome-tips">' +
    '<div class="dim-label mb-12">Tips</div>' +
    '<div class="tips-carousel">' +
    '<button class="tips-arrow tips-arrow-left" id="tip-prev">&#8249;</button>' +
    '<div class="tips-track">' +
    tips.map(function(t, i) {
      return '<div class="welcome-tip' + (i === 0 ? ' active' : '') + '">' + t + '</div>';
    }).join('') +
    '</div>' +
    '<button class="tips-arrow tips-arrow-right" id="tip-next">&#8250;</button>' +
    '</div>' +
    '<div class="tips-dots">' +
    tips.map(function(_, i) {
      return '<span class="tips-dot' + (i === 0 ? ' active' : '') + '" data-tip="' + i + '"></span>';
    }).join('') +
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

  // Tips carousel
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
