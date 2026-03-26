// ── GUIDED TOUR (Intro.js) ───────────────────────────────────────────────────

(function() {

  // ── Welcome tour: header elements + point to help button ──────────────────
  function startWelcomeTour() {
    if (typeof introJs === 'undefined') return;

    var steps = [
      {
        element: '#hero-strip',
        intro: '<strong>Hero Strip</strong><br>Your key session stats at a glance: total hands played, win rate, net profit/loss, VPIP (how often you voluntarily enter pots), aggression rate, and how you handle all-in situations.',
        position: 'bottom'
      },
      {
        element: '#bb-toggle',
        intro: '<strong>Dollar / BB Toggle</strong><br>Switch between dollar amounts and Big Blind units. BB mode normalises your stats so you can compare performance across different stakes.',
        position: 'bottom'
      },
      {
        element: '#table-filter',
        intro: '<strong>Table Filter</strong><br>Filter your entire analysis to a single table or stake level. All tabs update to show only hands from the selected table.',
        position: 'bottom'
      },
      {
        element: '#page-meta',
        intro: '<strong>Player Info</strong><br>Shows your name, export date, and hand count. Click it to view your player profile.',
        position: 'bottom'
      },
      {
        element: '#tabs',
        intro: '<strong>Analysis Tabs</strong><br>Each tab dives deep into a different part of your game — hand types, position, betting patterns, opponents, and more. Click any tab to explore.',
        position: 'bottom'
      },
      {
        element: '.welcome-toc',
        intro: '<strong>Table of Contents</strong><br>Quick links to every analysis tab with a short description of what each one covers. Click any row to jump straight there.',
        position: 'top'
      },
      {
        element: '.welcome-tips',
        intro: '<strong>Tips</strong><br>Rotating tips to help you get the most out of the tool. Use the arrows to cycle through them.',
        position: 'top'
      },
      {
        element: '#tour-btn',
        intro: '<strong>Page Help</strong><br>Every page has this <strong>?</strong> button. Click it on any tab to get a guided walkthrough of everything on that page.',
        position: 'left'
      }
    ];

    var intro = introJs();
    intro.setOptions({
      steps: steps,
      showProgress: true,
      showBullets: true,
      overlayOpacity: 0.6,
      exitOnOverlayClick: true,
      disableInteraction: false,
      scrollToElement: true,
      scrollPadding: 80,
      nextLabel: 'Next &rarr;',
      prevLabel: '&larr; Back',
      doneLabel: 'Got it',
      tooltipClass: 'tc-tour-tooltip'
    });
    intro.start();
  }

  // ── Per-tab tours ─────────────────────────────────────────────────────────
  var tabTourSteps = {
    cards: [
      { el: '.ht-stack-legend', intro: '<strong>Legend</strong><br>The colour key: green = hands won, blue = hands played but lost, grey = hands dealt but folded preflop.', pos: 'bottom' },
      { el: '.ht-stack-item', intro: '<strong>Hand Type Stacks</strong><br>Each bar represents a hand category (pocket pairs, broadway, suited connectors, etc.). The wider the green segment, the better your win rate with that type.', pos: 'top' },
      { el: '.ins-grid', intro: '<strong>Insights</strong><br>Automated analysis of your hand type performance. Green = strength, red = leak, amber = caution. Click "See example hand" to view a real hand from your session.', pos: 'top' }
    ],
    position: [
      { el: '.overflow-x', intro: '<strong>Position Table</strong><br>Your stats from each seat: hands played, VPIP, fold rate preflop, win rate, P&L, and average pot size. Look for positions where you leak chips.', pos: 'top' },
      { el: '.chart-wrap-full', intro: '<strong>Position Chart</strong><br>Win rate and VPIP plotted by position. Ideally your win rate is highest in late position (BTN, CO) where you have more information.', pos: 'top' },
      { el: '.ins-grid', intro: '<strong>Position Insights</strong><br>Highlights your strongest and weakest seats. Pay attention to red cards flagging positions where you lose the most.', pos: 'top' }
    ],
    street: [
      { el: '.two-col', intro: '<strong>Street Stats</strong><br>Left: how many hands reach each street (preflop through river). Right: your fold rate on each street. A high flop fold rate may mean you\'re entering too many pots.', pos: 'top' },
      { el: '#street-action-chart', intro: '<strong>Action Chart</strong><br>Stacked bars showing your fold/check/call/raise split on each street. Look for streets where you\'re too passive (lots of checking/calling).', pos: 'top' },
      { el: '.ins-grid', intro: '<strong>Street Insights</strong><br>Flags patterns like folding too often on the flop, or not being aggressive enough on the turn.', pos: 'top' }
    ],
    actions: [
      { el: '.mini-row', intro: '<strong>Action Totals</strong><br>Your total action count broken down into folds, checks, calls, and raises, plus your overall aggression percentage.', pos: 'bottom' },
      { el: '.stack-bar', intro: '<strong>Action Split</strong><br>Visual breakdown of your action frequencies. Red = fold, green = raise, amber = call, grey = check. A healthy profile has more green than red.', pos: 'top' },
      { el: '.bar-group', intro: '<strong>Situational Stats</strong><br>Key spots like continuation bet (C-Bet) rate, donk bet frequency, fold to 3-bet, and more. These pinpoint specific leaks.', pos: 'top' },
      { el: '.ins-grid', intro: '<strong>Action Insights</strong><br>Automated flags for action-related leaks and strengths.', pos: 'top' }
    ],
    bets: [
      { el: '.two-col', intro: '<strong>Bet Sizing</strong><br>Left: your average bet size on each street. Right: how often you bet on each street. Use BB mode to compare across stakes.', pos: 'top' },
      { el: '.ins-grid', intro: '<strong>Bet Insights</strong><br>Flags sizing issues — betting too small gives opponents odds, too large risks more than necessary.', pos: 'top' }
    ],
    range: [
      { el: '#range-pos-filter', intro: '<strong>Position Filter</strong><br>Filter the grid to see which hands you play from specific positions. Great for reviewing your opening range.', pos: 'bottom' },
      { el: '.range-grid-sm', intro: '<strong>Hand Matrix</strong><br>The classic 13x13 grid. Every starting hand combo colour-coded by win rate. Darker green = higher win rate. Click any cell to see example hands.', pos: 'top' },
      { el: '.range-legend', intro: '<strong>Legend</strong><br>Colour scale for win rate and play frequency. Use this to read the grid quickly.', pos: 'top' }
    ],
    tables: [
      { el: '.overflow-x', intro: '<strong>Table Comparison</strong><br>Compare your stats across different tables and stakes: hands, VPIP, win rate, P&L, and average pot. Use the exclude buttons to remove specific tables from your analysis.', pos: 'top' },
      { el: '.ins-grid', intro: '<strong>Table Insights</strong><br>Highlights your most and least profitable tables.', pos: 'top' }
    ],
    trends: [
      { el: '.trends-grid', intro: '<strong>Trend Charts</strong><br>Four charts tracking your game over time: cumulative win rate, VPIP, aggression, and net P&L. Look for upward or downward trends.', pos: 'top' },
      { el: '.ins-grid', intro: '<strong>Trend Insights</strong><br>Flags improving or declining patterns in your play.', pos: 'top' }
    ],
    showdown: [
      { el: '#showdown-chart', intro: '<strong>Blue/Red Line</strong><br>Blue line = showdown winnings (pots you won at showdown). Red line = non-showdown winnings (pots won when opponents folded). A healthy game has both lines trending up.', pos: 'top' },
      { el: '.mini-row', intro: '<strong>Showdown Stats</strong><br>Total showdown and non-showdown profits side by side. If your red line is deeply negative, opponents aren\'t folding enough to your bets.', pos: 'top' }
    ],
    log: [
      { el: '.hlog-tbl', intro: '<strong>Hand Table</strong><br>Every hand you played, showing position, hole cards, board, action summary, and result. <strong>Click any row</strong> to open a detailed hand replay showing every action, pot sizes, and coaching notes.', pos: 'top' },
      { el: '.hrow-star', intro: '<strong>Star Hands</strong><br>Click the star on any hand to save it for later review. Starred hands appear in the Saved Hands section at the top.', pos: 'left' },
      { el: '.saved-section', intro: '<strong>Saved Hands</strong><br>Your starred hands for study. Each card shows the hole cards, board, and result. Click any saved hand to replay it. Add notes to remember what you were thinking.', pos: 'top' },
      { el: '#mc-sim-btn', intro: '<strong>Equity Simulation</strong><br>When you open a hand replay, look for the <strong>Run Equity Simulation</strong> button. It runs a Monte Carlo simulation calculating your equity (chance of winning) on each street against a random hand. Compares your actual decisions against the mathematical odds — shows whether your calls, raises, and folds were profitable.', pos: 'top' }
    ],
    players: [
      { el: '#player-search', intro: '<strong>Search</strong><br>Type a player name to find them quickly in your opponent list.', pos: 'bottom' },
      { el: '.players-table-scroll', intro: '<strong>Opponent Table</strong><br>Every opponent you\'ve faced with VPIP, PFR, limp rate, fold-to-raise, and showdown stats. <strong>Click any player row</strong> to open their profile showing your full head-to-head record, their tendencies, exploit suggestions, and every hand you\'ve played together.', pos: 'top' },
      { el: '.watch-star', intro: '<strong>Watch List</strong><br>Click the star next to any player to add them to your watch list. Watched players appear in a dedicated section at the top so you can track key opponents across sessions.', pos: 'left' },
      { el: '.ins-grid', intro: '<strong>Player Insights</strong><br>Your most-seen opponents, best/worst records against specific players, and flags for exploitable tendencies.', pos: 'top' }
    ]
  };

  function startTabTour() {
    if (typeof introJs === 'undefined') return;

    var activeTab = document.querySelector('.tab.active');
    var tabId = activeTab ? activeTab.dataset.tab : null;
    if (!tabId || tabId === 'welcome') {
      startWelcomeTour();
      return;
    }

    var defs = tabTourSteps[tabId];
    if (!defs || !defs.length) return;

    var panel = document.getElementById('p-' + tabId);
    if (!panel) return;

    // Build steps, skipping elements that don't exist on this render
    var steps = [];
    for (var i = 0; i < defs.length; i++) {
      var el = panel.querySelector(defs[i].el);
      if (el && el.offsetParent !== null) {
        steps.push({
          element: el,
          intro: defs[i].intro,
          position: defs[i].pos || 'top'
        });
      }
    }

    if (!steps.length) return;

    var intro = introJs();
    intro.setOptions({
      steps: steps,
      showProgress: true,
      showBullets: true,
      overlayOpacity: 0.6,
      exitOnOverlayClick: true,
      disableInteraction: false,
      scrollToElement: true,
      scrollPadding: 80,
      nextLabel: 'Next &rarr;',
      prevLabel: '&larr; Back',
      doneLabel: 'Got it',
      tooltipClass: 'tc-tour-tooltip'
    });
    intro.start();
  }

  // Expose globally
  window.startWelcomeTour = startWelcomeTour;
  window.startGuidedTour = startTabTour;

})();
