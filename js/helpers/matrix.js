// ── TABLE-DYNAMICS MATRIX ─────────────────────────────────────────────────────
// Three-axis advisory model:
//   seats (2-9)     → drives preflop opening ranges, VPIP, position guides
//   flopBucket      → drives postflop sizing, c-bet, showdown value
//   stackBucket     → overall regime (short / mid / deep / very-deep)
//
// adviceFor({seats, position, flopBucket, stackBucket}) composes all three.

// ── Range building blocks ─────────────────────────────────────────────────────

var _RANGE_PAIRS_ALL   = ['AA','KK','QQ','JJ','TT','99','88','77','66','55','44','33','22'];
var _RANGE_SUITED_ACES = ['AKs','AQs','AJs','ATs','A9s','A8s','A7s','A6s','A5s','A4s','A3s','A2s'];
var _RANGE_SUITED_KINGS= ['KQs','KJs','KTs','K9s','K8s','K7s','K6s','K5s','K4s','K3s','K2s'];
var _RANGE_SUITED_Q    = ['QJs','QTs','Q9s','Q8s','Q7s','Q6s','Q5s','Q4s'];
var _RANGE_SUITED_J    = ['JTs','J9s','J8s','J7s','J6s'];
var _RANGE_SUITED_T    = ['T9s','T8s','T7s','T6s'];
var _RANGE_SUITED_LOW  = ['98s','97s','96s','87s','86s','76s','75s','65s','64s','54s','53s','43s'];
var _RANGE_OFFSUIT_BR  = ['AKo','AQo','AJo','ATo','KQo','KJo','KTo','QJo','QTo','JTo'];
var _RANGE_OFFSUIT_WIDE= ['A9o','A8o','A7o','A6o','A5o','K9o','Q9o','J9o','T9o','98o','87o'];

function _rangeSet(/* ...arrays */) {
  var s = new Set();
  for (var i = 0; i < arguments.length; i++) {
    var arr = arguments[i];
    for (var j = 0; j < arr.length; j++) s.add(arr[j]);
  }
  return s;
}

// ── SEAT_MATRIX ─────────────────────────────────────────────────────────────
// Keyed 2..9. Each entry:
//   positions:     ordered list of seats (earliest → latest)
//   rangesByPos:   { POS: Set<combo> }        - recommended open range at standard depth
//   guideByPos:    { POS: { ideal, tight, loose, desc } }
//   openRaise:     preflop sizing text
//   threeBet:      suggested 3-bet frequency text
//   cbetFreq:      seat-level c-bet default text
//   aggression:    one-line narrative about the regime
//   notes:         longer paragraph describing the table size

var SEAT_MATRIX = {};

// 2-handed (heads-up)
SEAT_MATRIX[2] = {
  positions: ['BTN', 'BB'],
  rangesByPos: {
    BTN: _rangeSet(
      _RANGE_PAIRS_ALL,
      _RANGE_SUITED_ACES, _RANGE_SUITED_KINGS, _RANGE_SUITED_Q, _RANGE_SUITED_J, _RANGE_SUITED_T, _RANGE_SUITED_LOW,
      _RANGE_OFFSUIT_BR, _RANGE_OFFSUIT_WIDE,
      ['K8o','K7o','Q8o','J8o','T8o','97o','86o','76o']
    ),
    BB: _rangeSet(
      _RANGE_PAIRS_ALL,
      _RANGE_SUITED_ACES, _RANGE_SUITED_KINGS, _RANGE_SUITED_Q, _RANGE_SUITED_J, _RANGE_SUITED_T, _RANGE_SUITED_LOW,
      _RANGE_OFFSUIT_BR, _RANGE_OFFSUIT_WIDE,
      ['K8o','K7o','K6o','Q8o','J8o','T8o','97o','86o','76o','65o']
    )
  },
  guideByPos: {
    BTN: { ideal: '80-90%', tight: 65, loose: 92, desc: 'In heads-up, the button is everything. You have position every street: play most hands, fold only complete trash (72o, 83o, 94o).' },
    BB:  { ideal: '70-85%', tight: 55, loose: 90, desc: 'Defend the big blind wide heads-up. The BTN will open ~80% of hands. Call or 3-bet back with anything reasonable.' }
  },
  openRaise:  '2-3x',
  threeBet:   'BB 3-bets 20-25% vs BTN',
  cbetFreq:   '70-80% of flops in position',
  aggression: 'Extremely aggressive. Fold equity is everything.',
  notes:      'Button is massive: you act first preflop but have position postflop. Play 80-90% of hands on the BTN, defend the BB wide. Postflop bet 33-66% pot, polarise to 75-100% on turn/river.'
};

// 3-handed
SEAT_MATRIX[3] = {
  positions: ['BTN', 'SB', 'BB'],
  rangesByPos: {
    BTN: _rangeSet(
      _RANGE_PAIRS_ALL,
      _RANGE_SUITED_ACES, _RANGE_SUITED_KINGS, _RANGE_SUITED_Q, _RANGE_SUITED_J, _RANGE_SUITED_T,
      ['98s','97s','87s','86s','76s','75s','65s','54s'],
      _RANGE_OFFSUIT_BR,
      ['A9o','A8o','A7o','K9o','Q9o','J9o','T9o']
    ),
    SB: _rangeSet(
      _RANGE_PAIRS_ALL,
      _RANGE_SUITED_ACES, _RANGE_SUITED_KINGS,
      ['QJs','QTs','Q9s','JTs','J9s','T9s','98s','87s','76s'],
      _RANGE_OFFSUIT_BR,
      ['A9o','A8o','K9o','Q9o']
    ),
    BB: _rangeSet(
      _RANGE_PAIRS_ALL,
      _RANGE_SUITED_ACES, _RANGE_SUITED_KINGS, _RANGE_SUITED_Q, _RANGE_SUITED_J, _RANGE_SUITED_T,
      _RANGE_SUITED_LOW,
      _RANGE_OFFSUIT_BR,
      ['A9o','A8o','A7o','K9o','Q9o','J9o','T9o','98o','87o']
    )
  },
  guideByPos: {
    BTN: { ideal: '60-70%', tight: 50, loose: 75, desc: 'Button is dominant 3-handed. Raise 60-70%: any pair, most suited cards, any broadway.' },
    SB:  { ideal: '40-50%', tight: 30, loose: 55, desc: 'Worst seat 3-handed: first to act preflop and postflop. 3-bet or fold vs BTN opens. Open 40-50% when folded to.' },
    BB:  { ideal: '50-65%', tight: 40, loose: 75, desc: 'Defend wide. Call or 3-bet vs BTN opens. Pot odds favour defending most playable hands.' }
  },
  openRaise:  '2.5-3x',
  threeBet:   'Blinds 3-bet 15-20%',
  cbetFreq:   '60-70% in position',
  aggression: 'Very aggressive. Button raises 60-70%.',
  notes:      'Button is dominant. Postflop 33-50% in position, 50-75% out of position. Polarise 75-100% on turn/river.'
};

// 4-handed
SEAT_MATRIX[4] = {
  positions: ['CO', 'BTN', 'SB', 'BB'],
  rangesByPos: {
    CO: _rangeSet(
      _RANGE_PAIRS_ALL,
      _RANGE_SUITED_ACES,
      ['KQs','KJs','KTs','K9s','QJs','QTs','Q9s','JTs','J9s','T9s','98s','87s','76s','65s'],
      _RANGE_OFFSUIT_BR
    ),
    BTN: _rangeSet(
      _RANGE_PAIRS_ALL,
      _RANGE_SUITED_ACES, _RANGE_SUITED_KINGS,
      ['QJs','QTs','Q9s','Q8s','JTs','J9s','J8s','T9s','T8s','98s','97s','87s','86s','76s','75s','65s','54s'],
      _RANGE_OFFSUIT_BR,
      ['A9o','K9o','Q9o','J9o','T9o']
    ),
    SB: _rangeSet(
      _RANGE_PAIRS_ALL,
      _RANGE_SUITED_ACES,
      ['KQs','KJs','KTs','QJs','QTs','JTs','T9s','98s','87s'],
      _RANGE_OFFSUIT_BR
    ),
    BB: _rangeSet(
      _RANGE_PAIRS_ALL,
      _RANGE_SUITED_ACES, _RANGE_SUITED_KINGS, _RANGE_SUITED_Q, _RANGE_SUITED_J,
      ['T9s','T8s','98s','97s','87s','76s','65s'],
      _RANGE_OFFSUIT_BR,
      ['A9o','K9o']
    )
  },
  guideByPos: {
    CO: { ideal: '40-50%', tight: 30, loose: 55, desc: 'Cutoff opens 40-50% 4-handed: suited aces, broadways, pairs down to 22, suited connectors 65s+.' },
    BTN: { ideal: '50-60%', tight: 40, loose: 65, desc: 'Button still strong. Raise 50-60%: add wider suited cards, more suited connectors, a few extra offsuit broadways.' },
    SB: { ideal: '30-40%', tight: 22, loose: 45, desc: 'Still painful out of position. 3-bet or fold vs opens; raise 30-40% when folded to.' },
    BB: { ideal: '35-45%', tight: 25, loose: 55, desc: 'Defend 35-45% vs button, tighter vs earlier positions. Avoid calling hands that flop weak out of position.' }
  },
  openRaise:  '2.5-3x',
  threeBet:   '10-15%',
  cbetFreq:   '50-60% in position',
  aggression: 'Aggressive but measured. Button raises 50-60%.',
  notes:      'Button strong, cutoff becomes relevant. Postflop 40-60% pot on flop, 60-80% turn/river value.'
};

// 5-handed
SEAT_MATRIX[5] = {
  positions: ['HJ', 'CO', 'BTN', 'SB', 'BB'],
  rangesByPos: {
    HJ: _rangeSet(
      ['AA','KK','QQ','JJ','TT','99','88','77','66','55'],
      ['AKs','AQs','AJs','ATs','A9s','KQs','KJs','KTs','QJs','QTs','JTs','T9s','98s'],
      ['AKo','AQo','AJo','KQo']
    ),
    CO: _rangeSet(
      _RANGE_PAIRS_ALL,
      ['AKs','AQs','AJs','ATs','A9s','A8s','A5s','A4s','A3s','A2s'],
      ['KQs','KJs','KTs','K9s','QJs','QTs','Q9s','JTs','J9s','T9s','98s','87s','76s','65s'],
      _RANGE_OFFSUIT_BR
    ),
    BTN: _rangeSet(
      _RANGE_PAIRS_ALL,
      _RANGE_SUITED_ACES, _RANGE_SUITED_KINGS,
      _RANGE_SUITED_Q,
      ['JTs','J9s','J8s','T9s','T8s','98s','97s','87s','86s','76s','75s','65s','54s'],
      _RANGE_OFFSUIT_BR,
      ['A9o','K9o','Q9o']
    ),
    SB: _rangeSet(
      _RANGE_PAIRS_ALL,
      ['AKs','AQs','AJs','ATs','A9s','A5s','A4s'],
      ['KQs','KJs','KTs','QJs','QTs','JTs','T9s','98s','87s','76s'],
      _RANGE_OFFSUIT_BR
    ),
    BB: _rangeSet(
      _RANGE_PAIRS_ALL,
      _RANGE_SUITED_ACES, _RANGE_SUITED_KINGS, _RANGE_SUITED_Q,
      ['JTs','J9s','T9s','T8s','98s','97s','87s','76s','65s'],
      _RANGE_OFFSUIT_BR,
      ['A9o','A8o']
    )
  },
  guideByPos: {
    HJ: { ideal: '25-35%', tight: 18, loose: 38, desc: 'Hijack at 5-handed opens 25-35%. Pairs 55+, strong broadways, suited connectors T9s+.' },
    CO: { ideal: '35-45%', tight: 27, loose: 48, desc: 'Cutoff opens 35-45%. Wider suited aces, more suited connectors, pairs down to 22.' },
    BTN: { ideal: '45-55%', tight: 35, loose: 60, desc: 'Button opens 45-55%: the widest range at the table.' },
    SB: { ideal: '28-38%', tight: 20, loose: 42, desc: '3-bet or fold vs opens. When folded to, open 28-38%.' },
    BB: { ideal: '30-40%', tight: 22, loose: 45, desc: 'Defend 30-40% vs button, 25-35% vs earlier positions.' }
  },
  openRaise:  '2.5-3x',
  threeBet:   '8-12%',
  cbetFreq:   '45-55% in position',
  aggression: 'Moderate aggression. Button raises 45-55%.',
  notes:      'Early position (HJ) starts to matter. Postflop 50-66% pot. Turn/river 66-100% when value betting or polarised.'
};

// 6-handed
SEAT_MATRIX[6] = {
  positions: ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
  rangesByPos: {
    UTG: _rangeSet(
      ['AA','KK','QQ','JJ','TT','99','88','77'],
      ['AKs','AQs','AJs','ATs','KQs','KJs','QJs'],
      ['AKo','AQo']
    ),
    HJ: _rangeSet(
      ['AA','KK','QQ','JJ','TT','99','88','77','66','55'],
      ['AKs','AQs','AJs','ATs','A9s','KQs','KJs','KTs','QJs','QTs','JTs','T9s','98s'],
      ['AKo','AQo','AJo','KQo']
    ),
    CO: _rangeSet(
      _RANGE_PAIRS_ALL,
      ['AKs','AQs','AJs','ATs','A9s','A5s','A4s','A3s','A2s'],
      ['KQs','KJs','KTs','K9s','QJs','QTs','Q9s','JTs','J9s','T9s','98s','87s','76s','65s'],
      ['AKo','AQo','AJo','ATo','KQo','KJo','QJo']
    ),
    BTN: _rangeSet(
      _RANGE_PAIRS_ALL,
      _RANGE_SUITED_ACES, _RANGE_SUITED_KINGS,
      _RANGE_SUITED_Q,
      ['JTs','J9s','J8s','T9s','T8s','98s','97s','87s','86s','76s','75s','65s','54s'],
      _RANGE_OFFSUIT_BR,
      ['A9o','A8o','K9o','Q9o']
    ),
    SB: _rangeSet(
      _RANGE_PAIRS_ALL,
      ['AKs','AQs','AJs','ATs','A9s','A8s','A5s','A4s'],
      ['KQs','KJs','KTs','QJs','QTs','JTs','T9s','98s','87s','76s'],
      _RANGE_OFFSUIT_BR
    ),
    BB: _rangeSet(
      _RANGE_PAIRS_ALL,
      _RANGE_SUITED_ACES, _RANGE_SUITED_KINGS, _RANGE_SUITED_Q, _RANGE_SUITED_J, _RANGE_SUITED_T,
      ['98s','97s','87s','76s','65s','54s'],
      _RANGE_OFFSUIT_BR,
      ['A9o','A8o','A7o','K9o','Q9o','T9o']
    )
  },
  guideByPos: {
    UTG: { ideal: '15-20%', tight: 10, loose: 24, desc: 'Under the gun at 6-max opens 15-20%. Pairs 77+, AQ+, AJs+, KQs. Keep it tight.' },
    HJ: { ideal: '20-30%', tight: 15, loose: 32, desc: 'Hijack opens 20-30%. Add pairs to 55, more suited broadways, suited connectors T9s+.' },
    CO: { ideal: '30-40%', tight: 22, loose: 42, desc: 'Cutoff opens 30-40%. Any pair, suited aces, suited connectors 65s+.' },
    BTN: { ideal: '40-50%', tight: 32, loose: 55, desc: 'Button opens 40-50%: attack the blinds.' },
    SB: { ideal: '25-35%', tight: 18, loose: 40, desc: '3-bet or fold vs opens. Open 25-35% when folded to.' },
    BB: { ideal: '25-35%', tight: 18, loose: 40, desc: 'Defend 25-35% vs button, tighter vs earlier positions.' }
  },
  openRaise:  '2.5-3x (3-4x from early position)',
  threeBet:   '6-10%',
  cbetFreq:   '40-50% in position',
  aggression: 'Measured aggression. Button raises 40-50%.',
  notes:      'Early position tight. Need strong hands (JJ+, AQ+, suited broadway) to open UTG. Postflop 50-75% pot, turn/river 75-100%.'
};

// 7-handed (extrapolated - add UTG+1)
SEAT_MATRIX[7] = {
  positions: ['UTG', 'UTG+1', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
  rangesByPos: {
    UTG: _rangeSet(
      ['AA','KK','QQ','JJ','TT','99','88'],
      ['AKs','AQs','AJs','KQs'],
      ['AKo','AQo']
    ),
    'UTG+1': _rangeSet(
      ['AA','KK','QQ','JJ','TT','99','88','77'],
      ['AKs','AQs','AJs','ATs','KQs','KJs','QJs'],
      ['AKo','AQo']
    ),
    HJ: _rangeSet(
      ['AA','KK','QQ','JJ','TT','99','88','77','66'],
      ['AKs','AQs','AJs','ATs','A9s','KQs','KJs','KTs','QJs','QTs','JTs','T9s'],
      ['AKo','AQo','AJo','KQo']
    ),
    CO: _rangeSet(
      ['AA','KK','QQ','JJ','TT','99','88','77','66','55','44'],
      ['AKs','AQs','AJs','ATs','A9s','A5s','A4s'],
      ['KQs','KJs','KTs','K9s','QJs','QTs','Q9s','JTs','J9s','T9s','98s','87s','76s'],
      ['AKo','AQo','AJo','ATo','KQo','KJo']
    ),
    BTN: _rangeSet(
      _RANGE_PAIRS_ALL,
      _RANGE_SUITED_ACES,
      ['KQs','KJs','KTs','K9s','K8s','QJs','QTs','Q9s','Q8s','JTs','J9s','J8s','T9s','T8s','98s','97s','87s','76s','65s','54s'],
      _RANGE_OFFSUIT_BR,
      ['A9o','K9o']
    ),
    SB: _rangeSet(
      _RANGE_PAIRS_ALL,
      ['AKs','AQs','AJs','ATs','A9s','A5s'],
      ['KQs','KJs','KTs','QJs','QTs','JTs','T9s','98s','87s'],
      _RANGE_OFFSUIT_BR
    ),
    BB: _rangeSet(
      _RANGE_PAIRS_ALL,
      _RANGE_SUITED_ACES, _RANGE_SUITED_KINGS, _RANGE_SUITED_Q,
      ['JTs','J9s','T9s','98s','87s','76s','65s'],
      _RANGE_OFFSUIT_BR,
      ['A9o','K9o']
    )
  },
  guideByPos: {
    UTG:    { ideal: '10-15%', tight: 7,  loose: 18, desc: '7-handed UTG is tight: premium pairs, AQ+, AJs+, KQs.' },
    'UTG+1':{ ideal: '12-18%', tight: 9,  loose: 22, desc: 'Slightly wider than UTG: add 77, KJs, QJs, AJo.' },
    HJ:     { ideal: '18-25%', tight: 13, loose: 28, desc: 'Hijack opens 18-25% at 7-handed.' },
    CO:     { ideal: '25-35%', tight: 18, loose: 38, desc: 'Cutoff opens 25-35%.' },
    BTN:    { ideal: '35-45%', tight: 27, loose: 50, desc: 'Button opens 35-45%.' },
    SB:     { ideal: '22-32%', tight: 15, loose: 36, desc: 'Open 22-32% when folded to; 3-bet or fold vs opens.' },
    BB:     { ideal: '22-32%', tight: 15, loose: 38, desc: 'Defend 22-32% depending on opener position.' }
  },
  openRaise:  '2.5-3x (3-4x from early position)',
  threeBet:   '5-9%',
  cbetFreq:   '35-45% in position',
  aggression: 'Tighter early, aggressive late.',
  notes:      'Adds UTG+1. Early position very disciplined; late position still attacks.'
};

// 8-handed (extrapolated - add MP)
SEAT_MATRIX[8] = {
  positions: ['UTG', 'UTG+1', 'MP', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
  rangesByPos: {
    UTG: _rangeSet(
      ['AA','KK','QQ','JJ','TT','99','88'],
      ['AKs','AQs','AJs','KQs'],
      ['AKo']
    ),
    'UTG+1': _rangeSet(
      ['AA','KK','QQ','JJ','TT','99','88'],
      ['AKs','AQs','AJs','ATs','KQs','KJs'],
      ['AKo','AQo']
    ),
    MP: _rangeSet(
      ['AA','KK','QQ','JJ','TT','99','88','77'],
      ['AKs','AQs','AJs','ATs','KQs','KJs','KTs','QJs','QTs'],
      ['AKo','AQo','AJo']
    ),
    HJ: _rangeSet(
      ['AA','KK','QQ','JJ','TT','99','88','77','66','55'],
      ['AKs','AQs','AJs','ATs','A9s','KQs','KJs','KTs','QJs','QTs','JTs','T9s'],
      ['AKo','AQo','AJo','KQo']
    ),
    CO: _rangeSet(
      _RANGE_PAIRS_ALL,
      ['AKs','AQs','AJs','ATs','A9s','A5s','A4s'],
      ['KQs','KJs','KTs','K9s','QJs','QTs','Q9s','JTs','J9s','T9s','98s','87s','76s','65s'],
      ['AKo','AQo','AJo','ATo','KQo','KJo']
    ),
    BTN: _rangeSet(
      _RANGE_PAIRS_ALL,
      _RANGE_SUITED_ACES,
      ['KQs','KJs','KTs','K9s','K8s','QJs','QTs','Q9s','Q8s','JTs','J9s','J8s','T9s','T8s','98s','97s','87s','76s','65s'],
      _RANGE_OFFSUIT_BR,
      ['A9o','K9o']
    ),
    SB: _rangeSet(
      ['AA','KK','QQ','JJ','TT','99','88','77','66','55','44','33','22'],
      ['AKs','AQs','AJs','ATs','A9s','A5s'],
      ['KQs','KJs','KTs','QJs','QTs','JTs','T9s','98s','87s'],
      _RANGE_OFFSUIT_BR
    ),
    BB: _rangeSet(
      _RANGE_PAIRS_ALL,
      _RANGE_SUITED_ACES, _RANGE_SUITED_KINGS,
      ['QJs','QTs','Q9s','JTs','J9s','T9s','98s','87s','76s','65s'],
      _RANGE_OFFSUIT_BR
    )
  },
  guideByPos: {
    UTG:    { ideal: '8-12%',  tight: 6,  loose: 15, desc: '8-handed UTG is very tight: premium pairs and AK.' },
    'UTG+1':{ ideal: '10-15%', tight: 7,  loose: 18, desc: 'Still tight: AJs+, KJs+, 88+, AQo+.' },
    MP:     { ideal: '12-18%', tight: 9,  loose: 22, desc: 'Middle position opens 12-18%.' },
    HJ:     { ideal: '16-24%', tight: 12, loose: 28, desc: 'Hijack opens 16-24%.' },
    CO:     { ideal: '22-30%', tight: 16, loose: 35, desc: 'Cutoff opens 22-30%.' },
    BTN:    { ideal: '30-40%', tight: 22, loose: 45, desc: 'Button opens 30-40%.' },
    SB:     { ideal: '20-28%', tight: 14, loose: 32, desc: 'Open 20-28% when folded to.' },
    BB:     { ideal: '20-28%', tight: 14, loose: 35, desc: 'Defend 20-28% vs opens.' }
  },
  openRaise:  '2.5-3x (3-4x from early position)',
  threeBet:   '4-8%',
  cbetFreq:   '35-45% in position',
  aggression: 'Tight early, selective late.',
  notes:      'Full-ring territory. Early position demands premium hands.'
};

// 9-handed (extrapolated - add LJ)
SEAT_MATRIX[9] = {
  positions: ['UTG', 'UTG+1', 'MP', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
  rangesByPos: {
    UTG: _rangeSet(
      ['AA','KK','QQ','JJ','TT','99'],
      ['AKs','AQs','AJs','KQs'],
      ['AKo']
    ),
    'UTG+1': _rangeSet(
      ['AA','KK','QQ','JJ','TT','99','88'],
      ['AKs','AQs','AJs','KQs','KJs'],
      ['AKo','AQo']
    ),
    MP: _rangeSet(
      ['AA','KK','QQ','JJ','TT','99','88','77'],
      ['AKs','AQs','AJs','ATs','KQs','KJs','QJs'],
      ['AKo','AQo']
    ),
    LJ: _rangeSet(
      ['AA','KK','QQ','JJ','TT','99','88','77','66'],
      ['AKs','AQs','AJs','ATs','KQs','KJs','KTs','QJs','QTs','JTs'],
      ['AKo','AQo','AJo']
    ),
    HJ: _rangeSet(
      ['AA','KK','QQ','JJ','TT','99','88','77','66','55'],
      ['AKs','AQs','AJs','ATs','A9s','KQs','KJs','KTs','QJs','QTs','JTs','T9s'],
      ['AKo','AQo','AJo','KQo']
    ),
    CO: _rangeSet(
      _RANGE_PAIRS_ALL,
      ['AKs','AQs','AJs','ATs','A9s','A5s','A4s'],
      ['KQs','KJs','KTs','K9s','QJs','QTs','Q9s','JTs','J9s','T9s','98s','87s','76s'],
      ['AKo','AQo','AJo','ATo','KQo','KJo']
    ),
    BTN: _rangeSet(
      _RANGE_PAIRS_ALL,
      _RANGE_SUITED_ACES,
      ['KQs','KJs','KTs','K9s','K8s','QJs','QTs','Q9s','Q8s','JTs','J9s','J8s','T9s','T8s','98s','97s','87s','76s','65s'],
      _RANGE_OFFSUIT_BR,
      ['A9o','K9o']
    ),
    SB: _rangeSet(
      ['AA','KK','QQ','JJ','TT','99','88','77','66','55','44','33','22'],
      ['AKs','AQs','AJs','ATs','A9s'],
      ['KQs','KJs','KTs','QJs','QTs','JTs','T9s','98s','87s'],
      _RANGE_OFFSUIT_BR
    ),
    BB: _rangeSet(
      _RANGE_PAIRS_ALL,
      _RANGE_SUITED_ACES, _RANGE_SUITED_KINGS,
      ['QJs','QTs','Q9s','JTs','J9s','T9s','98s','87s','76s','65s'],
      _RANGE_OFFSUIT_BR
    )
  },
  guideByPos: {
    UTG:    { ideal: '7-10%',  tight: 5,  loose: 13, desc: '9-handed UTG is extremely tight: top pairs, AKs, AQs, AKo only.' },
    'UTG+1':{ ideal: '8-13%',  tight: 6,  loose: 16, desc: 'Barely wider than UTG.' },
    MP:     { ideal: '10-15%', tight: 7,  loose: 18, desc: 'Middle position opens 10-15%.' },
    LJ:     { ideal: '12-18%', tight: 9,  loose: 22, desc: 'Lojack opens 12-18%.' },
    HJ:     { ideal: '14-22%', tight: 11, loose: 26, desc: 'Hijack opens 14-22%.' },
    CO:     { ideal: '20-28%', tight: 14, loose: 32, desc: 'Cutoff opens 20-28%.' },
    BTN:    { ideal: '28-38%', tight: 20, loose: 42, desc: 'Button opens 28-38%.' },
    SB:     { ideal: '18-26%', tight: 12, loose: 30, desc: 'Open 18-26% when folded to.' },
    BB:     { ideal: '18-28%', tight: 12, loose: 32, desc: 'Defend 18-28% vs opens.' }
  },
  openRaise:  '3-4x (4x+ from early position)',
  threeBet:   '3-7%',
  cbetFreq:   '30-40% in position',
  aggression: 'Very tight early, still selective late.',
  notes:      'Full-ring 9-max. Very disciplined early position; exploit weak opens from blinds when folded to.'
};

// ── FLOP_MATRIX ─────────────────────────────────────────────────────────────
// Keyed by flop bucket (HU / 3-way / multiway)

var FLOP_MATRIX = {
  HU: {
    cbetFreq:      '65-75%',
    cbetSizing:    '33-50% pot on dry boards, 66%+ on wet or polarised',
    continueRange: 'Defend wide: any pair, any draw, any overcards with backdoors',
    showdownBar:   'Bottom pair, ace-high can be enough',
    notes:         'Heads-up postflop is about fold equity. C-bet often, barrel turn on good equity, value-bet thin.'
  },
  '3-way': {
    cbetFreq:      '45-55%',
    cbetSizing:    '50-66% pot as default; smaller when range-betting dry boards',
    continueRange: 'Top pair good kicker or better usually best; draws fine for one bet',
    showdownBar:   'Top pair decent kicker. Pay off less often',
    notes:         '3-way pots play closer to GTO. One opponent usually has something. Fire value bets, fold marginal hands more often.'
  },
  multiway: {
    cbetFreq:      '25-35%',
    cbetSizing:    '66-100% pot: protect against draws and extract from made hands',
    continueRange: 'Top pair top kicker or better; draws need pot odds',
    showdownBar:   'Two pair+ is the bar; top pair is often just a bluff-catcher',
    notes:         'Multiway pots demand strong hands. C-bet less often, size bigger when you do, avoid bluffing into 3+ opponents.'
  }
};

// ── STACK_MATRIX ────────────────────────────────────────────────────────────
// Keyed by stack bucket from js/helpers/stack-bands.js:
//   short ≤ 50 BB / mid ≤ 150 BB / deep ≤ 300 BB / very-deep > 300 BB / unknown.
// Tuned for Torn: min buy-in 50 BB, max buy-in 200 BB, stacks can run past 300.

var STACK_MATRIX = {
  short: {
    label:             '≤ 50 BB',
    rangeMultiplier:   0.8,  // tighten 20% - below min buy-in, recovery mode
    cbetAdjustment:    -10,
    sizingAdjustment:  'Smaller c-bets (33-50%). At very short depth (<25 BB) prefer shove-or-check.',
    threeBetAdjustment:'3-bets become commitment decisions. Min 3-bets are dead money once under 25 BB.',
    jamGuide: {
      BTN: '15-20 BB jam: any pair, any ace, suited broadways, suited connectors T9s+',
      SB:  '10-15 BB jam: any pair, Ax, suited broadways',
      BB:  'Call jams with pairs 66+, AQ+, AJs+; fold junk'
    },
    notes: 'Short-stack regime: below min buy-in. Tighten opens, prefer linear ranges. Below 25 BB shifts toward push/fold.'
  },
  mid: {
    label:             '50-150 BB',
    rangeMultiplier:   1.0,
    cbetAdjustment:    0,
    sizingAdjustment:  'Standard NLHE sizing. See flop-bucket guidance.',
    threeBetAdjustment:'Standard 3-bet frequencies per seat.',
    notes: 'Full NLHE regime. The seat matrix applies directly. Play value hands, balance with bluffs, exploit reads.'
  },
  deep: {
    label:             '150-300 BB',
    rangeMultiplier:   1.15, // widen speculative edges
    cbetAdjustment:    -5,
    sizingAdjustment:  'Smaller bets with deeper protection. Overbet on the river when polarised.',
    threeBetAdjustment:'3-bet slightly wider with implied odds.',
    speculativeBonus:  _rangeSet(
      ['33','22','98s','97s','87s','76s','65s','54s','J9s','T8s','Q9s','K9s'],
      ['J8s','T7s','96s','86s']
    ),
    notes: 'Deep-stack regime. Implied odds reward suited connectors, small pairs, suited gappers. Thin river value and hero calls get harder.'
  },
  'very-deep': {
    label:             '300+ BB',
    rangeMultiplier:   1.2,
    cbetAdjustment:    -10,
    sizingAdjustment:  'Smaller flops, bigger turns/rivers. Overbets carry more weight: SPR is enormous.',
    threeBetAdjustment:'3-bet wider with position and suited holdings. Avoid out-of-position 3-bets without strong equity.',
    speculativeBonus:  _rangeSet(
      ['33','22','98s','97s','87s','76s','65s','54s','J9s','T8s','Q9s','K9s'],
      ['J8s','T7s','96s','86s']
    ),
    notes: 'Very deep regime (past 300 BB). Position and implied odds dominate. Disguised hands and suited speculatives gain most. River decisions get huge: thin value is dangerous.'
  },
  unknown: {
    label:             'unknown',
    rangeMultiplier:   1.0,
    cbetAdjustment:    0,
    sizingAdjustment:  'Insufficient stack info. Defaulting to standard.',
    threeBetAdjustment:'Defaulting to standard 3-bet frequencies.',
    notes: 'Effective stack could not be determined from the hand log. Falling back to standard guidance.'
  }
};

// ── PER-METRIC TARGET BANDS ─────────────────────────────────────────────────
// Drives the layered-verdict engine. Each metric has a {tight, ideal, loose}
// band per (seats, position) cell. VPIP comes straight from guideByPos; PFR
// derives from VPIP (early position opens are nearly all raises, late
// position adds limps); AF / cbet / foldToRaise are seats-driven defaults
// that don't strongly vary by position.

var _EARLY_POS = { UTG: 1, 'UTG+1': 1, MP: 1, LJ: 1 };

var _AF_BY_SEATS = {
  2: { tight: 35, ideal: 45, loose: 60 },
  3: { tight: 30, ideal: 40, loose: 55 },
  4: { tight: 28, ideal: 38, loose: 52 },
  5: { tight: 25, ideal: 35, loose: 48 },
  6: { tight: 22, ideal: 32, loose: 45 },
  7: { tight: 20, ideal: 30, loose: 42 },
  8: { tight: 18, ideal: 28, loose: 40 },
  9: { tight: 18, ideal: 28, loose: 40 }
};

var _CBET_BY_SEATS = {
  2: { tight: 55, ideal: 70, loose: 85 },
  3: { tight: 50, ideal: 65, loose: 80 },
  4: { tight: 45, ideal: 58, loose: 72 },
  5: { tight: 42, ideal: 52, loose: 65 },
  6: { tight: 40, ideal: 50, loose: 62 },
  7: { tight: 38, ideal: 48, loose: 60 },
  8: { tight: 35, ideal: 45, loose: 58 },
  9: { tight: 35, ideal: 45, loose: 58 }
};

var _FTR_BY_SEATS = {
  2: { tight: 30, ideal: 42, loose: 55 },
  3: { tight: 32, ideal: 45, loose: 58 },
  4: { tight: 33, ideal: 46, loose: 60 },
  5: { tight: 33, ideal: 46, loose: 60 },
  6: { tight: 35, ideal: 48, loose: 62 },
  7: { tight: 35, ideal: 50, loose: 65 },
  8: { tight: 35, ideal: 50, loose: 65 },
  9: { tight: 35, ideal: 50, loose: 65 }
};

// Parse "15-20%" → midpoint number. Falls back to (tight+loose)/2 in metricTargets.
function _parseIdealMid(s) {
  if (!s) return null;
  var m = String(s).match(/(\d+)\s*-\s*(\d+)/);
  if (!m) return null;
  return Math.round((parseInt(m[1], 10) + parseInt(m[2], 10)) / 2);
}

// Returns {vpip, pfr, af, cbet, foldToRaise} bands for one (seats, position)
// cell, or null if the cell isn't in the matrix.
function metricTargets(seats, position) {
  var seatEntry = matrixForSeats(seats);
  if (!seatEntry) return null;
  var guide = seatEntry.guideByPos[position];
  if (!guide) return null;

  var vpipMid = _parseIdealMid(guide.ideal);
  if (vpipMid == null) vpipMid = Math.round((guide.tight + guide.loose) / 2);
  var vpip = { tight: guide.tight, ideal: vpipMid, loose: guide.loose };

  // PFR ≈ ratio × VPIP. Early position is nearly all raises (0.85), late
  // position adds limps and flats (0.7).
  var ratio = _EARLY_POS[position] ? 0.85 : 0.7;
  var pfr = {
    tight: Math.max(0, Math.round(vpip.tight * ratio)),
    ideal: Math.max(0, Math.round(vpip.ideal * ratio)),
    loose: Math.max(0, Math.round(vpip.loose * ratio))
  };

  var clampedSeats = Math.max(2, Math.min(9, seats || 6));

  return {
    vpip: vpip,
    pfr: pfr,
    af: _AF_BY_SEATS[clampedSeats],
    cbet: _CBET_BY_SEATS[clampedSeats],
    foldToRaise: _FTR_BY_SEATS[clampedSeats]
  };
}

// ── PLAYSTYLE OFFSETS ───────────────────────────────────────────────────────
// Each style is an additive point shift applied at lookup time on top of the
// matrix bands. TAG is the baseline (no shift). Numbers are starting points
// - calibrate by eye.

var STYLE_OFFSETS = {
  TAG:     { vpip: 0,   pfr: 0,   af: 0,   cbet: 0,   foldToRaise: 0 },
  Shark:   { vpip: -2,  pfr: 0,   af: 6,   cbet: 4,   foldToRaise: 2 },
  Rock:    { vpip: -4,  pfr: -3,  af: -8,  cbet: -4,  foldToRaise: 4 },
  LAG:     { vpip: 8,   pfr: 6,   af: 8,   cbet: 5,   foldToRaise: -5 },
  Cannon:  { vpip: 6,   pfr: 2,   af: -2,  cbet: -2,  foldToRaise: -4 },
  Nit:     { vpip: -6,  pfr: -5,  af: -3,  cbet: -3,  foldToRaise: 6 },
  Station: { vpip: 10,  pfr: -4,  af: -10, cbet: -8,  foldToRaise: -10 },
  Maniac:  { vpip: 14,  pfr: 12,  af: 15,  cbet: 10,  foldToRaise: -10 }
};

var STYLE_LIST = ['Shark', 'TAG', 'LAG', 'Cannon', 'Rock', 'Nit', 'Station', 'Maniac'];

// Read the user's chosen style. Defaults to 'TAG'. Persisted in localStorage.
function getUserStyle() {
  var s = getString('tc_user_style', null);
  return (s && STYLE_OFFSETS[s]) ? s : 'TAG';
}

function setUserStyle(style) {
  if (!STYLE_OFFSETS[style]) return;
  setString('tc_user_style', style);
}

// The persisted style now serves as the player's target playstyle. Alias
// getUserStyle so callers can read it under the clearer name.
function getTargetStyle() { return getUserStyle(); }

// Leaf lookup: returns the {tight, ideal, loose} band for a single metric in
// a single cell, with the user's playstyle offset applied. style optional -
// defaults to the persisted user style.
function matrixTarget(metric, position, seats, style) {
  var targets = metricTargets(seats, position);
  if (!targets || !targets[metric]) return null;
  var base = targets[metric];
  var styleKey = style || getUserStyle();
  var off = (STYLE_OFFSETS[styleKey] || STYLE_OFFSETS.TAG)[metric] || 0;
  return {
    tight: Math.max(0, base.tight + off),
    ideal: Math.max(0, base.ideal + off),
    loose: Math.max(0, base.loose + off)
  };
}

// ── BUCKET HELPERS ──────────────────────────────────────────────────────────

// seatBucket: raw count 2-9 → '2p'..'9p'. Over 9 clamps to '9p'.
function seatBucket(n) {
  if (!n || n < 2) return null;
  if (n > 9) n = 9;
  return n + 'p';
}

// flopBucket: count of players seeing the flop → 'HU' / '3-way' / 'multiway'.
// null when the hand ended preflop.
function flopBucket(nFlop) {
  if (nFlop == null) return null;
  if (nFlop <= 1) return null;          // everyone folded preflop (or only hero)
  if (nFlop === 2) return 'HU';
  if (nFlop === 3) return '3-way';
  return 'multiway';
}

// Stack-depth bucketing lives in js/helpers/stack-bands.js — call stackBandKey()
// directly. Bucket keys: short / mid / deep / very-deep / unknown.

// ── MATRIX COMPOSER ─────────────────────────────────────────────────────────

// Look up the seat entry, clamping 2-9.
function matrixForSeats(seats) {
  if (!seats || seats < 2) return null;
  var n = seats > 9 ? 9 : seats;
  return SEAT_MATRIX[n] || null;
}

function matrixForFlop(fb) {
  if (!fb) return null;
  return FLOP_MATRIX[fb] || null;
}

function matrixForStack(sb) {
  return STACK_MATRIX[sb || 'unknown'];
}

// Compose advice for a specific situation. All fields optional; absent fields
// yield partial advice.
//   seats       (2-9 or '2p'..'9p')
//   position    ('BTN', 'CO', ...)
//   flopBucket  ('HU' / '3-way' / 'multiway')
//   stackBucket ('short' / 'mid' / 'deep' / 'very-deep')
//   effStackBB  (numeric, optional - enables sub-band jam override under 25 BB)
function adviceFor(params) {
  params = params || {};
  var seats = params.seats;
  if (typeof seats === 'string' && seats.slice(-1) === 'p') seats = parseInt(seats, 10);
  var seatEntry = matrixForSeats(seats);
  var flopEntry = matrixForFlop(params.flopBucket);
  var stackEntry = matrixForStack(params.stackBucket);

  var result = {
    seats: seats,
    position: params.position || null,
    flopBucket: params.flopBucket || null,
    stackBucket: params.stackBucket || 'unknown',
    seatEntry: seatEntry,
    flopEntry: flopEntry,
    stackEntry: stackEntry,
    // Composed outputs:
    recommendedRange: null,
    vpipGuide: null,
    cbetFreq: flopEntry ? flopEntry.cbetFreq : null,
    cbetSizing: flopEntry ? flopEntry.cbetSizing : null,
    notes: []
  };

  if (seatEntry && params.position) {
    result.recommendedRange = seatEntry.rangesByPos[params.position] || null;
    result.vpipGuide = seatEntry.guideByPos[params.position] || null;
  }

  // Push/fold override fires on actual stack depth, not bucket name (the short
  // band covers 0-50 BB, but push/fold only applies under ~25 BB).
  if (params.effStackBB != null && params.effStackBB < 25) {
    result.recommendedRange = null; // use jamGuide instead
    result.jamGuide = stackEntry && stackEntry.jamGuide ? stackEntry.jamGuide[params.position] || null : null;
  }

  // Deep / very-deep: augment range with speculative hands.
  if ((result.stackBucket === 'deep' || result.stackBucket === 'very-deep') &&
      result.recommendedRange && stackEntry && stackEntry.speculativeBonus) {
    var augmented = new Set(result.recommendedRange);
    stackEntry.speculativeBonus.forEach(function(combo) { augmented.add(combo); });
    result.recommendedRange = augmented;
  }

  if (seatEntry) result.notes.push(seatEntry.aggression);
  if (stackEntry && stackEntry.notes) result.notes.push(stackEntry.notes);
  if (flopEntry) result.notes.push(flopEntry.notes);

  return result;
}
