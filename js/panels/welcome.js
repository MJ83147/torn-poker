// Home / hubs logic: the areas taxonomy (which pages live where and how each
// is described) and the home-page content. Views: js/panels/views/welcome.js.

var AREAS = [
  {
    id: 'sum',
    label: 'Summary',
    blurb: 'The big picture: your style, your biggest strengths and leaks, and how you are trending session over session.',
    lead: 'Your game at a glance: where you stand, and which way you are heading.',
    groups: [
      { label: null, pages: [
        { tab: 'mygame', name: 'My Game', desc: 'Your playing style, biggest strengths, a leak finder, and a short list of what to work on next.' },
        { tab: 'trends', name: 'Trends', desc: 'Session over session charts for win rate, VPIP and P&L. Spot hot streaks, slumps and slow drifts.' },
      ] },
    ],
  },
  {
    id: 'brk',
    label: 'Breakdown',
    blurb: 'Slice your play every way that matters: by cards, range, position and street, plus how you bet, show down, and run all in.',
    lead: 'Every angle on how you play a hand, split into hand analysis and betting.',
    groups: [
      { label: 'Hand analysis', pages: [
        { tab: 'cards', name: 'Cards', desc: 'Win rates by hand type: pairs, broadway, suited connectors and more.' },
        { tab: 'range', name: 'Range', desc: 'Your play and win rate by hand, plus a 13&times;13 GTO comparison by spot.' },
        { tab: 'position', name: 'Position', desc: 'How you perform from each seat at the table.' },
        { tab: 'street', name: 'Streets', desc: 'Action breakdown by preflop, flop, turn and river.' },
      ] },
      { label: 'Betting', pages: [
        { tab: 'actions', name: 'Betting', desc: 'Action frequencies, bet sizing and situational stats.' },
        { tab: 'showdown', name: 'Showdown', desc: 'How often you reach showdown and how you fare once you get there.' },
        { tab: 'allin', name: 'All-In EV', desc: 'Your luck tracker: equity at the moment you got all in versus how the hands finished.' },
      ] },
    ],
  },
  {
    id: 'his',
    label: 'History',
    blurb: 'The record of every session, table and hand you have played, plus analysis of the opponents you have faced.',
    lead: 'The full record of your play: every session, table, hand and opponent.',
    groups: [
      { label: null, pages: [
        { tab: 'sessions', name: 'Sessions', desc: 'Each session you have played, laid out sit by sit: how your stack moved, and where you tilted, tired or leaked.' },
        { tab: 'tables', name: 'Tables', desc: 'An aggregate of how you play at each table and stake.' },
        { tab: 'log', name: 'Hand Log', desc: 'Every hand you have played. Click any row to replay it.' },
        { tab: 'players', name: 'Players', desc: 'Opponent analysis: how each one plays, how to exploit them, and your P&amp;L against them.' },
      ] },
    ],
  },
];

function areaById(id) {
  for (var i = 0; i < AREAS.length; i++) if (AREAS[i].id === id) return AREAS[i];
  return null;
}

// Rotating one-line tips on the home page. Not to be confused with the global
// TIPS tooltip map in helpers/ui.js.
var HOME_TIPS = [
  'Click any hand on the Range grid to see exactly when you played it.',
  'Insight cards have a &ldquo;See example hand&rdquo; button showing a real hand from your data.',
  'In Players, click any row to see shared hands. Star a player to watch them.',
  'Use the table filter in the header to isolate every stat to one table.',
];

// What's-new carousel slides. goto (optional) makes the card a link to a tab.
var WHATS_NEW = [
  {
    badge: 'New', title: 'Custom Report', goto: 'custom',
    paras: ['Want to dig into a specific part of your play? Answer questions like &ldquo;how do I play the button?&rdquo; or &ldquo;how do I play when I&rsquo;m short stacked?&rdquo; Pick your filters and get a full breakdown of how you play in exactly that spot.'],
    cta: 'Open the Custom Report &rarr;',
  },
  {
    badge: 'New', title: 'Stack tracking',
    paras: [
      'The tracker now saves every player&rsquo;s starting and ending stack on each hand, so you can see how deep the effective stacks were and spot who was short.',
      'Applies to hands tracked from now on. Hands already in your history stay as they are and sit out any stack based stats.',
    ],
  },
  {
    badge: 'Improved', title: 'Detailed insights',
    paras: ['Every analysis page now calls out the strengths, leaks and patterns in your play, with example hands from your sessions to show each one.'],
  },
];

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
