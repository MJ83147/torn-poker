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

  // Uses getBoundingClientRect (works even when offsetParent is null, e.g.
  // inside canvas or overflow containers).
  function findEl(panel, sel) {
    var el = panel.querySelector(sel);
    if (!el) return null;
    var rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return null;
    return el;
  }

  function buildSteps(panel, defs) {
    var steps = [];
    for (var i = 0; i < defs.length; i++) {
      var d = defs[i];
      if (d.el) {
        var el = findEl(panel, d.el);
        if (el) {
          steps.push({ element: el, intro: d.intro, position: d.pos || 'top' });
        } else if (d.fallback) {
          steps.push({ intro: d.fallback });
        }
      } else {
        steps.push({ intro: d.intro });
      }
    }
    return steps;
  }

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
      { element: '#tab-nav', intro: '<strong>Tab Menu</strong><br>Tabs are grouped: Overview, Hand Analysis, Betting, and Session. Hover a group to open it and pick a tab. Each one drills into a different part of your game.', position: 'bottom' },
      { element: '.welcome-toc', intro: '<strong>Table of Contents</strong><br>Quick links to every analysis tab. Click any row to jump straight there.', position: 'top' },
      { element: '.welcome-tips', intro: '<strong>Tips</strong><br>Rotating tips to help you get the most out of the tool. Use the arrows to browse.', position: 'top' },
      { element: '#tour-btn', intro: '<strong>Page Help</strong><br>Every tab has this <strong>?</strong> button in the header. Click it on any tab to get a guided walkthrough of everything on that page.', position: 'left' }
    ];

    var intro = introJs();
    intro.setOptions(tourOptions);
    intro.setOptions({ steps: steps });
    intro.start();
  }

  var tabTourSteps = {
    cards: [
      { el: '.panel-title', intro: '<strong>Cards</strong><br>This tab breaks down your performance by starting hand category: pocket pairs, broadway, suited connectors, ace-rag, and more.', pos: 'bottom' },
      { el: '.ht-stack-legend', intro: '<strong>Legend</strong><br>The colour key: green = hands won, blue = hands played but lost, grey = hands dealt but folded preflop.', pos: 'bottom' },
      { el: '.ht-stack-item', intro: '<strong>Hand Type Bars</strong><br>Each bar shows a hand category. The wider the green segment, the better your win rate. The number on the right is your win percentage for that type.', pos: 'top' },
      { el: '.story-grid', intro: '<strong>Story</strong><br>Plain-English findings about your hand-type performance, ranked by impact. Click any card to expand the breakdown and jump to an example hand.', pos: 'top',
        fallback: '<strong>Story</strong><br>Story cards appear here once you have enough hands. They call out your strongest and leakiest hand types in plain English.' }
    ],
    position: [
      { el: '.panel-title', intro: '<strong>Position</strong><br>How you perform from each seat: UTG, MP, CO, BTN, SB, BB. Position is one of the biggest edges in poker.', pos: 'bottom' },
      { el: '.tbl', intro: '<strong>Position Table</strong><br>Stats from each seat: hands played, VPIP, fold rate preflop, win rate, P&L, and average pot size. Look for positions where you leak chips.', pos: 'top' },
      { el: '.chart-wrap-full', intro: '<strong>Position Chart</strong><br>Win rate and VPIP plotted by position. Ideally win rate is highest in late position (BTN, CO) where you have more information.', pos: 'top',
        fallback: '<strong>Position Chart</strong><br>A chart comparing win rate and VPIP by position appears here when you have enough data from multiple seats.' },
      { el: '.story-grid', intro: '<strong>Position Story</strong><br>Plain-English findings about your seat-by-seat play, ranked by impact. Each card expands for the breakdown and a click-through to an example hand.', pos: 'top',
        fallback: '<strong>Position Story</strong><br>Story cards appear here once your data reveals position-specific patterns. Play more hands from each seat to unlock them.' }
    ],
    street: [
      { el: '.panel-title', intro: '<strong>Streets</strong><br>How your play changes across each betting round: Preflop, Flop, Turn, and River.', pos: 'bottom' },
      { el: '.two-col', intro: '<strong>Street Stats</strong><br>Left: how many hands reach each street. Right: your fold rate on each street. A high flop fold rate may mean you\'re entering too many pots preflop.', pos: 'top' },
      { el: '.chart-wrap-full', intro: '<strong>Action Chart</strong><br>Stacked bars showing your fold/check/call/raise split on each street. Look for streets where you\'re too passive (lots of checking and calling).', pos: 'top',
        fallback: '<strong>Action Chart</strong><br>A stacked bar chart showing your action breakdown per street appears here with enough hand data.' },
      { el: '.story-grid', intro: '<strong>Street Story</strong><br>Plain-English findings about your play across the four streets, ranked by impact. Each card expands for the breakdown and a click-through to an example hand.', pos: 'top',
        fallback: '<strong>Street Story</strong><br>Story cards appear here once patterns emerge in your street-by-street play.' }
    ],
    actions: [
      { el: '.panel-title', intro: '<strong>Betting</strong><br>Action frequencies, bet sizing, and situational stats across all streets.', pos: 'bottom' },
      { el: '.mini-row', intro: '<strong>Action Totals</strong><br>Total action count broken into folds, checks, calls, and raises, plus your overall aggression percentage.', pos: 'bottom' },
      { el: '.stack-bar', intro: '<strong>Action Split Bar</strong><br>Visual breakdown of your frequencies. Red = fold, green = raise, amber = call, grey = check. A healthy profile has more green than red.', pos: 'top' },
      { el: '.bar-group', intro: '<strong>Situational Stats</strong><br>Key spots like C-Bet rate, donk bet frequency, fold to 3-bet, and more. These pinpoint specific leaks in your game.', pos: 'top' },
      { el: '.two-col', intro: '<strong>Bet Sizing</strong><br>Average bet size and bet frequency on each street. Use BB mode in the header to compare across stakes.', pos: 'top' },
      { el: '.story-grid', intro: '<strong>Betting Story</strong><br>Plain-English findings about your action mix and bet sizing, ranked by impact. Each card expands for the breakdown and a click-through to an example hand.', pos: 'top',
        fallback: '<strong>Betting Story</strong><br>Story cards appear here once your betting patterns reveal specific leaks or strengths.' }
    ],
    range: [
      { el: '.panel-title', intro: '<strong>Range</strong><br>The classic 13x13 hand matrix showing every possible starting hand combination.', pos: 'bottom' },
      { el: '#range-pos-filter', intro: '<strong>Position Filter</strong><br>Filter the grid to see which hands you play from specific positions. Great for reviewing your opening range by seat.', pos: 'bottom' },
      { el: '.range-grid-sm', intro: '<strong>Hand Matrix</strong><br>Every starting hand combo colour-coded by win rate. Darker green = higher win rate. <strong>Click any hand</strong> to see when you played it.', pos: 'top' },
      { el: '.range-legend', intro: '<strong>Legend</strong><br>Colour scale for win rate and play frequency. Use this to read the grid at a glance.', pos: 'top' },
      { el: '.story-grid', intro: '<strong>Range Story</strong><br>Plain-English findings about your hand selection, ranked by impact. Each card expands for the breakdown and a click-through to an example hand.', pos: 'top',
        fallback: '<strong>Range Story</strong><br>Story cards appear here once your range data reveals patterns worth noting.' }
    ],
    tables: [
      { el: '.panel-title', intro: '<strong>Tables</strong><br>Compare your performance across different tables and stakes.', pos: 'bottom' },
      { el: '.tbl', intro: '<strong>Table Comparison</strong><br>Each table you\'ve played at with blinds, hands, VPIP, win rate, P&L, and average pot. Use the exclude buttons to remove specific tables from your overall analysis.', pos: 'top' },
      { el: '.story-grid', intro: '<strong>Table Story</strong><br>Plain-English findings about your performance across tables and stakes, ranked by impact. Each card expands for the breakdown and a click-through to an example hand.', pos: 'top',
        fallback: '<strong>Table Story</strong><br>Story cards appear here once you have data across multiple tables.' }
    ],
    trends: [
      { el: '.panel-title', intro: '<strong>Trends</strong><br>How your game evolves over time across multiple sessions.', pos: 'bottom' },
      { el: '.trends-grid', intro: '<strong>Trend Charts</strong><br>Four charts tracking your cumulative win rate, VPIP, aggression, and net P&L over time. Look for upward or downward trends in your play.', pos: 'top',
        fallback: '<strong>Trend Charts</strong><br>Session-over-session charts appear here when you have data from multiple sessions.' },
      { el: '.tbl', intro: '<strong>Session Breakdown</strong><br>A table showing each session\'s stats: date, hand count, win rate, and cumulative results.', pos: 'top' },
      { el: '.story-grid', intro: '<strong>Trend Story</strong><br>Plain-English findings about how your game is moving session over session, ranked by impact. Each card expands for the breakdown and a click-through to an example hand.', pos: 'top',
        fallback: '<strong>Trend Story</strong><br>Story cards appear here once trends are detected across your sessions.' }
    ],
    showdown: [
      { el: '.panel-title', intro: '<strong>Showdown</strong><br>Breaks down your profit into showdown (you showed cards) vs non-showdown (opponents folded).', pos: 'bottom' },
      { el: '.chart-wrap-full', intro: '<strong>Blue/Red Line Chart</strong><br>Blue line = showdown winnings (pots won at showdown). Red line = non-showdown winnings (pots won when opponents folded). A healthy game has both lines trending up.', pos: 'top',
        fallback: '<strong>Blue/Red Line</strong><br>A chart showing your showdown vs non-showdown profit curves appears here. Blue = won at showdown, red = won without showdown.' },
      { el: '.mini-row', intro: '<strong>Showdown Stats</strong><br>Total showdown and non-showdown profits side by side. If your red line is deeply negative, opponents aren\'t folding enough to your bets.', pos: 'top' },
      { el: '.story-grid', intro: '<strong>Showdown Story</strong><br>Plain-English findings about your showdown vs non-showdown profit, ranked by impact. Each card expands for the breakdown and a click-through to an example hand.', pos: 'top',
        fallback: '<strong>Showdown Story</strong><br>Story cards appear here once your showdown data reveals meaningful patterns.' }
    ],
    log: [
      { el: '.panel-title', intro: '<strong>Hand Log</strong><br>Every hand from your session, searchable and sortable.', pos: 'bottom' },
      { el: '.hlog-tbl', intro: '<strong>Hand Table</strong><br>Each row shows position, hole cards, board, action summary, and result. <strong>Click any row</strong> to open a full hand replay with every action, pot sizes, and coaching notes.', pos: 'top' },
      { el: '.hrow-star', intro: '<strong>Star Hands</strong><br>Click the star on any hand to save it for later review. Starred hands appear in the Saved Hands section at the top of this page.', pos: 'left' },
      { el: '.saved-section', intro: '<strong>Saved Hands</strong><br>Your starred hands for study. Each card shows hole cards, board, and result. Click to replay. Add notes to remember what you were thinking.', pos: 'top',
        fallback: '<strong>Saved Hands</strong><br>When you star hands using the star button, they appear in a saved section at the top of this page for easy review.' },
      { el: null, intro: '<strong>Equity Simulation</strong><br>Inside any hand replay, look for the <strong>Run Equity Simulation</strong> button. It runs a Monte Carlo simulation calculating your equity (chance of winning) on each street against a random hand. It compares your actual calls, raises, and folds against the mathematical pot odds, showing whether each decision was profitable.' }
    ],
    allin: [
      { el: '.panel-title', intro: '<strong>All-In EV</strong><br>This tab finds every hand where you went all-in at showdown and calculates whether you ran lucky or unlucky. It compares your actual results against your mathematical expected value.', pos: 'bottom' },
      { el: '#allin-run-btn', intro: '<strong>Run Equity Simulation</strong><br>Click this to calculate your equity (win probability) for each all-in hand using Monte Carlo simulation. The panel detects all-in hands automatically. This button runs the math.', pos: 'bottom',
        fallback: '<strong>Run Equity Simulation</strong><br>Once all-in hands are detected, a button appears to run equity calculations. After simulation, you\'ll see EV diff, fair share, and a cumulative graph.' },
      { el: '.allin-table-wrap', intro: '<strong>All-In Hands Table</strong><br>Every detected all-in showdown with your hole cards, opponent cards, board, street, pot size, and result. <strong>Click any row</strong> to replay the full hand.', pos: 'top',
        fallback: '<strong>All-In Hands Table</strong><br>A table listing every all-in showdown appears here when all-in hands are found in your data.' },
      { el: '.mini-row', intro: '<strong>Summary Stats</strong><br>Total all-in hands, cumulative EV difference (how much above or below expectation you\'re running), equity win rate (how often you were the favourite), and actual win rate.', pos: 'top',
        fallback: '<strong>Summary Stats</strong><br>After running the simulation, summary stats appear showing your EV diff, equity win rate, and actual win rate across all all-in hands.' },
      { el: '#allin-ev-chart', intro: '<strong>EV Graph</strong><br>Gold line = your actual cumulative results. Dashed line = expected value based on equity. If gold is above the dashed line, you\'re running hot. Below means you\'re running cold.', pos: 'top',
        fallback: '<strong>EV Graph</strong><br>After simulation, a cumulative graph shows your actual results vs expected value over time. The gap between the lines is your variance.' },
      { el: '.story-grid', intro: '<strong>EV Story</strong><br>Plain-English findings about variance: running hot or cold, underdog frequency, and whether luck is masking good or bad decisions. Each card expands for the breakdown.', pos: 'top',
        fallback: '<strong>EV Story</strong><br>Story cards appear after the simulation runs and patterns emerge: running hot or cold, underdog frequency, or variance masking good decisions.' }
    ],
    players: [
      { el: '.panel-title', intro: '<strong>Players</strong><br>Stats on every opponent you\'ve faced, with watch lists and head-to-head comparison.', pos: 'bottom' },
      { el: '#open-compare-btn', intro: '<strong>Compare Players</strong><br>Opens a head-to-head comparison modal where you can compare any two players side by side with stats, shared hands, and exploit tips.', pos: 'bottom' },
      { el: '#player-search', intro: '<strong>Search</strong><br>Type a player name to find them quickly in your opponent list.', pos: 'bottom' },
      { el: '.players-table-scroll', intro: '<strong>Opponent Table</strong><br>Every opponent with VPIP, PFR, limp rate, fold-to-raise, and showdown stats. <strong>Click any row</strong> to see their full profile: tendencies, exploit suggestions, and every hand you\'ve played together.', pos: 'top' },
      { el: '.watch-star', intro: '<strong>Watch List</strong><br>Click the star next to any player to add them to your watch list. Watched players appear in a section at the top so you can track key opponents across sessions.', pos: 'left' },
      { el: '.story-grid', intro: '<strong>Player Story</strong><br>Plain-English findings about your most-seen opponents, best/worst records, and exploitable tendencies, ranked by impact. Each card expands for the breakdown.', pos: 'top',
        fallback: '<strong>Player Story</strong><br>Story cards appear here once you have hands against enough opponents to call out your most-seen rivals and exploitable tendencies.' }
    ],
    mygame: [
      { el: '.profile-row', intro: '<strong>My Game</strong><br>Your snapshot: name, hand count, and the player-type label that summarises your current style.', pos: 'bottom' },
      { el: '.profile-type-block', intro: '<strong>Player Type</strong><br>An 8-label classifier (Tight-Aggressive, Loose-Passive, etc.) drawn from your VPIP, PFR and aggression. Updates as you log more hands.', pos: 'bottom',
        fallback: '<strong>Player Type</strong><br>Once you have around 30+ hands, a label like Tight-Aggressive or Loose-Passive appears here.' },
      { el: '.work-on-block', intro: '<strong>Work On Next</strong><br>The single biggest leak to focus on this session. The action line tells you exactly what to do over the next 20 hands.', pos: 'top',
        fallback: '<strong>Work On Next</strong><br>Once you have enough data, the single biggest leak to focus on appears here with a concrete drill.' },
      { el: '.dynamics-cards', intro: '<strong>Table Dynamics</strong><br>Your VPIP and aggression at each table size and flop multiplicity, compared to the recommended benchmarks for your target style. Green = on target, amber = too low, red = too high.', pos: 'top',
        fallback: '<strong>Table Dynamics</strong><br>You vs target stats appear here once you have hands at different table sizes.' },
      { el: '#mygame-stylemap', intro: '<strong>Style Map</strong><br>Plots your VPIP and aggression on the style quadrant so you can see at a glance where you sit and where you might be drifting.', pos: 'top' }
    ],
    custom: [
      { el: '.panel-title', intro: '<strong>Custom Report</strong><br>Build your own report. Pick a sentence, add clauses, and see how that subset of hands performed.', pos: 'bottom' },
      { el: '.cr-sentence-wrap', intro: '<strong>Sentence Builder</strong><br>Click any underlined word to swap it. The headline numbers and charts re-run live as you change clauses.', pos: 'bottom' },
      { el: '.cr-add-btn', intro: '<strong>Add a Clause</strong><br>Narrow the report further: position, street, opponent count, stack depth, and more. Combine clauses to drill into very specific spots.', pos: 'bottom',
        fallback: '<strong>Add a Clause</strong><br>The + add clause button sits at the end of each sentence so you can layer extra filters on the report.' },
      { el: '.cr-toolbar', intro: '<strong>Compare Mode</strong><br>Toggle "Compare two reports" to build a second sentence (B) and run an A/B head-to-head. Use Reset to start fresh.', pos: 'bottom' },
      { el: '.cr-headline', intro: '<strong>Headline Stats</strong><br>The core numbers for your current report: hands, win rate, bb/100, VPIP, aggression. In compare mode each tile shows A / Δ / B.', pos: 'top',
        fallback: '<strong>Headline Stats</strong><br>The core numbers appear here once your report has enough hands.' },
      { el: '.ins-grid', intro: '<strong>Insight Cards</strong><br>Auto-generated callouts when the report shows unusual win rate, positional skew, or action patterns vs your baseline.', pos: 'top',
        fallback: '<strong>Insight Cards</strong><br>Callouts appear here when the report shows patterns worth flagging.' },
      { el: '.cr-charts', intro: '<strong>Charts</strong><br>Four views of the report: bb/100 over time, bb/100 by position, win rate by hand class, and action breakdown. In compare mode each chart overlays A and B.', pos: 'top',
        fallback: '<strong>Charts</strong><br>Four breakdowns of the report appear here once the sentence matches enough hands.' }
    ]
  };

  function startTabTour() {
    if (typeof introJs === 'undefined') {
      if (typeof ensureIntroJs === 'function') {
        ensureIntroJs(startTabTour);
      }
      return;
    }

    var activeTab = document.querySelector('.tab-item.active');
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

  window.startWelcomeTour = startWelcomeTour;
  window.startGuidedTour = startTabTour;

})();
