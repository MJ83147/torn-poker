// ── GUIDED TOUR (Intro.js) ───────────────────────────────────────────────────

(function() {

  var tourOptions = {
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
  };

  // Helper: find element in panel, check it's actually rendered (has dimensions)
  function findEl(panel, sel) {
    var el = panel.querySelector(sel);
    if (!el) return null;
    // Use getBoundingClientRect - works even when offsetParent is null (canvas, overflow, etc.)
    var rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return null;
    return el;
  }

  // Helper: build steps from defs, attach to elements or fall back to floating
  function buildSteps(panel, defs) {
    var steps = [];
    for (var i = 0; i < defs.length; i++) {
      var d = defs[i];
      if (d.el) {
        var el = findEl(panel, d.el);
        if (el) {
          steps.push({ element: el, intro: d.intro, position: d.pos || 'top' });
        } else if (d.fallback) {
          // Show as floating tooltip when element doesn't exist
          steps.push({ intro: d.fallback });
        }
      } else {
        // Floating step (no element)
        steps.push({ intro: d.intro });
      }
    }
    return steps;
  }

  // ── Welcome tour: header elements + point to help button ──────────────────
  function startWelcomeTour() {
    if (typeof introJs === 'undefined') {
      if (typeof ensureIntroJs === 'function') {
        ensureIntroJs(startWelcomeTour);
      }
      return;
    }

    var steps = [
      { element: '#hero-strip', intro: '<strong>Hero Strip</strong><br>Your key session stats at a glance: total hands played, win rate, net profit/loss, VPIP (how often you voluntarily enter pots), aggression rate, and how you handle all-in situations.', position: 'bottom' },
      { element: '#bb-toggle', intro: '<strong>Dollar / BB Toggle</strong><br>Switch between dollar amounts and Big Blind units. BB mode normalises your stats so you can compare performance across different stakes.', position: 'bottom' },
      { element: '#table-filter', intro: '<strong>Table Filter</strong><br>Filter your entire analysis to a single table or stake level. All tabs update to show only hands from the selected table.', position: 'bottom' },
      { element: '#page-meta', intro: '<strong>Player Info</strong><br>Shows your name, export date, and hand count. Click it to view your player profile.', position: 'bottom' },
      { element: '#tabs', intro: '<strong>Analysis Tabs</strong><br>Each tab dives deep into a different part of your game - hand types, position, betting patterns, opponents, and more.', position: 'bottom' },
      { element: '.welcome-toc', intro: '<strong>Table of Contents</strong><br>Quick links to every analysis tab. Click any row to jump straight there.', position: 'top' },
      { element: '.welcome-tips', intro: '<strong>Tips</strong><br>Rotating tips to help you get the most out of the tool. Use the arrows to browse.', position: 'top' },
      { element: '#tour-btn', intro: '<strong>Page Help</strong><br>Every tab has this <strong>?</strong> button in the header. Click it on any tab to get a guided walkthrough of everything on that page.', position: 'left' }
    ];

    var intro = introJs();
    intro.setOptions(tourOptions);
    intro.setOptions({ steps: steps });
    intro.start();
  }

  // ── Per-tab tour definitions ──────────────────────────────────────────────
  // Each step: { el, intro, pos, fallback }
  //   el: CSS selector to target (within the panel)
  //   intro: HTML shown in the tooltip
  //   pos: tooltip position
  //   fallback: if el not found, show this as a floating tooltip instead (optional)

  var tabTourSteps = {
    cards: [
      { el: '.panel-title', intro: '<strong>Cards</strong><br>This tab breaks down your performance by starting hand category - pocket pairs, broadway, suited connectors, ace-rag, and more.', pos: 'bottom' },
      { el: '.ht-stack-legend', intro: '<strong>Legend</strong><br>The colour key: green = hands won, blue = hands played but lost, grey = hands dealt but folded preflop.', pos: 'bottom' },
      { el: '.ht-stack-item', intro: '<strong>Hand Type Bars</strong><br>Each bar shows a hand category. The wider the green segment, the better your win rate. The number on the right is your win percentage for that type.', pos: 'top' },
      { el: '.ins-grid', intro: '<strong>Insights</strong><br>Automated analysis of your hand type performance. Green = strength, red = leak, amber = caution. Click "See example hand" to view a real hand from your session.', pos: 'top',
        fallback: '<strong>Insights</strong><br>When enough data is available, insight cards appear here highlighting strengths and leaks in your hand selection. Play more hands to unlock them.' }
    ],
    position: [
      { el: '.panel-title', intro: '<strong>Position</strong><br>How you perform from each seat: UTG, MP, CO, BTN, SB, BB. Position is one of the biggest edges in poker.', pos: 'bottom' },
      { el: '.tbl', intro: '<strong>Position Table</strong><br>Stats from each seat: hands played, VPIP, fold rate preflop, win rate, P&L, and average pot size. Look for positions where you leak chips.', pos: 'top' },
      { el: '.chart-wrap-full', intro: '<strong>Position Chart</strong><br>Win rate and VPIP plotted by position. Ideally win rate is highest in late position (BTN, CO) where you have more information.', pos: 'top',
        fallback: '<strong>Position Chart</strong><br>A chart comparing win rate and VPIP by position appears here when you have enough data from multiple seats.' },
      { el: '.ins-grid', intro: '<strong>Position Insights</strong><br>Highlights your strongest and weakest seats. Red cards flag positions where you lose the most.', pos: 'top',
        fallback: '<strong>Position Insights</strong><br>Insight cards appear here when your data reveals position-specific patterns. Play more hands to unlock them.' }
    ],
    street: [
      { el: '.panel-title', intro: '<strong>Streets</strong><br>How your play changes across each betting round: Preflop, Flop, Turn, and River.', pos: 'bottom' },
      { el: '.two-col', intro: '<strong>Street Stats</strong><br>Left: how many hands reach each street. Right: your fold rate on each street. A high flop fold rate may mean you\'re entering too many pots preflop.', pos: 'top' },
      { el: '.chart-wrap-full', intro: '<strong>Action Chart</strong><br>Stacked bars showing your fold/check/call/raise split on each street. Look for streets where you\'re too passive (lots of checking and calling).', pos: 'top',
        fallback: '<strong>Action Chart</strong><br>A stacked bar chart showing your action breakdown per street appears here with enough hand data.' },
      { el: '.ins-grid', intro: '<strong>Street Insights</strong><br>Flags patterns like folding too often on the flop, or not being aggressive enough on the turn.', pos: 'top',
        fallback: '<strong>Street Insights</strong><br>Insight cards appear here when patterns are detected in your street-by-street play.' }
    ],
    actions: [
      { el: '.panel-title', intro: '<strong>Betting</strong><br>Action frequencies, bet sizing, and situational stats across all streets.', pos: 'bottom' },
      { el: '.mini-row', intro: '<strong>Action Totals</strong><br>Total action count broken into folds, checks, calls, and raises, plus your overall aggression percentage.', pos: 'bottom' },
      { el: '.stack-bar', intro: '<strong>Action Split Bar</strong><br>Visual breakdown of your frequencies. Red = fold, green = raise, amber = call, grey = check. A healthy profile has more green than red.', pos: 'top' },
      { el: '.tbl', intro: '<strong>Actions by Street</strong><br>How your action mix changes from preflop through the river. Look for streets where you become too passive.', pos: 'top' },
      { el: '.bar-group', intro: '<strong>Situational Stats</strong><br>Key spots like C-Bet rate, donk bet frequency, fold to 3-bet, and more. These pinpoint specific leaks in your game.', pos: 'top' },
      { el: '.two-col', intro: '<strong>Bet Sizing</strong><br>Average bet size and bet frequency on each street. Use BB mode in the header to compare across stakes.', pos: 'top' },
      { el: '.ins-grid', intro: '<strong>Betting Insights</strong><br>Automated flags for action and sizing patterns.', pos: 'top',
        fallback: '<strong>Betting Insights</strong><br>Insight cards appear here when your betting patterns reveal specific leaks or strengths.' }
    ],
    range: [
      { el: '.panel-title', intro: '<strong>Range</strong><br>The classic 13x13 hand matrix showing every possible starting hand combination.', pos: 'bottom' },
      { el: '#range-pos-filter', intro: '<strong>Position Filter</strong><br>Filter the grid to see which hands you play from specific positions. Great for reviewing your opening range by seat.', pos: 'bottom' },
      { el: '.range-grid-sm', intro: '<strong>Hand Matrix</strong><br>Every starting hand combo colour-coded by win rate. Darker green = higher win rate. <strong>Click any cell</strong> to see example hands you played with that combo.', pos: 'top' },
      { el: '.range-legend', intro: '<strong>Legend</strong><br>Colour scale for win rate and play frequency. Use this to read the grid at a glance.', pos: 'top' },
      { el: '.ins-grid', intro: '<strong>Range Insights</strong><br>Analysis of your hand selection patterns and which combos are helping or hurting you.', pos: 'top',
        fallback: '<strong>Range Insights</strong><br>Insight cards appear here when your range data reveals patterns worth noting.' }
    ],
    tables: [
      { el: '.panel-title', intro: '<strong>Tables</strong><br>Compare your performance across different tables and stakes.', pos: 'bottom' },
      { el: '.tbl', intro: '<strong>Table Comparison</strong><br>Each table you\'ve played at with blinds, hands, VPIP, win rate, P&L, and average pot. Use the exclude buttons to remove specific tables from your overall analysis.', pos: 'top' },
      { el: '.ins-grid', intro: '<strong>Table Insights</strong><br>Highlights your most and least profitable stakes.', pos: 'top',
        fallback: '<strong>Table Insights</strong><br>Insight cards appear here when you have data across multiple tables.' }
    ],
    trends: [
      { el: '.panel-title', intro: '<strong>Trends</strong><br>How your game evolves over time across multiple sessions.', pos: 'bottom' },
      { el: '.trends-grid', intro: '<strong>Trend Charts</strong><br>Four charts tracking your cumulative win rate, VPIP, aggression, and net P&L over time. Look for upward or downward trends in your play.', pos: 'top',
        fallback: '<strong>Trend Charts</strong><br>Session-over-session charts appear here when you have data from multiple sessions.' },
      { el: '.tbl', intro: '<strong>Session Breakdown</strong><br>A table showing each session\'s stats: date, hand count, win rate, and cumulative results.', pos: 'top' },
      { el: '.ins-grid', intro: '<strong>Trend Insights</strong><br>Flags improving or declining patterns in your play over time.', pos: 'top',
        fallback: '<strong>Trend Insights</strong><br>Insight cards appear here when trends are detected across your sessions.' }
    ],
    showdown: [
      { el: '.panel-title', intro: '<strong>Showdown</strong><br>Breaks down your profit into showdown (you showed cards) vs non-showdown (opponents folded).', pos: 'bottom' },
      { el: '.chart-wrap-full', intro: '<strong>Blue/Red Line Chart</strong><br>Blue line = showdown winnings (pots won at showdown). Red line = non-showdown winnings (pots won when opponents folded). A healthy game has both lines trending up.', pos: 'top',
        fallback: '<strong>Blue/Red Line</strong><br>A chart showing your showdown vs non-showdown profit curves appears here. Blue = won at showdown, red = won without showdown.' },
      { el: '.mini-row', intro: '<strong>Showdown Stats</strong><br>Total showdown and non-showdown profits side by side. If your red line is deeply negative, opponents aren\'t folding enough to your bets.', pos: 'top' },
      { el: '.ins-grid', intro: '<strong>Showdown Insights</strong><br>Analysis of your showdown patterns and where your profit comes from.', pos: 'top',
        fallback: '<strong>Showdown Insights</strong><br>Insight cards appear here when your showdown data reveals meaningful patterns.' }
    ],
    log: [
      { el: '.panel-title', intro: '<strong>Hand Log</strong><br>Every hand from your session, searchable and sortable.', pos: 'bottom' },
      { el: '.hlog-tbl', intro: '<strong>Hand Table</strong><br>Each row shows position, hole cards, board, action summary, and result. <strong>Click any row</strong> to open a full hand replay with every action, pot sizes, and coaching notes.', pos: 'top' },
      { el: '.hrow-star', intro: '<strong>Star Hands</strong><br>Click the star on any hand to save it for later review. Starred hands appear in the Saved Hands section at the top of this page.', pos: 'left' },
      { el: '.saved-section', intro: '<strong>Saved Hands</strong><br>Your starred hands for study. Each card shows hole cards, board, and result. Click to replay. Add notes to remember what you were thinking.', pos: 'top',
        fallback: '<strong>Saved Hands</strong><br>When you star hands using the star button, they appear in a saved section at the top of this page for easy review.' },
      { el: null, intro: '<strong>Equity Simulation</strong><br>Inside any hand replay, look for the <strong>Run Equity Simulation</strong> button. It runs a Monte Carlo simulation calculating your equity (chance of winning) on each street against a random hand. It compares your actual calls, raises, and folds against the mathematical pot odds - showing whether each decision was profitable.' }
    ],
    allin: [
      { el: '.panel-title', intro: '<strong>All-In EV</strong><br>This tab finds every hand where you went all-in at showdown and calculates whether you ran lucky or unlucky. It compares your actual results against your mathematical expected value.', pos: 'bottom' },
      { el: '#allin-run-btn', intro: '<strong>Run Equity Simulation</strong><br>Click this to calculate your equity (win probability) for each all-in hand using Monte Carlo simulation. The panel detects all-in hands automatically - this button runs the math.', pos: 'bottom',
        fallback: '<strong>Run Equity Simulation</strong><br>Once all-in hands are detected, a button appears to run equity calculations. After simulation, you\'ll see EV diff, fair share, and a cumulative graph.' },
      { el: '.allin-table-wrap', intro: '<strong>All-In Hands Table</strong><br>Every detected all-in showdown with your hole cards, opponent cards, board, street, pot size, and result. <strong>Click any row</strong> to replay the full hand.', pos: 'top',
        fallback: '<strong>All-In Hands Table</strong><br>A table listing every all-in showdown appears here when all-in hands are found in your data.' },
      { el: '.mini-row', intro: '<strong>Summary Stats</strong><br>Total all-in hands, cumulative EV difference (how much above or below expectation you\'re running), equity win rate (how often you were the favourite), and actual win rate.', pos: 'top',
        fallback: '<strong>Summary Stats</strong><br>After running the simulation, summary stats appear showing your EV diff, equity win rate, and actual win rate across all all-in hands.' },
      { el: '#allin-ev-chart', intro: '<strong>EV Graph</strong><br>Gold line = your actual cumulative results. Dashed line = expected value based on equity. If gold is above the dashed line, you\'re running hot. Below means you\'re running cold.', pos: 'top',
        fallback: '<strong>EV Graph</strong><br>After simulation, a cumulative graph shows your actual results vs expected value over time. The gap between the lines is your variance.' },
      { el: '.ins-grid', intro: '<strong>EV Insights</strong><br>Flags whether you\'re running hot or cold, if you\'re frequently all-in as an underdog, or if negative variance is masking good play.', pos: 'top',
        fallback: '<strong>EV Insights</strong><br>Insight cards appear after simulation when patterns are found - running hot/cold, underdog frequency, or variance masking good decisions.' }
    ],
    players: [
      { el: '.panel-title', intro: '<strong>Players</strong><br>Stats on every opponent you\'ve faced, with watch lists and head-to-head comparison.', pos: 'bottom' },
      { el: '#open-compare-btn', intro: '<strong>Compare Players</strong><br>Opens a head-to-head comparison modal where you can compare any two players side by side with stats, shared hands, and exploit tips.', pos: 'bottom' },
      { el: '#player-search', intro: '<strong>Search</strong><br>Type a player name to find them quickly in your opponent list.', pos: 'bottom' },
      { el: '.players-table-scroll', intro: '<strong>Opponent Table</strong><br>Every opponent with VPIP, PFR, limp rate, fold-to-raise, and showdown stats. <strong>Click any row</strong> to see their full profile: tendencies, exploit suggestions, and every hand you\'ve played together.', pos: 'top' },
      { el: '.watch-star', intro: '<strong>Watch List</strong><br>Click the star next to any player to add them to your watch list. Watched players appear in a section at the top so you can track key opponents across sessions.', pos: 'left' },
      { el: '.ins-grid', intro: '<strong>Player Insights</strong><br>Your most-seen opponents, best/worst records, and flags for exploitable tendencies.', pos: 'top',
        fallback: '<strong>Player Insights</strong><br>Insight cards appear here highlighting your most-seen opponents, best/worst records, and exploitable tendencies.' }
    ]
  };

  function startTabTour() {
    if (typeof introJs === 'undefined') {
      if (typeof ensureIntroJs === 'function') {
        ensureIntroJs(startTabTour);
      }
      return;
    }

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

    var steps = buildSteps(panel, defs);
    if (!steps.length) return;

    var intro = introJs();
    intro.setOptions(tourOptions);
    intro.setOptions({ steps: steps });
    intro.start();
  }

  // Expose globally
  window.startWelcomeTour = startWelcomeTour;
  window.startGuidedTour = startTabTour;

})();
