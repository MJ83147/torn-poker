// ── GUIDED TOUR (Intro.js) ───────────────────────────────────────────────────

(function() {

  // Tour steps for the dashboard header (shown on every tab)
  var headerSteps = [
    {
      element: '#hero-strip',
      intro: '<strong>Hero Strip</strong><br>Your key stats at a glance: total hands, win rate, net P&L, VPIP (how often you voluntarily put money in), aggression, and how often you fold to all-ins.',
      position: 'bottom'
    },
    {
      element: '#bb-toggle',
      intro: '<strong>$ / BB Toggle</strong><br>Switch between dollar amounts and Big Blind units. BB mode lets you compare performance across different stakes.',
      position: 'bottom'
    },
    {
      element: '#tabs',
      intro: '<strong>Analysis Tabs</strong><br>Each tab breaks down a different aspect of your game. Click any tab to dive into that area.',
      position: 'bottom'
    }
  ];

  // Per-tab tour definitions
  var tabTours = {
    welcome: {
      title: 'Overview',
      steps: [
        {
          element: '#p-welcome',
          intro: '<strong>Overview</strong><br>Your session dashboard. Shows a summary of your play, a table of contents linking to every analysis tab, and rotating tips to improve your game.',
          position: 'top'
        }
      ]
    },
    cards: {
      title: 'Cards',
      steps: [
        {
          element: '#p-cards',
          intro: '<strong>Hand Types</strong><br>See how each category of starting hand performs: pocket pairs, broadway, suited connectors, ace-rag, and more. The stacked bars show how many you played, won, and skipped.',
          position: 'top'
        }
      ]
    },
    position: {
      title: 'Position',
      steps: [
        {
          element: '#p-position',
          intro: '<strong>Position Analysis</strong><br>Your performance from each seat at the table: UTG, MP, CO, BTN, SB, BB. Shows VPIP, fold rate, win rate, P&L, and average pot by position. Position is one of the biggest edges in poker.',
          position: 'top'
        }
      ]
    },
    street: {
      title: 'Streets',
      steps: [
        {
          element: '#p-street',
          intro: '<strong>Street Breakdown</strong><br>How you play on each street: Preflop, Flop, Turn, and River. See what percentage of hands reach each street, your fold rates, and average bet sizing by street.',
          position: 'top'
        }
      ]
    },
    actions: {
      title: 'Actions',
      steps: [
        {
          element: '#p-actions',
          intro: '<strong>Action Frequencies</strong><br>Your action breakdown across all streets: how often you fold, check, call, or raise. The coloured bars show your tendencies at each decision point.',
          position: 'top'
        }
      ]
    },
    bets: {
      title: 'Bets',
      steps: [
        {
          element: '#p-bets',
          intro: '<strong>Bet Sizing</strong><br>Your average bet size by street, shown in dollars or BB. Helps you spot if you\'re betting too small (giving odds) or too large (risking too much).',
          position: 'top'
        }
      ]
    },
    range: {
      title: 'Range',
      steps: [
        {
          element: '#p-range',
          intro: '<strong>Hand Matrix</strong><br>The classic 13x13 grid showing every possible starting hand. Colour-coded by win rate and frequency. Click any cell to see example hands you played with that combo.',
          position: 'top'
        }
      ]
    },
    tables: {
      title: 'Tables',
      steps: [
        {
          element: '#p-tables',
          intro: '<strong>Table Comparison</strong><br>Compare your stats across different stakes and table IDs. Find which stakes you perform best at, and exclude tables from your analysis if needed.',
          position: 'top'
        }
      ]
    },
    trends: {
      title: 'Trends',
      steps: [
        {
          element: '#p-trends',
          intro: '<strong>Session Trends</strong><br>Charts tracking your win rate, VPIP, aggression, and cumulative P&L over time. See if your game is improving or if leaks are developing.',
          position: 'top'
        }
      ]
    },
    showdown: {
      title: 'Showdown',
      steps: [
        {
          element: '#p-showdown',
          intro: '<strong>Showdown Analysis</strong><br>The blue line (showdown winnings) vs red line (non-showdown winnings). This reveals whether you profit more from winning at showdown or from opponents folding to your bets.',
          position: 'top'
        }
      ]
    },
    log: {
      title: 'Hand Log',
      steps: [
        {
          element: '#p-log',
          intro: '<strong>Hand Log</strong><br>A paginated table of every hand in your session. Sort by position or result, star important hands, and click any row to replay the full action with coaching notes and equity analysis.',
          position: 'top'
        }
      ]
    },
    players: {
      title: 'Players',
      steps: [
        {
          element: '#p-players',
          intro: '<strong>Opponent Stats</strong><br>Every player you\'ve faced with their VPIP, PFR, limp rate, fold-to-raise, and showdown stats. Add opponents to your watch list and click any player to see your head-to-head record.',
          position: 'top'
        }
      ]
    }
  };

  function getActiveTab() {
    var active = document.querySelector('.tab.active');
    return active ? active.dataset.tab : 'welcome';
  }

  function startTour() {
    if (typeof introJs === 'undefined') return;

    var activeTab = getActiveTab();
    var tabDef = tabTours[activeTab];
    var steps = headerSteps.concat(tabDef ? tabDef.steps : []);

    // Add insight cards if present on current panel
    var panel = document.getElementById('p-' + activeTab);
    if (panel) {
      var insight = panel.querySelector('.insight-card');
      if (insight) {
        steps.push({
          element: insight,
          intro: '<strong>Insight Cards</strong><br>Automated analysis highlights: green means strength, red means a leak, amber is a warning. These help you spot patterns you might miss.',
          position: 'top'
        });
      }
    }

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

  // Expose globally so the button can call it
  window.startGuidedTour = startTour;

})();
