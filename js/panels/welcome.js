// ── WELCOME PANEL ─────────────────────────────────────────────────────────────

function renderWelcome(container, d, hands, meta) {
  var vpipPct = pct(d.vpip, d.n);
  var aggPct = calcAggression(d.raises, d.calls, d.checks);

  var tabDescs = [
    { tab: 'mygame',   name: 'My Game',  desc: 'Personal scouting report: your stats, strengths, leaks, and what to work on' },
    { tab: 'cards',    name: 'Cards',    desc: 'Win rates by hand type: pairs, broadway, suited connectors, and more' },
    { tab: 'position', name: 'Position', desc: 'How you perform from each seat at the table' },
    { tab: 'street',   name: 'Streets',  desc: 'Action breakdown by preflop, flop, turn, and river' },
    { tab: 'actions',  name: 'Actions',  desc: 'Fold, check, call, and raise frequencies' },
    { tab: 'bets',     name: 'Bets',     desc: 'Average bet sizing across streets' },
    { tab: 'range',    name: 'Range',    desc: 'Full 13x13 hand grid with win rate for every combo' },
    { tab: 'tables',   name: 'Tables',   desc: 'Compare stats across different stakes' },
    { tab: 'trends',   name: 'Trends',   desc: 'Session-over-session charts for win rate, VPIP, and P&L' },
    { tab: 'log',      name: 'Hand Log', desc: 'Every hand played, click any row to replay' },
    { tab: 'allin',    name: 'All-In EV', desc: 'Luck tracker: equity at all-in vs actual results' },
    { tab: 'players',  name: 'Players',  desc: 'Opponent records, head-to-head stats, and watch list' },
    { tab: 'compare',  name: 'Head to Head', desc: 'Compare two players side by side with exploit tips' },
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

  // Cross-analysis insights on Overview
  var overviewIns = [];
  if (vpipPct !== null && aggPct !== null) {
    if (vpipPct > 50 && aggPct < 20) {
      var exWidePassive = findExampleHand(function(h) {
        var ma = getHeroActions(h);
        return ma.some(function(a) { return a.type === 'call'; }) && !ma.some(function(a) { return a.type === 'raise' || a.type === 'bet'; }) && h.outcome && h.outcome.result !== 'won';
      });
      overviewIns.push(insWithExample('r', 'VPIP x Aggression', 'Playing ' + vpipPct + '% of hands but raising only ' + aggPct + '% of the time. Wide and passive is the worst combination in poker.', [{
        v: 'VPIP: ' + vpipPct + '%',
      }, {
        v: 'Raise: ' + aggPct + '%',
      }], exWidePassive, 'You entered this pot by calling but never took the lead with a raise. Playing many hands passively means you pay to see cards without building pots when you are strong, and you give opponents easy decisions.'));
    }
    if (vpipPct < 30 && aggPct > 35) {
      overviewIns.push(ins('g', 'VPIP x Aggression', 'Tight (' + vpipPct + '% VPIP) and aggressive (' + aggPct + '%). You pick good spots and bet for value — a strong profile.', [{
        v: 'VPIP: ' + vpipPct + '%',
      }, {
        v: 'Raise: ' + aggPct + '%',
      }]));
    }
  }
  if (overviewIns.length) {
    welcomeHtml += '<div class="ins-grid mt-20">' + overviewIns.join('') + '</div>';
  }
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
