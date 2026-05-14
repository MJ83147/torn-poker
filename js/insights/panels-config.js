// ── PANELS CONFIG ─────────────────────────────────────────────────────────────
//
// Plain-English mapping of the 12 panels to which stories appear in each.
// Panels do not own logic. They render whatever stories list them as their
// home panel.
//
// The actual panel-to-story link lives ON THE STORY (each story declares its
// `panel` property). This file is the human-readable index of that mapping
// and the documented set of valid panel names.

(function() {
  // Canonical panel names used by stories. Keep in sync with the home-panel
  // value on each story.
  var PANELS = {
    Welcome: 'Welcome',                     // onboarding only, no stories
    MyGame: 'My Game',                      // strengths, weaknesses, play-style summaries
    TablesAndTrends: 'Tables and Trends',   // session and tilt
    Range: 'Range',                         // hand selection (preflop hole cards)
    Cards: 'Cards',                         // played-hand outcome (made-hand journey)
    Position: 'Position',                   // position story
    Street: 'Street',                       // raw data only, no stories
    Betting: 'Betting',                     // preflop init/defence, postflop with/without
                                            // initiative, postflop defence, sizing, agg style
    Showdown: 'Showdown',                   // showdown story
    AllInEV: 'All-In EV',                   // all-in and stack-off story
    HandLog: 'Hand Log',                    // raw data only, no stories
    Players: 'Players'                      // opponent adjustment story
  };

  // Documentation of which stories belong to each panel. The actual binding is
  // on the story spec; this is the readable view for humans.
  var STORIES_BY_PANEL = {
    'Welcome': [],
    'My Game': ['top-strengths', 'top-weaknesses', 'play-style'],
    'Tables and Trends': ['session-and-tilt'],
    'Range': ['width-of-range', 'winning-hands'],
    'Cards': ['played-hand-outcome'],
    'Position': ['position'],
    'Street': [],
    'Betting': [
      'preflop-initiative',
      'preflop-defence',
      'postflop-aggression-with-initiative',
      'postflop-aggression-without-initiative',
      'postflop-defence',
      'sizing-patterns',
      'aggression-style'
    ],
    'Showdown': ['showdown'],
    'All-In EV': ['all-in-and-stack-off'],
    'Hand Log': [],
    'Players': ['opponent-adjustment']
  };

  window.Insights.PANELS = PANELS;
  window.Insights.STORIES_BY_PANEL = STORIES_BY_PANEL;
})();
